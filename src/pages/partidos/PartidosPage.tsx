// Partidos «Vidrio», round 11 (the PA- boards): one season, three screens with their own address — Jornadas
// (/partidos: the ribbon of light and the lens), Tabla (/partidos/tabla: el camino, the table or «La tabla, mientras
// llega», «¿Y si…?») and Balance (/partidos/balance: the season's sky columns, the readout, seven facets). The
// identity stays on top (the season, the three screens with their live headlines, the rival search); changing
// screen is a View Transition (the screen leaves, every jornada flies to its place in the next one, the new screen
// enters), and «atrás» runs it backwards. Server-rendered for fans; the viewer's own pieces load once hydrated.
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent, type MouseEvent, type TouchEvent } from "react";
import { flushSync } from "react-dom";
import { useLocation, useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import { PipWindow, VidrioSky, openScorePip, useLiveDock, useReducedMotion, useRefraction, type ScorePip } from "../../components/vidrio";
import { pipBottom } from "../../components/vidrio/live/liveModel";
import { CelesteDock, CelesteFooter, CelesteHeader } from "../../components/celeste/Chrome";
import { ThemeToggle } from "../../components/ThemeToggle";
import { usePageKitStills } from "../../components/jersey3d/usePageKitStills";
import { KitStillContext } from "../../components/jersey3d/kitStill";
import { useSeason } from "../../context/SeasonContext";
import { useClock } from "../../hooks/useClock";
import { useViewer } from "../../hooks/useViewer";
import { useDocumentTheme } from "../../hooks/useDocumentTheme";
import { nameFor, nextFixture, playerForSeason, useClubData } from "../../lib/clubData";
import { useStandings } from "../../lib/useStandings";
import { currentSeasonId, mvpWinners } from "../../lib/vestuario";
import { mvpVoteOpen } from "../../lib/derived/memberWindows";
import { useMvpResults } from "../vestuario/live";
import { shownMinute } from "../../lib/partidos";
import { useMatchWeatherHourly } from "../../lib/weather";
import { seasonStrip } from "../../lib/derived/vidrio/strip";
import { niceName } from "../../lib/derived/words";
import { clockTime, leaguePhrase } from "./vidrio/model";
import { useCartelShare } from "./vidrio/cartelShare";
import { cartelOf } from "../../lib/derived/vidrio/cartel";
import { seasonOf, slugW, type Letter, type PMatch } from "./pa/season";
import { balanceView, cartelView, FACETS, identityView, jornadasView, lensView, presetPicks, SCREEN_ICON, SCREEN_LABEL, SCREENS, tablaView, type Ctx, type Facet, type Filt, type Lente, type Picks, type Preset, type Screen } from "./pa/views";
import { Ic } from "./pa/Icon";
import { Jornadas } from "./pa/Jornadas";
import { Tabla } from "./pa/Tabla";
import { Balance } from "./pa/Balance";
import type { Demo } from "./pa/demo";
import "../../styles/vidrio/tokens.css";
import "../../styles/vidrio/glass.css";
import "../../styles/vidrio/components.css";
import "../../styles/vidrio/reading.css";
import "../../styles/partidos-vidrio.css";

const Rsvp = lazy(() => import("./pa/Member").then((m) => ({ default: m.Rsvp })));
const PorraLine = lazy(() => import("./pa/Member").then((m) => ({ default: m.PorraLine })));
const NotifySwitch = lazy(() => import("./pa/Member").then((m) => ({ default: m.NotifySwitch })));

const subscribeNothing = () => () => {};
const useHydrated = (): boolean => useSyncExternalStore(subscribeNothing, () => true, () => false);

/** The page's width (the boards' breakpoints); the server guesses a desktop's 1440. */
function useWidth(): number {
  return useSyncExternalStore(
    (on) => {
      window.addEventListener("resize", on);
      return () => window.removeEventListener("resize", on);
    },
    () => document.documentElement.clientWidth || window.innerWidth,
    () => 1440,
  );
}

/** «liga» → «liga de fútbol 7»: the club plays fútbol 7, and the boards say so when the league's name doesn't. */
const f7 = (phrase: string): string => (phrase && !/f[úu]tbol|f-?7|f-?11/i.test(phrase) ? `${phrase} de fútbol 7` : phrase);
const screenOf = (path: string): Screen => (/^\/partidos\/tabla\/?$/.test(path) ? "tabla" : /^\/partidos\/balance\/?$/.test(path) ? "balance" : "jornadas");
const pathOf = (s: Screen) => (s === "jornadas" ? "/partidos" : `/partidos/${s}`);
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : typeof v === "number" ? String(v) : null);
const num = (v: unknown): number | null => {
  const n = Number(str(v));
  return Number.isInteger(n) && n > 0 ? n : null;
};
/** «j2G,j3E» (or the jornada's match id) → picks by match id. */
function parsePicks(raw: string | null, ms: readonly PMatch[]): Picks {
  const o: Picks = {};
  for (const x of (raw ?? "").split(/[,.]/)) {
    const m = /^j?(\d+)([GEP])$/i.exec(x.trim());
    const hit = m ? ms.find((p) => p.j === Number(m[1])) : null;
    if (m && hit) o[hit.id] = m[2].toUpperCase() as Letter;
  }
  return o;
}
const picksParam = (p: Picks, ms: readonly PMatch[]) =>
  ms
    .filter((m) => p[m.id])
    .map((m) => `j${m.j}${p[m.id]}`)
    .join(",") || undefined;

