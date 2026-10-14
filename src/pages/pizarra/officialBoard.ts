// Which board a link to «the pizarra of this match» opens, from the official's scope docs
// (`lineupOfficials/{seasonId}__{matchId}` and `{seasonId}__temporada`, written with the official in one
// transaction by useLineups.publishOfficial): a few tiny docs instead of the season's boards. Pure and
// light, for the match page and the Sala de control. (The pizarra itself keeps boards.ts officialFor.)
import { sevenOf, sieteKey } from "../../../functions/src/pushLogic";

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

// ── One «siete» (M6): the official board's seven and the match's convocatoria ──

/** The seven a board doc puts on the pitch, in slot order (the push's own reading: pushLogic sevenOf). */
export const boardSeven = (slots: unknown): string[] => sevenOf(slots);

/** Same players in both sevens (order aside). */
export const sameSeven = (a: readonly string[], b: readonly string[]): boolean => sieteKey(a) === sieteKey(b);

/** The official's seven against the convocatoria's titulares: «coincide», «otro», or null (no seven on the board). */
export type SevenAgreement = "coincide" | "otro";
export function sevenAgreement(board: readonly string[] | null | undefined, starters: readonly string[]): SevenAgreement | null {
  if (!board?.length) return null;
  return sameSeven(board, starters) ? "coincide" : "otro";
}

/** Who the convocatoria has in the siete and the board doesn't (`conv`), and the other way round (`board`). */
export function sevenDiffs(starters: readonly string[], board: readonly string[]): { conv: string[]; board: string[] } {
  return { conv: starters.filter((id) => !board.includes(id)), board: board.filter((id) => !starters.includes(id)) };
}

/**
 * The convocatoria with the board's seven (publishing the official with «Usar este siete como
 * convocatoria», or Convocar's «Copiar el de la pizarra»): its titulares are the seven; the banquillo keeps
 * its order without them, and whoever leaves the siete stays called, on the banquillo. Nobody the
 * convocatoria leaves out («no convocado») is called unless the board puts him in the seven. A match
 * with no convocatoria yet takes the board's bench — `offPitch`: the squad off the pitch that can play (no
 * bajas), as the pizarra's «Banquillo» shows it. Null when the convocatoria already has this seven.
 */
export function convocatoriaWithSeven(
  conv: { starters: readonly string[]; bench: readonly string[] } | undefined,
  seven: readonly (string | null)[],
  offPitch: readonly string[] = [],
): { starters: string[]; bench: string[] } | null {
  if (!conv) return null;
  const s = [...new Set(seven.filter((id): id is string => !!id))];
  if (sameSeven(s, conv.starters)) return null;
  const out = (id: string) => !s.includes(id);
  if (!conv.starters.length && !conv.bench.length) return { starters: s, bench: [...new Set(offPitch)].filter(out) };
  return { starters: s, bench: [...conv.bench.filter(out), ...conv.starters.filter((id) => out(id) && !conv.bench.includes(id))] };
}

/** A `lineupOfficials` doc as the Sala de control keeps it (null when it names no board). */
export function mapOfficialLock(id: string, data: unknown): { id: string; lineupId: string } | null {
  const lineupId = lockedBoard(typeof data === "object" && data !== null ? (data as { lineupId?: unknown }) : null);
  return lineupId ? { id, lineupId } : null;
}
