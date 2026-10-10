// Small pure pieces of the acta's pickers: the dorsal options (on the pitch first, then the banquillo) and
// «Lo demás» — its four groups (Tarjetas · Cambios · Penaltis · Otros), the kinds each «+» offers and the
// checks of a new or edited event.
import type { EventType, MatchEvent } from "../../../../functions/src/matchEngine";

export interface PickOption {
  id: string;
  num: string;
  name: string;
}
/** Dorsal buttons for a list of player ids. */
export function pickOptions(ids: readonly string[], info: (id: string) => { name: string; number: number | null }): PickOption[] {
  return ids.map((id) => {
    const p = info(id);
    return { id, num: p.number != null ? String(p.number) : "—", name: p.name };
  });
}

export type EventGroup = "tar" | "cam" | "pen" | "otro";
export const GROUPS: readonly { key: EventGroup; title: string; empty: string }[] = [
  { key: "tar", title: "Tarjetas", empty: "Sin tarjetas" },
  { key: "cam", title: "Cambios", empty: "Sin cambios" },
  { key: "pen", title: "Penaltis", empty: "Sin penaltis" },
  { key: "otro", title: "Otros", empty: "Palos, paradas…" },
];
export interface EventKind {
  type: EventType;
  label: string;
}
/** The kinds each group's «+» adds (penalty / free-kick goals and own goals land in the goal lists). */
export const KINDS: Record<EventGroup, readonly EventKind[]> = {
  tar: [
    { type: "yellow_card", label: "Amarilla" },
    { type: "double_yellow", label: "Segunda amarilla" },
    { type: "red_card", label: "Roja directa" },
  ],
  cam: [{ type: "substitution", label: "Cambio" }],
  pen: [
    { type: "penalty_saved", label: "Penalti parado" },
    { type: "penalty_missed", label: "Penalti fallado" },
    { type: "penalty_received", label: "Penalti recibido" },
    { type: "penalty_committed", label: "Penalti cometido" },
    { type: "goal_penalty", label: "Gol de penalti" },
  ],
  otro: [
    { type: "woodwork", label: "Tiro al palo" },
    { type: "goal_freekick", label: "Gol de falta" },
    { type: "own_goal", label: "Gol en propia" },
  ],
};
const CARDS = new Set<string>(["yellow_card", "double_yellow", "red_card"]);
/** The group an event (not a goal) is listed in. */
export function groupOfEvent(e: Pick<MatchEvent, "type">): EventGroup {
  if (CARDS.has(e.type)) return "tar";
  if (e.type === "substitution") return "cam";
  if (e.type.startsWith("penalty_")) return "pen";
  return "otro";
}
export const kindLabel = (type: string) => Object.values(KINDS).flat().find((k) => k.type === type)?.label ?? "Jugada";
/** The label over the player grid for a kind. */
export function playerQuestion(type: string): string {
  if (type === "substitution") return "Sale del campo";
  if (type === "goal_penalty" || type === "goal_freekick") return "¿Quién marcó?";
  if (type === "own_goal") return "¿Quién la metió en propia?";
  if (type === "penalty_saved") return "¿Quién lo paró?";
  return "¿Quién?";
}

/** Checks a new / edited event: a minute inside the match, a player, someone different coming on. */
export function checkEvent(o: { type: string; minute: string; player: string; inPlayer: string; duration: number }): string {
  const m = Number(o.minute);
  const top = Number.isFinite(o.duration) ? o.duration : 150;
  if (o.minute.trim() === "" || !Number.isInteger(m) || m < 0 || m > top) return `Pon el minuto (de 0 a ${top}).`;
  if (!o.player) return o.type === "substitution" ? "Elige quién sale del campo." : "Elige el jugador por su dorsal.";
  if (o.type === "substitution" && (!o.inPlayer || o.inPlayer === o.player)) return "Elige quién entra (otro jugador).";
  return "";
}
