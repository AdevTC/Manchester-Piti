// «Vidrio» · a match's goals and cards as marks on its 0′–50′ line (TU boards: the avisos' stacks, the search's
// preview, Temporada's «tramo a tramo»): ours in gold, theirs in coral, the cards as small yellow cards. Pure.
import type { ClubMatch } from "../../clubData";
import { eventMetaOf, settled } from "../../eventMeta";

export type MarkKind = "us" | "them" | "card-us" | "card-them";
export interface MatchMark {
  /** The minute (whole, from 0). */
  m: number;
  k: MarkKind;
  /** Its place on the line, 0–100 (%). */
  left: number;
}

/** The match's length in minutes (F7: 50 unless the acta says otherwise). */
export const durationOf = (m: Pick<ClubMatch, "duration">): number => (m.duration && m.duration > 0 ? m.duration : 50);

/** Every goal (by who it counts for) and card of a match, in minute order, placed on its line. */
export function matchMarks(match: Pick<ClubMatch, "events" | "duration">): MatchMark[] {
  const D = durationOf(match);
  const out: MatchMark[] = [];
  for (const e of settled(match.events ?? [])) {
    const meta = eventMetaOf(e);
    const m = Math.max(0, Math.round(e.minute ?? 0));
    const k: MarkKind | null = meta.goal === "for" ? "us" : meta.goal === "against" ? "them" : meta.card ? (meta.side === "us" ? "card-us" : "card-them") : null;
    if (k) out.push({ m, k, left: Math.min(99, (m / D) * 100) });
  }
  return out.sort((a, b) => a.m - b.m);
}
