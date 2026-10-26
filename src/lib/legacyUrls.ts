// The old addresses and where each one lives now (the Vidrio boards' «Redirecciones», rounds 5–11): the
// English /matches, /stats and /profile, Partidos' ?view=, and the hashes that used to pick a place inside a
// page (/#temporada, /club#cl-kits, /vestuario#vx-caja, /profile#ajustes…). One pure table for every layer:
// the router redirects with it in the browser (hashes included, with replace), the server render answers
// 308 with it (api/render.js, through entry-server) and its tests pin each row. Parameters carry over;
// the ones a new page names in Spanish are renamed (season → temporada on Estadísticas). /numeros, the
// section's name before Estadísticas, moves screen by screen to /estadisticas.
import { defaultParseSearch, defaultStringifySearch } from "@tanstack/react-router";

type Search = Record<string, unknown>;
export interface LegacyTarget {
  pathname: string;
  search: Search;
  /** Without the «#»; empty for none. */
  hash: string;
}

/** Segments under /partidos that are screens, never a match id. */
export const PARTIDOS_SCREENS = ["tabla", "balance"] as const;
const isMatchId = (s: string | undefined): s is string => !!s && /^[A-Za-z0-9_-]+$/.test(s) && !(PARTIDOS_SCREENS as readonly string[]).includes(s);

/** The old match tabs (?tab=) → the match page's screens (/partidos/<id>/<screen>; "" is the page itself). */
const MATCH_SCREEN: Record<string, string> = { cronica: "", pulso: "", campo: "siete", estadisticas: "numeros", vestuario: "vestuario" };
/** The match page's screen for an old tab (or none): its path. */
export const matchPath = (id: string, tab?: unknown): string => {
  const screen = typeof tab === "string" ? (MATCH_SCREEN[tab] ?? "") : "";
  return `/partidos/${id}${screen ? `/${screen}` : ""}`;
};

const HOME_HASH: Record<string, string> = { hoy: "/", temporada: "/estadisticas", club: "/club", tu: "/hoy/lo-tuyo" };
const CLUB_HASH: Record<string, string> = {
  "cl-trophies": "/club/vitrina",
  "cl-crest": "/club/vitrina/escudo",
  "cl-kits": "/club/equipo",
  "cl-ground": "/club/equipo",
  "cl-history": "/club/historia",
  "cl-story": "/club/historia",
  "cl-gallery": "/club/historia",
  "cl-nums": "/plantilla",
  "cl-pos": "/plantilla",
  "cl-faq": "/club/gente",
  "cl-contact": "/club/gente",
  "cl-sponsors": "/club/gente",
};
// (#vx-mvp, «el último partido, lugar Vestuario», needs the matches: VestuarioRoute sends it once they are in)
const VESTUARIO_HASH: Record<string, string> = {
  "vx-caja": "/vestuario/caja",
  encuestas: "/vestuario/encuestas",
  "vx-ausencias": "/vestuario/ausencias",
  "vx-train": "/vestuario/entrenos",
  "vx-board": "/vestuario/tablon",
  puerta: "/vestuario/puerta",
  "vx-ficha": "/vestuario/ficha",
};
// (#vx-rsvp, «¿Vas?», stays: it is the vestuario's own first block, and the anchor scrolls to its switch)
const PROFILE_HASH: Record<string, string> = {
  carta: "/perfil",
  temporada: "/perfil/temporada",
  cromos: "/perfil/temporada/cromos",
  avisos: "/avisos/a-medida",
  ajustes: "/perfil/ajustes",
  cuenta: "/perfil/cuenta",
  capitania: "/perfil/capitania",
  "pe-nombre": "/perfil/nombre",
  "pe-posiciones": "/perfil/posiciones",
  "pe-pick": "/perfil",
  "pe-ficha": "/perfil",
};

