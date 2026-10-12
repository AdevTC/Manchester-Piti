// La pizarra — «Mover a…»: moving a cromo of the seven without dragging it (WCAG 2.5.7). From the fan, a
// list of the seven's puestos: each one says who is there (the move swaps them) and how well he knows that
// zone (familiarity.ts). Pure.
import type { Lineup } from "../formations";
import { slotLabel, slotZone } from "./geometry";
import { natOf, type Squad } from "./model";
import { famOf, famTxt, type FamMark, type FamTable } from "./familiarity";

export interface MoveOption {
  i: number;
  /** «DC», «MC»… (the zone in free mode). */
  lab: string;
  /** «Con ERIK: se cambian» / «Hueco libre» / «Aquí está». */
  sub: string;
  here: boolean;
  fam: FamMark | null;
  aria: string;
}

export function moveOptions(L: Lineup, sq: Squad, id: string, fam: FamTable): MoveOption[] {
  const name = (pid: string) => sq.byId.get(pid)?.name ?? "Jugador";
  const nat = natOf(L, sq, id);
  return L.slots.map((s, i) => {
    const lab = slotLabel(L, i);
    const z = slotZone(L, i);
    const here = s.playerId === id;
    const f = here ? null : famOf(fam, id, z, nat);
    const ft = here ? "" : famTxt(fam, id, z, nat);
    const sub = here ? "Aquí está" : s.playerId ? "Con " + name(s.playerId) + ": se cambian" : "Hueco libre";
    const aria = here
      ? lab + ": " + name(id) + " ya está aquí"
      : (s.playerId ? "Cambiar a " + name(id) + " con " + name(s.playerId) + ", " + lab : "Mover a " + name(id) + " al hueco " + lab) + (ft ? "; " + ft : "");
    return { i, lab, sub, here, fam: f, aria };
  });
}
