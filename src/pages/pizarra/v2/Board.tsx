// La pizarra «Noche de partido» — the app screen. The stadium fills the screen; the bench and the tools
// live in a bottom sheet with three snap points above the mode bar (desktop: a mode rail and one panel).
// Every change goes through commit(): history (undo/redo as a rewind), the morph of every cromo from
// where it was, the química ripple, the 7/7 celebration and the board's autosave (the session).
// Around the board: the plan painted on the pitch, the química panel, your boards and the official,
// Comparar (the differences on the pitch), Compartir (the cartel) and Ajustes.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { FormationName, Lineup, RoleKey, Zone } from "../formations";
import { ZONES } from "../formations";
import { CAMS, proj, slotLabel, slotPos, slotZone, TEMPO_PULSE } from "./geometry";
import { fits, GALONES, isAvailable, isFull, natOf, type Squad } from "./model";
import { chem } from "./quimica";
import { autoPlace, cycleDefLine, goFree, normalize, place, resetFree, resolveDrop, setDefLine, setPlaysAs, setSystem, snapAll, stepSystem, swap, toBench, toggleRole } from "./ops";
import { suggestSeven } from "./pack";
import { applyFan, fanCentre, fanItems, type FanItem } from "./fan";
import { EMPTY_HISTORY, pushHistory, redo, undo, type History } from "./history";
import { cycle, settle, step, type Snap } from "./sheet";
import { DIR_KEYS, slotInDirection } from "./drag";
import { ago, FX0, fxDuration, hud as buildHud, pitchView, planLayer, positionsOf, tacSummary, vars, type Fx, type Modo } from "./view";
import { useDragController } from "./useDragController";
import { useBoardSound, buzz } from "./sound";
import { useNoScrollJump } from "./useNoScrollJump";
import type { BoardSession } from "./useBoardSession";
import { Stage } from "./Stage";
import { AppBar, BenchTab, MasPanel, ModeBar, OnceTabs, ReadOnlyStrip, Sheet, SoonPanel, SystemTab, Tray, type OnceTab, type RepRow, type TrayData } from "./Panels";
import { AjustesPanel, CompararPanel, CompartirPanel, PlanTab, QuimicaPanel } from "./SheetPanels";
import { SHOW0, type BoardPrefs, type ShowKey } from "./prefs";
import { TablerosPanel, type BoardRowView, type ReactionsView, type TbTab } from "./Tableros";
import { Fan, Ficha, type FichaView } from "./Overlays";
import { Icon } from "./icons";
import { setTactic, tacRows } from "./plan";
import { changes, cmpMarks, tape } from "./compare";
import { boardLink, boardMeta, convCounts, matchLabel, matchShort, type CalMatch } from "./boards";
import { cartelBlob, cartelFile, cartelLayout, crestImage, download, shareCartel } from "./cartel";
import { DELETE_MS } from "./useBoardSession";
import { deepHash } from "./deeplink";
import { extractLineup, type LineupDoc } from "../lineupDoc";
import { nextReaction, type ReactionValue } from "../reactions";
import { apiError } from "../../../lib/clubApi";

export interface BoardProps {
  session: BoardSession;
  squad: Squad;
  seasonId: string;
  seasonName: string;
  seasons: { id: string; name: string }[];
  onSeason: (id: string) => void;
  /** The board's match, for its name on the LED boards («J8 · MAD SKY», «sáb 8 nov»). */
  match: { short: string; date: string } | null;
  /** The signed-in member's own player («Tu sitio»). */
  meId: string | null;
  prefs: BoardPrefs;
  onPrefs: (p: Partial<BoardPrefs>) => void;
  now: number;
  /** The season's matches (Partido) and the next one. */
  calendar: CalMatch[];
  nextMatch: CalMatch | null;
  /** Captains (admins) publish the official. */
  isAdmin: boolean;
  /** The official the team sees for this board's match (or the season's). */
  official: LineupDoc | null;
  /** What the team thinks of that official (null while there is none). */
  reactions: (ReactionsView & { react: (v: ReactionValue | null) => Promise<void> }) | null;
  /** The convocatoria on the cromos: whose match, and whether it could be read. */
  conv: { match: CalMatch | null; loading: boolean; error: boolean };
  /** «Partido de día»: the app's theme. */
  theme: { day: boolean; toggle: () => void };
  crest: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
}

type Sel = { k: "p" | "b"; id: string } | null;
interface FanState {
  id: string;
  cx: number;
  cy: number;
  sub: boolean;
}
interface FicState {
  id: string;
  ox: string;
  oy: string;
  side: "auto" | "front" | "back";
}
interface Ui {
  key: string;
  sel: Sel;
  pick: number | null;
  fan: FanState | null;
  fic: FicState | null;
  hist: History;
  /** Keyboard target slot while a cromo is in the hand. */
  kb: number | null;
}
const UI0 = { sel: null, pick: null, fan: null, fic: null, hist: EMPTY_HISTORY, kb: null };

