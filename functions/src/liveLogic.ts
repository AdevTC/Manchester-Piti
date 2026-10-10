// Pure rules of the "modo banda" (functions/src/live.ts), apart so the app's tests can run them.
export const LIVE_TYPES = [
  "goal", "goal_penalty", "goal_freekick", "opponent_goal", "opponent_own_goal", "own_goal",
  "yellow_card", "double_yellow", "red_card", "penalty_saved", "penalty_missed", "woodwork", "substitution",
] as const;
const NEEDS_PLAYER = new Set<string>(LIVE_TYPES.filter((t) => !["opponent_goal", "opponent_own_goal"].includes(t)));
/** A plain goal can go without its scorer («Lo completo luego»): the acta asks «¿Quién marcó?» later. */
const SCORER_LATER = new Set<string>(["goal"]);
const MIN = 60_000;

/** Pure checks, exported for the tests: the window, the players and the event's shape. */
export function liveProblem(
  match: { status?: string; date?: number; duration?: number; starters?: string[]; bench?: string[] },
  event: { type: string; minute: number; playerId?: string; assistPlayerId?: string; inPlayerId?: string },
  now: number,
): string | null {
  if (match.status === "finished" || match.status === "cancelled" || match.status === "postponed")
    return "Este partido no se está jugando: su acta se edita desde el editor.";
  const start = match.date ?? NaN;
  const duration = match.duration ?? 60;
  if (!Number.isFinite(start) || now < start - 30 * MIN || now > start + (duration + 90) * MIN)
    return "El modo banda solo funciona desde media hora antes del partido hasta hora y media después.";
  if (event.minute > duration + 15) return `El minuto ${event.minute} no cabe en un partido de ${duration}.`;
  const called = new Set([...(match.starters ?? []), ...(match.bench ?? [])]);
  const later = SCORER_LATER.has(event.type) && !event.playerId && !event.assistPlayerId;
  if (NEEDS_PLAYER.has(event.type) && !later && (!event.playerId || !called.has(event.playerId))) return "Elige un jugador convocado.";
  if (event.assistPlayerId && (!called.has(event.assistPlayerId) || event.assistPlayerId === event.playerId)) return "La asistencia tiene que ser de otro convocado.";
  if (event.type === "substitution" && (!event.inPlayerId || !called.has(event.inPlayerId) || event.inPlayerId === event.playerId))
    return "El cambio necesita quién sale y quién entra.";
  return null;
}

