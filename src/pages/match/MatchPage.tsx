// «El partido» (P- boards, ronda 3): the match page as a broadcast. On top, always, the header — the lens with
// the score, the scorers and «La moviola» (before the whistle «La tarde») — and under it the section tabs,
// sticky, which carry a slim score strip once the header has scrolled away. Each tab is a screen with its own
// address (/partidos/<id>, /siete, /numeros, /vestuario) that replaces the one before through a View
// Transition (exit → the tab indicator slides → enter); back and forward walk them, and on a phone a sideways
// swipe moves to the next one. The moviola's minute (?min=) drives the score, the sky and the open screen; the
// sheets (el cartel, compartir el momento, los avisos) open on top (?hoja=) and «atrás» closes them.
// The logic is pure in partido/model.ts, moviola.ts and words.ts; each screen lives in partido/Screen*.tsx.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type PointerEvent as RPointerEvent } from "react";
import { Link, useLocation, useRouter } from "@tanstack/react-router";
import { useAuth } from "../../context/AuthContext";
import { useSeason } from "../../context/SeasonContext";
import { useViewer } from "../../hooks/useViewer";
import { useNoIndex } from "../../hooks/useNoIndex";
import { useMatchClock } from "../../hooks/useMatchClock";
import { useSyncChip } from "../../hooks/useSyncChip";
import { useTheme } from "../../hooks/useTheme";
import { dateMillis, nameFor, playerForSeason, useClubData, type ClubMatch } from "../../lib/clubData";
import { niceName } from "../../lib/derived/words";
import { jornadaOf } from "../../lib/derived/jornada";
import { madridTime } from "../../lib/derived/madrid";
import { scoreboardOf } from "../../lib/derived/scoreboard";
import { shownMinute } from "../../lib/partidos";
import { isVisibleMatch } from "../../../functions/src/matchEngine";
import { useStandings } from "../../lib/useStandings";
import { projectTable } from "../../lib/derived/vidrio/table";
import { CelesteDock, CelesteFooter, CelesteHeader } from "../../components/celeste/Chrome";
import { ClubDataError, StateStage } from "../../components/celeste/StatePanel";
import { ThemeToggle } from "../../components/ThemeToggle";
import { PipWindow, openScorePip, swap, useDesktop, useGoalMoment, useReducedMotion, VidrioSky, type ScorePip } from "../../components/vidrio";
import { useGoalCelebration } from "../../components/celeste/useGoalCelebration";
import { pipBottom } from "../../components/vidrio/live/liveModel";
import { KitStillContext } from "../../components/jersey3d/kitStill";
import { usePageKitStills } from "../../components/jersey3d/usePageKitStills";
import { useLiveDoc, useMatchScorers, useMeetingNote, useMvpResults } from "../vestuario/live";
import { meetTimeOf } from "./partido/partidoModel";
import { useMatchBoard } from "../pizarra/useMatchBoard";
import { toBePlayed } from "../../lib/derived/kickoff";
import { lineupOf, edgeOf, faseOf, floodAtMs, isDone, isLive, isPlayed, isPre, numHitsOf, parseMin, playsOf, pulseOf, resultWords, scoreAt, SCREENS, timelineOf, type Play, type Screen } from "./partido/model";
import type { PageCtx, Person, Sheet, Viewer } from "./partido/ctx";
import { Head } from "./partido/Head";
import { Tira } from "./partido/Tira";
import { Go, Icon, RivalCrest } from "./partido/bits";
import { scoreLabelOf, statusOf, tabHints, titleOf } from "./partido/words";
import { Sheets } from "./partido/Sheets";
import { useAvisos } from "./partido/avisos";
import { ScreenPartido } from "./partido/ScreenPartido";
import { ScreenSiete } from "./partido/ScreenSiete";
import { ScreenNumeros } from "./partido/ScreenNumeros";
import { ScreenVestuario } from "./partido/ScreenVestuario";
import { useVestuario } from "./partido/vestuarioState";
import { rememberScreen } from "./partido/paths";
import { isFase, isQuien, maquetaOf, type Quien } from "./partido/maqueta";
import "../../styles/vidrio/tokens.css";
import "../../styles/vidrio/glass.css";
import "../../styles/vidrio/components.css";
import "../../styles/vidrio/reading.css";
import "../../styles/match-vidrio.css";

const LABELS: Record<Screen, string> = {
  partido: "El partido",
  siete: "El siete",
  numeros: "Números",
  vestuario: "Vestuario",
};
const PATH: Record<Screen, string> = {
  partido: "",
  siete: "/siete",
  numeros: "/numeros",
  vestuario: "/vestuario",
};
const OLD_TAB: Record<string, Screen> = {
  cronica: "partido",
  pulso: "partido",
  campo: "siete",
  estadisticas: "numeros",
  vestuario: "vestuario",
};
const SHEETS: readonly Sheet[] = ["cartel", "momento", "avisos"];

