// Getting to the match: the «Cómo llegar» map link to a ground, the kit a match is played in and this
// site's origin for calendar feeds and shared links. One copy for Partidos, the match page and the club
// page (they each had their own).
import type { ClubMatch } from "../clubData";
import { venueCore } from "../../../functions/src/weatherLogic";

const KEEP_CAPS = /^(cdm|cdf|cf|fc|cd|ud|sd|ad|ce|ef|f\.c\.|c\.f\.|c\.d\.m\.)$/i;
const SMALL = /^(de|del|la|las|los|el|y|e)$/i;
/** A ground's name as people write it, the one formatter for every place a venue is printed: «CDM
 *  PALOMERAS» → «CDM Palomeras», «CAMPO DE LA ELIPA» → «Campo de la Elipa» (acronyms and words without a
 *  vowel keep their capitals; a name not written all in capitals is left as it is). */
export function venueName(v: string): string {
  const s = v.trim();
  if (!s || s !== s.toLocaleUpperCase("es")) return s;
  let first = true;
  return s
    .split(/(\s+)/)
    .map((w) => {
      if (/^\s+$/.test(w)) return w;
      const lead = first;
      first = false;
      if (KEEP_CAPS.test(w) || !/[AEIOUÁÉÍÓÚ]/i.test(w)) return w;
      if (!lead && SMALL.test(w)) return w.toLocaleLowerCase("es");
      return w.charAt(0) + w.slice(1).toLocaleLowerCase("es");
    })
    .join("");
}

/** The kits by name, as every page says them. */
export const KIT_LABEL = { home: "1ª equipación", away: "2ª equipación" } as const;

/** A Google Maps search for the venue (the «Cómo llegar» link). */
export const mapsUrl = (venue: string): string => "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(venue);

/** The match's kit by name; `fallback` when it names none (Partidos shows nothing, the match page the first kit). */
export const kitLabel = (m: Pick<ClubMatch, "kit">, fallback = ""): string => (m.kit === "away" ? KIT_LABEL.away : m.kit === "home" ? KIT_LABEL.home : fallback);

// ── The grounds' details (clubContent.venues, kept by the captains in El club) ──

/** One ground's details: its name as the matches write it, and how to get there. */
export interface VenueDetail {
  name: string;
  address?: string;
  /** «Metro, línea 1, 8 min a pie». */
  transit?: string;
  /** What to search on the map (else the address, else the name). */
  mapsQuery?: string;
}
/** The caps (the same as firestore.rules clubContent venuesOk). */
export const VENUE_LIMITS = { max: 10, name: 80, address: 120, transit: 120, mapsQuery: 160 } as const;

/** How two grounds' names compare: no accents, lower case, single spaces, without «CDM» / «Campo de»…, and
 *  only the name part of a match's venue (before « · », where the address goes). */
export function venueKey(venue: unknown): string {
  if (typeof venue !== "string") return "";
  return venueCore(venue.split(" · ")[0])
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** The club's details for a match's venue (null when the captains haven't written that ground). */
export function venueInfo(venue: unknown, venues: readonly VenueDetail[] | null | undefined): VenueDetail | null {
  const key = venueKey(venue);
  if (!key) return null;
  return (venues ?? []).find((v) => venueKey(v.name) === key) ?? null;
}

/** clubContent.venues read defensively: valid entries only, trimmed, at most VENUE_LIMITS.max. */
export function parseVenues(v: unknown): VenueDetail[] {
  if (!Array.isArray(v)) return [];
  const out: VenueDetail[] = [];
  const str = (x: unknown, max: number) => (typeof x === "string" && x.trim() ? x.trim().slice(0, max) : undefined);
  for (const raw of v) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const name = str(o.name, VENUE_LIMITS.name);
    if (!name) continue;
    const address = str(o.address, VENUE_LIMITS.address);
    const transit = str(o.transit, VENUE_LIMITS.transit);
    const mapsQuery = str(o.mapsQuery, VENUE_LIMITS.mapsQuery);
    out.push({ name, ...(address ? { address } : {}), ...(transit ? { transit } : {}), ...(mapsQuery ? { mapsQuery } : {}) });
    if (out.length >= VENUE_LIMITS.max) break;
  }
  return out;
}

/** The «Cómo llegar» link for a ground with details (its map query, else its address, else its name). */
export const venueMapsUrl = (d: VenueDetail): string => mapsUrl(d.mapsQuery || (d.address ? `${d.name}, ${d.address}` : d.name));

/** This site's origin («https://…»); empty while server-rendering, where there is no location. */
export const siteOrigin = (): string => (typeof location === "undefined" ? "" : location.origin);
