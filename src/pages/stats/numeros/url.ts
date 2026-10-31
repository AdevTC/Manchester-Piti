// «Números»: the address of every screen and sheet (NU-Main «La dirección»): /estadisticas/<sección>[/<vista>] and the
// boards' Spanish parameters — temporada · hasta · campo · partidos · jugadores · buscar for the time bar on every
// screen, ranking · jugador · estrella · puesto · equipo · parte · familia · fuera-del-audio · metrica · rival · ver ·
// q for the screens, hoja for a sheet that has no address of its own. Pure.
import { NU_GLOSS, NU_MET } from "./glossary";
import { slug } from "./nd";
import type { CampoView, Grow, JugView, NuState, Place, RecView, Sheet } from "./view";

export type Search = Record<string, unknown>;

export interface Screen {
  place: Place;
  /** Jugadores' view: /jugadores/campo, /jugadores/evolucion (and the old /campo, /records/evolucion). */
  jugView: JugView;
  campoView: CampoView;
  recView: RecView;
  /** /juego/tabla and /juego/catalogo grow in place. */
  grow: Grow | null;
  /** /estadisticas/y-si: the simulator's sheet over Temporada. */
  ysi: boolean;
}

const trim = (p: string) => (p.length > 1 ? p.replace(/\/+$/, "") : p);

/**
 * The screen at a /estadisticas address. «El palco» has four places: El campo is Jugadores' second view
 * (/jugadores/campo[/puestos]) and Récords lives in Temporada (its evolution in /jugadores/evolucion). The round-3
 * addresses (/campo…, /records…) still open where their screens went.
 */
export function screenAt(pathname: string): Screen {
  const seg = trim(pathname).split("/").slice(2);
  const s: Screen = { place: "temporada", jugView: "ranking", campoView: "pases", recView: "rachas", grow: null, ysi: false };
  const campo = (view: string | undefined) => {
    s.place = "jugadores";
    s.jugView = "campo";
    if (view === "puestos") s.campoView = "puestos";
  };
  switch (seg[0]) {
    case "jugadores":
      s.place = "jugadores";
      if (seg[1] === "campo") campo(seg[2]);
      if (seg[1] === "evolucion") s.jugView = "evo";
      break;
    case "rivales":
      s.place = "rivales";
      break;
    case "campo":
      // (the systems are Temporada's «Con cada sistema» now)
      if (seg[1] === "sistemas") s.campoView = "sistemas";
      else campo(seg[1]);
      break;
    case "juego":
      s.place = "juego";
      if (seg[1] === "tabla") s.grow = "mesa";
      if (seg[1] === "catalogo") s.grow = "catalogo";
      if (seg[1] === "graficas") s.grow = "graficas";
      break;
    case "records":
      if (seg[1] === "marcas" || seg[1] === "cromos") s.recView = seg[1];
      if (seg[1] === "evolucion") {
        s.place = "jugadores";
        s.jugView = "evo";
        s.recView = "evolucion";
      }
      break;
    case "y-si":
      s.ysi = true;
      break;
  }
  return s;
}

/** The path of a screen (with its view and what grows on its own address). */
export function pathOf(st: Pick<NuState, "place" | "jugView" | "campoView" | "grow" | "sheet">): string {
  if (st.place === "temporada") return st.sheet === "ysi" ? "/estadisticas/y-si" : "/estadisticas";
  if (st.place === "jugadores") {
    if (st.jugView === "campo") return st.campoView === "puestos" ? "/estadisticas/jugadores/campo/puestos" : "/estadisticas/jugadores/campo";
    if (st.jugView === "evo") return "/estadisticas/jugadores/evolucion";
    return "/estadisticas/jugadores";
  }
  if (st.place === "juego") return st.grow === "mesa" ? "/estadisticas/juego/tabla" : st.grow === "catalogo" ? "/estadisticas/juego/catalogo" : st.grow === "graficas" ? "/estadisticas/juego/graficas" : "/estadisticas/juego";
  return `/estadisticas/${st.place}`;
}

/** ?ranking=: the quick five by their word, any other of the 38 by its label («amarillas»). */
const RANK_WORD: Record<string, string> = { goles: "goles", asist: "asistencias", min: "minutos", mvp: "mvp", porra: "porra" };
export function rankingParam(k: string): string | undefined {
  if (k === "goles") return undefined;
  return RANK_WORD[k] ?? (NU_MET[k] ? slug(NU_MET[k].t) : undefined);
}
export function rankingOf(v: unknown): string | null {
  if (typeof v !== "string" || !v) return null;
  const word = Object.entries(RANK_WORD).find(([, w]) => w === v)?.[0];
  if (word) return word;
  if (NU_MET[v]) return v;
  return Object.values(NU_MET).find((m) => slug(m.t) === v)?.k ?? null;
}

