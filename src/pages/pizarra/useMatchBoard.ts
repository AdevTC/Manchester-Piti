// «La pizarra de este partido»: the board a member's link opens, read from the official's scope docs
// (`lineupOfficials/{season}__{match}`, and `{season}__temporada` only while the match is still to be
// played) — two tiny docs, not the season's boards. Team-member reads (firestore.rules): a fan passes
// `enabled` false and nothing is read. Realtime and shared (useLiveDoc: one listener per doc).
import { useLiveDoc } from "../vestuario/live";
import { boardForMatch, boardSeven, lockedBoard, officialScopeId } from "./officialBoard";

const lock = (d: { lineupId?: unknown } | undefined) => lockedBoard(d);
const sevenOfDoc = (d: { slots?: unknown } | undefined): string[] | null => (d ? boardSeven(d.slots) : null);

/**
 * The seven of a board (the match's official, from useMatchBoard): one shared listener on its doc, only
 * while there is a board (team-member reads: a fan passes null and nothing is read). Null = no board, not
 * read yet, or gone.
 */
export function useBoardSeven(boardId: string | null): string[] | null {
  const live = useLiveDoc(boardId ? `lineups/${boardId}` : null, "seven", sevenOfDoc, null);
  return boardId ? live.data : null;
}

export function useMatchBoard(seasonId: string | null | undefined, matchId: string | null | undefined, upcoming: boolean, enabled: boolean): string | null {
  const on = enabled && !!seasonId && seasonId !== "all" && !!matchId;
  const own = useLiveDoc(on ? `lineupOfficials/${officialScopeId(seasonId!, matchId!)}` : null, "lineupId", lock, null);
  const season = useLiveDoc(on && upcoming ? `lineupOfficials/${officialScopeId(seasonId!, null)}` : null, "lineupId", lock, null);
  return on ? boardForMatch(own.data, season.data, upcoming) : null;
}
