// La pizarra «Noche de partido» — «Sugerir siete»: a pack of cromos opened on the pitch. The seven in
// the best recent form (minutes and goals+assists of the last matches, then the rating), each dealt to
// a slot of his natural zone, the bajas and the «no voy» left out. Pure.
import type { Lineup } from "../formations";
import { slotZone } from "./geometry";
import { isAvailable, type Squad } from "./model";

/** The ranking the pack deals from (best first). */
export function packRanking(sq: Squad): string[] {
  const score = (id: string) => {
    const c = sq.byId.get(id);
    return c ? c.recentMin + c.recentGA * 15 + c.rt : -Infinity;
  };
  return sq.list
    .filter((c) => isAvailable(sq, c.id) && c.cv !== "no")
    .map((c) => c.id)
    .sort((a, b) => score(b) - score(a));
}

/** The seven, slot by slot: keepers only in goal, each zone with its own first, then whoever is left. */
export function suggestSeven(L: Lineup, sq: Squad): Lineup {
  const rank = packRanking(sq);
  const out: (string | null)[] = L.slots.map(() => null);
  const used = new Set<string>();
  const isGk = (id: string) => sq.byId.get(id)?.pos === "POR";
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < out.length; i++) {
      if (out[i]) continue;
      const z = slotZone(L, i);
      for (const id of rank) {
        if (used.has(id)) continue;
        // pass 0: natural zone; pass 1: any outfielder outfield / a keeper in goal; pass 2: anyone left
        if (pass < 2 && (i === 0) !== isGk(id)) continue;
        if (pass === 0 && sq.byId.get(id)?.pos !== z) continue;
        out[i] = id;
        used.add(id);
        break;
      }
    }
  }
  return { ...L, slots: L.slots.map((s, i) => ({ ...s, playerId: out[i] })), playerPositions: {} };
}

/** The slot-machine reel each cromo spins before it lands: six dorsales of the squad, twice. */
export function reelFor(i: number, nums: number[]): number[] {
  if (!nums.length) return [];
  const r: number[] = [];
  for (let k = 0; k < 6; k++) r.push(nums[(i * 3 + k * 5) % nums.length]);
  return r.concat(r);
}

/** When cromo i flips in the pack (seconds): one after another, as the design deals them. */
export const packDelay = (i: number): number => 0.6 + i * 0.17;
