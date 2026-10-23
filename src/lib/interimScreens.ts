// Until a page's Vidrio redesign lands, its new addresses (/numeros/jugadores, /partidos/<id>/siete,
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
  if (p === "/numeros/jugadores") return { view: search.ranking === "minutos" ? "minutes" : "players" };
  if (p.startsWith("/numeros/campo")) return { view: "positions" };
  if (p.startsWith("/numeros/juego")) return { view: "game" };
  if (p === "/numeros/rivales") return { view: "rivals" };
  if (p === "/numeros/records") return { view: "explore", section: "streaks" };
  if (p === "/numeros/records/evolucion") return { view: "explore", section: "evolution" };
  if (p.startsWith("/numeros/records")) return { view: "explore", section: "individual" };
  return { view: "summary" };
}

/** The address of today's Números view (the page's own tabs move between screens). */
export type StatsScreenPath =
  | "/numeros"
  | "/numeros/jugadores"
  | "/numeros/campo/puestos"
  | "/numeros/rivales"
  | "/numeros/juego"
  | "/numeros/records"
  | "/numeros/records/marcas"
  | "/numeros/records/evolucion"
  | "/plantilla/cara-a-cara";
export function statsViewPath(view: StatsView, section?: ExploreSectionId): StatsScreenPath {
  switch (view) {
    case "players":
    case "minutes":
      return "/numeros/jugadores";
    case "positions":
      return "/numeros/campo/puestos";
    case "rivals":
      return "/numeros/rivales";
    case "compare":
      return "/plantilla/cara-a-cara";
    case "game":
      return "/numeros/juego";
    case "explore":
      return section === "streaks" ? "/numeros/records" : section === "evolution" ? "/numeros/records/evolucion" : "/numeros/records/marcas";
    default:
      return "/numeros";
  }
}

const PROFILE_TAB_HASH: Record<string, string> = {
  "/perfil/temporada": "#temporada",
  "/perfil/temporada/cromos": "#cromos",
  "/perfil/ajustes": "#ajustes",
  "/perfil/cuenta": "#cuenta",
  "/perfil/capitania": "#capitania",
  "/avisos": "#avisos",
  "/avisos/a-medida": "#avisos",
};
/** The old #hash of today's profile tab at a /perfil or /avisos screen ("" for La carta). */
export const profileHashAt = (pathname: string): string => PROFILE_TAB_HASH[trim(pathname)] ?? "";

const ANCHOR: [RegExp, string][] = [
  [/^\/perfil\/nombre$/, "pe-nombre"],
  [/^\/perfil\/posiciones$/, "pe-posiciones"],
];
/** The block of today's page a new address points at (the element id its old #hash scrolled to), if any. */
export function anchorAt(pathname: string): string | null {
  const p = trim(pathname);
  return ANCHOR.find(([re]) => re.test(p))?.[1] ?? null;
}
