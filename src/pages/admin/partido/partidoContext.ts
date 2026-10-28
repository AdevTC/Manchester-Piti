// What the match's layout hands to its stations: the match (the merged one: the draft's fields win), its phase,
// the station on screen and the one of its moment, the carril and its acta review. Read it with usePartido() in
// any station screen (/admin/partidos/<id>/<station>).
import { createContext, useContext } from "react";
import type { Station } from "../../../lib/adminUrls";
import type { ActaReview, AdminMatch } from "../data/adminLogic";
import type { CarrilPhase, StationView } from "./carril";

export interface Partido {
  match: AdminMatch;
  phase: CarrilPhase;
  /** The station on screen (the address', else the one of its moment). */
  station: Station;
  /** The station of its moment (where its address without a station opens). */
  auto: Station;
  stations: StationView[];
  review: ActaReview;
  /** «J3», or the rival for a draft without jornada. */
  j: string;
  /** Its base address: /admin/partidos/<id>. */
  base: string;
}
export const PartidoContext = createContext<Partido | null>(null);

/** The match of the station on screen (inside /admin/partidos/<id>). */
export function usePartido(): Partido {
  const p = useContext(PartidoContext);
  if (!p) throw new Error("usePartido() reads the match the match's layout (partido/PartidoLayout) provides.");
  return p;
}
