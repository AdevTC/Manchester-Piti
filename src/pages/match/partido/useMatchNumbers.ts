// The match's figures (matchNumbers: the whole catalogue over the moviola's scope, ~100 ms on a phone for a narrated
// match) once per match, people, scope and score. Keyed on the score's two numbers, not on its object: the page
// hands a new one on every render (the clock, the header), and each one re-ran the catalogue, ~3 times a second.
import { useMemo } from "react";
import type { AnalysisFilters } from "../../../../functions/src/narrated/types";
import type { ClubMatch } from "../../../lib/clubData";
import type { WorkspacePerson } from "../../../lib/analysisWorkspace";
import { matchNumbers } from "./matchNumbers";
import type { Score } from "./model";

export function useMatchNumbers(played: boolean, match: ClubMatch, people: readonly WorkspacePerson[], filters: AnalysisFilters, score: Score) {
  const { us, them } = score;
  return useMemo(() => (played ? matchNumbers(match, people, filters, { us, them }) : null), [played, match, people, filters, us, them]);
}
