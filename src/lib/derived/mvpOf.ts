// The one MVP reader for the position ratings (playerPositions' mvpOf): every caller (jugador, the
// plantilla's ficha, the perfil, /stats, the admin) builds it here from useMvpResults, so the same player
// at the same position gets the same «Valoración» everywhere. A shared vote counts for each winner.
import type { ClubMatch } from "../clubData";
import { mvpWinners, type MvpResult } from "../vestuario";

/** The MVP of a match for `pid`'s form: him when he won or shared the vote, else the (first) winner, else null. */
export type MvpOf = (matchId: string, pid?: string) => string | null;

/** mvpOf over `games` (published matches only: the admin passes no drafts), from the MVP results at `now`. */
export function mvpOfFrom(results: ReadonlyMap<string, MvpResult>, games: readonly ClubMatch[], now: number): MvpOf {
  const winners = new Map(games.map((m) => [m.id, mvpWinners(m, results.get(m.id), now)]));
  return (matchId, pid) => {
    const won = winners.get(matchId) ?? [];
    return pid && won.includes(pid) ? pid : (won[0] ?? null);
  };
}