interface UrlState {
  sel: number | null;
  lente: Lente | null;
  filt: Filt;
  all: boolean;
  ysi: string | null;
  bal: number | null;
  facet: Facet;
  facetAll: boolean;
}
function urlState(screen: Screen, s: Record<string, unknown>): UrlState {
  const ver = str(s.ver);
  const lente = str(s.lente);
  const facet = str(s.faceta);
  return {
    sel: screen === "jornadas" ? num(s.jornada) : null,
    lente: lente === "previa" || lente === "directo" || lente === "acta" ? lente : null,
    filt: screen === "jornadas" && (ver === "proximos" || ver === "resultados") ? ver : "todos",
    all: screen === "tabla" && ver === "entera",
    ysi: screen === "tabla" ? str(s["y-si"]) : null,
    bal: screen === "balance" ? num(s.jornada) : null,
    facet: (FACETS as readonly string[]).includes(facet ?? "") ? (facet as Facet) : "goles",
    facetAll: screen === "balance" && ver === "todo",
  };
}

/** The choreography: html[data-pa-dir] (fwd · back) or [data-pa-facet] + a View Transition whose update commits
 *  synchronously; without View Transitions (or under a shot) the change just happens. */
function transition(kind: "fwd" | "back" | "facet" | null, reduced: boolean, update: () => void | Promise<void>) {
  const d = document.documentElement;
  const clean = () => {
    d.removeAttribute("data-pa-dir");
    d.removeAttribute("data-pa-facet");
  };
  clean();
  if (kind === "facet") d.setAttribute("data-pa-facet", "");
  else if (kind) d.setAttribute("data-pa-dir", kind);
  if (reduced) d.setAttribute("data-pa-calm", "");
  else d.removeAttribute("data-pa-calm");
  const start = (document as Document & { startViewTransition?: (cb: () => Promise<void> | void) => { finished: Promise<void> } }).startViewTransition;
  const shot = !!(window as { __SHOT?: unknown }).__SHOT;
  if (typeof start === "function" && !shot) {
    try {
      const vt = start.call(document, async () => {
        await update();
      });
      vt.finished.then(clean, clean);
      return;
    } catch {
      /* plain */
    }
  }
  void Promise.resolve(update()).finally(clean);
}