/** The match id and the screen from the address (/partidos/<id>[/siete…]; the old /matches/<id>?tab= too). */
function placeOf(pathname: string, search: Record<string, unknown>): { id: string; screen: Screen } {
  const m = /^\/(?:partidos|matches)\/([^/]+)(?:\/([a-z]+))?\/?$/.exec(pathname);
  const id = m ? decodeURIComponent(m[1]) : "";
  const seg = m?.[2];
  const screen = (SCREENS as readonly string[]).includes(seg ?? "") ? (seg as Screen) : typeof search.tab === "string" && OLD_TAB[search.tab] ? OLD_TAB[search.tab] : "partido";
  return { id, screen };
}

const subscribeNothing = () => () => {};
const useHydrated = (): boolean =>
  useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );

type Players = ReturnType<typeof useClubData>["players"];
type Seasons = ReturnType<typeof useSeason>["seasons"];

// The page's model that doesn't read the clock is rebuilt when the data changes, not on every tick of the match
// clock (a second while it runs). Each part is a hook of its own: inside the page the compiler can't keep a memo
// whose inputs later calls might change, inside a hook its arguments are fixed.

/** The people of the match's season (and its guests), and the names and numbers read from them. */
function useSeasonPeople(players: Players, seasonId: string, seasons: Seasons, guests: ClubMatch["guests"]) {
  const people = useMemo(() => {
    const out = new Map<string, Person>();
    for (const raw of players) {
      const p = seasonId ? playerForSeason(raw, seasonId, seasons) : raw;
      const short = nameFor(p, seasonId || undefined);
      out.set(p.id, {
        id: p.id,
        name: niceName(short),
        short: short.toLocaleUpperCase("es"),
        num: p.number != null ? String(p.number) : "",
        first: p.firstName ?? "",
        last: p.lastName ?? "",
        pos: p.naturalPosition ?? "MED",
      });
    }
    for (const g of guests ?? [])
      out.set(`guest:${g.id}`, {
        id: `guest:${g.id}`,
        name: `${g.name} (invitado)`,
        short: g.name.toLocaleUpperCase("es"),
        num: "",
        first: g.name,
        last: "",
        pos: "MED",
      });
    return out;
  }, [players, seasonId, seasons, guests]);
  const nameOf = useCallback((id: string) => people.get(id)?.name ?? "Jugador", [people]);
  const numOf = useCallback((id: string) => people.get(id)?.num ?? "", [people]);
  const printed = useMemo(() => [...people.values()].filter((p) => p.num && !p.id.startsWith("guest:")).map((p) => ({ name: p.short, num: p.num })), [people]);
  return { people, nameOf, numOf, printed };
}

/** The plays, the line-up, the pulse, the numbers and the result; the timeline reads the edge (a minute's move). */
function useMatchModel(match: ClubMatch | undefined, nameOf: (id: string) => string, rival: string, duration: number, edge: number) {
  const plays = useMemo((): Play[] => (match ? playsOf(match, nameOf, rival) : []), [match, nameOf, rival]);
  const lineup = useMemo(() => (match ? lineupOf(match) : null), [match]);
  const tl = useMemo(() => (match && lineup ? timelineOf(match, lineup, plays, duration, edge, nameOf) : null), [match, lineup, plays, duration, edge, nameOf]);
  const pulse = useMemo(() => (match ? pulseOf(match, duration) : []), [match, duration]);
  const nums = useMemo(() => (match ? numHitsOf(match) : { kinds: [], hits: [], narrated: false }), [match]);
  const result = useMemo(() => resultWords(scoreAt(plays, duration), scoreAt(plays, duration / 2)), [plays, duration]);
  return { plays, lineup, tl, pulse, nums, result };
}

/** The season around the match: its matches by date (the cancelled ones out) and the match's jornada. */
function useSeasonAround(matches: readonly ClubMatch[], match: ClubMatch | undefined) {
  const seasonId = match?.seasonId;
  const seasonMatches = useMemo(() => matches.filter((x) => isVisibleMatch(x) && x.seasonId === seasonId && x.status !== "cancelled").sort((a, b) => dateMillis(a.date) - dateMillis(b.date)), [matches, seasonId]);
  const jornada = useMemo(() => (match ? jornadaOf(matches, match.id) : null), [matches, match]);
  return { seasonMatches, jornada };
}

