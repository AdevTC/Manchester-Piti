// La alineación del partido (matches/{id}.lineup): la única verdad del siete, su sistema y dónde juega
// cada uno. La escribe la pizarra con «Mandar a la mesa» (setMatchLineup, desde el tablero del partido)
// hasta el pitido; la leen la mesa (Antes, En juego), el Campo de la web, la pizarra en partido y el acta.
// En partido no se reescribe: quien entra hereda la casilla de quien sale (lineupNow, desde los eventos).
// Puro (sin Firebase): lo comparten las funciones y la web.
import { z } from "zod";
import { boardSlotCodes, boardSystem, type BoardLike } from "./boardCodes.js";
import { isFormationName, systemDef } from "./formations.js";
import { POS_CODES, type PosCode } from "./positions.js";

/** One of the seven: who, his exact code, and his spot in the pizarra's frame (x 0 → 100 left → right,
 *  y 0 = their goal → 100 = ours). Slot 0 is always the keeper (POR). */
export interface LineupSlot {
  playerId: string;
  code: PosCode;
  x: number;
  y: number;
}

/** matches/{id}.lineup */
export interface MatchLineup {
  /** The board's system: a formation id («2-3-1»…) or «libre». */
  system: string;
  /** Exactly 7, slot 0 the keeper. */
  slots: LineupSlot[];
  /** The board it came from (official for this match after setMatchLineup). */
  boardId: string;
  setBy: string;
  setAt: number;
}

/** What the server derives from a board, before it stamps who/when. */
export type BoardLineup = Pick<MatchLineup, "system" | "slots">;

const SLOTS = 7;
const pct = (v: unknown, d: number): number => (typeof v === "number" && Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : d);

/**
 * The lineup a board puts on the pitch: its 7 slots with their exact codes (boardSlotCodes) and spots
 * (the formation's spot, or where the slot stands in free mode). Null unless all 7 slots hold a player
 * and nobody is twice.
 */
export function lineupFromBoard(b: BoardLike): BoardLineup | null {
  const codes = boardSlotCodes(b);
  const free = b.freeMode === true;
  const spots = systemDef(isFormationName(b.formation) ? b.formation : "2-3-1").spots;
  const seen = new Set<string>();
  const slots: LineupSlot[] = [];
  for (let i = 0; i < SLOTS; i++) {
    const s = b.slots?.[i];
    const id = s?.playerId;
    if (typeof id !== "string" || !id || seen.has(id)) return null;
    seen.add(id);
    const [, fx, fy] = spots[i] ?? ["MC", 50, 50];
    slots.push({ playerId: id, code: codes[i], x: free ? pct(s?.x, fx) : fx, y: free ? pct(s?.y, fy) : fy });
  }
  return { system: boardSystem(b), slots };
}

/** The seven's ids, slot order (keeper first). */
export const lineupSeven = (l: Pick<MatchLineup, "slots">): string[] => l.slots.map((s) => s.playerId);

/** Same players in the same slots (system included): nothing to send. */
export function sameLineup(a: BoardLineup | null | undefined, b: BoardLineup | null | undefined): boolean {
  if (!a || !b || a.system !== b.system || a.slots.length !== b.slots.length) return false;
  return a.slots.every((s, i) => s.playerId === b.slots[i].playerId && s.code === b.slots[i].code);
}

/** What a live event needs for lineupNow (a MatchEvent is one). */
export interface LineupEvent {
  type: string;
  playerId?: string | null;
  inPlayerId?: string | null;
  minute?: number | null;
  elapsedSeconds?: number | null;
  period?: number | null;
  dupOf?: string | null;
  dupOk?: boolean | null;
}
const SENT_OFF = new Set(["red_card", "double_yellow"]);
const counts = (e: LineupEvent): boolean => !(e.dupOf && e.dupOk !== true);
const when = (e: LineupEvent): number => (e.period === 2 ? 1e6 : 0) + (typeof e.elapsedSeconds === "number" ? e.elapsedSeconds : (e.minute ?? 0) * 60);

