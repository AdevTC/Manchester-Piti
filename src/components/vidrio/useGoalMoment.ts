// Plays the goal moment (goalMoment.ts) when `moment.key` changes: the stage advances on the timeline and the
// returned classes go on the lens, the sky, the glint, the digit, the scorer's name and the ribbon's peak. A goal
// already there on mount doesn't play (only its rim shows); reduced motion skips straight to the rim. Pass null
// once the next play happens and the rim goes. `ready: false` while the page's data is still arriving: the goal
// that arrives with it is one that was already there (arriving at a live match is not a goal), so it doesn't play.
import { useEffect, useState } from "react";
import { GOAL_TIMELINE, goalClasses, type GoalClasses, type GoalMoment, type GoalStage } from "./goalMoment";
import { useReducedMotion } from "./env";

export function useGoalMoment(moment: GoalMoment | null, options: { reduced?: boolean; ready?: boolean } = {}): GoalClasses {
  const prefers = useReducedMotion();
  const reduced = options.reduced ?? prefers;
  const ready = options.ready ?? true;
  const key = moment?.key ?? null;
  const [first, setFirst] = useState(key);
  // (until the data is ready, whatever goal shows is the one that was there)
  if (!ready && key !== first) setFirst(key);
  const [run, setRun] = useState<{ key: string | number; stage: GoalStage } | null>(null);

  useEffect(() => {
    if (!ready || key == null || key === first || reduced) return;
    const timers = GOAL_TIMELINE.map(([at, stage]) => window.setTimeout(() => setRun({ key, stage }), at));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [key, first, reduced, ready]);

  const stage: GoalStage = key == null ? "idle" : key === first || reduced || !ready ? "cool" : run?.key === key ? run.stage : "inhale";
  return goalClasses(stage, moment?.side ?? null);
}
