// «El siete» once the acta is published (the «Notas del partido» board, approved 2026-10-26): the match with every
// nota on Sofascore's traffic light. «Quién hizo qué»: the pitch (the starting seven at rest, «Empezó · Acabó», or
// the moviola's minute: every shirt walks on, off and across when a recolocación moves it), who came off the bench,
// and the changes minute by minute with the score — a tap takes the moviola there, the list follows the moviola.
// «Las notas»: everyone on one axis and in order. «Los minutos»: each one's stretches, spot by spot. A player opens
// his ficha: a sheet that rises on the phone (drag it down, Esc or tap outside to close) and a column beside the
// pitch on a big screen; its address is ?ficha=, so Back closes it. The logic is pure in sieteActaModel.ts.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as RPointerEvent } from "react";
import { createPortal, flushSync } from "react-dom";
import { useLocation, useRouter } from "@tanstack/react-router";
import { dateMillis, isVisibleMatch, type Participation } from "../../../../functions/src/matchEngine";
import { useReducedMotion } from "../../../components/vidrio";
import { jornadaOf } from "../../../lib/derived/jornada";
import { PROVISIONAL_MINUTES } from "../../../lib/rating/constants";
import { matchValue } from "../../../lib/rating/values";
import { NO_STANDINGS, ratingMatches, seasonRatings } from "../../../lib/seasonRating";
import { useStandings } from "../../../lib/useStandings";
import { mvpWinners, voteLeft } from "../../../lib/vestuario";
import type { PageCtx } from "./ctx";
import { Go, Icon, Tee } from "./bits";
import { TagGlyph } from "./sieteBits";
import { actaPlayers, benchRows, cambiosRows, cambiosSub, fichaOf, headOf, pitchOrder, rankRows, seasonLineOf, shiftRows, swarmOf, tokensAt, type MarkView, type SeasonGame } from "./sieteActaModel";
import "./siete-acta.css";

type View = "quien" | "notas" | "min";
const VIEWS: { id: View; t: string }[] = [
  { id: "quien", t: "Quién hizo qué" },
  { id: "notas", t: "Las notas" },
  { id: "min", t: "Los minutos" },
];
const viewOf = (v: unknown): View => (v === "notas" ? "notas" : typeof v === "string" && /^min/.test(v) ? "min" : "quien");
/** From this width of the place the ficha is a column beside the pitch, not a sheet (siete-acta.css @container 1000px). */
const DESK = 1000;
const STAR = "m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z";

function Marks({ marks, className }: { marks: readonly MarkView[]; className: string }) {
  return (
    <span className={`vd-tags ${className}`} aria-hidden="true">
      {marks.map((k) => (
        <span key={k.key} className={`vd-tag ${k.cls}`}>
          <TagGlyph k={k.k} />
          {k.text}
        </span>
      ))}
    </span>
  );
}

/** The nota as a badge: the figure always printed, the word for whoever can't see the colour. */
function Nota({ txt, band, word, size }: { txt: string; band: string; word?: string; size?: "sm" | "lg" | "hero" }) {
  return (
    <span className={`nb nb--${band}${size ? ` nb--${size}` : ""}`} aria-hidden={word ? undefined : true} role={word ? "img" : undefined} aria-label={word}>
      {txt}
    </span>
  );
}

