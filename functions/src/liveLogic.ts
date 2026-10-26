// Pure rules of the "modo banda" (functions/src/live.ts), apart so the app's tests can run them.
import { calculateLedger, type MatchEvent } from "./matchEngine.js";
import { eventSeconds } from "./matchAnalysis.js";
import { isUnknownGuest, type MatchGuest } from "./guests.js";
import { MESA_TYPES } from "./liveRules.js";
/** La mesa's catalogue (liveRules.ts MESA_TYPES) is the callable's. */
export const LIVE_TYPES = MESA_TYPES;
/** Rival plays («opponent_*»): never carry a Piti player. */
export const isRivalType = (type: string): boolean => type.startsWith("opponent_");
/** Ours, with an optional player: a chance or corner by the team, a penalty for or against us (who was fouled, who fouled). */
const OPTIONAL_PLAYER = new Set<string>(["chance", "corner", "penalty_received", "penalty_committed"]);
const NEEDS_PLAYER = new Set<string>(LIVE_TYPES.filter((t) => !isRivalType(t) && !OPTIONAL_PLAYER.has(t)));
/** A plain goal can go without its scorer («Lo completo luego»): the acta asks «¿Quién marcó?» later. */
const SCORER_LATER = new Set<string>(["goal"]);
const MIN = 60_000;

/** Pure checks, exported for the tests: the window, the players and the event's shape. */
export function liveProblem(
  match: { status?: string; date?: number; duration?: number; starters?: string[]; bench?: string[]; guests?: MatchGuest[]; events?: MatchEvent[] },
  event: { type: string; minute: number; playerId?: string; assistPlayerId?: string; inPlayerId?: string },
  now: number,
): string | null {
  if (match.status === "finished" || match.status === "cancelled" || match.status === "postponed")
    return "Este partido no se está jugando: su acta se edita desde el editor.";
  const start = match.date ?? NaN;
  const duration = match.duration ?? 60;
  if (!(LIVE_TYPES as readonly string[]).includes(event.type)) return "Tipo de jugada desconocido.";
  if (!Number.isInteger(event.minute) || event.minute < 0) return "Indica un minuto válido.";
  if (!Number.isFinite(start) || now < start - 30 * MIN || now > start + (duration + 90) * MIN)
    return "El modo banda solo funciona desde media hora antes del partido hasta hora y media después.";
  if (event.minute > duration + 15) return `El minuto ${event.minute} no cabe en un partido de ${duration}.`;
  const called = new Set([...(match.starters ?? []), ...(match.bench ?? [])]);
  if ([event.playerId, event.assistPlayerId, event.inPlayerId].some((id) => isUnknownGuest(match, id))) return "Ese invitado no está en la lista del partido.";
  if (isRivalType(event.type) && (event.playerId || event.assistPlayerId || event.inPlayerId)) return "Una jugada del rival no lleva jugador del Piti.";
  const later = SCORER_LATER.has(event.type) && !event.playerId && !event.assistPlayerId;
  if (NEEDS_PLAYER.has(event.type) && !later && (!event.playerId || !called.has(event.playerId))) return "Elige un jugador convocado.";
  if (event.playerId && !called.has(event.playerId)) return "Elige un jugador convocado.";
  if (event.assistPlayerId && (!called.has(event.assistPlayerId) || event.assistPlayerId === event.playerId)) return "La asistencia tiene que ser de otro convocado.";
  if (event.type === "substitution" && (!event.inPlayerId || !called.has(event.inPlayerId) || event.inPlayerId === event.playerId))
    return "El cambio necesita quién sale y quién entra.";
  if (event.type === "position_swap" && (!event.inPlayerId || !called.has(event.inPlayerId) || event.inPlayerId === event.playerId))
    return "El cambio de sitio necesita los dos jugadores que se cambian.";
  return null;
}

/** Validate the complete sequence in the transaction, including backdated entries and undo. */
export function liveSequenceProblem(match: { duration?: number; starters?: string[]; bench?: string[]; guests?: MatchGuest[] }, events: MatchEvent[]): string | null {
  const duration = Math.max(match.duration ?? 50, ...events.map((e) => Math.ceil(eventSeconds(e) / 60)));
  return calculateLedger({ starters: match.starters ?? [], bench: match.bench ?? [], notCalled: [], guests: match.guests, events, duration }, false, { allowUnattributedGoals: true }).errors[0] ?? null;
}

