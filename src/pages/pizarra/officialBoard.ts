// Which board a link to «the pizarra of this match» opens, from the official's scope docs
// (`lineupOfficials/{seasonId}__{matchId}` and `{seasonId}__temporada`, written with the official in one
// transaction by useLineups.publishOfficial): a few tiny docs instead of the season's boards. Pure and
// light, for the match page and the Sala de control. (The pizarra itself keeps boards.ts officialFor.)

/** The doc that holds an official's scope (a match, or the season): one board per scope. */
export const officialScopeId = (seasonId: string, matchId: string | null): string => `${seasonId}__${matchId ?? "temporada"}`;

/** The board a scope doc names (null when there is no doc or it names none). */
export const lockedBoard = (d: { lineupId?: unknown } | undefined | null): string | null => (typeof d?.lineupId === "string" && d.lineupId ? d.lineupId : null);

/**
 * The board for a match: its own official; the season's official only while the match is still to be
 * played (a played or live match without its own board has none: the season's plan wasn't its seven).
 */
export function boardForMatch(own: string | null, season: string | null, upcoming: boolean): string | null {
  return own ?? (upcoming ? season : null);
}

/** One season's scope docs, read whole (the Sala de control): scope doc id → the board it names. */
export type OfficialLocks = ReadonlyMap<string, string>;

/** boardForMatch over a season's scope docs (null for a match of another season: its docs weren't read). */
export function boardFromLocks(locks: OfficialLocks, seasonId: string, match: { id: string; seasonId?: string }, upcoming: boolean): string | null {
  if (!seasonId || match.seasonId !== seasonId) return null;
  return boardForMatch(locks.get(officialScopeId(seasonId, match.id)) ?? null, locks.get(officialScopeId(seasonId, null)) ?? null, upcoming);
}

/** A `lineupOfficials` doc as the Sala de control keeps it (null when it names no board). */
export function mapOfficialLock(id: string, data: unknown): { id: string; lineupId: string } | null {
  const lineupId = lockedBoard(typeof data === "object" && data !== null ? (data as { lineupId?: unknown }) : null);
  return lineupId ? { id, lineupId } : null;
}
