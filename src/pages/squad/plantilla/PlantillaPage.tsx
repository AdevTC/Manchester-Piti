// «Plantilla» (the PL- boards, ronda 3): un vestuario. La percha — the squad's printed shirts hanging from one rail —
// is the page's navigation; under it one screen at a time, each with its address: el vestuario (/plantilla), el
// cara a cara (/plantilla/cara-a-cara), el álbum (/plantilla/album) or a player (/jugadores/<id> and his five other
// sections). Every move is a View Transition (exit → morph → enter): the tapped shirt flies off its hanger into the
// player's hero while la percha folds into a slim strip, and flies back to its hanger on the way home.
import { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent, type PointerEvent as RPointerEvent } from "react";
import { flushSync } from "react-dom";
import { Link, useLocation, useNavigate, useSearch } from "@tanstack/react-router";
import { VidrioSky, useReducedMotion } from "../../../components/vidrio";
import { CelesteDock, CelesteFooter, CelesteHeader } from "../../../components/celeste/Chrome";
import { ThemeToggle } from "../../../components/ThemeToggle";
import { usePageKitStills } from "../../../components/jersey3d/usePageKitStills";
import { useShirtStills } from "../../../components/jersey3d/useShirtStills";
import { KitStillContext } from "../../../components/jersey3d/kitStill";
import { useSeason } from "../../../context/SeasonContext";
import { useClubData, nextFixture } from "../../../lib/clubData";
import { currentSeasonId, type MvpResult } from "../../../lib/vestuario";
import { matchdayOf, type MatchdayModel } from "../../../lib/derived/matchday";
import { squadLive } from "../../../lib/derived/vidrio/squadLive";
import { mvpVoteOpen } from "../../../lib/derived/memberWindows";
import { useClock } from "../../../hooks/useClock";
import { useViewer } from "../../../hooks/useViewer";
import { useNoIndex } from "../../../hooks/useNoIndex";
import { useDocumentTheme } from "../../../hooks/useDocumentTheme";
import { shareClubPage } from "../../../lib/share";
import { siteOrigin } from "../../../lib/derived/venue";
import { useAvailability, useMatchScorers, useMvpResults } from "../../vestuario/live";
import { applyMaqueta, readMaqueta } from "../../home/portada/maqueta";
import { lastMatch, nextMatch, periodCtx, toPlayer, winnersOf, type Ctx, type PPlayer } from "./model";
import { addrOf, hrefOf, type Addr } from "./address";
import { SECS, SEC_LABEL, albumView, duelView, homeView, ledeView, matchLines, playerView, railView, type AnCat, type DayInput, type Quien, type Screen, type Sec, type Squad, type ViewState, type Who } from "./views";
import { Hook, Ic, Shirt } from "./bits";
import "../../../styles/vidrio/tokens.css";
import "../../../styles/vidrio/glass.css";
import "../../../styles/vidrio/components.css";
import "../../../styles/vidrio/reading.css";
import "../../../styles/vidrio/transitions.css";
import "../../../styles/vidrio-paginas.css";
import "../../../styles/squad.css";

type Dir = "right" | "left" | "up";
const subscribeNothing = () => () => {};
const useHydrated = (): boolean => useSyncExternalStore(subscribeNothing, () => true, () => false);
const isShot = () => typeof window !== "undefined" && !!(window as { __SHOT?: unknown }).__SHOT;

/** What crosses from one route's page to the other's (/plantilla ↔ /jugadores remount the page): the shirt that
 *  flies home, the kit on, the corner being picked. */
const carry: { flyHome: string | null; kit: "home" | "away" | null } = { flyHome: null, kit: null };

/** The boards' choreography: html[data-vd-dir] + a View Transition around the update (plain without support or with
 *  reduced motion: data-vd-calm keeps only a fade). */
