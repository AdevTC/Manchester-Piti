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
  /** La mesa's pause inside a half (not the archive's `pausedAt`): closed into `pauses` on resume. */
  heldAt?: number;
  /** Stoppage time per half, a label only: it never moves the clock. */
  added?: { 1?: number; 2?: number };
}
export const CLOCK_ACTIONS = ["start", "reset", "halftime", "second", "resume_first", "undo_second", "finish", "reopen", "pause", "resume", "added"] as const;
export type ClockAction = typeof CLOCK_ACTIONS[number];
export const readyClock = (): MatchClock => ({ revision: 0, phase: "ready" });
function seconds(from: number | undefined, to: number | undefined, pauses: NonNullable<MatchClock["pauses"]>) {
  if (from == null || to == null) return 0;
  // An archive pause and a mesa hold can overlap: the stopped time counts once.
  let paused = 0, reached = from;
  for (const p of [...pauses].sort((a, b) => a.from - b.from)) {
    const start = Math.max(reached, p.from), end = Math.min(to, p.to);
    if (end > start) paused += end - start;
    reached = Math.max(reached, Math.min(to, p.to));
  }
  return Math.max(0, Math.floor((to - from - paused) / 1000));
}
/** La mesa's hold closed at `now` into `pauses` (resume, or another whistle while held). */
function closeHold(c: MatchClock, now: number): MatchClock {
  if (c.heldAt == null) return c;
  const { heldAt, ...rest } = c;
  return { ...rest, pauses: [...(c.pauses ?? []), { from: heldAt, to: Math.max(heldAt, now) }] };
}
/** `pauses` plus the stretch from a whistle (`from`) to `now`, when there was one. */
function stoppedSince(from: number | undefined, pauses: MatchClock["pauses"], now: number): NonNullable<MatchClock["pauses"]> {
  const kept = pauses ?? [];
  return from == null ? kept : [...kept, { from, to: Math.max(from, now) }];
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
  // The time stops at the archive's pause or la mesa's hold, whichever came first.
  const at = Math.min(c.pausedAt ?? now, c.heldAt ?? now, now);
  const pauses = c.pauses ?? [];
  const first = seconds(c.firstStartedAt, c.firstEndedAt ?? c.endedAt ?? at, pauses);
  const second = seconds(c.secondStartedAt, c.endedAt ?? at, pauses);
  const breakSeconds = seconds(c.firstEndedAt, c.secondStartedAt ?? (c.phase === "halftime" ? at : c.firstEndedAt), pauses);
  return { phase: c.phase, playing: c.pausedAt == null && c.heldAt == null && (c.phase === "first" || c.phase === "second"), held: c.heldAt != null, elapsedSeconds: first + second, firstSeconds: first, secondSeconds: second, breakSeconds, period: c.secondStartedAt == null ? 1 as const : 2 as const };
}
export function clockLabel(c?: MatchClock) { return ({ ready: "Pendiente de inicio", first: "1ª parte", halftime: "Descanso", second: "2ª parte", ended: "Final" })[c?.phase ?? "ready"]; }
export function timeText(value: number) { const n = Math.max(0, Math.floor(value)); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`; }
/** Compare revision in the transaction before calling this function. No destructive reset of events. */
export function transitionClock(clock: MatchClock | undefined, action: ClockAction, now: number, events: readonly { elapsedSeconds?: number; minute?: number; period?: number }[] = [], value?: number): MatchClock {
  const stored = clock ?? readyClock();
  if (stored.pausedAt != null) throw new Error("Reactiva el partido antes de modificar su reloj.");
  const fail = () => { throw new Error("El reloj ha cambiado o esa acción no corresponde a esta parte. Revisa el estado actualizado."); };
  const inHalf = stored.phase === "first" || stored.phase === "second";
  // La mesa's hold inside a half: the time stops (clockReading), plays are taken as at the break.
  if (action === "pause") {
    if (!inHalf) throw new Error("Solo se pausa con una parte en juego.");
    if (stored.heldAt != null) throw new Error("El partido ya está en pausa.");
    return { ...stored, revision: stored.revision + 1, heldAt: now };
  }
  if (action === "resume") {
    if (stored.heldAt == null) throw new Error("El partido no está en pausa.");
    return { ...closeHold(stored, now), revision: stored.revision + 1 };
  }
  // The stoppage time is a label: it never moves the clock, so it keeps the clock's revision (a play
  // written meanwhile against this revision still goes in).
  if (action === "added") {
    if (!(stored.phase === "first" || stored.phase === "halftime" || stored.phase === "second")) throw new Error("El añadido se ajusta durante el partido.");
    if (value == null || !Number.isInteger(value) || value < 0 || value > 15) throw new Error("El añadido va de 0 a 15 minutos.");
    const period = stored.secondStartedAt == null ? 1 : 2;
    return { ...stored, added: { ...stored.added, [period]: value } };
  }
  // Any other whistle while held first closes the hold (the time stopped at the pause).
  const c = closeHold(stored, now);
  const next = { ...c, revision: c.revision + 1 };
  if (action === "start" && c.phase === "ready") return { revision: next.revision, phase: "first", firstStartedAt: now };
  if (action === "reset" && c.phase === "first") {
    if (events.length) throw new Error("Hay jugadas registradas. Deshaz las jugadas del inicio accidental antes de reiniciar; no se borran automáticamente.");
    return { revision: next.revision, phase: "ready" };
  }
  if (action === "halftime" && c.phase === "first") return { ...next, phase: "halftime", firstEndedAt: now };
  if (action === "second" && c.phase === "halftime") return { ...next, phase: "second", secondStartedAt: now };
  // Going back to a half (B-MESA-01): the time stopped since its whistle (the break, the minutes in Final) is
  // closed into `pauses`, so the clock and everyone's minutes carry on from where they were.
  if (action === "resume_first" && c.phase === "halftime") { delete next.firstEndedAt; return { ...next, phase: "first", pauses: stoppedSince(c.firstEndedAt, c.pauses, now) }; }
  if (action === "undo_second" && c.phase === "second") {
    if (events.some(e => e.period === 2 || (e.elapsedSeconds ?? (e.minute ?? 0) * 60) > clockReading({ ...c, secondStartedAt: undefined }, c.firstEndedAt!).elapsedSeconds)) throw new Error("Ya hay jugadas de la segunda parte. Revísalas antes de cancelar su inicio.");
    delete next.secondStartedAt; return { ...next, phase: "halftime" };
  }
  if (action === "finish" && (c.phase === "first" || c.phase === "second")) return { ...next, phase: "ended", endedAt: now };
  if (action === "reopen" && c.phase === "ended") { delete next.endedAt; return { ...next, phase: c.secondStartedAt == null ? "first" : "second", pauses: stoppedSince(c.endedAt, c.pauses, now) }; }
  return fail();
}
