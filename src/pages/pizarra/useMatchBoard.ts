// «La pizarra de este partido»: the board a member's link opens, read from the official's scope docs
// (`lineupOfficials/{season}__{match}`, and `{season}__temporada` only while the match is still to be
// played) — two tiny docs, not the season's boards. Team-member reads (firestore.rules): a fan passes
// `enabled` false and nothing is read. Realtime and shared (useLiveDoc: one listener per doc).
import type { DocumentData } from "firebase/firestore";
import { useLiveDoc } from "../vestuario/live";
import { boardCodeByPlayer, boardSystem } from "../../../functions/src/boardCodes";
import type { PosCode } from "../../lib/positions";
import { boardForMatch, boardSeven, lockedBoard, officialScopeId } from "./officialBoard";
import { parseRival, type RivalSeven } from "./v2/rival";

const lock = (d: { lineupId?: unknown } | undefined) => lockedBoard(d);

/** What the match page reads of the official board: its seven, its system («libre» or a SYSTEM_IDS id),
 *  each player's slot code, the match it was drawn for (null: the season's) and its rival seven with the
 *  notes the RivalPanel keeps on each of them (null when the board has none). */
export interface BoardView {
  seven: string[];
  system: string;
  codes: Record<string, PosCode>;
  matchId: string | null;
  rival: RivalSeven | null;
}

/** One projection of the whole `lineups/{id}` doc (useLiveDoc: one mapping per path). */
export function boardViewOfDoc(d: DocumentData | undefined): BoardView | null {
  if (!d) return null;
  const board = { formation: d.formation, freeMode: d.freeMode, slots: Array.isArray(d.slots) ? d.slots : [] };
  return {
    seven: boardSeven(d.slots),
    system: boardSystem(board),
    codes: boardCodeByPlayer(board),
    matchId: typeof d.matchId === "string" && d.matchId ? d.matchId : null,
    rival: parseRival(d.rival) ?? null,
  };
}

/**
 * The official board of a match (from useMatchBoard): one shared listener on its doc, only while there
 * is a board (team-member reads: a fan passes null and nothing is read). Null = no board, not read yet,
 * or gone.
 */
export function useBoardView(boardId: string | null): BoardView | null {
  const live = useLiveDoc(boardId ? `lineups/${boardId}` : null, "view", boardViewOfDoc, null);
  return boardId ? live.data : null;
}

/** The seven of that board (useBoardView). */
export function useBoardSeven(boardId: string | null): string[] | null {
  return useBoardView(boardId)?.seven ?? null;
}

export function useMatchBoard(seasonId: string | null | undefined, matchId: string | null | undefined, upcoming: boolean, enabled: boolean): string | null {
  const on = enabled && !!seasonId && seasonId !== "all" && !!matchId;
  const own = useLiveDoc(on ? `lineupOfficials/${officialScopeId(seasonId!, matchId!)}` : null, "lineupId", lock, null);
  const season = useLiveDoc(on && upcoming ? `lineupOfficials/${officialScopeId(seasonId!, null)}` : null, "lineupId", lock, null);
  return on ? boardForMatch(own.data, season.data, upcoming) : null;
}