export function PartidosPage() {
  const club = useClubData();
  const { loading, error } = club;
  const realSeasons = useSeason().seasons;
  const navigate = useNavigate();
  const router = useRouter();
  const location = useLocation();
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const clockNow = useClock(30_000);
  const viewer = useViewer();
  const hydrated = useHydrated();
  const member = hydrated && viewer.member;
  const theme = useDocumentTheme();
  const mvpResults = useMvpResults();
  const reduced = useReducedMotion();
  const w = useWidth();
  // (DEV: ?demo=larga reads the long demo season instead of the emulators's data)
  const raw = (location.search ?? {}) as Record<string, unknown>;
  const demoKey = import.meta.env.DEV ? str(raw.demo) : null;
  const momento = str(raw.momento);
  const [demo, setDemo] = useState<Demo | null>(null);
  useEffect(() => {
    if (demoKey) void import("./pa/demo").then((m) => setDemo(m.demoSeason(momento)));
  }, [demoKey, momento]);
  const matches = demo ? demo.matches : club.matches;
  const players = demo ? (demo.players as unknown as typeof club.players) : club.players;
  const seasons = useMemo(() => (demo ? [...realSeasons, demo.season] : realSeasons), [demo, realSeasons]);
  const now = demo ? demo.now : clockNow;

  // ── the screen and the season (both in the address)
  const urlScreen = screenOf(location.pathname);
  const [screen, setScreen] = useState<Screen>(urlScreen);
  const current = demo ? demo.season.id : currentSeasonId(nextFixture(matches, now), matches, seasons);
  const askedT = str(search.temporada);
  const asked = askedT ? (seasons.find((s) => s.id === askedT || slugW(s.name) === askedT)?.id ?? null) : null;
  const seasonId = asked ?? current;
  const season = seasons.find((s) => s.id === seasonId);
  // (a memo of its own: the memos below key on it)
  const seasonName = useMemo(() => seasons.find((s) => s.id === seasonId)?.name ?? "La temporada", [seasons, seasonId]);
  const temporada = seasonId && seasonId !== current && season ? slugW(season.name) : undefined;
  const realStandings = useStandings(seasonId || undefined).standings;
  const standings = demo ? demo.standings : realStandings;

  // ── names and numbers as the season prints them
  // (this and the season's model below are rebuilt when the data, the clock's 30 s or the viewer's choices change,
  // not on every hover or keystroke that touches only one screen's view)
  const squad = useMemo(
    () =>
      new Map(
        players
          .filter((p) => p.seasons?.includes(seasonId))
          .map((raw) => {
            const p = playerForSeason(raw, seasonId, seasons);
            return [p.id, { name: niceName(nameFor(p, seasonId)), num: p.number != null ? String(p.number) : "", printed: nameFor(p, seasonId) }] as const;
          }),
      ),
    [players, seasonId, seasons],
  );
  const nm = useCallback((id: string) => squad.get(id)?.name ?? niceName(nameFor(players.find((p) => p.id === id), seasonId || undefined)), [squad, players, seasonId]);
  const numOf = useCallback((id: string) => squad.get(id)?.num ?? "", [squad]);
  const stillOf = usePageKitStills({ on: hydrated, theme, kits: ["home", "away"], players: [...squad.values()].map((s) => ({ name: s.printed, num: s.num })) });

  // ── the season at now
  const strip = useMemo(() => seasonStrip(matches, seasonId, now), [matches, seasonId, now]);
  const liveSeg = strip.segments.find((s) => s.state === "directo") ?? null;
  const liveMinute = liveSeg ? shownMinute(liveSeg.match, now) : null;
  const url = urlState(screen, search);
  // ── what the viewer chose (from the address, then local)
  const [sel, setSel] = useState<number | null>(url.sel);
  const [lente, setLente] = useState<Lente | null>(url.lente);
  const [filt, setFilt] = useState<Filt>(url.filt);
  const [win, setWin] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [seasonOpen, setSeasonOpen] = useState(false);
  const [picksRaw, setPicks] = useState<Picks | null>(null);
  const [preset, setPreset] = useState<Preset>(null);
  const [asi, setAsi] = useState(true);
  const [all, setAll] = useState(url.all);
  const [bal, setBal] = useState<number | null>(url.bal);
  const [hover, setHover] = useState<number | null>(null);
  const [facet, setFacet] = useState<Facet>(url.facet);
  const [facetAll, setFacetAll] = useState(url.facetAll);
  const [cartel, setCartel] = useState(screen === "jornadas" && str(search.hoja) === "cartel");
  const [pip, setPip] = useState<ScorePip | null>(null);
  const [say, setSay] = useState<{ t: string; on: boolean }>({ t: "", on: false });
  const [balH, setBalH] = useState(680);
  // (the forecast by hour of the jornada on the lens, when it is within a week)
  // (the one shown: the chosen jornada, else the next one, while it is still to play)
  const fcSeg = (sel !== null ? strip.segments.find((s) => s.jornada === sel) : undefined) ?? strip.segments.find((s) => s.state === "hoy" || s.state === "proximo");
  const fcFor = fcSeg && (fcSeg.state === "hoy" || fcSeg.state === "proximo") ? fcSeg.id : null;
  const fcMatch = fcFor ? fcSeg?.match : undefined;
  const hourly = useMatchWeatherHourly(fcMatch, now);
  const se = useMemo(
    () =>
      seasonOf({
        segments: strip.segments,
        now,
        liveMinute,
        mvpOf: (m) => {
          const r = mvpResults.get(m.id);
          const open = mvpVoteOpen(m, now);
          return { open, votes: open ? (r?.total ?? null) : null, of: open && typeof r?.eligible === "number" && r.eligible > 0 ? r.eligible : null, closes: typeof m.voteClosesAt === "number" ? m.voteClosesAt : null, winners: open ? [] : mvpWinners(m, r, now) };
        },
        fcOf: (m) => (m.id === fcFor && hourly ? hourly.hours.map((h) => ({ h: clockTime(h.at), t: h.temp, ko: h.kickoff })) : null),
      }),
    [strip, now, liveMinute, mvpResults, fcFor, hourly],
  );
  const ms = se.matches;
  const picks = useMemo(() => picksRaw ?? parsePicks(url.ysi, ms), [picksRaw, url.ysi, ms]);

  const sayT = useRef(0);
  const toast = (t: string) => {
    window.clearTimeout(sayT.current);
    setSay({ t, on: true });
    sayT.current = window.setTimeout(() => setSay((s) => ({ ...s, on: false })), 2600);
  };

  const captain = member && !!viewer.playerId && (viewer.playerId === season?.captainPlayerId || viewer.admin);
  const myId = member ? viewer.playerId : null;
  const ctx: Ctx = useMemo(
    () => ({
      w,
      q,
      nm,
      num: numOf,
      known: (id) => squad.has(id),
      myId,
      member,
      captain,
      seasonName,
      league: f7(leaguePhrase(standings?.competition || matches.find((m) => m.seasonId === seasonId && m.competition)?.competition)),
      standings: standings ? { rows: standings.rows, prev: ("rowsPrev" in standings ? standings.rowsPrev : null) ?? null, jornada: standings.jornada, updatedAt: standings.updatedAt, by: standings.updatedBy } : null,
      matchPath: (m) => `/partidos/${m.id}`,
    }),
    [w, q, nm, numOf, squad, myId, member, captain, seasonName, standings, matches, seasonId],
  );
  const id = useMemo(() => identityView(se, ctx), [se, ctx]);

  // ── the address follows the screen's state (replace), a screen change pushes
  const searchFor = (s: Screen): Record<string, string | undefined> => {
    const base: Record<string, string | undefined> = { temporada };
    if (s === "jornadas") return { ...base, jornada: sel !== null ? String(sel) : undefined, lente: lente ?? undefined, ver: filt !== "todos" ? filt : undefined, hoja: cartel ? "cartel" : undefined };
    if (s === "tabla") return { ...base, ver: all ? "entera" : undefined, "y-si": picksParam(picks, ms) };
    return { ...base, jornada: bal !== null ? String(bal) : undefined, faceta: facet !== "goles" ? facet : undefined, ver: facetAll ? "todo" : undefined };
  };
  const clean = (o: Record<string, string | undefined>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
  const wanted = JSON.stringify(clean(searchFor(screen)));
  const lastPushed = useRef("");
  useEffect(() => {
    if (urlScreen !== screen || demoKey) return;
    const have = JSON.stringify(clean(Object.fromEntries(Object.entries(search).map(([k, v]) => [k, str(v) ?? undefined]))));
    if (have === wanted || lastPushed.current === wanted) return;
    lastPushed.current = wanted;
    void navigate({ to: pathOf(screen), search: JSON.parse(wanted) as Record<string, string>, replace: true, resetScroll: false } as never);
  });

  // «atrás» / «adelante»: the address moved the screen; run the choreography backwards (or forwards)
  useEffect(() => {
    if (urlScreen === screen) return;
    const dir = SCREENS.indexOf(urlScreen) > SCREENS.indexOf(screen) ? "fwd" : "back";
    const u = urlState(urlScreen, search);
    transition(dir, reduced, () => {
      flushSync(() => {
        setScreen(urlScreen);
        setQ("");
        setSeasonOpen(false);
        setHover(null);
        if (urlScreen === "jornadas") {
          setSel(u.sel);
          setLente(u.lente);
          setFilt(u.filt);
        }
        if (urlScreen === "balance") {
          setBal(u.bal);
          setFacet(u.facet);
          setFacetAll(u.facetAll);
        }
        if (urlScreen === "tabla") setAll(u.all);
      });
    });
    // (only the address's screen drives this)
  }, [urlScreen]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (to: Screen, also?: () => void) => {
    if (to === screen) return;
    const dir = SCREENS.indexOf(to) > SCREENS.indexOf(screen) ? "fwd" : "back";
    transition(dir, reduced, async () => {
      flushSync(() => {
        also?.();
        setScreen(to);
        setQ("");
        setSeasonOpen(false);
        setHover(null);
      });
      await navigate({ to: pathOf(to), search: clean({ ...searchForAfter(to) }) as Record<string, string>, resetScroll: false } as never);
    });
  };
  // (the search the next screen opens with: Jornadas keeps the chosen jornada, the others start clean)
  const searchForAfter = (to: Screen) => {
    const s = searchFor(to);
    lastPushed.current = JSON.stringify(clean(s));
    return s;
  };

  // ── Jornadas
  const pickJ = (j: number, toJor = false) => {
    if (toJor && screen !== "jornadas") {
      go("jornadas", () => {
        setSel(j);
        setLente(null);
        setWin(null);
      });
      return;
    }
    transition(null, reduced, () =>
      flushSync(() => {
        setSel(j);
        setLente(null);
        setWin(null);
        setQ("");
      }),
    );
  };
  const jor = useMemo(() => (screen === "jornadas" ? jornadasView(se, { sel, lente, filt, win }, ctx) : null), [screen, se, sel, lente, filt, win, ctx]);
  const lv = useMemo(() => (jor ? lensView(se, jor.sel, lente, ctx) : null), [jor, se, lente, ctx]);
  const ribRef = useRef<HTMLDivElement | null>(null);
  const mmRef = useRef<HTMLDivElement | null>(null);
  const lensRef = useRef<HTMLElement | null>(null);
  useRefraction(lensRef, { bezel: 24, strength: 1.25, blur: 12 }, !!jor);
  // a phone scrolls the whole ribbon: the chosen jornada comes to its left edge
  const ribKey = `${jor?.sel.j}|${screen}|${seasonId}`;
  useLayoutEffect(() => {
    const el = ribRef.current;
    if (!el || el.scrollWidth <= el.clientWidth + 1) return;
    const s = el.querySelector<HTMLElement>(".pa-slot.is-sel");
    if (s) el.scrollLeft = Math.max(0, s.offsetLeft - 16);
  }, [ribKey]);

  // ── Balance fits the viewport on a desktop: its height is what is left under the identity
  const balRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    if (screen !== "balance" || w < 1100) return;
    const fit = () => {
      const el = balRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      setBalH(Math.max(540, Math.floor(window.innerHeight - top - 30)));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [screen, w, facetAll]);

  // ── Escape closes what is open
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (cartel) setCartel(false);
      if (seasonOpen) setSeasonOpen(false);
      if (q) setQ("");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cartel, seasonOpen, q]);

  // ── the swipe between screens on a phone
  const tx = useRef<{ x: number; y: number } | null>(null);
  const touchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    let el = e.target as HTMLElement | null;
    while (el && el !== e.currentTarget) {
      if (el.dataset?.noswipe) {
        tx.current = null;
        return;
      }
      el = el.parentElement;
    }
    tx.current = t ? { x: t.clientX, y: t.clientY } : null;
  };
  const touchEnd = (e: TouchEvent) => {
    const s = tx.current;
    const t = e.changedTouches[0];
    tx.current = null;
    if (!s || !t) return;
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    const to = SCREENS.indexOf(screen) + (dx < 0 ? 1 : -1);
    if (to >= 0 && to < 3) go(SCREENS[to]);
  };

  const goHref = (path: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    void router.navigate({ to: path } as never);
  };

  const setSeason = (sid: string) => {
    setSeasonOpen(false);
    const s = seasons.find((x) => x.id === sid);
    transition(null, reduced, () =>
      flushSync(() => {
        setSel(null);
        setLente(null);
        setWin(null);
        setPicks({});
        setPreset(null);
        setBal(null);
        setAll(false);
        setQ("");
        void navigate({ to: pathOf(screen), search: sid === current || !s ? {} : { temporada: slugW(s.name) }, replace: false, resetScroll: false } as never);
      }),
    );
  };

  const tabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = SCREENS.indexOf(screen);
    const to = e.key === "ArrowRight" ? (i + 1) % 3 : e.key === "ArrowLeft" ? (i + 2) % 3 : e.key === "Home" ? 0 : e.key === "End" ? 2 : null;
    if (to === null) return;
    e.preventDefault();
    go(SCREENS[to]);
    window.setTimeout(() => document.getElementById(`pa-tab-${SCREENS[to]}`)?.focus(), 60);
  };

  const onPip = () => {
    if (pip) {
      pip.close();
      setPip(null);
      return;
    }
    void openScorePip({ width: 340, height: 160, title: "Manchester Piti, en directo" }).then((p) => {
      setPip(p);
      if (!p) toast("El marcador flota sobre la web hasta el pitido final.");
    });
  };

  // the light of the page: the focused jornada's (golden by day, the floodlights by night)
  const fl = se.focus?.paint.light;
  const golden = fl === "dorada" || fl === "tarde" || fl === "dia";
  const busy = loading && !matches.length;
  const ourMember = member;

  const lens = lv?.lens;
  const cartelData = useMemo(() => (jor ? cartelView(jor.sel, seasonName) : null), [jor, seasonName]);
  const shareCartel = useCartelShare(jor ? cartelOf(jor.sel.match, { jornada: jor.sel.j, seasonName, nameOf: nm, now, mvp: jor.sel.raw.mvp?.winners[0] ? nm(jor.sel.raw.mvp.winners[0]) : null }) : null, jor ? { a: jor.sel.paint.a, b: jor.sel.paint.b, m0: jor.sel.paint.m0, m1: jor.sel.paint.m1, sun: jor.sel.paint.sun, floods: jor.sel.paint.floods } : null);

  const tb = useMemo(() => (screen === "tabla" ? tablaView(se, { picks, preset, asi, all }, ctx) : null), [screen, se, picks, preset, asi, all, ctx]);
  const bv = screen === "balance" ? balanceView(se, { bal, hover, facet, all: facetAll }, ctx, id.usRow) : null;
  const t0 = SCREENS.indexOf(screen);

  return (
    <KitStillContext.Provider value={stillOf}>
      <div className={`vx vd-pg pa pa--${screen}${se.live ? " is-live" : ""}`} style={{ "--vd-sky-h": "1100px" } as CSSProperties} aria-busy={loading}>
        <VidrioSky light={golden ? "dorada" : "noche"} floodlit={!golden} height={1100} />
        <CelesteHeader active="partidos" actions={<ThemeToggle />} live={se.live ? true : undefined} />
        <main className="pa-main" id="pa-main">
          <h1 className="vd-vh">Partidos</h1>
          <header className="pa-id">
            <div className="pa-pop pa-id__season">
              <button type="button" className="vd-glass vd-press pa-season" aria-haspopup="menu" aria-expanded={seasonOpen} onClick={() => setSeasonOpen((o) => !o)}>
                <span className="pa-season__t">
                  <b>{seasonName}</b>
                  <small>{ctx.league || (seasonId === current ? "La de ahora" : "Archivada")}</small>
                </span>
                <Ic name="chev-r" className="pa-chev" />
              </button>
              {seasonOpen && (
                <ul className="vd-glass vd-glass--deep pa-menu" role="menu" aria-label="Temporadas">
                  {[...seasons].reverse().map((s) => {
                    const own = matches.filter((m) => m.seasonId === s.id && m.status !== "cancelled");
                    const comp = f7(leaguePhrase(own.find((m) => m.competition)?.competition));
                    return (
                      <li key={s.id} role="none">
                        <button type="button" role="menuitemradio" aria-checked={s.id === seasonId} className="pa-menu__i" onClick={() => setSeason(s.id)}>
                          <b>{s.name}</b>
                          <span>{s.id === current ? `${comp ? `${comp[0].toUpperCase()}${comp.slice(1)} · ` : ""}la de ahora` : `${own.length} ${own.length === 1 ? "partido" : "partidos"}${comp ? ` · ${comp}` : ""}`}</span>
                          {s.id === seasonId && <Ic name="check" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <nav className="pa-tabs" aria-label="Pantallas de Partidos">
              <LensMark />
              <div className="vd-glass pa-tabs__in" role="tablist" aria-label="Pantallas de Partidos" style={{ "--i": t0 } as CSSProperties}>
                {SCREENS.map((s) => (
                  <button key={s} type="button" role="tab" id={`pa-tab-${s}`} aria-controls="pa-screen" aria-selected={screen === s} tabIndex={screen === s ? 0 : -1} className="pa-tab" onClick={() => go(s)} onKeyDown={tabKey}>
                    {screen === s && <span className="pa-tab__bead" aria-hidden="true" />}
                    <Ic name={SCREEN_ICON[s]} className="pa-tab__i" />
                    <span className="pa-tab__t">
                      <b>{SCREEN_LABEL[s]}</b>
                      <small>{id.heads[s]}</small>
                    </span>
                  </button>
                ))}
              </div>
            </nav>
            <div className="pa-id__end">
              <p className="pa-count">{id.countLine}</p>
              <div className="pa-pop pa-pop--find">
                <label className="vd-glass pa-find">
                  <Ic name="search" />
                  <span className="vd-vh">Buscar rival en la temporada</span>
                  <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar rival" autoComplete="off" />
                </label>
                {id.find.open && (
                  <ul className="vd-glass vd-glass--deep pa-menu pa-menu--r" aria-label="Rivales que coinciden">
                    {id.find.items.map((f) => (
                      <li key={f.j}>
                        <button type="button" className="pa-menu__i" onClick={() => (screen === "tabla" ? setQ(f.t.split(" · ")[1] ?? q) : screen === "balance" ? (setQ(""), setBal(f.j)) : pickJ(f.j, true))}>
                          <b>{f.t}</b>
                          <span>{f.sub}</span>
                        </button>
                      </li>
                    ))}
                    {id.find.none && <li className="pa-menu__none">Ningún rival se llama así esta temporada.</li>}
                  </ul>
                )}
              </div>
            </div>
          </header>

          <section className="pa-screen" id="pa-screen" role="tabpanel" aria-labelledby={`pa-tab-${screen}`} onTouchStart={touchStart} onTouchEnd={touchEnd}>
            {error ? (
              <div className="pa-empty" role="alert">
                <Ic name="wifiOff" />
                <span>No nos llegan los partidos. Suele ser la conexión o el servidor del club: dale otra vez en un momento.</span>
              </div>
            ) : busy ? (
              <div className="pa-empty" aria-busy="true">
                <Ic name="fixtures" />
                <span>Cargando los partidos…</span>
              </div>
            ) : !ms.length ? (
              <div className="pa-empty">
                <Ic name="cal" />
                <span>El calendario aún no está. En cuanto la liga lo publique aparecerán aquí las jornadas, cada una con su hora, su campo y la luz del pitido.</span>
              </div>
            ) : (
              <>
                {jor && lv && lens && (
                  <Jornadas
                    jor={jor}
                    lv={lv}
                    sel={jor.sel}
                    filt={filt}
                    ribBox={ribRef}
                    mmBox={mmRef}
                    lensBox={lensRef}
                    onPick={(j) => pickJ(j)}
                    onHoy={() => se.focus && pickJ(se.focus.j)}
                    onPrev={() => !jor.noPrev && setWin(Math.max(0, jor.start - jor.winSize))}
                    onNext={() => !jor.noNext && setWin(jor.start + jor.winSize)}
                    onMm={(e) => {
                      const r = mmRef.current?.getBoundingClientRect();
                      if (!r?.width) return;
                      const f = (e.clientX - r.left) / r.width;
                      let best = 0;
                      let bd = 9;
                      ms.forEach((_m, i) => {
                        const d = Math.abs(jor.markCenter(i) - f);
                        if (d < bd) {
                          bd = d;
                          best = i;
                        }
                      });
                      pickJ(ms[best].j);
                    }}
                    onMmKey={(e) => {
                      if (e.key === "ArrowRight" || e.key === "PageDown") {
                        e.preventDefault();
                        if (!jor.noNext) setWin(jor.start + jor.winSize);
                      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
                        e.preventDefault();
                        if (!jor.noPrev) setWin(Math.max(0, jor.start - jor.winSize));
                      }
                    }}
                    onSegKey={(e) => {
                      const f = jor.filtered;
                      const i = f.indexOf(jor.sel);
                      const to = e.key === "ArrowRight" ? Math.min(f.length - 1, i + 1) : e.key === "ArrowLeft" ? Math.max(0, i - 1) : e.key === "Home" ? 0 : e.key === "End" ? f.length - 1 : null;
                      if (to === null) return;
                      e.preventDefault();
                      pickJ(f[to].j);
                      window.setTimeout(() => document.querySelector<HTMLButtonElement>(".pa-slot.is-sel .pa-seg")?.focus(), 80);
                    }}
                    onFilt={(f) => {
                      setFilt(f);
                      setWin(null);
                    }}
                    onLente={(l, off) => {
                      if (off) {
                        toast(`El directo se abre con el pitido, a las ${clockTime(jor.sel.at)}.`);
                        return;
                      }
                      transition(null, reduced, () => flushSync(() => setLente(l)));
                    }}
                    onCartel={() => setCartel(true)}
                    onPip={onPip}
                    goHref={goHref}
                    rsvp={
                      ourMember && viewer.playerId ? (
                        <Suspense fallback={null}>
                          <Rsvp match={jor.sel.match} wd={lv.pre.wd} say={toast} />
                        </Suspense>
                      ) : (
                        <p className="pa-sub">{lv.pre.convNote}</p>
                      )
                    }
                    notify={
                      hydrated ? (
                        <Suspense fallback={null}>
                          <NotifySwitch topics={["lineup", "start"]} label="Avísame del siete y del pitido" on="Te avisamos del siete y del pitido." off="Avisos del siete y del pitido quitados." say={toast} />
                        </Suspense>
                      ) : null
                    }
                    ppNotify={
                      hydrated ? (
                        <Suspense fallback={null}>
                          <NotifySwitch topics={["dates"]} label="Avísame cuando haya fecha" on="Te avisamos en cuanto tenga fecha." off="Aviso quitado." say={toast} className="" />
                        </Suspense>
                      ) : null
                    }
                    onCal={() => {
                      void import("./pa/ics").then(({ downloadIcs }) => {
                        downloadIcs(jor.sel, seasonName);
                        toast(`Añadido: J${jor.sel.j}, ${lv.pre.day.toLowerCase()} a las ${lv.pre.time}.`);
                      });
                    }}
                    mapsHref={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lens.venue}, Madrid`)}`}
                    porra={
                      ourMember && jor.sel.state === "directo" && jor.sel.score ? (
                        <Suspense fallback={null}>
                          <PorraLine match={jor.sel.match} gf={jor.sel.score.gf} ga={jor.sel.score.ga} />
                        </Suspense>
                      ) : null
                    }
                  />
                )}
                {tb && (
                  <Tabla
                    tb={tb}
                    ms={ms}
                    asi={asi}
                    all={all}
                    preset={preset}
                    captain={captain}
                    publishHref="/admin/clasificacion"
                    onPublish={goHref("/admin/clasificacion")}
                    onAsi={() => transition(null, reduced, () => flushSync(() => setAsi((a) => !a)))}
                    onAll={() => transition(null, reduced, () => flushSync(() => setAll((a) => !a)))}
                    onPickSim={(mid, l) =>
                      transition(null, reduced, () =>
                        flushSync(() => {
                          const o = { ...picks };
                          if (o[mid] === l) delete o[mid];
                          else o[mid] = l;
                          setPicks(o);
                          setPreset(null);
                        }),
                      )
                    }
                    onPreset={(pid) =>
                      transition(null, reduced, () =>
                        flushSync(() => {
                          setPicks(presetPicks(se, pid));
                          setPreset(pid);
                        }),
                      )
                    }
                    notify={
                      hydrated ? (
                        <Suspense fallback={null}>
                          <NotifySwitch topics={["tabla"]} label="Avísame cuando se publique" on="Te avisamos cuando salga la clasificación." off="Aviso quitado." say={toast} />
                        </Suspense>
                      ) : null
                    }
                  />
                )}
                {bv && (
                  <Balance
                    bv={bv}
                    h={balH}
                    grown={facetAll}
                    balBox={balRef}
                    kit="home"
                    onClear={() => transition(null, reduced, () => flushSync(() => (setBal(null), setHover(null))))}
                    onToJor={(j) => pickJ(j, true)}
                    onCol={(j) =>
                      transition(null, reduced, () =>
                        flushSync(() => {
                          setBal(bal === j && hover === null ? null : j);
                          setHover(null);
                          setFacetAll(false);
                        }),
                      )
                    }
                    onHover={(j) => w >= 1100 && hover !== j && setHover(j)}
                    onLeave={() => hover !== null && setHover(null)}
                    onColKey={(e, j) => {
                      const i = ms.findIndex((m) => m.j === (hover ?? bal ?? j));
                      if (e.key === "Escape") {
                        setBal(null);
                        setHover(null);
                        return;
                      }
                      const to = e.key === "ArrowRight" ? Math.min(ms.length - 1, i + 1) : e.key === "ArrowLeft" ? Math.max(0, i - 1) : null;
                      if (to === null) return;
                      e.preventDefault();
                      setBal(ms[to].j);
                      setHover(null);
                      window.setTimeout(() => document.querySelectorAll<HTMLButtonElement>(".pa-colb")[to]?.focus(), 40);
                    }}
                    onFacet={(f) => {
                      if (f === facet) return;
                      transition("facet", reduced, () =>
                        flushSync(() => {
                          setFacet(f);
                          setFacetAll(false);
                        }),
                      );
                    }}
                    onFacetKey={(e) => {
                      const i = FACETS.indexOf(facet);
                      const to = e.key === "ArrowRight" ? (i + 1) % FACETS.length : e.key === "ArrowLeft" ? (i + FACETS.length - 1) % FACETS.length : null;
                      if (to === null) return;
                      e.preventDefault();
                      transition("facet", reduced, () =>
                        flushSync(() => {
                          setFacet(FACETS[to]);
                          setFacetAll(false);
                        }),
                      );
                      window.setTimeout(() => document.getElementById(`pa-ft-${FACETS[to]}`)?.focus(), 80);
                    }}
                    onGrow={() => transition(null, reduced, () => flushSync(() => setFacetAll((a) => !a)))}
                    goHref={goHref}
                  />
                )}
              </>
            )}
          </section>
        </main>
        {screen !== "balance" && <CelesteFooter />}
        <CelesteDock active="partidos" live={se.live ? true : undefined} />

        <p className={`pa-say${say.on ? " is-on" : ""}`} role="status" aria-live="polite">
          {say.t}
        </p>

        {cartel && cartelData && jor && (
          <>
            <div className="pa-scrim" onClick={() => setCartel(false)} aria-hidden="true" />
            <CartelDialog cartel={cartelData} j={jor.sel.j} onClose={() => setCartel(false)} onSave={() => void shareCartel.run(false).then((ok) => toast(ok ? "Imagen guardada." : "No se ha podido hacer la imagen. Prueba otra vez."))} onCopy={() => {
              const href = `${window.location.origin}/partidos/${jor.sel.id}?hoja=cartel`;
              void navigator.clipboard?.writeText(href).then(() => toast("Enlace copiado."), () => toast(href));
            }} />
          </>
        )}

        {se.live && liveSeg && (
          <PipWindow pip={pip} title={`Manchester Piti contra ${liveSeg.rival}`} onClose={() => (pip?.close(), setPip(null))} bottom={pipBottom("/partidos")}>
            <span className="vd-score">
              {liveSeg.score?.gf ?? 0}–{liveSeg.score?.ga ?? 0}
            </span>
            <p>
              <b>{liveSeg.rival}</b>
              {liveMinute !== null && <span className="vd-clock">{liveMinute}′</span>}
            </p>
          </PipWindow>
        )}
      </div>
    </KitStillContext.Provider>
  );
}

/** The three screens' headlines tell tonight's jornada (live, or its MVP vote): while they are on screen the
 *  floating score stays docked (liveDock «lens»). */
function LensMark() {
  const ref = useRef<HTMLSpanElement | null>(null);
  useLiveDock(ref, "lens");
  return <span ref={ref} className="pa-lensmark" aria-hidden="true" />;
}

function CartelDialog({ cartel, j, onClose, onSave, onCopy }: { cartel: NonNullable<ReturnType<typeof cartelView>>; j: number; onClose: () => void; onSave: () => void; onCopy: () => void }) {
  const close = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const back = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    close.current?.focus();
    return () => {
      if (back?.isConnected) back.focus();
    };
  }, []);
  return (
    <section className="vd-glass vd-glass--deep vd-sheet pa-sheet" role="dialog" aria-modal="true" aria-labelledby="pa-cartel-h">
      <header className="pa-sheet__head">
        <h2 id="pa-cartel-h">El cartel de la J{j}</h2>
        <button ref={close} type="button" className="vd-glass vd-press vd-ibtn" onClick={onClose} aria-label="Cerrar">
          <Ic name="close" />
        </button>
      </header>
      <figure className="pa-poster" style={{ "--a": cartel.ga } as CSSProperties}>
        <span className="pa-poster__sky" aria-hidden="true" />
        <img className="pa-poster__crest" src="/crest-128.webp" alt="" width={56} height={56} />
        <figcaption>
          <small>{cartel.k}</small>
          <b>{cartel.t}</b>
          <span className="pa-poster__big">{cartel.big}</span>
          <em>{cartel.s}</em>
        </figcaption>
      </figure>
      <div className="pa-btns">
        <button type="button" className="vd-glass vd-btn vd-btn--pri vd-press" onClick={onSave}>
          Guardar la imagen
        </button>
        <button type="button" className="vd-glass vd-btn vd-press" onClick={onCopy}>
          Copiar el enlace
        </button>
      </div>
    </section>
  );
}

export default PartidosPage;
