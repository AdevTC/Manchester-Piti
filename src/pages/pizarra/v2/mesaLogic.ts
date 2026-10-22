// La pizarra ⇄ la mesa (la alineación del partido, matches/{id}.lineup). Pure: which board «desde la
// mesa» opens (the match's official when you may edit it, else your own copy bound to the match), who is
// available once the mesa has called the roll («¿Quién ha venido?»), what «Mandar a la mesa» would change
// (sistema, siete, banquillo, portero: igual / cambia, in words), whether the mesa has the board's seven,
// and in play who is on the pitch now (lineupNow) and how to bring it onto the board («Traer aquí»).
import type { Lineup } from "../formations";
import type { LineupDoc } from "../lineupDoc";
import {
  convocatoriaOf,
  lineupWalk,
  lineupSeven,
  sameLineup,
  type BoardLineup,
  type LineupEvent,
  type LineupSlot,
  type MatchLineup,
} from "../../../lib/matchLineup";
import { isFormationName } from "../../../lib/formations";
import { jornadaLabel } from "../../../lib/derived/jornada";
import { eventMinute } from "../../../../functions/src/matchEngine";
import { dropBenchedRoles, goFree, setSystem } from "./ops";
import type { Squad } from "./model";

// ── the link from la mesa: /pizarra?desde=mesa&partido=<id>[&tablero=<id>] ──
export interface DesdeMesa {
  /** Opened from la mesa («Elegir el siete en la pizarra»). */
  on: boolean;
  matchId: string | null;
}

const idOf = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" && Number.isFinite(v) ? String(v) : null);

/** The mode the URL asks for (the router parses the query: a value may come as a number). */
export function desdeMesaOf(search: Readonly<Record<string, unknown>>): DesdeMesa {
  const matchId = idOf(search.partido);
  return { on: search.desde === "mesa" && !!matchId, matchId };
}

/** La mesa of a match. */
export const mesaHref = (matchId: string): string => "/partidos/" + encodeURIComponent(matchId) + "/mesa";

/** «Siete del campo · J7»: the name of the copy a scorer works on. */
export const fieldCopyName = (j: number | null | undefined): string => ["Siete del campo", j ? jornadaLabel(j) : ""].filter(Boolean).join(" · ");

// ── which board «desde la mesa» opens ──
export type CopyChoice =
  /** The board on screen is already the one (bound to the match and yours to edit). */
  | { k: "keep" }
  /** Open this board (the match's official for an admin, or your copy bound to the match). */
  | { k: "open"; id: string }
  /** Make your copy of this official, bound to the match, and open it. */
  | { k: "copy"; from: string }
  /** No official to start from: a new board bound to the match, from the convocatoria. */
  | { k: "new" };

const newestOf = (ds: readonly LineupDoc[]): LineupDoc | null =>
  ds.slice().sort((a, b) => (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0))[0] ?? null;

/** Whether `uid` may edit board `d` (firestore.rules, lineups: admins any; owners their own non-official). */
export const canEditBoard = (d: Pick<LineupDoc, "ownerUid" | "isOfficial">, uid: string, isAdmin: boolean): boolean => isAdmin || (d.ownerUid === uid && !d.isOfficial);

/**
 * The board to work on for a match. An admin edits the match's own official; anyone else (a scorer) works
 * on a copy of their own bound to the match: the one they already have, else a new copy of the official
 * (the match's, else the season's), else a new board from the convocatoria. The board on screen stays
 * when it already is such a board (a link's `tablero` that is yours).
 */
export function workingCopy(o: { matchId: string; uid: string; isAdmin: boolean; current: LineupDoc | null; officials: readonly LineupDoc[]; mine: readonly LineupDoc[] }): CopyChoice {
  const { matchId, uid, isAdmin } = o;
  const cur = o.current;
  if (cur && cur.matchId === matchId && canEditBoard(cur, uid, isAdmin)) return { k: "keep" };
  const own = newestOf(o.officials.filter((d) => d.isOfficial && d.matchId === matchId));
  if (own && isAdmin) return { k: "open", id: own.id };
  const copy = newestOf(o.mine.filter((d) => d.matchId === matchId && !d.isOfficial && d.ownerUid === uid));
  if (copy) return { k: "open", id: copy.id };
  const src = own ?? newestOf(o.officials.filter((d) => d.isOfficial && !d.matchId));
  return src ? { k: "copy", from: src.id } : { k: "new" };
}

// ── «¿Quién ha venido?» ──
/** The roll call as a set (null when nobody has called it: present absent or empty). */
export function rollOf(present: readonly string[] | null | undefined): ReadonlySet<string> | null {
  return present?.length ? new Set(present) : null;
}

