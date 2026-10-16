// Invitados en el acta, the admin's half (pure, tested in guests.test.ts): «Añadir invitado» in the acta
// and in Convocar. A guest is `{ id: "g1"…"g4", name }` in `match.guests` and `guest:g1` in every player
// field; adding one puts him on the banquillo (so the pickers, live and in the acta, offer him at once);
// he can be removed while no event names him, and removing him takes him out of the convocatoria too.
import type { MatchEvent } from "../../../../functions/src/matchEngine";
import { GUEST_NAME_MAX, MAX_GUESTS, guestRef, isGuestId, guestOf, type MatchGuest } from "../../../lib/derived/guests";

export type { MatchGuest };

/** What carries guests and a convocatoria: a match, the acta's sheet, Convocar's lineup. */
export interface WithGuests {
  guests?: MatchGuest[];
  starters: string[];
  bench: string[];
}

export type GuestAdd<T> = { ok: true; value: T; guest: MatchGuest } | { ok: false; error: string };
export type GuestRemove<T> = { ok: true; value: T } | { ok: false; error: string };

/** The guests of anything that may have them. */
export const guestsOf = (x: { guests?: MatchGuest[] } | null | undefined): MatchGuest[] => x?.guests ?? [];

/** The first free id, «g1»…«g4» (null: there are already four) — never one an event still names
 *  (`events`): his plays would pass to the new guest. */
export function nextGuestId(guests: readonly MatchGuest[], events?: readonly MatchEvent[]): string | null {
  for (let i = 1; i <= MAX_GUESTS; i++) {
    const id = `g${i}`;
    if (!guests.some((g) => g.id === id) && !guestInUse(events, id)) return id;
  }
  return null;
}

/** Why a name can't be a guest's (empty, too long, already there), or "" when it can. */
export function guestNameProblem(guests: readonly MatchGuest[], raw: string): string {
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) return "Escribe el nombre del invitado.";
  if (name.length > GUEST_NAME_MAX) return `El nombre del invitado va hasta ${GUEST_NAME_MAX} letras.`;
  if (guests.some((g) => g.name.toLocaleLowerCase("es") === name.toLocaleLowerCase("es"))) return `Ya hay un invitado que se llama ${name}.`;
  return "";
}

/** «Añadir invitado»: a new guest, on the banquillo. Up to four per match. */
export function addGuest<T extends WithGuests & { events?: MatchEvent[] }>(x: T, raw: string): GuestAdd<T> {
  const guests = guestsOf(x);
  const id = nextGuestId(guests, x.events);
  if (!id) return { ok: false, error: `Ya hay ${MAX_GUESTS} invitados: es el máximo por partido.` };
  const problem = guestNameProblem(guests, raw);
  if (problem) return { ok: false, error: problem };
  const guest = { id, name: raw.trim().replace(/\s+/g, " ") };
  return { ok: true, guest, value: { ...x, guests: [...guests, guest], bench: [...x.bench, guestRef(id)] } };
}

/** Whether any event names this guest (scorer, assist, who comes in, who receives a pass, a card…). */
export function guestInUse(events: readonly MatchEvent[] | undefined, id: string): boolean {
  const ref = guestRef(id);
  return (events ?? []).some((e) => e.playerId === ref || e.assistPlayerId === ref || e.inPlayerId === ref || e.receiverId === ref);
}

/** Takes a guest away (and out of the convocatoria), unless an event still names him. */
export function removeGuest<T extends WithGuests & { events?: MatchEvent[]; notCalled?: string[] }>(x: T, id: string): GuestRemove<T> {
  const guest = guestsOf(x).find((g) => g.id === id);
  if (!guest) return { ok: true, value: x };
  if (guestInUse(x.events, id)) return { ok: false, error: `${guest.name} sale en el acta: quita antes sus jugadas.` };
  const ref = guestRef(id);
  const out = (ids: string[]) => ids.filter((p) => p !== ref);
  return {
    ok: true,
    value: { ...x, guests: guestsOf(x).filter((g) => g.id !== id), starters: out(x.starters), bench: out(x.bench), ...(x.notCalled ? { notCalled: out(x.notCalled) } : {}) },
  };
}

/**
 * A convocatoria against its guests: references to a guest that is no longer there leave it, and each
 * guest that isn't in it yet goes to the banquillo (the acta's pickers offer him at once).
 */
export function lineupWithGuests<L extends { starters: string[]; bench: string[] }>(lineup: L, holder: { guests?: MatchGuest[] }): L {
  const known = (id: string) => !isGuestId(id) || !!guestOf(holder, id);
  const starters = lineup.starters.filter(known);
  const bench = lineup.bench.filter(known);
  const missing = guestsOf(holder).map((g) => guestRef(g.id)).filter((ref) => !starters.includes(ref) && !bench.includes(ref));
  return { ...lineup, starters, bench: [...bench, ...missing] };
}

/** Where a guest is in the convocatoria. */
export function guestSlot(lineup: { starters: readonly string[]; bench: readonly string[] }, id: string): "T" | "B" | null {
  const ref = guestRef(id);
  return lineup.starters.includes(ref) ? "T" : lineup.bench.includes(ref) ? "B" : null;
}
