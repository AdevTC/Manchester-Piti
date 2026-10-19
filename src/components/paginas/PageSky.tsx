// «Vidrio» on the other pages (Plantilla, Números, El club, the match page, Perfil, Vestuario; V-Integracion
// «Cada página, el mismo cristal» and the V-Vivo frames): the light field of the moment behind the whole page
// — Palomeras' sky now, floodlit while a match is played — and the goal moment's flood reaching it (gold for
// ours, a cold coral flash for theirs). `useNightGoal` names the newest goal of tonight's match so the page can
// lift the scorer's shirt or roll a number with the same moment.
import { useMemo } from "react";
import { VidrioSky, skyAt, useGoalMoment, type GoalClasses } from "../vidrio";
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

/** The goal moment of tonight's match while it is played (a goal already there on mount doesn't play). */
export function useNightGoal(match: ClubMatch | null | undefined, live: boolean): { goal: NightGoal | null; moment: GoalClasses } {
  const goal = useMemo(() => (live ? newestGoal(match) : null), [live, match]);
  const moment = useGoalMoment(goal ? { key: goal.key, side: goal.side } : null);
  return { goal, moment };
}

export interface PageSkyProps {
  now: number;
  /** A match is being played (the floodlights go on with the dusk). */
  live: boolean;
  /** The goal moment (useNightGoal().moment): its flood. */
  moment?: GoalClasses | null;
}

/** The light field of the moment, first child of a `.vd-pg` root. */
export function PageSky({ now, live, moment }: PageSkyProps) {
  const light = skyAt(now, live);
  return <VidrioSky light={light.light} floodlit={light.floodlit} gold={moment?.sky.gold} cold={moment?.sky.cold} />;
}
