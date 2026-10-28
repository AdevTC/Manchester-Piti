// The Sala de control's addresses (r12, DIRECTION.md § Los cinco sitios) and where each old one lives now
// (§ Redirecciones; the boards' scLegacy). Pure: legacyTarget (lib/legacyUrls) asks here for anything under
// /admin, so the router redirects with it before a route loads (replacing the old entry). Every other parameter
// carries over, `season` above all (memory url-rewrites-keep-season); only the ones a new address now names in its
// path are dropped. An old address whose match is not named (/admin/convocar) goes to `proximo`, which the match's
// screen turns into the next match once the data is in.

type Search = Record<string, unknown>;
export interface AdminTarget {
  pathname: string;
  search: Search;
}

/** The match's stations, in the carril's order (each one a screen: /admin/partidos/<id>/<station>). */
export const STATIONS = ["convocatoria", "datos", "en-juego", "acta", "publicar", "despues"] as const;
export type Station = (typeof STATIONS)[number];
export const isStation = (s: unknown): s is Station => typeof s === "string" && (STATIONS as readonly string[]).includes(s);

/** Segments under /admin/partidos that are screens, never a match id. */
export const PARTIDOS_SCREENS = ["nuevo", "archivados"] as const;
/** Segments under /admin/plantilla that are screens, never a player id. */
export const PLANTILLA_SCREENS = ["alta", "cromos", "antiguos", "socios", "capitanes"] as const;
/** The Club's rooms (/admin/club/<room>). */
export const CLUB_ROOMS = ["temporadas", "clasificacion", "web", "turnos", "vestuario", "avisos", "equipaciones"] as const;
export type ClubRoom = (typeof CLUB_ROOMS)[number];
/** The web of the club's sections (/admin/club/web/<section>). */
export const WEB_SECTIONS = ["historia", "contacto", "momentos", "historias", "preguntas", "galeria"] as const;
/** A match addressed without its id: the next one (the screen resolves it). */
export const NEXT_MATCH = "proximo";

const isId = (s: unknown): s is string => typeof s === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(s);
const on = (v: unknown) => v === true || v === "true" || v === 1 || v === "1";
const omit = (search: Search, ...keys: string[]): Search => Object.fromEntries(Object.entries(search).filter(([k]) => !keys.includes(k)));

/** The old match tabs (?tab=) → the stations. */
const TAB_STATION: Record<string, Station> = { encuentro: "datos", convocatoria: "convocatoria", acta: "acta", publicar: "publicar" };
/** The old `?tab=` of /admin (the v1 single page). */
const ADMIN_TAB: Record<string, string> = {
  matches: "/admin/partidos",
  roster: "/admin/plantilla",
  seasons: "/admin/club/temporadas",
  admins: "/admin/plantilla/capitanes",
};
/** Old content sections (?seccion=) → the web's sections (the escudo lives in la historia, the team's photo in
 *  contacto; the frase and the campos are part of la historia, the colaboradores of la galería). */
const OLD_SECTION: Record<string, string> = { escudo: "historia", foto: "contacto", frase: "historia", campos: "historia", colaboradores: "galeria" };

/** Where an old /admin address lives now, or null when it is already a current one. `pathname` without its
 *  trailing slash. */
export function adminLegacyTarget(pathname: string, search: Search): AdminTarget | null {
  const seg = pathname.split("/").slice(1);
  if (seg[0] !== "admin") return null;
  const keep = (to: string, s: Search = search): AdminTarget => ({ pathname: to, search: s });
  const without = (...keys: string[]) => omit(search, ...keys);

  if (seg.length === 1 && "tab" in search) return keep(typeof search.tab === "string" ? (ADMIN_TAB[search.tab] ?? "/admin") : "/admin", without("tab"));
  // la mesa was the sala's «En juego»
  if (seg[1] === "en-juego" && isId(seg[2]) && seg.length === 3) return keep(`/partidos/${seg[2]}/mesa`, without());
  if (seg[1] === "partidos") {
    if (seg.length === 2 && "nuevo" in search) return keep(on(search.nuevo) ? "/admin/partidos/nuevo" : "/admin/partidos", without("nuevo"));
    const id = seg[2];
    if (seg.length === 3 && isId(id) && !(PARTIDOS_SCREENS as readonly string[]).includes(id)) {
      if (on(search.nuevo)) return keep("/admin/partidos/nuevo", without("nuevo", "tab", "vitrina"));
      if ("vitrina" in search || "tab" in search) {
        const station = on(search.vitrina) ? "despues" : typeof search.tab === "string" ? TAB_STATION[search.tab] : undefined;
        return keep(`/admin/partidos/${id}${station ? `/${station}` : ""}`, without("tab", "vitrina"));
      }
    }
    return null;
  }
  if ((seg[1] === "convocar" || seg[1] === "convocatorias") && seg.length === 2) {
    const j = isId(search.j) ? search.j : typeof search.j === "number" ? String(search.j) : NEXT_MATCH;
    return keep(`/admin/partidos/${j}/convocatoria`, without("j"));
  }
  if (seg[1] === "plantilla" && seg.length === 2) {
    const jugador = typeof search.jugador === "number" ? String(search.jugador) : search.jugador;
    // (a ficha opened from the cromos keeps `vista=cromos`: its «‹» goes back to them)
    if (isId(jugador)) return keep(`/admin/plantilla/${jugador}`, search.vista === "cromos" ? { ...without("jugador", "nuevo", "dorsal") } : without("jugador", "nuevo", "vista", "dorsal"));
    if (on(search.nuevo)) return keep("/admin/plantilla/alta", without("nuevo", "jugador", "vista"));
    if (search.vista === "cromos") return keep("/admin/plantilla/cromos", without("vista"));
    if ("jugador" in search || "nuevo" in search || "vista" in search) return keep("/admin/plantilla", without("jugador", "nuevo", "vista", "dorsal"));
    return null;
  }
  if (seg[1] === "fichas" && seg.length === 2) return keep("/admin/plantilla/socios", { ...search, ver: "fichas" });
  if (seg[1] === "capitanes" && seg.length === 2) return keep("/admin/plantilla/capitanes");
  if ((seg[1] === "temporadas" || seg[1] === "clasificacion" || seg[1] === "turnos") && seg.length === 2) return keep(`/admin/club/${seg[1]}`);
  if (seg[1] === "contenido" && seg.length === 2) {
    const raw = typeof search.seccion === "string" ? search.seccion : "";
    const section = OLD_SECTION[raw] ?? ((WEB_SECTIONS as readonly string[]).includes(raw) ? raw : "");
    return keep(`/admin/club/web${section ? `/${section}` : ""}`, without("seccion"));
  }
  if (seg[1] === "caja" && seg.length === 2 && "coste" in search) {
    const coste = typeof search.coste === "number" ? String(search.coste) : search.coste;
    return keep(isId(coste) ? `/admin/caja/coste/${coste}` : "/admin/caja", without("coste"));
  }
  return null;
}
