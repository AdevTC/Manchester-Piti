// The Sala de control's five places (r12, DIRECTION.md § Navegación de la sala) and what the frame knows of every
// address without the data: its place, its default title and line, where «‹ Volver» goes (and so whether the dock
// hides: inside a match, a ficha or any screen with a way back), and the direction of travel between two addresses
// (law 4: deeper or to the right of the capsule comes in from the right). Pure.
import { CLUB_ROOMS, isStation, NEXT_MATCH, PARTIDOS_SCREENS, PLANTILLA_SCREENS, STATIONS, type Station } from "../../../lib/adminUrls";
import type { VIconName } from "../../../components/vidrio/VIcon";

export type PlaceKey = "hoy" | "partidos" | "plantilla" | "caja" | "club";
export interface Place {
  key: PlaceKey;
  name: string;
  path: string;
  icon: VIconName;
  /** The second key of its `g` shortcut (g h Hoy · g p Partidos · g l pLantilla · g a cAja · g b cluB). */
  go: string;
}
export const PLACES: readonly Place[] = [
  { key: "hoy", name: "Hoy", path: "/admin", icon: "home", go: "h" },
  { key: "partidos", name: "Partidos", path: "/admin/partidos", icon: "fixtures", go: "p" },
  { key: "plantilla", name: "Plantilla", path: "/admin/plantilla", icon: "shirt", go: "l" },
  { key: "caja", name: "Caja", path: "/admin/caja", icon: "euro", go: "a" },
  { key: "club", name: "Club", path: "/admin/club", icon: "shield", go: "b" },
];
export const PLACE: Record<PlaceKey, Place> = Object.fromEntries(PLACES.map((p) => [p.key, p])) as Record<PlaceKey, Place>;
/** The place a `g` + key shortcut goes to (case-insensitive). */
export const placeForGo = (key: string): PlaceKey | undefined => PLACES.find((p) => p.go === key.toLowerCase())?.key;
/** «g h»: a place's aria-keyshortcuts (two keys in sequence). */
export const goKeys = (k: PlaceKey) => `g ${PLACE[k].go}`;
/** «G H»: how it reads in the palette. */
export const goHint = (k: PlaceKey) => `G ${PLACE[k].go.toUpperCase()}`;

/** A counter in words: «Partidos · 2 cosas por hacer» (the dock's and the capsule's accessible name). */
export function placeLabel(name: string, n: number): string {
  if (!n) return name;
  return `${name} · ${n} ${n === 1 ? "cosa por hacer" : "cosas por hacer"}`;
}

/** What the frame knows of an address. `screen` names it for the frame (`partido` carries its id and station). */
export interface ScreenInfo {
  /** null: an address the sala does not have (its not-found screen). */
  place: PlaceKey | null;
  screen: string;
  /** The default title and line of the frame's header (a screen can say better: useSalaHead). */
  title: string;
  sub: string;
  /** «‹ Volver»: where and its accessible name. Present = the dock hides (< 1100). */
  back?: { to: string; label: string };
  matchId?: string;
  /** The station in the address (none = the one of the match's moment). */
  station?: Station;
  playerId?: string;
  room?: string;
  section?: string;
}

const clean = (pathname: string) => (pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname);
const ROOM_TITLE: Record<string, string> = {
  temporadas: "Temporadas",
  clasificacion: "Clasificación",
  web: "La web del club",
  turnos: "Turnos",
  vestuario: "El vestuario",
  avisos: "Avisos",
  equipaciones: "Equipaciones",
};
const STATION_NAME: Record<Station, string> = {
  convocatoria: "Convocatoria",
  datos: "Datos",
  "en-juego": "La mesa",
  acta: "Acta",
  publicar: "Publicar",
  despues: "Después",
};
export const stationName = (s: Station) => STATION_NAME[s];

