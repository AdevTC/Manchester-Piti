// Until a page's Vidrio redesign lands, its new addresses (/estadisticas/jugadores, /partidos/<id>/siete,
// /perfil/ajustes, /club/historia…) render today's page, which still picks its view, tab or block from the
// old ?view=, ?tab= or #hash. These say which one each new address means, so an old link redirected here
// (a push notice, a bookmark) still opens what it used to. Each page session drops its part when its page
// reads the address itself.

type Search = Record<string, unknown>;
const trim = (pathname: string) => (pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname);

export type StatsView = "summary" | "players" | "game" | "minutes" | "positions" | "rivals" | "compare" | "explore";
export type ExploreSectionId = "individual" | "streaks" | "team" | "evolution";

/** Today's StatsPage view (and its Explorar section) at an old Números screen: the search maps its results through
 *  statsViewPath. Números reads its own address (pages/stats/numeros/url.ts); Plantilla renders its own cara a cara. */
export function statsViewAt(pathname: string, search: Search): { view: StatsView; section?: ExploreSectionId } {
  const p = trim(pathname);
  if (p === "/estadisticas/jugadores") return { view: search.ranking === "minutos" ? "minutes" : "players" };
  if (p.startsWith("/estadisticas/campo")) return { view: "positions" };
  if (p.startsWith("/estadisticas/juego")) return { view: "game" };
  if (p === "/estadisticas/rivales") return { view: "rivals" };
  if (p === "/estadisticas/records") return { view: "explore", section: "streaks" };
  if (p === "/estadisticas/records/evolucion") return { view: "explore", section: "evolution" };
  if (p.startsWith("/estadisticas/records")) return { view: "explore", section: "individual" };
  return { view: "summary" };
}

/** The address of today's Números view (the page's own tabs move between screens). */
export type StatsScreenPath =
  | "/estadisticas"
  | "/estadisticas/jugadores"
  | "/estadisticas/campo/puestos"
  | "/estadisticas/rivales"
  | "/estadisticas/juego"
  | "/estadisticas/records"
  | "/estadisticas/records/marcas"
  | "/estadisticas/records/evolucion"
  | "/plantilla/cara-a-cara";
export function statsViewPath(view: StatsView, section?: ExploreSectionId): StatsScreenPath {
  switch (view) {
    case "players":
    case "minutes":
      return "/estadisticas/jugadores";
    case "positions":
      return "/estadisticas/campo/puestos";
    case "rivals":
      return "/estadisticas/rivales";
    case "compare":
      return "/plantilla/cara-a-cara";
    case "game":
      return "/estadisticas/juego";
    case "explore":
      return section === "streaks" ? "/estadisticas/records" : section === "evolution" ? "/estadisticas/records/evolucion" : "/estadisticas/records/marcas";
    default:
      return "/estadisticas";
  }
}

const ANCHOR: [RegExp, string][] = [
];
/** The block of today's page a new address points at (the element id its old #hash scrolled to), if any. */
export function anchorAt(pathname: string): string | null {
  const p = trim(pathname);
  return ANCHOR.find(([re]) => re.test(p))?.[1] ?? null;
}