export function MatchPage() {
  const router = useRouter();
  const location = useLocation();
  const search = location.search as Record<string, unknown>;
  const { id: matchId, screen: urlScreen } = placeOf(location.pathname, search);
  const base = `/partidos/${encodeURIComponent(matchId)}`;
  const { matches, players, loading, error } = useClubData();
  const { seasons } = useSeason();
  const clockNow = useMatchClock(matches);
  const { user, profile } = useAuth();
  const v0 = useViewer();
  const { theme } = useTheme();
  const hydrated = useHydrated();
  const desktop = useDesktop();
  const reduced = useReducedMotion();
  const mvpResults = useMvpResults();
  const scorerUids = useMatchScorers(v0.member ? matchId : undefined);
  const found = matches.find((x) => x.id === matchId && isVisibleMatch(x));
  // (DEV: the boards' «Maqueta» — ?maqueta=<momento>&quien=<viewer>&red=off&estado=noexiste)
  const dev = import.meta.env.DEV;
  const maq = dev && found && isFase(search.maqueta) ? maquetaOf(found, search.maqueta) : null;
  const quien = dev && isQuien(search.quien) ? search.quien : null;
  const match = dev && search.estado === "noexiste" ? undefined : (maq?.match ?? found);
  const now = maq?.now ?? clockNow;
  useNoIndex(!loading && !error && !match);

  // ---- the people of the match's season
  const seasonId = match?.seasonId ?? "";
  const { people, nameOf, numOf, printed } = useSeasonPeople(players, seasonId, seasons, match?.guests);
  const kit = match?.kit === "away" ? "away" : "home";
  const stillOf = usePageKitStills({
    on: hydrated,
    theme,
    kits: kit === "away" ? ["away", "home"] : ["home", "away"],
    players: printed,
  });

  // ---- the moment
  const mvp = match ? mvpResults.get(match.id) : undefined;
  const voteOpen = maq ? maq.voteOpen : !!match && (mvp?.open ?? (typeof match.voteClosesAt === "number" && match.voteClosesAt > now));
  const fase = match ? faseOf(match, now, voteOpen) : "antes";
  const duration = Math.max(10, match?.duration ?? 50);
  const live = isLive(fase);
  const played = isPlayed(fase);
  const done = isDone(fase);
  const pre = isPre(fase);
  const off = fase === "aplazado" || fase === "pendiente" ? fase : null;
  const liveMin = match && live ? shownMinute(match, now) : null;
  const edge = edgeOf(fase, liveMin, duration);

  // ---- the moviola's minute: held back (?min=), else the edge
  const urlMin = parseMin(search.min);
  const [held, setHeld] = useState<number | null>(urlMin);
  const minute = played ? Math.max(0, Math.min(edge, held ?? edge)) : 0;
  const dragged = played && minute < edge;
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number>(0);

  // ---- the sheet (?hoja=) and the say line
  const sheet = (SHEETS as readonly string[]).includes(String(search.hoja)) ? (search.hoja as Sheet) : null;
  const pushedSheet = useRef(false);
  const [say, setSay] = useState({ text: "", on: false });
  const sayT = useRef<number>(0);
  const sayLine = (text: string) => {
    window.clearTimeout(sayT.current);
    setSay({ text, on: true });
    sayT.current = window.setTimeout(() => setSay((s) => ({ ...s, on: false })), 2600);
  };

  // ---- addresses: the screen, the minute and the sheet live in the URL
  const hrefFor = (screen: Screen | "mesa", opts: { min?: number | null; hoja?: Sheet | null } = {}) => {
    const q = new URLSearchParams();
    const mm = opts.min === undefined ? (dragged ? minute : null) : opts.min;
    if (mm != null && screen !== "mesa") q.set("min", String(mm));
    if (opts.hoja) q.set("hoja", opts.hoja);
    // (the screen's own state stays while it is the one shown: El siete's open ficha and its view)
    if (screen === urlScreen) for (const k of ["ficha", "vista"]) if (typeof search[k] === "string") q.set(k, search[k] as string);
    // (the season stays: without it SeasonUrlSync writes it back with a navigation of its own)
    if (typeof search.season === "string") q.set("season", search.season);
    if (dev) for (const k of ["maqueta", "quien", "red"]) if (typeof search[k] === "string") q.set(k, search[k] as string);
    const s = q.toString();
    return `${base}${screen === "mesa" ? "/mesa" : PATH[screen]}${s ? `?${s}` : ""}`;
  };
  // the moviola writes ?min= in place (no history), a moment after it settles
  const wantMin = dragged ? minute : null;
  const minHref = !match || playing || wantMin === urlMin ? null : hrefFor(urlScreen, { min: wantMin, hoja: sheet });
  useEffect(() => {
    if (!minHref) return;
    const t = window.setTimeout(() => void router.navigate({ href: minHref, replace: true, resetScroll: false }), 250);
    return () => window.clearTimeout(t);
  }, [minHref, router]);
  // a ?min= from outside (a shared moment, back/forward) moves the moviola
  const [seenUrlMin, setSeenUrlMin] = useState(urlMin);
  if (urlMin !== seenUrlMin) {
    setSeenUrlMin(urlMin);
    if (urlMin !== (dragged ? minute : null)) setHeld(urlMin);
  }

  // ---- the screen shown: follows the address through a View Transition
  const [shown, setShown] = useState<Screen>(urlScreen);
  useLayoutEffect(() => {
    if (urlScreen === shown) return;
    const dir = SCREENS.indexOf(urlScreen) > SCREENS.indexOf(shown) ? "right" : "left";
    swap(dir, () => setShown(urlScreen));
  }, [urlScreen, shown]);
  const sent = useRef<HTMLSpanElement | null>(null);
  const pinTabs = () => {
    const el = sent.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    if (window.scrollY > top) window.scrollTo(0, top);
  };
  useEffect(() => {
    pinTabs();
  }, [shown]);
  const go = (s: Screen | "mesa") => {
    if (s === "mesa") {
      rememberScreen(matchId, urlScreen);
      void router.navigate({ href: hrefFor("mesa", { min: null }) });
      return;
    }
    if (s === urlScreen) return;
    void router.navigate({ href: hrefFor(s), resetScroll: false });
  };

  // ---- the compact strip: once the lens has scrolled away
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    let raf = 0;
    const on = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const el = sent.current;
        if (el) setCompact(el.getBoundingClientRect().top < 6);
      });
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => {
      window.removeEventListener("scroll", on);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [match?.id]);

  // ---- model
  const rival = match?.rival ?? "el rival";
  const { plays, lineup, tl, pulse, nums, result } = useMatchModel(match, nameOf, rival, duration, edge);
  const resultNow = live || fase === "final" ? resultWords(scoreAt(plays, edge), scoreAt(plays, Math.min(edge, duration / 2))) : result;
  const score = scoreAt(plays, minute);
  const kickMs = match ? dateMillis(match.date) : NaN;

  // ---- the moviola's verbs
  const [fx, setFx] = useState<"gold" | "cold" | null>(null);
  const fxT = useRef<number>(0);
  const flashFor = (p: Play) => {
    window.clearTimeout(fxT.current);
    const gold = p.k === "gol";
    setFx(gold ? "gold" : "cold");
    sayLine(gold ? `¡${p.title}!` : p.title);
    fxT.current = window.setTimeout(() => setFx(null), reduced ? 600 : gold ? 2600 : 1600);
  };
  const goalAt = (m: number) => [...plays].reverse().find((p) => p.m === m && (p.k === "gol" || p.k === "rival")) ?? null;
  const stop = () => {
    window.clearInterval(timer.current);
    timer.current = 0;
    setPlaying(false);
  };
  const seek = (m: number) => {
    const t = Math.max(0, Math.min(edge, Math.round(m)));
    setHeld(t >= edge ? null : t);
  };
  const jump = (dir: 1 | -1) => {
    stop();
    const list = [0, ...plays.filter((p) => p.m <= edge).map((p) => p.m), edge];
    const t = dir > 0 ? list.find((x) => x > minute) : [...list].reverse().find((x) => x < minute);
    if (t == null) return;
    seek(t);
    const g = goalAt(t);
    if (g) flashFor(g);
  };
  const play = () => {
    if (playing) return stop();
    if (reduced) return jump(1);
    let m = minute >= edge ? 0 : minute;
    setHeld(m);
    setPlaying(true);
    window.clearInterval(timer.current);
    timer.current = window.setInterval(() => {
      m += 1;
      if (m > edge) {
        stop();
        return;
      }
      setHeld(m >= edge ? null : m);
      const g = goalAt(m);
      if (g) flashFor(g);
    }, 340);
  };
  useEffect(() => () => window.clearInterval(timer.current), []);
  const onSeek = (m: number, drag: boolean) => {
    stop();
    seek(m);
    const g = goalAt(Math.round(m));
    if (g && (!drag || !fx)) flashFor(g);
  };

  // ---- a goal while it is played: the moment on the lens and the sky
  const goalShow = useGoalCelebration(live ? match : undefined, now);
  const moment = useGoalMoment(goalShow.goal ? { key: goalShow.goal.id, side: goalShow.goal.ours ? "us" : "them" } : null);

  // ---- sheets
  const open = (s: Sheet) => {
    stop();
    pushedSheet.current = true;
    void router.navigate({
      href: hrefFor(urlScreen, { hoja: s }),
      resetScroll: false,
    });
  };
  const closeSheet = () => {
    if (pushedSheet.current) {
      pushedSheet.current = false;
      router.history.back();
      return;
    }
    void router.navigate({
      href: hrefFor(urlScreen, { hoja: null }),
      replace: true,
      resetScroll: false,
    });
  };

  // ---- the viewer
  const playerInSquad = !!v0.playerId && !!match?.seasonId && !!players.find((p) => p.id === v0.playerId && p.seasons?.includes(match.seasonId ?? "") && !p.archived);
  const anotador = v0.member && !!user && scorerUids.data.includes(user.uid);
  const real: Viewer = {
    member: v0.member,
    admin: v0.admin,
    mesa: v0.member && (anotador || v0.admin),
    anotador,
    playerId: playerInSquad ? v0.playerId : null,
    uid: user?.uid ?? null,
    name: v0.playerId ? nameOf(v0.playerId) : (profile?.nickname ?? ""),
  };
  const viewer: Viewer = quien ? maquetaViewer(quien, real, people) : real;

  // ---- the season around it
  const { seasonMatches, jornada } = useSeasonAround(matches, match);
  const idx = match ? seasonMatches.findIndex((x) => x.id === match.id) : -1;
  const prevMatch = idx > 0 ? seasonMatches[idx - 1] : null;
  const nextMatches = idx >= 0 ? seasonMatches.slice(idx + 1).filter((x) => !isPlayedMatch(x)) : [];
  const nextMatch = idx >= 0 ? (seasonMatches[idx + 1] ?? null) : null;
  const { standings } = useStandings(match?.seasonId);
  const hasTable = !!standings && standings.rows.length > 0 && standings.rows.some((r) => r.pj > 0);
  const proj = hasTable && standings ? projectTable(standings.rows, live || fase === "final" ? { rival, gf: score.us, ga: score.them } : null) : null;
  const posText = proj?.position ? `${proj.position}º` : null;

  // ---- the captain: the official board's roles (team-only reads; a fan sees no armband)
  const boardId = useMatchBoard(match?.seasonId, match?.id, !!match && toBePlayed(match, now), v0.member);
  const captainId = useLiveDoc<string | null>(boardId ? `lineups/${boardId}` : null, "captain", (d) => (typeof d?.roles?.captainId === "string" ? (d.roles.captainId as string) : null), null).data;

  // ---- the quedada: the time the meeting note gives, else half an hour before (team-only read)
  const meetingNote = useMeetingNote(v0.member ? matchId : undefined);

  // ---- the vestuario's state (the tab's badge and line)
  const ves = useVestuario(match ?? null, {
    fase,
    viewer,
    minute,
    edge,
    score,
    plays,
    people,
  });

  // ---- the avisos of this match
  const avisos = useAvisos(match?.id ?? null, fase, viewer.member, rival, sayLine);

  const [pip, setPip] = useState<ScorePip | null>(null);
  const closePip = () => {
    setPip((p) => {
      p?.close();
      return null;
    });
  };
  // (the match stops being played: the window closes, and the page forgets it)
  useEffect(() => {
    if (!live) pip?.close();
  }, [live, pip]);
  if (!live && pip) setPip(null);

  // ---- swipe between screens (phone and tablet)
  const sw = useRef<{ x: number; y: number; t: number } | null>(null);
  const onDown = (e: RPointerEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    if (!t.closest(".pp-screen") || t.closest("[data-scroll-x],input,select,textarea,.vd-pitch")) {
      sw.current = null;
      return;
    }
    sw.current = { x: e.clientX, y: e.clientY, t: Date.now() };
  };
  const onUp = (e: RPointerEvent<HTMLDivElement>) => {
    const s = sw.current;
    sw.current = null;
    if (!s || e.pointerType === "mouse") return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 2 || Date.now() - s.t > 700) return;
    const i = SCREENS.indexOf(shown);
    const n = dx < 0 ? i + 1 : i - 1;
    if (n >= 0 && n < SCREENS.length) go(SCREENS[n]);
  };

  const dia = theme === "light";
  const flood = played ? floodAtMs(kickMs + minute * 60_000) : fase === "pendiente" ? 1 : floodAtMs(now);
  const skyGold = fx === "gold" || moment.sky.gold;
  const skyCold = fx === "cold" || moment.sky.cold;
  const chip = useSyncChip(live || fase === "pitido", now);
  const syncChip = dev && search.red === "off" && (live || fase === "pitido") ? { text: "Sin conexión · marcador de hace 3 min" } : chip;

  const chrome = (inner: React.ReactNode, cls = "") => (
    <KitStillContext.Provider value={stillOf}>
      <div className={`vx vd-pg pp ${cls}`.trim()} style={{ "--vd-sky-h": "1000px" } as CSSProperties} onPointerDown={onDown} onPointerUp={onUp}>
        <VidrioSky light="dorada" gold={skyGold} cold={skyCold} />
        <div className="pp-sky-b" style={{ opacity: dia ? 0 : flood }} aria-hidden="true">
          <VidrioSky light="noche" floodlit gold={skyGold} cold={skyCold} />
        </div>
        <CelesteHeader active="partidos" sub="Partido" actions={<ThemeToggle />} live={live} />
        {inner}
        <CelesteFooter />
        <CelesteDock active="partidos" live={live} />
      </div>
    </KitStillContext.Provider>
  );

  if (error && !match)
    return chrome(
      <StateStage>
        <ClubDataError heading="h1" />
      </StateStage>,
    );
  if (loading)
    return chrome(
      <main className="pp-stage" aria-busy="true">
        <p className="vd-vh" role="status">
          Cargando el partido…
        </p>
      </main>,
    );
  if (!match || !lineup || !tl)
    return chrome(
      <main className="pp-mesa pp-404" aria-labelledby="pp-404-h">
        <p className="pp-404__ghost" aria-hidden="true">
          404
        </p>
        <h1 className="pp-mesa__h" id="pp-404-h">
          Partido no encontrado
        </h1>
        <p className="pp-mesa__p">Este partido no está en el calendario: o se borró, o el enlace tiene el marcador mal apuntado.</p>
        <div className="pp-404__btns">
          <Link className="vd-glass vd-press vd-btn vd-btn--pri" to="/partidos">
            Ver los partidos
          </Link>
          <Link className="vd-glass vd-press vd-btn" to="/">
            Ir al inicio
          </Link>
        </div>
      </main>,
    );

  const cancelled = match.status === "cancelled";
  const postponedTo = (match as ClubMatch & { postponedTo?: unknown }).postponedTo ? dateMillis((match as ClubMatch & { postponedTo?: unknown }).postponedTo) : null;
  const kickTime = Number.isFinite(kickMs) ? madridTime(kickMs) : "—";
  const word = fase === "aplazado" ? (cancelled ? "Suspendido" : "Aplazado") : "Sin acta";
  const j = jornada ? `J${jornada} · ` : "";
  const title = titleOf(fase, j, rival, match.home !== false, resultNow, cancelled);
  const status = statusOf({
    fase,
    m: minute,
    edge,
    dragged,
    result: resultNow,
    kick: kickMs,
    now,
    postponedTo: postponedTo && Number.isFinite(postponedTo) ? postponedTo : null,
    cancelled,
  });
  const scoreLabel = scoreLabelOf(rival, score, {
    played,
    pre,
    dragged,
    live,
    m: minute,
    kickTime,
    word,
  });
  // (the match's armband from the official board, else the season's captain)
  const captain = captainId ?? seasons.find((x) => x.id === match.seasonId)?.captainPlayerId ?? null;
  const venue = match.venue ?? "";
  const c: PageCtx = {
    match,
    base,
    kickMs,
    venueShort: /^CDM\b/i.test(venue) ? "el CDM" : venue ? "el campo" : "el campo",
    matches,
    now,
    fase,
    minute,
    edge,
    duration,
    pre,
    live,
    played,
    done,
    off,
    dragged,
    plays,
    score,
    result: resultNow,
    lineup,
    tl,
    pulse,
    nums,
    floodAt: (m: number) => floodAtMs(kickMs + m * 60_000),
    rival,
    rivalCode: scoreboardOf(match).initials,
    jornada,
    kit,
    captain,
    people,
    nameOf,
    numOf,
    viewer,
    mvp,
    next: nextMatches,
    dia,
    screen: shown,
    go,
    open,
    seek: (m: number) => {
      stop();
      seek(m);
    },
    say: sayLine,
  };

  // the header's actions
  const finalish = done || fase === "final" || fase === "pendiente";
  const admin =
    viewer.admin && !live
      ? {
          href: finalish ? `/admin/partidos/${encodeURIComponent(match.id)}/acta` : `/admin/partidos/${encodeURIComponent(match.id)}`,
          label: finalish ? "Editar el acta" : "Abrir en la Sala de control",
        }
      : null;
  const mesa =
    viewer.mesa && !done && fase !== "aplazado"
      ? {
          label: fase === "pendiente" ? "Publicar el acta en la mesa" : live ? "Volver a la mesa" : "Abrir la mesa",
        }
      : null;
  const nChanges = plays.filter((p) => p.k === "cambio" && p.m <= minute).length;
  const hints = tabHints(fase, resultNow, kickTime, lineup.system, nChanges, hasTable, posText);
  const vesHint = ves.hint;
  const tabs = SCREENS.map((id) => {
    const h = id === "vestuario" ? vesHint : hints[id];
    return {
      id,
      label: LABELS[id],
      hint: h[0],
      short: h[1],
      on: shown === id,
      badge: id === "vestuario" ? ves.badge : 0,
      badgeText: id === "vestuario" ? ves.badgeText : "",
    };
  });
  const si = SCREENS.indexOf(shown);
  const prevS = si > 0 ? SCREENS[si - 1] : null;
  const nextS = si < SCREENS.length - 1 ? SCREENS[si + 1] : null;
  const jumpOf = (x: ClubMatch | null, prev: boolean) => {
    if (!x) return null;
    const jj = jornadaOf(matches, x.id);
    const xr = x.rival ?? "el rival";
    const when = Number.isFinite(dateMillis(x.date)) ? madridTime(dateMillis(x.date)) : "";
    return {
      href: `/partidos/${encodeURIComponent(x.id)}`,
      label: `${jj ? `J${jj} · ` : ""}${shortRival(xr)}`,
      aria: `${prev ? "Anterior" : "Siguiente"}: ${jj ? `J${jj}, ` : ""}${x.home === false ? `en casa de ${xr}` : `en casa contra ${xr}`}${when ? `, a las ${when}` : ""}`,
    };
  };
  const mini = {
    score: played ? `${score.us}–${score.them}` : pre ? kickTime : fase === "aplazado" ? word : "Sin acta",
    when: live
      ? dragged
        ? `Viendo el ${minute}′`
        : fase === "descanso"
          ? "Descanso"
          : `${edge}′`
      : fase === "final"
        ? "Final, falta el acta"
        : done
          ? dragged
            ? `Viendo el ${minute}′`
            : "Final"
          : pre
            ? fase === "pitido"
              ? "A punto"
              : "Hoy"
            : "",
    live: live && fase !== "descanso" && !dragged,
    prog: played ? ((minute / duration) * 100).toFixed(2) : "0",
  };
  const stillT = fase === "aplazado" ? (cancelled ? "Suspendido: no se jugará" : postponedTo ? "Aplazado, ya con fecha nueva" : "Aplazado, sin fecha nueva todavía") : "Nadie arrancó el reloj en la mesa";
  const reason = (match as ClubMatch & { postponedReason?: string }).postponedReason;
  const stillD =
    fase === "aplazado"
      ? `${reason ? `${reason.replace(/\.?$/, ".")} ` : ""}${postponedTo ? "La porra y la convocatoria se abren otra vez para la nueva fecha." : "La liga pondrá la fecha; te avisamos en cuanto la haya."}`
      : "No hubo marcador en directo: el resultado llegará con el acta.";

  const ppCls = [`f-${fase}`, `s-${shown}`, dia ? "is-dia" : "", compact ? "is-compact" : "", played ? "has-tira" : "", sheet ? "has-sheet" : ""].filter(Boolean).join(" ");
  return chrome(
    <>
      <main className="pp-stage" id="pp-main">
        <Head
          c={c}
          title={title.l}
          titleS={title.s}
          status={status}
          scoreLabel={scoreLabel}
          word={word}
          kickTime={kickTime}
          sync={(live || fase === "pitido") && syncChip ? syncChip.text : null}
          prev={jumpOf(prevMatch, true)}
          next={jumpOf(nextMatch, false)}
          admin={admin}
          mesa={mesa}
          avisos={avisos.show ? { label: avisos.label, aria: avisos.aria } : null}
          pip={
            live && desktop
              ? {
                  open: !!pip,
                  toggle: () =>
                    pip
                      ? closePip()
                      : void openScorePip({
                          width: 420,
                          height: 236,
                          title: "Manchester Piti, marcador",
                        }).then(setPip),
                }
              : null
          }
          playing={playing}
          fx={fx}
          goalClasses={[fx === "gold" ? "is-goal vd-rim-gold" : "", moment.lens, moment.glint].filter(Boolean).join(" ")}
          stillT={stillT}
          stillD={stillD}
          meet={Number.isFinite(kickMs) ? meetTimeOf(meetingNote.data, kickMs) : null}
          onPlay={play}
          onJump={jump}
          onSeek={onSeek}
          onCartel={() => open("cartel")}
        />
        <span className="pp-sent" ref={sent} aria-hidden="true" />
        <nav className="pp-tabs" aria-label="Secciones del partido">
          <div className="vd-glass pp-tabs__in">
            <a
              className="pp-mini"
              href="#pp-main"
              onClick={(e) => {
                e.preventDefault();
                window.scrollTo({
                  top: 0,
                  behavior: reduced ? "auto" : "smooth",
                });
              }}
              aria-label={`Volver arriba: ${scoreLabel}`}
              tabIndex={compact ? 0 : -1}
            >
              <img src="/crest-128.webp" alt="" width={24} height={24} />
              <b className="pp-mini__s">{mini.score}</b>
              <RivalCrest logo={null} code={c.rivalCode} className="pp-mini__r" />
              <span className="pp-mini__w">
                {mini.live && <span className="vd-livedot" aria-hidden="true" />}
                <span className="vd-clock">{mini.when}</span>
              </span>
            </a>
            <div className="pp-tabs__list">
              {tabs.map((t) => (
                <Go
                  key={t.id}
                  className="pp-tab"
                  id={`pp-tab-${t.id}`}
                  href={hrefFor(t.id)}
                  aria-current={t.on ? "page" : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    go(t.id);
                  }}
                >
                  <b>{t.label}</b>
                  <small>
                    <span className="pp-tab__l">{t.hint}</span>
                    <span className="pp-tab__s">{t.short}</span>
                  </small>
                  {t.badge > 0 && (
                    <>
                      <span className="vd-badge pp-tab__badge" aria-hidden="true">
                        {t.badge}
                      </span>
                      <span className="vd-vh">, {t.badgeText}</span>
                    </>
                  )}
                  {t.on && <span className="pp-tab__ind" aria-hidden="true" />}
                </Go>
              ))}
            </div>
            {played && <Tira c={c} on={compact} playing={playing} onPlay={play} onJump={jump} onSeek={onSeek} />}
            {played && <span className="pp-tabs__prog" style={{ width: `${mini.prog}%` }} aria-hidden="true" />}
          </div>
        </nav>

        <div className="pp-screen" id="pp-screen">
          {shown === "partido" && <ScreenPartido c={c} avisos={avisos} />}
          {shown === "siete" && <ScreenSiete c={c} />}
          {shown === "numeros" && <ScreenNumeros c={c} />}
          {shown === "vestuario" && <ScreenVestuario c={c} v={ves} />}
          <nav className="pp-nextscr" aria-label="Pasar de sección">
            {prevS && (
              <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm pp-nextscr__b pp-nextscr__b--prev" onClick={() => go(prevS)}>
                <Icon name="chev-l" />
                {LABELS[prevS]}
              </button>
            )}
            {nextS && (
              <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm pp-nextscr__b pp-nextscr__b--next" onClick={() => go(nextS)}>
                {LABELS[nextS]}
                <Icon name="chev-r" />
              </button>
            )}
          </nav>
        </div>
      </main>

      <p className="vd-vh" role="status" aria-live="polite">
        {say.text}
      </p>
      <div className={`pp-toast${say.on ? " is-on" : ""}`} aria-hidden="true">
        <Icon name="check" />
        <span>{say.text}</span>
      </div>

      {pip && live && (
        <PipWindow pip={pip} title={`Manchester Piti contra ${rival}`} onClose={closePip} bottom={pipBottom("/partidos/")}>
          <span className="vd-score">
            {score.us}–{score.them}
          </span>
          <p>
            <b>{rival}</b> <span className="vd-clock">{fase === "descanso" ? "Descanso" : `${edge}′`}</span>
          </p>
        </PipWindow>
      )}

      <Sheets c={c} sheet={sheet} onClose={closeSheet} avisos={avisos} kickTime={kickTime} />
    </>,
    ppCls,
  );
}

