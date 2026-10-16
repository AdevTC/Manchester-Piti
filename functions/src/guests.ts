// Invitados en el acta: a friend who fills a gap for one match. A match carries up to four named guests
// (`guests: [{ id: "g1"…"g4", name }]`) and every player field (starters, bench, scorer, assist, sub in,
// the minutes ledger) refers to one as `guest:g1`. A guest's goal counts for the team; no member's
// numbers ever count a guest. Shared by the functions and the web (src/lib/derived/guests.ts re-exports it).

export interface MatchGuest {
  /** "g1".."g4". */
  id: string;
  /** 1–30 characters. */
  name: string;
}

export const GUEST_PREFIX = "guest:";
export const MAX_GUESTS = 4;
export const GUEST_NAME_MAX = 30;
/** A guest's own id inside `match.guests`. */
export const GUEST_ID_RE = /^g[1-4]$/;

/** The reference a player field holds for a guest: guestRef("g1") → "guest:g1". */
export function guestRef(id: string): string {
  return `${GUEST_PREFIX}${id}`;
}

/** Whether a player id is a guest reference ("guest:…"). */
export function isGuestId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith(GUEST_PREFIX);
}

/** The guest a `guest:` reference points to in this match, or null (not a guest ref, or not in the match). */
export function guestOf(match: { guests?: MatchGuest[] }, ref: string): MatchGuest | null {
  if (!isGuestId(ref)) return null;
  const id = ref.slice(GUEST_PREFIX.length);
  return match.guests?.find((g) => g.id === id) ?? null;
}

/** How a guest is named: «Rafa (invitado)»; «Invitado» when the reference isn't in the match. */
export function guestLabel(match: { guests?: MatchGuest[] }, ref: string): string {
  const g = guestOf(match, ref);
  return g ? `${g.name} (invitado)` : "Invitado";
}
