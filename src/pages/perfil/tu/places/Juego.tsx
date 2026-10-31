// Tu juego (B Juego) — PLACEHOLDER until the Juego place agent builds it: today's «Posiciones» screen (its
// states and writes). The place adds the rank ladders (`p.me.ranks`), «Tu mejor sociedad» (`p.me.partner`) and
// «Compararte con…».
import type { PlaceProps } from "./types";
import { legacyProps } from "../screens/legacy";
import { Posiciones } from "../screens/Posiciones";

export function Juego(p: PlaceProps) {
  return <Posiciones {...legacyProps(p)} />;
}
