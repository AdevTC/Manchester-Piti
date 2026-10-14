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
  /** The goal being shown (the latest of the fresh ones), null otherwise; `n` changes with every new one. */
  goal: { id: string; ours: boolean; n: number } | null;
}

export interface GoalCelebrationOptions {
  /** How long a goal is shown, in ms (the boards' burst: 2.7 s). */
  hold?: number;
  /** False: new goals are taken as seen but never shown (e.g. the score is not confirmed by the server). */
  celebrate?: boolean;
}

interface Shown {
  n: number;
  ours: boolean;
  id: string | null;
}
const NONE: Shown = { n: 0, ours: false, id: null };

/** `match` is the live match being shown, or undefined when there is none. */
export function useGoalCelebration(match: (GoalMatch & { id: string }) | undefined, now: number, { hold = SHOWN_MS, celebrate = true }: GoalCelebrationOptions = {}): GoalCelebration {
  const goals = goalsOf(match?.events);
  const [seen, setSeen] = useState(() => ({ id: match?.id, ids: new Set(goals.map((g) => g.id)) }));
  const [shown, setShown] = useState<Shown>(NONE);

  if (seen.id !== match?.id) {
    // Another match (or none): whatever it already has is not new.
    setSeen({ id: match?.id, ids: new Set(goals.map((g) => g.id)) });
    setShown(NONE);
  } else {
    const news = goals.filter((g) => !seen.ids.has(g.id));
    if (news.length && match) {
      setSeen({ id: seen.id, ids: new Set([...seen.ids, ...news.map((g) => g.id)]) });
      const fresh = celebrate ? news.filter((g) => isFreshGoal(g, match, now)).sort((a, b) => a.seconds - b.seconds) : [];
      const latest = fresh.at(-1);
      if (latest) setShown((s) => ({ n: s.n + 1, ours: fresh.some((g) => g.ours), id: latest.id }));
    }
  }

  const { n } = shown;
  useEffect(() => {
    if (!n) return;
    const t = window.setTimeout(() => setShown(NONE), hold);
    return () => window.clearTimeout(t);
  }, [n, hold]);

  return { burst: shown.ours ? shown.n : 0, flip: shown.n > 0, goal: shown.id ? { id: shown.id, ours: goals.find((g) => g.id === shown.id)?.ours ?? shown.ours, n: shown.n } : null };
}
