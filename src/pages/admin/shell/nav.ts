// TEMPORARY (r12): the old sections' names and router-free targets, kept for today's views (their «Por hacer»
// targets, the match workspace's tabs) and for Tú › Capitanía's links into the sala, until wave 2 replaces them.
// The sala's own places are places.ts. The paths are the OLD addresses on purpose (Tú › Capitanía, a public page, still
// links them and its tests pin them): the router redirects each one to its new address (lib/adminUrls).
import type { CounterKey } from "../data/adminLogic";

export type SectionKey = "hoy" | "partidos" | "convocar" | "plantilla" | "fichas" | "temporadas" | "capitanes" | "contenido" | "caja" | "clasificacion" | "turnos";
export interface SectionDef {
  key: SectionKey;
  name: string;
  /** Its old address (redirected; see above). */
  path: string;
  /** The line under its name (Capitanía, the palette). */
  blurb: string;
}
export const SECTIONS: readonly SectionDef[] = [
  { key: "hoy", name: "Hoy", path: "/admin", blurb: "El partido de hoy y lo que falta" },
  { key: "partidos", name: "Partidos", path: "/admin/partidos", blurb: "Calendario, actas y publicar" },
  { key: "convocar", name: "Convocar", path: "/admin/convocar", blurb: "El siete y el banquillo" },
  { key: "plantilla", name: "Plantilla", path: "/admin/plantilla", blurb: "La percha: jugadores y dorsales" },
  { key: "fichas", name: "Cuentas", path: "/admin/fichas", blurb: "Socios que piden su camiseta" },
  { key: "temporadas", name: "Temporadas", path: "/admin/temporadas", blurb: "Activa, en preparación o archivada" },
  { key: "capitanes", name: "Capitanes", path: "/admin/capitanes", blurb: "Quién lleva el brazalete" },
  { key: "contenido", name: "Contenido", path: "/admin/contenido", blurb: "El programa del club" },
  { key: "caja", name: "Caja", path: "/admin/caja", blurb: "Cuotas, campo y árbitro, y el bote" },
  { key: "clasificacion", name: "Clasificación", path: "/admin/clasificacion", blurb: "La tabla de la liga, pegada o a mano" },
  { key: "turnos", name: "Turnos", path: "/admin/turnos", blurb: "Quién lava, balones y coche" },
];
export const SECTION: Record<SectionKey, SectionDef> = Object.fromEntries(SECTIONS.map((s) => [s.key, s])) as Record<SectionKey, SectionDef>;

/** The match workspace's tabs (today's MatchEditor): each one a station now (lib/adminUrls). */
export type MatchTab = "encuentro" | "convocatoria" | "acta" | "publicar";
export const MATCH_TABS: readonly MatchTab[] = ["encuentro", "convocatoria", "acta", "publicar"];

/** A counter: only exceptions, its words for the accessible name («2 por hacer»). */
export interface Counter {
  n: number;
  /** «N por hacer»; empty when n is 0. */
  label: string;
}
export type Counters = Record<CounterKey, Counter>;

/** A search param that names something (a match, a player): a non-empty string, or a number-looking id the router
 *  parsed as a number. Anything else = absent. */
export const searchId = (v: unknown): string | undefined => (typeof v === "string" && v ? v : typeof v === "number" ? String(v) : undefined);

/** Where a «Por hacer» line / button / palette command goes, router-free (useAdminGo navigates). */
export interface AdminTarget {
  /** A section, la mesa of a match (`enjuego`), the pizarra or the web (a match's or a player's public page). */
  section: SectionKey | "enjuego" | "pizarra" | "web";
  /** partidos / enjuego / convocar / caja (its «Coste del partido») / web: the match. */
  matchId?: string;
  /** pizarra: the board to open (absent = as you left it) and its season. */
  tablero?: string;
  seasonId?: string;
  /** partidos: the station (as today's tab). */
  tab?: MatchTab;
  /** partidos: «Después» (the publish peak). */
  vitrina?: boolean;
  /** plantilla: this player's ficha; web: his public page. */
  playerId?: string;
  /** partidos «Nuevo partido» / plantilla «Alta de jugador». */
  nuevo?: boolean;
  /** contenido: this section of the web of the club. */
  seccion?: string;
}
