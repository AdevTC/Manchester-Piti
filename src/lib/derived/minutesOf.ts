// The one minutes rule, for every page that prints minutes (stats, jugador, the perfil card, the pizarra's
// cromos and ficha, the admin's cromos): the ledger's minutes when the acta has a row for him; 0 when
// he did not play; and unknown (null) when he played on an acta that does not know his minutes (a legacy
// acta without a ledger) — never invented (not from its goals, nor from its «Participación
// (histórico)»). Unknown adds nothing to a total, and a total with no ledger behind it prints «—» (as
// /stats always did). A match that is not finished counts nothing (as computeStats). Display rounding
// lives in ./minutes (fmtMinutes / wholeMinutes).
import type { ClubMatch } from "../clubData";
import { durationOf } from "../form";
import { computeStats } from "../playerStats";
import { isVisibleMatch } from "../../../functions/src/matchEngine";
import { isGuestId } from "./guests";

type MinutesMatch = Pick<ClubMatch, "ledger" | "status" | "duration" | "events" | "archived" | "individuallyArchived">;

const counts = (m: MinutesMatch) => isVisibleMatch(m) && (!m.status || m.status === "finished");
const rowOf = (m: MinutesMatch, pid: string) => (counts(m) && !isGuestId(pid) ? m.ledger?.[pid] : undefined);

/** Did he play (computeStats' participation: the ledger row's `played`, else his events)? */
const playedIn = (m: MinutesMatch, pid: string) => computeStats(pid, [m]).matchesPlayed > 0;

/** His minutes in a match: the ledger row's (two decimals); 0 when he did not play; null when he played
 *  and the acta does not know them. */
export function minutesOf(m: MinutesMatch, pid: string): number | null {
  // a guest («guest:g1») has no minutes of his own anywhere
  if (!counts(m) || isGuestId(pid)) return 0;
  const row = rowOf(m, pid);
  if (row && typeof row.minutes === "number" && Number.isFinite(row.minutes)) return row.minutes;
  return playedIn(m, pid) ? null : 0;
}

/** How many of `games` have a ledger row for him (finished): the minutes he has a record of. 0 means every
 *  minutes total of his prints «—» (/stats' `tracked`). */
export function timedGames(games: readonly MinutesMatch[], pid: string): number {
  return games.filter((m) => !!rowOf(m, pid)).length;
}

/** His total known minutes over `games` (two decimals, exact where the ledger kept secondsPlayed; 0 with none). */
export function totalMinutes(games: readonly MinutesMatch[], pid: string): number {
  const seconds = games.reduce((s, m) => {
    const min = minutesOf(m, pid);
    if (!min) return s;
    const sec = rowOf(m, pid)?.secondsPlayed;
    return s + (typeof sec === "number" && Number.isFinite(sec) ? sec : min * 60);
  }, 0);
  return Math.round((seconds / 60) * 100) / 100;
}

/**
 * INTERNAL to the pizarra's cromos (buildSquad: the «sobre»'s recent minutes, the química's pairs and its
 * defence minutes) — never printed. The known minutes, or on an acta that does not know them, the whole match when
 * he played (`played`: computeStats' participation), else 0. Without it a legacy season would rate
 * everybody as absent.
 */
export function presenceMinutes(m: MinutesMatch, pid: string, played: boolean): number {
  return minutesOf(m, pid) ?? (played ? durationOf(m) : 0);
}
