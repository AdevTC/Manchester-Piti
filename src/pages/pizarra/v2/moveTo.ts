// La pizarra — «Mover a…»: moving a cromo of the seven without dragging it (WCAG 2.5.7). From the fan, a
// list of the seven's puestos: each one says who is there (the move swaps them), how well he knows that
// position (familiarity.ts) and, for a player with an exact position, how well he fits it («Interior
// izquierdo · adaptado»). Pure.
import type { Lineup } from "../formations";
import { POSITIONS } from "../../../lib/positions";
import { fitWord, hasFitData, logicGrade, slotCode } from "./encaje";
import type { Squad } from "./model";
import { famSlot, type FamMark, type FamTable } from "./familiarity";

export interface MoveOption {
  i: number;
  /** «DC», «MC»… (the slot's exact code, also in free mode). */
  lab: string;
  /** «Interior izquierdo · adaptado»: the puesto by name and how well he fits it (only for a player
   *  with an exact position). */
  pos?: string;
  /** «Con ERIK: se cambian» / «Hueco libre» / «Aquí está». */
  sub: string;
  here: boolean;
  fam: FamMark | null;
  aria: string;
}

export function moveOptions(L: Lineup, sq: Squad, id: string, fam: FamTable): MoveOption[] {
  const name = (pid: string) => sq.byId.get(pid)?.name ?? "Jugador";
  const exact = hasFitData([id], sq, L);
  return L.slots.map((s, i) => {
    const code = slotCode(L, i);
    const w = exact ? fitWord(logicGrade(L, sq, id, i)) : "";
    const nm = POSITIONS[code].name;
    // (the code with its name for a player with an exact position: «MI · interior izquierdo, adaptado»)
    const said = exact ? code + " · " + nm.toLowerCase() + (w ? ", " + w : "") : code;
    const here = s.playerId === id;
    const { mark: f, txt: ft } = here ? { mark: null, txt: "" } : famSlot(fam, L, sq, id, i);
    const sub = here ? "Aquí está" : s.playerId ? "Con " + name(s.playerId) + ": se cambian" : "Hueco libre";
    const aria = here
      ? (exact ? code + " · " + nm.toLowerCase() : code) + ": " + name(id) + " ya está aquí"
      : (s.playerId ? "Cambiar a " + name(id) + " con " + name(s.playerId) + ", " + said : "Mover a " + name(id) + " al hueco " + said) + (ft ? "; " + ft : "");
    return { i, lab: code, ...(exact ? { pos: nm + (w ? " · " + w : "") } : {}), sub, here, fam: f, aria };
  });
}
