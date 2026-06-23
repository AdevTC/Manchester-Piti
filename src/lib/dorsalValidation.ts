// Pure dorsal-uniqueness logic for the Admin player form. No React, no
// Firestore — unit-testable. The per-season semantics mirror EXACTLY the
// imperative check that used to live in Admin.onPlayerSubmit:
//   - a player being edited is excluded (editingPlayerId),
//   - the "other" player's number for a season is `seasonDetails[seasonId]?.number ?? p.number`,
//   - a collision is per-season (same number, same season, different player).
// This is field-level validation over the in-memory roster (already in the
// React Query cache), so it runs synchronously / instantly — no network call.

/** Minimal shape of a roster player needed to detect a dorsal collision. */
export interface RosterPlayerLike {
  id: string;
  number: number;
  seasons?: string[];
  seasonDetails?: Record<string, { number: number }>;
}

/**
 * Is `candidateNumber` already taken in `seasonId` by a DIFFERENT player?
 *
 * @param players          the live roster (shared React Query cache).
 * @param seasonId         the season to check the dorsal in.
 * @param candidateNumber  the dorsal the form wants to assign for that season.
 * @param editingPlayerId  id of the player being edited (excluded), or null on create.
 */
export function isDorsalTaken(
  players: RosterPlayerLike[],
  seasonId: string,
  candidateNumber: number,
  editingPlayerId: string | null,
): boolean {
  return players.some((p) => {
    if (editingPlayerId && p.id === editingPlayerId) return false;
    if (p.seasons?.includes(seasonId)) {
      const otherNumber = p.seasonDetails?.[seasonId]?.number ?? p.number;
      return otherNumber === candidateNumber;
    }
    return false;
  });
}

/**
 * Resolve the candidate dorsal for a season: the per-season override if set,
 * else the scalar default. Mirrors `parsedSeasonDetails[seasonId].number` in
 * Admin.onPlayerSubmit (so the inline check and the submit guard agree). Pure
 * function of its args — no closure over component state.
 *
 * @param seasonId  the season whose dorsal to resolve.
 * @param scalar    the scalar default dorsal (RHF `number`), or undefined.
 * @param details   per-season overrides; an entry's `number` may be "" (blank input).
 * @returns the resolved number, or NaN when neither an override nor a scalar exists.
 */
export function resolveDorsalForSeason(
  seasonId: string,
  scalar: number | undefined,
  details: Record<string, { number: number | "" }>,
): number {
  const override = details[seasonId]?.number;
  return override !== undefined && override !== "" ? Number(override) : (scalar ?? NaN);
}

/** A dorsal collision located in a specific season. */
export interface DorsalConflict {
  seasonId: string;
  number: number;
}

/**
 * Finds the FIRST per-season dorsal collision across the selected seasons, or
 * null if every selected season's dorsal is free. `dorsalForSeason` resolves
 * the candidate number for a season (per-season override falling back to the
 * scalar default), mirroring `parsedSeasonDetails[seasonId].number` in the form.
 * Returns the data needed to build the inline message; the caller maps the
 * seasonId to a season name to preserve the exact message text.
 */
export function findDorsalConflict(
  players: RosterPlayerLike[],
  selectedSeasonIds: string[],
  dorsalForSeason: (seasonId: string) => number,
  editingPlayerId: string | null,
): DorsalConflict | null {
  for (const seasonId of selectedSeasonIds) {
    const number = dorsalForSeason(seasonId);
    if (isDorsalTaken(players, seasonId, number, editingPlayerId)) {
      return { seasonId, number };
    }
  }
  return null;
}