/** Who Sugerir siete and Auto-colocar may use: who came once the roll is called, else the convocatoria. */
export const availableOf = (called: ReadonlySet<string> | null, roll: ReadonlySet<string> | null): ReadonlySet<string> | null => roll ?? called;

/** The convocatoria's siete that came (the sobre deals them first). */
export const ownThatCame = (starters: readonly string[], roll: ReadonlySet<string> | null): string[] => (roll ? starters.filter((id) => roll.has(id)) : [...starters]);

/** The squad as the sobre and Auto-colocar see it once the roll is called: whoever came counts as «Voy»
 *  (a «No va» who turned up plays), whoever didn't is left out by `availableOf`. */
export function rollSquad(sq: Squad, roll: ReadonlySet<string> | null): Squad {
  if (!roll) return sq;
  const list = sq.list.map((c) => (roll.has(c.id) && c.cv !== "voy" ? { ...c, cv: "voy" as const } : c));
  return { ...sq, list, byId: new Map(list.map((c) => [c.id, c])) };
}

// ── what «Mandar a la mesa» would change ──
export type DiffState = "igual" | "cambia";
export interface DiffRow {
  k: "sistema" | "siete" | "banquillo" | "portero";
  label: string;
  state: DiffState;
  /** What the mesa will have («2-3-1», «Álex»; for the siete and the banquillo, a summary). */
  now: string;
  /** Who leaves / who comes in (siete, banquillo). */
  out: string[];
  in: string[];
  /** What it had («antes 1-3-2-1»), or why it changes without anyone coming or going. */
  note: string;
}

export interface ConvLike {
  starters?: readonly string[];
  bench?: readonly string[];
  notCalled?: readonly string[];
}

/** «2-3-1» / «Libre». */
export const systemLabel = (s: string): string => (s === "libre" ? "Libre" : s);

const minus = (a: readonly string[], b: readonly string[]): string[] => {
  const bs = new Set(b);
  return a.filter((x) => !bs.has(x));
};

/**
 * The rows of «Mandar a la mesa»: the board's seven against the match's lineup (or, while the match has
 * none, its convocatoria). The banquillo is the one the server will leave (convocatoriaOf with who came).
 * Null when the board has no seven to send.
 */
export function mesaDiff(o: { board: BoardLineup | null; match: MatchLineup | null; conv: ConvLike; present: readonly string[] | null; name: (id: string) => string }): DiffRow[] | null {
  const { board, match, name } = o;
  if (!board) return null;
  const seven = lineupSeven(board);
  const before = match ? lineupSeven(match) : [...(o.conv.starters ?? [])];
  const rows: DiffRow[] = [];

  const sysSame = !!match && match.system === board.system;
  rows.push({ k: "sistema", label: "Sistema", state: sysSame ? "igual" : "cambia", now: systemLabel(board.system), out: [], in: [], note: match && !sysSame ? "antes " + systemLabel(match.system) : "" });

  const sOut = minus(before, seven).map(name);
  const sIn = minus(seven, before).map(name);
  let note = "";
  let same = !sOut.length && !sIn.length && before.length === seven.length;
  if (same && match && !sameLineup(board, match)) {
    // the same seven, some in another slot: «Pablo a MD»
    const was = new Map(match.slots.map((s) => [s.playerId, s.code]));
    const moved = board.slots.filter((s) => was.get(s.playerId) !== s.code).map((s) => name(s.playerId) + " a " + s.code);
    // (two of the same puesto swapping sides: the code stays, the side changes)
    const sides = board.slots.filter((s, i) => match.slots[i]?.playerId !== s.playerId).map((s) => name(s.playerId));
    note = moved.length ? "Cambian de sitio: " + moved.join(", ") : "Cambian de lado: " + sides.join(", ");
    same = false;
  }
  if (!match && same) note = "El de la convocatoria, con sus puestos";
  rows.push({ k: "siete", label: "Siete", state: same && !!match ? "igual" : "cambia", now: sOut.length || sIn.length ? "" : "Mismos siete", out: sOut, in: sIn, note });

  const oldBench = [...(o.conv.bench ?? [])];
  const newBench = convocatoriaOf(seven, o.conv, o.present).bench;
  const bOut = minus(oldBench, newBench).map(name);
  const bIn = minus(newBench, oldBench).map(name);
  const bSame = !bOut.length && !bIn.length;
  rows.push({ k: "banquillo", label: "Banquillo", state: bSame ? "igual" : "cambia", now: bSame ? (newBench.length ? newBench.length + " en el banquillo" : "Nadie en el banquillo") : "", out: bOut, in: bIn, note: "" });

  const gk = board.slots[0]?.playerId ?? "";
  const gkWas = match?.slots[0]?.playerId ?? null;
  rows.push({ k: "portero", label: "Portero", state: gkWas === gk ? "igual" : "cambia", now: name(gk), out: [], in: [], note: gkWas && gkWas !== gk ? "antes " + name(gkWas) : "" });
  return rows;
}

