// Números «Vidrio», round 3 (the NU- boards): an almanac. The identity header with the slim time bar (what numbers
// to see + «La moviola de la temporada», which drives every screen), a rail of sections each with its live
// headline (a sticky tab strip on the phone), and one full screen per section with its own address — Temporada,
// Jugadores, El campo, El juego, Rivales, Récords — swapped with a View Transition (exit → morph → enter); «Ver
// todo» grows in place and the sheets open over it, both with their address too. On a desktop the page is an app
// frame: it never scrolls, each region scrolls inside. Every number is the boards' arithmetic (numeros/view.ts) on
// production's data (numeros/adapt.ts). Server-rendered for fans; the viewer's own pieces once hydrated.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent, type TouchEvent } from "react";
import { flushSync } from "react-dom";
import { useLocation, useNavigate, useRouter } from "@tanstack/react-router";
import { VidrioSky, useLightPointer, useReducedMotion } from "../../components/vidrio";
import { CelesteDock, CelesteFooter, CelesteHeader } from "../../components/celeste/Chrome";
import { ThemeToggle } from "../../components/ThemeToggle";
import { usePageKitStills } from "../../components/jersey3d/usePageKitStills";
import { KitStillContext } from "../../components/jersey3d/kitStill";
import { useSeason } from "../../context/SeasonContext";
import { useAuth } from "../../context/AuthContext";
import { useClock } from "../../hooks/useClock";
import { useViewer } from "../../hooks/useViewer";
import { useDocumentTheme } from "../../hooks/useDocumentTheme";
import { nameFor, nextFixture, playerForSeason, useClubData, type ClubMatch } from "../../lib/clubData";
import { useStandings } from "../../lib/useStandings";
import { currentSeasonId, mvpWinners } from "../../lib/vestuario";
import { useMvpResults, usePorraStandings } from "../vestuario/live";
import { seasonStrip, stripStateOf } from "../../lib/derived/vidrio/strip";
import { votesClosedAt } from "../../lib/derived/mvpOf";
import { matchPhase } from "../../../functions/src/matchEngine";
import { niceName } from "../../lib/derived/words";
import { leaguePhrase } from "../partidos/vidrio/model";
import type { Demo } from "../partidos/pa/demo";
import { makeND, slug, type Moment, type NSeasonData } from "./numeros/nd";
import { seasonData, squadOf, type SquadInput } from "./numeros/adapt";
import { loadCatalog, type CatRow } from "./numeros/catalog";
import { addressKey, peopleIndex, stateFromUrl, urlOf, type Search } from "./numeros/url";
import { numerosView, PLACES, type Act, type Env, type Grow, type NuState, type Place, type Sheet, type Viewer } from "./numeros/view";
import { I, Q } from "./numeros/bits";
import { Campo, Juego, Jugadores, Records, Rivales, Temporada } from "./numeros/Screens";
import { Sheets } from "./numeros/Sheets";
import { csvText, download, jsonText } from "./numeros/files";
import "../../styles/vidrio/tokens.css";
import "../../styles/vidrio/glass.css";
import "../../styles/vidrio/components.css";
import "../../styles/vidrio/reading.css";
import "../../styles/vidrio-paginas.css";
import "../../styles/numeros.css";
import "../../styles/numeros-fixes.css";

const subscribeNothing = () => () => {};
const useHydrated = (): boolean => useSyncExternalStore(subscribeNothing, () => true, () => false);
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
/** «liga» → «Liga de fútbol 7»: the club plays fútbol 7, and the boards say so when the league's name doesn't. */
const leagueOf = (competition: string | null | undefined): string => {
  const p = leaguePhrase(competition);
  const said = p && !/f[úu]tbol|f-?7|f-?11/i.test(p) ? `${p} de fútbol 7` : p;
  return said ? said.charAt(0).toLocaleUpperCase("es") + said.slice(1) : "";
};
/** The moment the season is at: the last jornada played (or tonight's), tonight live, every jornada played. */
function momentOf(S: NSeasonData): Moment {
  const done = S.matches.filter((m) => m.st === "fin" || m.st === "live");
  return { edge: Math.max(1, ...done.map((m) => m.j)), live: S.matches.some((m) => m.st === "live"), closed: done.length > 0 && !S.matches.some((m) => m.st === "por" || m.st === "live") };
}
/** The DEV board strip's demo MVP for the long season (it keeps no votes): most G+A that night, a clean sheet the keeper's. */
function demoMvp(m: NSeasonData["matches"][number]): string | null {
  if (m.st !== "fin") return null;
  if (m.ga === 0) return m.starters[0] ?? null;
  const sc: Record<string, number> = {};
  m.goals.forEach(([g, a]) => {
    sc[g] = (sc[g] || 0) + 1.1;
    if (a) sc[a] = (sc[a] || 0) + 1;
  });
  return Object.entries(sc).sort((a, b) => b[1] - a[1])[0]?.[0] ?? m.starters[0] ?? null;
}
/**
 * What the season's numbers read of the clock: each match's place on the strip and its phase (whether its score is
 * still the plays'), and the last MVP vote closed. Two moments with the same key build the same numbers, so the
 * seasons rebuild when one of these moves, not on every tick of the clock.
 */
