// What the club page shows before (or without) its Firestore document.
import type { VenueDetail } from "./derived/venue";
export interface ClubContent {
  intro: string;
  story: string;
  location: string;
  founded: string;
  venue: string;
  email: string;
  instagram: string;
  /** The club's YouTube channel (Club's head, Inicio's «Síguenos»). */
  youtube: string;
  photoUrl: string;
  milestones: { year: string; title: string; text: string }[];
  /** r12 M-45: `featured` (one in Inicio) and its dates (YYYY-MM-DD), optional; the order is the list's. */
  sponsors: { name: string; url: string; logo: string; featured?: boolean; from?: string; to?: string }[];
  gallery: { url: string; caption: string }[];
  /** Preguntas de vestuario (El club). */
  faq: { q: string; a: string }[];
  /** La historia del escudo (El club, bajo la vitrina). */
  crestStory: string;
  /** Los campos: dirección y cómo llegar a cada uno (≤ 20; derived/venue venueInfo los casa con un partido). */
  venues: VenueDetail[];
  /** r12 M-19: the kits (absent: the ones in the web's code). Read with schemas.ts clubKitsSchema. */
  kits?: { home?: ClubKit; away?: ClubKit };
  /** r12 M-19: trophies won outside the league (absent: none). Read with schemas.ts clubTrophiesSchema. */
  trophies?: ClubTrophy[];
  /** r12 M-45: the club's networks (absent: instagram / youtube). Read with schemas.ts clubSocialsSchema. */
  socials?: ClubSocial[];
}
export interface ClubKit {
  name?: string;
  note: string;
  colors: { name: string; hex: string }[];
}
export interface ClubTrophy {
  name: string;
  /** "YYYY-MM-DD" or "YYYY". */
  date: string;
  photoUrl?: string;
  note?: string;
}
export const SOCIAL_NETS = ["instagram", "youtube", "tiktok", "whatsapp", "x", "facebook", "twitch", "web"] as const;
export interface ClubSocial {
  net: (typeof SOCIAL_NETS)[number];
  url: string;
}
export const DEFAULT_CONTENT: ClubContent = {
  intro: "Resultados, calendario y estadísticas del Manchester Piti.",
  story:
    "Manchester Piti es un equipo amateur de fútbol 7. Aquí puedes consultar nuestra plantilla, los partidos y las estadísticas de cada temporada.",
  location: "",
  founded: "",
  venue: "",
  email: "",
  instagram: "https://www.instagram.com/manchesterpiti.__/",
  youtube: "https://www.youtube.com/@ManchesterPitiFC2026",
  photoUrl: "",
  milestones: [],
  sponsors: [],
  gallery: [],
  faq: [
    { q: "¿Cómo me apunto?", a: "Escríbenos desde «Un lugar en el equipo», en los clasificados de esta página: te contamos cuándo jugamos y te venimos a conocer." },
    { q: "¿Dónde y cuándo jugamos?", a: "Los partidos, con fecha, hora y campo, están en Partidos; suscríbete al calendario y te llegan solos." },
    { q: "¿Puedo venir a vernos?", a: "Claro. La grada es libre y el ánimo se agradece: el próximo partido está en esta misma página." },
  ],
  crestStory: "",
  venues: [],
};