const reducedMotion = (): boolean => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Deep links into a panel: /pizarra#comparar, #compartir, #tableros, #ajustes, #quimica, #plan.
const HASH_MODOS: Modo[] = ["quimica", "mas", "tableros", "comparar", "compartir", "ajustes"];
/** The panel a URL hash names (null = none we know). */
function panelOf(hash: string): Modo | "plan" | null {
  const h = hash.replace(/^#/, "").toLowerCase();
  if (h === "plan") return "plan";
  return HASH_MODOS.find((x) => x === h) ?? null;
}
function fromHash(): { modo: Modo; tab: OnceTab } {
  const p = panelOf(deepHash());
  return p === "plan" ? { modo: "editar", tab: "p" } : { modo: p ?? "editar", tab: "b" };
}

interface Toast {
  msg: string;
  /** One action (Deshacer); `aria` says what it does, apart from the app bar's own «Deshacer». */
  act?: { label: string; aria: string; run: () => void };
}

const snapOf = (m: Modo): Snap => (m === "quimica" || m === "mas" || m === "comparar" || m === "charla" ? "half" : m === "tableros" || m === "compartir" || m === "ajustes" ? "full" : "peek");

const SHEET_TITLE: Record<Modo, string> = {
  editar: "Banquillo, sistema y plan",
  quimica: "Química",
  jugadas: "Jugadas",
  dibujar: "Dibujar",
  mas: "Más",
  tableros: "Tableros",
  comparar: "Comparar",
  compartir: "Compartir",
  ajustes: "Ajustes",
  charla: "El guion de la charla",
};

export function Board(props: BoardProps) {
  const { session, squad: sq, prefs } = props;
  const L = session.lineup;
  const ready = session.ready;
  const ro = session.readOnly;
  const canEdit = ready && !ro;
  const cam = prefs.cam === "top" ? "top" : "tv";
  const C = CAMS[cam];
  const show = { ...SHOW0, ...prefs.show };

  const [rm] = useState(reducedMotion);
  const [start] = useState(fromHash);
  const [modo, setModo] = useState<Modo>(start.modo);
  const [snap, setSnap] = useState<Snap>(() => (start.tab === "p" ? "half" : snapOf(start.modo)));
  const [tab, setTab] = useState<OnceTab>(start.tab);
  const [mk, setMk] = useState(0);
  const [sysk, setSysk] = useState(0);
  const [ui, setUi] = useState<Ui>({ key: session.key, ...UI0 });
  const [fx, setFx] = useState<Fx>(FX0);
  const [toast, setToast] = useState<Toast | null>(null);
  const [cmpPick, setCmpPick] = useState<string | null>(null);
  const [tbTab, setTbTab] = useState<TbTab>("m");
  const [shareBusy, setShareBusy] = useState(false);
  // The cartel is drawn ahead while Compartir is open, so «Mandar al grupo» reaches the share sheet
  // within the tap (Safari only opens it straight from a gesture).
  const [prepared, setPrepared] = useState<{ key: string; blob: Blob } | null>(null);
  const [live, setLive] = useState({ msg: "", n: 0 });
  const [q, setQ] = useState("");
  const [zf, setZf] = useState("Todos");
  const [oc, setOc] = useState(false);
  const [rp, setRp] = useState(0);
  const [tp, setTp] = useState(0);
  const [tpk, setTpk] = useState(0);
  const [dragKind, setDragKind] = useState<null | "tok" | "line">(null);
  const [dragFrom, setDragFrom] = useState<null | "pitch" | "bench">(null);
  const [introDone, setIntroDone] = useState(rm);
  const [fit, setFit] = useState({ kp: 1, kh: 0.64 });
  // Loading only counts until the board has shown once (a later blip must not jump the footer).
  const [seenReady, setSeenReady] = useState(ready);
  if (ready && !seenReady) setSeenReady(true);

  const rootRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const swpRef = useRef<SVGPathElement>(null);
  const fxTimer = useRef(0);
  const toastTimer = useRef(0);
  const snd = useBoardSound(prefs.snd);
  // No tap on the board may move the page (only the user scrolls it).
  useNoScrollJump(rootRef);

  // Per-board UI (selection, menus, history) belongs to the board on screen.
  const u: Ui = ui.key === session.key ? ui : { key: session.key, ...UI0 };
  const patchUi = (patch: Partial<Ui>) => setUi((prev) => ({ ...(prev.key === session.key ? prev : { key: session.key, ...UI0 }), ...patch }));

  useEffect(
    () => () => {
      window.clearTimeout(fxTimer.current);
      window.clearTimeout(toastTimer.current);
    },
    [],
  );
  // The 2D intro (floodlights on, crane down onto the pitch, cromos dealt) once the board has loaded.
  useEffect(() => {
    if (!ready || introDone) return;
    const t = window.setTimeout(() => setIntroDone(true), 3300);
    return () => window.clearTimeout(t);
  }, [ready, introDone]);
  // Phones shorter than the designed 844 screen: the pitch shrinks so the sheet never covers it.
  useEffect(() => {
    const app = appRef.current;
    if (!app || typeof ResizeObserver === "undefined") return;
    const ro2 = new ResizeObserver(() => {
      const w = app.clientWidth;
      const h = app.clientHeight;
      if (!w || !h) return;
      const ph = w * C.Fh;
      const kp = Math.max(0.4, Math.min(1, (h - 72 - 200 - 60 - 44) / ph));
      const kh = Math.max(0.3, Math.min(0.64, (h - 72 - 404 - 66) / ph));
      setFit((f) => (Math.abs(f.kp - kp) < 0.005 && Math.abs(f.kh - kh) < 0.005 ? f : { kp: +kp.toFixed(3), kh: +kh.toFixed(3) }));
    });
    ro2.observe(app);
    return () => ro2.disconnect();
  }, [C.Fh]);

  // ── derived ──
  const ch = chem(L, sq);
  const squadIds = useMemo(() => sq.list.map((c) => c.id), [sq]);
  const nm = (id: string) => sq.byId.get(id)?.name ?? "Jugador";
  const onPitch = new Set(L.slots.map((s) => s.playerId).filter((x): x is string => !!x));
  let sel = u.sel;
  if (sel && (sel.k === "p" ? !onPitch.has(sel.id) : onPitch.has(sel.id) || !sq.byId.has(sel.id))) sel = null;
  const pick = u.pick != null && u.pick >= 0 && u.pick < L.slots.length ? u.pick : null;
  const fan = u.fan && onPitch.has(u.fan.id) ? u.fan : null;
  const fic = u.fic && sq.byId.has(u.fic.id) ? u.fic : null;
  // The plan is painted while its tab is open; the plan, the química and Comparar show the cromos as discs.
  const showPlan = modo === "editar" && tab === "p";
  const mini = modo === "quimica" || modo === "comparar" || showPlan;
  const view = pitchView({ L, sq, ch, cam, modo, fx, selId: sel?.id ?? null, pick, ro: !canEdit, rm, meId: props.meId, mini });
  const plan = planLayer(L, cam, modo, showPlan);
  const match = props.match;
  const hud = buildHud(L, sq, ch, fx, rm, match);
  const tacSum = tacSummary(L);

  const say = (msg: string, act?: Toast["act"], ms = 2600) => {
    window.clearTimeout(toastTimer.current);
    setToast({ msg, act });
    toastTimer.current = window.setTimeout(() => setToast(null), ms);
  };
  const fail = (err: unknown) => say(apiError(err));
  // What changed under the board (another tab, a new official, a failed save…) is said as a toast.
  const notice = session.notice;
  const sayLatest = useRef(say);
  useEffect(() => {
    sayLatest.current = say;
  });
  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => sayLatest.current(notice.msg), 0);
    return () => window.clearTimeout(t);
  }, [notice]);
  const announce = (msg: string) => setLive((l) => ({ msg, n: l.n + 1 }));
  const roMsg = session.official ? "Oficial: solo lectura. Duplícalo para editar" : "Solo lectura: duplícalo para editarlo";

  const runFx = (next: Fx) => {
    setFx(next);
    window.clearTimeout(fxTimer.current);
    fxTimer.current = window.setTimeout(() => setFx((f) => ({ ...FX0, k: f.k })), fxDuration(next));
  };
  const morph = (drop: Record<string, [number, number]> | null, extra: Partial<Fx> = {}): Fx => ({
    ...FX0,
    k: fx.k + 1,
    from: { ...positionsOf(L, cam), ...(drop ?? {}) },
    q0: ch.v,
    ...extra,
  });

  /** Every change to the lineup goes through here. */
  const commit = (next: Lineup, o: { drop?: Record<string, [number, number]> | null; ui?: Partial<Ui>; fx?: Partial<Fx>; snap?: Snap } = {}) => {
    if (!ready) return;
    if (ro) {
      say(roMsg);
      return;
    }
    const rip = next.slots.map((s, i) => (s.playerId && L.slots[i]?.playerId !== s.playerId ? s.playerId : null)).filter((x): x is string => !!x);
    const cele = !isFull(L, sq) && isFull(next, sq) && !rm;
    session.commit(next);
    patchUi({ hist: pushHistory(u.hist, L), ...o.ui });
    if (o.snap) setSnap(o.snap);
    runFx(morph(o.drop ?? null, { rip, cele, ...o.fx }));
    snd("clac");
    if (cele) {
      buzz([30, 60, 30, 60, 120]);
      snd("crowd");
      announce("¡Siete listo! " + (next.freeMode ? "Libre" : next.formation));
    }
  };

  const placeAt = (i: number, id: string) => {
    if (!isAvailable(sq, id)) {
      say(nm(id) + " está de baja: no se puede colocar");
      return;
    }
    const occ = L.slots[i]?.playerId;
    commit(place(L, id, i), { ui: { sel: null, pick: null, kb: null }, snap: "peek" });
    buzz([12, 30, 12]);
    announce(occ && occ !== id ? nm(id) + " por " + nm(occ) + " en " + slotLabel(L, i) : nm(id) + " a " + slotLabel(L, i));
  };

  const cardEl = (id: string): HTMLElement | null => {
    const els = rootRef.current?.querySelectorAll<HTMLElement>(".cd[data-tok]") ?? [];
    const cd = Array.from(els).find((e) => e.getAttribute("data-tok") === id);
    return cd?.querySelector<HTMLElement>(".cc") ?? null;
  };
  const openFic = (id: string, el: Element | null) => {
    let ox = "0px";
    let oy = "0px";
    const a = appRef.current?.getBoundingClientRect();
    const r = el?.getBoundingClientRect();
    if (a && r && a.width) {
      ox = Math.round(r.left + r.width / 2 - (a.left + a.width / 2)) + "px";
      oy = Math.round(r.top + r.height / 2 - (a.top + a.height / 2)) + "px";
    }
    patchUi({ fic: { id, ox, oy, side: "auto" }, fan: null });
    buzz(14);
    snd("flip");
  };
  const openFan = (id: string, el: Element | null) => {
    const a = appRef.current?.getBoundingClientRect();
    const r = el?.getBoundingClientRect();
    const c = a && r && a.width ? fanCentre(r.left + r.width / 2 - a.left, r.top + r.height / 2 - a.top, a.width, a.height) : { cx: 195, cy: 300 };
    patchUi({ fan: { id, cx: c.cx, cy: c.cy, sub: false }, sel: null, pick: null, kb: null });
    buzz(25);
  };

  // ── pointer: drag, long press, the línea and the sheet handle ──
  const ctl = useDragController(
    { root: rootRef, frame: frameRef, sheet: sheetRef, layer: layerRef, swp: swpRef },
    {
      lineup: L,
      cam,
      snap,
      canMove: canEdit && (modo === "editar" || modo === "quimica"),
      canLine: canEdit && modo === "editar" && plan.dlOn,
      magnets: canEdit && modo === "editar" && !L.freeMode,
    },
    {
      onStart: (kind, _id, from) => {
        setDragKind(kind);
        setDragFrom(from);
        if (kind === "tok") {
          buzz(10);
          patchUi({ fan: null });
        }
      },
      onEnd: () => {
        setDragKind(null);
        setDragFrom(null);
      },
      onDrop: (src, t, at) => {
        const drop = at ? { [src.id]: at } : null;
        const r = resolveDrop(L, sq, src, t, prefs.grid);
        if (!r || "toast" in r) {
          if (r) say(r.toast);
          runFx(morph(drop));
          return;
        }
        commit(r.lineup, { drop, ui: { sel: null, pick: null, kb: null }, snap: "peek" });
        buzz([12, 30, 12]);
        const k = r.lineup.slots.findIndex((s) => s.playerId === src.id);
        announce(k >= 0 ? nm(src.id) + " a " + slotLabel(r.lineup, k) : nm(src.id) + " al banquillo");
      },
      onLongPress: (id, from, el) => (from === "pitch" ? openFan(id, el) : openFic(id, el)),
      onLine: (val) => {
        if (val && val !== L.tactics.defLine) {
          commit(setDefLine(L, val));
          say("Línea " + val.toLowerCase() + ": la defensa se mueve");
        } else runFx(morph(null));
      },
      onGrab: (h, v, full) => {
        const s = settle(h, v, full);
        if (s === "peek" && tab !== "b") setTab("b");
        setSnap(s);
        buzz(8);
      },
      onBaja: () => say("De baja: no se puede colocar"),
    },
  );

  // ── taps ──
  const tapCard = (id: string, el: HTMLElement) => {
    if (ctl.guarded() || !ready) return;
    if (modo !== "editar" && modo !== "quimica") return;
    if (ro) {
      say(roMsg);
      return;
    }
    const i = L.slots.findIndex((s) => s.playerId === id);
    if (sel?.id === id) {
      openFic(id, el);
      return;
    }
    if (sel?.k === "p") {
      commit(swap(L, sel.id, id), { ui: { sel: null, pick: null, kb: null }, snap: "peek" });
      buzz([12, 30, 12]);
      announce("Cambio: " + nm(sel.id) + " por " + nm(id));
      return;
    }
    if (sel?.k === "b") {
      placeAt(i, sel.id);
      return;
    }
    patchUi({ sel: { k: "p", id }, pick: i, kb: null });
    setTp(0);
    setModo("editar");
    setSnap("half");
    buzz(8);
    announce(nm(id) + " en la mano: toca otro cromo o un hueco. Con el teclado, flechas para elegir sitio e Intro para soltar.");
  };
  const tapSlot = (i: number) => {
    if (ctl.guarded() || !canEdit) return;
    if (sel) {
      placeAt(i, sel.id);
      return;
    }
    patchUi({ pick: pick === i ? null : i, kb: null });
    setTp(0);
    setModo("editar");
    setSnap("peek");
    buzz(8);
  };
  const tapBench = (id: string) => {
    if (ctl.guarded() || !canEdit) return;
    if (pick != null) {
      placeAt(pick, id);
      return;
    }
    if (sel?.id === id) {
      patchUi({ sel: null, kb: null });
      return;
    }
    patchUi({ sel: { k: "b", id }, kb: null });
    buzz(8);
    announce(nm(id) + " en la mano: toca un hueco o un cromo del campo.");
  };

  // ── board actions ──
  const doUndo = () => {
    if (!canEdit) return;
    const r = undo(u.hist, L);
    if (!r) return;
    session.commit(r.lineup);
    patchUi({ hist: r.history, sel: null, pick: null, fan: null, kb: null });
    runFx(morph(null, { rw: "REBOBINANDO" }));
    buzz([6, 20, 6]);
    snd("flip");
    announce("Deshecho");
  };
  const doRedo = () => {
    if (!canEdit) return;
    const r = redo(u.hist, L);
    if (!r) return;
    session.commit(r.lineup);
    patchUi({ hist: r.history, sel: null, pick: null, fan: null, kb: null });
    runFx(morph(null, { rw: "AVANCE" }));
    buzz([6, 20, 6]);
    snd("flip");
    announce("Rehecho");
  };
  const doSuggest = () => {
    if (!canEdit) return;
    const next = suggestSeven(L, sq);
    if (!next.slots.some((s) => s.playerId)) {
      say("No hay nadie disponible para el sobre");
      return;
    }
    commit(next, { ui: { sel: null, pick: null, kb: null }, fx: { spin: !rm } });
    buzz([10, 40, 10, 40, 10, 40, 60]);
    say("Sobre abierto: los siete en mejor forma" + (sq.recentLabel ? " (" + sq.recentLabel + ")" : ""));
  };
  const doAuto = () => {
    if (!canEdit) return;
    const next = autoPlace(L, sq);
    if (next.slots.every((s, i) => s.playerId === L.slots[i]?.playerId)) {
      say(next.slots.some((s) => s.playerId) ? "Ya está cada cromo en su sitio" : "No hay nadie disponible para colocar");
      return;
    }
    commit(next, { ui: { sel: null, pick: null, kb: null } });
    buzz([10, 30, 10, 30, 10]);
    say("Cada cromo a su sitio natural · bajas y «no voy» fuera");
  };
  const toSystem = (next: Lineup) => {
    commit(next, { ui: { pick: null } });
    setSysk((k) => k + 1);
    buzz(12);
  };
  const goModo = (m: Modo | "plan") => {
    const target: Modo = m === "plan" ? "editar" : m;
    setModo(target);
    setSnap(m === "plan" ? "half" : snapOf(target));
    setTab(m === "plan" ? "p" : "b");
    patchUi({ sel: null, pick: null, fan: null, fic: null, kb: null });
    setMk((k) => k + 1);
    buzz(10);
  };
  // A new hash while on the page (#tableros, #plan…) opens its panel, like it does on load.
  const goLatest = useRef(goModo);
  useEffect(() => {
    goLatest.current = goModo;
  });
  useEffect(() => {
    const onHash = () => {
      const p = panelOf(window.location.hash);
      if (p) goLatest.current(p);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const goSis = () => {
    setModo("editar");
    setTab("s");
    setSnap("half");
    patchUi({ sel: null, pick: null, kb: null });
  };
  const onTab = (t: OnceTab) => {
    setTab(t);
    if (t !== "b") setSnap(snap === "full" ? "full" : "half");
  };
  const cycleSnap = () => {
    if (ctl.guarded()) return;
    const n = cycle(snap);
    if (n === "peek" && tab !== "b") setTab("b");
    setSnap(n);
    buzz(6);
  };
  const stepSnap = (d: 1 | -1) => {
    const n = step(snap, d);
    if (n === "peek" && tab !== "b") setTab("b");
    setSnap(n);
  };
  const cycleLine = () => {
    if (ctl.guarded() || !canEdit) return;
    const next = cycleDefLine(L);
    commit(next);
    say("Línea " + next.tactics.defLine.toLowerCase() + ": la defensa se mueve");
  };

  // ── keyboard: arrows move the cromo in the hand between slots, Enter drops, Escape cancels ──
  const slotPoints = L.slots.map((_, i) => {
    const p = slotPos(L, i);
    const s = proj(C, p.u, p.v);
    return { i, x: s.x, y: s.y };
  });
  const describeSlot = (k: number) => {
    const occ = L.slots[k]?.playerId;
    return occ && occ !== sel?.id ? "Sobre " + nm(occ) + ", " + slotLabel(L, k) + ": Intro para cambiarlos" : "Hueco " + slotLabel(L, k) + ": Intro para soltarlo";
  };
  const dropOn = (k: number) => {
    if (!sel) return;
    if (sel.k === "p" && L.slots[k]?.playerId === sel.id) {
      patchUi({ kb: null });
      announce(nm(sel.id) + " se queda en su sitio");
      return;
    }
    placeAt(k, sel.id);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const tag = (e.target as HTMLElement).tagName;
    const field = tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA";
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !field && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) doRedo();
      else doUndo();
      return;
    }
    if (mod && !field && e.key.toLowerCase() === "y") {
      e.preventDefault();
      doRedo();
      return;
    }
    if (e.key === "Escape") {
      if (fan || fic) return;
      if (sel || pick != null || u.kb != null) {
        e.preventDefault();
        patchUi({ sel: null, pick: null, kb: null });
        setSnap("peek");
        announce("Cancelado");
      }
      return;
    }
    if (field || !sel || !canEdit || modo !== "editar") return;
    const dir = DIR_KEYS[e.key];
    if (dir) {
      e.preventDefault();
      const first = L.slots.findIndex((s) => !s.playerId);
      const from = u.kb ?? (sel.k === "p" ? L.slots.findIndex((s) => s.playerId === sel.id) : first >= 0 ? first : 0);
      const nx = u.kb == null && sel.k === "b" ? from : (slotInDirection(slotPoints, from, dir) ?? from);
      patchUi({ kb: nx });
      announce(describeSlot(nx));
      return;
    }
    if ((e.key === "Enter" || e.key === " ") && u.kb != null) {
      e.preventDefault();
      dropOn(u.kb);
    }
  };

  // ── bench, album, bajas, reparto ──
  const benchAll = sq.list.filter((c) => !onPitch.has(c.id));
  const qq = q.trim().toLowerCase();
  // «Solo convocados» = those who said «Voy» (it needs answers to the convocatoria).
  const cc = convCounts(sq);
  const answered = cc.voy + cc.duda + cc.no > 0;
  const ocOn = oc && answered;
  const benchF = benchAll.filter(
    (c) => !c.baja && (!qq || c.name.toLowerCase().includes(qq) || String(c.num) === qq) && (zf === "Todos" || c.pos === zf) && (!ocOn || c.cv === "voy"),
  );
  const cm = props.conv.match;
  const convTxt = !cm
    ? "Sin partido a la vista: sin convocatoria."
    : props.conv.error
      ? "No se ha podido leer la convocatoria de " + matchShort(cm) + "."
      : props.conv.loading
        ? "Leyendo la convocatoria de " + matchShort(cm) + "…"
        : answered
          ? "Convocatoria " + matchShort(cm) + ": " + [cc.voy + " voy", cc.duda + " duda", cc.no + " no va", cc.sin ? cc.sin + " sin responder" : ""].filter(Boolean).join(" · ")
          : "Nadie ha respondido aún a la convocatoria de " + matchShort(cm) + ".";
  const railPages = Math.max(1, Math.ceil(benchF.length / 3));
  const rpi = Math.min(rp, railPages - 1);
  const rail = benchF.slice(rpi * 3, rpi * 3 + 3);
  const bajas = sq.list.filter((c) => c.baja);
  const counts = { les: bajas.filter((c) => c.baja === "Lesionado").length, san: bajas.filter((c) => c.baja === "Sancionado").length, ina: bajas.filter((c) => c.baja === "Inactivo").length };
  const avl = sq.list.filter((c) => !c.baja && c.pos !== "POR").sort((a, b) => a.stats.minutes - b.stats.minutes);
  const maxMin = Math.max(1, ...sq.list.map((c) => c.stats.minutes));
  const rep: RepRow[] = avl.slice(0, 4).map((c) => ({ id: c.id, num: c.num, name: c.name, m: Math.max(2, Math.round((c.stats.minutes / maxMin) * 100)) + "%", min: c.stats.minutes + "′" }));
  const low = avl.find((c) => !onPitch.has(c.id) && c.cv !== "no");
  let rot: { id: string; i: number; out: string } | null = null;
  if (low?.pos) {
    const cands = L.slots
      .map((s, i) => ({ id: s.playerId, i }))
      .filter((x): x is { id: string; i: number } => !!x.id && x.i > 0 && slotZone(L, x.i) === low.pos)
      .sort((a, b) => (sq.byId.get(b.id)?.stats.minutes ?? 0) - (sq.byId.get(a.id)?.stats.minutes ?? 0));
    if (cands[0]) rot = { id: low.id, i: cands[0].i, out: cands[0].id };
  }
  const repTxt = rot && low ? low.name + " lleva " + low.stats.minutes + "′; " + nm(rot.out) + ", " + (sq.byId.get(rot.out)?.stats.minutes ?? 0) + "′." : "El reparto está equilibrado.";
  const galLeg = GALONES.map((g) => {
    const h = L.roles[g.key];
    return { l: g.letter, t: g.label + " · " + (h && sq.byId.has(h) ? nm(h) : "sin asignar") };
  });
  const doRotate = () => {
    if (!rot || !canEdit) {
      say("El reparto ya está equilibrado");
      return;
    }
    const r = rot;
    placeAt(r.i, r.id);
    say(nm(r.id) + " entra por " + nm(r.out) + ": más minutos para quien menos ha jugado");
  };

  // ── the tray (a slot or a pitch cromo picked) ──
  let tray: TrayData | null = null;
  if (modo === "editar" && pick != null && canEdit) {
    const occ = L.slots[pick]?.playerId ?? null;
    const lb = slotLabel(L, pick);
    const zz = slotZone(L, pick);
    const rank = (id: string) => {
      const c = sq.byId.get(id);
      if (!c) return -Infinity;
      let r = c.rt + (c.pos === zz ? 40 : 0) + (c.cv === "no" ? -60 : c.cv === "duda" ? -8 : 0);
      if ((pick === 0) !== (c.pos === "POR")) r -= 50;
      return r;
    };
    const cand = benchAll.filter((c) => !c.baja).sort((a, b) => rank(b.id) - rank(a.id));
    const pages = Math.max(1, Math.ceil(cand.length / 5));
    const tpi = Math.min(tp, pages - 1);
    const held = occ && sel?.k === "p" && sel.id === occ ? occ : null;
    tray = {
      kick: (occ ? "En la mano · cámbialo por" : "Los mejores para " + zz) + (pages > 1 ? " · " + (tpi + 1) + "/" + pages : ""),
      title: occ ? nm(occ) + " · " + lb : "Hueco " + lb,
      cards: cand.slice(tpi * 5, tpi * 5 + 5),
      meId: props.meId,
      page: { n: tpi + 1, of: pages },
      pageCls: tpk % 2 ? "pa" : tpk ? "pb" : "",
      hot: dragFrom === "pitch",
      held: held
        ? {
            id: held,
            name: nm(held),
            gal: GALONES.map((g) => ({ key: g.key, letter: g.letter, label: g.label, on: L.roles[g.key] === held })),
            pos: ZONES.map((z) => ({ z, on: natOf(L, sq, held) === z })),
          }
        : null,
    };
  }
  const heldId = tray?.held?.id ?? null;
  const trPage = (d: 1 | -1) => {
    if (!tray) return;
    setTp(Math.max(0, Math.min(tray.page.of - 1, tray.page.n - 1 + d)));
    setTpk((k) => k + 1);
  };
  const trClose = () => {
    patchUi({ sel: null, pick: null, kb: null });
    setSnap("peek");
  };
  const trCard = (id: string) => {
    if (ctl.guarded() || pick == null) return;
    placeAt(pick, id);
  };
  const trGal = (k: RoleKey) => {
    if (!heldId) return;
    const next = toggleRole(L, k, heldId);
    commit(next, { ui: { sel: { k: "p", id: heldId }, pick: next.slots.findIndex((s) => s.playerId === heldId) } });
  };
  const trPos = (z: Zone) => {
    if (!heldId) return;
    commit(setPlaysAs(L, sq, heldId, z), { ui: { sel: { k: "p", id: heldId }, pick } });
    say(nm(heldId) + " juega de " + z + " en este siete");
  };
  const trBench = () => {
    if (!heldId) return;
    const i = L.slots.findIndex((s) => s.playerId === heldId);
    commit(toBench(L, heldId), { ui: { sel: null, pick: i, kb: null }, snap: "peek" });
    announce(nm(heldId) + " al banquillo");
  };
  const trFicha = () => {
    if (heldId) openFic(heldId, cardEl(heldId));
  };
  const trFan = () => {
    if (!heldId) return;
    setSnap("peek");
    openFan(heldId, cardEl(heldId));
  };

  // ── the fan and the ficha ──
  const fanList = fan ? fanItems(L, sq, fan.id, fan.sub) : [];
  const onFanItem = (it: FanItem) => {
    if (!fan) return;
    const o = applyFan(it, L, sq, fan.id);
    if (o.kind === "sub") patchUi({ fan: { ...fan, sub: o.sub } });
    else if (o.kind === "ficha") openFic(fan.id, cardEl(fan.id));
    else {
      commit(o.lineup, { ui: { fan: null, pick: o.pick ?? null, sel: null } });
      if (o.toast) say(o.toast);
      if (o.pick != null) {
        setModo("editar");
        setTp(0);
        announce(nm(fan.id) + " al banquillo");
      }
    }
  };
  let ficha: FichaView | null = null;
  if (fic) {
    const p = sq.byId.get(fic.id);
    const fi = L.slots.findIndex((s) => s.playerId === fic.id);
    if (p) {
      let ln = ch.links
        .filter((l) => l.a === fic.id || l.b === fic.id)
        .sort((a, b) => b.s - a.s)
        .slice(0, 3)
        .map((l) => {
          const o = l.a === fic.id ? l.b : l.a;
          return { k: "con " + nm(o) + (l.tog ? " · " + l.tog + " partidos" : ""), v: l.t === 3 ? "++" : l.t === 2 ? "+" : "–" };
        });
      if (fi < 0) ln = [{ k: p.baja ? p.baja + ": no disponible" : "En el banquillo", v: "" }];
      else if (!ln.length) ln = [{ k: "Sin vecinos cerca en este siete", v: "" }];
      const cv = p.cv === "voy" ? " · Voy" : p.cv === "duda" ? " · Duda" : p.cv === "no" ? " · No va" : "";
      ficha = {
        name: p.name,
        num: p.num,
        rt: p.rt,
        pos: p.pos ?? "—",
        gk: p.pos === "POR",
        sub: (p.pos ? p.pos + " natural" : "Sin posición") + (fi >= 0 ? " · juega de " + slotLabel(L, fi) : "") + cv,
        st: [
          { k: "PARTIDOS", v: p.stats.played },
          { k: "GOLES", v: p.stats.goals },
          { k: "ASIST.", v: p.stats.assists },
          { k: "MINUTOS", v: p.stats.minutes },
          { k: "TITULAR", v: p.stats.starts },
          { k: "MVP", v: p.stats.mvps },
        ],
        ln,
        ox: fic.ox,
        oy: fic.oy,
        side: fic.side,
      };
    }
  }

  // ── the plan ──
  const tac = tacRows(L);
  const onTactic = (k: Parameters<typeof setTactic>[1], v: string) => {
    if (!canEdit) return;
    const next = setTactic(L, k, v);
    if (next === L) return;
    commit(next);
    buzz(8);
    if (k === "defLine") say("Línea " + v.toLowerCase() + ": la defensa se mueve");
  };

  // ── the boards around this one ──
  const cal = props.calendar;
  const calById = (cid: string | null) => (cid ? (cal.find((m) => m.id === cid) ?? null) : null);
  // (the list, the comparison and its marks are only worked out while their panel is open)
  const boardRows: BoardRowView[] = (modo === "tableros" ? session.mine : [])
    .slice()
    .sort((a, b) => (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0))
    .map((d) => {
      const on = d.id === session.id;
      const Ld = on ? L : normalize(extractLineup(d), squadIds);
      return { id: d.id, name: on ? session.name : d.name, meta: boardMeta(Ld, sq, on ? session.savedAt : (d.updatedAt ?? d.createdAt), props.now), on, official: d.isOfficial, deletable: !d.isOfficial || props.isAdmin };
    });
  const isMine = !!session.id && session.mine.some((d) => d.id === session.id);
  const off = props.official;
  const offMatch = off ? calById(off.matchId) : null;
  const offView = off
    ? {
        id: off.id,
        name: off.name,
        by: "Por @" + (off.ownerNickname || "capitán") + " · " + (off.matchId ? "este partido" + (offMatch ? " (" + matchShort(offMatch) + ")" : "") : "toda la temporada"),
        viewing: off.id === session.id,
      }
    : null;
  const tbFail = (err: unknown) => {
    console.error("Tableros", err);
    fail(err);
  };
  const linked = calById(session.matchId);

  // ── Comparar: another board (yours or the official) face to face ──
  const cmpDocs = (() => {
    const seen = new Set<string>();
    return [...session.mine, ...session.officials].filter((d) => d.id !== session.id && (seen.has(d.id) ? false : (seen.add(d.id), true)));
  })();
  const cmpOpts = cmpDocs.map((d) => ({ id: d.id, name: (d.isOfficial && !/^oficial/i.test(d.name) ? "Oficial · " : "") + d.name }));
  const cmpId = cmpPick && cmpOpts.some((o) => o.id === cmpPick) ? cmpPick : (cmpOpts[0]?.id ?? null);
  const cmpDoc = cmpDocs.find((d) => d.id === cmpId) ?? null;
  const LB = cmpDoc && modo === "comparar" ? normalize(extractLineup(cmpDoc), squadIds) : null;
  const cmp = LB ? cmpMarks(L, LB, cam) : [];
  const chg = LB ? changes(L, LB) : { ins: [], outs: [] };

  // ── Compartir: the cartel ──
  const cartel = cartelLayout(L, sq, ch, match?.short ?? null, props.seasonName);
  const cartelKey = JSON.stringify(cartel);
  const cartelNow = useRef(cartel);
  useEffect(() => {
    cartelNow.current = cartel;
  });
  useEffect(() => {
    if (modo !== "compartir") return;
    let dead = false;
    const t = window.setTimeout(() => {
      const c = cartelNow.current;
      void crestImage()
        .then((crest) => cartelBlob(c, crest))
        .then((blob) => {
          if (!dead && blob) setPrepared({ key: JSON.stringify(c), blob });
        })
        .catch((err: unknown) => console.error("No se pudo preparar el cartel", err));
    }, 300);
    return () => {
      dead = true;
      window.clearTimeout(t);
    };
  }, [modo, cartelKey]);
  const toGroup = async (mode: "share" | "png") => {
    if (shareBusy) return;
    if (ch.n < 7) {
      say("Completa el siete para compartir");
      return;
    }
    setShareBusy(true);
    try {
      const blob = prepared?.key === cartelKey ? prepared.blob : await cartelBlob(cartel, await crestImage());
      if (!blob) {
        say("Este navegador no puede crear el cartel");
        return;
      }
      const file = cartelFile(session.name);
      if (mode === "png") {
        download(blob, file);
        say("Cartel guardado como PNG");
        return;
      }
      const r = await shareCartel(blob, file, "Los siete · " + session.name, (match ? match.short + " · " : "") + hud.sysName + " · química " + ch.v);
      if (r === "downloaded") say("Cartel descargado: mándalo al grupo");
      else if (r === "shared") say("Cartel listo para el grupo");
    } catch (err) {
      console.error("No se pudo crear el cartel", err);
      say("No se ha podido crear el cartel");
    } finally {
      setShareBusy(false);
    }
  };
  const copyLink = async () => {
    if (!session.id) return;
    const url = boardLink(window.location.origin, session.id);
    try {
      await navigator.clipboard.writeText(url);
      say("Enlace copiado: pégalo en el grupo");
    } catch {
      say("Copia el enlace: " + url, undefined, 6000);
    }
  };

  // ── Ajustes ──
  const onShow = (k: ShowKey) => props.onPrefs({ show: { ...show, [k]: !show[k] } });
  const onCam = (c: "tv" | "top") => {
    if (c === cam) return;
    runFx(morph(null, { cam: true }));
    props.onPrefs({ cam: c });
  };
  const onGrid = () => {
    const on = !prefs.grid;
    props.onPrefs({ grid: on });
    if (on && canEdit && L.freeMode) commit(snapAll(L));
  };
  const oopNames = L.slots
    .map((s, i) => {
      const c = s.playerId ? sq.byId.get(s.playerId) : undefined;
      if (!c || fits(L, sq, c.id, slotZone(L, i))) return null;
      return c.name + " (" + (natOf(L, sq, c.id) ?? "?") + "›" + slotZone(L, i) + ")";
    })
    .filter((x): x is string => !!x);

  // The official must be a whole seven with a goalkeeper; what the team should know is asked first.
  const pubBlock =
    ch.n < 7 ? "Completa el siete para publicarlo (" + ch.n + "/7)." : !isFull(L, sq) ? "Pon un portero en la portería para publicarlo." : null;
  const pubWarn = [
    ...L.slots
      .map((s) => (s.playerId ? sq.byId.get(s.playerId) : undefined))
      .filter((c): c is NonNullable<typeof c> => !!c && (c.cv === "no" || !!c.baja))
      .map((c) => c.name + (c.cv === "no" ? " no va" : " " + (c.baja ?? "").toLowerCase())),
    ...oopNames.map((x) => x + " fuera de posición"),
  ];
  // The cartel goes to the group with the whole seven.
  const shareBlock = ch.n < 7 ? "Completa el siete para compartir (" + ch.n + "/7)." : null;

  // ── hint, save state, root ──
  const n = ch.n;
  const hint = !ready
    ? "Cargando la plantilla y tus tableros…"
    : ro
      ? session.official
        ? "Estás viendo el oficial: solo lectura. Duplícalo para editarlo."
        : "Tablero de @" + session.owner + ": solo lectura. Duplícalo para editarlo."
      : modo === "quimica"
        ? "Cada luz une a dos vecinos: oro ++, cielo +, discontinua –. Cambia un cromo y mira cómo se reenciende."
        : modo === "comparar"
          ? "En el campo: oro discontinuo = entra, rojo = sale."
          : sel?.k === "p"
            ? nm(sel.id) + " en la mano: toca otro cromo para cambiarlos, o tócalo otra vez para su ficha."
            : sel?.k === "b"
              ? nm(sel.id) + " en la mano: toca un hueco o un cromo del campo."
              : n === 0
                ? "Toca un hueco para empezar, o abre un sobre con «Sugerir siete»."
                : L.freeMode
                  ? "Arrastra o toca un cromo. Mantén pulsado para galones. En libre, cada cromo se queda donde lo sueltes."
                  : "Arrastra o toca un cromo. Mantén pulsado para galones. Desliza la línea azul para subir o bajar la defensa.";
  const saveTxt = ro
    ? session.official
      ? "Oficial · solo lectura"
      : "Solo lectura · de @" + session.owner
    : !ready
      ? "Cargando…"
      : session.status === "draft"
        ? "Nuevo · se guarda solo"
        : session.status === "saving"
          ? "Guardando…"
          : session.status === "offline"
            ? "Sin conexión · se guarda al volver"
            : session.status === "error"
              ? "Sin guardar · revisa la conexión"
              : "Guardado · " + ago(session.savedAt, props.now);
  const intro = ready && !introDone && !rm;
  const rootCls = [
    "vx",
    "pzv",
    "m-" + (modo === "charla" ? "charla-pronto" : modo),
    intro ? "intro" : "",
    hud.qUp || hud.celeOn ? "cheer" : "",
    modo === "quimica" || show.chem ? "s-chem" : "",
    showPlan ? "t-plan" : "",
    show.num ? "" : "h-num",
    show.name ? "" : "h-name",
    show.pos ? "" : "h-pos",
    show.gal ? "" : "h-gal",
    show.rt ? "" : "h-rt",
    fx.cam && fx.from ? "cam-move" : "",
    L.freeMode && prefs.grid ? "grid-on" : "",
    dragKind === "tok" ? "dragging" : "",
    dragKind === "line" ? "dl-drag" : "",
    !ready ? "loading" : "",
    toast ? "toasting" : "",
  ].filter(Boolean).join(" ");
  const shown: ReactNode =
    modo === "editar" ? (
      tray ? (
        <Tray d={tray} onPrev={() => trPage(-1)} onNext={() => trPage(1)} onClose={trClose} onCard={trCard} onGal={trGal} onPos={trPos} onBench={trBench} onFicha={trFicha} onFan={trFan} />
      ) : (
        <>
          <OnceTabs tab={tab} onTab={onTab} />
          {tab === "b" && (
            <BenchTab
              ro={!canEdit}
              hot={dragFrom === "pitch"}
              recentLabel={sq.recentLabel}
              rail={rail}
              selBench={sel?.k === "b" ? sel.id : null}
              meId={props.meId}
              railPage={{ n: rpi + 1, of: railPages }}
              seasonName={props.seasonName}
              q={q}
              zf={zf}
              oc={ocOn}
              ocOff={!answered}
              convTxt={convTxt}
              seasons={props.seasons}
              seasonId={props.seasonId}
              bajas={bajas}
              counts={counts}
              rep={rep}
              repTxt={repTxt}
              canRotate={!!rot}
              galLeg={galLeg}
              onSuggest={doSuggest}
              onAuto={doAuto}
              onTapBench={tapBench}
              onRailNext={() => setRp((rpi + 1) % railPages)}
              onQ={(v) => {
                setQ(v);
                setRp(0);
              }}
              onZf={(z) => {
                setZf(z);
                setRp(0);
              }}
              onOc={() => {
                setOc(!oc);
                setRp(0);
              }}
              onSeason={props.onSeason}
              onRotate={doRotate}
            />
          )}
          {tab === "s" && (
            <SystemTab
              formation={L.formation}
              free={L.freeMode}
              grid={prefs.grid}
              ro={!canEdit}
              onSystem={(f: FormationName) => canEdit && toSystem(setSystem(L, f))}
              onLibre={() => {
                if (!canEdit || L.freeMode) return;
                commit(goFree(L));
                say("Modo libre: arrastra cada cromo donde quieras");
              }}
              onGrid={onGrid}
              onReset={() => {
                if (!canEdit) return;
                commit(resetFree(L));
                say("Posiciones del sistema " + L.formation);
              }}
            />
          )}
          {tab === "p" && <PlanTab rows={tac} ro={!canEdit} onSet={onTactic} />}
        </>
      )
    ) : modo === "mas" ? (
      <MasPanel tacSum={tacSum} onGo={goModo} />
    ) : modo === "quimica" ? (
      <QuimicaPanel ch={ch} sq={sq} seasonName={props.seasonName} oop={oopNames} />
    ) : modo === "tableros" ? (
      <TablerosPanel
        tab={tbTab}
        onTab={setTbTab}
        onBack={() => goModo("mas")}
        ready={ready}
        id={session.id}
        name={session.name}
        ro={ro}
        saveTxt={saveTxt}
        saveCls={ro ? "ro" : session.status}
        seasonName={props.seasonName}
        boards={boardRows}
        canDelete={isMine && !ro && session.mine.length >= 2}
        onRename={(v) => session.rename(v)}
        onDuplicate={() => {
          session
            .copyBoard(null, true)
            .then(() => say("Duplicado: ya estás en la copia"))
            .catch(tbFail);
        }}
        onNew={() => {
          session
            .newBoard()
            .then(() => say("Tablero nuevo: toca un hueco para empezar"))
            .catch(tbFail);
        }}
        onOpen={(bid) => {
          if (bid === session.id) return;
          runFx(morph(null));
          session.open(bid);
          say("Abierto: " + (session.mine.find((d) => d.id === bid)?.name ?? "tablero"));
        }}
        onCopy={(bid) => {
          session
            .copyBoard(bid, false)
            .then((v) => say("Duplicado: " + v))
            .catch(tbFail);
        }}
        onDelete={(bid) => {
          const was = session.mine.find((d) => d.id === bid)?.name ?? "Tablero";
          const undoDel = session.remove(bid);
          buzz([20, 40, 20]);
          say(
            "«" + was + "» borrado",
            {
              label: "Deshacer",
              aria: "Deshacer el borrado de «" + was + "»",
              run: () => {
                undoDel();
                say("«" + was + "» recuperado");
              },
            },
            DELETE_MS,
          );
        }}
        official={offView}
        reactions={props.reactions}
        isCap={props.isAdmin}
        scopeMatch={linked ?? props.nextMatch}
        onScreenOfficial={session.official ? { matchId: session.matchId } : null}
        canPublish={canEdit}
        pubBlock={pubBlock}
        pubWarn={pubWarn}
        onViewOfficial={() => {
          if (!off) return;
          runFx(morph(null));
          if (off.id === session.id) session.openMine();
          else session.open(off.id);
          buzz(10);
        }}
        onDupOfficial={() => {
          if (!off) return;
          session
            .copyBoard(off.id, true)
            .then(() => say("Copia creada: ya puedes editar"))
            .catch(tbFail);
        }}
        onReact={(v) => {
          const r = props.reactions;
          if (!r) return;
          buzz(10);
          r.react(nextReaction(r.mine, v)).catch(tbFail);
        }}
        onPublish={(mid) =>
          pubBlock
            ? Promise.resolve(say(pubBlock))
            : session
                .publish(mid)
                .then(() => {
                  buzz([20, 40, 60]);
                  say("Publicado como oficial · " + (mid ? "este partido" : "toda la temporada"));
                })
                .catch(tbFail)
        }
        onUnpublish={(oid) => {
          session
            .unpublish(oid)
            .then(() => say("Ya no hay oficial publicado"))
            .catch(tbFail);
        }}
        calendar={cal}
        matchId={session.matchId}
        onLink={(mid) => {
          const m = calById(mid);
          session
            .linkMatch(mid)
            .then(() => say(mid ? "Vinculado a " + (m ? matchLabel(m) : "el partido") : "Sin partido vinculado"))
            .catch(tbFail);
        }}
        seasons={props.seasons}
        seasonId={props.seasonId}
        onSeason={props.onSeason}
      />
    ) : modo === "comparar" ? (
      <CompararPanel
        options={cmpOpts}
        cmpId={cmpId}
        aName={session.name}
        bName={cmpOpts.find((o) => o.id === cmpId)?.name ?? ""}
        rows={LB ? tape(L, LB, sq) : []}
        ins={chg.ins.map(nm)}
        outs={chg.outs.map(nm)}
        onPick={(v) => {
          setCmpPick(v);
          buzz(8);
        }}
        onBack={() => goModo("mas")}
        onBoards={() => goModo("tableros")}
      />
    ) : modo === "compartir" ? (
      <CompartirPanel cartel={cartel} block={shareBlock} busy={shareBusy} canLink={!!session.id} onShare={() => void toGroup("share")} onPng={() => void toGroup("png")} onLink={() => void copyLink()} onBack={() => goModo("mas")} />
    ) : modo === "ajustes" ? (
      <AjustesPanel
        show={show}
        cam={cam}
        v3={prefs.v3}
        snd={prefs.snd}
        day={props.theme.day}
        grid={prefs.grid}
        seasons={props.seasons}
        seasonId={props.seasonId}
        galLeg={galLeg}
        onShow={onShow}
        onCam={onCam}
        on3d={() => {
          const on = !prefs.v3;
          props.onPrefs({ v3: on });
          say(on ? "3D en las jugadas y la charla, si este dispositivo puede" : "Vista 2D");
        }}
        onSnd={() => props.onPrefs({ snd: !prefs.snd })}
        onDay={props.theme.toggle}
        onGrid={onGrid}
        onSeason={props.onSeason}
        onBack={() => goModo("mas")}
      />
    ) : (
      <SoonPanel modo={modo} onBack={() => goModo("mas")} />
    );

  return (
    <div
      ref={rootRef}
      className={rootCls}
      data-modo={modo}
      data-snap={snap}
      aria-busy={!seenReady}
      style={vars({ "--kp": fit.kp, "--kh": fit.kh, "--fh": C.Fh })}
      onPointerDown={ctl.onPointerDown}
      onKeyDown={onKey}
      onContextMenu={(e) => {
        // a long press on a cromo opens the fan, not the browser's menu
        if ((e.target as Element).closest("[data-tok],[data-dline],[data-grab]")) e.preventDefault();
      }}
    >
      <div className="vx-grain" aria-hidden="true" />
      {props.header}
      <section className="app" aria-label="La pizarra" ref={appRef}>
        <Stage
          cam={cam}
          view={view}
          plan={plan}
          hud={hud}
          wmY={(proj(C, 50, 37).y - 15).toFixed(2)}
          sysk={sysk}
          ro={!canEdit}
          editing={modo === "editar"}
          showGal={show.gal}
          kb={u.kb}
          selId={sel?.id ?? null}
          celeSub={hud.sysName + " · QUÍMICA " + hud.qv}
          rw={rm ? "" : fx.rw}
          fxk={fx.k}
          pulse={(TEMPO_PULSE[L.tactics.tempo] ?? 2.4) + "s"}
          cmp={cmp}
          frameRef={frameRef}
          swpRef={swpRef}
          onCard={tapCard}
          onSlot={tapSlot}
          onLine={cycleLine}
          onSys={(d) => canEdit && toSystem(stepSystem(L, d))}
          onSysPick={goSis}
          onQuimica={() => goModo("quimica")}
        />
        <AppBar
          crest={props.crest}
          name={session.name}
          saveTxt={saveTxt}
          saveCls={ro ? "ro" : session.status}
          hud={hud}
          noUndo={!canEdit || !u.hist.past.length}
          noRedo={!canEdit || !u.hist.future.length}
          onName={() => goModo("tableros")}
          onUndo={doUndo}
          onRedo={doRedo}
          onCharla={() => goModo("charla")}
        />
        {ro && ready && <ReadOnlyStrip label={session.official ? "OFICIAL · SOLO LECTURA" : "SOLO LECTURA · @" + session.owner.toUpperCase()} onDuplicate={session.duplicate} onMine={session.openMine} />}
        <p className="hint" aria-live="polite">
          <i aria-hidden="true" />
          <span key={hint}>{hint}</span>
        </p>
        <Sheet title={SHEET_TITLE[modo]} snap={snap} mk={mk} sheetRef={sheetRef} onCycle={cycleSnap} onStep={stepSnap}>
          {shown}
        </Sheet>
        <ModeBar modo={modo} onGo={goModo} />
        {fan && (
          <Fan
            cx={fan.cx}
            cy={fan.cy}
            num={sq.byId.get(fan.id)?.num ?? 0}
            title={nm(fan.id) + " · " + slotLabel(L, L.slots.findIndex((s) => s.playerId === fan.id))}
            items={fanList}
            onItem={onFanItem}
            onClose={() => patchUi({ fan: null })}
          />
        )}
        {ficha && fic && (
          <Ficha
            f={ficha}
            rm={rm}
            onFlip={() => {
              patchUi({ fic: { ...fic, side: fic.side === "front" ? "back" : "front" } });
              snd("flip");
            }}
            onClose={() => patchUi({ fic: null })}
          />
        )}
        <div className={"tst" + (toast ? " on" : "")} role="status" aria-live="polite">
          <Icon n="check" w={18} />
          <span>{toast?.msg ?? ""}</span>
          {toast?.act && (
            <button
              type="button"
              className="tst-a"
              aria-label={toast.act.aria}
              onClick={() => {
                const run = toast.act?.run;
                setToast(null);
                run?.();
              }}
            >
              {toast.act.label}
            </button>
          )}
        </div>
        <p className="sr" aria-live="polite">
          {live.msg + (live.n % 2 ? "​" : "")}
        </p>
        <div className="pz-dragl" ref={layerRef} aria-hidden="true" />
      </section>
      {props.footer}
    </div>
  );
}
