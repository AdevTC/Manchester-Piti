// «El partido» · the vestuario's state for the page: what the viewer still has to do (the tab's badge and its
// second line). Stub until the Vestuario screen is ported.
import type { ClubMatch } from "../../../lib/clubData";
import type { Person, Viewer } from "./ctx";
import type { Fase, Play, Score } from "./model";

export interface VestuarioInput {
  fase: Fase;
  viewer: Viewer;
  minute: number;
  edge: number;
  score: Score;
  plays: Play[];
  people: Map<string, Person>;
}

export interface VestuarioState {
  /** The tab's second line (long, short). */
  hint: [string, string];
  /** Things the viewer still has to do (the tab's badge). */
  badge: number;
  /** «2 cosas pendientes: votar al MVP y la nota». */
  badgeText: string;
}

export function useVestuario(match: ClubMatch | null, input: VestuarioInput): VestuarioState {
  void match;
  return { hint: input.viewer.member ? ["Lo tuyo", "Lo tuyo"] : ["Solo el equipo", "Del equipo"], badge: 0, badgeText: "" };
}
