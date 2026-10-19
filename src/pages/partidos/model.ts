// Partidos, the small shared words: a venue as people write it, the place line, and whether a member is called
// (Socio.tsx). The rest of the page's pure part lives in vidrio/model.ts.
import type { ClubMatch } from "../../lib/clubData";

/** A venue as people write it: «CDM PALOMERAS» → «CDM Palomeras» (only an all-caps one is touched). */
export function venueName(v: string): string {
  if (!v || v !== v.toUpperCase()) return v;
  return v
    .split(/\s+/)
    .map((w) => (w.length <= 3 && /^[A-ZÁÉÍÓÚÑ]+$/.test(w) && w !== "DE" && w !== "LA" ? w : w.charAt(0) + w.slice(1).toLowerCase()))
    .join(" ");
}

/** «En casa, Palomeras» / «Fuera, en Moratalaz» (the venue without its «CDM» / «Campo de»). */
export function placeLabel(m: Pick<ClubMatch, "home" | "venue">): string {
  const v = (m.venue ?? "").replace(/^(CDM|Polideportivo|Campo de|Campo)\s+/i, "").trim();
  const nice = venueName(v);
  if (m.home === false) return nice ? `Fuera, en ${nice}` : "Fuera";
  return nice ? `En casa, ${nice}` : "En casa";
}

/** Whether a member's player is in a match's published convocatoria. */
export const isCalled = (m: Pick<ClubMatch, "starters" | "bench">, playerId: string | null): boolean => !!playerId && (!!m.starters?.includes(playerId) || !!m.bench?.includes(playerId));