/** ?hoja= for the sheets without an address of their own: «Qué números ver» and each «?». */
export function hojaOf(sheet: Sheet | null, id: string | null): string | undefined {
  if (sheet === "scope") return "filtros";
  if (sheet === "stats") return "estadisticas";
  if (sheet === "export") return "exportar";
  if (sheet === "info" && id) return `que-es-${id.replace(":", "-")}`;
  return undefined;
}
export function sheetOfHoja(v: unknown): { sheet: Sheet; id: string | null } | null {
  if (v === "filtros") return { sheet: "scope", id: null };
  if (v === "estadisticas") return { sheet: "stats", id: null };
  if (v === "exportar") return { sheet: "export", id: null };
  if (typeof v !== "string" || !v.startsWith("que-es-")) return null;
  const k = v.slice(7);
  if (NU_GLOSS[k]) return { sheet: "info", id: k };
  if (k.startsWith("m-") && (NU_MET[k.slice(2)] || k === "m-porra")) return { sheet: "info", id: `m:${k.slice(2)}` };
  return null;
}

export interface PeopleIndex {
  /** The address word of a player: his name's slug, or his id when two share it. */
  word: (id: string) => string;
  /** A player from his id or his address word (null: nobody). */
  id: (word: string) => string | null;
}
export function peopleIndex(people: readonly { id: string; name: string }[]): PeopleIndex {
  const count: Record<string, number> = {};
  people.forEach((p) => (count[slug(p.name)] = (count[slug(p.name)] ?? 0) + 1));
  const byWord = new Map(people.filter((p) => count[slug(p.name)] === 1).map((p) => [slug(p.name), p.id]));
  const ids = new Set(people.map((p) => p.id));
  return {
    word: (id) => {
      const p = people.find((x) => x.id === id);
      return p && count[slug(p.name)] === 1 && slug(p.name) ? slug(p.name) : id;
    },
    id: (w) => (ids.has(w) ? w : (byWord.get(slug(w)) ?? null)),
  };
}

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : typeof v === "number" ? String(v) : null);
const ids = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : typeof v === "string" && v ? v.split(",") : []).map((x) => x.trim()).filter(Boolean);

/** What the address says, as page state (the sheet a narrow screen opens for ?jugador= / ?rival= is the page's). */
export function stateFromUrl(pathname: string, search: Search, people: PeopleIndex): Partial<NuState> & { seasonWord: string | null } {
  const sc = screenAt(pathname);
  const out: Partial<NuState> & { seasonWord: string | null } = { place: sc.place, jugView: sc.jugView, campoView: sc.campoView, recView: sc.recView, grow: sc.grow, sheet: null, sheetId: null, seasonWord: null };
  // ?ver=todo: the whole league table in Temporada, «Toda la plantilla, en una tabla» in Jugadores
  const ver = str(search.ver) === "todo";
  out.allTable = ver && sc.place === "temporada";
  if (ver && !sc.grow && sc.place === "jugadores") out.grow = "jugadores";
  const t = str(search.temporada);
  out.temporada = t === "todas" ? "todas" : "esta";
  out.seasonWord = t && t !== "todas" ? t : null;
  const h = /^j(\d{1,2})$/.exec(str(search.hasta) ?? "");
  out.upto = h ? Number(h[1]) : Number.POSITIVE_INFINITY;
  const campo = str(search.campo);
  out.campo = campo === "casa" || campo === "fuera" ? campo : "todo";
  out.partidos = ids(search.partidos);
  out.jug = ids(search.jugadores)
    .map((w) => people.id(w))
    .filter((x): x is string => !!x);
  out.rankK = rankingOf(search.ranking) ?? "goles";
  const jugador = str(search.jugador);
  const pid = jugador ? people.id(jugador) : null;
  out.pick = sc.place === "jugadores" ? pid : null;
  // «Cara a cara»: ?contra=<el otro jugador>
  const contra = sc.place === "jugadores" && str(search.contra) ? people.id(str(search.contra) as string) : null;
  out.vsOn = !!contra;
  out.vsB = contra;
  out.rival = sc.place === "rivales" ? str(search.rival) : null;
  out.star = sc.jugView === "campo" ? (str(search.estrella) ? people.id(str(search.estrella) as string) : null) : null;
  const puesto = str(search.puesto);
  out.puesto = puesto ? puesto.toUpperCase() : "";
  out.team = search.equipo === "rival" ? "them" : "us";
  const parte = Number(search.parte);
  out.parte = parte === 1 ? "1" : parte === 2 ? "2" : "all";
  out.catFam = str(search.familia) ?? "";
  out.catX = Number(search["fuera-del-audio"]) === 1;
  out.catQ = str(search.q) ?? "";
  const preset = str(search.vista);
  out.wsSet = preset && ["resumen", "pases", "remates", "defensa", "porteria", "rotaciones", "disciplina"].includes(preset) ? preset : "resumen";
  const metricId = (id: string) => /^(?:\d{3}|A\d{2})$/.test(id);
  const columns = typeof search.columnas === "number" ? String(search.columnas) : search.columnas;
  const order = str(search.orden);
  out.wsColumns = typeof columns === "string" ? [...new Set(columns.split(",").filter(metricId))].slice(0, 412) : undefined;
  out.wsSort = order && metricId(order) ? order : undefined;
  out.wsDirection = search.sentido === "asc" ? "asc" : "desc";
  out.wsQuery = str(search["buscar-columna"]) ?? "";
  out.wsFamily = str(search["familia-columna"]) ?? "";
  // the sheets with an address
  const metrica = str(search.metrica);
  const hoja = sheetOfHoja(search.hoja);
  if (sc.ysi) out.sheet = "ysi";
  else if (typeof search.buscar === "string") {
    out.sheet = "search";
    out.sq = search.buscar;
  } else if (metrica) {
    out.sheet = "metric";
    out.sheetId = metrica;
  } else if (pid && sc.place !== "jugadores") {
    // (round 3 opened a player's sheet over any screen: «El palco» shows him in Jugadores)
    Object.assign(out, { place: "jugadores", jugView: "ranking", pick: pid });
  } else if (str(search.rival) && sc.place !== "rivales") {
    Object.assign(out, { place: "rivales", rival: str(search.rival) });
  } else if (hoja && hoja.sheet !== "info") {
    out.sheet = hoja.sheet;
    out.sheetId = hoja.id;
  }
  return out;
}

