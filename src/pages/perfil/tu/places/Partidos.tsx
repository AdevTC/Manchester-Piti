// Tus partidos (C's river + A's match sheet) — PLACEHOLDER until the Partidos place agent builds it: today's
// «Temporada» screen (with «Tu porra» at #porra). The place reads `p.me.rows` (or builds another season's
// with buildMe when `p.query.temporada` is set) and focuses `p.query.j`.
import type { PlaceProps } from "./types";
import { legacyProps } from "../screens/legacy";
import { Temporada } from "../screens/Temporada";

export function Partidos(p: PlaceProps) {
  return <Temporada {...legacyProps(p)} />;
}
