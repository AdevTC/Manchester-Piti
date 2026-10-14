// «La pizarra de este partido»: the board a member's link opens, read from the official's scope docs
// (`lineupOfficials/{season}__{match}`, and `{season}__temporada` only while the match is still to be
// played) — two tiny docs, not the season's boards. Team-member reads (firestore.rules): a fan passes
// `enabled` false and nothing is read. Realtime and shared (useLiveDoc: one listener per doc).
import { useLiveDoc } from "../vestuario/live";
import { boardForMatch, lockedBoard, officialScopeId } from "./officialBoard";

const lock = (d: { lineupId?: unknown } | undefined) => lockedBoard(d);

export function useMatchBoard(seasonId: string | null | undefined, matchId: string | null | undefined, upcoming: boolean, enabled: boolean): string | null {
  const on = enabled && !!seasonId && seasonId !== "all" && !!matchId;
  const own = useLiveDoc(on ? `lineupOfficials/${officialScopeId(seasonId!, matchId!)}` : null, "lineupId", lock, null);
  const season = useLiveDoc(on && upcoming ? `lineupOfficials/${officialScopeId(seasonId!, null)}` : null, "lineupId", lock, null);
  return on ? boardForMatch(own.data, season.data, upcoming) : null;
}