/** The screen an old /club or /vestuario #hash meant (search «Ponte la del Piti» → /club/equipo…), if any. */
export const clubHashPath = (hash: string): string | undefined => CLUB_HASH[hash.replace(/^#/, "")];
export const vestuarioHashPath = (hash: string): string | undefined => VESTUARIO_HASH[hash.replace(/^#/, "")];

/** Numbers' Spanish names for /stats' parameters (the time bar's and El juego's). */
const STATS_RENAME: Record<string, string> = { family: "familia", metric: "metrica", q: "q", matches: "partidos", players: "jugadores" };
const STATS_SECTION: Record<string, string> = {
  individual: "/estadisticas/records/marcas",
  streaks: "/estadisticas/records",
  team: "/estadisticas/records/marcas",
  evolution: "/estadisticas/records/evolucion",
};
const omit = (search: Search, ...keys: string[]): Search => Object.fromEntries(Object.entries(search).filter(([k]) => !keys.includes(k)));
const list = (v: unknown): string | undefined =>
  Array.isArray(v) ? v.map(String).join(",") || undefined : v === undefined || v === null || v === "" ? undefined : String(v);

/** The screen an old /stats view (and its section or analysis) is now. */
function statsPath(search: Search): string {
  const { view, section, tab, analysis } = search;
  switch (view ?? (tab === "compare" ? "compare" : undefined)) {
    case "compare":
      return "/plantilla/cara-a-cara";
    case "players":
    case "minutes":
      return "/estadisticas/jugadores";
    case "positions":
      return "/estadisticas/campo/puestos";
    case "rivals":
      return "/estadisticas/rivales";
    case "explore":
      return STATS_SECTION[typeof section === "string" ? section : ""] ?? STATS_SECTION.individual;
    case "game":
      return analysis === "catalog" ? "/estadisticas/juego/catalogo" : "/estadisticas/juego";
    default:
      return "/estadisticas";
  }
}

function fromStats(search: Search): { pathname: string; search: Search } {
  const pathname = statsPath(search);
  const rest = omit(search, "view", "section", "tab", "analysis", "a", "b", "season", "seasons", "team", "period", "excluded");
  const { view, a, b, season, seasons, team, period, excluded } = search;
  if (pathname === "/plantilla/cara-a-cara") {
    // the duel lives in Plantilla, which keeps ?season=
    return { pathname, search: { ...rest, ...(a !== undefined ? { a } : {}), ...(b !== undefined ? { b } : {}), ...(season !== undefined ? { season } : {}) } };
  }
  const out: Search = {};
  for (const [k, value] of Object.entries(rest)) out[STATS_RENAME[k] ?? k] = STATS_RENAME[k] && k !== "q" ? list(value) : value;
  const temporada = seasons !== undefined ? list(seasons) : season === "all" ? "todas" : list(season);
  if (temporada) out.temporada = temporada;
  if (team === "opponent") out.equipo = "rival";
  if (period !== undefined) out.parte = period;
  if (excluded === true || excluded === "true") out["fuera-del-audio"] = 1;
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return { pathname, search: view === "minutes" ? { ranking: "minutos", ver: "todo", ...out } : out };
}

const decoded = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

/** Where an old address lives now, or null when it is already a current one. */
export function legacyTarget(rawPathname: string, search: Search, rawHash = ""): LegacyTarget | null {
  const pathname = rawPathname.length > 1 ? rawPathname.replace(/\/+$/, "") : rawPathname;
  const hash = decoded(rawHash.replace(/^#/, ""));
  const seg = pathname.split("/").slice(1);
  const keep = (to: string, s: Search = search, h = hash): LegacyTarget => ({ pathname: to, search: s, hash: h });
  const without = (...keys: string[]) => omit(search, ...keys);

  if (pathname === "/") {
    const h = hash.toLocaleLowerCase("es").replace("ú", "u");
    if (HOME_HASH[h]) return keep(HOME_HASH[h], without("lugar"), "");
    if ("lugar" in search) return keep("/", without("lugar"));
    return null;
  }
  // the match: /matches/<id>[?tab=…], its mesa, the Sala de control's old «En juego»; ?tab= on the new address too
  if (seg[0] === "matches" && seg.length === 1) return keep("/partidos");
  if (seg[0] === "matches" && isMatchId(seg[1]) && seg.length === 2) return keep(matchPath(seg[1], search.tab), without("tab"));
  if (seg[0] === "matches" && isMatchId(seg[1]) && seg[2] === "mesa" && seg.length === 3) return keep(`/partidos/${seg[1]}/mesa`);
  if (seg[0] === "admin" && seg[1] === "en-juego" && isMatchId(seg[2]) && seg.length === 3) return keep(`/partidos/${seg[2]}/mesa`);
  if (seg[0] === "partidos" && isMatchId(seg[1]) && seg.length === 2 && "tab" in search) return keep(matchPath(seg[1], search.tab), without("tab"));
  // Partidos' old vistas
  if (pathname === "/partidos" && (search.view === "tabla" || search.view === "numeros")) {
    return keep(search.view === "tabla" ? "/partidos/tabla" : "/partidos/balance", without("view"));
  }
  if (pathname === "/stats") {
    const to = fromStats(search);
    return keep(to.pathname, to.search);
  }
  // Números is Estadísticas now: each /numeros screen at the same place under /estadisticas (an old ?view= too)
  if (seg[0] === "numeros") {
    const to = `/estadisticas${pathname.slice("/numeros".length)}`;
    return legacyTarget(to, search, rawHash) ?? keep(to);
  }
  // an Estadísticas screen asked with the old ?view=: today's page still writes it (until Estadísticas lands) and
  // keeps reading its own parameters, so only the screen moves
  if ((seg[0] === "estadisticas" || pathname === "/plantilla/cara-a-cara") && "view" in search) {
    const to = statsPath(search);
    if (to === "/plantilla/cara-a-cara") return keep(to, without("view", "section", "tab", "analysis"));
    const rest = without("view", "section", "tab", "analysis", "a", "b");
    return keep(to, search.view === "minutes" ? { ranking: "minutos", ver: "todo", ...rest } : rest);
  }
  if (pathname === "/club" && CLUB_HASH[hash]) return keep(CLUB_HASH[hash], search, "");
  if (pathname === "/vestuario" && VESTUARIO_HASH[hash]) return keep(VESTUARIO_HASH[hash], search, "");
  if (pathname === "/profile") return keep(PROFILE_HASH[hash] ?? "/perfil", search, PROFILE_HASH[hash] ? "" : hash);
  if ((seg[0] === "perfil" || seg[0] === "avisos") && PROFILE_HASH[hash]) return keep(PROFILE_HASH[hash], search, "");
  if (pathname === "/plantilla" && hash === "sq-cara") return keep("/plantilla/cara-a-cara", search, "");
  if (pathname === "/plantilla/pichichi" || pathname === "/jugadores") return keep("/plantilla");
  if (seg[0] === "jugadores" && seg[1] && seg[2] === "posiciones" && seg.length === 3) return keep(`/jugadores/${seg[1]}/juego`);
  return null;
}

/** An old href (path, search and hash) → its new href, or null. Search as the router writes and reads it. */
export function legacyHref(href: string): string | null {
  const url = new URL(href, "http://x");
  const target = legacyTarget(url.pathname, defaultParseSearch(url.search), url.hash);
  if (!target) return null;
  return target.pathname + defaultStringifySearch(target.search) + (target.hash ? `#${target.hash}` : "");
}
