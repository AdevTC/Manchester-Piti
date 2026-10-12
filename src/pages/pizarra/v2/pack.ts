// La pizarra «Noche de partido» — «Sugerir siete»: a pack of cromos opened on the pitch. The seven in
// the best recent form (minutes and goals+assists of the last matches, then the rating), each dealt to
// a slot of his natural zone, the bajas and the «no voy» left out (and, when the match has its
// convocatoria, whoever it doesn't call). The convocatoria's siete (the admin's Convocar: the one source)
// is dealt first. Those who stay on the pitch keep their «Jugar de». Pure.
import type { Lineup } from "../formations";
import { slotZone } from "./geometry";
import type { Squad } from "./model";
import { answerRank, canCome, dropBenchedRoles } from "./ops";

/** The ranking the pack deals from (best first): «Voy», then no answer, then «Duda», each by form;
 *  never a baja, a «no va» or (with a convocatoria) someone it doesn't call. */
export function packRanking(sq: Squad, called: ReadonlySet<string> | null = null): string[] {
  const score = (id: string) => {
    const c = sq.byId.get(id);
    return c ? c.recentMin + c.recentGA * 15 + c.rt : -Infinity;
  };
  return sq.list
    .filter((c) => canCome(sq, c.id, called))
    .map((c) => c.id)
    .sort((a, b) => answerRank(sq, a) - answerRank(sq, b) || score(b) - score(a));
}

/**
 * The seven, slot by slot: keepers only in goal, each zone with its own first, then whoever is left.
 * `first` (the convocatoria's siete) is dealt before anyone else: a whole siete is exactly those seven;
 * a partial one goes first and the pack completes it (a keeper from the pack before an outfielder in goal).
 */
export function suggestSeven(L: Lineup, sq: Squad, first: readonly string[] = [], called: ReadonlySet<string> | null = null): Lineup {
  const rank = packRanking(sq, called);
  // (the convocatoria's siete, minus whoever is now a baja or said no)
  const own = first.filter((id) => canCome(sq, id, null));
  const out: (string | null)[] = L.slots.map(() => null);
  const used = new Set<string>();
  const isGk = (id: string) => sq.byId.get(id)?.pos === "POR";
  // pass 0: natural zone; pass 1: any outfielder outfield / a keeper in goal; pass 2: anyone left
  const deal = (from: readonly string[], passes: readonly number[]) => {
    for (const pass of passes) {
      for (let i = 0; i < out.length; i++) {
        if (out[i]) continue;
        const z = slotZone(L, i);
        for (const id of from) {
          if (used.has(id)) continue;
          if (pass < 2 && (i === 0) !== isGk(id)) continue;
          if (pass === 0 && sq.byId.get(id)?.pos !== z) continue;
          out[i] = id;
          used.add(id);
          break;
        }
      }
    }
  };
  if (own.length >= out.length) deal(own, [0, 1, 2]);
  else {
    deal(own, [0, 1]);
    deal(rank, [0, 1]);
    deal(own, [2]);
    deal(rank, [2]);
  }
  // «Jugar de» stays with whoever was on the pitch and still is
  const was = new Set(L.slots.map((s) => s.playerId).filter((x): x is string => !!x));
  const playerPositions = Object.fromEntries(Object.entries(L.playerPositions ?? {}).filter(([id]) => was.has(id) && used.has(id)));
  return dropBenchedRoles({ ...L, slots: L.slots.map((s, i) => ({ ...s, playerId: out[i] })), playerPositions });
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
