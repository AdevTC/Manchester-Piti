// Pure logic of the Celeste "El club" page (Design canvas "El club · elegida"): the history train,
// the squad in numbers, the classified ads (contact), the sponsors' wall and the map link. The
// trophy room reuses clubMedals (lib/home.ts).
import { ageOn } from "./clubAnalytics";
import { dateMillis, isCompleted, type ClubMatch } from "./clubData";
import type { ClubContent } from "./clubContentDefaults";

export const mapsUrl = (venue: string) => "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(venue);
export const mailto = (email: string, subject: string) => `mailto:${email}?subject=${encodeURIComponent(subject)}`;

export interface TrainStop {
  key: string;
  year: string;
  title: string;
  text: string;
  /** The automatic stop: the oldest finished match of the archive. */
  match?: ClubMatch;
}
/** The admin's moments (in their order) and, last, the first match of the archive. */
export function historyTrain(milestones: ClubContent["milestones"], matches: ClubMatch[]): TrainStop[] {
  const stops: TrainStop[] = (milestones ?? []).filter((m) => m && (m.title || m.year || m.text)).map((m, i) => ({ key: `m${i}`, year: m.year, title: m.title, text: m.text }));
  const oldest = matches.filter(isCompleted).sort((a, b) => dateMillis(a.date) - dateMillis(b.date))[0];
  if (oldest) stops.push({ key: "first", year: String(new Date(dateMillis(oldest.date)).getFullYear()), title: "El primer partido de nuestro archivo", text: "", match: oldest });
  return stops;
}

const ZONES = ["POR", "DEF", "MED", "DEL"] as const;
export interface SquadNumbersInput {
  id: string;
  naturalPosition?: string;
  birthDate?: string;
}
/** Size, players per line (unknown positions apart) and average age of a squad. */
export function squadNumbers(players: SquadNumbersInput[], today: Date) {
  const byZone = Object.fromEntries(ZONES.map((z) => [z, 0])) as Record<(typeof ZONES)[number], number>;
  let other = 0;
  for (const p of players) {
    const z = String(p.naturalPosition ?? "").toUpperCase() as (typeof ZONES)[number];
    if (ZONES.includes(z)) byZone[z]++;
    else other++;
  }
  const ages = players.map((p) => ageOn(p.birthDate, today)).filter((a): a is number => a !== null);
  return {
    size: players.length,
    byZone,
    other,
    averageAge: ages.length ? Math.round((ages.reduce((s, a) => s + a, 0) / ages.length) * 10) / 10 : null,
    agesKnown: ages.length,
  };
}

export interface Ad {
  id: "rival" | "player" | "patron";
  wanted: string;
  title: string;
  text: string;
  href?: string;
}
/** The three ways to get in touch, as classified ads; no email yet → no link. */
export function classifieds(email: string): Ad[] {
  const ads: Omit<Ad, "href">[] = [
    { id: "rival", wanted: "SE BUSCA RIVAL", title: "Un amistoso", text: "¿Buscáis rival? Nos vemos en el campo." },
    { id: "player", wanted: "SE BUSCA JUGADOR", title: "Un lugar en el equipo", text: "Si quieres jugar con nosotros, nos encantará conocerte." },
    { id: "patron", wanted: "SE BUSCAN MECENAS", title: "Juega de nuestro lado", text: "Colabora con el equipo y acompáñanos durante la temporada." },
  ];
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  return ads.map((a) => ({ ...a, ...(ok ? { href: mailto(email.trim(), a.title) } : {}) }));
}

/** Sponsors with a name, safe https links only. */
export function sponsorWall(sponsors: ClubContent["sponsors"]) {
  const https = (u: string) => (/^https:\/\//.test(u ?? "") ? u : undefined);
  return (sponsors ?? []).filter((s) => s && s.name).map((s) => ({ name: s.name, url: https(s.url), logo: https(s.logo) }));
}