export interface UrlCtx {
  people: PeopleIndex;
  /** ?temporada= when another season than the one being played is open. */
  seasonWord: string | undefined;
  /** The moviola's edge: hasta= only while it looks back. */
  edge: number;
  /** A narrow screen shows the chosen player and rival in a sheet (same address). */
  narrow: boolean;
}

/** The address of the page state: the path, and every parameter (undefined: not in the address). */
export function urlOf(st: NuState, ctx: UrlCtx): { path: string; search: Record<string, string | undefined> } {
  const s: Record<string, string | undefined> = {};
  const all = st.temporada === "todas";
  s.temporada = all ? "todas" : ctx.seasonWord;
  if (!all && st.upto < ctx.edge) s.hasta = `j${st.upto}`;
  if (st.campo !== "todo") s.campo = st.campo;
  if (st.partidos.length) s.partidos = st.partidos.join(",");
  if (st.jug.length) s.jugadores = st.jug.map(ctx.people.word).join(",");
  if (st.wsSet && st.wsSet !== "resumen") s.vista = st.wsSet;
  if (st.wsColumns !== undefined) s.columnas = st.wsColumns.join(",");
  if (st.wsSort) s.orden = st.wsSort;
  if (st.wsDirection === "asc") s.sentido = "asc";
  if (st.wsQuery) s["buscar-columna"] = st.wsQuery;
  if (st.wsFamily) s["familia-columna"] = st.wsFamily;
  if (st.place === "jugadores" && st.jugView === "ranking") {
    s.ranking = rankingParam(st.rankK);
    if (st.pick) s.jugador = ctx.people.word(st.pick);
    if (st.vsOn && st.vsB) s.contra = ctx.people.word(st.vsB);
  }
  if (st.place === "jugadores" && st.jugView === "campo" && st.campoView !== "puestos" && st.star) s.estrella = ctx.people.word(st.star);
  if (st.place === "jugadores" && st.jugView === "campo" && st.campoView === "puestos" && st.puesto) s.puesto = st.puesto.toLowerCase();
  if (st.place === "juego") {
    if (st.team === "them") s.equipo = "rival";
    if (st.parte !== "all") s.parte = st.parte;
    if (st.grow === "catalogo") {
      if (st.catFam) s.familia = slug(st.catFam);
      if (st.catX) s["fuera-del-audio"] = "1";
      if (st.catQ) s.q = st.catQ;
    }
  }
  if (st.place === "rivales" && st.rival) s.rival = slug(st.rival);
  if ((st.place === "temporada" && st.allTable) || (st.place === "jugadores" && st.grow === "jugadores")) s.ver = "todo";
  if (st.sheet === "player" && st.sheetId && st.place !== "jugadores") s.jugador = ctx.people.word(st.sheetId);
  if (st.sheet === "rival" && st.sheetId && st.place !== "rivales") s.rival = slug(st.sheetId);
  if (st.sheet === "metric" && st.sheetId) s.metrica = st.sheetId;
  if (st.sheet === "search") s.buscar = st.sq;
  s.hoja = hojaOf(st.sheet, st.sheetId);
  return { path: pathOf(st), search: s };
}

/** One string for an address, to tell whether the page already shows it. */
export function addressKey(path: string, search: Search): string {
  const keys = Object.keys(search)
    .filter((k) => search[k] !== undefined && search[k] !== null && k !== "season")
    .sort();
  return `${trim(path)}?${keys.map((k) => `${k}=${Array.isArray(search[k]) ? (search[k] as unknown[]).join(",") : String(search[k])}`).join("&")}`;
}
