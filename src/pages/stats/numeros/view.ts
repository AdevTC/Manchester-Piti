// «Números» (NU- boards, round 3): everything the page shows, computed from the season — the identity header and
// the time bar, the rail with each section's live headline, the six screens, what grows in place and the sheets.
// A port of the boards' renderVals (component.js), word for word; the page (NumerosPage) owns the state and the
// address and passes the actions in `act`.
import { numerosActions, numerosMatches, numerosMetrics } from "./analysis";
import { buildAnalysisWorkspace, formatWorkspaceMetric, selectAnalysisMatches, sortAnalysisRows, workspaceMetricValue, ANALYSIS_WORKSPACE_PRESETS } from "../../../lib/analysisWorkspace";
import { NARRATED_METRICS } from "../../../../functions/src/narrated/catalogIndex";
import type { AnalysisFilters, MetricResult } from "../../../../functions/src/narrated/types";
import { NU_GLOSS, NU_MET, NU_METRICS, metricLower, unitOf } from "./glossary";
import type { CatRow } from "./catalog";
import { tonightWord, TonightWord } from "../../../lib/derived/madrid";
import { logoOf } from "../../../lib/derived/rivalLogo";
import { clock, dec, list, pct, posWith, result, slug, strip, table, type Moment, type ND, type NMatch, type NSeasonData, type PRow, type Se, type TRow } from "./nd";

/** The sections the numbers are computed for (the round-3 screens); the page shows them in four places. */
export const SECTIONS = ["temporada", "jugadores", "campo", "juego", "rivales", "records"] as const;
export type Section = (typeof SECTIONS)[number];
export const SECTION_LABEL: Record<Section, string> = { temporada: "Temporada", jugadores: "Jugadores", campo: "El campo", juego: "El juego", rivales: "Rivales", records: "Récords" };
/** «El palco»: the four places on the shelf. El campo lives in Jugadores (and its systems in Temporada), Récords in both. */
export const PLACES = ["temporada", "jugadores", "juego", "rivales"] as const;
export type Place = (typeof PLACES)[number];
export const PLACE_LABEL: Record<Place, string> = { temporada: "Temporada", jugadores: "Jugadores", juego: "El juego", rivales: "Rivales" };
export const isPlace = (s: string): s is Place => (PLACES as readonly string[]).includes(s);
export type Grow = "tabla" | "jugadores" | "mesa" | "catalogo" | "graficas" | "rivales";
export type Sheet = "scope" | "ysi" | "player" | "rival" | "metric" | "info" | "search" | "stats" | "export";
export type CampoView = "pases" | "puestos" | "sistemas";
export type RecView = "rachas" | "marcas" | "cromos" | "evolucion";
/** Jugadores' three views: the ranking with the player's card, the pitch (pases de gol, puestos), the evolution. */
export type JugView = "ranking" | "campo" | "evo";

/** The page's state: the part in the address (NumerosPage reads and writes it) and the part that is only the screen's. */
export interface NuState {
  place: Place;
  upto: number;
  playing: boolean;
  raceK: "goles" | "asist" | "ga";
  star: string | null;
  temporada: "esta" | "todas";
  campo: "todo" | "casa" | "fuera";
  jug: string[];
  partidos: string[];
  grow: Grow | null;
  sheet: Sheet | null;
  sheetId: string | null;
  rankK: string;
  pick: string | null;
  rival: string | null;
  campoView: CampoView;
  puesto: string;
  team: "us" | "them";
  parte: "all" | "1" | "2";
  recView: RecView;
  cromoK: "todos" | "goles" | "partidos";
  evoK: "goles" | "asist" | "ga" | "pj" | "min";
  ysi: Record<string, "g" | "e" | "p" | null>;
  sortK: string;
  q: string;
  rq: string;
  catQ: string;
  catFam: string;
  catN: number;
  catX: boolean;
  allStats: boolean;
  colSet: string;
  wsSet: string;
  wsColumns?: string[];
  wsSort?: string;
  wsDirection?: "asc" | "desc";
  wsQuery?: string;
  wsFamily?: string;
  clockK: "ambos" | "favor" | "contra";
  streakK: "g" | "a" | "ga" | "p" | "c";
  evoIds: string[] | null;
  sq: string;
  /** «El palco»: Jugadores' view, the second player of «Cara a cara» (on while vsOn), the whole ranking or table. */
  jugView: JugView;
  vsOn: boolean;
  vsB: string | null;
  allRank: boolean;
  allTable: boolean;
  /** The jornada picked on la cinta (its match key); null: the one the season is at. */
  jkey: string | null;
  /** `upto` was set by «Repasar la temporada» (paused or running), not by «Hasta la J…». */
  replay: boolean;
  /** The export sheet's format. */
  exFmt: "json" | "csv";
}

export interface Act {
  set: (p: Partial<NuState>) => void;
  open: (sheet: Sheet, id?: string | null) => void;
  closeSheet: () => void;
  /** To a section: El campo and Récords land in the place that holds them now. */
  go: (place: Section, patch?: Partial<NuState>) => void;
  grow: (g: Grow | null) => void;
  say: (t: string) => void;
  /** Leaves the moviola where it is and stops «Repasar». */
  stop: () => void;
  seek: (j: number) => void;
  /** «Repasar la temporada»: play, or pause; a paused replay goes on from its jornada. */
  play: () => void;
  narrow: () => boolean;
  /** A question or a search result: closes the sheet, sets the screen's view and goes there (then opens a sheet). */
  ask: (place: Section, patch: Partial<NuState>, sheet?: Sheet, id?: string) => void;
  csv: (kind: "jugadores" | "mesa") => void;
  json: () => void;
}

export interface Viewer {
  kind: "fan" | "socio" | "jugador";
  playerId: string | null;
  name: string;
  /** The viewer's row in the porra (a player id, or «u:<uid>» for a member without a player file). */
  porraKey: string | null;
}

export interface Env {
  nd: ND;
  S: NSeasonData;
  moment: Moment;
  /** The other seasons, for «Todas». */
  others: { S: NSeasonData; moment: Moment }[];
  viewer: Viewer;
  catalog: CatRow[] | null;
  /** DEV board strip's demo data: «cerrada» says it is the long season cut at the J16. */
  demo: boolean;
  /** The date stamp of the JSON export. */
  today: string;
  /** Every rival's escudo (rivalLogos of all the matches). */
  logos?: ReadonlyMap<string, string>;
}

/** «1 parada», «3 paradas»: a number with its word in the right number. */
const nW = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
/** «1 partido marcando», never «1 partidos marcando». */
const ONE_STREAK: Record<string, string> = { "Victorias seguidas": "Victoria seguida", "Partidos sin perder": "Partido sin perder", "Partidos marcando": "Partido marcando", "Porterías a cero": "Portería a cero" };

const NO_ROW = (id: string, name: string): PRow =>
  ({ id, name, n: "", pj: 0, tit: 0, g: 0, a: 0, yc: 0, rc: 0, saves: 0, min: 0, mvp: 0, minKnown: false, ban: 0, nc: 0, sin: 0, sout: 0, partner: null, partnerN: 0,
    gStreak: { best: 0, cur: 0, from: null, to: null }, next: 1, per50: "0,0", winPct: 0, tech: false, pok: 0, pko: 0, passPct: null, rec: 0, tov: 0, pos: {}, ga: 0 }) as unknown as PRow;
const SUMMARY_METRICS = ["015", "105", "067", "070", "029", "030", "106", "114", "206", "201", "169", "173", "151", "135", "272", "300"];