/**
 * Who is on the pitch now and where: the lineup's slots, each substitution putting the one who comes on
 * in the slot of the one who goes off (rolling: he can come back to any slot that frees), each red
 * emptying its slot. Events in play order; a pending duplicate counts for nothing. Empty slots are left
 * out, so the result has 7 or fewer.
 */
export function lineupNow(lineup: Pick<MatchLineup, "slots">, events: readonly LineupEvent[]): LineupSlot[] {
  const slots: (LineupSlot | null)[] = lineup.slots.map((s) => ({ ...s }));
  const ordered = events.filter(counts).map((e, i) => ({ e, i })).sort((a, b) => when(a.e) - when(b.e) || a.i - b.i);
  for (const { e } of ordered) {
    const at = slots.findIndex((s) => s?.playerId === e.playerId);
    if (at < 0) continue;
    if (e.type === "substitution" && e.inPlayerId && !slots.some((s) => s?.playerId === e.inPlayerId)) slots[at] = { ...slots[at]!, playerId: e.inPlayerId };
    else if (SENT_OFF.has(e.type)) slots[at] = null;
  }
  return slots.filter((s): s is LineupSlot => s !== null);
}

/**
 * The convocatoria a lineup leaves: titulares = the seven; banquillo = who came (`present`) and isn't in
 * the seven, in the old banquillo's order first; whoever didn't come goes to «no convocado». With no
 * roll call (`present` empty or absent) the old convocatoria keeps everyone: the banquillo is the old
 * titulares and banquillo without the seven.
 */
export function convocatoriaOf(
  seven: readonly string[],
  old: { starters?: readonly string[]; bench?: readonly string[]; notCalled?: readonly string[] },
  present?: readonly string[] | null,
): { starters: string[]; bench: string[]; notCalled: string[] } {
  const inSeven = new Set(seven);
  const before = [...(old.bench ?? []), ...(old.starters ?? [])];
  const called = new Set([...before, ...(old.notCalled ?? [])]);
  const roll = present?.length ? new Set(present) : null;
  const benchOrder = [...before, ...(present ?? [])].filter((id, i, a) => a.indexOf(id) === i && !inSeven.has(id));
  const bench = roll ? benchOrder.filter((id) => roll.has(id)) : benchOrder.filter((id) => before.includes(id));
  const notCalled = [...called].filter((id) => !inSeven.has(id) && !bench.includes(id));
  return { starters: [...seven], bench, notCalled };
}

// ---------- reading it back (Firestore → typed; anything malformed reads as «no lineup»)
const slotSchema = z.object({
  playerId: z.string().min(1).max(128),
  code: z.enum(POS_CODES),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
});
export const matchLineupSchema = z.object({
  system: z.string().min(1).max(16),
  slots: z.array(slotSchema).length(SLOTS),
  boardId: z.string().min(1).max(128),
  setBy: z.string().min(1).max(128),
  setAt: z.number(),
});
/** matches/{id}.lineup as stored, or null (absent or malformed: callers fall back to the convocatoria). */
export function parseMatchLineup(v: unknown): MatchLineup | null {
  const r = matchLineupSchema.safeParse(v);
  return r.success && r.data.slots[0].code === "POR" ? r.data : null;
}
/** matches/{id}.present (the mesa's «¿Quién ha venido?»), or null when nobody has called the roll. */
export function parsePresent(v: unknown): string[] | null {
  return Array.isArray(v) && v.every((x) => typeof x === "string") ? (v as string[]) : null;
}

// ---------- the callables (functions/src/matchLineupCallables.ts; src/lib/clubApi.ts)
/** setMatchLineup: an admin, or a scorer of the match, sends a board's seven to the match until kick-off.
 *  The board is the match's official, or one the actor owns; its lineup is copied onto the match's
 *  official board too (created if the match has none), so pizarra, mesa and web agree. */
export interface SetMatchLineupInput {
  matchId: string;
  boardId: string;
}
export interface SetMatchLineupResult {
  ok: true;
  /** false when the match already had this lineup (nothing written, no notice). */
  changed: boolean;
  officialId: string;
  starters: string[];
  bench: string[];
}
/** setMatchPresent: the roll call («¿Quién ha venido?»), admin or scorer, until kick-off. */
export interface SetMatchPresentInput {
  matchId: string;
  present: string[];
}
