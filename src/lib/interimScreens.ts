// Until a page's Vidrio redesign lands, its new addresses (/numeros/jugadores, /partidos/<id>/siete,
// /perfil/ajustes, /club/historia…) render today's page, which still picks its view, tab or block from the
// old ?view=, ?tab= or #hash. These say which one each new address means, so an old link redirected here
// (a push notice, a bookmark) still opens what it used to. Each page session drops its part when its page
// reads the address itself.

type Search = Record<string, unknown>;
const trim = (pathname: string) => (pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname);

export type StatsView = "summary" | "players" | "game" | "minutes" | "positions" | "rivals" | "compare" | "explore";
export type ExploreSectionId = "individual" | "streaks" | "team" | "evolution";

/** Today's Números view (and its Explorar section) at a /numeros screen, or /plantilla/cara-a-cara. */
export function statsViewAt(pathname: string, search: Search): { view: StatsView; section?: ExploreSectionId } {
  const p = trim(pathname);
  if (p === "/plantilla/cara-a-cara") return { view: "compare" };
  if (p === "/numeros/jugadores") return { view: search.ranking === "minutos" ? "minutes" : "players" };
  if (p.startsWith("/numeros/campo")) return { view: "positions" };
  if (p.startsWith("/numeros/juego")) return { view: "game" };
  if (p === "/numeros/rivales") return { view: "rivals" };
  if (p === "/numeros/records") return { view: "explore", section: "streaks" };
  if (p === "/numeros/records/evolucion") return { view: "explore", section: "evolution" };
  if (p.startsWith("/numeros/records")) return { view: "explore", section: "individual" };
  return { view: "summary" };
}

/** Today's Números page reads /stats' English parameters; the new addresses carry Números' Spanish ones (the
 *  redirects and the links write those). The English one wins when both are there (the page writes its own). */
export function interimStatsSearch(search: Search, pathname: string): Search {
  const ids = (v: unknown): string[] | undefined =>
    Array.isArray(v) ? v.map(String) : typeof v === "string" && v ? v.split(",").map((x) => x.trim()).filter(Boolean) : undefined;
  const temporada = typeof search.temporada === "string" ? search.temporada : undefined;
  const out: Search = { ...search };
  const fill = (key: string, value: unknown) => {
    if (out[key] === undefined && value !== undefined) out[key] = value;
  };
  fill("matches", ids(search.partidos));
  fill("players", ids(search.jugadores));
  fill("family", search.familia);
  fill("metric", search.metrica);
  fill("team", search.equipo === "rival" ? "opponent" : undefined);
  fill("period", search.parte);
  fill("excluded", search["fuera-del-audio"] ? true : undefined);
  // «todas»: every season (an empty scope); one or several by id
  fill("seasons", temporada === "todas" ? [] : ids(temporada));
  fill("analysis", trim(pathname) === "/numeros/juego/catalogo" ? "catalog" : undefined);
  return out;
}

/** Números' Spanish params that today's page reads as its English ones. */
const STATS_SPANISH = ["partidos", "jugadores", "temporada", "equipo", "parte", "familia", "metrica", "fuera-del-audio"];
/** What today's Números page writes back over: its English fields, with the Spanish ones read into them and
 *  dropped, so a filter that arrived in Spanish («Abrir esta selección en Números») can be changed or removed. */
export function statsSearchToWrite(search: Search, pathname: string): Search {
  const out = interimStatsSearch(search, pathname);
  for (const key of STATS_SPANISH) delete out[key];
  // (the catalogue screen says it already: not written into the address)
  if (search.analysis === undefined) delete out.analysis;
  return out;
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
  [/^\/club\/vitrina\/escudo$/, "cl-crest"],
  [/^\/club\/vitrina(\/|$)/, "cl-trophies"],
  [/^\/club\/historia$/, "cl-history"],
  [/^\/club\/equipo(\/camiseta)?$/, "cl-kits"],
  [/^\/club\/gente$/, "cl-faq"],
  [/^\/vestuario\/caja$/, "vx-caja"],
  [/^\/vestuario\/encuestas(\/|$)/, "encuestas"],
  [/^\/vestuario\/ausencias$/, "vx-ausencias"],
  [/^\/vestuario\/entrenos$/, "vx-train"],
  [/^\/vestuario\/tablon$/, "vx-board"],
  [/^\/vestuario\/puerta$/, "puerta"],
  [/^\/vestuario\/ficha$/, "vx-ficha"],
  [/^\/perfil\/nombre$/, "pe-nombre"],
  [/^\/perfil\/posiciones$/, "pe-posiciones"],
];
/** The block of today's page a new address points at (the element id its old #hash scrolled to), if any. */
export function anchorAt(pathname: string): string | null {
  const p = trim(pathname);
  return ANCHOR.find(([re]) => re.test(p))?.[1] ?? null;
}