export function numerosView(st: NuState, env: Env, act: Act) {
  const { nd: ND, viewer } = env;
  const q = viewer.kind;
  const se: Se = ND.season(env.S, env.moment);
  const edge = se.edge;
  const all = st.temporada === "todas";
  const upto = all ? edge : Math.min(Math.max(1, st.upto), edge);
  const scrubbed = upto < edge;
  const withLive = se.live && !scrubbed;
  let gs = ND.games(se, upto, st.campo, withLive);
  if (all) {
    const rest = env.others.flatMap((o) => {
      const s2 = ND.season(o.S, o.moment);
      return ND.games(s2, s2.edge, st.campo, false);
    });
    gs = rest.concat(gs);
  }
  if (st.partidos.length) gs = gs.filter((m) => st.partidos.includes(m.id));
  const sourceMatches = numerosMatches(gs);
  const hasAnalysisSource = sourceMatches.length > 0;
  const analysisFilters = { team: st.team === "them" ? "opponent" : "us", ...(st.parte !== "all" ? { period: Number(st.parte) } : {}), ...(st.jug.length ? { playerIds: st.jug } : {}) } satisfies AnalysisFilters;
  const analysisMatchIds = new Set(selectAnalysisMatches(sourceMatches, analysisFilters).map(match => match.id));
  const analysis = { matches: sourceMatches.filter(match => analysisMatchIds.has(match.id)), filters: analysisFilters };
  // Filter metadata before calculating: only the displayed page and an explicitly opened
  // detail need values. The custom table is the one view that needs every availability.
  const CAT = env.catalog ?? [];
  const FAMS = [...new Set(CAT.map(c => c[1]))];
  const famSel = st.catFam ? (FAMS.find(f => slug(f) === slug(st.catFam)) ?? "") : "";
  const cq = st.catQ.toLowerCase();
  const catAll = CAT.filter(c => (st.catX || !c[5]) && (!famSel || c[1] === famSel) && (!cq || c[2].toLowerCase().includes(cq) || c[0].toLowerCase().includes(cq) || c[3].toLowerCase().includes(cq)));
  const tableOpen = st.grow === "mesa";
  const requestedMetrics = tableOpen ? NARRATED_METRICS.map(m => m.id) : [...SUMMARY_METRICS,
    ...(st.grow === "catalogo" ? catAll.slice(0, st.catN).map(c => c[0]) : []),
    ...(st.sheet === "metric" && st.sheetId ? [st.sheetId] : []),
  ];
  const metrics = numerosMetrics(analysis.matches, analysis.filters, requestedMetrics);
  const actions = numerosActions(analysis.matches, analysis.filters);
  const gsDone = gs.filter((m) => m.st === "fin");
  const T = ND.team(gs);
  const rs = ND.rows(gs, st.jug);
  const rsAll = ND.rows(gs);
  const member = q !== "fan";
  const myId = viewer.playerId;
  const liveM = se.matches.find((m) => m.st === "live") ?? null;
  const atM = se.matches.find((m) => m.j === upto) ?? null;
  const place: Section = st.place;
  const set = (p: Partial<NuState>) => () => act.set(p);
  const you = (id: string | null | undefined) => !!id && id === myId;
  const fmtRes = (m: Pick<NMatch, "gf" | "ga"> | null | undefined) => (!m || m.gf == null ? "" : `${m.gf}–${m.ga}`);
  const vs = (m: NMatch) => `${m.home ? "contra " : "en casa de "}${m.rival}`;
  const verb = (m: NMatch) => {
    const r = result(m);
    return m.st === "live" ? `Vamos ${fmtRes(m)}, en directo,` : r === "g" ? `Ganamos ${fmtRes(m)}` : r === "e" ? `Empatamos ${fmtRes(m)}` : `Perdimos ${fmtRes(m)}`;
  };
  const rowOf = (id: string) => rsAll.find((r) => r.id === id);
  const ini = (n: string) => {
    const w = n
      .replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9 ]/g, "")
      .split(" ")
      .filter((x) => x && !/^(fc|cf|f|c|de|del|la|el|los|las)$/i.test(x) && !/^[0-9]+$/.test(x));
    return (w.length > 1 ? w[0].charAt(0) + w[1].charAt(0) : (w[0] || n).slice(0, 2)).toUpperCase();
  };
  const info = (k: string) => () => act.open("info", k);
  const pendingN = se.matches.filter((m) => m.st === "por").length;

  // ---------- the table (none until the captain publishes it)
  const tbl = table(se, withLive && !all);
  const usRow = tbl.find((r) => r.us);
  const hasTable = tbl.length > 0;
  const tableReal = hasTable && !scrubbed && !all && st.campo === "todo" && !st.partidos.length;
  const pos = usRow ? `${usRow.pos}º` : "–";

  // ---------- the identity header and the time bar
  const allNames = [env.S.name, ...env.others.map((o) => o.S.name)];
  const lede = all
    ? `${allNames.length > 1 ? `${list(allNames)}, juntas` : `${env.S.name}, entera`}. La moviola recorre una temporada: con todas, se ven los totales.`
    : se.closed
      ? `${se.S.name}, cerrada después de ${nW(se.jornadas, "jornada", "jornadas")}.${env.demo ? ` (Demo: la temporada larga cortada en la J${se.jornadas}.)` : ""}`
      : withLive
        ? `${se.S.name}, con la J${edge} en directo: lo de borde discontinuo es «si acaba así» hasta que haya acta.`
        : scrubbed
          ? `Estás viendo la temporada tal como estaba tras la J${upto}.`
          : !gsDone.length
            ? `${se.S.name}. Aún no se ha jugado ninguna jornada: todos a cero${pendingN ? `; ${pendingN === 1 ? "queda" : "quedan"} ${pendingN} por jugar.` : "."}`
            : st.partidos.length
              ? `${se.S.name}: ${st.partidos.length === 1 ? "solo el partido elegido" : `los ${st.partidos.length} partidos elegidos`}.`
              : `${se.S.name}, después de ${gsDone.length === 1 ? "la primera jornada" : `${gsDone.length} jornadas`}. Oficial desde el acta${se.S.real ? `; ${pendingN === 1 ? "queda" : "quedan"} ${pendingN} por jugar.` : "."}`;
  let maxG = 1;
  se.matches.forEach((m) => {
    if (m.gf != null) maxG = Math.max(maxG, m.gf, m.ga ?? 0);
  });
  const cols = se.matches.map((m) => {
    const r = result(m);
    const later = m.j > upto;
    const live = m.st === "live";
    const kind = m.st === "apl" ? "apl" : m.st === "por" ? "por" : live ? "live" : (r ?? "por");
    return {
      key: m.id,
      up: m.gf == null ? 0 : Math.round((m.gf / maxG) * 100),
      down: m.ga == null ? 0 : Math.round((m.ga / maxG) * 100),
      letter: kind === "g" || kind === "live" ? "G" : kind === "e" ? "E" : kind === "p" ? "P" : "",
      cls: [`nu-col--${kind}`, later && m.gf != null ? "is-later" : "", m.j === upto ? "is-at" : "", live ? "is-live" : ""].join(" ").trim(),
      label: `J${m.j}, ${m.gf == null ? `${m.st === "apl" ? "aplazado" : `por jugar, ${m.day}`} ${vs(m)}` : `${verb(m)} ${vs(m)}`}`,
      go: () => {
        if (m.gf == null || all) {
          act.say(`J${m.j}: ${m.st === "apl" ? "aplazado" : `por jugar, ${m.day} a las ${m.time}`}, ${vs(m)}.`);
          return;
        }
        act.stop();
        act.seek(m.j);
      },
    };
  });
  const tip = atM ? `J${atM.j} · ${atM.gf == null ? (atM.st === "apl" ? "aplazado" : "por jugar") : fmtRes(atM) + (atM.st === "live" ? ", en directo" : "")} · ${atM.rival}` : "";
  const nPart = st.partidos.length;
  const scopeBits = [
    all ? "Todas las temporadas" : se.S.name,
    all ? "" : scrubbed ? `hasta la J${upto}` : se.closed ? "entera" : "al día",
    st.campo === "casa" ? "en casa" : st.campo === "fuera" ? "fuera" : "",
    nPart ? `${nPart}${nPart === 1 ? " partido elegido" : " partidos elegidos"}` : "",
    st.jug.length ? `${st.jug.length}${st.jug.length === 1 ? " jugador" : " jugadores"}` : "",
  ].filter(Boolean);
  const tracked = gs.filter((m) => m.minutes).length;
  const off = all || edge < 2;
  const time = {
    cols, n: se.jornadas, upto, max: edge,
    headPct: (((upto - 0.5) / Math.max(1, se.jornadas)) * 100).toFixed(2),
    edgePct: ((edge / Math.max(1, se.jornadas)) * 100).toFixed(2),
    tip,
    valueText: atM ? `J${atM.j}, ${atM.gf == null ? `${atM.st === "apl" ? "aplazado" : "por jugar"} ${vs(atM)}` : `${verb(atM)} ${vs(atM)}`}` : "",
    playing: st.playing, playIcon: st.playing ? ("pause" as const) : ("play" as const), playLabel: st.playing ? "Pausa" : "Repasar",
    back: scrubbed && !all, backLabel: se.live ? "Volver al directo" : "Volver a hoy", off,
    cls: [st.playing ? "is-playing" : "", off ? "is-off" : "", scrubbed ? "is-scrubbed" : ""].join(" ").trim(),
    offNote: edge < 2 && !all ? "Con una jornada jugada, la moviola se estrena en la J2: entonces podrás volver a cada jornada." : all ? "Con todas las temporadas, la moviola descansa." : "",
    jLabel: all ? "Todas" : `J${upto}`,
    scopeT: all ? "Todas las temporadas" : se.S.name,
    scopeS: scopeBits.slice(1).concat([`${T.pj}${T.pj === 1 ? " partido" : " partidos"}`]).join(" · "),
    scopeLabel: `Qué números ver: ${scopeBits.join(", ")}`,
    scopeCls: all || st.campo !== "todo" || st.jug.length > 0 || nPart ? "is-filtered" : "",
    info: info("moviola"),
  };
  // (with «Todas», every season's played matches: a match of another season can be chosen too)
  const playedAll = (all ? env.others.flatMap((o) => ND.season(o.S, o.moment).matches).concat(se.matches) : se.matches).filter((m) => m.st === "fin" || m.st === "live");
  const scope = {
    seasonOpts: [
      { t: se.S.name, on: !all, pick: set({ temporada: "esta", partidos: [] }) },
      { t: "Todas", on: all, pick: set({ temporada: "todas", partidos: [] }) },
    ],
    seasonI: all ? 1 : 0,
    campoOpts: (
      [
        ["todo", "Todo"],
        ["casa", "En casa"],
        ["fuera", "Fuera"],
      ] as const
    ).map((c) => ({ t: c[1], on: st.campo === c[0], pick: set({ campo: c[0] }) })),
    campoI: ["todo", "casa", "fuera"].indexOf(st.campo),
    matches: playedAll.map((m) => {
      const on = st.partidos.includes(m.id);
      return { key: m.id, t: `J${m.j} · ${m.rival}`, s: fmtRes(m) + (m.st === "live" ? ", en directo" : ""), on, pick: () => act.set({ partidos: on ? st.partidos.filter((x) => x !== m.id) : [...st.partidos, m.id] }) };
    }),
    people: ND.IDS.map((id) => {
      const on = st.jug.includes(id);
      return { key: id, t: ND.name(id), n: ND.num(id), on, pick: () => act.set({ jug: on ? st.jug.filter((x) => x !== id) : [...st.jug, id] }) };
    }),
    clear: () => {
      act.set({ temporada: "esta", campo: "todo", jug: [], partidos: [], upto: edge });
      act.say("Filtros quitados.");
    },
    players: st.jug.length > 0,
    count: `${T.pj}${T.pj === 1 ? " partido" : " partidos"} · ${rs.filter((r) => r.pj).length} jugadores · ${tracked}${tracked === 1 ? " acta con minutos" : " actas con minutos"}`,
  };

  // ---------- Temporada
  const usI = usRow ? tbl.indexOf(usRow) : -1;
  const trow = (r: TRow) => ({
    key: r.team, pos: r.pos, team: r.team, pj: r.pj, g: r.g, e: r.e, p: r.p, gf: r.gf, gc: r.gc,
    dg: (r.dg > 0 ? "+" : r.dg < 0 ? "−" : "") + Math.abs(r.dg), pts: r.pts,
    cls: [r.us ? "is-us" : "", r.prov ? "is-prov" : "", r.prov && !r.us ? "is-rival" : "", r.pos === 1 && se.closed ? "is-champ" : ""].join(" ").trim(),
    us: r.us, prov: !!r.prov && r.us, gap: false, gapT: "",
  });
  type FRow = ReturnType<typeof trow>;
  let focusRows: FRow[] = [];
  const gapRow = (t: string): FRow => ({ ...trow({ ...tbl[0], team: "" }), key: t, gap: true, gapT: t });
  if (tbl.length <= 8 || usI < 0) focusRows = tbl.slice(0, 8).map(trow);
  else {
    const lo = Math.max(0, usI - 2);
    const hi = Math.min(tbl.length - 1, usI + 2);
    if (lo > 0) {
      focusRows.push(trow(tbl[0]));
      if (lo > 1) focusRows.push(gapRow(`${lo - 1} equipos más arriba`));
    }
    for (let i = lo; i <= hi; i++) focusRows.push(trow(tbl[i]));
    if (hi < tbl.length - 1) focusRows.push(gapRow(`${tbl.length - 1 - hi} equipos más abajo`));
  }
  const played = se.matches.filter((m) => m.st === "fin" && m.j <= upto);
  const form = played.slice(-6).map((m) => {
    const r = result(m) ?? "e";
    return { key: m.id, l: r.toUpperCase(), cls: `vd-form__l--${r}`, label: `J${m.j}, ${{ g: "ganado", e: "empate", p: "perdido" }[r]}` };
  });
  if (withLive && liveM) {
    const r = result(liveM) ?? "e";
    form.push({ key: liveM.id, l: r.toUpperCase(), cls: "vd-form__l--prov", label: `J${liveM.j}, ${{ g: "ganando", e: "empatando", p: "perdiendo" }[r]}, provisional` });
  }
  const toPlay = se.matches.filter((m) => (m.st === "por" || m.st === "apl") && !se.closed);
  toPlay
    .filter((m) => m.j > upto)
    .slice(0, form.length < 3 ? 4 : 1)
    .forEach((m) => form.push({ key: m.id, l: `J${m.j}`, cls: "vd-form__l--empty", label: `J${m.j}, por jugar` }));
  const keepers = Object.keys(T.keepers).map((k) => `${ND.name(k)}, ${T.keepers[k]}`);
  let acc = 0;
  const journey = played.map((m) => {
    const r = result(m) ?? "e";
    acc += r === "g" ? 3 : r === "e" ? 1 : 0;
    return { key: m.id, j: `J${m.j}`, rival: m.rival, where: m.home ? "En casa" : "Fuera", res: fmtRes(m), l: r.toUpperCase(), cls: `vd-form__l--${r}`, pts: `${acc}`, unit: " pts", w: 0, at: m.j === upto ? "is-at" : "", href: `/partidos/${m.id}` };
  });
  const maxPts = Math.max(3, acc);
  journey.forEach((x) => (x.w = Math.round((Number(x.pts) / maxPts) * 100)));
  const calendar = journey.concat(
    se.matches
      .filter((m) => m.st !== "fin" && m.j > (played.length ? upto : 0))
      .map((m) => ({
        key: m.id, j: `J${m.j}`, rival: m.rival, where: `${m.home ? "En casa" : "Fuera"} · ${m.day}, ${m.time}`, res: m.st === "live" ? fmtRes(m) : "", l: "", cls: "vd-form__l--empty",
        pts: m.st === "apl" ? "aplazado" : m.st === "live" ? "en directo" : "por jugar", unit: "", w: 0, at: "", href: `/partidos/${m.id}`,
      })),
  );
  // «El palco»: who scored in each match with a score (la cinta's jornada card), whatever the filters cut
  const who: Record<string, string> = {};
  se.matches.forEach((m) => {
    if (m.gf != null) who[m.id] = m.goals.length ? m.goals.map((g) => `${ND.name(g[0])} ${g[2]}′`).join(", ") : "Sin goles del Piti";
  });
  const champ = se.closed && hasTable ? tbl[0] : null;
  const mvpTop = ND.ranked(
    rsAll.filter((r) => r.mvp),
    "mvp",
  )[0];
  const lastPlayed = played[played.length - 1];
  const lastVote = lastPlayed?.vote ?? null;
  const kpis = [
    { v: T.pj, t: T.pj === 1 ? "partido" : "partidos" }, { v: T.g, t: T.g === 1 ? "victoria" : "victorias" }, { v: T.e, t: T.e === 1 ? "empate" : "empates" }, { v: T.p, t: T.p === 1 ? "derrota" : "derrotas" },
    { v: T.gf, t: "goles a favor" }, { v: T.ga, t: "goles en contra" }, { v: T.pj ? dec(T.gf / T.pj) : "0,0", t: "goles por partido" }, { v: `${pct(T.g, T.pj)} %`, t: "de victorias" },
    { v: T.pts, t: `puntos, de ${T.pj * 3}` }, { v: T.cs, t: T.cs === 1 ? "portería a cero" : "porterías a cero", s: keepers.join(" · ") }, { v: T.yc, t: T.yc === 1 ? "amarilla" : "amarillas" },
    { v: se.closed ? 0 : toPlay.length, t: "por jugar", s: toPlay.filter((m) => m.st === "apl").length ? `${toPlay.filter((m) => m.st === "apl").length} aplazadas` : "" },
  ];
  const mvpLine = mvpTop
    ? `Más veces MVP: ${mvpTop.name} (${mvpTop.mvp})${se.S.mvpDemo ? " · demo" : ""}`
    : lastVote && lastVote.open
      ? `La votación del MVP de la J${lastPlayed.j} sigue abierta: ${lastVote.total} de ${lastVote.eligible} votos. El MVP sale al cerrarla.`
      : "Aún sin MVP: sale al cerrar la votación de cada partido.";
  // «Lo que dicen los números»: lines that write themselves
  const said: string[] = [];
  const topG = ND.ranked(rsAll, "goles").filter((r) => r.rank === 1 && r.g > 0);
  if (topG.length)
    said.push(topG.length > 1 ? `Pichichi compartido: ${list(topG.map((r) => r.name))}, con ${topG[0].g}.` : `${topG[0].name} manda en los goles, con ${topG[0].g}${topG[0].g === 1 ? " gol." : " goles."}`);
  let firstGoal: { m: NMatch; g: [string, string | null, number] } | null = null;
  gsDone.forEach((m) => {
    if (!firstGoal && m.goals.length) firstGoal = { m, g: m.goals.slice().sort((a, b) => a[2] - b[2])[0] };
  });
  const fg = firstGoal as { m: NMatch; g: [string, string | null, number] } | null;
  if (fg) said.push(`El primer gol de la temporada fue de ${ND.name(fg.g[0])}, en el ${fg.g[2]}′ de la J${fg.m.j}.`);
  const techRows = rsAll.filter((r) => r.tech);
  if (techRows.length) {
    const bestSv = ND.ranked(techRows, "sv")[0];
    const bestPok = ND.ranked(techRows, "pok")[0];
    const bestRec = ND.ranked(techRows, "rec")[0];
    if (bestSv && bestSv.saves) said.push(`${bestSv.name} hizo ${nW(bestSv.saves, "parada", "paradas")}.`);
    if (bestPok && bestPok.pok) said.push(`${bestPok.name} es quien más pases completa: ${bestPok.pok}.`);
    if (bestRec && bestRec.rec) said.push(`${bestRec.name} recupera más balones que nadie: ${bestRec.rec}.`);
  }
  const subsN = gsDone.reduce((s, m) => s + (m.subs || 0), 0);
  if (subsN) said.push(`${subsN} cambios en ${gsDone.length === 1 ? "un partido" : `${gsDone.length} partidos`}: en fútbol 7 se entra y se sale las veces que haga falta.`);
  const tsNow = ND.teamStreaks(gsDone).find((x) => x.s.cur >= 2);
  if (tsNow) said.push(`${tsNow.k}: ${tsNow.s.cur} y contando.`);
  const recs0 = ND.recordsOf(gsDone);
  if (recs0.bigWin) said.push(`La mayor victoria: ${fmtRes(recs0.bigWin)} ${vs(recs0.bigWin)}, en la J${recs0.bigWin.j}.`);
  if (lastVote && lastVote.open) said.push(`La votación del MVP de la J${lastPlayed.j} sigue abierta (${lastVote.total} de ${lastVote.eligible}).`);
  // La carrera
  const rk = ND.ranked(rsAll, st.raceK);
  const maxV = Math.max(1, rk[0] ? rk[0].val : 1);
  const nz = rk.filter((r) => r.val > 0).length;
  const lead = scrubbed || all ? {} : ND.inLead(se, upto, st.raceK);
  const leadTop = Object.keys(lead).sort((a, b) => lead[b] - lead[a])[0];
  const race = rk.map((r, i) => ({
    key: r.id, id: r.id, name: r.name, n: r.n, val: r.val, rank: r.rank, i, w: Math.round((r.val / maxV) * 100), you: you(r.id),
    cls: [i >= 6 || (r.val === 0 && nz > 0) ? "is-out" : "", you(r.id) ? "is-you" : "", r.val === 0 ? "is-zero" : ""].join(" ").trim(),
    pick: () => act.open("player", r.id),
  }));
  const leaders = rk.filter((r) => r.rank === 1 && r.val > 0);
  const raceLabel = { goles: "goles", asist: "asistencias", ga: "goles y asistencias" }[st.raceK];
  const nScorers = rk.filter((r) => r.val > 0).length;
  const tem = {
    kick: all ? "Todas las temporadas" : `${se.S.name}${se.S.league ? ` · ${se.S.league}` : ""}`,
    title: tableReal
      ? se.closed
        ? `Así acabó: ${pos}`
        : withLive
          ? `${pos}, si acaba así`
          : `${pos} en la tabla`
      : `${T.pts}${T.pts === 1 ? " punto" : " puntos"}${all ? ", todas las temporadas" : scrubbed ? ` tras la J${upto}` : nPart ? (nPart === 1 ? " en el partido elegido" : ` en los ${nPart} partidos elegidos`) : !hasTable ? ` tras ${T.pj === 1 ? "la primera jornada" : `${T.pj} jornadas`}` : ` tras la J${upto}`}`,
    sub: `${T.g}G ${T.e}E ${T.p}P · ${T.gf}–${T.ga}${st.campo !== "todo" ? (st.campo === "casa" ? " en casa" : " fuera") : ""}${!hasTable ? " · la liga aún no ha publicado la clasificación" : ""}`,
    prov: withLive && tableReal,
    showTable: hasTable && (tableReal || all || st.campo !== "todo" || nPart > 0),
    showJourney: hasTable && scrubbed && !all,
    noTable: !hasTable,
    tableT: se.closed ? "La clasificación final" : withLive && tableReal ? "La clasificación, si acaba así" : "La clasificación",
    tableSub: tableReal
      ? se.closed
        ? `${tbl.length} equipos.`
        : withLive && liveM
          ? `Con el ${fmtRes(liveM)} de ${tonightWord(liveM.time)}; la fila del Piti, discontinua hasta el acta.`
          : `Después de la J${edge}, ${tbl.length} equipos.`
      : "La tabla de la liga es la de hoy; el filtro solo cambia los números del Piti.",
    rows: focusRows, all: tbl.map(trow), n: tbl.length, more: tbl.length > 8, seeAll: `Ver la tabla entera (${tbl.length})`, summary: `${tbl.length} equipos; vas ${pos}`,
    journey, recent: journey.slice(-5).reverse(), hasRecent: journey.length > 1,
    journeyT: `Jornada a jornada, hasta la J${upto}`, journeySub: `La liga guarda su tabla al día; tras la J${upto} llevábamos ${T.pts} puntos.`,
    calendar, calT: "Nuestra temporada, jornada a jornada", who,
    calSub: `La liga aún no ha publicado la clasificación. En cuanto el capitán la suba, aquí verás la tabla, «si acaba así» durante los partidos y «¿Y si…?». Mientras, nuestro calendario: ${played.length} jugada${played.length === 1 ? "" : "s"} y ${toPlay.length} por jugar.`,
    form, hasForm: form.length > 0, kpis, mvpLine, said: said.slice(0, 5), hasSaid: said.length > 0,
    champ: !!champ, champT: champ ? `${champ.us ? "¡Campeones! " : "Campeón: "}${champ.team}, ${champ.pts} puntos.` : "",
    ysi: hasTable && !se.closed && !all, ysiWait: !hasTable && !se.closed,
    openAll: () => act.grow("tabla"), openYsi: () => act.open("ysi"),
    race, raceRows: Math.max(1, Math.min(6, nz || 6)),
    raceOpts: (
      [
        ["goles", "Goles"],
        ["asist", "Asist."],
        ["ga", "G+A"],
      ] as const
    ).map((v) => ({ t: v[1], on: st.raceK === v[0], pick: set({ raceK: v[0] }) })),
    raceI: ["goles", "asist", "ga"].indexOf(st.raceK),
    raceCap: leaders.length ? `En cabeza tras la J${upto}: ${list(leaders.map((r) => r.name))}, ${leaders[0].val}` : `Nadie ${st.raceK === "asist" ? "ha dado un pase de gol" : "ha marcado"} aún: el primero estrena la carrera.`,
    raceSub:
      leadTop && lead[leadTop] > 1
        ? `Más jornadas en cabeza: ${ND.name(leadTop)} (${lead[leadTop]})`
        : nScorers <= 1 && played.length <= 1
          ? "Con una jornada, la carrera acaba de empezar: cada gol moverá las filas."
          : "Repasa la temporada en la cinta: las filas se reordenan solas.",
    raceSR: `La carrera de ${raceLabel} tras la J${upto}: ${rk
      .slice(0, 5)
      .map((r) => `${r.rank}º ${r.name}, ${r.val}`)
      .join("; ")}`,
    i: { tabla: info("tabla"), forma: info("forma"), kpis: info("kpis"), ysi: info("ysi"), carrera: info("carrera"), dicen: info("dicen"), siacaba: info("siacaba") },
  };

  // ---------- Jugadores: every one of the app's metrics, one consistent ranking
  const minKnown = gs.length > 0 && rs.every((r) => r.minKnown || !r.pj);
  const rkK = NU_MET[st.rankK] || st.rankK === "porra" ? st.rankK : "goles";
  const porra = rkK === "porra";
  const locked = porra && !member;
  const MD = NU_MET[rkK] || NU_MET.goles;
  const techAny = rsAll.some((r) => r.tech);
  interface RRow {
    key: string;
    id: string;
    name: string;
    n: number | "";
    val: number;
    rank: number;
    you: boolean;
    w: number;
    cls: string;
    nCls: string;
    img: string;
    hasImg: boolean;
    alt: string;
    pick: () => void;
  }
  let rankRows: RRow[] = [];
  const mkRow = (id: string, val: number, rank: number, isYou: boolean): RRow => ({ key: id, id, name: ND.name(id), n: ND.num(id), val, rank, you: isYou, w: 0, cls: "", nCls: "", img: "", hasImg: false, alt: "", pick: () => {} });
  if (porra) {
    const pr = env.S.porra?.rows ?? [];
    rankRows = pr.map((x, i) => mkRow(x[0], x[1], i + 1, you(x[0]) || (!!viewer.porraKey && x[0] === viewer.porraKey)));
    let lastV: number | null = null;
    let p0 = 0;
    rankRows.forEach((r, i) => {
      if (r.val !== lastV) {
        p0 = i + 1;
        lastV = r.val;
      }
      r.rank = p0;
    });
  } else {
    const pool = rs.filter((r) => r.pj || r.g || r.a || r.nc);
    let srt = ND.ranked(pool, rkK);
    if (MD.low) srt = srt.slice().sort((a, b) => a.val - b.val || (a.n === "" ? 999 : a.n) - (b.n === "" ? 999 : b.n));
    rankRows = srt.map((r) => mkRow(r.id, rkK === "min" && !r.minKnown ? r.tit : r.val, r.rank, you(r.id)));
    if (MD.low) {
      let lastV: number | null = null;
      let p0 = 0;
      rankRows.forEach((r, i) => {
        if (r.val !== lastV) {
          p0 = i + 1;
          lastV = r.val;
        }
        r.rank = p0;
      });
    }
  }
  const mx = Math.max(1, rankRows.reduce((s, r) => Math.max(s, r.val), 0));
  rankRows.forEach((r) => {
    r.w = Math.round((r.val / mx) * 100);
    r.cls = [r.you ? "is-you" : "", r.val === 0 ? "is-zero" : "", rkK === "mvp" && r.rank === 1 && r.val > 0 ? "is-mvp" : "", st.pick === r.id ? "is-picked" : ""].join(" ").trim();
    r.nCls = r.n === "" ? "is-none" : "";
    r.hasImg = !!ND.SQUAD[r.id];
    r.img = r.hasImg ? r.id : "";
    r.pick = porra
      ? () => act.say(`La porra de ${r.name}: ${r.val} puntos.`)
      : () => {
          act.set({ pick: r.id });
          if (act.narrow()) act.open("player", r.id);
        };
    r.alt = `La camiseta de ${r.name}, dorsal ${r.n}`;
  });
  const unitWord = (n: number) => (porra ? (n === 1 ? "punto" : "puntos") : rkK === "min" && !minKnown ? "de titular" : unitOf(rkK, n));
  const meRow = rankRows.find((r) => r.you);
  const podium = locked || MD.low ? [] : rankRows.filter((r) => r.val > 0).slice(0, 3);
  const restFrom = podium.length;
  const jLeaders = rankRows.filter((r) => r.rank === 1 && r.val > 0);
  let pickId = st.pick || (myId && (rkK === "min" || rkK === "pj") ? myId : jLeaders[0] && !porra ? jLeaders[0].id : myId || ND.IDS[0]);
  if (!pickId || !ND.SQUAD[pickId]) pickId = ND.IDS[0] ?? "";
  const quick = [
    ["goles", "Goles"],
    ["asist", "Asist."],
    ["min", "Minutos"],
    ["mvp", "MVP"],
    ["porra", "Porra"],
  ] as const;
  const quickKeys: string[] = quick.map((x) => x[0]);
  const groups: { t: string; items: { key: string; t: string; on: boolean; dim: string; pick: () => void }[] }[] = [];
  NU_METRICS.forEach((m) => {
    let g = groups.find((x) => x.t === m[2]);
    if (!g) {
      g = { t: m[2], items: [] };
      groups.push(g);
    }
    g.items.push({ key: m[0], t: m[1], on: rkK === m[0], dim: m[4] && !techAny ? "is-dim" : "", pick: () => act.set({ rankK: m[0], pick: null, allStats: false }) });
  });
  const heatOf = (id: string, n: number) =>
    played.slice(-n).map((m) => {
      const inM = m.ledger ? (m.ledger[id] && m.ledger[id].pl ? (m.ledger[id].tit ? "is-tit" : "is-sub") : "") : m.starters.includes(id) ? "is-tit" : m.bench.includes(id) ? "is-sub" : "";
      const gl = m.goals.filter((g) => g[0] === id).length;
      return { key: m.id, cls: inM, g: gl || "", j: `J${m.j}`, label: `J${m.j}${inM ? (gl ? `, ${gl}${gl > 1 ? " goles" : " gol"}` : ", jugó") : ", no jugó"}` };
    });
  const POSW: Record<string, string> = { POR: "Portero", DEF: "Defensa", MED: "Centrocampista", DEL: "Delantero" };
  const playerCard = (id: string) => {
    const R = rowOf(id) || NO_ROW(id, ND.name(id));
    const P = ND.SQUAD[id];
    let lastL: { m: NMatch; l: NonNullable<NMatch["ledger"]>[string] } | null = null;
    for (let i2 = played.length - 1; i2 >= 0 && !lastL; i2--) {
      const l = played[i2].ledger?.[id];
      if (l) lastL = { m: played[i2], l };
    }
    const LL = lastL as { m: NMatch; l: NonNullable<NMatch["ledger"]>[string] } | null;
    return {
      id, name: R.name, full: P && `${P.first} ${P.last}`.trim().toLocaleLowerCase("es") !== R.name.toLocaleLowerCase("es") ? `${P.first} ${P.last}`.trim() : "", n: R.n, pos: P ? (POSW[P.pos] ?? "") : "", you: you(id), img: id, alt: `La camiseta de ${R.name}, dorsal ${R.n}`,
      tiles: [
        { t: R.pj === 1 ? "partido" : "partidos", v: R.pj, gold: "" },
        { t: R.minKnown ? "minutos" : "de titular", v: R.minKnown ? Math.round(R.min) : R.tit, gold: "" },
        { t: R.g === 1 ? "gol" : "goles", v: R.g, gold: "" },
        { t: R.a === 1 ? "asistencia" : "asistencias", v: R.a, gold: "" },
        { t: R.mvp === 1 ? "vez MVP" : "veces MVP", v: R.mvp, gold: R.mvp > 0 ? "is-gold" : "" },
      ],
      rates: [
        { t: R.minKnown ? "G+A por 50′" : "G+A por partido", v: R.per50 },
        { t: "Victorias con él", v: R.pj ? `${R.winPct} %` : "–" },
        { t: "Titular · desde el banquillo · no convocado", v: `${R.tit} · ${R.ban} · ${R.nc}` },
        { t: "Entradas y salidas", v: `${R.sin} y ${R.sout}` },
        { t: "Mejor socio", v: R.partner ? `${ND.name(R.partner)} · ${R.partnerN}${R.partnerN === 1 ? " gol juntos" : " goles juntos"}` : "Aún ninguno" },
        { t: "Racha marcando", v: R.gStreak.best ? `${R.gStreak.cur} ahora · récord ${R.gStreak.best}` : "Sin racha" },
        { t: "Próximo hito", v: `${R.next === 1 ? "1 gol" : `${R.next} goles`} · ${R.next - R.g === 1 ? "le falta 1" : `le faltan ${R.next - R.g}`}` },
        { t: "Tarjetas", v: `${R.yc} amarilla${R.yc === 1 ? "" : "s"}${R.rc ? ` · ${R.rc} roja${R.rc === 1 ? "" : "s"}` : ""}` },
      ].concat(
        R.tech
          ? [
              { t: "Pases completados", v: `${nW(R.pok, "completado", "completados")} de ${nW(R.pas, "intentado", "intentados")} · ${nW(R.pko, "fallado", "fallados")}${R.punk ? ` · ${R.punk} sin resultado` : ""}${R.passPct != null ? ` (${R.passPct} % de los resueltos)` : ""} · parcial` },
              { t: "Recuperaciones · pérdidas", v: `${R.rec} · ${R.tov} · parcial` },
            ]
          : [],
      ),
      hasStints: !!LL && LL.l.st.length > 0,
      stintT: LL ? `En la J${LL.m.j}: ${Math.round(LL.l.min)} minutos en ${LL.l.st.length}${LL.l.st.length === 1 ? " tramo" : " tramos"}` : "",
      stints: LL ? LL.l.st.map((s) => ({ l: ((s[0] / 50) * 100).toFixed(1), w: ((Math.max(1, s[1] - s[0]) / 50) * 100).toFixed(1), t: `${s[0]}′–${s[1]}′` })) : [],
      heat: heatOf(id, 10),
      href: `/jugadores/${id}`, duel: `/plantilla/cara-a-cara?a=${encodeURIComponent(id)}`, scopeT: scopeBits.join(" · "),
    };
  };
  let stintM: NMatch | null = null;
  for (let i3 = played.length - 1; i3 >= 0 && !stintM; i3--) if (played[i3].ledger) stintM = played[i3];
  const SM = stintM as NMatch | null;
  const stintRows = SM?.ledger
    ? Object.keys(SM.ledger)
        .filter((id) => SM.ledger?.[id].pl)
        .map((id) => {
          const l = (SM.ledger as NonNullable<NMatch["ledger"]>)[id];
          return {
            key: id, id, name: ND.name(id), n: ND.num(id), min: Math.round(l.min), you: you(id), cls: you(id) ? "is-you" : "",
            st: l.st.map((s, k) => ({ key: k, l: ((s[0] / 50) * 100).toFixed(1), w: ((Math.max(0.6, s[1] - s[0]) / 50) * 100).toFixed(1) })),
            label: `${ND.name(id)}: ${Math.round(l.min)} minutos, ${l.st.map((s) => `del ${s[0]}′ al ${s[1]}′`).join(", ")}`,
          };
        })
        .sort((a, b) => b.min - a.min)
    : [];
  const notPlayed = SM?.ledger
    ? Object.keys(SM.ledger)
        .filter((id) => !SM.ledger?.[id].pl && ND.SQUAD[id])
        .map((id) => ND.name(id))
    : [];
  const showStints = ["min", "tit", "ban", "sin", "sout", "nc", "pj"].includes(rkK);
  const nzRank = rankRows.filter((r) => r.val > 0).length;
  const jug = {
    kick: `Jugadores · ${porra ? "la porra" : MD.g.toLowerCase()}`,
    title: locked
      ? "La porra es del vestuario"
      : porra && !rankRows.length
        ? "La porra, aún sin puntos"
        : MD.low
        ? nzRank
          ? `${nzRank} con ${metricLower(rkK)}`
          : `Nadie con ${metricLower(rkK)} todavía`
        : jLeaders.length
          ? `${list(jLeaders.map((r) => r.name))}, ${jLeaders[0].val} ${unitWord(jLeaders[0].val)}`
          : rkK === "mvp"
            ? "Nadie ha sido MVP todavía"
            : `Nadie todavía en ${metricLower(rkK)}`,
    sub: porra
      ? member
        ? `${NU_GLOSS.porra[1]}${env.S.porra?.demo ? " Demo en estos datos." : ""}`
        : "Solo la ve el equipo."
      : MD.d + (rkK === "min" && !minKnown ? " Estas actas no traen minutos: mientras, partidos de titular." : "") + (MD.tech && !techAny ? " Este período no tiene jugadas narradas." : "") + (rkK === "mvp" && se.S.mvpDemo ? " Demo: la temporada larga no guarda votaciones." : ""),
    metrics: quick.map((v) => ({ t: v[1], on: rkK === v[0], pick: set({ rankK: v[0], pick: null }), lock: v[0] === "porra" && !member })),
    metricI: quickKeys.indexOf(rkK),
    otherCls: !quickKeys.includes(rkK) ? "is-other" : "",
    otherT: !quickKeys.includes(rkK) ? `Viendo: ${MD.t}` : `Todas las estadísticas (${NU_METRICS.length})`,
    allOpen: st.allStats, toggleAll: () => act.set({ allStats: !st.allStats }), groups,
    locked, podium, rest: locked ? [] : rankRows.slice(restFrom, restFrom + (MD.low ? 8 : 5)),
    /** (not on the boards: a season whose porra has no points yet) */
    porraEmpty: porra && !locked && !rankRows.length ? "Aún no hay puntos de porra esta temporada: llegan al cerrar la primera jornada con apuestas." : "",
    more: locked || porra ? 0 : Math.max(0, rankRows.length - restFrom - 5), moreT: `Todos los jugadores (${rankRows.length})`,
    onlyOne: !locked && !MD.low && podium.length === 1 && rankRows.length > 1 ? `Solo ${podium[0].name} tiene ${metricLower(rkK)} de momento; el resto, a cero.` : "",
    meLine: meRow && rankRows.indexOf(meRow) >= restFrom + 5 ? `Tú, ${meRow.rank}º con ${meRow.val} ${unitWord(meRow.val)}` : "",
    hasMvp: rkK === "mvp" && played.some((m) => m.mvp),
    mvpList: rkK === "mvp" ? played.slice(-8).reverse().filter((m) => m.mvp).map((m) => ({ key: m.id, j: `J${m.j}`, name: list((m.mvps ?? [m.mvp as string]).map((x) => ND.name(x))) })) : [],
    voteOpen: rkK === "mvp" && lastVote && lastVote.open ? `La votación de la J${lastPlayed.j} sigue abierta: ${lastVote.total} de ${lastVote.eligible} han votado. El MVP sale al cerrarla.` : "",
    openAll: () => act.grow("jugadores"), card: playerCard(pickId), showCard: !porra && !!pickId,
    showStints: showStints && !!SM, stintT: SM ? `Quién estuvo en el campo en la J${SM.j}, minuto a minuto` : "", stintRows,
    stintNote: notPlayed.length ? `Sin jugar: ${list(notPlayed)}.` : "",
    noStints: showStints && !SM && gs.length > 0 ? "Estas actas no traen los cambios minuto a minuto: los minutos llegan con el registro de la mesa." : "",
    info: info(`m:${rkK}`), infoTramos: info("tramos"),
  };
  const sortK = st.sortK;
  const qn = st.q.toLowerCase();
  const PRESETS: Record<string, string[]> = {
    basico: ["pj", "min", "goles", "asist", "ga", "mvp", "yc"], minutos: ["pj", "min", "tit", "ban", "sin", "sout", "nc"], mesa: ["ch", "wood", "sv", "f", "fr", "rc", "dy"],
    penaltis: ["psv", "gpen", "gfk", "pms", "pcm", "prc"], narrado: ["pas", "pok", "kp", "sh", "sot", "rec", "tov", "int", "cl"],
  };
  const colKeys = PRESETS[st.colSet] || PRESETS.basico;
  const cellOf = (r: PRow, k: string): number | string => ((NU_MET[k] && NU_MET[k].tech && !r.tech) || (k === "min" && !r.minKnown) ? "–" : k === "min" ? Math.round(ND.metricOf(r, k)) : ND.metricOf(r, k));
  const full = rs
    .filter((r) => !qn || r.name.toLowerCase().includes(qn) || String(r.n) === qn)
    .sort((a, b) => ND.metricOf(b, sortK) - ND.metricOf(a, sortK) || (a.n === "" ? 999 : a.n) - (b.n === "" ? 999 : b.n))
    .map((r) => ({
      key: r.id, id: r.id, name: r.name, n: r.n, you: you(r.id), cls: you(r.id) ? "is-you" : "",
      cells: colKeys.map((k) => ({ key: k, v: cellOf(r, k) })),
      pick: () => {
        act.set({ pick: r.id });
        act.grow(null);
        if (act.narrow()) act.open("player", r.id);
      },
      heat: heatOf(r.id, 8),
    }));
  const gj = {
    n: colKeys.length, rows: full,
    cols: colKeys.map((k) => ({ key: k, t: (NU_MET[k] || { t: k }).t, on: sortK === k, sort: sortK === k ? ("descending" as const) : ("none" as const), pick: set({ sortK: k }) })),
    sets: (
      [
        ["basico", "Básico"],
        ["minutos", "Minutos"],
        ["mesa", "La mesa"],
        ["penaltis", "Penaltis"],
        ["narrado", "Narrado"],
      ] as const
    ).map((v) => ({ t: v[1], on: (st.colSet || "basico") === v[0], pick: set({ colSet: v[0] }) })),
    setI: ["basico", "minutos", "mesa", "penaltis", "narrado"].indexOf(st.colSet || "basico"),
    q: st.q, setQ: (v: string) => act.set({ q: v }), empty: full.length === 0, csv: () => act.csv("jugadores"),
    count: `${full.length} jugadores · ordenado por ${(NU_MET[sortK] || { t: sortK }).t.toLowerCase()} · «–» es que el dato no está registrado`,
    table: { head: ["Jugador", "Dorsal", ...colKeys.map((k) => (NU_MET[k] || { t: k }).t)], rows: full.map((r) => [r.name, String(r.n), ...r.cells.map((c) => String(c.v))]) },
  };

  // ---------- El campo: pases de gol (the constellation), puestos (from the ledger), sistemas
  const lk = ND.links(gs);
  const sel = st.star && ND.SQUAD[st.star] ? st.star : null;
  const stars = ND.IDS.map((id) => {
    const r = rowOf(id) ?? NO_ROW(id, ND.name(id));
    const P = ND.SQUAD[id];
    return {
      key: id, id, name: P.name, left: P.x, top: P.y, size: 12 + Math.min(40, r.ga * 3.4),
      cls: [r.ga ? "" : "is-dim", sel === id ? "is-sel" : "", sel && sel !== id && !lk.some((l) => (l.from === sel && l.to === id) || (l.to === sel && l.from === id)) ? "is-far" : "", you(id) ? "is-you" : "", P.y > 70 ? "is-low" : ""].join(" ").trim(),
      label: `${P.name}: ${nW(r.g, "gol", "goles")} y ${nW(r.a, "asistencia", "asistencias")}`,
      pick: () => act.set({ star: st.star === id ? null : id }),
    };
  });
  const arcs = { d1: "", d2: "", d3: "", dSel: "" };
  lk.forEach((l) => {
    const d = `${ND.arc(l.from, l.to)} `;
    if (sel && (l.from === sel || l.to === sel)) arcs.dSel += d;
    else if (l.n >= 4) arcs.d3 += d;
    else if (l.n >= 2) arcs.d2 += d;
    else arcs.d1 += d;
  });
  const scorers0 = ND.ranked(rsAll, "goles").filter((r) => r.g > 0);
  const starId = sel || (lk[0] ? lk[0].to : scorers0[0] ? scorers0[0].id : (ND.IDS[0] ?? ""));
  const sr = rowOf(starId) ?? NO_ROW(starId, ND.name(starId));
  const givers = lk.filter((l) => l.to === starId);
  const takers = lk.filter((l) => l.from === starId);
  let unassisted = 0;
  gs.forEach((m) => m.goals.forEach((g) => !g[1] && unassisted++));
  const realPos = rsAll.some((r) => Object.keys(r.pos).length);
  interface Spot {
    key: string;
    code: string;
    name: string;
    owner: string;
    ownerId: string | null;
    x: number;
    y: number;
    min: number;
    who: { name: string; min: number }[];
    empty: boolean;
    on: boolean;
    pick: () => void;
    label: string;
    cls: string;
  }
  let spots: Spot[];
  if (realPos)
    spots = ND.positions(rsAll).map((p) => ({
      key: p.code, code: p.code, name: p.name, owner: p.owner ? p.owner.name : "Sin estrenar", ownerId: p.owner ? p.owner.id : null, x: p.x, y: p.y, min: p.min, who: p.who, empty: !p.owner,
      on: st.puesto === p.code, pick: () => act.set({ puesto: p.code }), label: `${p.name}, ${p.owner ? `${p.min} minutos, dueño ${p.owner.name}` : "sin estrenar"}`, cls: p.owner ? "" : "is-empty",
    }));
  else
    spots = ND.positions([]).map((p) => ({
      key: p.code, code: p.code, name: p.name, owner: "Sin estrenar", ownerId: null, x: p.x, y: p.y, min: 0, who: [], empty: true, on: st.puesto === p.code,
      pick: () => act.set({ puesto: p.code }), label: `${p.name}, sin estrenar`, cls: "is-empty",
    }));
  const spotSel = spots.find((s) => s.code === st.puesto && !s.empty) || spots.filter((s) => !s.empty).sort((a, b) => b.min - a.min)[0] || spots[0];
  const unused = spots.filter((s) => s.empty).map((s) => s.code);
  const sistemas = gs.filter((m) => m.system);
  const sysT = ND.team(sistemas);
  const sysBy: Record<string, NMatch[]> = {};
  sistemas.forEach((m) => (sysBy[m.system as string] = [...(sysBy[m.system as string] ?? []), m]));
  const sysRows = Object.keys(sysBy)
    .map((k) => {
      const t2 = ND.team(sysBy[k]);
      return { key: k, label: k, pj: sysBy[k].length, rec: `${t2.g}-${t2.e}-${t2.p}`, gfga: `${t2.gf}:${t2.ga}`, ppg: dec(t2.pts / sysBy[k].length), v: t2.pts / sysBy[k].length };
    })
    .sort((a, b) => b.v - a.v || b.pj - a.pj);
  const cv = st.campoView;
  const campo = {
    kick: `El campo · ${{ pases: "pases de gol", puestos: "puestos", sistemas: "sistemas" }[cv]}`,
    title:
      cv === "pases"
        ? lk[0]
          ? `${ND.name(lk[0].from)} → ${ND.name(lk[0].to)}, ${lk[0].n}${lk[0].n === 1 ? " gol" : " goles"}`
          : scorers0.length
            ? "Aún sin pases de gol"
            : "Aún sin goles"
        : cv === "puestos"
          ? spotSel && !spotSel.empty
            ? `El ${spotSel.code} es de ${spotSel.owner}`
            : "Aún sin minutos por puesto"
          : sysRows.length
            ? `${sysRows[0].label}, ${sysRows[0].ppg} puntos por partido`
            : "Aún sin pizarra oficial",
    sub:
      cv === "pases"
        ? lk.length
          ? NU_GLOSS.pases[1]
          : unassisted
            ? `${unassisted === 1 ? "El único gol" : `Los ${unassisted} goles`} del período ${unassisted === 1 ? "llegó" : "llegaron"} sin asistencia. La primera línea aparecerá con el primer pase de gol; mientras, cada estrella crece con sus goles.`
            : "Las estrellas crecerán con los goles y las líneas, con los pases de gol."
        : cv === "puestos"
          ? realPos
            ? "Minutos por posición exacta, de la narración de cada partido. En fútbol 7 un jugador puede pasar por varios puestos."
            : "Los minutos por puesto llegan con el acta de cada partido: la mesa apunta dónde juega cada uno."
          : NU_GLOSS.campo[1],
    views: (
      [
        ["pases", "Pases de gol"],
        ["puestos", "Puestos"],
        ["sistemas", "Sistemas"],
      ] as const
    ).map((v) => ({ t: v[1], on: cv === v[0], pick: () => act.set({ campoView: v[0] }) })),
    viewI: ["pases", "puestos", "sistemas"].indexOf(cv),
    isPases: cv === "pases", isPuestos: cv === "puestos", isSistemas: cv === "sistemas",
    stars, arcs, noLinks: lk.length === 0,
    star: {
      id: starId, name: ND.name(starId), line: `${sr.g}${sr.g === 1 ? " gol" : " goles"} · ${sr.a}${sr.a === 1 ? " asistencia" : " asistencias"}`, img: starId, alt: `La camiseta de ${ND.name(starId)}, dorsal ${ND.num(starId)}`,
      gives: givers.slice(0, 4).map((l) => ({ key: l.from, t: ND.name(l.from), n: l.n })),
      takes: takers.slice(0, 4).map((l) => ({ key: l.to, t: ND.name(l.to), n: l.n })),
      noGives: givers.length === 0, noTakes: takers.length === 0,
      open: () => act.go("jugadores", { pick: starId }), clear: set({ star: null }), selected: !!sel,
    },
    top: lk.slice(0, 6).map((l) => ({ key: `${l.from}>${l.to}`, t: `${ND.name(l.from)} → ${ND.name(l.to)}`, n: `${l.n}${l.n === 1 ? " gol" : " goles"}`, w: Math.round((l.n / (lk[0] ? lk[0].n : 1)) * 100) })),
    hasTop: lk.length > 0,
    spots, spot: spotSel, spotImg: spotSel?.ownerId ?? "", spotAlt: `La camiseta de ${spotSel?.owner ?? ""}`,
    spotLine: `${spotSel?.min ?? 0} minutos`,
    spotWho: (spotSel?.who || []).slice(0, 5).map((w) => ({ key: w.name, t: w.name, v: `${w.min}′` })),
    spotRows: spots
      .filter((s) => !s.empty)
      .sort((a, b) => b.min - a.min)
      .map((s) => ({ key: s.code, code: s.code, name: s.name, owner: s.owner, min: s.min, cls: s.on || s.code === spotSel?.code ? "is-on" : "", pick: s.pick })),
    unused: unused.length && realPos ? `Sin estrenar: ${unused.join(", ")}.` : "",
    hasSys: sysRows.length > 0, sysRows,
    sys: { label: sysRows[0]?.label ?? "", pj: sistemas.length, rec: `${sysT.g}-${sysT.e}-${sysT.p}`, gfga: `${sysT.gf}:${sysT.ga}`, ppg: sistemas.length ? dec(sysT.pts / sistemas.length) : "0,0" },
    sysOff: gs.length - sistemas.length,
    i: { pases: info("pases"), puestos: info("puestos"), campo: info("campo") },
  };

  // ---------- El juego: the narrated analysis (real counts from the ledger when the actas bring them)
  const us = st.team === "us";
  const parte = st.parte;
  const inParte = (min: number) => parte === "all" || (hasAnalysisSource ? actions.periodWindows.some(p => min * 60 >= p.from && min * 60 < p.to) : (parte === "1" ? min < 25 : min >= 25));
  let gU = 0;
  let gT = 0;
  gs.forEach((m) => {
    m.goals.forEach((g) => inParte(g[2]) && gU++);
    m.opp.forEach((x) => inParte(x) && gT++);
  });
  // (as the boards: every acta with a ledger counts its narrated plays; an acta that narrated none says 0, «Parcial»)
  const narrated = gs.filter((m) => m.technicalAvailable ?? !!m.ledger);
  const nN = narrated.length;
  const withActions = gs.filter((m) => m.ledger || m.chances.length || m.corners.length || m.oppChances).length;
  const partial = `${nN} de ${gs.length}${gs.length === 1 ? " acta narrada" : " actas narradas"}`;
  const sumR = (k: keyof PRow) => rsAll.reduce((s, r) => s + (typeof r[k] === "number" ? (r[k] as number) : 0), 0);
  const sumThem = (k: "pas" | "sh" | "rec" | "loss" | "sv") => narrated.reduce((s, m) => s + (m.them?.[k] || 0), 0);
  const pOk = sumR("pok");
  const pKo = sumR("pko");
  type Status = "ok" | "part" | "none";
  const tile = (id: string, t: string, v: number | string, status: Status, sub: string) => ({
    key: id, id, t, v, status, cls: `is-${status}`, statusT: { ok: "Completo", part: "Parcial", none: "Sin información" }[status], sub, pick: () => act.open("metric", id),
  });
  const techOk = nN > 0;
  const byParte = parte !== "all";
  const tt = (id: string, t: string, k: keyof PRow, sub?: string) =>
    techOk && !byParte ? tile(id, t, sumR(k), "part", sub || partial) : tile(id, t, "–", "none", byParte && techOk ? "Por partes, solo goles y tarjetas" : "Hace falta la narración de la mesa");
  let cardsU = 0;
  gs.forEach((m) => m.cards.forEach((c) => inParte(c[1]) && cardsU++));
  const vistazo = us
    ? [
        tile("015", "Goles marcados", gU, "ok", `${gs.length}${gs.length === 1 ? " partido" : " partidos"}`),
        tile("105", "Asistencias de gol", gs.reduce((s, m) => s + m.goals.filter((g) => g[1] && inParte(g[2])).length, 0), "ok", `de ${gU}${gU === 1 ? " gol" : " goles"}`),
        tt("067", "Pases intentados", "pas"),
        techOk && !byParte ? tile("070", "Precisión de pase", pOk + pKo ? `${dec((pOk / (pOk + pKo)) * 100)} %` : "–", "part", `${pOk} de ${pOk + pKo} completados`) : tile("070", "Precisión de pase", "–", "none", "Hace falta narrar los pases"),
        tt("029", "Remates", "sh"), tt("030", "Remates a puerta", "sot"), tt("106", "Pases que acaban en remate", "kp"), tt("114", "Centros", "cr"),
        tt("206", "Recuperaciones", "rec"), tt("201", "Pérdidas", "tov"), tt("169", "Interceptaciones", "int"), tt("173", "Despejes", "cl"),
        tt("151", "Duelos", "du"), tt("135", "Regates", "dr"),
        techOk && !byParte ? tile("272", "Paradas", sumR("saves"), "part", partial) : tile("272", "Paradas", sumR("saves") || "–", sumR("saves") ? "part" : "none", "Lo que apuntó la mesa"),
        tile("300", "Tarjetas amarillas", cardsU, "ok", "Desde el acta"),
      ]
    : [
        tile("015", "Goles del rival", gT, "ok", `${gs.length}${gs.length === 1 ? " partido" : " partidos"}`),
        techOk && !byParte ? tile("067", "Pases del rival", sumThem("pas"), "part", partial) : tile("067", "Pases del rival", "–", "none", "Hace falta la narración"),
        techOk && !byParte ? tile("029", "Remates del rival", sumThem("sh"), "part", partial) : tile("029", "Remates del rival", "–", "none", "Hace falta la narración"),
        techOk && !byParte ? tile("206", "Recuperaciones del rival", sumThem("rec"), "part", partial) : tile("206", "Recuperaciones del rival", "–", "none", "Hace falta la narración"),
        techOk && !byParte ? tile("272", "Paradas de su portero", sumThem("sv"), "part", partial) : tile("272", "Paradas de su portero", "–", "none", "Hace falta la narración"),
        tile("300", "Amarillas del rival", gs.reduce((s, m) => s + (m.oppCards || 0), 0), withActions ? "part" : "none", withActions ? "Lo que apuntó la mesa" : "Falta en las actas"),
      ];
  const metricStatus = (result: MetricResult | undefined): Status => result?.status === "complete" ? "ok" : workspaceMetricValue(result) != null ? "part" : "none";
  const metricTile = (id: string, title: string) => {
    const result = metrics.get(id);
    return { ...tile(id, title, formatWorkspaceMetric(result), metricStatus(result), result?.reason ?? "Sin datos para esta selección"), result };
  };
  if (hasAnalysisSource) {
    vistazo.splice(0, vistazo.length, ...vistazo.map(t => metricTile(t.id, t.t)));
    const ownGoals = actions.teams.us.shotGoals, rivalGoals = actions.teams.opponent.shotGoals;
    if (us) gU = metrics.get("015")?.value ?? ownGoals; else gT = metrics.get("015")?.value ?? rivalGoals;
  }
  const clockActions = hasAnalysisSource ? numerosActions(analysis.matches, { ...analysis.filters, team: undefined }) : null;
  const ck = clockActions ? { us: clockActions.goalBins.us, them: clockActions.goalBins.opponent } : clock(gs);
  const clockGoalsUs = ck.us.reduce((n, v) => n + v, 0), clockGoalsThem = ck.them.reduce((n, v) => n + v, 0);
  const cmax = Math.max(1, ...ck.us, ...ck.them);
  const cf = st.clockK;
  const slices = ck.us.map((u, i) => {
    const t = ck.them[i];
    return {
      key: i, u: cf === "contra" ? 0 : Math.round((u / cmax) * 100), t: cf === "favor" ? 0 : Math.round((t / cmax) * 100), lab: `${i * 5}′`, cls: inParte(i * 5) ? "" : "is-off",
      label: `Del ${i * 5}′ al ${i * 5 + 5}′: ${u} a favor y ${t} en contra`,
    };
  });
  const bu = ck.us.indexOf(Math.max(...ck.us));
  const bt = ck.them.indexOf(Math.max(...ck.them));
  const tram = hasAnalysisSource ? actions.tramos : Array.from({ length: 10 }, (_, i) => {
    const o = { pas: 0, pok: 0, sh: 0, rec: 0, loss: 0, tsh: 0 };
    narrated.forEach((m) => {
      const x = (m.tramos || [])[i];
      if (x) (Object.keys(o) as (keyof typeof o)[]).forEach((k) => (o[k] += x[k] || 0));
    });
    return o;
  });
  const tmax = Math.max(1, ...tram.map((x) => x.pas));
  const tramos = tram.map((x, i) => {
    // Pass bars follow the selected team; the shot comparison needs both sides.
    // A player-only sample cannot make claims about the rival's total shots.
    const shots = clockActions?.tramos[i] ?? x;
    const shotLabel = analysis.filters.playerIds?.length ? `${nW(us ? x.sh : x.tsh, "remate", "remates")} de los jugadores seleccionados` : `${nW(shots.sh, "remate nuestro", "remates nuestros")} y ${shots.tsh} del rival`;
    return {
      key: i, h: Math.round((x.pas / tmax) * 100), ok: Math.round((x.pok / tmax) * 100), lab: `${i * 5}′`, v: x.pas,
      label: `Del ${i * 5}′ al ${i * 5 + 5}′: ${nW(x.pas, "pase", "pases")}, ${nW(x.pok, "completado", "completados")}, ${shotLabel}`,
    };
  });
  const pairs: Record<string, number> = {};
  if (hasAnalysisSource) actions.links.forEach(p => { pairs[`${p.from}>${p.to}`] = p.count; });
  else narrated.forEach((m) => (m.passPairs || []).forEach((p) => (pairs[`${p[0]}>${p[1]}`] = (pairs[`${p[0]}>${p[1]}`] || 0) + p[2])));
  const pairL = Object.keys(pairs)
    .map((k2) => {
      const s2 = k2.split(">");
      return { key: k2, a: ND.name(s2[0]), b: ND.name(s2[1]), n: pairs[k2], w: 0, t: "" };
    })
    .sort((a, b) => b.n - a.n)
    .slice(0, 8);
  const pairMax = pairL[0] ? pairL[0].n : 1;
  pairL.forEach((p) => {
    p.w = Math.round((p.n / pairMax) * 100);
    p.t = `${p.a} → ${p.b}`;
  });
  const cov: Record<string, string[]> = { complete: [], partial: [], unknown: [] };
  narrated.forEach((m) => (m.coverage || []).forEach((c) => (c[1] === "us") === us && cov[c[2]] && !cov[c[2]].includes(c[0]) && cov[c[2]].push(c[0])));
  const juego = {
    kick: `El juego · ${gs.length}${gs.length === 1 ? " partido" : " partidos"} en la selección`,
    title: us ? `${gU}${gU === 1 ? " gol" : " goles"}, minuto a minuto` : `${gT}${gT === 1 ? " gol del rival" : " goles del rival"}`,
    sub: nN
      ? `${partial}: las cifras con «Parcial» cuentan solo lo que se narró. ${gs.length > nN ? "Las demás actas traen goles, tarjetas y minutos." : ""}`.trim()
      : "Estas actas traen goles y tarjetas; los pases, remates y recuperaciones llegan con la narración de la mesa.",
    teamOpts: [
      { t: "Manchester Piti", on: us, pick: set({ team: "us" }) },
      { t: "El rival", on: !us, pick: set({ team: "them" }) },
    ],
    teamI: us ? 0 : 1,
    parteOpts: (
      [
        ["all", "Todo"],
        ["1", "1ª parte"],
        ["2", "2ª parte"],
      ] as const
    ).map((p) => ({ t: p[1], on: parte === p[0], pick: set({ parte: p[0] }) })),
    parteI: ["all", "1", "2"].indexOf(parte),
    tiles: vistazo, slices,
    passes: { attempted: actions.teams[analysis.filters.team].passes, completed: actions.teams[analysis.filters.team].passesCompleted, failed: actions.teams[analysis.filters.team].passesFailed, unknown: actions.teams[analysis.filters.team].passesUnknown },
    clockOpts: (
      [
        ["ambos", "Ambos"],
        ["favor", "A favor"],
        ["contra", "En contra"],
      ] as const
    ).map((v) => ({ t: v[1], on: cf === v[0], pick: set({ clockK: v[0] }) })),
    clockI: ["ambos", "favor", "contra"].indexOf(cf),
    clockCap: clockGoalsUs + clockGoalsThem
      ? (clockGoalsUs ? `Marcamos más entre el ${bu * 5}′ y el ${bu * 5 + 5}′` : "Aún no hemos marcado con minuto") + (clockGoalsThem ? `; el rival nos marca más entre el ${bt * 5}′ y el ${bt * 5 + 5}′.` : ".")
      : "Aún no hay goles con minuto registrado.",
    hasTech: nN > 0, tramos, tramT: "Dónde cambia el juego: pases por tramo",
    tramSub: `Cada columna, cinco minutos de juego, incluido el añadido: alto, los pases intentados; relleno, los completados. ${nN === 1 ? `De la J${narrated[0].j}.` : `${nN} partidos.`}${actions.unplaced ? ` ${actions.unplaced} acciones no se pueden ubicar por completo en un único tramo.` : ""}`,
    pairs: pairL, hasPairs: pairL.length > 0,
    cov: { ok: cov.complete.join(" · ") || "Ninguna", part: cov.partial.join(" · ") || "Ninguna", none: cov.unknown.join(" · ") || "Ninguna", hasNone: cov.unknown.length > 0 },
    note: narrated.map((m) => m.analysisNote).find(Boolean) ?? "",
    openCharts: () => act.grow("graficas"), openMesa: () => act.grow("mesa"), openCat: () => act.grow("catalogo"), exportJson: () => act.json(),
    i: { vistazo: info("vistazo"), reloj: info("reloj"), tramos: info("conecta"), cobertura: info("cobertura"), estados: info("estados") },
  };
  // The table, its total and each metric's detail share the actual filtered sample.
  const presetNames = ["resumen", "pases", "remates", "defensa", "porteria", "rotaciones", "disciplina"];
  const preset = ANALYSIS_WORKSPACE_PRESETS[Math.max(0, presetNames.indexOf(st.wsSet || "resumen"))];
  const wsKeys = [...new Set(st.wsColumns ?? preset.metricIds)].filter(id => NARRATED_METRICS.some(m => m.id === id));
  const workspace = tableOpen ? buildAnalysisWorkspace(analysis.matches, ND.IDS.map(id => ({ id, name: ND.name(id), number: ND.num(id) })), analysis.filters, wsKeys)
    : { rows: [], total: new Map<string, MetricResult>() };
  const sortKey = wsKeys.includes(st.wsSort ?? "") ? st.wsSort! : wsKeys[0] ?? "001";
  const sortDirection = st.wsDirection ?? "desc";
  const wsRows = sortAnalysisRows(workspace.rows, sortKey, sortDirection).map(r => ({
    key: r.person.id, name: r.person.name, n: r.person.number ?? "", cls: you(r.person.id) ? "is-you" : "",
    cells: wsKeys.map(key => { const result = r.results.get(key); return { key, v: formatWorkspaceMetric(result), status: result?.status, reason: result?.reason ?? "Sin datos para esta selección" }; }),
  }));
  const searchable = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("es");
  const wsQuery = searchable(st.wsQuery ?? "").trim();
  const wsFamily = st.wsFamily ?? "";
  const availableColumns = NARRATED_METRICS.filter(m => workspaceMetricValue(metrics.get(m.id)) != null).map(m => m.id);
  const wsColumns = NARRATED_METRICS.filter(m => (!wsFamily || m.category === wsFamily) && (!wsQuery || searchable(m.name + " " + m.id + " " + m.category).includes(wsQuery))).map(m => {
    const result = metrics.get(m.id), selected = wsKeys.includes(m.id), available = workspaceMetricValue(result) != null;
    return { key: m.id, t: m.name, family: m.category, selected, available, reason: result?.reason ?? "Sin datos para esta selección",
      toggle: () => { if (selected) act.set({ wsColumns: wsKeys.filter(id => id !== m.id) }); else if (available) act.set({ wsColumns: [...wsKeys, m.id] }); },
    };
  });
  const wsCols = wsKeys.map(key => ({ key, t: NARRATED_METRICS.find(m => m.id === key)?.name ?? key,
    sort: key === sortKey ? sortDirection === "asc" ? "ascending" as const : "descending" as const : "none" as const,
    pick: () => act.set({ wsSort: key, wsDirection: key === sortKey && sortDirection === "desc" ? "asc" : "desc" }),
  }));
  const ws = {
    sets: ANALYSIS_WORKSPACE_PRESETS.map((p, i) => ({ key: presetNames[i], t: p.label, on: !st.wsColumns && p.id === preset.id, pick: () => act.set({ wsSet: presetNames[i], wsColumns: undefined, wsSort: undefined }) })),
    n: wsKeys.length, cols: wsCols, rows: wsRows,
    foot: wsKeys.map(key => { const result = workspace.total.get(key); return { key, v: formatWorkspaceMetric(result), status: result?.status, reason: result?.reason ?? "Sin datos" }; }),
    totalLabel: st.jug.length ? "Total de los jugadores seleccionados" : us ? "Total del Piti, incluidas acciones sin jugador" : "Total del rival",
    columns: wsColumns, query: st.wsQuery ?? "", setQuery: (value: string) => act.set({ wsQuery: value }),
    family: wsFamily, families: [...new Set(NARRATED_METRICS.map(m => m.category))], setFamily: (value: string) => act.set({ wsFamily: value }),
    availableCount: availableColumns.length, selectedCount: wsKeys.length,
    selectAll: () => act.set({ wsColumns: availableColumns }), clearColumns: () => act.set({ wsColumns: [] }),
    csv: () => act.csv("mesa"),
    table: { head: ["Jugador", "Dorsal", ...wsCols.map(c => c.t)], rows: wsRows.map(r => [r.name, String(r.n), ...r.cells.map(c => String(c.v))]) },
  };
  // the catalogue: the real 412 definitions, 26 families, the ones outside audio, paged by 24
  const TILE_V: Record<string, ReturnType<typeof tile>> = {};
  vistazo.forEach((t) => (TILE_V[t.id] = t));
  for (const definition of NARRATED_METRICS) if (metrics.has(definition.id)) TILE_V[definition.id] = metricTile(definition.id, definition.name);
  const cat = {
    loading: !env.catalog,
    q: st.catQ, setQ: (v: string) => act.set({ catQ: v, catN: 24 }),
    fams: [{ key: "", t: "Todas", on: !famSel, pick: set({ catFam: "", catN: 24 }) }].concat(FAMS.map((f) => ({ key: f, t: f, on: famSel === f, pick: set({ catFam: f, catN: 24 }) }))),
    xOn: st.catX, toggleX: () => act.set({ catX: !st.catX, catN: 24 }), xT: `Incluir las ${CAT.filter((c) => c[5]).length} fuera del audio`,
    items: catAll.slice(0, st.catN).map((c) => {
      const t2 = TILE_V[c[0]];
      const s = t2 ? t2.status : c[5] ? "none" : "cfg";
      return { key: c[0], id: c[0], t: c[2], fam: c[1], cls: `is-${s}`, st: t2 ? `${t2.statusT} · ${t2.v}` : c[5] ? "Necesita vídeo u otra fuente" : "Sin datos para esta selección", pick: () => act.open("metric", c[0]) };
    }),
    count: env.catalog ? `${catAll.length} de las ${CAT.length} estadísticas${famSel ? ` · ${famSel}` : ""}${st.catX ? " · incluidas las de fuera del audio" : ""}` : "Cargando el catálogo…",
    more: catAll.length > st.catN, moreT: `Mostrar más (${Math.min(st.catN, catAll.length)} de ${catAll.length})`,
    showMore: () => act.set({ catN: st.catN + 24 }), empty: !!env.catalog && catAll.length === 0,
  };

  // ---------- Rivales
  const rv = ND.rivals(se, upto, gs).filter((r) => r.pj || r.next);
  rv.sort((a, b) => {
    const al = a.next && a.next.st === "live" ? 1 : 0;
    const bl = b.next && b.next.st === "live" ? 1 : 0;
    return bl - al || b.pj - a.pj || b.gf - b.ga - (a.gf - a.ga);
  });
  const rq = st.rq.toLowerCase();
  const rivalBySlug = (s: string | null) => (s ? (rv.find((r) => r.rival === s || slug(r.rival) === slug(s))?.rival ?? null) : null);
  const selRival = rivalBySlug(st.rival) ?? (rv[0] ? rv[0].rival : "");
  const rvRows = rv
    .filter((r) => !rq || r.rival.toLowerCase().includes(rq))
    .map((r) => {
      const nx = r.next;
      return {
        key: r.rival, rival: r.rival, ini: ini(r.rival), logo: logoOf(env.logos, r.rival), pj: r.pj, rec: r.pj ? `${r.g}G ${r.e}E ${r.p}P · ${r.gf}–${r.ga}` : "Aún sin jugar",
        letters: r.games.map((m) => {
          const x = result(m) ?? "e";
          return { key: m.id, l: x.toUpperCase(), cls: `vd-form__l--${x}` };
        }),
        next: nx ? (nx.st === "live" ? "" : nx.st === "apl" ? `J${nx.j}, aplazado` : `J${nx.j} · ${nx.day}`) : "", live: nx && nx.st === "live" ? `${TonightWord(nx.time)}, en directo` : "",
        cls: r.rival === selRival ? "is-picked" : "", on: r.rival === selRival,
        pick: () => {
          act.set({ rival: r.rival });
          if (act.narrow()) act.open("rival", r.rival);
        },
      };
    });
  const dossier = (nm: string) => {
    const RR = rv.find((r) => r.rival === nm) || { rival: nm, games: [] as NMatch[], pj: 0, g: 0, e: 0, p: 0, gf: 0, ga: 0, next: null as NMatch | null };
    const scorers: Record<string, number> = {};
    RR.games.forEach((m) => m.goals.forEach((g) => (scorers[g[0]] = (scorers[g[0]] || 0) + 1)));
    const bw = RR.games.filter((m) => (m.gf ?? 0) > (m.ga ?? 0)).sort((a, b) => (b.gf ?? 0) - (b.ga ?? 0) - ((a.gf ?? 0) - (a.ga ?? 0)))[0];
    return {
      rival: RR.rival, ini: ini(RR.rival), logo: logoOf(env.logos, RR.rival),
      rec: RR.pj ? `${RR.pj}${RR.pj === 1 ? " partido" : " partidos"} · ${RR.g}G ${RR.e}E ${RR.p}P · ${RR.gf}–${RR.ga}` : `Aún no hemos jugado contra ${RR.rival}.`,
      games: RR.games.map((m) => ({
        key: m.id, j: `J${m.j}`, day: m.day, res: fmtRes(m), cls: `is-${result(m) ?? "e"}`, where: m.home ? "En casa" : "Fuera",
        who: m.goals.length ? m.goals.map((g) => `${ND.name(g[0])} ${g[2]}′`).join(", ") : "Sin goles del Piti", live: m.st === "live", href: `/partidos/${m.id}`,
      })),
      scorers: Object.keys(scorers)
        .sort((a, b) => scorers[b] - scorers[a])
        .map((k) => `${ND.name(k)} (${scorers[k]})`)
        .join(", ") || "Nadie todavía",
      big: bw ? `${fmtRes(bw)}, J${bw.j}` : "Aún ninguna",
      first: RR.games[0] ? `J${RR.games[0].j}, ${RR.games[0].day}` : "Por estrenar",
      next: RR.next ? (RR.next.st === "live" ? `${TonightWord(RR.next.time)}, en directo` : `J${RR.next.j} · ${RR.next.day}, ${RR.next.time}${RR.next.st === "apl" ? " (aplazado)" : ""}`) : "Ninguno en esta temporada",
      noGames: RR.games.length === 0,
    };
  };
  const best = rv.filter((r) => r.pj).sort((a, b) => (b.g * 3 + b.e) / b.pj - (a.g * 3 + a.e) / a.pj);
  const bestPpg = best[0] ? (best[0].g * 3 + best[0].e) / best[0].pj : 0;
  const unplayedR = rv.filter((r) => !r.pj).length;
  const rivales = {
    kick: `Rivales · ${rv.length} en la liga`,
    title:
      liveM && withLive
        ? `${TonightWord(liveM.time)}, ${liveM.rival}`
        : best.length === 1 && best[0].pj === 1
          ? `${best[0].rival}, ${fmtRes(best[0].games[0])} en la J${best[0].games[0].j}`
          : bestPpg === 3
            ? `Contra ${best[0].rival}, siempre ganando`
            : best[0]
              ? `Contra ${best[0].rival}, lo mejor`
              : "Por estrenar",
    sub: `El cara a cara con cada rival en el período.${best.length > 1 ? ` El que más se nos atraganta: ${best[best.length - 1].rival}.` : ""}${unplayedR ? ` ${unplayedR}${unplayedR === 1 ? " rival, por estrenar." : " rivales, por estrenar."}` : ""}`,
    rows: rvRows, phoneRows: rvRows.slice(0, 7), more: Math.max(0, rvRows.length - 7), moreT: `Todos los rivales (${rvRows.length})`,
    q: st.rq, setQ: (v: string) => act.set({ rq: v }), empty: rvRows.length === 0, n: rv.length, growNote: `${rv.length} rivales en la liga.${rv[0]?.next?.st === "live" ? ` Primero, el de ${tonightWord(rv[0].next.time)}.` : ""}`, openAll: () => act.grow("rivales"),
    d: dossier(selRival), sel: selRival, i: info("rivalesb"),
  };

  // ---------- Récords
  const ts = ND.teamStreaks(gsDone);
  const rec = ND.recordsOf(gsDone);
  const recRow = (t: string, m: NMatch | null) => (m ? { key: t, t, v: fmtRes(m), line: `J${m.j} · ${vs(m)}`, href: `/partidos/${m.id}` } : { key: t, t, v: "–", line: "Sin registros en este período.", href: "" });
  const indRow = (t: string, x: { v: number; id: string; m: NMatch } | null, unit: string) =>
    x
      ? { key: t, t, v: `${x.v}${unit}`, line: `${ND.name(x.id)} · J${x.m.j}, ${vs(x.m)}`, img: x.id, alt: `La camiseta de ${ND.name(x.id)}`, pick: () => act.go("jugadores", { pick: x.id }), has: !!ND.SQUAD[x.id] }
      : { key: t, t, v: "–", line: "Sin registros en este período.", img: "", alt: "", pick: () => {}, has: false };
  const rDone = ND.rows(gsDone);
  const SKN = {
    g: ["Marcando", "gStreak", "partidos seguidos marcando"], a: ["Asistiendo", "aStreak", "partidos seguidos dando un pase de gol"], ga: ["G o A", "caStreak", "partidos seguidos marcando o asistiendo"],
    p: ["Jugando", "pStreak", "partidos seguidos jugando"], c: ["Sin tarjetas", "cStreak", "partidos seguidos jugando sin ver tarjeta"],
  } as const;
  const SK = st.streakK;
  const pstreak = rDone
    .map((r) => {
      const s = r[SKN[SK][1]];
      return { key: r.id, name: r.name, best: s.best, cur: s.cur, live: s.cur > 0 && s.cur === s.best, range: s.best && s.from && s.to ? (s.from.j === s.to.j ? `J${s.from.j}` : `J${s.from.j}–J${s.to.j}`) : "" };
    })
    .filter((r) => r.best > 0)
    .sort((a, b) => b.best - a.best || b.cur - a.cur)
    .slice(0, 6);
  const col = ND.collection(gsDone, rDone);
  const colF = col.filter((c) => st.cromoK === "todos" || c.kind === st.cromoK || (st.cromoK === "goles" && c.kind === "asist"));
  const evoK = st.evoK;
  const evoMetric = evoK;
  const autoIds = ND.ranked(rDone, evoMetric)
    .filter((r) => ND.metricOf(r, evoMetric) > 0)
    .slice(0, 4)
    .map((r) => r.id);
  const evoIds = st.evoIds && st.evoIds.length ? st.evoIds.filter((id) => ND.SQUAD[id]).slice(0, 6) : autoIds;
  const ev = ND.evo(se, upto, evoIds, evoK);
  const multi = rDone
    .filter((r) => r.braces || r.hats)
    .map((r) => ({ key: r.id, name: r.name, t: `${r.hats ? `${r.hats} hat-trick${r.hats > 1 ? "s" : ""} · ` : ""}${r.braces}${r.braces === 1 ? " partido" : " partidos"} con dos o más` }));
  const multiA: Record<string, number> = {};
  gsDone.forEach((m) => {
    const pa: Record<string, number> = {};
    m.goals.forEach((g) => g[1] && (pa[g[1]] = (pa[g[1]] || 0) + 1));
    Object.keys(pa).forEach((id) => pa[id] >= 2 && (multiA[id] = (multiA[id] || 0) + 1));
  });
  Object.keys(multiA).forEach((id) => multi.push({ key: `a-${id}`, name: ND.name(id), t: `${multiA[id]}${multiA[id] === 1 ? " partido" : " partidos"} con dos o más asistencias` }));
  const bestStreak = ts.slice().sort((a, b) => b.s.best - a.s.best)[0];
  const rv2 = st.recView;
  const EVO_WORD = { goles: "goles", asist: "asistencias", ga: "goles y asistencias", pj: "partidos", min: "minutos" } as const;
  const records = {
    kick: `Récords · ${{ rachas: "rachas", marcas: "marcas", cromos: "la colección", evolucion: "evolución" }[rv2]}`,
    title:
      rv2 === "cromos"
        ? `${col.filter((c) => c.got).length} de ${col.length} cromos pegados`
        : rv2 === "marcas"
          ? rec.bigWin
            ? `La mayor: ${fmtRes(rec.bigWin)} en la J${rec.bigWin.j}`
            : rec.mostFor
              ? "Aún sin victorias: la primera estrena las marcas"
              : "Sin marcas todavía"
          : rv2 === "evolucion"
            ? evoIds[0]
              ? `${ND.name(evoIds[0])} tira del grupo`
              : "Sin datos todavía"
            : bestStreak && bestStreak.s.best
              ? `${bestStreak.s.best} ${(bestStreak.s.best === 1 ? ONE_STREAK[bestStreak.k] ?? bestStreak.k : bestStreak.k).toLowerCase()}`
              : "Las rachas empiezan con la primera victoria",
    sub:
      rv2 === "evolucion"
        ? `Acumulado jornada a jornada hasta la J${upto}: la moviola mueve el corte.`
        : gsDone.length <= 1
          ? "Con una jornada jugada, las rachas y las marcas acaban de empezar: se rellenan solas jornada a jornada."
          : `Hasta la J${upto}. Cada marca abre su partido o su jugador.`,
    views: (
      [
        ["rachas", "Rachas"],
        ["marcas", "Marcas"],
        ["cromos", "Cromos"],
        ["evolucion", "Evolución"],
      ] as const
    ).map((v) => ({ t: v[1], on: rv2 === v[0], pick: () => act.set({ recView: v[0] }) })),
    viewI: ["rachas", "marcas", "cromos", "evolucion"].indexOf(rv2),
    isRachas: rv2 === "rachas", isMarcas: rv2 === "marcas", isCromos: rv2 === "cromos", isEvo: rv2 === "evolucion",
    team: ts.map((x) => ({
      key: x.k, t: x.k, best: x.s.best, cur: x.s.cur,
      line: x.s.best && x.s.from && x.s.to ? `Récord J${x.s.from.j}${x.s.to.j !== x.s.from.j ? `–J${x.s.to.j}` : ""} · ahora ${x.s.cur}` : "Aún sin racha",
      live: x.s.cur > 0 && x.s.cur === x.s.best,
    })),
    streakOpts: (Object.keys(SKN) as (keyof typeof SKN)[]).map((k2) => ({ t: SKN[k2][0], on: SK === k2, pick: set({ streakK: k2 }) })),
    streakI: Object.keys(SKN).indexOf(SK), streakSub: `Récord y racha actual de ${SKN[SK][2]}. Un partido sin hacerlo la corta.`,
    players: pstreak, noPlayers: pstreak.length === 0,
    teamRec: [recRow("Mayor victoria", rec.bigWin), recRow("Más goles a favor", rec.mostFor), recRow("Partido con más goles", rec.mostTotal), recRow("Más goles encajados", rec.mostAgainst)],
    indRec: [indRow("Más goles en un partido", rec.ind.goals, ""), indRow("Más asistencias en un partido", rec.ind.asis, ""), indRow("Más goles y asistencias", rec.ind.ga, ""), indRow("Gol más temprano", rec.ind.early, "′")],
    multi, hasMulti: multi.length > 0, multiNone: multi.length ? "" : "Nadie ha marcado dos en un partido todavía: el primer doblete aparecerá aquí.",
    cromos: colF.map((c, i) => ({ ...c, key: `${c.title}-${i}` })),
    /** The whole collection, whatever «Qué cromos ver» shows: «3 de 10 conseguidos». */
    cromoGot: col.filter((c) => c.got).length, cromoN: col.length,
    cromoOpts: (
      [
        ["todos", "Todos"],
        ["goles", "Goles"],
        ["partidos", "Partidos"],
      ] as const
    ).map((v) => ({ t: v[1], on: st.cromoK === v[0], pick: set({ cromoK: v[0] }) })),
    cromoI: ["todos", "goles", "partidos"].indexOf(st.cromoK),
    evoOpts: (
      [
        ["goles", "Goles"],
        ["asist", "Asist."],
        ["ga", "G+A"],
        ["pj", "Partidos"],
        ["min", "Minutos"],
      ] as const
    ).map((v) => ({ t: v[1], on: evoK === v[0], pick: set({ evoK: v[0], evoIds: null }) })),
    evoI: ["goles", "asist", "ga", "pj", "min"].indexOf(evoK),
    evoPeople: ND.IDS.map((id) => {
      const on = evoIds.includes(id);
      return {
        key: id, t: ND.name(id), on,
        pick: () => {
          const cur = evoIds.slice();
          if (on) cur.splice(cur.indexOf(id), 1);
          else if (cur.length < 6) cur.push(id);
          else {
            act.say("Hasta seis jugadores a la vez.");
            return;
          }
          act.set({ evoIds: cur });
        },
      };
    }),
    evo: {
      d: ev.d, keys: evoIds.map((id, i) => ({ key: id, id, name: ND.name(id), v: evoK === "min" ? Math.round(ev.last[i]) : ev.last[i], cls: `nu-evo__k--${i}`, alt: `La camiseta de ${ND.name(id)}` })),
      cap: `Acumulado de ${EVO_WORD[evoK]} hasta la J${upto}`, one: ev.n <= 1,
    },
    hitos: ND.ranked(rDone, "goles")
      .filter((r) => r.g > 0)
      .slice(0, 4)
      .map((r) => {
        const left = r.next - r.g;
        return { key: r.id, name: r.name, g: r.g, step: r.next, w: Math.round((r.g / r.next) * 100), t: left === 1 ? "Le falta 1 gol" : `Le faltan ${left} goles` };
      }),
    i: { rachas: info("rachas"), marcas: info("marcas"), cromos: info("cromos"), evolucion: info("evolucion") },
  };

  // ---------- sheets
  let mt: null | {
    id: string; t: string; fam: string; v: number | string; st: string; cls: string; def: string; narr: string; scope: string; why: string;
    evid: { key: string; t: string; d: string; href: string }[]; noEv: boolean; evMore: string;
  } = null;
  if (st.sheet === "metric") {
    const c = CAT.find((x) => x[0] === st.sheetId);
    const t = c ? TILE_V[c[0]] : undefined;
    const evid: { key: string; t: string; d: string; href: string }[] = [];
    const detail = c ? metrics.get(c[0]) : undefined;
    if (c && hasAnalysisSource) {
      for (const evidenceId of detail?.evidenceEventIds ?? []) {
        const observation = actions.observations.find(o => o.evidenceId === evidenceId);
        if (!observation) continue;
        const match = gs.find(m => m.id === observation.matchId);
        const minute = observation.time ? ` · ${Math.max(1, Math.ceil(observation.time.to / 60))}′` : " · sin minuto";
        const actor = observation.actorId ? ND.name(observation.actorId) : observation.team === "us" ? "Piti · jugador sin identificar" : "El rival";
        evid.push({ key: evidenceId, t: `J${match?.j ?? "?"}${minute}`, d: actor, href: `/partidos/${observation.matchId}/numeros` });
      }
    } else if (c) {
      gs.forEach((m) => {
        if (c[0] === "015") m.goals.forEach((g, k) => evid.push({ key: `${m.id}-${k}`, t: `J${m.j} · ${g[2]}′`, d: `Gol de ${ND.name(g[0])}${g[1] ? `, pase de ${ND.name(g[1])}` : ""}`, href: `/partidos/${m.id}` }));
        else if (c[0] === "105") m.goals.forEach((g, k) => g[1] && evid.push({ key: `${m.id}-${k}`, t: `J${m.j} · ${g[2]}′`, d: `Pase de ${ND.name(g[1])} a ${ND.name(g[0])}`, href: `/partidos/${m.id}` }));
        else if (c[0] === "300") m.cards.forEach((e, k) => evid.push({ key: `${m.id}-${k}`, t: `J${m.j} · ${e[1]}′`, d: `Amarilla a ${ND.name(e[0])}`, href: `/partidos/${m.id}` }));
      });
      if (!evid.length && t && t.status === "part") {
        const keyOf = ({ "067": "pas", "070": "pok", "029": "sh", "030": "sot", "106": "kp", "114": "cr", "206": "rec", "201": "tov", "169": "int", "173": "cl", "151": "du", "135": "dr", "272": "sv" } as Record<string, string>)[c[0]];
        if (keyOf)
          ND.ranked(techRows, keyOf)
            .filter((r) => ND.metricOf(r, keyOf) > 0)
            .slice(0, 6)
            .forEach((r) => evid.push({ key: r.id, t: r.name, d: `${ND.metricOf(r, keyOf)} en ${nN === 1 ? `la J${narrated[0].j}` : `${nN} partidos`}`, href: `/jugadores/${r.id}` }));
      }
    }
    mt = c
      ? {
          id: c[0], t: c[2], fam: c[1], v: t ? t.v : "–", st: detail ? ({ complete: "Completo", partial: "Parcial", unknown: "Sin información", no_sample: "Sin oportunidades", not_configured: "Falta configuración", not_applicable: "No aplicable" }[detail.status]) : t ? t.statusT : c[5] ? "Fuera del audio" : "Sin datos", cls: t ? t.cls : "is-none",
          def: c[3], narr: c[4], scope: c[6] || "",
          why: detail ? `${detail.reason}${detail.pending ? ` ${detail.pending} acciones o atributos pendientes.` : ""}` : t
            ? t.status === "ok"
              ? "Sale del acta: cada partido lo trae."
              : t.status === "part"
                ? `Cuenta solo lo que se narró (${partial}). Las jugadas sin narrar no suman.`
                : "Aún no hay jugadas narradas para calcularla en este período."
            : c[5]
              ? "Necesita vídeo, seguimiento u otra fuente: no se puede sacar solo del audio de la mesa."
              : "Está definida, pero estos datos no la calculan todavía.",
          evid: evid.slice(0, 6), noEv: evid.length === 0, evMore: evid.length > 6 ? `${evid.length - 6} más` : "",
        }
      : null;
  }
  let infoS = { t: "", d: "", extra: "", where: "" };
  if (st.sheet === "info") {
    const key = String(st.sheetId || "");
    if (key === "m:porra") infoS = { t: NU_GLOSS.porra[0], d: NU_GLOSS.porra[1], extra: "Solo la ve el equipo.", where: "Jugadores › Porra" };
    else if (key.startsWith("m:")) {
      const M2 = NU_MET[key.slice(2)];
      if (M2) infoS = { t: M2.t, d: M2.d, extra: M2.tech ? "Sale de la narración de la mesa: es parcial cuando no se narró todo el partido." : M2.low ? "En esta estadística, menos es mejor: el ranking la ordena de menos a más." : "Sale del acta de cada partido.", where: `Jugadores › ${M2.g}` };
    } else if (NU_GLOSS[key]) infoS = { t: NU_GLOSS[key][0], d: NU_GLOSS[key][1], extra: "", where: "" };
  }
  const rem = se.matches.filter((m) => (m.st === "por" || m.st === "apl") && !se.closed);
  let ysiPts = 0;
  let ysiDg = 0;
  const ysiRows = rem.map((m) => {
    const v = st.ysi[m.id] || null;
    if (v === "g") {
      ysiPts += 3;
      ysiDg += 1;
    }
    if (v === "e") ysiPts += 1;
    if (v === "p") ysiDg -= 1;
    const pk = (x: "g" | "e" | "p") => () => act.set({ ysi: { ...st.ysi, [m.id]: st.ysi[m.id] === x ? null : x } });
    return { key: m.id, j: `J${m.j}`, rival: m.rival, where: `${m.home ? "En casa" : "Fuera"} · ${m.day}${m.st === "apl" ? " · aplazado" : ""}`, g: v === "g", e: v === "e", p: v === "p", pg: pk("g"), pe: pk("e"), pp: pk("p"), lab: `J${m.j} contra ${m.rival}` };
  });
  const basePts = usRow ? usRow.pts : 0;
  const fill = (x: "g" | "p" | "asi") => () => {
    const y: NuState["ysi"] = {};
    rem.forEach((m, i) => (y[m.id] = x === "asi" ? (["g", "g", "p", "e", "g", "p"] as const)[i % 6] : x));
    act.set({ ysi: y });
  };
  const liveBonus = withLive && liveM ? ({ g: 3, e: 1, p: 0 } as const)[result(liveM) ?? "e"] : 0;
  const ysi = {
    rows: ysiRows,
    counts: [
      { t: "puntos", v: basePts + ysiPts },
      { t: "en la tabla", v: hasTable ? `${posWith(se, ysiPts + liveBonus, ysiDg)}º` : "–" },
      { t: "como mucho", v: basePts + rem.length * 3 },
      { t: "como poco", v: basePts },
    ],
    fillG: fill("g"), fillAsi: fill("asi"), fillP: fill("p"),
    real: () => {
      act.set({ ysi: {} });
      act.say("De vuelta a lo real.");
    },
    note: `El resto de equipos se queda como está hoy${withLive && liveM ? `; el ${fmtRes(liveM)} de ${tonightWord(liveM.time)} cuenta como si acaba así.` : "."}`,
  };

  // ---------- the questions people ask, per screen (the nav teaches) and search across everything
  const nextRival = (se.matches.find((m) => m.st !== "fin") || se.matches[0])?.rival;
  const lastRival = played.length ? played[played.length - 1].rival : nextRival;
  const QS: [string, Section, Partial<NuState>, Sheet?][] = [
    ["¿Quién marca más?", "jugadores", { rankK: "goles", pick: null }], ["¿Quién da más pases de gol?", "jugadores", { rankK: "asist", pick: null }],
    [myId ? "¿Cuántos minutos llevo?" : "¿Quién juega más minutos?", "jugadores", { rankK: "min", pick: myId || null }], ["¿Quién ha sido MVP?", "jugadores", { rankK: "mvp", pick: null }],
    ["¿Quién ve más tarjetas?", "jugadores", { rankK: "yc", pick: null }], ["¿Cómo vamos en la liga?", "temporada", {}],
    [`¿Cómo nos va contra ${lastRival || "el rival"}?`, "rivales", { rival: lastRival ?? null }], ["¿Contra quién jugamos ahora?", "rivales", { rival: nextRival ?? null }],
    ["¿Cuándo marcamos y cuándo nos marcan?", "juego", { clockK: "ambos" }], ["¿Cuántos pases completamos?", "juego", { team: "us" }],
    ["¿Dónde juega cada uno?", "campo", { campoView: "puestos" }], ["¿Quién le da los goles a quién?", "campo", { campoView: "pases" }],
    ["¿Qué racha llevamos?", "records", { recView: "rachas" }], ["¿Cuál es nuestra mayor victoria?", "records", { recView: "marcas" }],
    ["¿Qué cromos tenemos?", "records", { recView: "cromos" }],
  ];
  if (hasTable && !se.closed) QS.push(["¿Y si ganamos lo que queda?", "temporada", {}, "ysi"]);
  const askAll = QS.map((x) => ({ key: x[0], t: x[0], place: x[1], go: () => act.ask(x[1], x[2], x[3]) }));
  const asks = askAll
    .filter((x) => x.place === place)
    .slice(0, 3)
    .concat(askAll.filter((x) => x.place !== place).slice(0, place === "temporada" ? 3 : 2));
  const sqn = strip((st.sq || "").toLowerCase().trim());
  const hit = (s: string | number) => !!sqn && strip(String(s).toLowerCase()).includes(sqn);
  const res: { key: string; g: string; t: string; s: string; go: () => void }[] = [];
  if (sqn) {
    ND.IDS.filter((id) => {
      const P = ND.SQUAD[id];
      return hit(ND.name(id)) || hit(ND.num(id)) || (P && hit(`${P.first} ${P.last}`));
    })
      .slice(0, 5)
      .forEach((id) => {
        const r = rowOf(id) ?? NO_ROW(id, ND.name(id));
        res.push({ key: `p-${id}`, g: "Jugador", t: `${ND.name(id)} · ${ND.num(id)}`, s: `${nW(r.g, "gol", "goles")} · ${nW(r.pj, "partido", "partidos")}`, go: () => act.ask("jugadores", { pick: id }) });
      });
    rv.filter((r) => hit(r.rival))
      .slice(0, 4)
      .forEach((r) => res.push({ key: `r-${r.rival}`, g: "Rival", t: r.rival, s: r.pj ? `${r.g}G ${r.e}E ${r.p}P · ${r.gf}–${r.ga}` : "Por estrenar", go: () => act.ask("rivales", { rival: r.rival }) }));
    askAll
      .filter((x) => hit(x.t))
      .slice(0, 4)
      .forEach((x) => res.push({ key: `q-${x.t}`, g: "Pregunta", t: x.t, s: SECTION_LABEL[x.place], go: x.go }));
    NU_METRICS.filter((m) => hit(m[1]) || hit(m[3]))
      .slice(0, 5)
      .forEach((m) => res.push({ key: `m-${m[0]}`, g: "Ranking", t: m[1], s: `Jugadores › ${m[2]}`, go: () => act.ask("jugadores", { rankK: m[0], pick: null }) }));
    SECTIONS.filter((p) => hit(SECTION_LABEL[p]) || hit(NU_GLOSS[p][1])).forEach((p) => res.push({ key: `s-${p}`, g: "Pantalla", t: SECTION_LABEL[p], s: NU_GLOSS[p][1], go: () => act.ask(p, {}) }));
    CAT.filter((c) => hit(c[2]))
      .slice(0, 6)
      .forEach((c) => res.push({ key: `c-${c[0]}`, g: "Estadística", t: c[2], s: `${c[1]} · ${c[0]}`, go: () => act.ask("juego", {}, "metric", c[0]) }));
  }
  const map = (
    [
      ["temporada", "La clasificación, la forma, los números del equipo, la carrera del Pichichi, ¿Y si…?"],
      ["jugadores", `Un ranking para cada una de las ${NU_METRICS.length} estadísticas, los minutos y los cambios, la ficha de números, la tabla de todos`],
      ["campo", "Pases de gol (la constelación), de quién es cada puesto, el récord de cada sistema"],
      ["juego", "De un vistazo, cuándo caen los goles, pases por tramo, quién conecta con quién, la tabla de trabajo, el catálogo de 412"],
      ["rivales", "El cara a cara y el dossier de cada rival"],
      ["records", "Rachas, marcas, la colección de cromos, la evolución"],
    ] as const
  ).map((x) => ({ key: x[0], t: SECTION_LABEL[x[0]], d: x[1], go: () => act.ask(x[0], {}) }));
  const search = {
    q: st.sq, setQ: (v: string) => act.set({ sq: v }), res, has: res.length > 0, none: !!sqn && res.length === 0, empty: !sqn, all: askAll, map,
    noneT: `Nada con «${st.sq}». Prueba con un nombre, un rival o una estadística: «pases», «${rv[0]?.rival.split(" ")[0] ?? "Orduña"}», «minutos».`,
  };

  // ---------- the rail: each section with its live headline (the nav informs)
  const pich = ND.ranked(rsAll, "goles").filter((r) => r.rank === 1 && r.g > 0);
  const heads: Record<Section, string> = {
    temporada: tableReal ? (se.closed ? `Así acabó: ${pos}` : withLive ? `${pos} si acaba así` : `${pos} · ${T.pts} puntos`) : `${T.pts}${T.pts === 1 ? " punto" : " puntos"} · ${T.g}G ${T.e}E ${T.p}P`,
    jugadores: pich.length ? `${list(pich.map((r) => r.name))}, ${pich[0].g}${pich[0].g === 1 ? " gol" : ""}` : "Por estrenar",
    campo: lk[0] ? `${ND.name(lk[0].from)} → ${ND.name(lk[0].to)}, ${lk[0].n}` : realPos ? `Puestos de ${rsAll.filter((r) => Object.keys(r.pos).length).length} jugadores` : "Sin pases de gol",
    juego: nN ? partial : `${nW(gU, "gol", "goles")} · ${nW(gs.length, "acta", "actas")}`,
    rivales: liveM && withLive ? `Hoy: ${liveM.rival}` : `Ahora: ${nextRival || "–"}`,
    records: `${col.filter((c) => c.got).length} de ${col.length} cromos`,
  };
  const shorts: Record<Section, string> = {
    temporada: tableReal ? pos : `${T.pts} pts`, jugadores: pich[0] ? `${pich[0].name.split(" ")[0]} ${pich[0].g}` : "0",
    campo: lk[0] ? `${lk[0].n}${lk[0].n === 1 ? " gol" : " goles"}` : "Puestos", juego: nN ? "Narrado" : nW(gU, "gol", "goles"),
    rivales: liveM && withLive ? "Hoy" : String(rv.length), records: nW(col.filter((c) => c.got).length, "cromo", "cromos"),
  };
  const icons = { temporada: "cal", jugadores: "shirt", campo: "pip", juego: "chart", rivales: "shield", records: "trophy" } as const;
  const rail = SECTIONS.map((id) => ({ id, label: SECTION_LABEL[id], head: heads[id], short: shorts[id], icon: icons[id], on: place === id, title: NU_GLOSS[id][1] }));

  const screen = {
    kick: { temporada: tem.kick, jugadores: jug.kick, campo: campo.kick, juego: juego.kick, rivales: rivales.kick, records: records.kick }[place],
    title: { temporada: tem.title, jugadores: jug.title, campo: campo.title, juego: juego.title, rivales: rivales.title, records: records.title }[place],
    sub: { temporada: tem.sub, jugadores: jug.sub, campo: campo.sub, juego: juego.sub, rivales: rivales.sub, records: records.sub }[place],
    prov: place === "temporada" && tem.prov,
  };
  return {
    analysis, se, edge, upto, all, withLive, member, lede, time, scope, tem, jug, gj, campo, juego, ws, cat, rivales, records, mt, infoS, ysi, asks, search, rail, screen,
    pl: st.sheet === "player" && st.sheetId ? playerCard(st.sheetId) : null,
    rv: st.sheet === "rival" && st.sheetId ? dossier(rivalBySlug(st.sheetId) ?? st.sheetId) : null,
    slimT: `${all ? "Todas" : se.S.name} · ${time.jLabel}${time.tip ? ` · ${time.tip.replace(/^J\d+ · /, "")}` : ""}`,
    /** The sky follows the scrubbed jornada's month: September's sun, the floodlights from November. */
    flood: (() => {
      const m = se.matches.find((x) => x.j === Math.max(1, upto));
      if (!m) return 1;
      return m.month >= 11 || m.month <= 3 ? 1 : m.month === 10 ? 0.5 : 0;
    })(),
    json: {
      temporada: all ? "todas" : se.S.name, hasta: `J${upto}`, campo: st.campo,
      filtros: { partidos: st.partidos, jugadores: st.jug, equipo: us ? "piti" : "rival", parte: parte === "all" ? null : Number(parte) },
      partidos: gs.map((m) => ({ id: m.id, j: m.j, rival: m.rival, resultado: fmtRes(m), estado: m.st })),
      jugadores: rs.filter((r) => r.pj).map((r) => ({ id: r.id, nombre: r.name, dorsal: r.n, partidos: r.pj, minutos: r.minKnown ? Math.round(r.min) : null, goles: r.g, asistencias: r.a, amarillas: r.yc })),
      deUnVistazo: vistazo.map((t) => ({ id: t.id, estadistica: t.t, valor: t.v, estado: t.statusT })),
      hoy: env.today,
    },
  };
}
export type NuView = ReturnType<typeof numerosView>;
