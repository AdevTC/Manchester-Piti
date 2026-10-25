// La pizarra «Noche de partido» — «Sugerir siete»: a pack of cromos opened on the pitch. The seven in
// the best recent form (minutes and goals+assists of the last matches, then the rating), each dealt to
// a slot of his natural zone (with exact positions: the best encaje, see sevenByEncaje), the bajas and
// the «no voy» left out (and, when the match has its convocatoria, whoever it doesn't call). The
// convocatoria's siete (the admin's Convocar: the one source) is dealt first. Those who stay on the
// pitch keep their «Jugar de». Pure.
import type { Lineup, Zone } from "../formations";
import type { PosCode } from "../../../lib/positions";
import { adapted, hasFitData, inPlace, logicGrade, placeByWeight, slotCode } from "./encaje";
import { slotZone } from "./geometry";
import type { Squad } from "./model";
import { answerRank, canCome, dropBenchedRoles } from "./ops";
import { FIT_ADAPTED, FIT_IN_PLACE, FIT_SMALL_MAX, FORM_MAX } from "./ratings";

/** How many played officials put him there (familiarity.ts): by `z`, the slot's zone, or — passed only
 *  for a player with an exact position — by `code`, the slot's exact position. */
export type FamAt = (id: string, z: Zone, code?: PosCode) => number;

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
export function suggestSeven(L: Lineup, sq: Squad, first: readonly string[] = [], called: ReadonlySet<string> | null = null, fam?: FamAt): Lineup {
  const rank = packRanking(sq, called);
  // (the convocatoria's siete, minus whoever is now a baja or said no)
  const own = first.filter((id) => canCome(sq, id, null));
  // «Jugar de» stays with whoever was on the pitch and still is
  const was = wasOn(L);
  const kept = (used: ReadonlySet<string>) => Object.fromEntries(Object.entries(L.playerPositions ?? {}).filter(([id]) => was.has(id) && used.has(id)));
  const cand = sevenCandidates(own, rank, L.slots.length);
  // (with the «Jugar de» it may keep, as Auto-colocar: an exact one on the pitch is exact data)
  const seven = hasFitData(cand, sq, keptBoard(L, was)) ? sevenByEncaje(L, sq, cand, new Set(own), was, fam) : sevenByLine(L, sq, own, rank, fam);
  const used = new Set(seven.filter((x): x is string => !!x));
  return dropBenchedRoles({ ...L, slots: L.slots.map((s, i) => ({ ...s, playerId: seven[i] })), playerPositions: kept(used) });
}

// The seven by encaje: encaje and form in balance (the tiers, and why, next to FORM_MIN in ratings.ts);
// the convocatoria's own siete over all of it: a slot is worth at most FIT_IN_PLACE + FORM_MAX + the
// small terms, and seven of those stay under OWN.
const OWN = 10 * (FIT_IN_PLACE + FORM_MAX + FIT_SMALL_MAX);
// (familiarity: an adaptado or an unknown who has played there in the official, +5)
const KNOWN = 5;

/** Who was on the pitch (keeps his «Jugar de» if he stays). */
const wasOn = (L: Lineup): Set<string> => new Set(L.slots.map((s) => s.playerId).filter((x): x is string => !!x));
/** The board with only the «Jugar de» of those on the pitch (what the seven is judged with). */
const keptBoard = (L: Lineup, was: ReadonlySet<string>): Lineup => ({ ...L, playerPositions: Object.fromEntries(Object.entries(L.playerPositions ?? {}).filter(([id]) => was.has(id))) });

/** Whom «Sugerir siete» deals from: a whole convocatoria siete alone, else its own first and then the
 *  pack's ranking. */
function sevenCandidates(own: string[], rank: string[], slots: number): string[] {
  return own.length >= slots ? own : [...new Set([...own, ...rank])];
}

/** Whether «Sugerir siete» deals by exact encaje (someone it can deal has a preferida or a también)
 *  rather than by lines — for the words that tell what it did. */
export function sevenByEncajeOn(L: Lineup, sq: Squad, first: readonly string[] = [], called: ReadonlySet<string> | null = null): boolean {
  return hasFitData(sevenCandidates(first.filter((id) => canCome(sq, id, null)), packRanking(sq, called), L.slots.length), sq, keptBoard(L, wasOn(L)));
}

/**
 * The seven with exact positions (someone has a preferida or a también, or a «Jugar de» by code on the
 * pitch): an exact assignment — the convocatoria's siete always plays; then encaje and form in balance
 * (ratings.ts FIT_*): in place or adaptado (or unknown) always over fuera, and between in place and
 * adaptado the form (the rating) decides once it is 10 points apart; the answer («Voy» before no answer
 * before «Duda», −2 a step) and, for an adaptado or an unknown, having played there in the official
 * (fam ≥ 2, +5: that exact position for a player with one, else that line) only tip near-equals; exact
 * ties follow the pack's order. Keepers: the goal only to a declared
 * keeper while there is one. Each is judged with the «Jugar de» he keeps (only those already on the
 * pitch keep theirs).
 */
function sevenByEncaje(L: Lineup, sq: Squad, cand: string[], own: ReadonlySet<string>, was: ReadonlySet<string>, fam?: FamAt): (string | null)[] {
  const B = keptBoard(L, was);
  const keeper = cand.some((id) => inPlace(logicGrade(B, sq, id, 0)));
  // (who is counted by exact position: the same rule as the familiarity marks, famSlot)
  const exact = new Set(cand.filter((id) => hasFitData([id], sq, B)));
  return placeByWeight(L.slots.length, cand, (i, id) => {
    const g = logicGrade(B, sq, id, i);
    if (i === 0 && keeper && !inPlace(g)) return null;
    const fit = inPlace(g) ? FIT_IN_PLACE : adapted(g) || g == null ? FIT_ADAPTED : 0;
    const known = (adapted(g) || g == null) && fam && fam(id, slotZone(L, i), exact.has(id) ? slotCode(B, i) : undefined) >= 2 ? KNOWN : 0;
    const tie = (cand.length - cand.indexOf(id)) / 1e4;
    // (1000: every slot filled while there is someone, whatever his form)
    return 1000 + (own.has(id) ? OWN : 0) + fit + known - 2 * answerRank(sq, id) + (sq.byId.get(id)?.rt ?? 0) + tie;
  });
}

/** The seven by lines (nobody with an exact position): slot by slot, keepers only in goal, each zone
 *  with its own first, then whoever is left. */
function sevenByLine(L: Lineup, sq: Squad, own: string[], rank: string[], fam?: FamAt): (string | null)[] {
  const out: (string | null)[] = L.slots.map(() => null);
  const used = new Set<string>();
  const isGk = (id: string) => sq.byId.get(id)?.pos === "POR";
  // pass 0: natural zone; pass 1: any outfielder outfield / a keeper in goal; pass 2: anyone left
  const deal = (from: readonly string[], passes: readonly number[]) => {
    for (const pass of passes) {
      for (let i = 0; i < out.length; i++) {
        if (out[i]) continue;
        const z = slotZone(L, i);
        // (out of his natural zone, whoever has already played there in the official goes first: the
        // familiarity breaks the tie, see familiarity.ts)
        const order = pass === 1 && fam ? [...from].sort((a, b) => Number(fam(b, z) >= 2) - Number(fam(a, z) >= 2)) : from;
        for (const id of order) {
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
  return out;
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
