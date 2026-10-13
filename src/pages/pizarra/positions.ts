// The board only speaks POR / DEF / MED / DEL: this reads any stored position (codes or Spanish words, any
// case, with or without accents) through the shared F7 catalogue; anything else is «no position». Pure.
import { isPosCode, parsePosition } from "../../lib/positions";
import type { PlaysAs, Zone } from "./formations";

/** POR / DEF / MED / DEL from whatever was stored; undefined when it isn't a known position. */
export function normZone(x: unknown): Zone | undefined {
  return parsePosition(x).line ?? undefined;
}

/** A stored «Jugar de»: a position code as it is, else the line any other word reads as (a legacy
 *  board's «MED», «Medio»…); undefined when it is neither. */
export function normPlaysAs(x: unknown): PlaysAs | undefined {
  return isPosCode(x) ? x : normZone(x);
}
