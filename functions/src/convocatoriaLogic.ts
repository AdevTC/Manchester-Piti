// Pure rules of the one convocatoria (functions/src/convocatoria.ts: setConvocatoria), apart so the app's
// tests can run them: what a valid siete + banquillo is, who is left «no convocado», whether the lineup
// changed, and which notice (if any) «Convocar y avisar» sends.

export interface Lineup {
  starters: readonly string[];
  bench: readonly string[];
}
export interface ConvocatoriaContext {
  /** The ids of the players of the match's season. */
  roster: readonly string[];
  /** The match's status (draft fields win over the published ones). */
  status?: string;
}
export const MAX_STARTERS = 7;

/** Why this lineup can't be saved for that match (null = it can). */
export function convocatoriaProblem(lineup: Lineup, ctx: ConvocatoriaContext): string | null {
  if (ctx.status === "finished") return "Ese partido ya se jugó: su convocatoria queda cerrada (los cambios del acta ajustan los minutos).";
  if (ctx.status === "cancelled") return "Ese partido está cancelado.";
  if (lineup.starters.length > MAX_STARTERS) return "Como mucho siete titulares.";
  const all = [...lineup.starters, ...lineup.bench];
  if (new Set(all).size !== all.length) return "Cada jugador va una sola vez: en el siete o en el banquillo.";
  const roster = new Set(ctx.roster);
  if (all.some((id) => !roster.has(id))) return "Hay jugadores que no son de la temporada de este partido.";
  return null;
}

/** The season's players outside the siete and the banquillo, in roster order. */
export function notCalledOf(roster: readonly string[], lineup: Lineup): string[] {
  const called = new Set([...lineup.starters, ...lineup.bench]);
  return roster.filter((id) => !called.has(id));
}

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && new Set([...a, ...b]).size === a.length;
/** Same players in the siete and in the banquillo (order aside). */
export function sameLineup(a: Lineup, b: Lineup): boolean {
  return sameSet(a.starters, b.starters) && sameSet(a.bench, b.bench);
}

export type ConvocatoriaNoticeKind = "first" | "changes";
/**
 * Which notice «Convocar y avisar» sends: «Ya está la convocatoria» the first time, «Cambios en la
 * convocatoria» when an already-notified one changed (sent once: pushLog keeps it), nothing otherwise —
 * nor for a match that has already started.
 */
export function convocatoriaNoticeKind(o: { notify: boolean; upcoming: boolean; notifiedBefore: boolean; changed: boolean }): ConvocatoriaNoticeKind | null {
  if (!o.notify || !o.upcoming) return null;
  if (!o.notifiedBefore) return "first";
  return o.changed ? "changes" : null;
}
