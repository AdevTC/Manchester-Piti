// The match's figures (matchNumbers: the whole catalogue over the moviola's scope, ~100 ms on a phone for a narrated
// match) once per match, people, scope and score. Keyed on the score's two numbers, not on its object: the page
// hands a new one on every render (the clock, the header), and each one re-ran the catalogue, ~3 times a second.
// They are also kept per match across visits to the screen: «Números» mounts afresh each time its tab is tapped, and
// each tap ran the catalogue again inside the tab's View Transition (~120 ms of the ~470 ms with the CPU ×4).
import { useMemo } from "react";
import type { AnalysisFilters } from "../../../../functions/src/narrated/types";
import type { ClubMatch } from "../../../lib/clubData";
import type { WorkspacePerson } from "../../../lib/analysisWorkspace";
import { matchNumbers } from "./matchNumbers";
import type { Score } from "./model";

type Figures = ReturnType<typeof matchNumbers>;
/** Per match object (a new snapshot of the match is a new object: its figures are worked out again), the last few
 *  scopes and scores asked for (the moviola's minutes). */
const kept = new WeakMap<ClubMatch, Map<string, Figures>>();
const KEEP = 6;

const keyOf = (people: readonly WorkspacePerson[], filters: AnalysisFilters, us: number, them: number): string =>
  `${us}-${them}|${JSON.stringify(filters)}|${people.map((p) => `${p.id}:${p.name}:${p.number ?? ""}`).join(",")}`;

export function figuresOf(match: ClubMatch, people: readonly WorkspacePerson[], filters: AnalysisFilters, us: number, them: number): Figures {
  const key = keyOf(people, filters, us, them);
  let byKey = kept.get(match);
  if (!byKey) kept.set(match, (byKey = new Map()));
  const hit = byKey.get(key);
  if (hit) return hit;
  const figures = matchNumbers(match, people, filters, { us, them });
  byKey.set(key, figures);
  if (byKey.size > KEEP) byKey.delete(byKey.keys().next().value as string);
  return figures;
}

export function useMatchNumbers(played: boolean, match: ClubMatch, people: readonly WorkspacePerson[], filters: AnalysisFilters, score: Score) {
  const { us, them } = score;
  return useMemo(() => (played ? figuresOf(match, people, filters, us, them) : null), [played, match, people, filters, us, them]);
}
