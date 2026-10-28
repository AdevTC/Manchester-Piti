// La mesa (r12 «el campo como teclado»), pure: what the boards SC-Mesa390…1920 read off the match, from useMesa's
// MesaView. The seven placed on the pitch over their own spread, the bench's two lines, who is scoring and whether
// the phone is up to date (B-MESA-11), the checks before the whistle, the seven of the 2ª with its keeper chosen
// from any of the seven (B-MESA-02) and following the pitch as it changes (B-MESA-07), what blocks the acta (a goal
// without its scorer included: B-MESA-03), and the crónica's kinds. The components only lay these out.
import { allowedAtBreak } from "../../../../functions/src/liveRules";
import { madridDay, madridTime } from "../../../lib/derived/madrid";
import type { MesaEvent, MesaPlayer, MesaType, MesaView } from "../types";
import { onPitchAt, subsTo } from "../screens/model";

// ---------- words
/** «1 jugada» / «3 jugadas». */
export const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
/** «Pablo», «Pablo y David», «Pablo, David y Ana». */
export const listOf = (xs: readonly string[]): string => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);
/** The name as the shirt prints it: capitals. */
export const upper = (name: string): string => name.toLocaleUpperCase("es");
/** A long name gets a smaller size so it is never cut (no «…» anywhere on la mesa). */
export const lenCls = (name: string): string => (name.length > 11 ? "is-xlong" : name.length > 8 ? "is-long" : "");
const WD = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "short" });
/** «dom 18 oct». */
export const dayText = (ms: number): string => (Number.isFinite(ms) && ms > 0 ? `${WD.format(ms).replace(".", "")} ${madridDay(ms)}` : "");
/** «10:30». */
export const timeText = (ms: number): string => (Number.isFinite(ms) && ms > 0 ? madridTime(ms) : "");
/** «19 min», «1 h 05 min», «2 días» until `at`. */
export function leftText(at: number, now: number): string {
  const m = Math.max(0, Math.round((at - now) / 60_000));
  if (m >= 2 * 1440) return plural(Math.round(m / 1440), "día", "días");
  if (m >= 60) return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`;
  return `${m} min`;
}
/** «00:00»-style for a wait in seconds. */
export const mmss = (s: number): string => `${String(Math.floor(Math.max(0, s) / 60)).padStart(2, "0")}:${String(Math.floor(Math.max(0, s)) % 60).padStart(2, "0")}`;

// ---------- the head
export function partWord(v: MesaView): string {
  switch (v.match.clock.phase) {
    case "ready":
      return "Previa";
    case "first":
      return "1ª parte";
    case "second":
      return "2ª parte";
    case "halftime":
      return "Descanso";
    default:
      return "Final";
  }
}
/** «Manchester Piti – Orduña fc · Jornada 1 · en casa · dom 18 oct». */
export function matchLine(v: MesaView): string {
  const m = v.match;
  const title = m.home ? `Manchester Piti – ${m.rival}` : `${m.rival} – Manchester Piti`;
  return [title, m.round ? `Jornada ${m.round}` : m.competition, m.home ? "en casa" : "fuera", dayText(m.date)].filter(Boolean).join(" · ");
}
/** The score everyone sees plus this phone's goals still going up (they count on la mesa at once). */
export const shownScore = (v: MesaView) => ({ us: v.match.score.us + v.match.queuedGoals.us, them: v.match.score.them + v.match.queuedGoals.them });

/** Who scores now and whether this phone is up to date: «Solo tú · al día», «Tú y Jorge · 2 subiendo», «Sin red · 3 en
 *  el móvil», «… · 1 por revisar». The label never says «al día» with plays still to go up (B-MESA-11). */
export function presenceOf(v: MesaView): { text: string; cls: "is-ok" | "is-wait" | "is-off"; label: string; off: boolean } {
  const others = v.presence.filter((p) => p.fresh && !p.me).map((p) => p.name);
  const base = others.length ? `Tú y ${listOf(others)}` : "Solo tú";
  const { pending, review, online } = v.queue;
  const text = !online ? `Sin red · ${pending} en el móvil` : pending ? `${base} · ${pending} subiendo` : review.length ? `${base} · ${review.length} por revisar` : `${base} · al día`;
  const cls = !online ? "is-off" : pending || review.length ? "is-wait" : "is-ok";
  const who = others.length ? `Tú y ${listOf(others)} anotando` : "Solo tú anotando";
  const state = !online ? `sin red, ${plural(pending, "jugada", "jugadas")} en el móvil` : pending ? `${plural(pending, "jugada", "jugadas")} subiendo` : review.length ? `${plural(review.length, "jugada", "jugadas")} por revisar` : "al día";
  return { text, cls, label: online ? `${who}, ${state}` : `Sin red: ${plural(pending, "jugada", "jugadas")} en el móvil`, off: !online };
}

// ---------- what can be written now
/** "" when a play of `type` can be written now; else why not. */
export function whyNot(v: MesaView, type: MesaType): string {
  const c = v.match.clock;
  if (c.phase !== "first" && c.phase !== "second") return "El reloj no corre: pita el inicio o arranca la parte.";
  if (c.held && !allowedAtBreak(type)) return "En pausa solo se apuntan cambios, tarjetas y tocados. Toca «Seguir».";
  return "";
}

// ---------- the pitch: the seven (and the slots a red emptied) placed over their own spread
export interface Token {
  id: string;
  /** 0–100 across the pitch (left → right on the phone). */
  nx: number;
  /** 0–100 from the attack (top on the phone) to our goal. */
  ny: number;
  player: MesaPlayer;
  /** A slot a red emptied (`player` is the one sent off). */
  hole: boolean;
  code: string | null;
}
export function pitchTokens(field: readonly MesaPlayer[], bench: readonly MesaPlayer[]): Token[] {
  const holes = bench.filter((p) => p.vacancy);
  const raw = [
    ...field.map((p, i) => ({ id: p.id, player: p, hole: false, code: p.pos ?? (p.keeper ? "POR" : null), s: p.spot ?? fallbackSpot(p, i) })),
    ...holes.map((p, i) => ({ id: p.id, player: p, hole: true, code: p.vacancy?.code ?? null, s: p.vacancy?.spot ?? { x: 20 + 30 * i, y: 50 } })),
  ];
  if (!raw.length) return [];
  const xs = raw.map((r) => r.s.x);
  const ys = raw.map((r) => r.s.y);
  const norm = (v: number, a: number, b: number) => (b - a < 1 ? 50 : Math.round(((v - a) / (b - a)) * 1000) / 10);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  return raw.map((r) => ({ id: r.id, player: r.player, hole: r.hole, code: r.code, nx: norm(r.s.x, x0, x1), ny: norm(r.s.y, y0, y1) }));
}
const FALLBACK = [
  { x: 50, y: 93 }, { x: 30, y: 74 }, { x: 70, y: 74 }, { x: 16, y: 46 }, { x: 50, y: 52 }, { x: 84, y: 46 }, { x: 50, y: 14 },
];
const fallbackSpot = (p: MesaPlayer, i: number) => (p.keeper ? FALLBACK[0] : FALLBACK[1 + (i % 6)]);

/** The bench as la mesa shows it: who came (the roll call, when it was passed; anyone who has played or was sent off
 *  stays), each with «sin jugar» / «fuera 18′ · jugó 18′» / «expulsado». */
export function benchRows(v: MesaView): { player: MesaPlayer; l1: string; l2: string; gone: boolean }[] {
  const present = v.match.present;
  const list = present && present.length ? v.bench.filter((p) => present.includes(p.id) || p.played || p.sentOff || p.guest) : v.bench;
  return list.map((p) => ({
    player: p,
    gone: p.sentOff,
    l1: p.sentOff ? "expulsado" : p.played ? `fuera ${p.offAt ?? 0}′` : "sin jugar",
    l2: !p.sentOff && p.played ? `jugó ${p.minutes}′` : "",
  }));
}

// ---------- the plays
export type Glyph = "gol" | "them" | "amarilla" | "roja" | "cambio" | "falta" | "otra";
const OURS = new Set(["goal", "goal_penalty", "goal_freekick", "opponent_own_goal"]);
const THEIRS = new Set(["opponent_goal", "own_goal"]);
const CARDS = new Set(["yellow_card", "double_yellow", "red_card", "opponent_yellow", "opponent_red"]);
const FOULS = new Set(["foul", "foul_received", "opponent_foul", "penalty_received", "penalty_committed"]);
const SUBS = new Set(["substitution", "position_swap"]);
export function glyphOf(type: string): Glyph {
  if (OURS.has(type)) return "gol";
  if (THEIRS.has(type)) return "them";
  if (CARDS.has(type)) return type === "red_card" || type === "double_yellow" || type === "opponent_red" ? "roja" : "amarilla";
  if (SUBS.has(type)) return "cambio";
  if (FOULS.has(type)) return "falta";
  return "otra";
}
export type Kind = "todo" | "goles" | "faltas" | "cambios" | "tarjetas";
export const KINDS: readonly [Kind, string][] = [["todo", "Todo"], ["goles", "Goles"], ["faltas", "Faltas"], ["cambios", "Cambios"], ["tarjetas", "Tarjetas"]];
export function kindOf(type: string): Kind | "otras" {
  if (OURS.has(type) || THEIRS.has(type)) return "goles";
  if (CARDS.has(type)) return "tarjetas";
  if (SUBS.has(type)) return "cambios";
  if (FOULS.has(type)) return "faltas";
  return "otras";
}
/** A play of the rival's (its code goes beside it). */
export const isRival = (e: Pick<MesaEvent, "type">): boolean => (e.type.startsWith("opponent_") && e.type !== "opponent_own_goal") || e.type === "own_goal";
const secs = (e: MesaEvent) => e.elapsedSeconds ?? ((e.minute ?? 1) - 1) * 60;
/** Every play, last first (by time of play, then the order written). */
export const latestFirst = (events: readonly MesaEvent[]): MesaEvent[] => events.map((e, i) => ({ e, i })).sort((a, b) => secs(b.e) - secs(a.e) || b.i - a.i).map((x) => x.e);
/** «Lo apuntaste tú · pase sin contestar · en el móvil»: the author and what is pending, one line. */
export function metaOf(e: MesaEvent): string {
  const by = e.mine ? "Lo apuntaste tú" : `Lo apuntó ${e.byName ?? "otro anotador"}`;
  const flags: string[] = [];
  if (e.pendingScorer) flags.push("falta el goleador");
  if (e.type === "goal" && e.playerId && !e.assistId && !e.assistReviewed) flags.push("pase sin contestar");
  if (e.editedByUid) flags.push(`corregido por ${e.editedByName === "Tú" ? "ti" : e.editedByName ?? "otro anotador"}`);
  if (e.dupOf) flags.push("por confirmar");
  if (e.local) flags.push("en el móvil");
  return [by, ...flags].join(" · ");
}
export const minText = (e: MesaEvent): string => `${e.minute ?? "–"}′`;

// ---------- antes
export function antesChecks(v: MesaView): { ok: boolean; t: string; s: string }[] {
  const seven = v.field.length === 7;
  const present = v.match.present ?? [];
  const called = [...v.field, ...v.bench].filter((p, i, a) => a.findIndex((q) => q.id === p.id) === i);
  const sevenHere = v.field.filter((p) => present.includes(p.id)).length;
  const keeper = v.field.find((p) => p.keeper);
  const keeperHere = !!keeper && (!present.length || present.includes(keeper.id));
  const system = v.match.lineup.system?.split(" · ")[0];
  return [
    {
      ok: seven,
      t: seven ? (v.match.lineup.fromBoard ? `El siete de la pizarra${system ? ` · ${system}` : ""}` : "El siete de la convocatoria") : "El siete, por decidir",
      s: seven ? (present.length ? (sevenHere === 7 ? `Siete de siete titulares · han venido ${present.length}` : `Faltan ${7 - sevenHere} titulares por llegar`) : "Siete de siete titulares") : "Pasa lista y elígelo en la pizarra",
    },
    {
      ok: present.length >= 7,
      t: present.length >= 7 ? `La lista: han venido ${present.length}` : present.length ? `La lista: faltan ${7 - present.length} para el siete` : "La lista, sin pasar",
      s: present.length ? `${present.length} de ${called.length} convocados` : "Nadie marcado todavía",
    },
    {
      ok: keeperHere,
      t: keeper ? (keeperHere ? `Portero: ${upper(keeper.name)}` : "Ojo: no ha venido el portero") : "Ojo: sin portero en el siete",
      s: keeper ? (keeperHere ? "En su sitio de la pizarra" : "Cámbialo en la pizarra o marca quién se pone") : "Elígelo en la pizarra",
    },
  ];
}

// ---------- descanso: the seven of the 2ª
export interface HalfUi {
  add: readonly string[];
  drop: readonly string[];
  keeper: string | null;
}
export const NO_HALF: HalfUi = { add: [], drop: [], keeper: null };
export interface HalfPlan {
  /** On the pitch now (the base the deltas apply to: another scorer's change moves it, B-MESA-07). */
  base: string[];
  sel: string[];
  /** Who keeps goal in the 2ª (any of the seven, B-MESA-02), null when nobody yet. */
  keeper: string | null;
  /** Who holds the keeper's slot once the changes are made. */
  porHolder: string | null;
  pairs: { outId: string; inId: string }[];
  /** The wave «Arrancar» writes: the changes, then the keeper's swap. */
  items: { type: "substitution" | "position_swap"; playerId: string; inPlayerId: string }[];
  ok: boolean;
}
export function halfPlan(field: readonly MesaPlayer[], bench: readonly MesaPlayer[], ui: HalfUi): HalfPlan {
  const all = [...field, ...bench];
  const base = field.map((p) => p.id);
  const gone = new Set(bench.filter((p) => p.sentOff).map((p) => p.id));
  const sel = [...base.filter((id) => !ui.drop.includes(id)), ...ui.add.filter((id) => !base.includes(id) && !gone.has(id) && all.some((p) => p.id === id))];
  const pairs = subsTo(all, base, sel);
  const keeperNow = field.find((p) => p.keeper)?.id ?? null;
  // the keeper's slot after the changes: the keeper if he stays, else whoever comes on for him
  const porHolder = keeperNow ? (sel.includes(keeperNow) ? keeperNow : pairs.find((x) => x.outId === keeperNow)?.inId ?? null) : null;
  const keeper = ui.keeper && sel.includes(ui.keeper) ? ui.keeper : keeperNow && sel.includes(keeperNow) ? keeperNow : null;
  const items: HalfPlan["items"] = pairs.map((x) => ({ type: "substitution" as const, playerId: x.outId, inPlayerId: x.inId }));
  if (keeper && porHolder && keeper !== porHolder) items.push({ type: "position_swap", playerId: porHolder, inPlayerId: keeper });
  const ins = sel.filter((id) => !base.includes(id));
  return { base, sel, keeper, porHolder, pairs, items, ok: sel.length === 7 && !!keeper && pairs.length === ins.length };
}
/** The keeper plus the six outfield players with the fewest minutes (nobody sent off): «Igualar minutos». */
export function fairHalf(field: readonly MesaPlayer[], bench: readonly MesaPlayer[], plan: HalfPlan, present: readonly string[] | null | undefined): HalfUi {
  const keeper = plan.keeper ?? field.find((p) => p.keeper)?.id ?? null;
  const pool = [...field, ...bench].filter((p) => !p.sentOff && p.id !== keeper && (!present?.length || present.includes(p.id) || p.played || field.includes(p)));
  const seven = [...(keeper ? [keeper] : []), ...[...pool].sort((a, b) => a.minutes - b.minutes).slice(0, 7 - (keeper ? 1 : 0)).map((p) => p.id)];
  return { add: seven.filter((id) => !plan.base.includes(id)), drop: plan.base.filter((id) => !seven.includes(id)), keeper };
}

/** The board's «2ª parte» as the seven of the 2ª (its players who can play it: not sent off, on la mesa), with its
 *  keeper; null when the board has none or none of it can play. */
export function secondHalfUi(v: Pick<MesaView, "field" | "bench" | "secondHalf">, base: readonly string[]): HalfUi | null {
  const s = v.secondHalf;
  if (!s) return null;
  const able = new Set([...v.field, ...v.bench].filter((p) => !p.sentOff).map((p) => p.id));
  const seven = s.seven.filter((id) => able.has(id));
  if (!seven.length) return null;
  return { add: seven.filter((id) => !base.includes(id)), drop: base.filter((id) => !seven.includes(id)), keeper: s.keeper && seven.includes(s.keeper) ? s.keeper : null };
}

// ---------- the galones (the official board's)
/** Who wears the armband now: the captain on the pitch, else the vice on the pitch. */
export function captainNow(v: Pick<MesaView, "field" | "galones">): string | null {
  const on = new Set(v.field.map((p) => p.id));
  const { captainId, viceId } = v.galones;
  return captainId && on.has(captainId) ? captainId : viceId && on.has(viceId) ? viceId : null;
}
/** Who takes it now: the first of the board's list on the pitch. */
export function takerNow(v: Pick<MesaView, "field" | "galones">, kind: "penalties" | "freekicks" | "corners"): string | null {
  const on = new Set(v.field.map((p) => p.id));
  return v.galones.takers[kind].find((id) => on.has(id)) ?? null;
}
/** «Capitán · 1º penaltis» for the player sheet, "" without galones. */
export function galonesText(v: Pick<MesaView, "field" | "galones">, id: string): string {
  const out: string[] = [];
  if (captainNow(v) === id) out.push(v.galones.captainId === id ? "Capitán" : "Capitán (vice)");
  const KIND = { penalties: "penaltis", freekicks: "faltas", corners: "córners" } as const;
  for (const k of ["penalties", "freekicks", "corners"] as const) if (takerNow(v, k) === id) out.push(`lanza los ${KIND[k]}`);
  return out.join(" · ");
}

// ---------- final
/** Who was on the pitch when a play happened (the scorer's and the pass's chips). */
export const onAt = (v: MesaView, e: MesaEvent): MesaPlayer[] => [...v.field, ...v.bench].filter((p) => onPitchAt(p.stints, Math.max(0, secs(e))));
/** What keeps the acta from going out (the server refuses the same: functions/src/publishLive). */
export function finBlockers(v: MesaView): string[] {
  const out: string[] = [];
  const { pending, review } = v.queue;
  const noScorer = v.events.filter((e) => e.pendingScorer && !e.dupOf).length;
  if (pending) out.push(plural(pending, "jugada sigue en el móvil", "jugadas siguen en el móvil"));
  if (v.match.pendingDuplicates) out.push(plural(v.match.pendingDuplicates, "duda entre anotadores", "dudas entre anotadores"));
  if (review.length) out.push(plural(review.length, "jugada por revisar", "jugadas por revisar"));
  if (noScorer) out.push(plural(noScorer, "gol sin goleador", "goles sin goleador"));
  return out;
}
/** A goal of ours whose pass nobody has answered (optional: «Sin pase» answers it). */
export const passOpen = (e: MesaEvent): boolean => (e.type === "goal" || e.type === "goal_freekick") && !!e.playerId && !e.assistId && !e.assistReviewed && !e.dupOf;
