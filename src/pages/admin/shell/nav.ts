// The admin v2's sections (pure): names, the rail's groups, paths, icons, what the phone bar hides, the
// counters' shape and router-free targets (useAdminGo turns them into navigations).
import type { AdIconName } from "../ui/icons";

export type SectionKey = "hoy" | "partidos" | "convocar" | "plantilla" | "fichas" | "temporadas" | "capitanes" | "contenido";
export type AdminPath =
  | "/admin"
  | "/admin/partidos"
  | "/admin/convocar"
  | "/admin/plantilla"
  | "/admin/fichas"
  | "/admin/temporadas"
  | "/admin/capitanes"
  | "/admin/contenido";

export interface SectionDef {
  key: SectionKey;
  /** Name in the rail, the header («Sala de control · Hoy»), the phone header and the palette. */
  name: string;
  path: AdminPath;
  icon: AdIconName;
  /** `main` = Hoy · Partidos · Convocar · Plantilla; `club` = the rail's «Club» group (the phone's «Más»). */
  group: "main" | "club";
  /** The palette's line under the name when nothing more specific is known. */
  blurb: string;
}
export const SECTIONS: readonly SectionDef[] = [
  { key: "hoy", name: "Hoy", path: "/admin", icon: "home", group: "main", blurb: "El partido de hoy y lo que falta" },
  { key: "partidos", name: "Partidos", path: "/admin/partidos", icon: "cal", group: "main", blurb: "Calendario, actas y publicar" },
  { key: "convocar", name: "Convocar", path: "/admin/convocar", icon: "shirt", group: "main", blurb: "El siete y el banquillo" },
  { key: "plantilla", name: "Plantilla", path: "/admin/plantilla", icon: "team", group: "main", blurb: "La percha: jugadores y dorsales" },
  { key: "fichas", name: "Fichas", path: "/admin/fichas", icon: "inbox", group: "club", blurb: "Socios que piden su camiseta" },
  { key: "temporadas", name: "Temporadas", path: "/admin/temporadas", icon: "flag", group: "club", blurb: "Activa, en preparación o archivada" },
  { key: "capitanes", name: "Capitanes", path: "/admin/capitanes", icon: "shield", group: "club", blurb: "Quién lleva el brazalete" },
  { key: "contenido", name: "Contenido", path: "/admin/contenido", icon: "doc", group: "club", blurb: "El programa del club" },
];
export const SECTION: Record<SectionKey, SectionDef> = Object.fromEntries(SECTIONS.map((s) => [s.key, s])) as Record<SectionKey, SectionDef>;

const seg = (pathname: string, i: number) => pathname.replace(/\/+$/, "").split("/")[i] ?? "";
/** The section a pathname belongs to (/admin/partidos/abc → partidos; En juego is Hoy's). */
export function sectionOf(pathname: string): SectionKey {
  const s = seg(pathname, 2);
  if (s === "en-juego") return "hoy";
  return SECTIONS.find((x) => x.path === `/admin/${s}`)?.key ?? "hoy";
}
/** The match workspace (/admin/partidos/$matchId) or En juego (/admin/en-juego/$matchId): no phone bar. */
export function isWorkspace(pathname: string): boolean {
  const s = seg(pathname, 2);
  return (s === "partidos" || s === "en-juego") && !!seg(pathname, 3);
}
export const isEnJuego = (pathname: string) => seg(pathname, 2) === "en-juego" && !!seg(pathname, 3);
/** The header's «Sala de control · {sección}» (En juego says so). */
export const titleOf = (pathname: string) => (isEnJuego(pathname) ? "En juego" : SECTION[sectionOf(pathname)].name);

/**
 * TEMPORARY (V0): the sections that still render their v1 view inside the v2 shell (LegacyScope + the
 * `.v1` styles of admin-v1.css). Each phase removes its sections; delete with the last one.
 */
export const LEGACY: ReadonlySet<SectionKey> = new Set<SectionKey>(["convocar", "plantilla", "fichas", "temporadas", "capitanes", "contenido"]);

/** The match workspace's tabs (`/admin/partidos/$matchId?tab=`). */
export type MatchTab = "encuentro" | "convocatoria" | "acta" | "publicar";
export const MATCH_TABS: readonly MatchTab[] = ["encuentro", "convocatoria", "acta", "publicar"];

/** A rail counter: only exceptions (amber number), its words for the aria-label («2 por hacer»). */
export interface Counter {
  n: number;
  /** «N por hacer»; empty when n is 0. */
  label: string;
}

/** «Fichas · 2 por hacer» (the counter in words) or just the name: the rail / bar items' accessible name. */
export const navLabel = (name: string, c: Counter | undefined) => (c && c.n ? `${name} · ${c.label}` : name);

/** Where a «Por hacer» line / button / palette command goes, router-free (useAdminGo navigates). */
export interface AdminTarget {
  section: SectionKey | "enjuego";
  /** partidos / enjuego: the match; convocar: preselect this match (`?j=`). */
  matchId?: string;
  /** partidos workspace tab. */
  tab?: MatchTab;
  /** partidos workspace: open the publish peak (the vitrina) — V1a renders it. */
  vitrina?: boolean;
  /** plantilla: open this player's drawer. */
  playerId?: string;
  /** partidos «Nuevo partido» / plantilla «Alta de jugador». */
  nuevo?: boolean;
  /** contenido: open this section's editor. */
  seccion?: string;
}

/** The sections in the phone's «Más» sheet (the rail's «Club» group). */
export const MAS_SECTIONS: readonly SectionKey[] = ["fichas", "temporadas", "capitanes", "contenido"];

/** «La puerta» lives in the vestuario (CaptainDoor): the rail links there. */
export const DOOR_HREF = "/vestuario#puerta";
