// The running clock Hoy and the match's «La mesa» station show (scoring is la mesa's: src/pages/mesa).
import { MatchClockDisplay } from "../../../components/celeste/MatchClockControl";
import type { ClubMatch } from "../../../lib/clubData";
import { useClock } from "../../../hooks/useClock";
import { clockText } from "../data/moments";

/** «31:12» since kick-off, ticking every second (only this text re-renders). */
export function LiveClock({ start, match }: { start: number; match?: ClubMatch }) {
  const now = useClock(1000);
  return match?.clock ? <MatchClockDisplay match={match} /> : <span>{clockText(start, now)}</span>;
}
