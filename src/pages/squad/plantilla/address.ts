// «Plantilla»'s addresses (piti-diseno/ROUTES.md): which screen, player, section, duel and filters an address
// means, and the address of each. /plantilla (?kit=2, ?orden=posicion, ?q=), /plantilla/album (?ver=tengo|faltan),
// /plantilla/cara-a-cara (?a=&b=), /jugadores/<id>[/temporada|/jornadas|/juego|/analisis|/cromo] (?periodo=todo for
// every season: its own parameter, so the web's ?season= stays the one chosen; without it, the web's ?season=all — an
// old link, or «Todo el historial» chosen for the whole web — reads as it, and ?periodo=temporada says «this season»).
// Pure.
import { SECS, type AlFilter, type Screen, type Sec } from "./views";

export interface Addr {
  screen: Screen;
  focus: string | null;
  sec: Sec;
  a: string | null;
  b: string | null;
  ver: AlFilter;
  kit: "home" | "away";
  orden: "dorsal" | "posicion";
  q: string;
  /** ?periodo=todo on a player (or an old link's ?season=all): every season. */
  all: boolean;
}

const trim = (p: string) => (p.length > 1 ? p.replace(/\/+$/, "") : p);
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : typeof v === "number" ? String(v) : null);

export function addrOf(pathname: string, search: Record<string, unknown>): Addr {
  const p = trim(pathname);
  const base: Addr = { screen: "home", focus: null, sec: "ficha", a: null, b: null, ver: "todos", kit: str(search.kit) === "2" ? "away" : "home", orden: search.orden === "posicion" ? "posicion" : "dorsal", q: str(search.q) ?? "", all: search.periodo === "todo" || (search.periodo !== "temporada" && search.season === "all") };
  const pl = /^\/jugadores\/([^/]+)(?:\/([^/]+))?$/.exec(p);
  if (pl) {
    const sec = (SECS as readonly string[]).includes(pl[2] ?? "") ? (pl[2] as Sec) : "ficha";
    return { ...base, screen: "player", focus: decodeURIComponent(pl[1]), sec };
  }
  if (p === "/plantilla/album") return { ...base, screen: "album", ver: search.ver === "tengo" || search.ver === "faltan" ? search.ver : "todos" };
  if (p === "/plantilla/cara-a-cara") return { ...base, screen: "cara", a: str(search.a), b: str(search.b) };
  return base;
}

export interface Href {
  to: string;
  search: Record<string, string>;
}
/** The address of a screen (the kit, the order and the search stay on the vestuario's own address). `seasonParam`:
 *  the web's ?season= (a player's «esta temporada» under ?season=all has to say so). */
export function hrefOf(a: Pick<Addr, "screen" | "focus" | "sec" | "a" | "b" | "ver" | "kit" | "orden" | "q" | "all">, seasonParam?: string): Href {
  const search: Record<string, string> = {};
  if (seasonParam) search.season = seasonParam;
  if (a.screen === "player" && a.focus) {
    if (a.all) search.periodo = "todo";
    else if (seasonParam === "all") search.periodo = "temporada";
    return { to: `/jugadores/${encodeURIComponent(a.focus)}${a.sec === "ficha" ? "" : `/${a.sec}`}`, search };
  }
  if (a.kit === "away") search.kit = "2";
  if (a.screen === "cara") {
    if (a.a) search.a = a.a;
    if (a.b) search.b = a.b;
    return { to: "/plantilla/cara-a-cara", search };
  }
  if (a.screen === "album") {
    if (a.ver !== "todos") search.ver = a.ver;
    return { to: "/plantilla/album", search };
  }
  if (a.orden === "posicion") search.orden = "posicion";
  if (a.q) search.q = a.q;
  return { to: "/plantilla", search };
}

/** The search box when the address changes from outside (the dock, a link, «atrás»): la percha searches what its
 *  address says, so without a ?q= it is empty again; the other screens leave the box as it was. */
export function searchOnArrival(a: Pick<Addr, "screen" | "q">, q: string): string {
  return a.screen === "home" ? a.q : q;
}