// ── the mesa against the board, live ──
export type MesaState = "al-dia" | "otro" | "sin";
/** «Mesa al día» (it has this seven), «Mesa: otro siete», or the match has no lineup yet. */
export function mesaState(board: BoardLineup | null, match: MatchLineup | null): MesaState {
  if (!match) return "sin";
  return sameLineup(board, match) ? "al-dia" : "otro";
}
export const MESA_STATE_TXT: Record<MesaState, string> = { "al-dia": "Mesa al día", otro: "Mesa: otro siete", sin: "Mesa: sin siete" };

// ── en partido: who is on the pitch now ──
export interface FieldChange {
  /** «sub»: inId came on for outId; «red»: outId was sent off (his slot stays empty). */
  k: "sub" | "red";
  inId: string | null;
  outId: string;
  code: string;
  minute: number | null;
}

const minuteOf = (e: LineupEvent): number | null =>
  eventMinute({ ...(typeof e.minute === "number" ? { minute: e.minute } : {}), ...(typeof e.elapsedSeconds === "number" ? { elapsedSeconds: e.elapsedSeconds } : {}) });

/**
 * The pitch now (lineupNow: the contract) and the story of how it got there, in play order: each cambio
 * with the slot it happened in (a sub for a player sent off fills the slot his red emptied), each red.
 * lineupNow's own walk (lineupWalk), so the lines and the pitch agree.
 */
export function fieldStory(lineup: Pick<MatchLineup, "slots">, events: readonly LineupEvent[]): { now: LineupSlot[]; changes: FieldChange[] } {
  const { now, steps } = lineupWalk(lineup, events);
  return { now, changes: steps.map((st) => ({ k: st.k, inId: st.inId, outId: st.outId, code: st.code, minute: minuteOf(st.event) })) };
}

/** «Hugo entró por Sergio (MC) en el 30′» / «Roja a Dani (DFC) en el 12′». */
export function changeLine(c: FieldChange, name: (id: string) => string): string {
  const at = c.minute != null ? " en el " + c.minute + "′" : "";
  return c.k === "sub" && c.inId ? name(c.inId) + " entró por " + name(c.outId) + " (" + c.code + ")" + at : "Roja a " + name(c.outId) + " (" + c.code + ")" + at;
}

/**
 * «Traer aquí»: the board with the pitch as it is now — the lineup's system (or free mode with its
 * spots), each slot with whoever plays in it now (empty after a red). The rest of the board (plan, roles
 * of those still on, cambios previstos) stays; the bench is redone by the board's commit (withBench).
 */
export function bringField(L: Lineup, lineup: Pick<MatchLineup, "system" | "slots">, now: readonly LineupSlot[]): Lineup {
  const base = isFormationName(lineup.system) ? setSystem(L, lineup.system) : goFree(L);
  const at = (s: LineupSlot) => now.find((n) => n.code === s.code && n.x === s.x && n.y === s.y)?.playerId ?? null;
  const ids = lineup.slots.map(at);
  const slots = base.slots.map((s, i) => ({
    ...s,
    playerId: ids[i] ?? null,
    ...(base.freeMode && lineup.slots[i] ? { x: lineup.slots[i].x, y: lineup.slots[i].y } : {}),
  }));
  const onField = new Set(ids.filter((x): x is string => !!x));
  const off = [...L.slots.map((s) => s.playerId), ...L.bench].filter((x): x is string => !!x && !onField.has(x));
  return dropBenchedRoles({ ...base, slots, bench: off.filter((x, i, a) => a.indexOf(x) === i) });
}

/** The pitch now is already the board's (same players in the same slots and system). */
export function fieldOnBoard(board: BoardLineup | null, lineup: Pick<MatchLineup, "system" | "slots">, now: readonly LineupSlot[]): boolean {
  if (!board || board.system !== lineup.system || now.length !== lineup.slots.length) return false;
  return lineup.slots.every((s, i) => board.slots[i]?.playerId === now.find((n) => n.code === s.code && n.x === s.x && n.y === s.y)?.playerId);
}