export function SieteActa({ c }: { c: PageCtx }) {
  const { match, duration: D, plays, tl, lineup } = c;
  const router = useRouter();
  const loc = useLocation();
  const search = loc.search as Record<string, unknown>;
  const reduced = useReducedMotion();

  // ---- the reads: the season's actas and its table (the notas are frozen with each acta; one without them is rated
  // here the same way), this match's values (what every action was worth), the MVP once the vote has closed
  const { standings } = useStandings(match.seasonId);
  const seasonGames = useMemo(
    () => c.matches.filter((m) => isVisibleMatch(m) && !!match.seasonId && m.seasonId === match.seasonId && m.status !== "cancelled").sort((a, b) => dateMillis(a.date) - dateMillis(b.date)),
    [c.matches, match.seasonId],
  );
  const ratings = useMemo(() => seasonRatings(ratingMatches(seasonGames), standings ? [standings] : NO_STANDINGS), [seasonGames, standings]);
  const values = useMemo(() => matchValue(match), [match]);
  const mvpIds = useMemo(() => mvpWinners(match, c.mvp, c.now), [match, c.mvp, c.now]);
  const ledger = (match.ledger as Record<string, Participation> | undefined) ?? null;
  const P = useMemo(
    () => actaPlayers({ lineup, stints: tl.stints, posSegs: tl.posSegs, ledger, people: c.people, viewer: c.viewer, captain: c.captain, mvpIds, notaOf: (id) => ratings.noteOf(match.id, id)?.nota ?? null, values, duration: D }),
    [lineup, tl, ledger, c.people, c.viewer, c.captain, mvpIds, ratings, match.id, values, D],
  );
  const byId = useMemo(() => new Map(P.map((p) => [p.id, p])), [P]);
  const games = useMemo<SeasonGame[]>(
    () => seasonGames.map((g) => ({ id: g.id, date: dateMillis(g.date), rival: g.rival || "Rival", jornada: jornadaOf(c.matches, g.id), finished: g.status === "finished", playedBy: (id: string) => !!g.ledger?.[id]?.played })),
    [seasonGames, c.matches],
  );
  const published = lineup.published;

  // ---- the place's width: from DESK the ficha is a column (and a change shows on the pitch as you pass it)
  const rootRef = useRef<HTMLElement | null>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const read = () => setWidth((w) => (Math.abs(el.getBoundingClientRect().width - w) > 2 ? el.getBoundingClientRect().width : w));
    read();
    if (typeof ResizeObserver !== "function") return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const wide = width >= DESK;
  // (a column stays in view below the page's sticky strip: the strip's tallest height, the moviola in it, sets where)
  useEffect(() => {
    const strip = document.querySelector<HTMLElement>(".pp-tabs");
    const el = rootRef.current;
    if (!strip || !el || typeof ResizeObserver !== "function") return;
    let top = 0;
    let wide0 = 0;
    const read = () => {
      const h = strip.offsetHeight;
      // (a new width starts over; at the same width only a taller strip — the moviola folding in — moves it)
      if (strip.offsetWidth !== wide0) {
        wide0 = strip.offsetWidth;
        top = 0;
      }
      if (h <= top) return;
      top = h;
      el.style.setProperty("--sn-top", `${h + 12}px`);
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(strip);
    return () => ro.disconnect();
  }, []);
  // (the phone's sheet, its scrim and the way back to the list are fixed to the screen: a container (.pp-place) is
  // their containing block, so they live on the page's root instead)
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost((rootRef.current?.closest(".pp") as HTMLElement | null) ?? document.body), []);
  const [canHover, setCanHover] = useState(false);
  useEffect(() => setCanHover(typeof window.matchMedia === "function" && window.matchMedia("(hover: hover) and (pointer: fine)").matches), []);

  // ---- timers
  const timers = useRef<Record<string, number>>({});
  const later = (key: string, fn: () => void, ms: number) => {
    window.clearTimeout(timers.current[key]);
    timers.current[key] = window.setTimeout(fn, ms);
  };
  useEffect(() => () => Object.values(timers.current).forEach((t) => window.clearTimeout(t)), []);

  // ---- a change of layout on a big screen glides (View Transitions); the screen around it only cross-fades
  const withVT = (update: () => void) => {
    const doc = document as Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } };
    if (!wide || reduced || typeof doc.startViewTransition !== "function") {
      update();
      return;
    }
    let done = false;
    const run = () => {
      if (done) return;
      done = true;
      flushSync(update);
    };
    const root = document.documentElement;
    root.dataset.snVt = "";
    try {
      const vt = doc.startViewTransition(run);
      void vt.finished.catch(() => undefined).finally(() => delete root.dataset.snVt);
      // (a page that isn't painting never runs the transition: the change must not wait for it)
      later("vt", run, 350);
    } catch {
      delete root.dataset.snVt;
      run();
    }
  };

  // ---- the address: the ficha (?ficha=, Back closes it) and the view (?vista=)
  const hrefWith = (patch: Record<string, string | null>) => {
    const q = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) q.delete(k);
      else q.set(k, v);
    }
    const s = q.toString();
    return `${window.location.pathname}${s ? `?${s}` : ""}`;
  };
  const urlFicha = typeof search.ficha === "string" && byId.has(search.ficha) ? search.ficha : null;
  const [sel, setSel] = useState<string | null>(urlFicha);
  const [view, setViewState] = useState<View>(() => viewOf(search.vista));
  const [closing, setClosing] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const pushed = useRef(false);
  const closingRef = useRef(false);
  const opener = useRef<HTMLElement | null>(null);
  const cardRef = useRef<HTMLElement | null>(null);
  const cardScroll = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const sheet = !!sel && !wide && !!host;

  const openCard = (id: string) => {
    if (!byId.has(id)) return;
    if (!sel) opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closingRef.current = false;
    const apply = () => {
      window.clearTimeout(timers.current.close);
      setClosing(false);
      setDragY(0);
      setSel(id);
    };
    if (!sel) withVT(apply);
    else apply();
    if (urlFicha === id) return;
    if (urlFicha) void router.navigate({ href: hrefWith({ ficha: id }), replace: true, resetScroll: false });
    else {
      pushed.current = true;
      void router.navigate({ href: hrefWith({ ficha: id }), resetScroll: false });
    }
  };
  const closeCard = (after?: () => void, fromUrl = false) => {
    if (!sel || closingRef.current) return;
    closingRef.current = true;
    const finish = () => {
      closingRef.current = false;
      setSel(null);
      setClosing(false);
      setDragY(0);
      setDragging(false);
      after?.();
    };
    if (wide) withVT(finish);
    else {
      setClosing(true);
      later("close", finish, reduced ? 10 : 320);
    }
    if (fromUrl || !urlFicha) return;
    if (pushed.current) {
      pushed.current = false;
      router.history.back();
    } else void router.navigate({ href: hrefWith({ ficha: null }), replace: true, resetScroll: false });
  };
  // the address moved (Back, forward, a shared link): the ficha follows it
  const lastUrl = useRef(urlFicha);
  useEffect(() => {
    if (urlFicha === lastUrl.current) return;
    lastUrl.current = urlFicha;
    if (urlFicha && urlFicha !== sel) openCard(urlFicha);
    else if (!urlFicha && sel) closeCard(undefined, true);
    // oxlint-disable-next-line react/exhaustive-deps -- only the address drives this: the ficha's own state is read as it is then
  }, [urlFicha]);
  const setView = (v: View, focus?: number) => {
    if (v === view) return;
    withVT(() => {
      setViewState(v);
      setPreview(null);
    });
    void router.navigate({ href: hrefWith({ vista: v === "quien" ? null : v }), replace: true, resetScroll: false });
    if (focus !== undefined) requestAnimationFrame(() => segRefs.current[focus]?.focus());
  };
  const segRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // the ficha opens on its name, and each one starts at its top; closed, the focus goes back where it was (once the
  // page behind the sheet is no longer inert)
  const prevSel = useRef<string | null>(null);
  useEffect(() => {
    const was = prevSel.current;
    prevSel.current = sel;
    if (!sel) {
      const o = opener.current;
      opener.current = null;
      if (was && o && document.contains(o)) o.focus({ preventScroll: true });
      return;
    }
    if (cardScroll.current) cardScroll.current.scrollTop = 0;
    if (!was) requestAnimationFrame(() => titleRef.current?.focus({ preventScroll: true }));
  }, [sel]);
  // the phone's sheet holds the page still behind it
  useEffect(() => {
    if (!sheet) return;
    const root = document.documentElement;
    root.classList.add("sn-lock");
    return () => root.classList.remove("sn-lock");
  }, [sheet]);

  // ---- the minute the pitch shows: the moviola's while it is held back, else the rest: the starting seven
  // («Empezó») or the final one («Acabó»); a change in the list previews its minute while the pointer is on it
  const [rest, setRest] = useState<"start" | "end">("start");
  const [preview, setPreview] = useState<number | null>(null);
  const toStart = useRef(false);
  const wasDragged = useRef(c.dragged);
  useEffect(() => {
    // (the moviola let go at the end — dragged there, played through — shows how it ended)
    if (wasDragged.current && !c.dragged) setRest(toStart.current ? "start" : "end");
    toStart.current = false;
    wasDragged.current = c.dragged;
  }, [c.dragged]);
  const M = preview ?? (c.dragged ? c.minute : rest === "start" ? 0 : D);
  const atRest = preview === null && !c.dragged;
  const goStart = () => {
    setRest("start");
    if (c.dragged) {
      toStart.current = true;
      c.seek(c.edge);
    }
  };
  const goEnd = () => {
    setRest("end");
    if (c.dragged) c.seek(c.edge);
  };

  // who moved and who came in while the pitch went from one minute to the next (a short step: dragging, playing)
  const [motion, setMotion] = useState<{ moved: string[]; entered: string[]; fast: boolean }>({ moved: [], entered: [], fast: false });
  const lastM = useRef(M);
  useLayoutEffect(() => {
    const from = lastM.current;
    lastM.current = M;
    if (from === M) return;
    const near = Math.abs(M - from) <= 3;
    const a = tl.onPitchAt(from);
    const b = tl.onPitchAt(M);
    const where = new Map(a.map((s) => [s.id, `${s.x},${s.y}`]));
    const moved = near ? b.filter((s) => where.has(s.id) && where.get(s.id) !== `${s.x},${s.y}`).map((s) => s.id) : [];
    const entered = near ? b.filter((s) => !where.has(s.id)).map((s) => s.id) : [];
    setMotion({ moved, entered, fast: !near || preview !== null });
    later("motion", () => setMotion((x) => (x.moved.length || x.entered.length ? { ...x, moved: [], entered: [] } : x)), 1400);
    // oxlint-disable-next-line react/exhaustive-deps -- a new minute (or a new walk) is the only cause; the preview is read as it is then
  }, [M, tl]);

  // ---- the views' content
  const all = atRest && rest === "start";
  const tokens = useMemo(() => tokensAt(P, tl.onPitchAt, M, D, plays, all, published), [P, tl, M, D, plays, all, published]);
  const order = useMemo(() => pitchOrder(tl.onPitchAt(M)), [tl, M]);
  const [focusTok, setFocusTok] = useState<string | null>(null);
  const tabTok = focusTok && order.includes(focusTok) ? focusTok : order[0];
  const tokRefs = useRef(new Map<string, HTMLButtonElement | null>());
  const onTokKey = (id: string, e: KeyboardEvent<HTMLButtonElement>) => {
    const d = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number>)[e.key];
    if (!d) return;
    e.preventDefault();
    const n = order[(order.indexOf(id) + d + order.length) % order.length];
    setFocusTok(n);
    tokRefs.current.get(n)?.focus();
  };
  const bench = useMemo(() => benchRows(P, plays, D), [P, plays, D]);
  const unused = lineup.bench.filter((id) => !byId.has(id)).map((id) => c.people.get(id)?.name ?? "Jugador");
  const [filter, setFilter] = useState<string | null>(null);
  const halfScore = useMemo(() => {
    let us = 0;
    let them = 0;
    for (const p of plays) {
      if (p.m > D / 2) break;
      if (p.k === "gol") us++;
      if (p.k === "rival") them++;
    }
    return `${us}–${them}`;
  }, [plays, D]);
  const camRows = useMemo(
    () => cambiosRows({ groups: tl.groups, P, follow: c.dragged ? c.minute : null, filter, sel, halfScore, duration: D, published }),
    [tl.groups, P, c.dragged, c.minute, filter, sel, halfScore, D, published],
  );
  const hasActa = !!ledger && Object.keys(ledger).length > 0;
  const camSub = hasActa ? cambiosSub(tl.groups, filter, (id) => byId.get(id)?.name ?? "Jugador") : "El acta de este partido no guarda los cambios.";
  const ranked = useMemo(() => rankRows(P, D), [P, D]);
  const swarmW = Math.max(280, wide && sel ? width - 460 : width);
  const swarm = useMemo(() => swarmOf(P, (36 / swarmW) * 100), [P, swarmW]);
  const shifts = useMemo(() => shiftRows(P, plays, D, published), [P, plays, D, published]);

  // ---- the ficha
  const stepOrder = view === "notas" ? ranked.map((r) => r.id) : P.map((p) => p.id);
  const step = (dir: 1 | -1) => {
    if (!sel) return;
    const i = stepOrder.indexOf(sel);
    const n = stepOrder[(i + dir + stepOrder.length) % stepOrder.length];
    setSel(n);
    void router.navigate({ href: hrefWith({ ficha: n }), replace: true, resetScroll: false });
  };
  const fp = sel ? byId.get(sel) : undefined;
  const card = useMemo(() => {
    if (!fp) return null;
    const notes = ratings.players.get(fp.id)?.notes ?? [];
    return fichaOf({
      p: fp,
      groups: tl.groups,
      values,
      season: fp.guest ? null : seasonLineOf(fp.id, match.id, notes, games),
      duration: D,
      published,
      positionsPlayed: (ledger?.[fp.id]?.positionsPlayed as Partial<Record<string, number>> | undefined) ?? null,
      provisionalMinutes: PROVISIONAL_MINUTES,
    });
  }, [fp, ratings, tl.groups, values, match.id, games, D, published, ledger]);
  const neighbour = (dir: 1 | -1) => {
    if (!sel) return "";
    const i = stepOrder.indexOf(sel);
    return byId.get(stepOrder[(i + dir + stepOrder.length) % stepOrder.length])?.name ?? "";
  };
  const copyLink = () => {
    if (!card) return;
    const url = `${window.location.origin}${c.base}/siete?ficha=${encodeURIComponent(card.id)}`;
    void navigator.clipboard?.writeText(url).catch(() => undefined);
    c.say(`Enlace a la ficha de ${card.name} copiado`);
  };
  const camRef = useRef<HTMLElement | null>(null);
  const pitchRef = useRef<HTMLDivElement | null>(null);
  /** The sticky strip's bottom: where content scrolled to sits below it. */
  const stickyTop = () => (document.querySelector(".pp-tabs")?.getBoundingClientRect().bottom ?? 0) + 12;
  const scrollToEl = (el: Element | null) => {
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - stickyTop();
    window.scrollTo({ top: Math.max(0, top), behavior: reduced ? "auto" : "smooth" });
  };
  const seeChanges = () => {
    if (!sel) return;
    const id = sel;
    const go = () => {
      flushSync(() => {
        setFilter(id);
        setViewState("quien");
      });
      if (wide) camRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "nearest" });
      else scrollToEl(camRef.current);
    };
    if (view !== "quien") void router.navigate({ href: hrefWith({ vista: null }), replace: true, resetScroll: false });
    if (wide) go();
    else closeCard(go);
  };
  const onCardKey = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeCard();
      return;
    }
    const tag = (e.target as HTMLElement).tagName;
    if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && tag !== "INPUT" && tag !== "TEXTAREA") {
      e.preventDefault();
      step(e.key === "ArrowLeft" ? -1 : 1);
      return;
    }
    if (e.key === "Tab" && sheet && cardRef.current) {
      const f = cardRef.current.querySelectorAll<HTMLElement>('button:not([disabled]):not([tabindex="-1"]), a[href]');
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };
  // drag the sheet down by its handle to close it
  const drag = useRef<{ y0: number } | null>(null);
  const gDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (wide) return;
    drag.current = { y0: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    setDragY(0);
  };
  const gMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (drag.current) setDragY(Math.max(0, e.clientY - drag.current.y0));
  };
  const gUp = (e: RPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const dy = Math.max(0, e.clientY - drag.current.y0);
    drag.current = null;
    setDragging(false);
    if (dy > 90) closeCard();
    else setDragY(0);
  };

  // ---- a change takes the moviola to its minute (the pitch replays it); on the phone the page glides up to the pitch
  // and a pill offers the way back to the list
  const [back, setBack] = useState<number | null>(null);
  /** The glide up to the pitch: its scroll is not the reader going back to the list. */
  const quiet = useRef(false);
  const goTo = (m: number, f: number) => {
    setPreview(null);
    let wait = 0;
    if (!wide && pitchRef.current) {
      quiet.current = true;
      later("quiet", () => void (quiet.current = false), 1500);
      scrollToEl(pitchRef.current);
      wait = reduced ? 0 : 420;
      setBack(m);
    }
    if (reduced || f <= 0) {
      c.seek(m);
      return;
    }
    later("goPre", () => c.seek(Math.max(0, f - 1)), wait);
    later("go", () => c.seek(m), wait + 560);
  };
  const backToList = () => {
    const m = back;
    setBack(null);
    scrollToEl(camRef.current?.querySelector(`[data-m="${m}"]`) ?? camRef.current);
  };
  useEffect(() => {
    if (back === null) return;
    let raf = 0;
    const onScroll = () => {
      if (raf || quiet.current) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const top = camRef.current?.getBoundingClientRect().top;
        if (top !== undefined && top < window.innerHeight - 220) setBack(null);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [back]);

  // ---- the head
  const R = c.result;
  const scoreAtM = useMemo(() => {
    let us = 0;
    let them = 0;
    for (const p of plays) {
      if (p.m > M) break;
      if (p.k === "gol") us++;
      if (p.k === "rival") them++;
    }
    return `${us}–${them}`;
  }, [plays, M]);
  const head = headOf({
    view,
    minute: M,
    rest: atRest ? rest : null,
    verb: R.verb,
    dash: R.dash,
    mvpNames: mvpIds.map((id) => byId.get(id)?.name ?? c.nameOf(id)),
    played: P.length,
    groups: tl.groups,
    scoreAt: scoreAtM,
  });
  const mvpWait = c.fase === "acta" ? (c.viewer.member ? `El MVP se vota en el vestuario${typeof match.voteClosesAt === "number" ? `: cierra en ${voteLeft(match.voteClosesAt, c.now)}` : ""}.` : "El MVP sale cuando cierre la votación del vestuario.") : "";
  const viewI = VIEWS.findIndex((v) => v.id === view);
  const segKey = (i: number, e: KeyboardEvent<HTMLButtonElement>) => {
    const d = ({ ArrowRight: 1, ArrowLeft: -1 } as Record<string, number>)[e.key];
    if (!d) return;
    e.preventDefault();
    const n = (i + d + VIEWS.length) % VIEWS.length;
    setView(VIEWS[n].id, n);
  };

  const open = (id: string) => () => openCard(id);
  const bodyCls = ["sn-body", `v-${view}`, sel ? "has-card" : ""].filter(Boolean).join(" ");
  const cardCls = ["vd-glass", "vd-glass--deep", "sn-card", sel ? "is-on" : "", closing ? "is-closing" : "", dragging ? "is-drag" : ""].filter(Boolean).join(" ");
  const bg = sheet || undefined;

  const scrimEl = <button type="button" className={`sn-scrim${closing ? " is-closing" : ""}`} tabIndex={-1} aria-hidden="true" onClick={() => closeCard()} />;
  const backEl = (
        <button type="button" className="vd-glass vd-press sn-backpill" onClick={backToList}>
          <svg viewBox="0 0 24 24" className="sn-ic" aria-hidden="true">
            <path d="M12 5v14m6-6-6 6-6-6" />
          </svg>
          Volver a los cambios
        </button>
  );
  const cardEl = (
        <section
          ref={cardRef}
          className={`${cardCls}${wide ? "" : " is-sheet"}`}
          role={wide ? "region" : "dialog"}
          aria-modal={sheet || undefined}
          aria-labelledby={card ? "sn-card-t" : undefined}
          aria-hidden={!card || undefined}
          onKeyDown={onCardKey}
          style={!wide && (dragging || dragY) ? { transform: `translateY(${dragY}px)` } : undefined}
          data-scroll-x=""
        >
          {card && (
            <>
              <div className="sn-card__grab" onPointerDown={gDown} onPointerMove={gMove} onPointerUp={gUp} onPointerCancel={gUp} aria-hidden="true">
                <i />
              </div>
              <div className="sn-card__sc" ref={cardScroll}>
                <div className="sn-card__hd">
                  <p className="sn-card__k">{card.kicker}</p>
                  <div className="sn-card__nav">
                    <button type="button" className="vd-glass vd-press vd-ibtn sn-ib" onClick={() => step(-1)} aria-label={`Anterior: ${neighbour(-1)}`}>
                      <Icon name="chev-l" />
                    </button>
                    <button type="button" className="vd-glass vd-press vd-ibtn sn-ib" onClick={() => step(1)} aria-label={`Siguiente: ${neighbour(1)}`}>
                      <Icon name="chev-r" />
                    </button>
                    <button type="button" className="vd-glass vd-press vd-ibtn sn-ib" onClick={copyLink} aria-label="Copiar el enlace a esta ficha">
                      <Icon name="link" />
                    </button>
                    <button type="button" className="vd-glass vd-press vd-ibtn sn-ib" onClick={() => closeCard()} aria-label={card.closeLabel}>
                      <Icon name="close" />
                    </button>
                  </div>
                </div>
                <div className="sn-card__who">
                  <Tee kit={c.kit} num={card.num} className="sn-card__tee" />
                  <div>
                    <h3 id="sn-card-t" tabIndex={-1} ref={titleRef}>
                      {card.name}
                      {card.me && <span className="sn-me">Tú</span>}
                      {card.mvp && (
                        <span className="vd-tag vd-tag--gold">
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d={STAR} fill="currentColor" />
                          </svg>
                          MVP
                        </span>
                      )}
                    </h3>
                    <p className="sn-card__meta">{card.meta}</p>
                  </div>
                </div>
                <div className={`sn-hero nb--${card.band}`}>
                  <Nota txt={card.nota} band={card.band} word={card.notaLabel} size="hero" />
                  <div className="sn-hero__t">
                    <b>{card.hasNota ? card.word : "Sin nota"}</b>
                    <span>{card.hasNota ? "Su nota del partido, de 0 a 10." : "La nota sale de 10 minutos jugados."}</span>
                    <span>{card.lineText}</span>
                  </div>
                </div>
                <section className="sn-cs">
                  <h4>En el partido</h4>
                  <dl className="sn-cnt">
                    {card.counts.map((k) => (
                      <div key={k.l}>
                        <dt>{k.l}</dt>
                        <dd>
                          {k.v}
                          {k.s && <small>{k.s}</small>}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
                <section className="sn-cs">
                  <h4>Dónde jugó</h4>
                  {card.segs.length > 0 && (
                    <div>
                      <div className="sn-wh" role="img" aria-label={card.whereLabel}>
                        <i className="sn-tr__half" />
                        {card.segs.map((s) => (
                          <i key={s.key} className={`sn-tr__seg ${s.cls}`} style={{ left: `${s.l}%`, width: `${s.w}%` }}>
                            {s.code && <em>{s.code}</em>}
                          </i>
                        ))}
                      </div>
                      <div className="sn-wh__ax" aria-hidden="true">
                        <span>0′</span>
                        <span>Descanso</span>
                        <span>{D}′</span>
                      </div>
                    </div>
                  )}
                  {card.where.length > 0 && (
                    <ul className="sn-whl">
                      {card.where.map((w) => (
                        <li key={w.name}>
                          <b>{w.name}</b>
                          <span>{w.min}′</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {card.whereNote && <p className="sn-small">{card.whereNote}</p>}
                  {hasActa && (
                    <div>
                      <button type="button" className="vd-link" onClick={seeChanges}>
                        {card.chLink}
                      </button>
                    </div>
                  )}
                </section>
                {!card.guest && (
                  <section className="sn-cs">
                    <h4>Su temporada</h4>
                    <div className="sn-seas">
                      <div className="sn-big">
                        <b>{card.gl}</b>
                        <span>GLOBAL</span>
                      </div>
                      <div className="sn-big">
                        <b>{card.fo}</b>
                        <span>FOR</span>
                      </div>
                      {card.seasNote && <p className="sn-small">{card.seasNote}</p>}
                    </div>
                    {card.jj.length > 0 && (
                      <ol className="sn-jj" aria-label="Sus notas, jornada a jornada">
                        {card.jj.map((j) => (
                          <li key={j.key} className={j.cls} aria-label={j.label}>
                            <span className={`nb nb--${j.band}`} aria-hidden="true">
                              {j.nota}
                            </span>
                            <b aria-hidden="true">{j.j}</b>
                            <span aria-hidden="true">{j.rival}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </section>
                )}
                {card.groups.length > 0 && (
                  <section className="sn-cs">
                    <h4>De dónde sale</h4>
                    <p className="sn-small">Lo que sumaron y restaron sus acciones, en goles. Su nota compara ese total, cada 50 minutos, {card.lineShort}.</p>
                    <ul className="sn-src">
                      {card.groups.map((g) => (
                        <li key={g.key}>
                          <div className="sn-src__h">
                            <b>{g.name}</b>
                            <span className="sn-src__bar" aria-hidden="true">
                              <i className={g.dir} style={{ width: `${g.w}%` }} />
                            </span>
                            <span className="sn-src__v">{g.v}</span>
                          </div>
                          <p className="sn-src__it">{g.items}</p>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                {card.href && (
                  <div className="sn-card__ft">
                    <Go className="vd-glass vd-press vd-btn vd-btn--sm" href={card.href}>
                      {card.go}
                      <Icon name="chev-r" />
                    </Go>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
  );

  return (
    <section ref={rootRef} className={`pp-place pp-place--siete sn${sheet ? " has-sheet" : ""}`} aria-labelledby="sn-h">
      <header className="pp-place__head sn-head" inert={bg}>
        <div>
          <h2 id="sn-h">{head.h}</h2>
          <p aria-live="polite">{head.sub}</p>
        </div>
        <div className="vd-glass vd-seg sn-views" role="radiogroup" aria-label="Cómo ver a los del partido" style={{ "--n": 3, "--i": viewI } as CSSProperties}>
          <span className="vd-shelf__bead" aria-hidden="true" />
          {VIEWS.map((v, i) => (
            <button key={v.id} type="button" role="radio" ref={(el) => void (segRefs.current[i] = el)} aria-checked={view === v.id} tabIndex={view === v.id ? 0 : -1} className="vd-seg__b" onClick={() => setView(v.id)} onKeyDown={(e) => segKey(i, e)}>
              {v.t}
            </button>
          ))}
        </div>
      </header>
      {mvpWait && (
        <p className="sn-mvp" inert={bg}>
          <Icon name="star" />
          <span>{mvpWait}</span>
          {c.viewer.member && (
            <button type="button" className="vd-link" onClick={() => c.go("vestuario")}>
              Votar al MVP
            </button>
          )}
        </p>
      )}

      <div className={bodyCls}>
        {view === "quien" && (
          <>
            <div className="sn-pitchcol" inert={bg}>
              <div className="sn-ends">
                <div className={`vd-glass vd-seg sn-endseg${atRest ? "" : " is-mid"}`} role="group" aria-label="El siete al empezar o al acabar" style={{ "--n": 2, "--i": rest === "end" ? 1 : 0 } as CSSProperties}>
                  <span className="vd-shelf__bead" aria-hidden="true" />
                  <button type="button" className="vd-seg__b" aria-pressed={atRest && rest === "start"} onClick={goStart}>
                    Empezó
                  </button>
                  <button type="button" className="vd-seg__b" aria-pressed={atRest && rest === "end"} onClick={goEnd}>
                    Acabó
                  </button>
                </div>
                {!atRest && preview === null && (
                  <p className="sn-ends__now">
                    <b className="vd-clock">{M}′</b>
                    {` · ${scoreAtM}`}
                  </p>
                )}
              </div>
              <div ref={pitchRef} className={`vd-pitch sn-pitch${preview !== null ? " is-preview" : ""}${motion.fast ? " is-fast" : ""}`}>
                <svg className="vd-pitch__lines" viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden="true">
                  <rect x="4" y="3" width="92" height="134" rx="1" />
                  <line x1="4" y1="70" x2="96" y2="70" />
                  <circle cx="50" cy="70" r="11" />
                  <rect x="26" y="3" width="48" height="17" />
                  <rect x="26" y="120" width="48" height="17" />
                </svg>
                {preview !== null && <span className="sn-pv">Vista previa · minuto {preview}</span>}
                <ul className="sn-toks" aria-label={preview !== null ? `Vista previa del minuto ${preview}` : atRest ? (rest === "start" ? "El siete inicial" : "Los siete al final") : `Los siete en el minuto ${M}`}>
                  {tokens.map((t) => (
                    <li
                      key={t.id}
                      className={["sn-tok", t.on ? "" : "is-off", sel === t.id ? "is-sel" : "", motion.moved.includes(t.id) ? "is-moved" : "", motion.entered.includes(t.id) ? "is-in" : ""].filter(Boolean).join(" ")}
                      style={{ left: `${t.left}%`, top: `${t.top}%` }}
                      aria-hidden={!t.on || undefined}
                    >
                      <button
                        type="button"
                        className="sn-tok__b"
                        tabIndex={t.on && t.id === tabTok ? 0 : -1}
                        aria-label={t.label}
                        aria-pressed={sel === t.id}
                        onClick={open(t.id)}
                        onKeyDown={(e) => onTokKey(t.id, e)}
                        onFocus={() => setFocusTok(t.id)}
                        ref={(el) => void tokRefs.current.set(t.id, el)}
                      >
                        <Tee kit={c.kit} num={t.num} className="sn-tee" />
                        <span className="sn-tok__nm" aria-hidden="true">
                          {t.me && <i className="sn-tok__me">Tú</i>}
                          <span className="vd-player__name">{t.short}</span>
                        </span>
                      </button>
                      <span className={`nb nb--${t.band} sn-tok__nb`} aria-hidden="true">
                        {t.nota}
                      </span>
                      {t.mvp && (
                        <span className="sn-tok__mvp" aria-hidden="true">
                          <svg viewBox="0 0 24 24">
                            <path d={STAR} fill="currentColor" />
                          </svg>
                        </span>
                      )}
                      {t.cap && (
                        <span className="sn-tok__cap" aria-hidden="true">
                          C
                        </span>
                      )}
                      {t.marks.length > 0 && <Marks marks={t.marks} className={`sn-tok__tags${t.side ? " is-side" : ""}`} />}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="sn-hint">{wide && canHover ? "Toca a un jugador para abrir su ficha. Pasa el ratón por un cambio para verlo en el campo; tócalo y la moviola va a ese minuto." : "Toca a un jugador para abrir su ficha. Toca un cambio y la moviola va a ese minuto."}</p>
            </div>

            <section className="sn-sec sn-banq" aria-labelledby="sn-banq-t" inert={bg}>
              <h3 className="sn-k" id="sn-banq-t">
                Desde el banquillo
              </h3>
              {bench.length > 0 ? (
                <ul className="sn-rows">
                  {bench.map((b) => (
                    <li key={b.id}>
                      <button type="button" className={`sn-row${sel === b.id ? " is-on" : ""}`} onClick={open(b.id)} aria-label={b.label} aria-pressed={sel === b.id}>
                        <Tee kit={c.kit} num={b.num} className="sn-row__tee" />
                        <span className="sn-row__t" aria-hidden="true">
                          <b>{b.name}</b>
                          {b.marks.length > 0 && <Marks marks={b.marks} className="sn-row__tags" />}
                        </span>
                        <span className={`nb nb--lg nb--${b.band}`} aria-hidden="true">
                          {b.nota}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="sn-sub">Nadie salió del banquillo: jugaron los siete todo el partido.</p>
              )}
              {unused.length > 0 && <p className="sn-sub sn-unused">Sin jugar: {unused.length < 2 ? unused[0] : `${unused.slice(0, -1).join(", ")} y ${unused.at(-1)}`}.</p>}
            </section>

            <section className="sn-sec sn-cam" aria-labelledby="sn-cam-t" ref={camRef} inert={bg}>
              <h3 className="sn-k" id="sn-cam-t">
                Los cambios
              </h3>
              <p className="sn-sub">{camSub}</p>
              {filter && (
                <div className="sn-filter">
                  <button type="button" className="vd-glass vd-press sn-chip" onClick={() => setFilter(null)} aria-label="Quitar el filtro y ver todos los cambios">
                    Solo {byId.get(filter)?.name ?? "él"}
                    <Icon name="close" />
                  </button>
                </div>
              )}
              <ol className="sn-cl">
                {camRows.map((r) =>
                  r.k === "half" ? (
                    <li key={r.key} className="sn-cl__half">
                      <span>Descanso</span>
                      <b>{r.sc}</b>
                    </li>
                  ) : r.k === "now" ? (
                    <li key={r.key} className="sn-cl__now" aria-hidden="true">
                      <b>{r.m}′</b>
                      <i />
                      <span>la moviola va por aquí</span>
                    </li>
                  ) : (
                    <li key={r.key} className={["sn-cl__g", r.later ? "is-later" : "", r.here ? "is-here" : "", r.his ? "is-his" : ""].filter(Boolean).join(" ")} data-m={r.m}>
                      <button
                        type="button"
                        className="sn-cl__b"
                        onClick={() => goTo(r.m, r.f)}
                        onMouseEnter={() => wide && canHover && setPreview(r.m)}
                        onMouseLeave={() => setPreview((p) => (p === r.m ? null : p))}
                        aria-label={r.label}
                      >
                        <span className="sn-cl__m" aria-hidden="true">
                          <b className="vd-clock">{r.m}′</b>
                          <span className="sn-cl__sc">{r.sc}</span>
                        </span>
                        <span className="sn-cl__rows" aria-hidden="true">
                          {r.subs.map((s) => (
                            <span key={`${s.inId}>${s.outId}`} className="sn-cl__sub">
                              <span className={`sn-cl__p sn-cl__p--in${s.inId === sel ? " is-him" : ""}`}>
                                <svg viewBox="0 0 24 24" className="sn-ic">
                                  <path d="M12 19V5m-6 6 6-6 6 6" />
                                </svg>
                                <span className="n">{s.inName}</span>
                                <Nota txt={s.inNota} band={s.inBand} size="sm" />
                              </span>
                              <span className={`sn-cl__p sn-cl__p--out${s.outId === sel ? " is-him" : ""}`}>
                                <svg viewBox="0 0 24 24" className="sn-ic">
                                  <path d="M12 5v14m6-6-6 6-6-6" />
                                </svg>
                                <span className="n">{s.outName}</span>
                                <Nota txt={s.outNota} band={s.outBand} size="sm" />
                              </span>
                            </span>
                          ))}
                          {r.sw && (
                            <span className="sn-cl__sw">
                              <svg viewBox="0 0 24 24" className="sn-ic">
                                <path d="M4 8h13l-3-3M20 16H7l3 3" />
                              </svg>
                              <span>
                                <b>{r.sw.title}</b>
                                {r.sw.text}
                              </span>
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  ),
                )}
              </ol>
              <p className="sn-foot">Notas de 0 a 10: 6,5 es un partido normal y con menos de 10′ no hay nota. Los tramos de cada uno, en «Los minutos».</p>
            </section>
          </>
        )}

        {view === "notas" && (
          <section className="sn-sec sn-main sn-notas" aria-labelledby="sn-notas-t" inert={bg}>
            <h3 className="sn-k" id="sn-notas-t">
              Todos los que jugaron, por nota
            </h3>
            {swarm.dots.length > 0 && (
              <div className="sn-swarm" style={{ "--above": swarm.rowsAbove, "--below": swarm.rowsBelow } as CSSProperties} aria-hidden="true">
                <span className="sn-swarm__ax" />
                <span className="sn-swarm__n" style={{ left: `${swarm.normal}%` }} />
                <span className="sn-swarm__nl" style={{ left: `${swarm.normal}%` }}>
                  6,5 · normal
                </span>
                {swarm.ticks.map((k) => (
                  <span key={k.t} className="sn-swarm__t" style={{ left: `${k.x}%` }}>
                    {k.t}
                  </span>
                ))}
                {swarm.dots.map((d) => (
                  <button key={d.id} type="button" tabIndex={-1} className={`sn-swarm__d nb--${d.band}${d.me ? " is-me" : ""}${sel === d.id ? " is-on" : ""}`} style={{ left: `${d.x}%`, "--ri": d.row } as CSSProperties} onClick={open(d.id)}>
                    {d.num}
                  </button>
                ))}
              </div>
            )}
            <ol className="sn-nl">
              {ranked.map((r) => (
                <li key={r.id}>
                  <button type="button" className={`sn-nl__b${sel === r.id ? " is-on" : ""}`} onClick={open(r.id)} aria-label={r.label} aria-pressed={sel === r.id}>
                    <Tee kit={c.kit} num={r.num} className="sn-row__tee" />
                    <span className="sn-nl__t" aria-hidden="true">
                      <span className="sn-nl__top">
                        <b>{r.name}</b>
                        {r.me && <span className="sn-me">Tú</span>}
                        {r.mvp && (
                          <span className="vd-tag vd-tag--gold">
                            <svg viewBox="0 0 24 24">
                              <path d={STAR} fill="currentColor" />
                            </svg>
                            MVP
                          </span>
                        )}
                      </span>
                      <span className="sn-nl__sub">
                        <span className="sn-nl__bar">
                          <i style={{ width: `${r.minPct}%` }} />
                        </span>
                        {r.sub}
                      </span>
                    </span>
                    <span className={`nb nb--lg nb--${r.band}`} aria-hidden="true">
                      {r.nota}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            <p className="sn-foot">Notas de 0 a 10: 6,5 es un partido normal y con menos de 10′ no hay nota. La barra es lo que jugó de los {D} minutos.</p>
          </section>
        )}

        {view === "min" && (
          <section className="sn-sec sn-main sn-mins" aria-labelledby="sn-mins-t" inert={bg}>
            <h3 className="sn-k" id="sn-mins-t">
              {published ? "Tramo a tramo, y en qué sitio" : "Tramo a tramo"}
            </h3>
            <div className="sn-ax" aria-hidden="true">
              <span>0′</span>
              <span>Descanso</span>
              <span>{D}′</span>
            </div>
            <ol className="sn-sl">
              {shifts.map((r) => (
                <li key={r.id}>
                  <button type="button" className={`sn-st${sel === r.id ? " is-on" : ""}`} onClick={open(r.id)} aria-label={r.label} aria-pressed={sel === r.id}>
                    <Tee kit={c.kit} num={r.num} className="sn-st__tee" />
                    <span className="sn-st__name" aria-hidden="true">
                      {r.name}
                    </span>
                    <span className="sn-st__min" aria-hidden="true">
                      {r.min}′
                    </span>
                    <span className="sn-tr" aria-hidden="true">
                      <i className="sn-tr__half" />
                      {r.segs.map((s) => (
                        <i key={s.key} className={`sn-tr__seg ${s.cls}`} style={{ left: `${s.l}%`, width: `${s.w}%` }}>
                          {s.code && <em>{s.code}</em>}
                        </i>
                      ))}
                      {r.dots.map((d) => (
                        <i key={d.key} className={`sn-tr__dot ${d.cls}`} style={{ left: `${d.l}%` }} />
                      ))}
                      {c.dragged && <i className="sn-tr__head" style={{ left: `${(c.minute / D) * 100}%` }} />}
                    </span>
                    <span className={`nb nb--sm nb--${r.band} sn-st__nb`} aria-hidden="true">
                      {r.nota}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            <p className="sn-foot">{published ? "Cada tramo lleva el sitio donde jugó: POR portero, LI y LD laterales, DFC central, MC medio y DC punta." : "Sin el siete de la pizarra, cada tramo dice cuándo jugó; los sitios, en su ficha."}</p>
          </section>
        )}

        {wide && cardEl}
      </div>
      {host && !wide && createPortal(<>{sheet && scrimEl}{sheet && cardEl}{back !== null && !sel && backEl}</>, host)}
    </section>
  );
}
