// Small pure pieces of the acta's UI: the picker's player options and the kinds «+ Añadir» offers.
import type { EventType } from "../../../../functions/src/matchEngine";
import { positionCode } from "../acta/roster";

export interface PickOption {
  id: string;
  num: string;
  name: string;
  /** «suplente», «POR»… */
  tag: string;
}
/** Player options from the called-up players (titulares first, suplentes marked). */
export function pickOptions(called: { id: string; role: "T" | "S" }[], info: (id: string) => { name: string; number: number | null; position: string }): PickOption[] {
  return called.map(({ id, role }) => {
    const p = info(id);
    return { id, num: p.number != null ? String(p.number) : "—", name: p.name, tag: role === "S" ? "suplente" : positionCode(p.position) };
  });
}

/** The kinds «+ Añadir» offers (our goals and the rival's come from the score). */
export const OTHER_TYPES: readonly EventType[] = [
  "yellow_card",
  "double_yellow",
  "red_card",
  "substitution",
  "goal_penalty",
  "goal_freekick",
  "own_goal",
  "penalty_committed",
  "penalty_received",
  "penalty_saved",
  "penalty_missed",
  "woodwork",
];
