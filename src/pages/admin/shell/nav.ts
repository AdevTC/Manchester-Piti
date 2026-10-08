// The admin's sections (pure): names, groups, paths, icons, and the live counters' shape.
import type { AdIconName } from "../ui/icons";

export type SectionKey = "inicio" | "partidos" | "convocatorias" | "fichas" | "plantilla" | "temporadas" | "capitanes" | "contenido";
export type AdminPath =
  | "/admin"
  | "/admin/partidos"
  | "/admin/convocatorias"
  | "/admin/fichas"
  | "/admin/plantilla"
  | "/admin/temporadas"
  | "/admin/capitanes"
  | "/admin/contenido";

export interface SectionDef {
  key: SectionKey;
  /** Name in the menu, the header breadcrumb and the palette. */
  name: string;
  path: AdminPath;
  icon: AdIconName;
  /** Menu group (null = above the groups). */
  group: null | "Jornada" | "Club";
  /** The palette's two-letter square. */
  abbr: string;
  /** The palette's line under the name when nothing more specific is known. */
  blurb: string;
}
export const SECTIONS: readonly SectionDef[] = [
  { key: "inicio", name: "Inicio", path: "/admin", icon: "home", group: null, abbr: "IN", blurb: "Por hacer y la jornada" },
  { key: "partidos", name: "Partidos y actas", path: "/admin/partidos", icon: "cal", group: "Jornada", abbr: "PA", blurb: "Lista, actas y publicar" },
  { key: "convocatorias", name: "Convocatorias", path: "/admin/convocatorias", icon: "list", group: "Jornada", abbr: "CV", blurb: "Titulares, suplentes y no convocados" },
  { key: "fichas", name: "Fichas", path: "/admin/fichas", icon: "inbox", group: "Jornada", abbr: "FI", blurb: "Socios que piden su ficha" },
  { key: "plantilla", name: "Plantilla", path: "/admin/plantilla", icon: "team", group: "Club", abbr: "PL", blurb: "Jugadores y dorsales" },
  { key: "temporadas", name: "Temporadas", path: "/admin/temporadas", icon: "flag", group: "Club", abbr: "TE", blurb: "Crear, renombrar y archivar" },
  { key: "capitanes", name: "Capitanes", path: "/admin/capitanes", icon: "shield", group: "Club", abbr: "CA", blurb: "Quién entra en la administración" },
  { key: "contenido", name: "Contenido del club", path: "/admin/contenido", icon: "doc", group: "Club", abbr: "CO", blurb: "Textos, momentos, historias y galería" },
];
export const SECTION: Record<SectionKey, SectionDef> = Object.fromEntries(SECTIONS.map((s) => [s.key, s])) as Record<SectionKey, SectionDef>;
/** The menu's short label (the side menu says «Contenido», the header «Contenido del club»). */
export const MENU_LABEL: Record<SectionKey, string> = { ...Object.fromEntries(SECTIONS.map((s) => [s.key, s.name])), contenido: "Contenido" } as Record<SectionKey, string>;

/** The section a pathname belongs to (/admin/partidos/abc → partidos). */
export function sectionOf(pathname: string): SectionKey {
  const seg = pathname.replace(/\/+$/, "").split("/")[2] ?? "";
  return (SECTIONS.find((s) => s.path === `/admin/${seg}`)?.key ?? "inicio") as SectionKey;
}

/** The match detail's tabs (`/admin/partidos/$matchId?tab=`). */
export type MatchTab = "encuentro" | "convocatoria" | "acta" | "publicar";
export const MATCH_TABS: readonly MatchTab[] = ["encuentro", "convocatoria", "acta", "publicar"];

/** Live counter: `w` (amber) = por revisar, `hot` (red) = pendiente de alguien, "" = a plain count. */
export type CounterTone = "" | "w" | "hot";
export interface Counter {
  n: number;
  tone: CounterTone;
  /** The counter as words, for aria-labels («2 fichas pendientes»). Empty when n is 0. */
  label: string;
}
/** «Fichas · 2 fichas pendientes» — the menu item's accessible name. */
export const navAria = (name: string, c: Counter | undefined) => (c && c.n ? `${name} · ${c.label}` : name);

/** Where a «Por hacer» / tile / palette action goes, router-free (useAdminGo turns it into a navigation). */
export interface AdminTarget {
  section: SectionKey;
  /** partidos: open this match (detail); convocatorias: preselect this match. */
  matchId?: string;
  /** partidos detail tab. */
  tab?: MatchTab;
  /** plantilla: open this player's drawer. */
  playerId?: string;
  /** partidos «Nuevo partido» / plantilla «Alta de jugador». */
  nuevo?: boolean;
  /** contenido: open this section's editor. */
  seccion?: string;
}

/** The sections that live in «Más» on phones. */
export const MAS_SECTIONS: readonly SectionKey[] = ["convocatorias", "fichas", "temporadas", "capitanes"];

/** «La puerta» lives in the vestuario (CaptainDoor): the menu links there. */
export const DOOR_HREF = "/vestuario#puerta";
