// Getting to the match: the «Cómo llegar» map link to a ground, the kit a match is played in and this
// site's origin for calendar feeds and shared links. One copy for Partidos, the match page and the club
// page (they each had their own).
import type { ClubMatch } from "../clubData";

/** The kits by name, as every page says them. */
export const KIT_LABEL = { home: "1ª equipación", away: "2ª equipación" } as const;

/** A Google Maps search for the venue (the «Cómo llegar» link). */
export const mapsUrl = (venue: string): string => "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(venue);

/** The match's kit by name; `fallback` when it names none (Partidos shows nothing, the match page the first kit). */
export const kitLabel = (m: Pick<ClubMatch, "kit">, fallback = ""): string => (m.kit === "away" ? KIT_LABEL.away : m.kit === "home" ? KIT_LABEL.home : fallback);

/** This site's origin («https://…»); empty while server-rendering, where there is no location. */
export const siteOrigin = (): string => (typeof location === "undefined" ? "" : location.origin);
