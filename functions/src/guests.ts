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

/** A name function that names this match's guests «Rafa (invitado)» and everyone else with `nameOf`
 *  (no match at hand: a guest is «Invitado», never a member's fallback). */
export function withGuestNames(match: { guests?: MatchGuest[] } | null | undefined, nameOf: (id: string) => string): (id: string) => string {
  return (id) => (isGuestId(id) ? guestLabel(match ?? {}, id) : nameOf(id));
}

/** What an event may name: who acts, who assists, who comes in, who receives the pass. */
export interface GuestRefEvent {
  playerId?: string | null;
  assistPlayerId?: string | null;
  inPlayerId?: string | null;
  receiverId?: string | null;
}

/** The guest ids («g1»…) these events name, in any player field. */
export function guestIdsInEvents(events: readonly GuestRefEvent[] | null | undefined): Set<string> {
  const out = new Set<string>();
  for (const e of events ?? [])
    for (const ref of [e.playerId, e.assistPlayerId, e.inPlayerId, e.receiverId])
      if (isGuestId(ref)) out.add(ref!.slice(GUEST_PREFIX.length));
  return out;
}

/**
 * Why this guest list can't replace the match's (null = it can): every guest an event of the match (the
 * published one or its draft) names stays on the list, so a removed guest's id is never handed to someone
 * else while his plays are still there.
 */
export function guestRemovalProblem(
  before: readonly MatchGuest[],
  next: readonly MatchGuest[],
  ...eventLists: (readonly GuestRefEvent[] | null | undefined)[]
): string | null {
  const kept = new Set(next.map((g) => g.id));
  for (const events of eventLists)
    for (const id of guestIdsInEvents(events))
      if (!kept.has(id)) {
        const name = before.find((g) => g.id === id)?.name;
        return `${name ?? "Ese invitado"} sale en el acta: quita antes sus jugadas.`;
      }
  return null;
}

/**
 * Why a match's guest references are not valid (null = they are): the list itself (guestsProblem), every
 * `guest:` id in the lineup and the events on that list, and no guest «no convocado». The acta's engine
 * and saveMatchSheet (drafts too) say the same.
 */
export function guestRefsProblem(match: {
  guests?: MatchGuest[];
  starters?: readonly string[];
  bench?: readonly string[];
  notCalled?: readonly string[];
  events?: readonly GuestRefEvent[];
}): string | null {
  const list = guestsProblem(match.guests);
  if (list) return list;
  const lineup = [...(match.starters ?? []), ...(match.bench ?? []), ...(match.notCalled ?? [])];
  const refs = [...lineup, ...(match.events ?? []).flatMap((e) => [e.playerId, e.assistPlayerId, e.inPlayerId, e.receiverId])];
  if (refs.some((id) => isUnknownGuest(match, id))) return "Hay un invitado que no está en la lista de invitados del partido.";
  if ((match.notCalled ?? []).some(isGuestId)) return "Un invitado va de titular o en el banquillo.";
  return null;
}
