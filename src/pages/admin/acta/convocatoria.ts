// The convocatoria's rules (pure, tested in convocatoria.test.ts): each player of the season is titular
// (T), suplente (S), no convocado (N) or still unassigned; at most seven titulares (the old editor's
// «Ya hay siete titulares…» refusal); the counters; «Marcar los restantes como no convocados»; and
// «Copiar la convocatoria de la J7» (the previous match of the season that has one).
import { dateMillis } from "../../../../functions/src/matchEngine";

export type Role = "T" | "S" | "N" | "";
export interface Lineup {
  starters: string[];
  bench: string[];
  notCalled: string[];
}
export const MAX_STARTERS = 7;

export function roleOf(l: Lineup, id: string): Role {
  if (l.starters.includes(id)) return "T";
  if (l.bench.includes(id)) return "S";
  if (l.notCalled.includes(id)) return "N";
  return "";
}

export type AssignResult = { ok: true; lineup: Lineup } | { ok: false; error: string };
/** Puts `id` in `role` (out of the other two). Refuses an eighth titular. */
export function assign(l: Lineup, id: string, role: Role, name = "ese jugador"): AssignResult {
  if (role === "T" && !l.starters.includes(id) && l.starters.length >= MAX_STARTERS)
    return { ok: false, error: `Ya hay siete titulares: pasa uno a suplente antes de subir a ${name}.` };
  return {
    ok: true,
    lineup: {
      starters: l.starters.filter((x) => x !== id).concat(role === "T" ? [id] : []),
      bench: l.bench.filter((x) => x !== id).concat(role === "S" ? [id] : []),
      notCalled: l.notCalled.filter((x) => x !== id).concat(role === "N" ? [id] : []),
    },
  };
}

export interface LineupCounts {
  starters: number;
  bench: number;
  notCalled: number;
  /** Roster players with no role yet. */
  unassigned: number;
}
export function lineupCounts(l: Lineup, roster: readonly string[]): LineupCounts {
  const set = new Set([...l.starters, ...l.bench, ...l.notCalled]);
  return { starters: l.starters.length, bench: l.bench.length, notCalled: l.notCalled.length, unassigned: roster.filter((id) => !set.has(id)).length };
}
/** Publishable: one to seven titulares and nobody left to assign. */
export const lineupReady = (c: LineupCounts) => c.starters >= 1 && c.starters <= MAX_STARTERS && c.unassigned === 0;
/** Why it can't be published yet (empty when it can). */
export function lineupProblem(c: LineupCounts): string {
  if (c.unassigned) return `Faltan ${c.unassigned} ${c.unassigned === 1 ? "jugador" : "jugadores"} por asignar: titular, suplente o no convocado.`;
  if (!c.starters) return "Elige entre uno y siete titulares.";
  if (c.starters > MAX_STARTERS) return "Hay más de siete titulares.";
  return "";
}

/** Everyone still unassigned → no convocado. */
export function restNotCalled(l: Lineup, roster: readonly string[]): Lineup {
  const set = new Set([...l.starters, ...l.bench, ...l.notCalled]);
  return { ...l, notCalled: [...l.notCalled, ...roster.filter((id) => !set.has(id))] };
}

/** Another match's convocatoria, for this season's players only (newcomers stay unassigned). */
export function copyLineup(from: Lineup, roster: readonly string[]): Lineup {
  const inSquad = (id: string) => roster.includes(id);
  return { starters: from.starters.filter(inSquad).slice(0, MAX_STARTERS), bench: from.bench.filter(inSquad), notCalled: from.notCalled.filter(inSquad) };
}

/** The latest earlier match of the same season with a convocatoria (for «Copiar la convocatoria de la Jn»). */
export function previousLineup<M extends { id: string; seasonId?: string; date?: unknown; starters?: string[] }>(matches: readonly M[], current: { id: string; seasonId?: string; date?: unknown }): M | undefined {
  const t = dateMillis(current.date);
  return matches
    .filter((m) => m.id !== current.id && m.seasonId && m.seasonId === current.seasonId && (m.starters?.length ?? 0) > 0 && (!Number.isFinite(t) || dateMillis(m.date) < t))
    .sort((a, b) => dateMillis(b.date) - dateMillis(a.date))[0];
}

/** Players of the lineup in picker order: titulares first, then suplentes (each in the roster's order). */
export function calledUp(l: Lineup, rosterOrder: readonly string[]): { id: string; role: "T" | "S" }[] {
  const pos = (id: string) => {
    const i = rosterOrder.indexOf(id);
    return i < 0 ? 999 : i;
  };
  const by = (a: string, b: string) => pos(a) - pos(b);
  return [...l.starters.slice().sort(by).map((id) => ({ id, role: "T" as const })), ...l.bench.slice().sort(by).map((id) => ({ id, role: "S" as const }))];
}
