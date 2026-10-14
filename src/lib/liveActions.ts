// One catalogue of the live actions, read by the match page's «Mesa de partido» (Banda, quick taps) and the
// admin's «En juego» wizard (pads → picker). Each entry says what liveEvent writes (`type`, one of the
// callable's LIVE_TYPES), how both UIs name it, its icon, and what it asks for: a player (required,
// optional, or «lo completo luego»), from where (on the pitch, or the whole convocatoria for cards), and a
// second player (the assist, or who comes in). `buildLiveEvent` turns the choices into the event, the same
// shape both UIs sent before they shared it: absent fields are left out, never sent as `undefined`.
import type { LIVE_TYPES } from "../../functions/src/liveLogic";
import type { IconName } from "../components/celeste/icons";

/** What liveEvent({ action: "add" }) takes as `event`. */
export interface LiveEventInput {
  type: string;
  minute: number;
  playerId?: string;
  assistPlayerId?: string;
  inPlayerId?: string;
}

/** The event types the liveEvent callable accepts (functions/src/liveLogic.ts). */
export type LiveEventType = (typeof LIVE_TYPES)[number];

export interface LiveAction {
  type: LiveEventType;
  /** The Mesa de partido's button: «Gol del Piti», «Ocasión rival». */
  label: string;
  /** The bare name the wizard and its captions use: «Gol», «Roja directa», «Ocasión». */
  name: string;
  icon: IconName | null;
  /** Whose action it is on the board (an autogol of the rival counts for the Piti). */
  side: "us" | "them";
  /** `later`: it can go without a player, and the acta asks «¿Quién marcó?» afterwards. */
  player: "required" | "optional" | "later" | "none";
  /** Where the player comes from: on the pitch, or the whole convocatoria (cards reach the bench). */
  pool: "field" | "squad";
  /** The second player: the assist (optional) or who comes in (required). */
  second: "assist" | "in" | null;
  /** Can be written during the break (cards and changes; the callable refuses the rest). */
  atBreak: boolean;
  /** The Mesa de partido's question over the player chips. */
  ask: string;
}

const a = (type: LiveEventType, label: string, name: string, icon: IconName | null, rest: Partial<Pick<LiveAction, "side" | "player" | "pool" | "second" | "atBreak" | "ask">> = {}): LiveAction => ({
  type,
  label,
  name,
  icon,
  side: rest.side ?? "us",
  player: rest.player ?? "required",
  pool: rest.pool ?? "field",
  second: rest.second ?? null,
  atBreak: rest.atBreak ?? false,
  ask: rest.ask ?? "¿Quién?",
});

/** In the Mesa de partido's order. */
export const LIVE_ACTIONS: readonly LiveAction[] = [
  a("goal", "Gol del Piti", "Gol", "ball", { player: "later", second: "assist", ask: "¿Quién marcó?" }),
  a("opponent_goal", "Gol rival", "Gol rival", "ball", { side: "them", player: "none" }),
  a("opponent_own_goal", "Autogol del rival", "Autogol", "ball", { player: "none" }),
  a("yellow_card", "Amarilla", "Amarilla", null, { pool: "squad", atBreak: true }),
  a("double_yellow", "Segunda amarilla", "Segunda amarilla", null, { pool: "squad", atBreak: true }),
  a("red_card", "Roja", "Roja directa", null, { pool: "squad", atBreak: true }),
  a("substitution", "Cambio", "Cambio", "swap", { second: "in", atBreak: true, ask: "Sale" }),
  a("penalty_saved", "Penalti parado", "Penalti parado", "shield", { ask: "¿Quién lo paró?" }),
  a("woodwork", "Al palo", "Al palo", "boot"),
  a("penalty_missed", "Penalti fallado", "Penalti fallado", "x"),
  a("chance", "Ocasión del Piti", "Ocasión", "flame", { player: "optional" }),
  a("opponent_chance", "Ocasión rival", "Ocasión", "flame", { side: "them", player: "none" }),
  a("corner", "Córner del Piti", "Córner", "flag", { player: "optional" }),
  a("opponent_corner", "Córner rival", "Córner", "flag", { side: "them", player: "none" }),
];

const BY_TYPE = new Map(LIVE_ACTIONS.map((x) => [x.type, x]));
/** The catalogue entry of a type (every type the UIs write is in it). */
export function liveAction(type: LiveEventType): LiveAction {
  const found = BY_TYPE.get(type);
  if (!found) throw new Error(`Jugada fuera del catálogo: ${type}`);
  return found;
}

/** The choices made in either UI; null / undefined / "" = not chosen. */
export interface LiveChoices {
  playerId?: string | null;
  assistPlayerId?: string | null;
  inPlayerId?: string | null;
}

/** The event for liveEvent: type and minute, then only the players the action takes and that were chosen
 *  (an assist only with its scorer). Key order as the UIs always sent it: playerId, assistPlayerId, inPlayerId. */
export function buildLiveEvent(action: LiveAction | LiveEventType, choices: LiveChoices, minute: number): LiveEventInput {
  const act = typeof action === "string" ? liveAction(action) : action;
  const event: LiveEventInput = { type: act.type, minute };
  const player = act.player !== "none" && choices.playerId ? choices.playerId : null;
  if (player) event.playerId = player;
  if (act.second === "assist" && player && choices.assistPlayerId) event.assistPlayerId = choices.assistPlayerId;
  if (act.second === "in" && choices.inPlayerId) event.inPlayerId = choices.inPlayerId;
  return event;
}

/** Whether the choices are enough to write the action (Banda's «Apuntar»). `later` = «Lo completo luego». */
export function liveReady(act: LiveAction, choices: LiveChoices & { later?: boolean }): boolean {
  const hasPlayer = !!choices.playerId;
  if (act.player === "required" && !hasPlayer) return false;
  if (act.player === "later" && !hasPlayer && !choices.later) return false;
  if (act.second === "in" && !choices.inPlayerId) return false;
  return true;
}