function transition(dir: Dir, reduced: boolean, update: () => Promise<void> | void, done?: () => void) {
  const d = document.documentElement;
  d.setAttribute("data-vd-dir", dir);
  if (reduced) d.setAttribute("data-vd-calm", "");
  else d.removeAttribute("data-vd-calm");
  const clean = () => {
    d.removeAttribute("data-vd-dir");
    d.removeAttribute("data-vd-calm");
    done?.();
  };
  const start = (document as Document & { startViewTransition?: (cb: () => Promise<void> | void) => { finished: Promise<void> } }).startViewTransition;
  if (typeof start === "function" && !isShot()) {
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
  // (after the current render: an address change arrives inside an effect)
  void Promise.resolve()
    .then(update)
    .finally(clean);
}
/** Waits (a few frames at most) until `selector` is on the page: the other route's page has rendered. */
function rendered(selector: string, ms = 1200): Promise<void> {
  const t0 = performance.now();
  return new Promise((ok) => {
    const tick = () => (document.querySelector(selector) || performance.now() - t0 > ms ? ok() : requestAnimationFrame(tick));
    tick();
  });
}

interface Ui {
  pick: "a" | "b";
  bdayOpen: boolean;
  numOpen: boolean;
  anCat: AnCat;
  anNotes: boolean;
  adnSel: number | null;
  radarVs: "media" | "socio";
  turned: boolean;
  flip: boolean;
  run: number;
  flyHome: string | null;
  said: string;
  q: string;
}

export function PlantillaPage() {
  const pathname = useLocation({ select: (l) => l.pathname });
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const hydrated = useHydrated();
  const theme = useDocumentTheme();
  const dia = theme === "light";

  // ── the club's data and the season
  const { players, matches, loading, error } = useClubData();
  const { seasons, selectedSeasonId } = useSeason();
  const results = useMvpResults();
  const viewer = useViewer();
  const clockNow = useClock(15_000);
  const seasonId = selectedSeasonId !== "all" && seasons.some((s) => s.id === selectedSeasonId) ? selectedSeasonId : currentSeasonId(nextFixture(matches, clockNow), matches, seasons);
  const seasonName = seasons.find((s) => s.id === seasonId)?.name ?? "Temporada";

  // (DEV: ?maqueta= turns the last match into any moment, ?quien=fan|socio|jugador|capitan&yo=<id> looks as someone else)
  const [mq] = useState(() => (import.meta.env.DEV ? readMaqueta() : null));
  const [devWho] = useState(() => {
    if (!import.meta.env.DEV || typeof location === "undefined") return null;
    const q = new URLSearchParams(location.search);
    const w = q.get("quien");
    return w === "fan" || w === "socio" || w === "jugador" || w === "capitan" ? { quien: w as Quien, yo: q.get("yo") } : null;
  });
  const { day, now } = useMemo(() => applyMaqueta(mq, matchdayOf(matches, seasonId, clockNow), clockNow), [mq, matches, seasonId, clockNow]);

  // ── the squad of the season and its periods
  const visibleSeasons = useMemo(() => seasons.map((s) => ({ id: s.id, name: s.name })), [seasons]);
  const squadDocs = useMemo(() => players.filter((p) => p.seasons?.includes(seasonId)), [players, seasonId]);
  const roster = useMemo(() => squadDocs.map((p) => toPlayer(p, seasonId, visibleSeasons)).sort((a, b) => (a.n ?? 999) - (b.n ?? 999) || a.name.localeCompare(b.name, "es")), [squadDocs, seasonId, visibleSeasons]);
  const settledAt = Math.floor(now / 60_000);
  const cur = useMemo(() => periodCtx(players, matches, seasonId, visibleSeasons, results, settledAt * 60_000), [players, matches, seasonId, visibleSeasons, results, settledAt]);
  const all = useMemo(() => periodCtx(players, matches, "all", visibleSeasons, results, settledAt * 60_000), [players, matches, visibleSeasons, results, settledAt]);
  // (another season's period, built when Temporada a temporada asks for it)
  const ctxCache = useMemo(() => ({ of: [players, matches, results], map: new Map<string, Ctx>() }), [players, matches, results]).map;
  const S: Squad = useMemo(() => {
    const by = new Map<string, PPlayer>(roster.map((p) => [p.id, p]));
    return {
      ids: roster.map((p) => p.id),
      by,
      seasonId,
      seasonName,
      now,
      captain: seasons.find((s) => s.id === seasonId)?.captainPlayerId ?? null,
      matches,
      seasons: visibleSeasons,
      cur,
      all,
      jornadaOf: (id: string) => cur.jornada.get(id),
      seasonCtx: (id: string) => {
        let c = ctxCache.get(id);
        if (!c) {
          c = periodCtx(players, matches, id, visibleSeasons, results, now);
          ctxCache.set(id, c);
        }
        return c;
      },
    };
  }, [roster, seasonId, seasonName, now, seasons, matches, visibleSeasons, cur, all, players, results, ctxCache]);

  // ── who looks
  const who: Who = useMemo(() => {
    if (devWho) {
      const yo = devWho.yo ?? viewer.playerId ?? roster.find((p) => p.id !== S.captain)?.id ?? null;
      return { quien: devWho.quien, member: devWho.quien !== "fan", admin: devWho.quien === "capitan", me: devWho.quien === "jugador" || devWho.quien === "capitan" ? yo : null };
    }
    const quien: Quien = !viewer.member ? "fan" : viewer.admin ? "capitan" : viewer.playerId ? "jugador" : "socio";
    return { quien, member: viewer.member, admin: viewer.admin, me: viewer.playerId };
  }, [devWho, viewer, roster, S.captain]);

  // ── match day: the convocatoria, the live minute and the acta (squadLive); the answers for members
  const stage = stageOf(day, now);
  const voteClosed = !!day.match && typeof day.match.voteClosesAt === "number" && day.match.voteClosesAt <= now;
  const mvpIds = useMemo(() => (stage === "after" && day.match && voteClosed ? winnersOf(day.match, results, now) : []), [stage, day.match, voteClosed, results, now]);
  const live = useMemo(() => squadLive({ day, squad: S.ids, matches, mvp: mvpIds }), [day, S.ids, matches, mvpIds]);
  const memberDay = who.member && !!day.match && !!stage && !devWho;
  const answers = useAvailability(memberDay && stage === "pre" ? day.match!.id : undefined);
  const scorers = useMatchScorers(memberDay ? day.match!.id : undefined);
  const D: DayInput = useMemo(() => {
    const rsvp = memberDay && stage === "pre" ? new Map(answers.data.filter((a) => a.playerId).map((a) => [a.playerId!, a.response as "yes" | "no" | "maybe"])) : null;
    const mesa = memberDay ? answers.data.filter((a) => a.playerId && scorers.data.includes(a.uid)).map((a) => a.playerId!) : [];
    return {
      stage,
      match: day.match,
      minute: day.minute,
      score: day.score,
      live: new Map([...live.rows].map(([id, r]) => [id, { status: r.status, tone: r.tone, tags: r.tags }])),
      rsvp,
      mesa,
      mvp: mvpIds,
      last: lastMatch(matches, seasonId),
      next: nextMatch(matches, seasonId, now),
    };
  }, [memberDay, stage, answers.data, scorers.data, day, live, mvpIds, matches, seasonId, now]);
  const lines = useMemo(() => matchLines(S, D), [S, D]);
  const mvpVote = useMemo(() => {
    const m = [...cur.games].reverse().find((g) => mvpVoteOpen(g, now));
    const r: MvpResult | undefined = m ? results.get(m.id) : undefined;
    return m && r && typeof r.eligible === "number" ? { j: cur.jornada.get(m.id) ?? null, total: r.total, eligible: r.eligible } : null;
  }, [cur, now, results]);

  // ── the address and what the page shows (it trails the address so «atrás» runs the choreography too)
  const addr = useMemo(() => addrOf(pathname, search), [pathname, search]);
  const [shown, setShown] = useState<Addr>(addr);
  const [ui, setUi] = useState<Ui>(() => ({ pick: "b", bdayOpen: false, numOpen: false, anCat: "pases", anNotes: false, adnSel: null, radarVs: "media", turned: false, flip: false, run: 0, flyHome: carry.flyHome, said: "", q: addr.q }));
  const kit = shown.screen === "player" ? (carry.kit ?? "home") : shown.kit;
  useEffect(() => {
    if (shown.screen !== "player") carry.kit = shown.kit;
  }, [shown.screen, shown.kit]);
  const lastGo = useRef<string>(JSON.stringify(addr));
  useEffect(() => {
    const key = JSON.stringify(addr);
    if (key === JSON.stringify(shown)) return;
    if (key === lastGo.current) {
      setShown(addr);
      return;
    }
    lastGo.current = key;
    const dir: Dir = addr.screen === "player" && shown.screen === "player" && addr.focus !== shown.focus ? (S.ids.indexOf(addr.focus ?? "") > S.ids.indexOf(shown.focus ?? "") ? "right" : "left") : addr.screen === shown.screen ? (SECS.indexOf(addr.sec) >= SECS.indexOf(shown.sec) ? "right" : "left") : addr.screen === "home" ? "left" : "right";
    transition(dir, reduced, () => flushSync(() => setShown(addr)));
    // (only the address drives this)
  }, [addr]); // eslint-disable-line react-hooks/exhaustive-deps

  // the flight home is over once the transition into the vestuario is done
  useEffect(() => {
    if (!ui.flyHome) return;
    carry.flyHome = null;
    const t = window.setTimeout(() => setUi((u) => ({ ...u, flyHome: null })), 900);
    return () => window.clearTimeout(t);
  }, [ui.flyHome]);

  // ── the screen
  const known = (id: string | null) => !!id && S.by.has(id);
  const duelA = known(shown.a) ? shown.a! : defaultDuel(S)[0];
  const duelB = known(shown.b) && shown.b !== duelA ? shown.b! : defaultDuel(S, duelA)[1];
  const screen: Screen = error && !roster.length ? "error" : loading || (!hydrated && !roster.length) ? "cargando" : shown.screen === "player" && !known(shown.focus) ? "noexiste" : shown.screen === "cara" && S.ids.length < 2 ? "home" : shown.screen;
  useNoIndex(screen === "noexiste");
  const st: ViewState = {
    screen,
    focus: shown.focus,
    sec: shown.sec,
    period: shown.all ? "all" : "cur",
    duelA,
    duelB,
    pick: screen === "cara" ? ui.pick : null,
    alFilter: shown.ver,
    kit,
    orden: shown.orden,
    q: ui.q,
    bdayOpen: ui.bdayOpen,
    numOpen: ui.numOpen,
    anCat: ui.anCat,
    anNotes: ui.anNotes,
    adnSel: ui.adnSel,
    radarVs: ui.radarVs,
    turned: ui.turned,
    flip: ui.flip,
    run: ui.run,
    flyHome: ui.flyHome,
    said: ui.said,
  };
  const isHome = screen === "home";
  const ghostIds = useMemo(() => (S.ids.length ? S.ids : Array.from({ length: 16 }, (_, i) => `ghost-${i}`)), [S.ids]);
  const rv = useMemo(() => (screen === "cargando" ? null : railView(S, st, who, lines, stage)), [S, st.screen, st.focus, st.duelA, st.duelB, st.pick, st.orden, st.q, st.flyHome, who, lines, stage]); // eslint-disable-line react-hooks/exhaustive-deps
  const lede = ledeView(S, D, screen === "cargando", screen === "error");
  const home = isHome && S.ids.length ? homeView(S, st, who, D, lines) : null;
  const du = screen === "cara" ? duelView(S, st) : null;
  const al = screen === "album" ? albumView(S, st, who) : null;
  const pv = screen === "player" ? playerView(S, st, who, lines, { mvpVote }) : null;

  // ── the stills: every printed shirt of the season in the kit on, the blank front for the turn
  const stillOf = usePageKitStills({ on: hydrated, theme, kits: [kit], players: roster.map((p) => ({ name: p.name, num: p.num })) });
  const front = useShirtStills(hydrated ? [{ kit, theme, name: "", num: "", yaw: Math.PI }] : [], { offMainThread: true });
  const frontSrc = front({ kit, theme, name: "", num: "", yaw: Math.PI });

  // ── moving: every change is a View Transition and an address
  const toAddr = (patch: Partial<Addr>): Addr => ({ ...shown, ...patch });
  const go = useCallback(
    (next: Addr, opts: { dir: Dir; replace?: boolean; el?: HTMLElement | null; home?: string | null; ui?: Partial<Ui> }) => {
      const href = hrefOf(next);
      const key = JSON.stringify(addrOf(href.to, { ...href.search, ...(next.screen === "player" ? {} : {}) }));
      lastGo.current = key;
      const crossing = (next.screen === "player") !== (shown.screen === "player");
      const img = opts.el?.querySelector<HTMLElement>(".pl-shirt__img") ?? null;
      if (img) img.style.viewTransitionName = "pl-flight";
      if (opts.home) carry.flyHome = opts.home;
      if (next.screen === "player") carry.kit = kit;
      transition(opts.dir, reduced, async () => {
        if (img) img.style.viewTransitionName = "none";
        if (!crossing)
          flushSync(() => {
            setShown(addrOf(href.to, href.search));
            if (opts.ui) setUi((u) => ({ ...u, ...opts.ui }));
          });
        await navigate({ to: href.to, search: href.search, replace: !!opts.replace, resetScroll: !crossing } as never);
        if (crossing) await rendered(next.screen === "player" ? ".pl-hero" : ".pl-screen:not([data-screen='player'])");
      });
    },
    [shown, kit, reduced, navigate],
  );
  const openPlayer = (id: string, el?: HTMLElement | null, sec?: Sec) => {
    if (screen === "player" && shown.focus === id) return;
    const reset: Partial<Ui> = { adnSel: null, flip: false, turned: false, said: "", run: ui.run + 1 };
    if (screen === "player") {
      go(toAddr({ focus: id, sec: sec ?? shown.sec }), { dir: S.ids.indexOf(id) > S.ids.indexOf(shown.focus ?? "") ? "right" : "left", replace: true, ui: reset });
      return;
    }
    go(toAddr({ screen: "player", focus: id, sec: sec ?? "ficha", all: false }), { dir: "right", el });
  };
  const goHome = () => go(toAddr({ screen: "home", focus: null, all: false }), { dir: "left", home: screen === "player" ? shown.focus : null });
  const stepPlayer = (d: 1 | -1) => {
    const n = S.ids.length;
    if (!n || !shown.focus) return;
    const i = S.ids.indexOf(shown.focus);
    go(toAddr({ focus: S.ids[(i + d + n) % n] }), { dir: d > 0 ? "right" : "left", replace: true, ui: { adnSel: null, flip: false, turned: false, said: "", run: ui.run + 1 } });
  };
  const goSec = (sec: Sec, dir?: Dir) => {
    if (sec === shown.sec) return;
    go(toAddr({ sec }), { dir: dir ?? (SECS.indexOf(sec) > SECS.indexOf(shown.sec) ? "right" : "left"), ui: { flip: false, run: sec === "cromo" ? ui.run + 1 : ui.run } });
  };
  const stepSec = (d: 1 | -1) => goSec(SECS[(SECS.indexOf(shown.sec) + d + SECS.length) % SECS.length], d > 0 ? "right" : "left");
  const local = (patch: Partial<Ui>, dir: Dir = "up") => transition(dir, reduced, () => flushSync(() => setUi((u) => ({ ...u, ...patch }))));

  // the search writes ?q= without entering the history
  const qTimer = useRef(0);
  const setQ = (q: string) => {
    setUi((u) => ({ ...u, q }));
    window.clearTimeout(qTimer.current);
    qTimer.current = window.setTimeout(() => {
      const href = hrefOf({ ...shown, q });
      lastGo.current = JSON.stringify(addrOf(href.to, href.search));
      setShown(addrOf(href.to, href.search));
      void navigate({ to: href.to, search: href.search, replace: true, resetScroll: false } as never);
    }, 350);
  };

  // ── the toast and the polite status
  const [say, setSay] = useState({ t: "", on: false });
  const sayT = useRef(0);
  const sayIt = (t: string) => {
    window.clearTimeout(sayT.current);
    setSay({ t, on: true });
    sayT.current = window.setTimeout(() => setSay((s) => ({ ...s, on: false })), 2600);
  };
  const shareP = () => {
    const p = shown.focus ? S.by.get(shown.focus) : null;
    if (!p) return;
    shareClubPage("jugador", p.id, `${p.name} · Manchester Piti`)
      .then(() => {
        const t = typeof navigator.share === "function" ? "Enlace listo" : "Enlace copiado";
        setUi((u) => ({ ...u, said: t }));
        sayIt(`${t}.`);
      })
      .catch(() => sayIt("No se ha compartido el enlace."));
  };
  const shareDuel = () => {
    const url = `${siteOrigin()}/plantilla/cara-a-cara?a=${encodeURIComponent(duelA)}&b=${encodeURIComponent(duelB)}`;
    const title = `${S.by.get(duelA)?.name} contra ${S.by.get(duelB)?.name} · Manchester Piti`;
    const native = typeof navigator.share === "function";
    (native ? navigator.share({ title, url }) : navigator.clipboard.writeText(url)).then(
      () => sayIt(native ? "Enlace listo." : "Enlace copiado."),
      () => sayIt("No se ha compartido el enlace."),
    );
  };

  // ── keyboard and swipes on a player: ← / → change player, a swipe on the hero too, on a section the section
  useEffect(() => {
    if (screen !== "player") return;
    const key = (e: globalThis.KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || t?.getAttribute?.("role") === "tab" || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        stepPlayer(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        stepPlayer(-1);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  const sw = useRef<{ x: number; y: number; t: number } | null>(null);
  const swDown = (e: RPointerEvent) => {
    sw.current = { x: e.clientX, y: e.clientY, t: Date.now() };
  };
  const swUp = (on: (d: 1 | -1) => void) => (e: RPointerEvent) => {
    const w = sw.current;
    sw.current = null;
    if (!w) return;
    const dx = e.clientX - w.x;
    const dy = e.clientY - w.y;
    if (Math.abs(dx) > 60 && Math.abs(dy) < 50 && Date.now() - w.t < 700) on(dx < 0 ? 1 : -1);
  };
  const tabKey = (e: KeyboardEvent) => {
    const i = SECS.indexOf(shown.sec);
    let n = i;
    if (e.key === "ArrowRight") n = (i + 1) % SECS.length;
    else if (e.key === "ArrowLeft") n = (i + SECS.length - 1) % SECS.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = SECS.length - 1;
    else return;
    e.preventDefault();
    goSec(SECS[n]);
    window.setTimeout(() => document.getElementById(`pl-tab-${SECS[n]}`)?.focus(), 60);
  };

  // the cromo's foil follows the pointer (not on touch, never with reduced motion)
  const foil = (e: RPointerEvent) => {
    if (reduced || e.pointerType === "touch") return;
    const c = (e.target as HTMLElement).closest?.(".pl-cromo") as HTMLElement | null;
    if (!c) return;
    const b = c.getBoundingClientRect();
    c.style.setProperty("--mx", ((e.clientX - b.left) / b.width).toFixed(3));
    c.style.setProperty("--my", ((e.clientY - b.top) / b.height).toFixed(3));
  };

  // a phone keeps the chosen hanger in view on the strip
  const railRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const el = railRef.current;
    if (!el || el.scrollWidth <= el.clientWidth + 1) return;
    const s = el.querySelector<HTMLElement>(".pl-hang.is-sel");
    if (s) el.scrollLeft = Math.max(0, s.offsetLeft - el.clientWidth / 2 + s.offsetWidth / 2);
  }, [shown.focus, screen]);

  const matchday = !!stage;
  const light = dia ? "noon" : matchday ? (stage === "pre" ? "dorada" : "noche") : "noche";
  const floodlit = !dia && matchday && stage !== "pre";
  const plCls = ["vx", "vd-pg", "pl", matchday ? `m-${stage}` : "", `scr-${screen}`, dia ? "is-dia" : ""].filter(Boolean).join(" ");
  const crumb = screen === "player" && pv ? pv.crumb : screen === "cara" && du ? { l: `Cara a cara · ${du.a.name} contra ${du.b.name}`, s: "Cara a cara" } : screen === "album" ? { l: `${who.me ? "Tu álbum" : "El álbum"} · ${seasonName}`, s: who.me ? "Tu álbum" : "El álbum" } : screen === "noexiste" ? { l: "Jugador no encontrado", s: "No encontrado" } : { l: "Plantilla", s: "Plantilla" };

  return (
    <KitStillContext.Provider value={stillOf}>
      <div className={plCls} data-kit={kit} style={{ "--vd-sky-h": "1000px" } as CSSProperties} aria-busy={screen === "cargando"} onPointerMove={screen === "player" && shown.sec === "cromo" ? foil : undefined}>
        <VidrioSky light={light} floodlit={floodlit} height={1000} />
        <CelesteHeader active="plantilla" actions={<ThemeToggle />} live={stage === "live" ? true : undefined} />

        <main className="pl-stage" id="pl-main">
          {isHome || screen === "cargando" || screen === "error" ? (
            <div className="pl-head vd-reg-1">
              <div className="pl-head__t">
                <h1 className="pl-h1">Plantilla</h1>
                <p className="pl-lede">
                  <span className="pl-lede-l">{lede.l}</span>
                  <span className="pl-lede-s">{lede.s}</span>
                </p>
              </div>
              {isHome && (
                <div className="pl-tools">
                  <div className="vd-glass vd-seg pl-kitseg" role="group" aria-label="Equipación" style={{ "--n": 2, "--i": kit === "away" ? 1 : 0 } as CSSProperties}>
                    <span className="vd-shelf__bead" aria-hidden="true" />
                    <button type="button" className="vd-seg__b" aria-pressed={kit === "home"} aria-label="Primera equipación" onClick={() => go(toAddr({ kit: "home" }), { dir: "up", replace: true })}>
                      1ª
                    </button>
                    <button
                      type="button"
                      className="vd-seg__b"
                      aria-pressed={kit === "away"}
                      aria-label="Segunda equipación"
                      onClick={() => {
                        go(toAddr({ kit: "away" }), { dir: "up", replace: true });
                        sayIt("La segunda: negra y roja.");
                      }}
                    >
                      2ª
                    </button>
                  </div>
                  <div className="vd-glass vd-seg pl-ordseg" role="group" aria-label="Orden de la percha" style={{ "--n": 2, "--i": shown.orden === "posicion" || matchday ? 1 : 0 } as CSSProperties}>
                    <span className="vd-shelf__bead" aria-hidden="true" />
                    <button type="button" className="vd-seg__b" aria-pressed={!(shown.orden === "posicion" || matchday)} disabled={matchday} onClick={() => go(toAddr({ orden: "dorsal" }), { dir: "up", replace: true })}>
                      Dorsal
                    </button>
                    <button type="button" className="vd-seg__b" aria-pressed={shown.orden === "posicion" || matchday} disabled={matchday} onClick={() => go(toAddr({ orden: "posicion" }), { dir: "up", replace: true })}>
                      {matchday ? "Convocatoria" : "Posición"}
                    </button>
                  </div>
                  <label className="vd-glass pl-search">
                    <Ic name="search" />
                    <input type="search" placeholder="Nombre o dorsal" value={ui.q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar jugador" />
                  </label>
                </div>
              )}
            </div>
          ) : (
            <div className="pl-head pl-head--back vd-reg-1">
              <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm pl-back" onClick={goHome}>
                <Ic name="chev-l" />
                Plantilla
              </button>
              <p className="pl-crumb">
                <span className="pl-crumb-l" aria-hidden="true">
                  {crumb.l}
                </span>
                <span className="pl-crumb-s" aria-hidden="true">
                  {crumb.s}
                </span>
                <span className="vd-vh">{crumb.l}</span>
              </p>
              {screen === "cara" && (
                <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm pl-share" onClick={shareDuel}>
                  <Ic name="share" />
                  <span>Compartir</span>
                </button>
              )}
            </div>
          )}

          {/* ── «La percha»: the squad hanging from its rail; the page's navigation */}
          <section className={`pl-percha ${screen === "home" || screen === "cargando" || screen === "error" ? "is-full" : "is-strip"}${screen === "cara" ? " is-picking" : ""}`} aria-label="La percha">
            {screen === "cara" && rv?.pick.on && (
              <div className="pl-pickbar" role="status">
                <span>
                  <b>{rv.pick.title}</b> {rv.pick.sub}
                </span>
              </div>
            )}
            <div className="pl-rail" role="group" aria-label={rv?.percha.label ?? "La plantilla en su percha"} ref={railRef}>
              {screen === "cargando"
                ? ghostIds.map((id) => (
                    <button key={id} type="button" className="pl-hang is-ghost" aria-label="Cargando" disabled>
                      <Hook />
                      <Shirt kit={kit} className="pl-hang__shirt" />
                      <span className="pl-cap">
                        <b className="pl-cap__n" />
                      </span>
                    </button>
                  ))
                : rv?.rail.map((h) => (
                    <HangerRow
                      key={h.id}
                      h={h}
                      kit={kit}
                      onPick={(el) => {
                        if (screen === "cara") {
                          const k = ui.pick === "a" ? "a" : "b";
                          const other = k === "a" ? duelB : duelA;
                          const patch: Partial<Addr> = h.id === other ? { a: duelB, b: duelA } : k === "a" ? { a: h.id, b: duelB } : { a: duelA, b: h.id };
                          go(toAddr(patch), { dir: "up", replace: true });
                          sayIt(`${h.name}, en la esquina ${k === "a" ? "1" : "2"}.`);
                          return;
                        }
                        openPlayer(h.id, el);
                      }}
                    />
                  ))}
              {rv?.empty && <p className="pl-empty">Nadie lleva ese nombre ni ese dorsal.</p>}
            </div>
            <p className="pl-hint">{screen === "cargando" ? "Colgando las camisetas…" : rv?.percha.hint}</p>
          </section>

          <div className="pl-screen" data-screen={screen}>
            {home && (
              <div className="pl-home vd-reg-3">
                <section className="pl-col pl-col--eq" aria-labelledby="pl-eq-t">
                  <h2 className="pl-h2" id="pl-eq-t">
                    {home.eq.title}
                  </h2>
                  <p className="pl-sub">{home.eq.sub}</p>
                  <ul className="pl-sum" aria-label="La plantilla en cuatro números">
                    {home.eq.sum.map((x) => (
                      <li key={x.t}>
                        <b>{x.v}</b>
                        <span>{x.t}</span>
                      </li>
                    ))}
                  </ul>
                  {home.eq.conv && (
                    <div className="pl-conv">
                      <h3 className="pl-h3">{home.eq.conv.title}</h3>
                      <div className="pl-conv__bar" role="img" aria-label={home.eq.conv.alt}>
                        {home.eq.conv.segs.map((c) => (
                          <span key={c.t} className={c.cls} style={{ flex: c.n }} />
                        ))}
                      </div>
                      <p className="pl-conv__key">
                        {home.eq.conv.segs.map((c) => (
                          <span key={c.t} className={c.cls}>
                            <i aria-hidden="true" />
                            <b>{c.n}</b> {c.t}
                          </span>
                        ))}
                      </p>
                      <Link className="vd-link pl-linkbtn" to={home.eq.conv.href}>
                        {home.eq.conv.link}
                      </Link>
                    </div>
                  )}
                  {home.eq.noConv && (
                    <dl className="pl-lines">
                      {home.eq.lines.map((l) => (
                        <div key={l.t}>
                          <dt>{l.t}</dt>
                          <dd>{l.names}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  {home.eq.admin && (
                    <p className="pl-adm">
                      <b>{home.eq.admin.t}</b> {home.eq.admin.d}{" "}
                      <Link className="vd-link" to="/admin/plantilla">
                        Completarlas en Admin
                      </Link>
                    </p>
                  )}
                </section>
                <section className="pl-col pl-col--pi" aria-labelledby="pl-pi-t">
                  <h2 className="pl-h2" id="pl-pi-t">
                    Pichichi y asistencias
                  </h2>
                  <p className="pl-sub">{home.pi.sub}</p>
                  <p className="pl-big">{home.pi.title}</p>
                  <ol className="pl-podium" aria-label="El podio de goleadores">
                    {home.pi.steps.map((s) => (
                      <li key={s.cls + s.place} className={`pl-step ${s.cls}`}>
                        {s.has ? (
                          <button type="button" className="pl-step__b" onClick={() => openPlayer(s.id, null, "temporada")} aria-label={s.label}>
                            <Shirt kit={kit} num={s.num} className="pl-step__shirt" />
                            <b className="pl-step__name">{s.name}</b>
                            <span className="pl-step__g">{s.goals}</span>
                          </button>
                        ) : (
                          <span className="pl-step__none">Por decidir</span>
                        )}
                        <span className="pl-step__base" aria-hidden="true">
                          {s.place}
                        </span>
                        <span className="vd-vh">{s.placeText}</span>
                      </li>
                    ))}
                  </ol>
                  <p className="pl-body">{home.pi.assists}</p>
                  <Link className="vd-link pl-linkbtn" to="/numeros/jugadores">
                    La tabla entera, en Números
                  </Link>
                </section>
                <section className="pl-col pl-col--more" aria-label="Más de la plantilla">
                  <div className="pl-doors">
                    {S.ids.length > 1 && (
                      <button type="button" className="vd-glass vd-press pl-door" onClick={() => go(toAddr({ screen: "cara", a: duelA, b: duelB }), { dir: "right", ui: { pick: "b" } })}>
                        <span className="pl-door__art" aria-hidden="true">
                          <Shirt kit={kit} num={S.by.get(duelA)?.num} className="pl-door__shirt pl-door__shirt--a" />
                          <Shirt kit={kit} num={S.by.get(duelB)?.num} className="pl-door__shirt pl-door__shirt--b" />
                        </span>
                        <span className="pl-door__t">
                          <b>Cara a cara</b>
                          <span>{home.door.cara}</span>
                        </span>
                        <Ic name="chev-r" />
                      </button>
                    )}
                    <button type="button" className="vd-glass vd-press pl-door" onClick={() => go(toAddr({ screen: "album", ver: "todos" }), { dir: "right" })}>
                      <span className="pl-door__art pl-door__art--album" aria-hidden="true">
                        {home.door.albumIds.map((id) => (
                          <Shirt key={id} kit={kit} num={S.by.get(id)?.num} className="pl-door__mini" />
                        ))}
                      </span>
                      <span className="pl-door__t">
                        <b>{home.door.albumT}</b>
                        <span>{home.door.album}</span>
                      </span>
                      <Ic name="chev-r" />
                    </button>
                  </div>
                  <h2 className="pl-h3 pl-bday__t">Próximos cumpleaños</h2>
                  <ul className="pl-bday">
                    {home.eq.bdays.map((b) => (
                      <li key={b.id} className={b.cls}>
                        <Shirt kit={kit} num={b.num} className="pl-bday__shirt" />
                        <button type="button" className="pl-namebtn" onClick={() => openPlayer(b.id, null)}>
                          {b.name}
                        </button>
                        <span className="pl-bday__d">{b.turns ? `Cumple ${b.turns} el ${b.label}` : "Sin fecha en su ficha"}</span>
                        <b>{b.when}</b>
                      </li>
                    ))}
                  </ul>
                  {S.ids.length > 3 && (
                    <button type="button" className="vd-more__btn pl-more" onClick={() => local({ bdayOpen: !ui.bdayOpen })} aria-expanded={ui.bdayOpen}>
                      {home.eq.bdayBtn}
                      <Ic name={home.eq.bdayIcon} className="" />
                    </button>
                  )}
                </section>
              </div>
            )}

            {du && (
              <div className="pl-duelscreen vd-reg-3">
                <header className="pl-screenhead">
                  <h1 className="pl-h1 pl-h1--s">Cara a cara</h1>
                  <p className="pl-sub">{du.sub}</p>
                </header>
                <div className="pl-ring">
                  {(["a", "b"] as const).map((k) => {
                    const c = du[k];
                    return (
                      <div key={k} className={`pl-corner pl-corner--${k} ${c.cls}`}>
                        <span className="pl-spot" aria-hidden="true" />
                        <Shirt kit={kit} num={c.num} className="pl-corner__shirt" />
                        <b className="pl-corner__name">{c.name}</b>
                        <span className="pl-corner__pos">{c.pos}</span>
                        <div className="pl-corner__acts">
                          <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm" onClick={() => setUi((u) => ({ ...u, pick: k }))} aria-pressed={c.picking} aria-label={c.chg}>
                            Cambiar
                          </button>
                          <button type="button" className="vd-link pl-linkbtn" onClick={() => openPlayer(c.id, null)}>
                            Su ficha
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  <div className="pl-ring__mid">
                    <button type="button" className="vd-glass vd-press pl-vs" onClick={() => go(toAddr({ a: duelB, b: duelA }), { dir: "up", replace: true })} aria-label="Intercambiar las esquinas">
                      <span aria-hidden="true">VS</span>
                    </button>
                    <p className="pl-tally" aria-live="polite">
                      {du.tally}
                    </p>
                  </div>
                </div>
                <div className="pl-duelbody">
                  <table className="pl-duel">
                    <caption className="vd-vh">{du.caption}</caption>
                    <thead className="vd-vh">
                      <tr>
                        <th scope="col">{du.a.name}</th>
                        <th scope="col">Dato</th>
                        <th scope="col">{du.b.name}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {du.rows.map((r) => (
                        <tr key={r.t} className={r.cls || undefined}>
                          <td className={`pl-duel__a ${r.aw}`}>
                            <div className="pl-duel__cell">
                              <span className="pl-duel__v">{r.av}</span>
                              <span className="pl-duel__bar" style={{ "--w": r.ap } as CSSProperties} aria-hidden="true" />
                            </div>
                          </td>
                          <th scope="row">
                            {r.t}
                            {r.hint && <small>{r.hint}</small>}
                          </th>
                          <td className={`pl-duel__b ${r.bw}`}>
                            <div className="pl-duel__cell">
                              <span className="pl-duel__bar" style={{ "--w": r.bp } as CSSProperties} aria-hidden="true" />
                              <span className="pl-duel__v">{r.bv}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="pl-duelside">
                    <h2 className="pl-h3">El veredicto</h2>
                    <ul className="pl-verdict" aria-live="polite">
                      {du.verdict.map((v) => (
                        <li key={v}>{v}</li>
                      ))}
                    </ul>
                    {du.note && <p className="pl-note">{du.note}</p>}
                  </div>
                </div>
              </div>
            )}

            {al && (
              <div className="pl-albumscreen vd-reg-3">
                <header className="pl-screenhead pl-screenhead--row">
                  <div>
                    <h1 className="pl-h1 pl-h1--s">{al.title}</h1>
                    <p className="pl-sub">{al.sub}</p>
                  </div>
                  {al.mine && (
                    <div className="vd-glass vd-seg pl-alseg" role="group" aria-label="Qué cromos ver" style={{ "--n": 3, "--i": al.fI } as CSSProperties}>
                      <span className="vd-shelf__bead" aria-hidden="true" />
                      {al.filters.map((f) => (
                        <button key={f.k} type="button" className="vd-seg__b" aria-pressed={f.on} onClick={() => go(toAddr({ ver: f.k }), { dir: "up", replace: true })}>
                          {f.t}
                        </button>
                      ))}
                    </div>
                  )}
                </header>
                {al.mine && (
                  <div className="pl-albar">
                    <span className="pl-albar__n">
                      <b>{al.owned}</b> de {al.total} cromos
                    </span>
                    <span className="pl-albar__track" aria-hidden="true">
                      <span style={{ width: `${al.pct}%` }} />
                    </span>
                    <span className="pl-albar__line">{al.line}</span>
                  </div>
                )}
                <ul className="pl-album">
                  {al.cards.map((c) => (
                    <li key={c.id}>
                      <button type="button" className={`pl-acard ${c.cls}`} onClick={() => openPlayer(c.id, null, "cromo")} aria-label={c.label}>
                        <span className="pl-acard__art" aria-hidden="true">
                          <Shirt kit={kit} num={c.num} className="pl-acard__shirt" />
                        </span>
                        <b className="pl-acard__name">{c.name}</b>
                        <span className="pl-acard__sub">{c.sub}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                {al.empty && <p className="pl-empty pl-empty--l">{al.emptyText}</p>}
                <p className="pl-note">{al.note}</p>
                {al.door && (
                  <Link className="vd-glass vd-press vd-btn vd-btn--sm" to="/vestuario">
                    {al.doorLabel}
                  </Link>
                )}
              </div>
            )}

            {pv && shown.focus && (
              <PlayerScreen
                pv={pv}
                st={st}
                kit={kit}
                frontSrc={frontSrc}
                photo={S.by.get(shown.focus)?.photo ?? null}
                onPrev={() => stepPlayer(-1)}
                onNext={() => stepPlayer(1)}
                swDown={swDown}
                swHero={(e) => swUp(stepPlayer)(e)}
                swSec={(e) => swUp(stepSec)(e)}
                onSec={goSec}
                tabKey={tabKey}
                onPeriod={(allP) => go(toAddr({ all: allP }), { dir: "up", replace: true })}
                onDuel={() => {
                  const id = shown.focus!;
                  go(toAddr({ screen: "cara", focus: null, a: id, b: id === duelB ? duelA : duelB, all: false }), { dir: "right", ui: { pick: "b" } });
                }}
                onShare={shareP}
                onTurn={() => setUi((u) => ({ ...u, turned: !u.turned }))}
                onOpen={(id) => openPlayer(id, null)}
                onUi={(patch, dir) => (dir ? local(patch, dir) : setUi((u) => ({ ...u, ...patch })))}
                onAlbum={() => go(toAddr({ screen: "album", focus: null, ver: "todos", all: false }), { dir: "right" })}
                onStep={stepSec}
              />
            )}

            {(screen === "noexiste" || screen === "error") && (
              <div className="pl-state vd-reg-3" role="status">
                <span className="pl-state__ghost" aria-hidden="true">
                  {screen === "noexiste" ? "404" : ""}
                </span>
                <h1 className="pl-h1 pl-h1--s">{screen === "noexiste" ? "Jugador no encontrado" : "El marcador no carga"}</h1>
                <p className="pl-body">{screen === "noexiste" ? "Este jugador no está en la plantilla: o ya no está en el club, o el enlace tiene el dorsal mal apuntado." : "No nos han llegado los datos del club. Suele ser la conexión: dale otra vez en un momento."}</p>
                <div className="pl-state__acts">
                  {screen === "noexiste" ? (
                    <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm vd-btn--pri" onClick={goHome}>
                      Ver la plantilla
                    </button>
                  ) : (
                    <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm vd-btn--pri" onClick={() => window.location.reload()}>
                      Reintentar
                    </button>
                  )}
                  <Link className="vd-glass vd-press vd-btn vd-btn--sm" to="/">
                    Ir al inicio
                  </Link>
                </div>
              </div>
            )}
            {screen === "cargando" && (
              <div className="pl-state vd-reg-3" role="status">
                <span className="pl-state__ghost" aria-hidden="true" />
                <h2 className="pl-h1 pl-h1--s">Preparando la plantilla…</h2>
                <p className="pl-body">Colgando las camisetas en la percha. Si la conexión va lenta, verás las camisetas sin nombre un momento.</p>
              </div>
            )}
          </div>
        </main>

        <CelesteFooter />
        <CelesteDock active="plantilla" live={stage === "live" ? true : undefined} />

        <p className="vd-vh" role="status" aria-live="polite">
          {say.t}
        </p>
        <div className={`pl-toast${say.on ? " is-on" : ""}`} aria-hidden="true">
          <Ic name="check" />
          <span>{say.t}</span>
        </div>
      </div>
    </KitStillContext.Provider>
  );
}

/** The percha follows the match on its day: the convocatoria before, the pitch while it is played, the acta that
 *  evening; any other day it says what each one did in the last match. */
function stageOf(day: MatchdayModel, now: number): "pre" | "live" | "after" | null {
  const { phase } = day;
  if (!day.match) return null;
  if (phase === "antes" || phase === "pitido") return "pre";
  if (phase === "directo1" || phase === "descanso" || phase === "directo2") return "live";
  const ymd = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(ms);
  if (phase === "final" || (phase === "acta" && day.kickoff != null && ymd(day.kickoff) === ymd(now))) return "after";
  return null;
}
/** The duel the door opens with: the top scorer against the captain, else the first two with a complete ficha. */
function defaultDuel(S: Squad, a?: string): [string, string] {
  const complete = S.ids.filter((id) => {
    const p = S.by.get(id)!;
    return !!(p.birth && p.h && p.w);
  });
  const pool = [...complete, ...S.ids.filter((id) => !complete.includes(id))];
  const first = a ?? pool[0] ?? "";
  const second = pool.find((id) => id !== first) ?? "";
  return [first, second];
}

function HangerRow({ h, kit, onPick }: { h: ReturnType<typeof railView>["rail"][number]; kit: "home" | "away"; onPick: (el: HTMLElement | null) => void }) {
  return (
    <>
      {h.sep && (
        <span className="pl-sep" aria-hidden="true">
          <span>{h.sep}</span>
        </span>
      )}
      <button type="button" className={`pl-hang ${h.cls}`} data-pl-id={h.id} onClick={(e) => onPick(e.currentTarget)} aria-label={h.label} aria-current={h.cur ? "page" : undefined}>
        <Hook />
        <Shirt kit={kit} num={h.num} className="pl-hang__shirt" vtn={h.vtn} />
        <span className="pl-cap">
          <b className="pl-cap__n">{h.name}</b>
          <span className="pl-cap__pos">{h.pos}</span>
          {h.status && <span className={`pl-status ${h.tone}`}>{h.status}</span>}
          {h.tags.length > 0 && (
            <span className="vd-tags pl-cap__tags">
              {h.tags.map((t) => (
                <span key={t.text} className={`vd-tag ${t.cls}`}>
                  {t.text}
                </span>
              ))}
            </span>
          )}
          {h.me && <span className="pl-you">Tú</span>}
        </span>
      </button>
    </>
  );
}

type PV = ReturnType<typeof playerView>;
function PlayerScreen(props: {
  pv: PV;
  st: ViewState;
  kit: "home" | "away";
  frontSrc: string | undefined;
  photo: string | null;
  onPrev: () => void;
  onNext: () => void;
  swDown: (e: RPointerEvent) => void;
  swHero: (e: RPointerEvent) => void;
  swSec: (e: RPointerEvent) => void;
  onSec: (s: Sec) => void;
  tabKey: (e: KeyboardEvent) => void;
  onPeriod: (all: boolean) => void;
  onDuel: () => void;
  onShare: () => void;
  onTurn: () => void;
  onOpen: (id: string) => void;
  onUi: (patch: Partial<Ui>, dir?: Dir) => void;
  onAlbum: () => void;
  onStep: (d: 1 | -1) => void;
}) {
  const { pv, st, kit } = props;
  const { hero, fi, te, jo, po, ra, cl, co, an, cr, tabs, secNav, per } = pv;
  const still = useContext(KitStillContext)(kit, hero.n || undefined);
  const back = still && (still.printed || !hero.n) ? still.src : undefined;
  const sec = st.sec;
  return (
    <div className="pl-player">
      <section className={`pl-hero ${hero.cls}`} aria-labelledby="pl-hero-name" onPointerDown={props.swDown} onPointerUp={props.swHero}>
        <div className="pl-hero__stage">
          <span className="pl-hero__light" aria-hidden="true" />
          <button type="button" className="vd-glass vd-press vd-ibtn pl-hero__nav pl-hero__nav--prev" onClick={props.onPrev} aria-label={hero.prevLabel}>
            <Ic name="chev-l" />
          </button>
          <div className={`pl-turn${hero.turned ? " is-turned" : ""}`} aria-hidden="true">
            {back ? <img className="pl-hero__img pl-turn__back" src={back} alt="" width={540} height={600} /> : <span className="pl-hero__img pl-turn__back" />}
            {props.frontSrc && <img className="pl-turn__front" src={props.frontSrc} alt="" width={540} height={600} />}
          </div>
          <button type="button" className="vd-glass vd-press vd-ibtn pl-hero__nav pl-hero__nav--next" onClick={props.onNext} aria-label={hero.nextLabel}>
            <Ic name="chev-r" />
          </button>
          <span className="pl-hero__floor" aria-hidden="true" />
          <p className="vd-vh">{hero.shirtAlt}</p>
        </div>
        <div className="pl-hero__id vd-reg-2">
          <p className="pl-hero__kick">{hero.kick}</p>
          <h1 className="pl-hero__name" id="pl-hero-name">
            {hero.name}
          </h1>
          <p className="pl-hero__full">{hero.full}</p>
          {hero.status && (
            <p className="pl-hero__status">
              <span className={`pl-status ${hero.tone}`}>{hero.status}</span>
              {hero.tags.map((t) => (
                <span key={t.text} className={`vd-tag ${t.cls}`}>
                  {t.text}
                </span>
              ))}
            </p>
          )}
        </div>
        <div className="pl-hero__acts">
          {hero.self && (
            <Link className="vd-glass vd-press vd-btn vd-btn--sm vd-btn--pri" to="/perfil">
              Editar tu carta
              <Ic name="chev-r" />
            </Link>
          )}
          {hero.admin && (
            <Link className="vd-glass vd-press vd-btn vd-btn--sm" to="/admin/plantilla" search={{ jugador: hero.id }}>
              Editar ficha
              <Ic name="chev-r" />
            </Link>
          )}
          <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm" onClick={props.onDuel}>
            <Ic name="swap" />
            Comparar con…
          </button>
          <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm" onClick={props.onShare}>
            <Ic name="share" />
            Compartir perfil
          </button>
          <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm" onClick={props.onTurn} aria-pressed={hero.turned}>
            <Ic name="swap" />
            Girar la camiseta
          </button>
        </div>
        <p className="pl-hero__said" role="status">
          {st.said}
        </p>
      </section>

      <div className="pl-pmain">
        <div className="pl-tabsbar">
          <nav className="pl-tabs" role="tablist" aria-label={`La ficha de ${hero.name}`}>
            {tabs.map((t) => (
              <button key={t.id} type="button" role="tab" id={`pl-tab-${t.id}`} aria-controls="pl-sec" aria-selected={t.on} tabIndex={t.on ? 0 : -1} className="pl-tab" onClick={() => props.onSec(t.id)} onKeyDown={props.tabKey}>
                <b>{t.label}</b>
                <small>{t.hint}</small>
                <span className="pl-tab__bead" style={{ viewTransitionName: t.on ? "pl-tabbead" : "none" } as CSSProperties} aria-hidden="true" />
              </button>
            ))}
          </nav>
          <div className="vd-glass vd-seg pl-pseg" role="group" aria-label="Período" style={{ "--n": 2, "--i": per.i } as CSSProperties}>
            <span className="vd-shelf__bead" aria-hidden="true" />
            <button type="button" className="vd-seg__b" aria-pressed={per.cur} onClick={() => props.onPeriod(false)}>
              {per.curLabel}
            </button>
            <button type="button" className="vd-seg__b" aria-pressed={per.all} onClick={() => props.onPeriod(true)}>
              Todo el historial
            </button>
          </div>
        </div>
        <div className="pl-sec vd-reg-4" id="pl-sec" role="tabpanel" aria-labelledby={`pl-tab-${sec}`} onPointerDown={props.swDown} onPointerUp={props.swSec}>
          {sec === "ficha" && (
            <div className="pl-grid2">
              <div>
                <h2 className="pl-h3">Su ficha</h2>
                <dl className="pl-facts">
                  {fi.facts.map((f) => (
                    <div key={f.t} className={f.cls || undefined}>
                      <dt>{f.t}</dt>
                      <dd>
                        {f.v}
                        {f.x && <small>{f.x}</small>}
                      </dd>
                    </div>
                  ))}
                </dl>
                {fi.missing && <p className="pl-note">{fi.missing}</p>}
                <p className="pl-note">{fi.club}</p>
                {fi.cleared && <p className="pl-note">{fi.cleared}</p>}
                {fi.photoNote && <p className="pl-note">{fi.photoNote}</p>}
              </div>
              <div>
                {fi.quote && (
                  <figure className="pl-quote">
                    <blockquote>
                      <p>«{fi.quote}»</p>
                    </blockquote>
                    <figcaption>{hero.name}, su frase</figcaption>
                  </figure>
                )}
                {fi.bio && <p className="pl-bio">{fi.bio}</p>}
                {fi.noStory && <p className="pl-note">{fi.noStory}</p>}
                <h2 className={`pl-h3${fi.quote || fi.bio || fi.noStory ? " pl-gap" : ""}`}>Sus medallas</h2>
                {!fi.noMedals && (
                  <ul className="pl-medals">
                    {fi.medals.map((m) => (
                      <li key={m.t} className={m.cls || undefined}>
                        <Ic name={m.icon} />
                        <b>{m.t}</b>
                        <span>{m.d}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {fi.noMedals && <p className="pl-note">La primera medalla llega con su primer partido.</p>}
                <ul className="pl-chase" aria-label="Las tres próximas">
                  {fi.next.map((n) => (
                    <li key={n.t}>
                      <span>{n.t}</span>
                      <span className="pl-chase__bar" aria-hidden="true">
                        <span style={{ width: `${n.pct}%` }} />
                      </span>
                      <b>{n.txt}</b>
                    </li>
                  ))}
                </ul>
                {fi.partner && (
                  <p className="pl-partner">
                    <span>Mejor socio</span>
                    <button type="button" className="pl-namebtn" onClick={() => props.onOpen(fi.partner!.id)}>
                      {fi.partner.name}
                    </button>
                    <em>{fi.partner.line}</em>
                  </p>
                )}
              </div>
            </div>
          )}

          {sec === "temporada" && (
            <div className="pl-grid2 pl-grid2--wide">
              <div>
                <h2 className="pl-h3">{te.title}</h2>
                <ul className="pl-four">
                  {te.four.map((x) => (
                    <li key={x.t}>
                      <b>{x.v}</b>
                      <span>{x.t}</span>
                    </li>
                  ))}
                </ul>
                <ul className="pl-chips" aria-label="Su temporada en cinco números">
                  {te.chips.map((c) => (
                    <li key={c.t} className={c.cls || undefined}>
                      <span>{c.t}</span>
                      <b>{c.v}</b>
                      <small>{c.s}</small>
                    </li>
                  ))}
                </ul>
                <p className="pl-note">{te.note}</p>
                <h2 className="pl-h3 pl-gap">Temporada a temporada</h2>
                <table className="vd-table pl-ttable">
                  <thead>
                    <tr>
                      <th scope="col">Temporada</th>
                      <th scope="col">PJ</th>
                      <th scope="col">G</th>
                      <th scope="col">A</th>
                      <th scope="col">Min</th>
                      <th scope="col">MVP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {te.seasons.map((r) => (
                      <tr key={r.t}>
                        <th scope="row">{r.t}</th>
                        <td>{r.pj}</td>
                        <td>{r.g}</td>
                        <td>{r.a}</td>
                        <td>{r.min}</td>
                        <td>{r.mvp}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <h2 className="pl-h3">Sus números</h2>
                <dl className="pl-nums">
                  {te.nums.map((r) => (
                    <div key={r.a} className={r.cls || undefined}>
                      <dt>{r.a}</dt>
                      <dd>{r.b}</dd>
                    </div>
                  ))}
                </dl>
                {te.numsMore && (
                  <div className="vd-more pl-nums__more">
                    <span>
                      <b>{te.numsRest}</b> {te.numsRestT}
                    </span>
                    <button type="button" className="vd-more__btn" onClick={() => props.onUi({ numOpen: !st.numOpen }, "up")} aria-expanded={te.numsOpen}>
                      {te.numsBtn}
                      <Ic name={te.numsIcon} className="" />
                    </button>
                  </div>
                )}
                <p className="pl-note">Minutos, titularidades y cambios solo se cuentan en actas completas.</p>
                <h2 className="pl-h3 pl-gap">El juego en detalle</h2>
                <p className="pl-note">{te.tech}</p>
              </div>
            </div>
          )}

          {sec === "jornadas" &&
            (jo.has ? (
              <div className="pl-grid2 pl-grid2--wide">
                <div>
                  <h2 className="pl-h3">Su ADN, jornada a jornada</h2>
                  <p className="pl-legend">Barra, minutos · balón, gol · flecha, asistencia · estrella, MVP · letra, resultado (G gana, E empata, P pierde)</p>
                  <ol className="pl-adn" aria-label={`Las últimas ${jo.adn.length === 1 ? "jornada" : `${jo.adn.length} jornadas`}`}>
                    {jo.adn.map((d) => (
                      <li key={d.i}>
                        <button type="button" className={`pl-adn__c ${d.cls}`} onClick={() => props.onUi({ adnSel: d.i })} aria-label={d.label} aria-pressed={d.on}>
                          <span className="pl-adn__marks" aria-hidden="true">
                            {d.mvp && <Ic name="star" className="pl-adn__ico is-mvp" />}
                            {Array.from({ length: d.goals }, (_, k) => (
                              <Ic key={`g${k}`} name="ball" className="pl-adn__ico" />
                            ))}
                            {Array.from({ length: d.assists }, (_, k) => (
                              <Ic key={`a${k}`} name="arrow" className="pl-adn__ico" />
                            ))}
                          </span>
                          <span className="pl-adn__bar" style={{ "--h": d.h } as CSSProperties} aria-hidden="true" />
                          <span className="pl-adn__res" aria-hidden="true">
                            {d.res}
                          </span>
                          <span className="pl-adn__j" aria-hidden="true">
                            {d.j}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ol>
                  {jo.sel && (
                    <div className="pl-adn__sel">
                      <p>
                        <b>{jo.sel.t}</b> {jo.sel.d}
                      </p>
                      <Link className="vd-link pl-linkbtn" to="/partidos/$matchId" params={{ matchId: jo.sel.id }}>
                        Abrir el partido
                      </Link>
                    </div>
                  )}
                  {jo.stint.has && (
                    <>
                      <div className="pl-stint" role="img" aria-label={jo.stint.label}>
                        <span className="pl-stint__half" aria-hidden="true" />
                        {jo.stint.segs.map((g) => (
                          <span key={g.l} className="pl-stint__seg" style={{ left: `${g.l}%`, width: `${g.w}%` }} />
                        ))}
                        {jo.stint.marks.map((k, i) => (
                          <span key={i} className={`pl-stint__mark ${k.cls}`} style={{ left: `${k.x}%` }} />
                        ))}
                      </div>
                      <p className="pl-stint__scale" aria-hidden="true">
                        <span>0′</span>
                        <span>Descanso</span>
                        <span>{"end" in jo.stint ? jo.stint.end : "50′"}</span>
                      </p>
                    </>
                  )}
                  <h2 className="pl-h3 pl-gap">Sus cambios</h2>
                  <p className="pl-body">{jo.changes}</p>
                </div>
                <div>
                  <h2 className="pl-h3">Sus últimos encuentros</h2>
                  {jo.enc.length ? (
                    <ul className="pl-enc">
                      {jo.enc.map((e) => (
                        <li key={e.id}>
                          <Link className="pl-enc__a" to="/partidos/$matchId" params={{ matchId: e.id }}>
                            <span className={`pl-letter ${e.cls}`}>{e.res}</span>
                            <span className="pl-enc__t">
                              <b>vs {e.rival}</b>
                              <small>{e.when}</small>
                            </span>
                            <span className="pl-enc__sc">{e.sc}</span>
                            <span className="pl-enc__me">{e.me}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="pl-note">Aún no ha jugado en este período.</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="pl-empty pl-empty--l">Aún no ha jugado en este período. Su ADN se dibuja con el primer partido.</p>
            ))}

          {sec === "juego" && (
            <div className="pl-grid2 pl-grid2--wide">
              <div>
                <h2 className="pl-h3">Sus posiciones</h2>
                <p className="pl-legend">{po.sub}</p>
                <div className="pl-posbox">
                  <div className="vd-pitch pl-pitch" role="img" aria-label={po.alt}>
                    <svg className="vd-pitch__lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                      <rect x="3" y="3" width="94" height="94" rx="1" />
                      <circle cx="50" cy="3" r="13" />
                      <rect x="27" y="80" width="46" height="17" />
                      <rect x="39" y="91" width="22" height="6" />
                    </svg>
                    {po.spots.map((p) => (
                      <span key={p.code} className={`pl-spotp ${p.cls}`} style={{ left: `${p.x}%`, top: `${p.y}%` }}>
                        <b>{p.code}</b>
                        {p.min && <small>{p.min}</small>}
                      </span>
                    ))}
                  </div>
                  <div>
                    <p className="pl-legend">
                      <span className="pl-key pl-key--main" />
                      Su puesto <span className="pl-key pl-key--also" />
                      También <span className="pl-key pl-key--played" />
                      Ha jugado ahí
                    </p>
                    <p className="pl-lead">{po.lead}</p>
                    {po.rows.length > 0 && (
                      <table className="vd-table pl-ptable">
                        <thead>
                          <tr>
                            <th scope="col">Posición</th>
                            <th scope="col">Min</th>
                            <th scope="col">PJ</th>
                            <th scope="col">G</th>
                            <th scope="col">A</th>
                            <th scope="col">
                              <abbr title="Valoración">Val.</abbr>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {po.rows.map((r) => (
                            <tr key={r.code}>
                              <th scope="row">{r.name}</th>
                              <td>{r.min}</td>
                              <td>{r.pj}</td>
                              <td>{r.g}</td>
                              <td>{r.a}</td>
                              <td>{r.rating}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    <p className="pl-note">{po.note}</p>
                    {po.review && (
                      <p className="pl-review">
                        <b>{po.reviewT}</b> {po.review}{" "}
                        {po.reviewLink && (
                          <Link className="vd-link" to="/perfil/posiciones">
                            {po.reviewLink}
                          </Link>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <h2 className="pl-h3">Su radar</h2>
                {ra.hasSocio && (
                  <div className="vd-glass vd-seg pl-vsseg" role="group" aria-label="Comparar su radar con" style={{ "--n": 2, "--i": ra.vsI } as CSSProperties}>
                    <span className="vd-shelf__bead" aria-hidden="true" />
                    <button type="button" className="vd-seg__b" aria-pressed={!ra.vsSocio} onClick={() => props.onUi({ radarVs: "media" })}>
                      Media de la plantilla
                    </button>
                    <button type="button" className="vd-seg__b" aria-pressed={ra.vsSocio} onClick={() => props.onUi({ radarVs: "socio" })}>
                      {ra.socioLabel}
                    </button>
                  </div>
                )}
                {ra.has ? (
                  <>
                    <figure className="pl-radar">
                      <svg viewBox="-110 -110 220 220" role="img" aria-label={ra.alt} focusable="false">
                        <polygon className="pl-radar__ring" points={ra.r100} />
                        <polygon className="pl-radar__ring" points={ra.r66} />
                        <polygon className="pl-radar__ring" points={ra.r33} />
                        <polygon className="pl-radar__vs" points={ra.vs} />
                        <polygon className="pl-radar__me" points={ra.me} />
                      </svg>
                      {ra.axes.map((x) => (
                        <span key={x.n} className="pl-radar__ax" style={{ left: `${x.l}%`, top: `${x.t}%` }}>
                          {x.n}
                        </span>
                      ))}
                    </figure>
                    <p className="pl-legend">
                      <span className="pl-key pl-key--me" />
                      {hero.name} <span className="pl-key pl-key--vs" />
                      {ra.vsName}
                    </p>
                  </>
                ) : (
                  <p className="pl-note">El radar se dibuja con el primer partido.</p>
                )}
                <div className="pl-two">
                  <div>
                    <h2 className="pl-h3 pl-gap">Su reloj de goles</h2>
                    <ol className="pl-clock" aria-label={cl.alt}>
                      {cl.bins.map((b) => (
                        <li key={b.t}>
                          <span className="pl-clock__bar" style={{ "--h": b.h } as CSSProperties} aria-hidden="true">
                            <b>{b.n}</b>
                          </span>
                          <span>{b.t}</span>
                        </li>
                      ))}
                    </ol>
                    <p className="pl-note">{cl.note}</p>
                  </div>
                  <div>
                    <h2 className="pl-h3 pl-gap">Su constelación</h2>
                    {co.has ? (
                      <figure className="pl-const" role="img" aria-label={co.alt}>
                        <svg viewBox="0 0 200 160" aria-hidden="true" focusable="false">
                          {co.stars.map((c) => (
                            <line key={`l${c.id}`} className="pl-const__l" x1="100" y1="80" x2={c.x} y2={c.y} strokeWidth={c.w} />
                          ))}
                          {co.stars.map((c) => (
                            <circle key={`s${c.id}`} className={`pl-const__s ${c.cls}`} cx={c.x} cy={c.y} r={c.r} />
                          ))}
                          <circle className="pl-const__me" cx="100" cy="80" r="9" />
                        </svg>
                        {co.stars.map((c) => (
                          <span key={`n${c.id}`} className={`pl-const__n ${c.al}`} style={{ left: `${c.lx}%`, top: `${c.ly}%` }}>
                            {c.name}
                          </span>
                        ))}
                      </figure>
                    ) : (
                      <p className="pl-note">Se enciende cuando juegue con alguien.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {sec === "analisis" &&
            (an.has ? (
              <>
                <p className="pl-legend">{an.sub}</p>
                <ul className="pl-rates">
                  {an.rates.map((r) => (
                    <li key={r.t}>
                      <span>{r.t}</span>
                      <b>{r.v}</b>
                      <small>{r.s}</small>
                    </li>
                  ))}
                </ul>
                <div className="vd-glass vd-seg pl-anseg" role="group" aria-label="Familia de acciones" style={{ "--n": 4, "--i": an.catI } as CSSProperties}>
                  <span className="vd-shelf__bead" aria-hidden="true" />
                  {an.cats.map((c) => (
                    <button key={c.k} type="button" className="vd-seg__b" aria-pressed={c.on} onClick={() => props.onUi({ anCat: c.k }, "up")}>
                      {c.t}
                    </button>
                  ))}
                </div>
                <div className="pl-grid2 pl-grid2--wide">
                  <div>
                    <h2 className="pl-h3">{an.catT}</h2>
                    <dl className="pl-nums pl-nums--an">
                      {an.rows.map((r) => (
                        <div key={r.a} className={r.cls || undefined}>
                          <dt>{r.a}</dt>
                          <dd>{r.b}</dd>
                        </div>
                      ))}
                    </dl>
                    <h2 className="pl-h3 pl-gap">Con quién se pasa la pelota</h2>
                    {an.net.length > 0 ? (
                      <ul className="pl-net">
                        {an.net.map((n) => (
                          <li key={n.id}>
                            <b>{n.name}</b>
                            <span>le pasó {n.to}</span>
                            <span>recibió {n.from}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <p className="pl-note">{an.net.length ? "Pases completados entre los dos, según la narración." : "La narración no recoge pases completados entre él y un compañero."}</p>
                  </div>
                  <div>
                    <h2 className="pl-h3">{an.rankT}</h2>
                    <ol className="pl-rank">
                      {an.rank.map((r) => (
                        <li key={r.id} className={r.cls || undefined}>
                          <span className="pl-rank__n">{r.name}</span>
                          <span className="pl-rank__bar" style={{ "--w": r.w } as CSSProperties} aria-hidden="true" />
                          <b>{r.v}</b>
                        </li>
                      ))}
                    </ol>
                    <p className="pl-body">{an.rankLine}</p>
                    {an.hasNotes && (
                      <>
                        <button type="button" className="vd-more__btn pl-more" onClick={() => props.onUi({ anNotes: !st.anNotes })} aria-expanded={an.notesOpen}>
                          {an.notesBtn}
                          <Ic name="expand" className="" />
                        </button>
                        {an.notesOpen && <p className="pl-note pl-annotes">{an.notes}</p>}
                      </>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <p className="pl-empty pl-empty--l">{an.noneText}</p>
            ))}

          {sec === "cromo" && (
            <div className="pl-cromowrap">
              <div className={`pl-cromo ${cr.cls}`} key={`run${st.run}`}>
                <div className="pl-cromo__in">
                  <div className="pl-cromo__face pl-cromo__front" aria-hidden={cr.flip}>
                    <span className="pl-cromo__intro" aria-hidden="true">
                      <span className="pl-cromo__type">Con el dorsal…</span>
                      <b>{hero.n}</b>
                    </span>
                    <span className="pl-cromo__foil" aria-hidden="true" />
                    <span className="pl-cromo__top">
                      <b>{hero.n}</b>
                      <span>{cr.historic ? `${cr.pos} · Histórico` : cr.pos}</span>
                    </span>
                    {props.photo ? (
                      <span className="pl-shirt pl-cromo__shirt pl-cromo__photo" aria-hidden="true">
                        <img src={props.photo} alt="" />
                      </span>
                    ) : (
                      <Shirt kit={kit} num={hero.n} className="pl-cromo__shirt" />
                    )}
                    <span className="pl-cromo__plate">
                      <b>{cr.plate}</b>
                      {cr.badges.length > 0 && (
                        <span className="pl-cromo__badges">
                          {cr.badges.map((b) => (
                            <i key={b.t} className={b.cls || undefined}>
                              {b.t}
                            </i>
                          ))}
                        </span>
                      )}
                      <span className="pl-cromo__line">{cr.line}</span>
                    </span>
                  </div>
                  <div className="pl-cromo__face pl-cromo__back" aria-hidden={!cr.flip}>
                    <span className="pl-cromo__period">{cr.period}</span>
                    <dl className="pl-cromo__tiles">
                      {cr.tiles.map((t) => (
                        <div key={t.a}>
                          <dt>{t.a}</dt>
                          <dd>{t.b}</dd>
                        </div>
                      ))}
                    </dl>
                    <span className="pl-cromo__crest">
                      <img src="/crest-128.webp" alt="" width={24} height={24} />
                      <span>Manchester Piti</span>
                    </span>
                  </div>
                </div>
              </div>
              <div className="pl-cromo__side">
                <h2 className="pl-h3">Su cromo</h2>
                <p className="pl-body">{cr.alt}</p>
                <div className="pl-cromo__btns">
                  <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm" onClick={() => props.onUi({ flip: !st.flip })} aria-pressed={cr.flip}>
                    <Ic name="swap" />
                    {cr.flipLabel}
                  </button>
                  <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm" onClick={() => props.onUi({ flip: false, run: st.run + 1 })}>
                    <Ic name="play" />
                    Repetir presentación
                  </button>
                  <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm vd-btn--pri" onClick={props.onShare}>
                    <Ic name="share" />
                    Compartir perfil
                  </button>
                </div>
                <p className={`pl-albline${cr.albCls ? ` ${cr.albCls}` : ""}`}>{cr.album}</p>
                {cr.albumLink && (
                  <button type="button" className="vd-link pl-linkbtn" onClick={props.onAlbum}>
                    Ver mi álbum
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        <nav className="pl-secnav" aria-label="Sección anterior y siguiente">
          <button type="button" className="vd-link pl-linkbtn" onClick={() => props.onStep(-1)}>
            ‹ {SEC_LABEL[secNav.prev]}
          </button>
          <span className="pl-secnav__hint">Desliza para cambiar de sección</span>
          <button type="button" className="vd-link pl-linkbtn" onClick={() => props.onStep(1)}>
            {SEC_LABEL[secNav.next]} ›
          </button>
        </nav>
      </div>
    </div>
  );
}

