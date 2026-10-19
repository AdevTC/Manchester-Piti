// «Lo anota Jorge desde la mesa»: who keeps la mesa of a match, public (`matches/{id}.mesa`), written by
// the backend when the clock starts (liveClock.ts, whoever starts it) or a scorer is assigned
// (setMatchScorers, the first one). Only a name: a uid is no name for a fan, and the members' data
// (teamMembers, users) stays private. Pure: apart so the app's tests can run it.

export const MESA_NAME_MAX = 40;

/** `matches/{id}.mesa`. */
export interface MatchMesa {
  /** The member's nickname (else his ficha's name). */
  name: string;
  /** Since when (ms): the clock's start, or the assignment. */
  since: number;
}

/** The name la mesa shows for a member: his nickname, else the name of his ficha; null with neither. */
export function mesaName(nickname: unknown, playerName: unknown): string | null {
  for (const v of [nickname, playerName]) {
    if (typeof v !== "string") continue;
    const clean = v.replace(/\s+/g, " ").trim();
    if (clean) return clean.slice(0, MESA_NAME_MAX);
  }
  return null;
}

/** The stamp to write (null: leave the stored one). The same name keeps its `since`. */
export function nextMesa(stored: unknown, name: string | null, now: number): MatchMesa | null {
  if (!name) return null;
  const old = parseMesa(stored);
  if (old && old.name === name) return null;
  return { name, since: now };
}

/** A stored stamp read back (null when missing or malformed). */
export function parseMesa(v: unknown): MatchMesa | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.name !== "string" || !o.name.trim() || typeof o.since !== "number" || !Number.isFinite(o.since)) return null;
  return { name: o.name.trim().slice(0, MESA_NAME_MAX), since: o.since };
}