/** DEV: the board's «Quién mira» on the real page (presentation only: the reads stay the signed-in member's). */
function maquetaViewer(q: Quien, real: Viewer, people: Map<string, Person>): Viewer {
  const by = (short: string) => [...people.values()].find((p) => p.short === short)?.id ?? null;
  const none: Viewer = {
    member: false,
    admin: false,
    mesa: false,
    anotador: false,
    playerId: null,
    uid: real.uid,
    name: "",
  };
  if (q === "fan") return none;
  if (q === "socio") return { ...none, member: true, name: "Marta" };
  if (q === "jugador")
    return {
      ...none,
      member: true,
      playerId: by("JORDI") ?? real.playerId,
      name: "Jordi",
    };
  if (q === "anotador")
    return {
      ...none,
      member: true,
      mesa: true,
      anotador: true,
      playerId: by("ILLESCAS"),
      name: "Illescas",
    };
  return { ...none, member: true, admin: true, mesa: true, name: "Adrián" };
}

/** «Orduña fc» → «Orduña» for the small jump button. */
function shortRival(r: string): string {
  return r.replace(/\s+(f\.?c\.?|c\.?f\.?|cf|fc)$/i, "").trim() || r;
}

function isPlayedMatch(m: ClubMatch): boolean {
  return m.status === "finished";
}

export default MatchPage;
