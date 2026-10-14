// «¡GOL!» only for a goal that is new since this screen was showing the match and happened right now
// (see lib/derived/goalCelebration). Goals already in the data when the match is first shown, and
// goals that arrive late with an old time, change the score without any celebration. State is derived
// while rendering, so the score tiles and the burst get the verdict in the same render as the new goal.
import { useEffect, useState } from "react";
import { goalsOf, isFreshGoal, type GoalMatch } from "../../lib/derived/goalCelebration";

const SHOWN_MS = 2700;

export interface GoalCelebration {
  /** Changes with every fresh goal of ours while it is celebrated, 0 otherwise: the key of the burst. */
  burst: number;
  /** True while a fresh goal (ours or theirs) is being shown: the score tiles flip only then. */
  flip: boolean;
}

/** `match` is the live match being shown, or undefined when there is none. */
export function useGoalCelebration(match: (GoalMatch & { id: string }) | undefined, now: number): GoalCelebration {
  const goals = goalsOf(match?.events);
  const [seen, setSeen] = useState(() => ({ id: match?.id, ids: new Set(goals.map((g) => g.id)) }));
  const [shown, setShown] = useState({ n: 0, ours: false });

  if (seen.id !== match?.id) {
    // Another match (or none): whatever it already has is not new.
    setSeen({ id: match?.id, ids: new Set(goals.map((g) => g.id)) });
    setShown({ n: 0, ours: false });
  } else {
    const news = goals.filter((g) => !seen.ids.has(g.id));
    if (news.length && match) {
      setSeen({ id: seen.id, ids: new Set([...seen.ids, ...news.map((g) => g.id)]) });
      const fresh = news.filter((g) => isFreshGoal(g, match, now));
      if (fresh.length) setShown((s) => ({ n: s.n + 1, ours: fresh.some((g) => g.ours) }));
    }
  }

  const { n } = shown;
  useEffect(() => {
    if (!n) return;
    const t = window.setTimeout(() => setShown({ n: 0, ours: false }), SHOWN_MS);
    return () => window.clearTimeout(t);
  }, [n]);

  return { burst: shown.ours ? shown.n : 0, flip: shown.n > 0 };
}
