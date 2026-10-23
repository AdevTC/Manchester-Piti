import { useMemo, useState } from "react";
import { dateMillis } from "../../functions/src/matchEngine";
import { serverNow } from "../lib/serverTime";
import { useClock } from "./useClock";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Minute rendering, with exact kickoff/end transitions even when kickoff includes seconds. */
export function useMatchClock(matches: readonly { date?: unknown; duration?: number; clock?: import("../../functions/src/matchClock").MatchClock }[]) {
  // Only a match within a day of now (before kickoff to after its end) can have a boundary before the next tick, so
  // the rest of the season's matches (~61 boundaries each) stay out. The window moves on the hour the clock reads
  // (state, not a render-time read: the compiler would keep the first one), at the latest a minute late, which a
  // day's margin covers; a jump (a tab woken after days) moves it at once and the clock re-reads its boundaries.
  const [hour, setHour] = useState(() => Math.floor(serverNow() / HOUR));
  const boundaries = useMemo(() => {
    const from = hour * HOUR - DAY;
    const to = (hour + 1) * HOUR + DAY;
    return matches.flatMap((m) => {
      const start = dateMillis(m.date);
      const duration = Math.max(60, Math.min(150, m.duration ?? 50));
      if (!Number.isFinite(start) || start > to || start + duration * 60_000 < from) return [];
      return Array.from({ length: duration + 1 }, (_, minute) => start + minute * 60_000);
    });
  }, [matches, hour]);
  const now = useClock(matches.some(m => m.clock && m.clock.phase !== "ready" && m.clock.phase !== "ended") ? 1000 : 60_000, boundaries);
  const nowHour = Math.floor(now / HOUR);
  if (nowHour !== hour) setHour(nowHour);
  return now;
}