const momentKeyOf = (matches: readonly ClubMatch[], now: number): string =>
  `${matches.map((m) => `${m.id}:${stripStateOf(m, now)}:${matchPhase(m, now)}`).join("|")}|${votesClosedAt(matches, now)}`;
/** `now` as it was when `key` last changed: any moment with the same key reads the same, so it can stand for them all. */
function useHeldNow(now: number, key: string): number {
  const [held, setHeld] = useState({ key, now });
  if (held.key !== key) setHeld({ key, now });
  return held.key === key ? held.now : now;
}
const TODAY = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" });
const SEP = "\u001f";

const DEMO_PORRA: [string, number][] = [["kevin", 61], ["jordi", 54], ["huberoski", 49], ["marta", 47], ["adrian", 44], ["brawan", 38], ["alcides", 35], ["fer", 31], ["evans", 27], ["erik", 22]];

const BASE: NuState = {
  place: "temporada", upto: Number.POSITIVE_INFINITY, playing: false, raceK: "goles", star: null, temporada: "esta", campo: "todo", jug: [], partidos: [], grow: null, sheet: null, sheetId: null,
  rankK: "goles", pick: null, rival: null, campoView: "pases", puesto: "", team: "us", parte: "all", recView: "rachas", cromoK: "todos", evoK: "goles", ysi: {}, sortK: "goles",
  q: "", rq: "", catQ: "", catFam: "", catN: 24, catX: false, allStats: false, colSet: "basico", wsSet: "resumen", clockK: "ambos", streakK: "g", evoIds: null, sq: "",
};
/** The parts of the state the address holds (everything else is the screen's own). */
const URL_KEYS = ["place", "campoView", "recView", "grow", "sheet", "sheetId", "temporada", "upto", "campo", "partidos", "jug", "rankK", "pick", "rival", "star", "puesto", "team", "parte", "catFam", "catX", "catQ", "sq"] as const;

/** The View Transition of the boards: html[data-nu-dir] (down · up) and a transition whose update commits at once;
 *  without View Transitions, under reduced motion or a shot, the change just happens. */
function transition(dir: "down" | "up" | null, reduced: boolean, update: () => void) {
  const d = document.documentElement;
  if (dir) d.setAttribute("data-nu-dir", dir);
  const clean = () => d.removeAttribute("data-nu-dir");
  const start = (document as Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } }).startViewTransition;
  if (typeof start === "function" && !reduced && !(window as { __SHOT?: unknown }).__SHOT) {
    try {
      start.call(document, update).finished.then(clean, clean);
      return;
    } catch {
      /* plain */
    }
  }
  update();
  clean();
}

