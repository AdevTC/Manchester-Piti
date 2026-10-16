// The one MVP reader for the position ratings (playerPositions' mvpOf): every caller (jugador, the
// plantilla's ficha, the perfil, /stats, the admin) builds it here from useMvpResults, so the same player
// at the same position gets the same «Valoración» everywhere. A shared vote counts for each winner.
import type { ClubMatch } from "../clubData";
import { mvpWinners, type MvpResult } from "../vestuario";
import { isVisibleMatch } from "../../../functions/src/matchEngine";

/** The MVP of a match for `pid`'s form: him when he won or shared the vote, else the (first) winner, else null. */
export type MvpOf = (matchId: string, pid?: string) => string | null;

/**
 * The moment the last of `games`' votes closed by `now` (-Infinity before the first). Read at it, the MVPs
 * are the same as at `now` — a vote counts once closed — but the value only moves when a vote closes, so a
 * page on a minute clock can key mvpOf on it instead of on the clock.
 */
export function votesClosedAt(games: readonly ClubMatch[], now: number): number {
  let at = -Infinity;
  for (const m of games) if (isVisibleMatch(m) && m.voteClosesAt && m.voteClosesAt <= now && m.voteClosesAt > at) at = m.voteClosesAt;
  return at;
}

/** mvpOf over `games` (published matches only: the admin passes no drafts), from the MVP results at `now`. */
export function mvpOfFrom(results: ReadonlyMap<string, MvpResult>, games: readonly ClubMatch[], now: number): MvpOf {
  const winners = new Map(games.map((m) => [m.id, mvpWinners(m, results.get(m.id), now)]));
  return (matchId, pid) => {
    const won = winners.get(matchId) ?? [];
    return pid && won.includes(pid) ? pid : (won[0] ?? null);
  };
}
