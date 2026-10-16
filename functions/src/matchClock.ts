/** Authoritative timestamps come from the server. The scheduled date never starts this clock. */
export interface MatchClock {
  revision: number;
  phase: "ready" | "first" | "halftime" | "second" | "ended";
  firstStartedAt?: number;
  firstEndedAt?: number;
  secondStartedAt?: number;
  endedAt?: number;
  /** Archiving pauses time without rewriting the actual kickoff/period timestamps. */
  pausedAt?: number;
  pauses?: { from: number; to: number }[];
}
export const CLOCK_ACTIONS = ["start", "reset", "halftime", "second", "resume_first", "undo_second", "finish", "reopen"] as const;
export type ClockAction = typeof CLOCK_ACTIONS[number];
export const readyClock = (): MatchClock => ({ revision: 0, phase: "ready" });
function seconds(from: number | undefined, to: number | undefined, pauses: NonNullable<MatchClock["pauses"]>) {
  if (from == null || to == null) return 0;
  const paused = pauses.reduce((total, p) => total + Math.max(0, Math.min(to, p.to) - Math.max(from, p.from)), 0);
  return Math.max(0, Math.floor((to - from - paused) / 1000));
}
export function archiveClock(clock: MatchClock | undefined, now: number): MatchClock | undefined {
  if (!clock || clock.pausedAt != null || !["first", "halftime", "second"].includes(clock.phase)) return clock;
  return { ...clock, pausedAt: now, revision: (Number.isFinite(clock.revision) ? clock.revision : 0) + 1 };
}
export function restoreArchivedClock(clock: MatchClock | undefined, now: number): MatchClock | undefined {
  if (!clock || clock.pausedAt == null) return clock;
  const { pausedAt, ...restored } = clock;
  return { ...restored, pauses: [...(clock.pauses ?? []), { from: pausedAt, to: Math.max(pausedAt, now) }], revision: (Number.isFinite(clock.revision) ? clock.revision : 0) + 1 };
}
export function clockReading(clock: MatchClock | undefined, now: number) {
  const c = clock ?? readyClock();
  const at = c.pausedAt ?? now;
  const pauses = c.pauses ?? [];
  const first = seconds(c.firstStartedAt, c.firstEndedAt ?? c.endedAt ?? at, pauses);
  const second = seconds(c.secondStartedAt, c.endedAt ?? at, pauses);
  const breakSeconds = seconds(c.firstEndedAt, c.secondStartedAt ?? (c.phase === "halftime" ? at : c.firstEndedAt), pauses);
  return { phase: c.phase, playing: c.pausedAt == null && (c.phase === "first" || c.phase === "second"), elapsedSeconds: first + second, firstSeconds: first, secondSeconds: second, breakSeconds, period: c.secondStartedAt == null ? 1 as const : 2 as const };
}
export function clockLabel(c?: MatchClock) { return ({ ready: "Pendiente de inicio", first: "1ª parte", halftime: "Descanso", second: "2ª parte", ended: "Final" })[c?.phase ?? "ready"]; }
export function timeText(value: number) { const n = Math.max(0, Math.floor(value)); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`; }
/** Compare revision in the transaction before calling this function. No destructive reset of events. */
export function transitionClock(clock: MatchClock | undefined, action: ClockAction, now: number, events: readonly { elapsedSeconds?: number; minute?: number; period?: number }[] = []): MatchClock {
  const c = clock ?? readyClock();
  if (c.pausedAt != null) throw new Error("Reactiva el partido antes de modificar su reloj.");
  const next = { ...c, revision: c.revision + 1 };
  const fail = () => { throw new Error("El reloj ha cambiado o esa acción no corresponde a esta parte. Revisa el estado actualizado."); };
  if (action === "start" && c.phase === "ready") return { revision: next.revision, phase: "first", firstStartedAt: now };
  if (action === "reset" && c.phase === "first") {
    if (events.length) throw new Error("Hay jugadas registradas. Deshaz las jugadas del inicio accidental antes de reiniciar; no se borran automáticamente.");
    return { revision: next.revision, phase: "ready" };
  }
  if (action === "halftime" && c.phase === "first") return { ...next, phase: "halftime", firstEndedAt: now };
  if (action === "second" && c.phase === "halftime") return { ...next, phase: "second", secondStartedAt: now };
  if (action === "resume_first" && c.phase === "halftime") { delete next.firstEndedAt; return { ...next, phase: "first" }; }
  if (action === "undo_second" && c.phase === "second") {
    if (events.some(e => e.period === 2 || (e.elapsedSeconds ?? (e.minute ?? 0) * 60) > clockReading({ ...c, secondStartedAt: undefined }, c.firstEndedAt!).elapsedSeconds)) throw new Error("Ya hay jugadas de la segunda parte. Revísalas antes de cancelar su inicio.");
    delete next.secondStartedAt; return { ...next, phase: "halftime" };
  }
  if (action === "finish" && (c.phase === "first" || c.phase === "second")) return { ...next, phase: "ended", endedAt: now };
  if (action === "reopen" && c.phase === "ended") { delete next.endedAt; return { ...next, phase: c.secondStartedAt == null ? "first" : "second" }; }
  return fail();
}