export function NumerosPage() {
  const club = useClubData();
  const realSeasons = useSeason().seasons;
  const { user } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();
  const location = useLocation();
  const raw = (location.search ?? {}) as Search;
  const clockNow = useClock(30_000);
  const realViewer = useViewer();
  const hydrated = useHydrated();
  const theme = useDocumentTheme();
  const reduced = useReducedMotion();
  const mvpResults = useMvpResults();

  // ── DEV: the boards' «Maqueta» strip on the real page — ?maqueta=real|larga|cerrada & quien=fan|socio|jugador
  const maqueta = import.meta.env.DEV ? str(raw.maqueta) : null;
  const quien = import.meta.env.DEV ? str(raw.quien) : null;
  const demoOn = maqueta === "larga" || maqueta === "cerrada";
  const [demo, setDemo] = useState<Demo | null>(null);
  useEffect(() => {
    if (demoOn) void import("../partidos/pa/demo").then((m) => setDemo(m.demoSeason(null)));
  }, [demoOn]);
  const useDemo = demoOn && !!demo;
  const matches: ClubMatch[] = useDemo && demo ? demo.matches : club.matches;
  const players = useDemo && demo ? (demo.players as unknown as typeof club.players) : club.players;
  const seasons = useMemo(() => (useDemo && demo ? [demo.season] : realSeasons), [useDemo, demo, realSeasons]);
  const now = useDemo && demo ? demo.now : clockNow;

  // ── the season: the one being played, or ?temporada=<slug|id>; «todas» adds the others
  const current = useDemo && demo ? demo.season.id : currentSeasonId(nextFixture(matches, now), matches, seasons);
  const askedT = str(raw.temporada);
  const asked = askedT && askedT !== "todas" ? (seasons.find((s) => s.id === askedT || slug(s.name) === askedT)?.id ?? null) : null;
  const seasonId = asked ?? current ?? "";
  const season = seasons.find((s) => s.id === seasonId);
  const realStandings = useStandings(seasonId || undefined).standings;
  const standings = useDemo && demo ? demo.standings : realStandings;

  // ── who is looking (the board strip can play another viewer in DEV)
  const member = hydrated && realViewer.member;
  const porraLive = usePorraStandings(member && !useDemo ? seasonId || undefined : undefined).data;
  const jordi = players.find((p) => slug(nameFor(p)) === "jordi")?.id ?? null;
  const viewer: Viewer = useMemo(() => {
    const kind = quien === "fan" || quien === "socio" || quien === "jugador" ? quien : !member ? "fan" : realViewer.playerId ? "jugador" : "socio";
    const pid = kind === "jugador" ? (useDemo ? "jordi" : (realViewer.playerId ?? jordi)) : null;
    const porraKey = kind === "socio" ? (useDemo ? "marta" : user ? `u:${user.uid}` : null) : pid;
    return { kind, playerId: pid, name: "", porraKey };
  }, [quien, member, realViewer.playerId, useDemo, jordi, user]);

  // ── the data, as the boards read it (at the moment the clock last moved a match or a vote: see momentKeyOf)
  const dataNow = useHeldNow(now, momentKeyOf(matches, now));
  const sq = useMemo(() => {
    const inSeason = (sid: string) =>
      players
        .filter((p) => p.seasons?.includes(sid))
        .map((rawP): SquadInput => {
          const p = playerForSeason(rawP, sid, seasons);
          return {
            id: p.id, name: niceName(nameFor(p, sid)), num: p.number != null ? String(p.number) : "", first: p.firstName ?? "", last: p.lastName ?? "",
            line: p.naturalPosition ?? "", spots: [p.positions?.main, ...(p.positions?.also ?? [])].filter((x): x is string => !!x),
          };
        });
    const build = (sid: string, name: string, rows: typeof standings) => {
      const segments = seasonStrip(matches, sid, dataNow).segments;
      const porraRows = sid === seasonId ? (useDemo ? DEMO_PORRA : porraLive.length ? porraLive.map((r): [string, number] => [r.playerId ?? `u:${r.uid}`, r.points]) : null) : null;
      const S = seasonData({
        segments, seasonId: sid, seasonName: name,
        league: leagueOf(rows?.competition || matches.find((m) => m.seasonId === sid && m.competition)?.competition),
        standings: rows?.rows ?? [], mvpOf: (m) => mvpWinners(m, mvpResults.get(m.id), dataNow), mvpResults, real: !useDemo, mvpDemo: useDemo,
        porra: porraRows ? { rows: porraRows, demo: useDemo, names: useDemo ? { marta: "Marta" } : Object.fromEntries(porraLive.map((r) => [r.playerId ?? `u:${r.uid}`, niceName(r.name)])) } : null,
      });
      if (useDemo)
        S.matches.forEach((m) => {
          m.mvp = demoMvp(m);
          m.mvps = m.mvp ? [m.mvp] : [];
        });
      return S;
    };
    const S = build(seasonId, season?.name ?? "La temporada", standings);
    const others = seasons.filter((s) => s.id !== seasonId).map((s) => build(s.id, s.name, null));
    const ids = new Set<string>();
    const people: SquadInput[] = [];
    [seasonId, ...(askedT === "todas" ? others.map((o) => o.id) : [])].forEach((sid) =>
      inSeason(sid).forEach((p) => {
        if (ids.has(p.id)) return;
        ids.add(p.id);
        people.push(p);
      }),
    );
    const squad = squadOf(people, [S, ...others].flatMap((x) => x.matches));
    const names: Record<string, string> = { ...(S.porra?.names ?? {}) };
    matches.forEach((m) => (m.guests ?? []).forEach((g) => (names[`guest:${g.id}`] = g.name)));
    return { S, others, squad, names };
  }, [players, seasons, matches, dataNow, seasonId, season?.name, standings, mvpResults, porraLive, useDemo, askedT]);

  const nd = useMemo(() => makeND(sq.squad, sq.names), [sq.squad, sq.names]);
  const moment = useMemo((): Moment => (maqueta === "cerrada" ? { edge: 16, live: false, closed: true } : momentOf(sq.S)), [sq.S, maqueta]);
  // (keyed on who is in it: a live event rebuilds the squad, and the address's players are read again only when it changes)
  const peopleKey = sq.squad.map((p) => `${p.id}${SEP}${p.name}`).join("\n");
  const people = useMemo(() => peopleIndex(peopleKey ? peopleKey.split("\n").map((l) => ({ id: l.split(SEP)[0], name: l.split(SEP)[1] })) : []), [peopleKey]);

  // ── the catalogue: loaded when a screen or a sheet needs it
  const [catalog, setCatalog] = useState<CatRow[] | null>(null);

  // ── the state: the address's part, read on arrival and on every move through history
  const fromUrl = (path: string, search: Search): NuState => {
    const u = stateFromUrl(path, search, people);
    const { seasonWord: _w, ...rest } = u;
    return { ...BASE, ...rest };
  };
  const [st, setSt] = useState<NuState>(() => fromUrl(location.pathname, raw));
  const stRef = useRef(st);
  stRef.current = st;
  const narrowNow = () => {
    try {
      const sc = pageRef.current?.querySelector<HTMLElement>(".nu-screen");
      return (sc ? sc.clientWidth : window.innerWidth) < 760;
    } catch {
      return false;
    }
  };
  const seasonWord = askedT && askedT !== "todas" && seasonId !== current && season ? slug(season.name) : undefined;
  const ctx = { people, seasonWord, edge: moment.edge, narrow: false };
  // the page's own address writes go one after another (two quick ones never land in the wrong order), each
  // compared with the address the router shows when its turn comes
  const navQ = useRef<Promise<unknown>>(Promise.resolve());
  const write = (next: NuState, replace: boolean) => {
    const u = urlOf(next, ctx);
    const keep: Record<string, string | undefined> = import.meta.env.DEV ? { maqueta: maqueta ?? undefined, quien: quien ?? undefined } : {};
    const search = { ...keep, ...u.search };
    for (const k of Object.keys(search)) if (search[k] === undefined) delete search[k];
    navQ.current = navQ.current
      .then(() => {
        const at = router.state.location;
        if (addressKey(u.path, search) === addressKey(at.pathname, (at.search ?? {}) as Search)) return;
        return navigate({ to: u.path, search, replace, resetScroll: false } as never);
      })
      .catch(() => {});
  };

  // back, forward or a link: take what the address says (a change of screen runs the View Transition backwards)
  const seen = useRef(addressKey(location.pathname, raw));
  // a sheet closed with «atrás» after its filters changed the address: back to the entry under the sheet, then
  // that entry takes the new address (so the filters chosen in the sheet stay)
  const afterBack = useRef<NuState | null>(null);
  useEffect(() => {
    const key = addressKey(location.pathname, raw);
    if (afterBack.current) {
      const n = afterBack.current;
      afterBack.current = null;
      seen.current = key;
      commit(n, true);
      return;
    }
    if (key === seen.current) return;
    seen.current = key;
    const cur = stRef.current;
    const next = fromUrl(location.pathname, raw);
    const merged: NuState = { ...cur };
    for (const k of URL_KEYS) (merged as unknown as Record<string, unknown>)[k] = next[k];
    // a narrow screen keeps its sheet for the chosen player or rival (the same address)
    if (cur.sheet === "player" && merged.place === "jugadores" && merged.pick === cur.sheetId && !merged.sheet) Object.assign(merged, { sheet: "player", sheetId: cur.sheetId });
    if (cur.sheet === "rival" && merged.place === "rivales" && merged.rival && !merged.sheet && slug(merged.rival) === slug(cur.sheetId ?? "")) Object.assign(merged, { sheet: "rival", sheetId: cur.sheetId });
    if (merged.place !== cur.place) {
      saveScroll(cur.place);
      const dir = PLACES.indexOf(merged.place) > PLACES.indexOf(cur.place) ? "down" : "up";
      transition(dir, reduced, () => {
        flushSync(() => setSt(merged));
        restoreScroll(merged.place);
      });
    } else setSt(merged);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the address is the only trigger
  }, [location.pathname, location.searchStr]);

  // the players an address names (?jugador=, ?estrella=, ?jugadores=) are known once the squad has arrived
  useEffect(() => {
    const u = fromUrl(location.pathname, raw);
    setSt((s) => ({ ...s, pick: u.pick, star: u.star, jug: u.jug, ...(u.sheet === "player" ? { sheet: u.sheet, sheetId: u.sheetId } : {}) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the squad changes
  }, [people]);

  // the address the page writes itself: no transition again
  const keyOf = (next: NuState) => {
    const u = urlOf(next, ctx);
    return addressKey(u.path, { ...(import.meta.env.DEV ? { maqueta: maqueta ?? undefined, quien: quien ?? undefined } : {}), ...u.search });
  };
  const commit = (next: NuState, replace: boolean) => {
    seen.current = keyOf(next);
    write(next, replace);
  };
  /** The address under the open sheet when it was pushed. */
  const underSheet = useRef("");

  // ── scroll per screen: the page on a phone, every scrolling region on a desktop
  const pageRef = useRef<HTMLDivElement | null>(null);
  const scrollMem = useRef<Partial<Record<Place, { y: number; r: number[] }>>>({});
  const regions = () => Array.from(pageRef.current?.querySelectorAll<HTMLElement>(".nu-screen .nu-reg, .nu-screen .nu-tem__side, .nu-screen .nu-cromos, .nu-screen .vd-grow__body, .nu-screen .nu-scroll, .nu-screen__body") ?? []);
  function saveScroll(place: Place) {
    scrollMem.current[place] = { y: window.scrollY, r: regions().map((el) => el.scrollTop) };
  }
  /** Puts the new screen where it was left (or its top under the rail): inside the transition's update, right after
   *  the swap, so the old screen is captured where it was and the new one where it goes (restored a frame later, the
   *  screen jumped before or after the animation). */
  function restoreScroll(place: Place) {
    const m = scrollMem.current[place];
    regions().forEach((el, i) => (el.scrollTop = m?.r[i] ?? 0));
    const rail = pageRef.current?.querySelector<HTMLElement>(".nu-rail");
    const scr = pageRef.current?.querySelector<HTMLElement>(".nu-screen");
    if (m) window.scrollTo(0, m.y);
    else if (scr && rail) {
      const under = getComputedStyle(rail).position === "sticky" ? rail.getBoundingClientRect().bottom : 0;
      if (scr.getBoundingClientRect().top < under) window.scrollTo(0, window.scrollY + scr.getBoundingClientRect().top - under - 8);
    }
  }

  // ── the toast
  const [say, setSay] = useState({ t: "", on: false });
  const sayT = useRef(0);
  const toast = (t: string) => {
    window.clearTimeout(sayT.current);
    setSay({ t, on: true });
    sayT.current = window.setTimeout(() => setSay((s) => ({ ...s, on: false })), 2600);
  };

  // ── sheets and grown windows: in the history (atrás closes them), the focus goes in and comes back
  const pushedOverlay = useRef(false);
  const opener = useRef<{ el: HTMLElement; t: string } | null>(null);
  const sheetRef = useRef<HTMLElement | null>(null);
  const rememberOpener = () => {
    const ae = document.activeElement as HTMLElement | null;
    opener.current = ae && ae !== document.body ? { el: ae, t: ae.textContent?.trim() ?? "" } : null;
  };
  const giveFocusBack = () =>
    window.setTimeout(() => {
      const o = opener.current;
      opener.current = null;
      if (!o) return;
      const el = document.body.contains(o.el) ? o.el : Array.from(pageRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? []).find((b) => b.textContent?.trim() === o.t);
      el?.focus({ preventScroll: true });
    }, 40);

  const setState = (p: Partial<NuState>) => {
    const next = { ...stRef.current, ...p };
    // a search typed in a sheet or a list replaces the address quietly
    setSt(next);
    if (URL_KEYS.some((k) => k in p)) commit(next, true);
  };
  const open = (sheet: Sheet, id: string | null = null) => {
    if (!stRef.current.sheet) rememberOpener();
    const next = { ...stRef.current, sheet, sheetId: id };
    if (sheet === "search") next.sq = "";
    setSt(next);
    if (sheet === "search" || sheet === "metric") void loadCatalog().then(setCatalog);
    if (!stRef.current.sheet) {
      underSheet.current = keyOf({ ...stRef.current, sheet: null, sheetId: null });
      pushedOverlay.current = true;
    }
    commit(next, !!stRef.current.sheet);
  };
  const closeSheet = () => {
    const cur = stRef.current;
    if (!cur.sheet) return;
    const next = { ...cur, sheet: null, sheetId: null };
    // closing the narrow screen's player or rival sheet leaves the choice in place
    if (pushedOverlay.current && !cur.grow) {
      pushedOverlay.current = false;
      setSt(next);
      seen.current = "";
      if (keyOf(next) !== underSheet.current) afterBack.current = next;
      router.history.back();
    } else {
      setSt(next);
      commit(next, true);
    }
    giveFocusBack();
  };
  const grow = (g: Grow | null) => {
    const cur = stRef.current;
    if (!g) {
      const next = { ...cur, grow: null };
      transition(null, reduced, () => flushSync(() => setSt(next)));
      commit(next, true);
      giveFocusBack();
      return;
    }
    rememberOpener();
    if (g === "catalogo") void loadCatalog().then(setCatalog);
    const next = { ...cur, grow: g };
    transition(null, reduced, () => flushSync(() => setSt(next)));
    commit(next, false);
    window.setTimeout(() => pageRef.current?.querySelector<HTMLElement>(".nu-grow h2")?.focus({ preventScroll: true }), 40);
  };
  const go = (place: Place, patch: Partial<NuState> = {}) => {
    const cur = stRef.current;
    const next: NuState = { ...cur, ...patch, place, grow: null, sheet: null, sheetId: null };
    if (place === cur.place) {
      setSt(next);
      commit(next, true);
      return;
    }
    saveScroll(cur.place);
    const dir = PLACES.indexOf(place) > PLACES.indexOf(cur.place) ? "down" : "up";
    transition(dir, reduced, () => {
      flushSync(() => setSt(next));
      restoreScroll(place);
    });
    commit(next, false);
  };

  // ── the moviola
  const edge = moment.edge;
  const seek = (j: number) => setState({ upto: Math.max(1, Math.min(edge, Math.round(j))) });
  const stop = () => stRef.current.playing && setSt((s) => ({ ...s, playing: false }));
  useEffect(() => {
    if (!st.playing) return;
    const t = window.setInterval(() => {
      const cur = stRef.current;
      const j = Math.min(cur.upto, edge) + 1;
      if (j > edge) {
        setSt((s) => ({ ...s, playing: false }));
        toast("La temporada, al día.");
        return;
      }
      setState({ upto: j });
    }, 900);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one timer while «Repasar» runs
  }, [st.playing, edge]);
  const play = () => {
    const cur = Math.min(stRef.current.upto, edge);
    if (reduced) {
      seek(cur >= edge ? 1 : cur + 1);
      return;
    }
    setState({ playing: true, upto: cur >= edge ? 1 : cur });
  };

  const act: Act = {
    set: setState,
    open,
    closeSheet,
    go,
    grow,
    say: toast,
    stop,
    seek,
    narrow: narrowNow,
    ask: (place, patch, sheet, id) => {
      const cur = stRef.current;
      if (cur.sheet) {
        pushedOverlay.current = false;
        opener.current = null;
      }
      if (place !== cur.place) go(place, { ...patch, sheet: null, sheetId: null });
      else {
        const next = { ...cur, ...patch, sheet: null, sheetId: null };
        setSt(next);
        commit(next, true);
      }
      if (sheet) window.setTimeout(() => open(sheet, id ?? null), place !== cur.place ? 520 : 0);
    },
    csv: (kind) => {
      const t = kind === "jugadores" ? v.gj.table : v.ws.table;
      download(kind === "jugadores" ? "manchester-piti-estadisticas.csv" : "piti-tabla-estadisticas.csv", "text/csv", csvText(t.head, t.rows));
      toast(`Descargado: ${kind === "jugadores" ? "manchester-piti-estadisticas.csv" : "piti-tabla-estadisticas.csv"}`);
    },
    json: () => {
      const name = `piti-estadisticas-${env.today}.json`;
      download(name, "application/json", jsonText(v.json));
      toast(`Exportado: ${name}`);
    },
  };

  const othersAt = useMemo(() => sq.others.map((S) => ({ S, moment: momentOf(S) })), [sq.others]);
  const today = TODAY.format(now);
  const env: Env = useMemo(() => ({ nd, S: sq.S, moment, others: othersAt, viewer, catalog, demo: useDemo, today }), [nd, sq.S, moment, othersAt, viewer, catalog, useDemo, today]);
  // the view's handlers call the latest actions (they close over this render's state), so the view itself is rebuilt
  // only when the state or the data change, not on every render of the page
  const actRef = useRef(act);
  actRef.current = act;
  const [stableAct] = useState((): Act => ({
    set: (p) => actRef.current.set(p),
    open: (sheet, id) => actRef.current.open(sheet, id),
    closeSheet: () => actRef.current.closeSheet(),
    go: (place, patch) => actRef.current.go(place, patch),
    grow: (g) => actRef.current.grow(g),
    say: (t) => actRef.current.say(t),
    stop: () => actRef.current.stop(),
    seek: (j) => actRef.current.seek(j),
    narrow: () => actRef.current.narrow(),
    ask: (place, patch, sheet, id) => actRef.current.ask(place, patch, sheet, id),
    csv: (kind) => actRef.current.csv(kind),
    json: () => actRef.current.json(),
  }));
  const v = useMemo(() => numerosView(st, env, stableAct), [st, env, stableAct]);
  const numOf = (id: string) => nd.num(id);

  // the catalogue arrives with the screen that shows it (an address that opens the catalogue or a metric)
  useEffect(() => {
    if (!catalog && (st.grow === "catalogo" || st.sheet === "metric" || st.sheet === "search")) void loadCatalog().then(setCatalog);
  }, [catalog, st.grow, st.sheet]);
  // a narrow screen opens the chosen player's or rival's sheet when the address asks for him
  const arrived = useRef(false);
  useEffect(() => {
    if (arrived.current || !hydrated) return;
    arrived.current = true;
    if (!narrowNow()) return;
    if (st.place === "jugadores" && st.pick && !st.sheet) setSt((s) => ({ ...s, sheet: "player", sheetId: s.pick }));
    if (st.place === "rivales" && st.rival && !st.sheet) setSt((s) => ({ ...s, sheet: "rival", sheetId: s.rival }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, [hydrated]);

  // ── the shirts: the printed stills of the season's squad
  const stillOf = usePageKitStills({ on: hydrated, theme, kits: ["home"], players: sq.squad.map((p) => ({ name: p.name.toUpperCase(), num: p.n === "" ? "" : String(p.n) })) });

  // ── the page's ground under every View Transition, the light that follows the pointer
  useLightPointer(pageRef);
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (stRef.current.sheet) {
        e.preventDefault();
        closeSheet();
      } else if (stRef.current.grow) {
        e.preventDefault();
        grow(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  // a sheet locks the page behind it and takes the focus
  useEffect(() => {
    if (!st.sheet) return;
    document.documentElement.style.overflow = "hidden";
    const t = window.setTimeout(() => {
      const s = sheetRef.current;
      (s?.querySelector<HTMLElement>(".nu-find__in") ?? s)?.focus({ preventScroll: true });
    }, 40);
    return () => {
      window.clearTimeout(t);
      document.documentElement.style.overflow = "";
    };
  }, [st.sheet]);

  // ── the phone's slim time line: once the time bar scrolls away, a one-line summary sticks with the tabs
  const [slim, setSlim] = useState(false);
  useEffect(() => {
    // (once a frame, with the bar and the rail found once, and --nu-railh written only when it moves)
    let raf = 0;
    let t: HTMLElement | null = null;
    let rail: HTMLElement | null = null;
    const measure = () => {
      const page = pageRef.current;
      if (!page) return;
      if (!t?.isConnected) t = page.querySelector<HTMLElement>(".nu-time");
      if (!t) return;
      if (!rail?.isConnected) rail = page.querySelector<HTMLElement>(".nu-rail");
      const w = page.clientWidth;
      const narrow = w < 700;
      const bottom = t.getBoundingClientRect().bottom;
      const h = `${narrow ? (rail?.offsetHeight ?? 0) : w < 1100 ? Math.max(0, Math.round(bottom)) : 0}px`;
      if (page.style.getPropertyValue("--nu-railh") !== h) page.style.setProperty("--nu-railh", h);
      setSlim(narrow && bottom < 60);
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        measure();
      });
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // the floodlit sky over the golden one: at opacity 0 (the day theme, an early jornada) it is hidden once its fade
  // has run, and shown again before any fade starts (a layout effect: before the frame that changes its opacity)
  const skyFlood = theme === "light" ? 0 : v.flood;
  useLayoutEffect(() => {
    const b = pageRef.current?.querySelector<HTMLElement>(":scope > .nu-sky-b");
    if (!b) return;
    if (skyFlood !== 0) {
      b.style.visibility = "";
      return;
    }
    const tm = window.setTimeout(() => (b.style.visibility = "hidden"), 1000);
    return () => window.clearTimeout(tm);
  }, [skyFlood]);

  // board fault: on the phone the tab strip scrolls sideways and kept showing the first tabs; the open one comes into view
  useEffect(() => {
    const strip = pageRef.current?.querySelector<HTMLElement>(".nu-rail__in");
    const on = strip?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!strip || !on || strip.scrollWidth <= strip.clientWidth + 1) return;
    const left = strip.scrollLeft + on.getBoundingClientRect().left - strip.getBoundingClientRect().left - 12;
    strip.scrollTo({ left: Math.max(0, left), behavior: reduced ? "auto" : "smooth" });
  }, [st.place, reduced]);

  // ── the rail: arrows move between sections, a swipe on the phone too
  const railKey = (e: KeyboardEvent) => {
    const i = PLACES.indexOf(st.place);
    const L = PLACES.length;
    const n = e.key === "ArrowDown" || e.key === "ArrowRight" ? (i + 1) % L : e.key === "ArrowUp" || e.key === "ArrowLeft" ? (i + L - 1) % L : e.key === "Home" ? 0 : e.key === "End" ? L - 1 : -1;
    if (n < 0) return;
    e.preventDefault();
    go(PLACES[n]);
    window.setTimeout(() => document.getElementById(`nu-tab-${PLACES[n]}`)?.focus(), 60);
  };
  const tx = useRef<{ x: number; y: number } | null>(null);
  const touchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    tx.current = t ? { x: t.clientX, y: t.clientY } : null;
  };
  const touchEnd = (e: TouchEvent) => {
    const t = e.changedTouches[0];
    const s = tx.current;
    tx.current = null;
    if (!t || !s || st.grow) return;
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    // (a swipe inside a table or a strip that scrolls sideways is that region's own)
    if ((e.target as HTMLElement).closest?.(".nu-scroll,.nu-asks,.nu-chips,.nu-rib")) return;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
    const i = PLACES.indexOf(st.place);
    const n = dx < 0 ? Math.min(PLACES.length - 1, i + 1) : Math.max(0, i - 1);
    if (n !== i) go(PLACES[n]);
  };

  const share = () => {
    const href = window.location.href;
    void navigator.clipboard?.writeText(href).catch(() => {});
    toast(`Enlace copiado: ${window.location.pathname}${window.location.search}`);
  };
  const time = v.time;
  const dia = theme === "light";
  const loading = club.loading && !useDemo;
  return (
    <KitStillContext.Provider value={stillOf}>
      <div ref={pageRef} className={["vx vd-pg nu", dia ? "is-dia" : "", v.withLive ? "is-live" : "", `p-${st.place}`].filter(Boolean).join(" ")} style={{ "--vd-sky-h": "1000px", "--nu-flood": dia ? 0 : v.flood } as CSSProperties} aria-busy={loading}>
        <VidrioSky light={dia ? "noon" : "dorada"} floodlit={false} height={1000} />
        <VidrioSky light={dia ? "noon" : "noche"} floodlit={!dia} height={1000} className="nu-sky-b" />
        <CelesteHeader active="stats" actions={<ThemeToggle />} live={v.se.live ? true : undefined} />
        <div className="nu-main" id="nu-main">
          <header className="nu-id">
            <div className="nu-id__t">
              <h1 className="nu-h1">Números</h1>
              <p className="nu-lede">{v.lede}</p>
            </div>
            <div className="nu-id__acts">
              <button type="button" className="vd-glass vd-press nu-find" onClick={() => open("search")} aria-haspopup="dialog">
                <I name="search" />
                <span>Busca o pregunta: un jugador, un rival, una estadística…</span>
              </button>
              <button type="button" className="vd-glass vd-press vd-ibtn nu-share" onClick={share} aria-label="Copiar el enlace de esta pantalla">
                <I name="share" />
              </button>
            </div>
            <ul className="nu-asks" aria-label="Preguntas frecuentes">
              {v.asks.map((a) => (
                <li key={a.key}>
                  <button type="button" className="nu-ask" onClick={a.go}>
                    {a.t}
                  </button>
                </li>
              ))}
            </ul>
          </header>

          <div className={`vd-glass nu-time ${time.cls}`.trim()} role="group" aria-label="El tiempo de los números: qué temporada y hasta qué jornada">
            <button type="button" className={`nu-time__scope ${time.scopeCls}`.trim()} onClick={() => open("scope")} aria-haspopup="dialog" aria-label={time.scopeLabel}>
              <I name="cal" />
              <span className="nu-time__st">
                <b>{time.scopeT}</b>
                <small>{time.scopeS}</small>
              </span>
              <I name="chev-r" className="nu-time__chev" />
            </button>
            <p className="nu-time__j" aria-live="polite">
              <b>{time.jLabel}</b>
              <small>{time.tip}</small>
              {time.back && (
                <button type="button" className="vd-link nu-time__back nu-time__back--j" onClick={() => (stop(), seek(edge))}>
                  {time.backLabel}
                </button>
              )}
            </p>
            <div className="nu-time__track">
              <div className="nu-rib" role="group" aria-label="La moviola de la temporada: una columna por jornada; arriba nuestros goles, abajo los del rival.">
                <span className="nu-rib__axis" aria-hidden="true" />
                {time.cols.map((c) => (
                  <button key={c.key} type="button" className={`nu-col ${c.cls}`} onClick={c.go} aria-label={c.label} tabIndex={-1}>
                    <span className="nu-col__up" style={{ "--u": c.up } as CSSProperties} />
                    <span className="nu-col__down" style={{ "--u": c.down } as CSSProperties} />
                    <span className="nu-col__l">{c.letter}</span>
                  </button>
                ))}
              </div>
              <div className="nu-head" style={{ left: `${time.headPct}%` }} aria-hidden="true">
                <span className="nu-head__line" />
              </div>
              <input
                className="nu-time__range"
                type="range"
                min={1}
                max={Math.max(1, time.max)}
                step={1}
                value={time.upto}
                onChange={(e) => (stop(), seek(Number(e.target.value)))}
                style={{ width: `${time.edgePct}%` }}
                aria-label="La moviola de la temporada: hasta qué jornada"
                aria-valuetext={time.valueText}
                disabled={time.off}
              />
            </div>
            <div className="nu-time__btns">
              <button type="button" className="vd-glass vd-press vd-ibtn" onClick={() => (stop(), seek(Math.min(st.upto, edge) - 1))} aria-label="Jornada anterior" disabled={time.off}>
                <I name="chev-l" />
              </button>
              <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm nu-time__play" onClick={() => (st.playing ? stop() : play())} aria-pressed={time.playing} aria-label="Repasar la temporada" disabled={time.off}>
                <I name={time.playIcon} />
                <span>{time.playLabel}</span>
              </button>
              <button type="button" className="vd-glass vd-press vd-ibtn" onClick={() => (stop(), seek(Math.min(st.upto, edge) + 1))} aria-label="Jornada siguiente" disabled={time.off}>
                <I name="chev-r" />
              </button>
              <Q label="Qué es la moviola" onClick={time.info} />
              {time.back && (
                <button type="button" className="vd-link nu-time__back" onClick={() => (stop(), seek(edge))}>
                  {time.backLabel}
                </button>
              )}
            </div>
            {time.offNote && <p className="nu-time__note">{time.offNote}</p>}
          </div>

          <nav className={`vd-glass nu-rail${slim ? " is-slim" : ""}`} aria-label="Secciones de Números">
            {slim && (
              <button type="button" className="nu-slim" onClick={() => window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" })}>
                <I name="cal" />
                <span>{v.slimT}</span>
                <I name="chev-l" className="nu-slim__up" />
                <span className="vd-vh">: volver a la barra del tiempo</span>
              </button>
            )}
            <div className="nu-rail__in" role="tablist" aria-orientation="vertical" aria-label="Secciones de Números">
              {v.rail.map((s) => (
                <button key={s.id} type="button" role="tab" id={`nu-tab-${s.id}`} aria-controls="nu-screen" aria-selected={s.on} tabIndex={s.on ? 0 : -1} className="nu-rail__b" onClick={() => go(s.id)} onKeyDown={railKey} title={s.title}>
                  {s.on && <span className="nu-rail__bead" aria-hidden="true" />}
                  <I name={s.icon} className="nu-rail__i" />
                  <span className="nu-rail__t">
                    <b>{s.label}</b>
                    <small className="nu-rail__h">{s.head}</small>
                    <small className="nu-rail__s">{s.short}</small>
                  </span>
                </button>
              ))}
            </div>
          </nav>

          <section className="nu-screen" id="nu-screen" role="tabpanel" aria-labelledby={`nu-tab-${st.place}`} onTouchStart={touchStart} onTouchEnd={touchEnd}>
            <header className="nu-screen__head">
              <p className="nu-screen__kick">
                {v.screen.kick} <Q label="Qué hay en esta pantalla" onClick={() => open("info", st.place)} />
              </p>
              <h2 className="nu-screen__title" id="nu-screen-title">
                {v.screen.title}
                {v.screen.prov && (
                  <>
                    {" "}
                    <span className="vd-provtag">Si acaba así</span>
                  </>
                )}
              </h2>
              <p className="nu-screen__sub">{v.screen.sub}</p>
            </header>
            <div className="nu-screen__body">
              {club.error && !useDemo ? (
                <p className="nu-empty" role="alert">
                  No nos llegan los números. Suele ser la conexión o el servidor del club: dale otra vez en un momento.
                </p>
              ) : st.place === "temporada" ? (
                <Temporada v={v} grow={st.grow === "tabla"} onClose={() => grow(null)} />
              ) : st.place === "jugadores" ? (
                <Jugadores v={v} grow={st.grow === "jugadores"} onClose={() => grow(null)} numOf={numOf} />
              ) : st.place === "campo" ? (
                <Campo v={v} numOf={numOf} />
              ) : st.place === "juego" ? (
                <Juego v={v} grow={st.grow === "mesa" || st.grow === "catalogo" ? st.grow : null} onClose={() => grow(null)} />
              ) : st.place === "rivales" ? (
                <Rivales v={v} grow={st.grow === "rivales"} onClose={() => grow(null)} />
              ) : (
                <Records v={v} numOf={numOf} />
              )}
            </div>
          </section>
        </div>
        <CelesteFooter />
        <CelesteDock active="stats" live={v.se.live ? true : undefined} />

        <p className="vd-vh" role="status" aria-live="polite">
          {say.t}
        </p>
        <div className={`nu-toast${say.on ? " is-on" : ""}`} aria-hidden="true">
          <I name="check" />
          <span>{say.t}</span>
        </div>
        <Sheets v={v} st={st} onClose={closeSheet} openSearch={() => open("search")} infoScope={() => open("info", "scope")} numOf={numOf} sheetRef={sheetRef} />
      </div>
    </KitStillContext.Provider>
  );
}
