// The shared match clock, read-only: «1ª parte · 18:59», ticking every second. Who drives the clock is la
// mesa (src/pages/mesa: «Pitar el inicio», the break, the final), through the controlMatchClock callable.
import { clockLabel, clockReading, timeText } from "../../../functions/src/matchClock";
import type { ClubMatch } from "../../lib/clubData";
import { useClock } from "../../hooks/useClock";

export function MatchClockDisplay({ match }: { match: Pick<ClubMatch, "clock"> }) {
  const now = useClock(1000);
  const r = clockReading(match.clock, now);
  return <span>{clockLabel(match.clock)} · {timeText(r.elapsedSeconds)}{r.phase === "halftime" ? ` · descanso ${timeText(r.breakSeconds)}` : ""}</span>;
}
