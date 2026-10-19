// The goal moment of tonight's match on the other pages: `newestGoal` names the newest goal that stands (either
// side) so the page can lift the scorer's shirt or roll a number, and `useNightGoal` plays the kit's goal
// moment with it (its flood reaches the page's light field through PageSky). A goal already there on mount
// doesn't play.
import { useMemo, useState } from "react";
import { useGoalMoment, type GoalClasses } from "../vidrio";
import type { ClubMatch } from "../../lib/clubData";
import { eventMetaOf, settled } from "../../lib/eventMeta";
import { eventSeconds } from "../../../functions/src/matchAnalysis";

export interface NightGoal {
  key: string;
  side: "us" | "them";
  /** Ours: who scored it (for the lift). */
  playerId: string | null;
}

/** The newest goal that stands of `match` (either side), or null. */
export function newestGoal(match: Pick<ClubMatch, "events"> | null | undefined): NightGoal | null {
  if (!match) return null;
  const goals = settled(match.events)
    .filter((e) => eventMetaOf(e).goal)
    .sort((a, b) => eventSeconds(a) - eventSeconds(b));
  const g = goals.at(-1);
  if (!g) return null;
  const ours = eventMetaOf(g).goal === "for";
  return { key: g.id, side: ours ? "us" : "them", playerId: ours && g.type !== "opponent_own_goal" ? (g.playerId ?? null) : null };
}

/** The goal moment of tonight's match while it is played. */
export function useNightGoal(match: ClubMatch | null | undefined, live: boolean): { goal: NightGoal | null; moment: GoalClasses } {
  const goal = useMemo(() => (live ? newestGoal(match) : null), [live, match]);
  // (the data arrives after the page mounts: the goals already there when it does are not news)
  const [seen, setSeen] = useState<string | null | undefined>(undefined);
  if (seen === undefined && match) setSeen(newestGoal(match)?.key ?? null);
  const fresh = goal && seen !== undefined && goal.key !== seen ? goal : null;
  const moment = useGoalMoment(fresh ? { key: fresh.key, side: fresh.side } : null);
  return { goal: fresh, moment };
}
