// Which board is the official for a match. Pure and light (no pizarra engine): the pizarra, the match
// page and the Sala de control read it the same way, so a link to «the pizarra of this match» opens the
// board the pizarra itself shows for it.

/** What the rule needs from a board: whether it is official, its alcance and when it changed. */
export interface OfficialRef {
  id: string;
  isOfficial: boolean;
  /** The match it is official for; null = the whole season. */
  matchId: string | null;
  updatedAt: number | null;
}

/** The official for a match: the one published for that match, else the one for the whole season. */
export function officialFor<T extends OfficialRef>(officials: readonly T[], matchId: string | null): T | null {
  const newest = (ds: T[]) => ds.slice().sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0] ?? null;
  return (matchId ? newest(officials.filter((d) => d.isOfficial && d.matchId === matchId)) : null) ?? newest(officials.filter((d) => d.isOfficial && !d.matchId));
}

const millis = (v: unknown): number | null => {
  if (typeof v === "number") return v;
  if (typeof v === "object" && v !== null && typeof (v as { toMillis?: unknown }).toMillis === "function") return (v as { toMillis: () => number }).toMillis();
  return null;
};

/** A raw `lineups` doc read as the rule needs it (the same normalisation as lineupDoc's dataToLineupDoc). */
export function officialRefOf(raw: { id: string } & Record<string, unknown>): OfficialRef {
  return {
    id: raw.id,
    isOfficial: raw.isOfficial === true,
    matchId: typeof raw.matchId === "string" && raw.matchId ? raw.matchId : null,
    updatedAt: millis(raw.updatedAt),
  };
}
