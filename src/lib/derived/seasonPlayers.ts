// The season's squad as the pizarra resolves it (shirt name and dorsal of the season), the member's porra
// line and where he has played: the pure pieces the perfil, the season recap and the admin share (they
// lived in pages/perfil/profileData, which re-exports them). Pure.
import type { ClubMatch } from "../clubData";
import type { PlayerDoc } from "../schemas";
import { resolvePositions } from "../positions";
import { porraPosition } from "../vestuario";
import { playerPositions, type PlayerPositions } from "../positionStats";
import { ratingMatches, seasonRatings } from "../seasonRating";
import type { Standings } from "../standings";
import type { SquadPlayer } from "../../pages/pizarra/v2/ratings";

type Detail = { shirtName?: unknown; number?: unknown };
const detailOf = (p: PlayerDoc, sid: string): Detail | null => {
  const d = p.seasonDetails?.[sid];
  return d && typeof d === "object" ? (d as Detail) : null;
};
/** The shirt name and dorsal of a season, as the pizarra and the plantilla print them. */
export function resolveShirt(p: PlayerDoc, seasonId: string, seasons: { id: string }[]): { shirtName: string; number: number } {
  const sid = seasonId !== "all" && detailOf(p, seasonId) ? seasonId : [...seasons].reverse().find((s) => p.seasons?.includes(s.id) && detailOf(p, s.id))?.id;
  const d = sid ? detailOf(p, sid) : null;
  return {
    shirtName: (typeof d?.shirtName === "string" && d.shirtName) || p.shirtName || "",
    number: typeof d?.number === "number" ? d.number : (p.number ?? 0),
  };
}

/** The season's squad for the cromos (and the card): its players, plus `me` if he isn't in it. */
export function seasonPlayers(players: PlayerDoc[], seasonId: string, seasons: { id: string }[], me: string | null): SquadPlayer[] {
  return players
    .filter((p) => seasonId === "all" || p.seasons?.includes(seasonId) || p.id === me)
    .map((p) => {
      const { shirtName, number } = resolveShirt(p, seasonId, seasons);
      const pos = resolvePositions(p);
      return {
        id: p.id,
        shirtName,
        firstName: p.firstName ?? "",
        number,
        naturalPosition: pos.line ?? undefined,
        positions: { main: pos.main, also: pos.also },
        injured: p.injured === true,
        active: p.active !== false,
        ...(p.sanction ? { sanction: p.sanction } : {}),
        ...(typeof p.sanctionClearedAt === "number" ? { sanctionClearedAt: p.sanctionClearedAt } : {}),
      };
    })
    .sort((a, b) => a.number - b.number);
}

export interface PorraLine {
  /** Predictions on finished matches this season. */
  predictions: number;
  exact: number;
  points: number;
  rank: number;
  of: number;
}
export function porraLine(rows: { uid: string; points: number; exact: number; played: number }[], uid: string): PorraLine | null {
  const pos = porraPosition(rows, uid);
  return pos ? { predictions: pos.row.played, exact: pos.row.exact, points: pos.row.points, rank: pos.position, of: rows.length } : null;
}

/** «Dónde has jugado»: his minutes, events and rating by position over the season's calendar, with the
 *  season's notas (GLOBAL's, the same tables as the card), so the perfil's rating is jugador's. */
export function positionsPlayed(playerId: string, calendar: ClubMatch[], standings: readonly Standings[]): PlayerPositions {
  const games = ratingMatches(calendar);
  return playerPositions(playerId, calendar, seasonRatings(games, standings));
}