export function screenOf(rawPathname: string): ScreenInfo {
  const seg = clean(rawPathname).split("/").slice(1);
  const nf: ScreenInfo = { place: null, screen: "no-existe", title: "No existe", sub: "", back: { to: "/admin", label: "Volver a Hoy" } };
  if (seg[0] !== "admin") return nf;
  const [, a, b, c, d] = seg;
  if (!a) return { place: "hoy", screen: "hoy", title: "Hoy", sub: "" };
  if (a === "partidos") {
    const toList = { to: "/admin/partidos", label: "Volver a Partidos" };
    if (!b) return { place: "partidos", screen: "temporada", title: "Partidos", sub: "" };
    if (b === "nuevo" && !c) return { place: "partidos", screen: "nuevo", title: "Nuevo partido", sub: "Rival, fecha y hora; el resto, cuando lo sepas", back: toList };
    if (b === "archivados")
      return c
        ? { place: "partidos", screen: "archivado", title: "Archivado", sub: "", matchId: c, back: { to: "/admin/partidos/archivados", label: "Volver a Archivados" } }
        : { place: "partidos", screen: "archivados", title: "Archivados", sub: "Fuera del calendario", back: toList };
    if ((PARTIDOS_SCREENS as readonly string[]).includes(b)) return nf;
    // the match: /<id>[/<station>[/narracion|historial]]
    if (c && !isStation(c)) return nf;
    const station = c as Station | undefined;
    if (d && !(station === "acta" && (d === "narracion" || d === "historial"))) return nf;
    const screen = d ? `acta-${d}` : station ?? "partido";
    const back = d ? { to: `/admin/partidos/${b}/acta`, label: "Volver al acta" } : toList;
    return { place: "partidos", screen, title: b === NEXT_MATCH ? "El próximo partido" : "El partido", sub: station ? STATION_NAME[station] : "", matchId: b, station, back };
  }
  if (a === "plantilla") {
    const toList = { to: "/admin/plantilla", label: "Volver a la plantilla" };
    if (!b) return { place: "plantilla", screen: "jugadores", title: "Plantilla", sub: "" };
    if (c) return nf;
    if (b === "alta") return { place: "plantilla", screen: "alta", title: "Camiseta nueva", sub: "Alta de jugador", back: toList };
    if (b === "cromos") return { place: "plantilla", screen: "cromos", title: "Plantilla", sub: "En cromos" };
    if (b === "antiguos") return { place: "plantilla", screen: "antiguos", title: "Antiguos", sub: "Fichas de otras temporadas", back: toList };
    if (b === "socios") return { place: "plantilla", screen: "socios", title: "Socios", sub: "La puerta del vestuario" };
    if (b === "capitanes") return { place: "plantilla", screen: "capitanes", title: "Capitanes", sub: "El brazalete y el capitán en el campo" };
    if ((PLANTILLA_SCREENS as readonly string[]).includes(b)) return nf;
    return { place: "plantilla", screen: "ficha", title: "La ficha", sub: "", playerId: b, back: toList };
  }
  if (a === "caja") {
    if (!b) return { place: "caja", screen: "caja", title: "Caja", sub: "" };
    if (b === "coste" && c && !d) return { place: "caja", screen: "coste", title: "Coste del partido", sub: "", matchId: c, back: { to: "/admin/caja", label: "Volver a la caja" } };
    return nf;
  }
  if (a === "club") {
    if (!b) return { place: "club", screen: "oficina", title: "Club", sub: "La oficina del club" };
    if (!(CLUB_ROOMS as readonly string[]).includes(b) || d || (c && b !== "web")) return nf;
    if (c) return { place: "club", screen: "web-seccion", title: ROOM_TITLE.web, sub: "", room: b, section: c, back: { to: "/admin/club/web", label: "Volver a la web del club" } };
    return { place: "club", screen: b, title: ROOM_TITLE[b] ?? "Club", sub: "", room: b, back: { to: "/admin/club", label: "Volver a la oficina" } };
  }
  return nf;
}

const ORDER: readonly PlaceKey[] = PLACES.map((p) => p.key);
/** How deep an address is (a place's own screen 0, its screens 1, a station 2, its sub-screens 3). */
const depth = (pathname: string) => Math.max(0, clean(pathname).split("/").length - 2);

/** The direction a change of screen travels: another place right or left by the capsule's order; inside a
 *  match by its stations' order; otherwise deeper = right. */
export function salaDirection(fromPath: string, toPath: string): "left" | "right" {
  const a = screenOf(fromPath);
  const b = screenOf(toPath);
  const ia = a.place ? ORDER.indexOf(a.place) : ORDER.length;
  const ib = b.place ? ORDER.indexOf(b.place) : ORDER.length;
  if (ia !== ib) return ib > ia ? "right" : "left";
  if (a.matchId && a.matchId === b.matchId && a.station && b.station && a.station !== b.station) return STATIONS.indexOf(b.station) > STATIONS.indexOf(a.station) ? "right" : "left";
  return depth(toPath) >= depth(fromPath) ? "right" : "left";
}

/** Two addresses of the same match (a change of station): its head and carril stay put while the screen travels. */
export function sameMatch(fromPath: string, toPath: string): boolean {
  const a = screenOf(fromPath);
  const b = screenOf(toPath);
  return !!a.matchId && a.matchId === b.matchId && a.screen !== "archivado" && b.screen !== "archivado" && a.place === "partidos" && b.place === "partidos";
}
