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

/** Why a match's guest list is not valid (null = it is): at most four, ids g1–g4 once each, names 1–30. */
export function guestsProblem(guests: readonly MatchGuest[] | undefined): string | null {
  if (!guests) return null;
  if (guests.length > MAX_GUESTS) return `Como mucho ${MAX_GUESTS} invitados por partido.`;
  const ids = new Set<string>();
  for (const g of guests) {
    if (!GUEST_ID_RE.test(g.id) || ids.has(g.id)) return "Cada invitado necesita su propia referencia (g1–g4).";
    ids.add(g.id);
    const name = g.name.trim();
    if (!name || name.length > GUEST_NAME_MAX) return `El nombre del invitado debe tener entre 1 y ${GUEST_NAME_MAX} caracteres.`;
  }
  return null;
}

/** Whether `ref` names a guest that is not in this match's list. */
export function isUnknownGuest(match: { guests?: MatchGuest[] }, ref: string | null | undefined): boolean {
  return isGuestId(ref) && !guestOf(match, ref!);
}

/** The member ids among these (drops every `guest:` reference). */
export function memberIds<T extends string>(ids: readonly T[]): T[] {
  return ids.filter((id) => !isGuestId(id));
}

/** A per-player record without its guest rows (a ledger, a tally…). */
export function withoutGuests<V>(rows: Record<string, V>): Record<string, V> {
  return Object.fromEntries(Object.entries(rows).filter(([id]) => !isGuestId(id)));
}

/** A name function that names this match's guests «Rafa (invitado)» and everyone else with `nameOf`. */
export function withGuestNames(match: { guests?: MatchGuest[] }, nameOf: (id: string) => string): (id: string) => string {
  return (id) => (isGuestId(id) ? guestLabel(match, id) : nameOf(id));
}
