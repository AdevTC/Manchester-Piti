// The one convocatoria, client side (pure, tested in lineup.test.ts): el siete + banquillo of a match as
// Hoy (the peg wall) and Convocar show and change it, the members' answers (RSVP) per player, and whether
// the convocatoria has been announced. Writes go through useConvocatoria (setConvocatoria callable).
import type { ClubMatch } from "../../../lib/clubData";

export interface Lineup {
  starters: string[];
  bench: string[];
}
export const SEVEN = 7;
export const lineupOf = (m: Pick<ClubMatch, "starters" | "bench"> | null | undefined): Lineup => ({ starters: [...(m?.starters ?? [])], bench: [...(m?.bench ?? [])] });
export const sameLineup = (a: Lineup, b: Lineup) => a.starters.join() === b.starters.join() && a.bench.join() === b.bench.join();

export type Slot = "T" | "B";
export type PlaceResult = { ok: true; lineup: Lineup } | { ok: false; reason: "full" };
/**
 * Puts a player in el siete (T) or the banquillo (B) — or, if he is already there, takes him out (the
 * prototype's toggle). El siete takes at most seven: an eighth is refused («Ya hay siete»). A new titular
 * goes to the first free peg (the end of the list).
 */
export function place(l: Lineup, id: string, slot: Slot): PlaceResult {
  const inT = l.starters.includes(id);
  const inB = l.bench.includes(id);
  const starters = l.starters.filter((x) => x !== id);
  const bench = l.bench.filter((x) => x !== id);
  if (slot === "T") {
    if (inT) return { ok: true, lineup: { starters, bench } };
    if (l.starters.length >= SEVEN) return { ok: false, reason: "full" };
    return { ok: true, lineup: { starters: [...starters, id], bench } };
  }
  if (inB) return { ok: true, lineup: { starters, bench } };
  return { ok: true, lineup: { starters, bench: [...bench, id] } };
}

export type Rsvp = "si" | "duda" | "no" | "sin";
export const RSVP_LABEL: Record<Rsvp, string> = { si: "Viene", duda: "Duda", no: "No viene", sin: "Sin responder" };
/** Each roster player's answer for the match (members linked to a player; the rest don't hang on a peg). */
export function rsvpOf(answers: readonly { response: "yes" | "no" | "maybe"; playerId: string | null }[], roster: readonly string[]): Map<string, Rsvp> {
  const by = new Map<string, Rsvp>();
  for (const a of answers) if (a.playerId) by.set(a.playerId, a.response === "yes" ? "si" : a.response === "maybe" ? "duda" : "no");
  return new Map(roster.map((id) => [id, by.get(id) ?? "sin"]));
}
/** The roster grouped by answer, roster order kept. */
export function rsvpGroups(roster: readonly string[], rsvp: ReadonlyMap<string, Rsvp>): Record<Rsvp, string[]> {
  const g: Record<Rsvp, string[]> = { si: [], duda: [], no: [], sin: [] };
  for (const id of roster) g[rsvp.get(id) ?? "sin"].push(id);
  return g;
}

export interface ConvocatoriaStatus {
  /** «Convocar y avisar» has gone at least once. */
  notified: boolean;
  /** Announced and unchanged since: nothing to do. */
  published: boolean;
  /** Announced, then changed: it asks to announce again. */
  changed: boolean;
}
export function convocatoriaStatus(m: Pick<ClubMatch, "convocatoriaAt" | "convocatoriaNotifiedAt"> | null | undefined): ConvocatoriaStatus {
  const sent = m?.convocatoriaNotifiedAt;
  const notified = typeof sent === "number";
  const changed = notified && (m?.convocatoriaAt ?? 0) > (sent ?? 0);
  return { notified, published: notified && !changed, changed };
}

const andList = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);
/**
 * The line that says where el siete stands: «Falta 1 para el siete · ALMACHI, ANDIA en duda»,
 * «Listo: avisa por push a los 9 convocados», «Publicada · los 9 convocados tienen el aviso».
 */
export function sevenWhy(l: Lineup, status: ConvocatoriaStatus, dudaNames: string[]): string {
  const missing = SEVEN - l.starters.length;
  const called = l.starters.length + l.bench.length;
  if (missing > 0) return `Falta ${missing} para el siete${dudaNames.length ? ` · ${dudaNames.join(", ")} en duda` : ""}`;
  if (status.published) return `Publicada · los ${called} convocados tienen el aviso`;
  if (status.changed) return `Ha cambiado: vuelve a avisar a los ${called} convocados`;
  return `Listo: avisa por push a los ${called} convocados`;
}
export { andList as joinNames };
