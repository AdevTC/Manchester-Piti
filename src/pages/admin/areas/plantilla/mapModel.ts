// PLANTILLA · the F7 map's 13 places (board coordinates, %) and what a tap does: «★ preferida», «● también» (up to
// 6) or the alta's cycle (first tap the preferida, the next ones «también»). Pure.
import { MAX_ALSO, type PosCode, type PositionSet } from "../../../../lib/positions";

export const SPOTS: readonly { c: PosCode; x: number; y: number }[] = [
  { c: "DC", x: 50, y: 7 },
  { c: "EI", x: 15, y: 15 },
  { c: "ED", x: 85, y: 15 },
  { c: "MCO", x: 50, y: 27 },
  { c: "MI", x: 15, y: 40 },
  { c: "MC", x: 50, y: 40 },
  { c: "MD", x: 85, y: 40 },
  { c: "MCD", x: 50, y: 53 },
  { c: "LI", x: 15, y: 62 },
  { c: "LD", x: 85, y: 62 },
  { c: "DFC", x: 50, y: 66 },
  { c: "LIB", x: 50, y: 79 },
  { c: "POR", x: 50, y: 92 },
];
export type MapMode = "main" | "also" | "cycle";

/** What a tap does to the set; a string is why it is refused (the 6 «también» cap). */
export function tapSpot(set: PositionSet, c: PosCode, mode: MapMode, who: string): PositionSet | string {
  const isMain = set.main === c;
  const isAlso = set.also.includes(c);
  if (mode === "main") return { main: isMain ? null : c, also: set.also.filter((x) => x !== c) };
  if (mode === "cycle") {
    if (isMain) return { main: null, also: set.also.length < MAX_ALSO ? [...set.also, c] : set.also };
    if (isAlso) return { main: set.main, also: set.also.filter((x) => x !== c) };
    if (!set.main) return { main: c, also: set.also };
    if (set.also.length >= MAX_ALSO) return `${who} ya tiene ${MAX_ALSO} «también»: quita una antes.`;
    return { main: set.main, also: [...set.also, c] };
  }
  if (isAlso) return { main: set.main, also: set.also.filter((x) => x !== c) };
  if (set.also.length >= MAX_ALSO) return `${who} ya tiene ${MAX_ALSO} «también»: quita una antes.`;
  return { main: isMain ? null : set.main, also: [...set.also, c] };
}

