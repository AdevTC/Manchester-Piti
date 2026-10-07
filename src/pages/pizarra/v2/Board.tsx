// La pizarra «Noche de partido» — the app screen. The stadium fills the screen; the bench and the tools
// live in a bottom sheet with three snap points above the mode bar (desktop: a mode rail and one panel).
// Every change goes through commit(): history (undo/redo as a rewind), the morph of every cromo from
// where it was, the química ripple, the 7/7 celebration and the board's autosave (the session).
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { FormationName, Lineup, RoleKey, Zone } from "../formations";
import { ZONES } from "../formations";
import { CAMS, proj, slotLabel, slotPos, slotZone, TEMPO_PULSE } from "./geometry";
import { GALONES, isAvailable, isFull, natOf, type Squad } from "./model";
import { chem } from "./quimica";
import { autoPlace, cycleDefLine, goFree, place, resetFree, resolveDrop, setDefLine, setPlaysAs, setSystem, snapAll, stepSystem, swap, toBench, toggleRole } from "./ops";
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
import { AppBar, BenchTab, MasPanel, ModeBar, OnceTabs, PlanSoon, ReadOnlyStrip, Sheet, SoonPanel, SystemTab, Tray, type OnceTab, type RepRow, type TrayData } from "./Panels";
import { Fan, Ficha, type FichaView } from "./Overlays";
import { Icon } from "./icons";

export interface BoardPrefs {
  snd: boolean;
  grid: boolean;
}

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
  const cam = "tv" as const;
  const C = CAMS[cam];

  const [rm] = useState(reducedMotion);
  const [modo, setModo] = useState<Modo>("editar");
  const [snap, setSnap] = useState<Snap>("peek");
  const [tab, setTab] = useState<OnceTab>("b");
  const [mk, setMk] = useState(0);
  const [sysk, setSysk] = useState(0);
  const [ui, setUi] = useState<Ui>({ key: session.key, ...UI0 });
  const [fx, setFx] = useState<Fx>(FX0);
  const [toast, setToast] = useState("");
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
  const nm = (id: string) => sq.byId.get(id)?.name ?? "Jugador";
  const onPitch = new Set(L.slots.map((s) => s.playerId).filter((x): x is string => !!x));
  let sel = u.sel;
  if (sel && (sel.k === "p" ? !onPitch.has(sel.id) : onPitch.has(sel.id) || !sq.byId.has(sel.id))) sel = null;
  const pick = u.pick != null && u.pick >= 0 && u.pick < L.slots.length ? u.pick : null;
  const fan = u.fan && onPitch.has(u.fan.id) ? u.fan : null;
  const fic = u.fic && sq.byId.has(u.fic.id) ? u.fic : null;
  const view = pitchView({ L, sq, ch, cam, modo, fx, selId: sel?.id ?? null, pick, ro: !canEdit, rm, meId: props.meId });
  const plan = planLayer(L, cam, modo);
  const match = props.match;
  const hud = buildHud(L, sq, ch, fx, rm, match);
  const tacSum = tacSummary(L);

  const say = (msg: string) => {
    window.clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = window.setTimeout(() => setToast(""), 2600);
  };
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
  const benchF = benchAll.filter(
    (c) => !c.baja && (!qq || c.name.toLowerCase().includes(qq) || String(c.num) === qq) && (zf === "Todos" || c.pos === zf) && (!oc || (c.cv ?? "voy") === "voy"),
  );
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
    say(nm(heldId) + " juega de " + z + " en este once");
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
      else if (!ln.length) ln = [{ k: "Sin vecinos cerca en este once", v: "" }];
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
    modo === "quimica" ? "s-chem" : "",
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
              oc={oc}
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
              onGrid={() => {
                const on = !prefs.grid;
                props.onPrefs({ grid: on });
                if (on && canEdit && L.freeMode) commit(snapAll(L));
              }}
              onReset={() => {
                if (!canEdit) return;
                commit(resetFree(L));
                say("Posiciones del sistema " + L.formation);
              }}
            />
          )}
          {tab === "p" && <PlanSoon />}
        </>
      )
    ) : modo === "mas" ? (
      <MasPanel tacSum={tacSum} onGo={goModo} />
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
      style={vars({ "--kp": fit.kp, "--kh": fit.kh })}
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
          showGal
          kb={u.kb}
          selId={sel?.id ?? null}
          celeSub={hud.sysName + " · QUÍMICA " + hud.qv}
          rw={rm ? "" : fx.rw}
          fxk={fx.k}
          pulse={(TEMPO_PULSE[L.tactics.tempo] ?? 2.4) + "s"}
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
          <span>{toast}</span>
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
