import type { WorkspacePerson } from "../../../lib/analysisWorkspace";
import { SHOT_OUTCOME_ONE, type ShotCounts, type ShotOutcome, type ShotRow } from "../../../lib/shotOutcomes";
import { chartClock } from "./format";

/** What the chart has chosen: a catalogue metric (the side list), one shot, a drawn category or a shooter. */
export type ShotPick = { kind: "metric"; id: string } | { kind: "shot"; id: string } | { kind: "cat"; cat: ShotOutcome } | { kind: "funnel"; cat: ShotOutcome } | { kind: "who"; key: string };

/** «1.ª · 23′ 10″» for a shot, as the plays list writes it. */
export function shotTime(row: ShotRow): string {
  const { period, time } = row.event;
  return `${period ? `${period}.ª · ` : ""}${time ? `${time.precision === "approximate" ? "≈" : ""}${chartClock(time.from)}${time.to !== time.from ? `–${chartClock(time.to)}` : ""}` : "Sin minuto"}`;
}
export function shooterName(row: ShotRow, people: readonly WorkspacePerson[], rival: string): string {
  if (row.event.team === "opponent") return rival;
  return row.shooter ? people.find(person => person.id === row.shooter)?.name ?? "Jugador sin ficha" : "El Piti";
}
export const shotLabel = (row: ShotRow, people: readonly WorkspacePerson[], rival: string) => `${SHOT_OUTCOME_ONE[row.outcome]} · ${shooterName(row, people, rival)} · ${shotTime(row)}${row.outside ? " · desde fuera del área" : ""}`;

export function whoSummary(c: ShotCounts, onTarget: number): string {
  return [c.gol ? `${c.gol} ${c.gol === 1 ? "gol" : "goles"}` : "", `${onTarget} a puerta`, c.bloqueado ? `${c.bloqueado} ${c.bloqueado === 1 ? "bloqueado" : "bloqueados"}` : "", c.fuera ? `${c.fuera} fuera` : ""].filter(Boolean).join(" · ");
}
