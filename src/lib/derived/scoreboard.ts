// The scoreboard's pure bits, shared by the Partidos board, the match page's hero and the live island
// (each keeps its own markup): the two teams and the score, the live minute with its bar, and the
// last-event line. Built on lib/partidos (scoreOf, shownMinute, lastEvent): nothing here re-counts them.
import type { ClubMatch } from "../clubData";
import { opponentInitials } from "../clubAnalytics";
import { lastEvent, scoreOf, shownMinute } from "../partidos";

export type Side = "Local" | "Visitante";

export interface ScoreboardTeams {
  /** The rival as the match names it («Rival» when it names none). */
  rival: string;
  /** Its initials for the crest's place: the match's own, or worked out from its name. */
  initials: string;
  gf: number;
  ga: number;
  /** Our side and theirs: a match not marked away is played at home. */
  usSide: Side;
  rivalSide: Side;
}

/** The two teams and the score (scoreOf: the acta's once finished, the events' while live). */
export function scoreboardOf(m: Pick<ClubMatch, "rival" | "rivalInitials" | "home" | "goalsFor" | "goalsAgainst" | "events" | "status">): ScoreboardTeams {
  const rival = m.rival ?? "Rival";
  const { gf, ga } = scoreOf(m);
  const away = m.home === false;
  return { rival, initials: m.rivalInitials || opponentInitials(rival), gf, ga, usSide: away ? "Visitante" : "Local", rivalSide: away ? "Local" : "Visitante" };
}

/** The last thing that happened (lastEvent): its shown minute, who, what, and whether it was a goal of ours. */
export type LastEvent = NonNullable<ReturnType<typeof lastEvent>>;

/** How far through the match the bar is, 0–100 (a match without a duration lasts 50). */
export const progressPct = (minute: number | null, duration: number | undefined): number => Math.min(100, ((minute ?? 0) / (duration ?? 50)) * 100);

export interface LivePlay {
  /** The minute to show (shownMinute); null before the clock runs. */
  minute: number | null;
  /** The bar's width, 0–100. */
  progress: number;
  last: LastEvent | null;
}

/** A live match at `now`: its minute, the bar and the last event (`nameOf` names a player in the match's season). */
export function livePlay(m: Pick<ClubMatch, "date" | "duration" | "clock" | "events" | "rival">, now: number, nameOf: (id: string) => string): LivePlay {
  const minute = shownMinute(m, now);
  return { minute, progress: progressPct(minute, m.duration), last: lastEvent(m.events, nameOf, m.rival ?? "Rival") };
}

/** «Erik · Gol». */
export const eventLine = (last: LastEvent): string => `${last.who} · ${last.label}`;

/** The big board's last line (Partidos and the match page): the event's minute and line, or the minute being
 *  played and «Arranca el partido» before anything happened. */
export function boardLastLine({ minute, last }: Pick<LivePlay, "minute" | "last">): { at: string; text: string } {
  return last ? { at: `${last.minute}′`, text: eventLine(last) } : { at: `${minute}′`, text: "Arranca el partido" };
}

/** Who the ¡GOL! burst names: our scorer and the minute when the last event is a goal of ours. */
export const goalBurstWho = (last: LastEvent | null): string | undefined => (last?.goal ? `${last.who} · ${last.minute}′` : undefined);
