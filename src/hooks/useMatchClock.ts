import { useMemo } from "react";
import { dateMillis } from "../../functions/src/matchEngine";
import { useClock } from "./useClock";

/** Minute rendering, with exact kickoff/end transitions even when kickoff includes seconds. */
export function useMatchClock(matches: readonly { date?: unknown; duration?: number; clock?: import("../../functions/src/matchClock").MatchClock }[]) {
  const boundaries = useMemo(() => matches.flatMap((m) => {
    const start = dateMillis(m.date);
    const duration = Math.max(60, Math.min(150, m.duration ?? 50));
    return Array.from({ length: duration + 1 }, (_, minute) => start + minute * 60_000);
  }).filter(Number.isFinite), [matches]);
  return useClock(matches.some(m => m.clock && m.clock.phase !== "ready" && m.clock.phase !== "ended") ? 1000 : 60_000, boundaries);
}
