// La pizarra «Noche de partido» — the app screen. The stadium fills the screen; the bench and the tools
// live in a bottom sheet with three snap points above the mode bar (desktop: a mode rail and one panel).
// Every change goes through commit(): history (undo/redo as a rewind), the morph of every cromo from
// where it was, the química ripple, the 7/7 celebration and the board's autosave (the session).
// Around the board: the plan painted on the pitch, the química panel, your boards and the official,
// Comparar (the differences on the pitch), Compartir (the cartel) and Ajustes; the telestrator (Dibujar:
// strokes of light saved with the board, with their own undo) and the jugadas (the library and your own,
// the editor, the «REPETICIÓN» replay with its follow-cam and, where the device can, «En 3D»). Strokes and
// jugadas are saved through the session too, but kept out of the lineup's undo/redo. La charla presents
// it all before the match (the system, the seven one by one, the plan, the jugada, «¡A por ellos!»),
// read-only boards included. One 3D stadium serves the intro, the charla and the jugadas.
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
import { cycle, settle, stageFit, step, type Snap } from "./sheet";
import { DIR_KEYS, slotInDirection } from "./drag";
import { ago, FX0, fxDuration, hud as buildHud, pitchView, planLayer, positionsOf, tacSummary, vars, type Fx, type Modo } from "./view";
import { useDragController } from "./useDragController";
import { useBoardSound, buzz } from "./sound";
import { plural } from "./plural";
import { useNoScrollJump } from "./useNoScrollJump";
import type { BoardSession } from "./useBoardSession";
import { Stage } from "./Stage";
import { AppBar, BenchTab, MasPanel, ModeBar, OnceTabs, ReadOnlyStrip, Sheet, SystemTab, Tray, type OnceTab, type RepRow, type TrayData } from "./Panels";
import { AjustesPanel, CompararPanel, CompartirPanel, PlanTab, QuimicaPanel } from "./SheetPanels";
import { SHOW0, type BoardPrefs, type ShowKey } from "./prefs";
import { TablerosPanel, type BoardRowView, type ReactionsView, type TbTab } from "./Tableros";
import { Fan, Ficha, type FichaView } from "./Overlays";
import { Icon } from "./icons";
import { setTactic, tacRows } from "./plan";
import { changes, cmpMarks, tape } from "./compare";
import { boardLink, boardMeta, convCounts, matchLabel, matchShort, type CalMatch } from "./boards";
import { charlaJugada, charlaLast, charlaView, pushIn, STEP_JUGADA, stepKind, type CharlaMatch } from "./charla";
import { useCharla } from "./useCharla";
import { CharlaGuion, CharlaOverlay } from "./CharlaOverlay";
import { DEAL_MS, INTRO_2D_MS, INTRO_MAX_MS, INTRO_WAIT_MS, introKind, introSeen, markIntroSeen, type IntroKind } from "./intro";
import { engineCast, engineDriven, enginePasos, engineSeven, type Shot } from "./director";
import { cartelBlob, cartelFile, cartelLayout, crestImage, download, shareCartel } from "./cartel";
import { DELETE_MS } from "./useBoardSession";
import { deepHash } from "./deeplink";
import { extractLineup, type LineupDoc } from "../lineupDoc";
import { nextReaction, type ReactionValue } from "../reactions";
import { apiError } from "../../../lib/clubApi";
import { PIZARRA_LIMITS } from "../../../lib/schemas";
import { addStroke, canAddStroke, clearStrokes, makeStroke, newId, removeStroke, undoStroke, type Stroke, type StrokeColor, type StrokeKind } from "../drawings";
import {
  addRival,
  canAddPlay,
  duplicateFrame,
  duplicatePlay,
  engineRivals,
  moveBall,
  moveFrame,
  movePlayer,
  moveRival,
  removeFrame,
  removePlay,
  removeRival,
  renamePlay,
  savePlay,
  setFrameText,
  toEngineFrames,
  validatePlay,
  type Play,
} from "../plays";
import { unsupportedReason, type Unsupported } from "../../../components/pitch3d/support";
import { framePointToPitch, hitStroke, inkView, pushInk, strokeLabel, TOOL_HINT } from "./telestrator";
import {
  addPlayers,
  DEFAULT_JUGADA,
  dropPlayers,
  forkName,
  forkPlay,
  goneFrom,
  jugadaList,
  jugadaStage,
  missingFrom,
  ownName,
  participants,
  pickJugada,
  playFromBoard,
  rederive,
  replayHud,
  rivalSpot,
} from "./jugadas";
import { useReplay, type ReplayMove } from "./useReplay";
import { JugadasPanel, type JugadaEditorView } from "./JugadasPanel";
import { DibujarPanel } from "./DibujarPanel";
import { Board3D } from "./Board3D";

export interface BoardProps {
  session: BoardSession;
  squad: Squad;
  seasonId: string;
  seasonName: string;
  seasons: { id: string; name: string }[];
  onSeason: (id: string) => void;
  /** The board's match, for its name on the LED boards and the charla («J8 · MAD SKY», «sáb 8 nov»,
   *  «12:00», «J8»). */
  match: CharlaMatch | null;
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
  /** The telestrator's own undo: the strokes as they were before each change. */
  ink: Stroke[][];
  /** The stroke marked on the pitch (Dibujar), and the rival marked in a jugada's paso. */
  inkSel: string | null;
  rivSel: string | null;
}
const UI0 = { sel: null, pick: null, fan: null, fic: null, hist: EMPTY_HISTORY, kb: null, ink: [], inkSel: null, rivSel: null };

const reducedMotion = (): boolean => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Deep links into a panel: /pizarra#comparar, #compartir, #tableros, #ajustes, #quimica, #plan, #jugadas,
// #dibujar, and #charla (the link the captain sends to the group).
const HASH_MODOS: Modo[] = ["quimica", "jugadas", "dibujar", "mas", "tableros", "comparar", "compartir", "ajustes", "charla"];
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

const LIM = PIZARRA_LIMITS;
const PLAYS_FULL = "Ya hay " + plural(LIM.plays, "jugada propia", "jugadas propias") + " en este tablero: borra una para guardar otra.";
const PASOS_MSG = "Una jugada tiene entre " + LIM.framesMin + " y " + LIM.framesMax + " pasos.";
const NO_3D = "Este dispositivo no muestra el estadio 3D: la jugada se ve con la cámara 2D que sigue al balón.";
const FAIL_3D = "El estadio 3D no ha podido arrancar: la jugada se ve con la cámara 2D que sigue al balón.";

const snapOf = (m: Modo): Snap => (m === "quimica" || m === "mas" || m === "comparar" ? "half" : m === "tableros" || m === "compartir" || m === "ajustes" ? "full" : "peek");

type IntroPhase = "wait" | "run" | "done";

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
  const [fit, setFit] = useState({ kp: 1, kh: 0.64, kd: 1 });
  // Dibujar: the tool, the colour, the text for the field, and the strokes drawn in this visit (they
  // light up at once; the ones already there light up one after another).
  const [tool, setTool] = useState<StrokeKind>("carrera");
  const [inkColor, setInkColor] = useState<StrokeColor>("gold");
  const [inkText, setInkText] = useState("¡PRESIÓN!");
  const [fresh, setFresh] = useState<ReadonlySet<string>>(() => new Set());
  // Jugadas: which one, the replay's toggles, the crest wipe, the 3D stadium.
  const [jidPick, setJid] = useState<string>(DEFAULT_JUGADA);
  const [spd, setSpd] = useState(false);
  const [onion, setOnion] = useState(true);
  const [trails, setTrails] = useState(true);
  const [rivOn, setRivOn] = useState(true);
  const [ballOn, setBallOn] = useState(true);
  const [wipe, setWipe] = useState<number | null>(() => (start.modo === "jugadas" && !rm ? 1 : null));
  // Opened on the jugadas by a link: they play until the first touch (as designed).
  const [untouched, setUntouched] = useState(start.modo === "jugadas" && !rm);
  // The opening (once per session, see intro.ts) and whether this device gets the 3D (asked the first
  // time it is wanted: the 3D intro, a link straight to the charla or the jugadas; undefined = not yet).
  const [boot] = useState(() => {
    let why: Unsupported | null | undefined;
    const ask = (): Unsupported | null => (why === undefined ? (why = unsupportedReason()) : why);
    const where = start.modo === "charla" ? "charla" : start.modo === "jugadas" ? "jugadas" : "board";
    const kind = introKind({ rm, seen: introSeen(), v3: prefs.v3, why3d: ask, start: where });
    if (where !== "board" && prefs.v3 && !rm) ask();
    return { kind, why };
  });
  const [intro, setIntro] = useState<{ kind: IntroKind; phase: IntroPhase }>({ kind: boot.kind, phase: boot.kind === "none" ? "done" : boot.kind === "3d" ? "wait" : "run" });
  // The cromos deal in as the 2D board comes back after the 3D intro.
  const [hand, setHand] = useState(false);
  const [sup3d, setSup3d] = useState<Unsupported | null | undefined>(boot.why);
  const [fail3d, setFail3d] = useState(false);
  const [ready3d, setReady3d] = useState(false);
  // The stadium, once a 3D moment has wanted it, stays (paused) for the next one.
  const [mount3d, setMount3d] = useState(false);
  // The jugada picked in Jugadas (else the charla presents the board's first own one, or the córner).
  const [jChosen, setJChosen] = useState(false);
  // Loading only counts until the board has shown once (a later blip must not jump the footer).
  const [seenReady, setSeenReady] = useState(ready);
  if (ready && !seenReady) setSeenReady(true);

  const rootRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const swpRef = useRef<SVGPathElement>(null);
  const liveRef = useRef<SVGPathElement>(null);
  const fxTimer = useRef(0);
  const toastTimer = useRef(0);
  const wipeTimer = useRef(0);
  const sndTimer = useRef(0);
  /** Where everything was drawn at the last render (frame %), for the next glide to start from. */
  const drawn = useRef<{ p: Record<string, [number, number]>; r: Record<string, [number, number]>; b: [number, number] | null } | null>(null);
  const snd = useBoardSound(prefs.snd);
  // Turning the sound on answers with a «clac» (as designed; it is still the tap's gesture).
  const sndWas = useRef(prefs.snd);
  const sndLatest = useRef(snd);
  useEffect(() => {
    sndLatest.current = snd;
  });
  useEffect(() => {
    const was = sndWas.current;
    sndWas.current = prefs.snd;
    if (!prefs.snd || was) return;
    const t = window.setTimeout(() => sndLatest.current("clac"), 30);
    return () => window.clearTimeout(t);
  }, [prefs.snd]);
  // No tap on the board may move the page (only the user scrolls it).
  useNoScrollJump(rootRef);

  // Per-board UI (selection, menus, history) belongs to the board on screen.
  const u: Ui = ui.key === session.key ? ui : { key: session.key, ...UI0 };
  const patchUi = (patch: Partial<Ui>) => setUi((prev) => ({ ...(prev.key === session.key ? prev : { key: session.key, ...UI0 }), ...patch }));

  useEffect(
    () => () => {
      window.clearTimeout(fxTimer.current);
      window.clearTimeout(toastTimer.current);
      window.clearTimeout(wipeTimer.current);
      window.clearTimeout(sndTimer.current);
    },
    [],
  );
  // This visit has had its opening: later ones in the session find the board at rest.
  useEffect(() => markIntroSeen(), []);
  // The opening crest wipe (a link straight to the jugadas) goes once it has crossed.
  useEffect(() => {
    if (wipe == null) return;
    window.clearTimeout(wipeTimer.current);
    wipeTimer.current = window.setTimeout(() => setWipe(null), 1200);
  }, [wipe]);
  // The 2D intro (floodlights on, crane down onto the pitch, cromos dealt) once the board has loaded.
  useEffect(() => {
    if (!ready || intro.kind !== "2d" || intro.phase !== "run") return;
    const t = window.setTimeout(() => setIntro((i) => (i.kind === "2d" ? { ...i, phase: "done" } : i)), INTRO_2D_MS);
    return () => window.clearTimeout(t);
  }, [ready, intro.kind, intro.phase]);
  // The 3D intro: the stadium has a moment from the page opening to be up with the board, else the 2D
  // crane plays instead; once running it never lasts longer than INTRO_MAX_MS.
  useEffect(() => {
    if (intro.kind !== "3d" || intro.phase === "done") return;
    const waiting = intro.phase === "wait";
    const t = window.setTimeout(() => {
      if (waiting) setIntro({ kind: "2d", phase: "run" });
      else {
        setIntro({ kind: "3d", phase: "done" });
        setHand(true);
      }
    }, waiting ? INTRO_WAIT_MS : INTRO_MAX_MS);
    return () => window.clearTimeout(t);
  }, [intro.kind, intro.phase]);
  if (intro.kind === "3d" && intro.phase === "wait" && ready && ready3d) setIntro({ kind: "3d", phase: "run" });
  useEffect(() => {
    if (!hand) return;
    const t = window.setTimeout(() => setHand(false), DEAL_MS);
    return () => window.clearTimeout(t);
  }, [hand]);
  // The pitch is scaled to fit: on phones and tablets between the app bar and the sheet (at peek, and at
  // half for the dolly back), whatever the screen's height — the sheet never covers it; on desktop above
  // the screen's bottom (the top-down camera is taller than the TV one). See stageFit.
  useEffect(() => {
    const app = appRef.current;
    if (!app || typeof ResizeObserver === "undefined") return;
    const ro2 = new ResizeObserver(() => {
      const w = app.clientWidth;
      const h = app.clientHeight;
      if (!w || !h) return;
      const { kp, kh, kd } = stageFit(w, h, C.Fh);
      setFit((f) =>
        Math.abs(f.kp - kp) < 0.005 && Math.abs(f.kh - kh) < 0.005 && Math.abs(f.kd - kd) < 0.005 ? f : { kp: +kp.toFixed(3), kh: +kh.toFixed(3), kd: +kd.toFixed(3) },
      );
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
  const morph = (drop: Record<string, [number, number]> | null, extra: Partial<Fx> = {}): Fx => {
    const d = drawn.current;
    return {
      ...FX0,
      k: fx.k + 1,
      from: { ...(d?.p ?? positionsOf(L, cam)), ...(drop ?? {}) },
      rfrom: d?.r ?? null,
      bfrom: d?.b ?? null,
      q0: ch.v,
      ...extra,
    };
  };
  /** Strokes and jugadas: saved with the board, outside the lineup's undo (they keep their own). */
  const saveExtras = (next: Lineup): boolean => {
    if (!ready) return false;
    if (ro) {
      say(roMsg);
      return false;
    }
    session.commit(next);
    return true;
  };

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
    // the química scoreboard flips when its number changes
    if (chem(next, sq).v !== ch.v) {
      window.clearTimeout(sndTimer.current);
      sndTimer.current = window.setTimeout(() => snd("flip"), 180);
    }
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

  // ── jugadas: the library and yours, the replay, the editor ──
  const jl = useMemo(() => jugadaList(L), [L]);
  const cur = pickJugada(jl, jidPick);
  const jplay = cur.play;
  const nJ = jplay.frames.length;
  // The 3D stadium where the device can and «3D» is on; the jugadas want it while their replay plays.
  const can3d = prefs.v3 && sup3d === null && !fail3d;
  const want3d = modo === "jugadas" && can3d;
  const wipeNow = () => {
    if (!rm) setWipe((w) => (w ?? 0) + 1);
  };
  // every paso change glides the pieces from where they are drawn (and going round again wipes)
  const pasoGlide = (to: number, how: ReplayMove) => {
    if (how === "wrap") wipeNow();
    if (!rm) runFx(morph(null, { slow: true, long: spd }));
    // (the hint, which says the paso, is not shown over a jugada: the screen reader hears it here)
    if (how === "user") announce("Paso " + (to + 1) + " de " + nJ + ": " + (jplay.frames[to]?.title || "Paso " + (to + 1)));
  };
  const rpl = useReplay({
    key: session.key + ":" + jplay.id,
    n: nJ,
    slow: spd,
    loop: true,
    frozen: modo !== "jugadas" || (want3d && ready3d),
    autoplay: untouched && modo === "jugadas",
    onMove: pasoGlide,
  });
  const jf = rpl.frame;
  const live3d = want3d && ready3d && rpl.playing;
  const pieces = canEdit && modo === "jugadas" && !live3d;
  // the 2D stand-in for «Ver en 3D»: the TV camera follows the ball while it plays
  const follow = modo === "jugadas" && prefs.v3 && rpl.playing && !live3d;
  const cam3d = !prefs.v3 ? "" : live3d ? " · 3D" : follow || sup3d || fail3d ? " · CÁMARA TV" : "";
  const note3d = prefs.v3 && (fail3d || sup3d) ? (fail3d ? FAIL_3D : NO_3D) : null;
  const rivSel = u.rivSel && jplay.frames[jf]?.rivals.some((r) => r.id === u.rivSel) ? u.rivSel : null;

  /** Whether this device gets the 3D: asked once, the first time it is wanted (the stadium loads later). */
  const ask3d = (): Unsupported | null => {
    if (sup3d !== undefined) return sup3d;
    const r = unsupportedReason();
    setSup3d(r);
    return r;
  };
  const playToggle = () => {
    setUntouched(false);
    if (!rpl.playing && prefs.v3) ask3d();
    rpl.toggle();
  };
  const jStep = (d: 1 | -1) => {
    setUntouched(false);
    rpl.step(d);
  };
  const jSeek = (i: number) => {
    setUntouched(false);
    rpl.seek(i);
  };

  /**
   * Every change to a jugada goes through here: a built-in one becomes yours first (while there is
   * room), the arrows follow the moves, and it is checked before it is saved. `goTo` = the paso to show
   * after it. Returns the jugada saved, or null when nothing changed (`refused` says why, if anything).
   */
  const editJugada = (fn: (p: Play) => Play, refused: string, goTo?: number): Play | null => {
    if (!ready) return null;
    if (ro) {
      say(roMsg);
      return null;
    }
    const changed = fn(jplay);
    if (changed === jplay) {
      if (refused) say(refused);
      return null;
    }
    const list = L.plays ?? [];
    let next = rederive(changed);
    if (!cur.own) {
      if (!canAddPlay(list)) {
        say(PLAYS_FULL);
        return null;
      }
      next = { ...next, id: newId("j"), name: forkName(jplay.name, list.map((x) => x.name)) };
    }
    const errs = validatePlay(next);
    if (errs.length) {
      say(errs[0]);
      return null;
    }
    if (!saveExtras({ ...L, plays: savePlay(list, next) })) return null;
    if (!cur.own) {
      setJid(next.id);
      setJChosen(true);
      rpl.reset(session.key + ":" + next.id, false, goTo ?? jf);
      say("«" + jplay.name + "» ya es tuya: se guarda con el tablero");
    } else if (goTo != null && goTo !== jf) rpl.seek(goTo, next.frames.length);
    return next;
  };
  /** Brings back the board's jugadas as they were (a toast's Deshacer), if that board is still open. */
  const restorePlays = (k: string, plays: Play[], jid: string) => {
    const now = later.current;
    if (now.key !== k || !now.save({ ...now.L, plays })) return;
    setJid(jid);
  };
  const jPick = (id: string) => {
    setUntouched(false);
    setJid(id);
    setJChosen(true);
    rpl.reset(session.key + ":" + id, false);
    patchUi({ rivSel: null });
    if (!rm) runFx(morph(null, { slow: true }));
    wipeNow();
    buzz(8);
  };
  const jAddPaso = () => {
    const at = nJ;
    const r = editJugada(
      (p) => {
        if (p.frames.length >= LIM.framesMax) return p;
        const f = structuredClone(p.frames[jf] ?? p.frames[p.frames.length - 1]);
        delete f.note;
        return { ...p, frames: [...p.frames, { ...f, title: "Paso nuevo", arrows: [] }] };
      },
      PASOS_MSG,
      at,
    );
    // (a built-in jugada just made yours says that instead)
    if (r && cur.own) say("Paso " + (at + 1) + " añadido: mueve los cromos");
  };
  const jMovePaso = (i: number, d: 1 | -1) => {
    const to = i + d;
    editJugada((p) => moveFrame(p, i, to), "", jf === i ? to : jf === to ? i : jf);
  };
  const jCopyPaso = (i: number) => {
    if (editJugada((p) => duplicateFrame(p, i), PASOS_MSG, i + 1) && cur.own) say("Paso " + (i + 1) + " duplicado");
  };
  const jDelPaso = (i: number) => {
    const before = L.plays ?? [];
    const k = session.key;
    // (undoing it on a built-in jugada drops the copy that the cut made: the original is back)
    const was = jplay.id;
    if (!editJugada((p) => removeFrame(p, i), PASOS_MSG, Math.max(0, Math.min(jf > i ? jf - 1 : jf, nJ - 2)))) return;
    say((cur.own ? "" : "«" + jplay.name + "» ya es tuya · ") + "Paso " + (i + 1) + " quitado", { label: "Deshacer", aria: "Deshacer: recuperar el paso " + (i + 1), run: () => restorePlays(k, before, was) }, DELETE_MS);
  };
  const jTitle = (v: string) => editJugada((p) => setFrameText(p, jf, { title: v }), "");
  const jNote = (v: string) => editJugada((p) => setFrameText(p, jf, { note: v }), "");
  const jAddRival = () => {
    const r = editJugada((p) => addRival(p, rivalSpot(p)), "Como mucho siete rivales.");
    if (!r) return;
    setRivOn(true);
    const f = r.frames[Math.min(jf, r.frames.length - 1)];
    patchUi({ rivSel: f.rivals[f.rivals.length - 1]?.id ?? null });
    buzz(8);
  };
  const jDelRival = () => {
    const f = jplay.frames[jf];
    const id = rivSel ?? f?.rivals[f.rivals.length - 1]?.id;
    if (!id) return;
    if (editJugada((p) => removeRival(p, id), "")) {
      patchUi({ rivSel: null });
      buzz(8);
    }
  };
  const jAddMissing = () => {
    const miss = missingFrom(jplay, L);
    const r = editJugada((p) => {
      const q = addPlayers(p, miss, L);
      return participants(q).length === participants(p).length ? p : q;
    }, "No cabe nadie más: siete por paso.");
    if (r && cur.own) say(miss.length === 1 ? "Ya está en la jugada" : "Ya están en la jugada");
  };
  const jDropGone = () => {
    const gone = goneFrom(jplay, L);
    if (gone.length && editJugada((p) => dropPlayers(p, gone), "")) say(gone.length === 1 ? "Fuera de la jugada: ya no está en el siete" : "Fuera de la jugada: ya no están en el siete");
  };
  const jNew = () => {
    if (!ready) return;
    if (ro) {
      say(roMsg);
      return;
    }
    const list = L.plays ?? [];
    if (!canAddPlay(list)) {
      say(PLAYS_FULL);
      return;
    }
    const pl = playFromBoard(L, ownName(list));
    if (!pl) {
      say("Coloca a alguien en el campo para crear una jugada");
      return;
    }
    if (!saveExtras({ ...L, plays: savePlay(list, pl) })) return;
    setUntouched(false);
    setJid(pl.id);
    setJChosen(true);
    rpl.reset(session.key + ":" + pl.id, false);
    patchUi({ rivSel: null });
    if (!rm) runFx(morph(null, { slow: true }));
    buzz([10, 30, 10]);
    say("Jugada nueva: añade pasos y arrastra");
  };
  const jRename = (v: string) => {
    editJugada((p) => renamePlay(p, v), "");
  };
  const jDuplicate = () => {
    if (!ready) return;
    if (ro) {
      say(roMsg);
      return;
    }
    const list = L.plays ?? [];
    if (!canAddPlay(list)) {
      say(PLAYS_FULL);
      return;
    }
    const next = cur.own ? duplicatePlay(list, jplay.id) : savePlay(list, forkPlay(jplay, list.map((x) => x.name), newId("j")));
    if (next === list || !saveExtras({ ...L, plays: next })) return;
    const copy = next[next.length - 1];
    setJid(copy.id);
    setJChosen(true);
    rpl.reset(session.key + ":" + copy.id, false, jf);
    buzz(10);
    say("Copia guardada: «" + copy.name + "»");
  };
  const jDelete = () => {
    if (!cur.own) return;
    const before = L.plays ?? [];
    const k = session.key;
    const was = jplay;
    if (!saveExtras({ ...L, plays: removePlay(before, was.id) })) return;
    setJid(DEFAULT_JUGADA);
    rpl.reset(k + ":" + DEFAULT_JUGADA, false);
    patchUi({ rivSel: null });
    buzz([20, 40, 20]);
    say("«" + was.name + "» borrada", { label: "Deshacer", aria: "Deshacer el borrado de «" + was.name + "»", run: () => restorePlays(k, before, was.id) }, DELETE_MS);
  };
  // the pieces of the paso: our cromos, the rivals and the ball
  const onPiece = (piece: string, at: { X: number; Y: number; inside: boolean } | null) => {
    const kind = piece === "b" ? "b" : piece.slice(0, 2);
    const id = piece.slice(2);
    const back = (): void => {
      // let go off the pitch: it glides back to its spot
      if (!at) return;
      if (kind === "p:") runFx(morph({ [id]: [at.X, at.Y] }));
      else if (kind === "r:") runFx(morph(null, { rfrom: { ...(drawn.current?.r ?? {}), [id]: [at.X, at.Y] } }));
      else runFx(morph(null, { bfrom: [at.X, at.Y] }));
    };
    if (!at || !at.inside) return back();
    const pt = framePointToPitch(C, at.X, at.Y);
    if (kind === "b") {
      if (editJugada((p) => moveBall(p, jf, pt), "")) runFx(morph(null, { bfrom: [at.X, at.Y] }));
      else back();
    } else if (kind === "r:") {
      if (editJugada((p) => moveRival(p, jf, id, pt), "")) runFx(morph(null, { rfrom: { ...(drawn.current?.r ?? {}), [id]: [at.X, at.Y] } }));
      else back();
    } else if (kind === "p:") {
      if (editJugada((p) => movePlayer(p, jf, id, pt), "No caben más de siete en un paso.")) runFx(morph({ [id]: [at.X, at.Y] }, { rip: [id] }));
      else back();
    }
    buzz(12);
  };
  const onPieceTap = (piece: string) => {
    if (!piece.startsWith("r:")) return;
    const id = piece.slice(2);
    const on = rivSel !== id;
    patchUi({ rivSel: on ? id : null });
    buzz(8);
    if (on) announce("Rival marcado: «Quitar el rival marcado» lo quita de la jugada");
  };

  // ── Dibujar: strokes of light on the grass, with their own undo ──
  const strokes = L.drawings ?? [];
  const inkSel = u.inkSel && strokes.some((x) => x.id === u.inkSel) ? u.inkSel : null;
  const setInk = (next: Stroke[]): boolean => {
    if (!saveExtras({ ...L, drawings: next })) return false;
    patchUi({ ink: pushInk(u.ink, strokes), inkSel: null });
    return true;
  };
  const inkUndo = () => {
    if (!canEdit) return;
    if (u.ink.length) {
      if (!saveExtras({ ...L, drawings: u.ink[u.ink.length - 1] })) return;
      patchUi({ ink: u.ink.slice(0, -1), inkSel: null });
    } else if (strokes.length) {
      if (!saveExtras({ ...L, drawings: undoStroke(strokes) })) return;
      patchUi({ inkSel: null });
    } else return;
    buzz([6, 20, 6]);
    announce("Trazo deshecho");
  };
  /** A toast's Deshacer for the strokes (only while the same board is open). */
  const inkUndoAct = (aria: string): Toast["act"] => {
    const k = session.key;
    return { label: "Deshacer", aria, run: () => later.current.key === k && later.current.inkUndo() };
  };
  const inkDelete = (id: string) => {
    if (!strokes.some((x) => x.id === id) || !setInk(removeStroke(strokes, id))) return;
    buzz(10);
    say("Trazo borrado", inkUndoAct("Deshacer: recuperar el trazo"));
  };
  const inkClear = () => {
    if (!strokes.length || !setInk(clearStrokes())) return;
    buzz([20, 40, 20]);
    say("Césped limpio", inkUndoAct("Deshacer: recuperar los trazos"));
  };
  const onDraw = (pts: [number, number][], tap: boolean) => {
    if (!canEdit || !pts.length) return;
    if (tap && tool !== "texto") {
      // a tap marks the stroke under it (or lets go of the marked one)
      const id = hitStroke(strokes, C, pts[0][0], pts[0][1]);
      const next = id && id !== inkSel ? id : null;
      patchUi({ inkSel: next });
      const st = next ? strokes.find((x) => x.id === next) : undefined;
      if (st) {
        buzz(8);
        announce("Marcado: " + strokeLabel(st) + ". «Borrar trazo» lo quita.");
      }
      return;
    }
    if (!canAddStroke(strokes)) {
      say("Ya hay " + plural(LIM.strokes, "trazo") + ": borra alguno para dibujar más");
      return;
    }
    if (tool === "texto" && !inkText.trim()) {
      say("Escribe el texto antes de tocar el césped");
      return;
    }
    const st = makeStroke(
      tool,
      inkColor,
      pts.map(([x, y]) => framePointToPitch(C, x, y)),
      inkText,
    );
    if (!st) {
      say(tool === "zona" ? "Arrastra en diagonal para marcar la zona" : "Trazo muy corto: arrastra un poco más");
      return;
    }
    const next = addStroke(strokes, st);
    if (next === strokes) {
      say("Ese trazo no se puede guardar");
      return;
    }
    if (!setInk(next)) return;
    setFresh((f) => new Set(f).add(st.id));
    buzz(10);
  };

  // Latest values for the toasts' Deshacer (they run later, maybe on another board).
  const later = useRef({ key: session.key, L, save: saveExtras, inkUndo });
  useEffect(() => {
    later.current = { key: session.key, L, save: saveExtras, inkUndo };
  });

  // ── the 3D stadium: «En 3D» and the board's other 3D moments ──
  const on3dFail = (why: "unsupported" | "failed") => {
    setReady3d(false);
    // an opening still waiting for the stadium plays in 2D; one already running ends
    setIntro((i) => (i.kind !== "3d" || i.phase === "done" ? i : i.phase === "wait" ? { kind: "2d", phase: "run" } : { ...i, phase: "done" }));
    if (why === "unsupported") setSup3d("no-webgl2");
    else {
      setFail3d(true);
      say("El 3D no ha podido arrancar: seguimos en 2D");
    }
  };
  const toggle3d = () => {
    const on = !prefs.v3;
    props.onPrefs({ v3: on });
    if (!on) {
      say("Vista 2D");
      return;
    }
    setFail3d(false);
    say(ask3d() ? "Sin 3D aquí: cámara de televisión que sigue al balón" : "Ver en 3D: la jugada se juega en el estadio");
  };
  /** The 3D intro is skipped (a tap, «Saltar», another mode): the 2D board crossfades in. */
  const skipIntro = () => {
    if (intro.kind !== "3d" || intro.phase === "done") return;
    setIntro({ kind: "3d", phase: "done" });
    if (intro.phase === "run") setHand(true);
  };
  const intro3d = intro.kind === "3d" && intro.phase !== "done";

  // ── la charla ──
  const charlaOn = modo === "charla";
  const chItem = charlaJugada(jl, jChosen ? cur : null);
  const chPlay = chItem.play;
  const chLast = charlaLast(chPlay.frames.length);
  const chSlots = L.slots.map((s) => (s.playerId && sq.byId.has(s.playerId) ? s.playerId : null));
  const live3dC = charlaOn && can3d && ready3d;
  const chArgs = { L, sq, play: chPlay, playShort: chItem.short, match, boardName: session.name, sysName: hud.sysName, tacSum, qv: ch.v, in3d: live3dC, loading: !ready };
  /** What a step says, for screen readers (the graphics change without focus moving). */
  const sayStep = (to: number, playing: boolean) => {
    const v = charlaView({ ...chArgs, step: to, playing });
    announce(v.n + " · " + v.nk.toLowerCase() + ": " + (v.lt ? v.lt.t + (v.lt.d ? ". " + v.lt.d : "") : (v.plan ?? []).map((c) => c.t + ": " + c.d).join(" ")));
  };
  // (a link straight to the charla waits for the board before it runs)
  const chl = useCharla({
    on: charlaOn && ready,
    last: chLast,
    rm,
    engine: (step, playing) => live3dC && engineDriven(step, chLast, playing, chSlots),
    onMove: (to, how) => {
      if (!rm) runFx(morph(null, { slow: to >= STEP_JUGADA }));
      sayStep(to, false);
      const k = stepKind(to, chLast);
      if (k === "siete") {
        // (the tap only buzzes when it is a press of the transport, never while the charla plays itself)
        if (how === "user") buzz(14);
        snd("flip");
      } else if (k === "final") snd("crowd");
    },
  });
  const cv = charlaOn ? charlaView({ ...chArgs, step: chl.step, playing: chl.playing }) : null;
  const chKind = cv?.kind ?? null;

  // ── what the pitch shows ──
  // The plan is painted while its tab is open (and at the charla's plan); the plan, the química and
  // Comparar show the cromos as discs.
  const showPlan = (modo === "editar" && tab === "p") || chKind === "plan";
  const mini = modo === "quimica" || modo === "comparar" || modo === "jugadas" || modo === "dibujar" || showPlan;
  const view = pitchView({ L, sq, ch, cam, modo, fx, selId: sel?.id ?? null, pick, ro: !canEdit, rm, meId: props.meId, mini, present: charlaOn ? chl.step : undefined });
  const plan = planLayer(L, cam, modo, showPlan);

  // ── the stadium: what it films ──
  // (it is mounted the first time a 3D moment wants it and stays, paused, until «3D» goes off)
  const wantNow = can3d && (intro3d || charlaOn || (want3d && rpl.playing));
  if (wantNow && !mount3d) setMount3d(true);
  if (!can3d && mount3d) setMount3d(false);
  const keep3d = can3d && (mount3d || wantNow);
  if (!keep3d && ready3d) setReady3d(false);
  const led3d = ["Manchester Piti", "Sistema " + (L.freeMode ? "libre" : L.formation), "Química " + ch.v, props.match?.short ?? "", "Vamos Piti"].filter(Boolean);
  const heroId = chKind === "siete" ? chSlots[chl.step - 1] : null;
  let shot: Shot;
  if (intro3d) shot = intro.phase === "run" ? { kind: "intro", players: engineSeven(L, sq, props.meId) } : { kind: "hold" };
  else if (charlaOn && cv)
    shot = {
      kind: "charla",
      step: chl.step,
      playing: chl.playing,
      players: engineSeven(L, sq, chl.playing ? null : heroId),
      slots: chSlots,
      // (a new seven — the board loaded, another tab — films the step again)
      jugada: { key: chPlay.id + ":" + chPlay.frames.length + ":" + chSlots.join(","), frames: toEngineFrames(chPlay), pasos: enginePasos(chPlay) },
      board: cv.board3d.start,
      boardEnd: cv.board3d.end,
    };
  else if (want3d && rpl.playing)
    shot = { kind: "jugada", key: jplay.id, board: led3d, players: engineCast(jplay, sq, L, props.meId), rivals: engineRivals(jplay), frames: toEngineFrames(jplay), from: jf, slow: spd };
  else shot = { kind: "rest", players: engineSeven(L, sq, props.meId), board: led3d };
  const chNote3d = !prefs.v3
    ? "Vista 2D."
    : live3dC
      ? "En el estadio 3D: la cámara visita a cada jugador."
      : fail3d
        ? "El estadio 3D no ha podido arrancar: la charla se presenta sobre la pizarra."
        : sup3d
          ? "Sin 3D en este dispositivo: la charla se presenta sobre la pizarra."
          : "Preparando el estadio 3D: mientras, la charla va sobre la pizarra.";

  // ── pointer: drag, long press, the línea, the sheet handle, drawing and the jugada's pieces ──
  const ctl = useDragController(
    { root: rootRef, frame: frameRef, sheet: sheetRef, layer: layerRef, swp: swpRef, live: liveRef },
    {
      lineup: L,
      cam,
      snap,
      canMove: canEdit && (modo === "editar" || modo === "quimica"),
      canLine: canEdit && modo === "editar" && plan.dlOn,
      magnets: canEdit && modo === "editar" && !L.freeMode,
      draw: canEdit && modo === "dibujar",
      drawRo: ready && ro && modo === "dibujar",
      pieces,
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
      onDraw,
      onDrawRo: () => say(roMsg),
      onPieceStart: () => {
        setUntouched(false);
        rpl.pause();
        buzz(10);
      },
      onPiece,
      onPieceTap,
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
    session.commit({ ...r.lineup, drawings: L.drawings, plays: L.plays });
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
    session.commit({ ...r.lineup, drawings: L.drawings, plays: L.plays });
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
    // Into the jugadas or the charla (or out of them) the cromos glide between the board and the paso;
    // the jugadas open paused with the crest wipe, as designed, and the charla from its first step.
    const staged = (x: Modo) => x === "jugadas" || x === "charla";
    if ((staged(target) || staged(modo)) && target !== modo && !rm) runFx(morph(null, { slow: true }));
    skipIntro();
    if (target === "jugadas") {
      rpl.pause();
      wipeNow();
    } else if (modo === "jugadas") rpl.pause();
    if (target === "charla" && modo !== "charla") {
      chl.reset();
      if (prefs.v3) ask3d();
      sayStep(0, !rm);
    }
    setUntouched(false);
    setModo(target);
    setSnap(m === "plan" ? "half" : snapOf(target));
    setTab(m === "plan" ? "p" : "b");
    patchUi({ sel: null, pick: null, fan: null, fic: null, kb: null, inkSel: null, rivSel: null });
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
      // Dibujar: the strokes' own undo
      if (modo === "dibujar" && !e.shiftKey) inkUndo();
      else if (e.shiftKey) doRedo();
      else doUndo();
      return;
    }
    if (mod && !field && e.key.toLowerCase() === "y") {
      e.preventDefault();
      doRedo();
      return;
    }
    if (modo === "dibujar" && inkSel && !field && (e.key === "Delete" || e.key === "Backspace")) {
      e.preventDefault();
      inkDelete(inkSel);
      return;
    }
    if (e.key === "Escape") {
      if (fan || fic) return;
      if ((modo === "dibujar" && inkSel) || (modo === "jugadas" && rivSel)) {
        e.preventDefault();
        patchUi({ inkSel: null, rivSel: null });
        announce("Desmarcado");
        return;
      }
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

  // ── the replay's and the charla's keys: Space plays / pauses, ← → go a step back / forward, and
  // Escape leaves the charla (or skips the 3D intro) ──
  const replayKeys = (e: globalThis.KeyboardEvent) => {
    if (intro3d && e.key === "Escape") {
      skipIntro();
      return;
    }
    if ((modo !== "jugadas" && modo !== "charla") || fan || fic || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target instanceof HTMLElement ? e.target : null;
    const root = rootRef.current;
    if (t && t !== document.body && root && !root.contains(t)) return;
    const tag = t?.tagName ?? "";
    if (modo === "charla" && e.key === "Escape") {
      e.preventDefault();
      goModo("editar");
      return;
    }
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || t?.isContentEditable) return;
    if (e.key === " " || e.key === "Spacebar") {
      // a focused control keeps its own Space
      if (tag === "BUTTON" || tag === "A") return;
      e.preventDefault();
      if (modo === "charla") chl.toggle();
      else playToggle();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const d = e.key === "ArrowLeft" ? -1 : 1;
      if (modo === "charla") chl.step1(d);
      else jStep(d);
    }
  };
  const keysLatest = useRef(replayKeys);
  useEffect(() => {
    keysLatest.current = replayKeys;
  });
  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => keysLatest.current(e);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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
          return { k: "con " + nm(o) + (l.tog ? " · " + plural(l.tog, "partido") : ""), v: l.t === 3 ? "++" : l.t === 2 ? "+" : "–" };
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
  const copyLink = async (charla: boolean) => {
    if (!session.id) return;
    const url = boardLink(window.location.origin, session.id, charla);
    try {
      await navigator.clipboard.writeText(url);
      say(charla ? "Enlace a la charla copiado: pégalo en el grupo" : "Enlace copiado: pégalo en el grupo");
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

  // ── what the pitch shows: a jugada's paso, or the strokes; and where it is all drawn ──
  const rh = replayHud(cur, jf, cam3d, pieces);
  const chPaso = cv ? cv.paso : -1;
  const jug =
    modo === "jugadas"
      ? jugadaStage({ play: jplay, frame: jf, L, sq, cam, fx, meId: props.meId, edit: pieces, selRival: rivSel, onion, trails, rivals: rivOn, ball: ballOn, follow })
      : chPaso >= 0
        ? jugadaStage({ play: chPlay, frame: chPaso, L, sq, cam, fx, meId: props.meId, edit: false, selRival: null, onion: false, trails: true, rivals: true, ball: true, follow: false })
        : null;
  // la charla: the camera pushes in on the cromo presented (under a spotlight) and on the ball
  const heroCard = cv && cv.hero >= 0 ? view.cards.find((c) => c.i === cv.hero) : undefined;
  const chBall = jug && chPaso >= 0 ? jug.drawn.b : null;
  const chCamT = heroCard ? pushIn(heroCard.x, heroCard.y, 1.22, 46) : chBall ? pushIn(chBall[0], chBall[1], 1.2) : null;
  const chFinal = chKind === "final" && !rm;
  const ink = modo === "jugadas" || modo === "charla" ? null : inkView(strokes, C, modo === "dibujar" ? inkSel : null, fresh);
  const drawnNow = jug ? jug.drawn : { p: Object.fromEntries(view.cards.map((c): [string, [number, number]] => [c.id, [c.x, c.y]])), r: {}, b: null };
  useEffect(() => {
    drawn.current = drawnNow;
  });
  /** The editor's view of the jugada on screen (its paso, rivals, who of the seven it leaves out). */
  const jugadaEditor = (): JugadaEditorView => {
    const fr = jplay.frames[jf];
    const room = LIM.framePlayers - Math.max(0, ...jplay.frames.map((f) => Object.keys(f.players).length));
    return {
      id: jplay.id,
      name: jplay.name,
      own: cur.own,
      pasos: jplay.frames.map((f, i) => ({ title: f.title || "Paso " + (i + 1), cur: i === jf })),
      cur: jf,
      title: fr?.title ?? "",
      note: fr?.note ?? "",
      rivals: fr?.rivals.length ?? 0,
      rivalMarked: !!rivSel,
      missing: Math.max(0, Math.min(missingFrom(jplay, L).length, room)),
      gone: goneFrom(jplay, L).length,
      errors: cur.own ? validatePlay(jplay) : [],
    };
  };

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
          : modo === "jugadas"
            ? "Paso " + (jf + 1) + " de " + nJ + (pieces ? " · arrastra una ficha para retocar el paso" : "") + "; el bug de arriba abre la biblioteca."
            : modo === "dibujar"
              ? "Dibuja sobre el césped: " + TOOL_HINT[tool] + "."
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
  const rootCls = [
    "vx",
    "pzv",
    "m-" + modo,
    // the openings: the 2D crane, the 3D intro (the 2D board hidden), the cromos dealt in after it
    ready && intro.kind === "2d" && intro.phase === "run" && !charlaOn ? "intro" : "",
    intro3d ? "i3" : "",
    hand ? "hand" : "",
    hud.qUp || hud.celeOn || chFinal ? "cheer" : "",
    modo === "quimica" || show.chem ? "s-chem" : "",
    showPlan ? (charlaOn ? "chp" : "t-plan") : "",
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
    // the replay: 0,5×, the estelas off, the follow-cam, the 3D stadium live, pieces that can be moved
    modo === "jugadas" && spd ? "slow2" : "",
    modo === "jugadas" && !trails ? "no-trails" : "",
    follow || !!chCamT ? "fcam" : "",
    live3d || live3dC ? "v3" : "",
    pieces ? "j-edit" : "",
    // Dibujar on an editable board: the pitch is a canvas
    canEdit && modo === "dibujar" ? "d-on" : "",
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
      <CompartirPanel cartel={cartel} block={shareBlock} busy={shareBusy} canLink={!!session.id} onShare={() => void toGroup("share")} onPng={() => void toGroup("png")} onLink={(charla) => void copyLink(charla)} onBack={() => goModo("mas")} />
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
          if (on) setFail3d(false);
          say(on ? "3D en las jugadas y la charla, si este dispositivo puede" : "Vista 2D");
        }}
        onSnd={() => props.onPrefs({ snd: !prefs.snd })}
        onDay={props.theme.toggle}
        onGrid={onGrid}
        onSeason={props.onSeason}
        onBack={() => goModo("mas")}
      />
    ) : modo === "jugadas" ? (
      <JugadasPanel
        hud={rh}
        frame={jf}
        n={nJ}
        playing={rpl.playing}
        v3={prefs.v3}
        slow={spd}
        onion={onion}
        trails={trails}
        riv={rivOn}
        ball={ballOn}
        lib={jl.map((j) => ({ id: j.play.id, short: j.short, aria: j.play.name + (j.own ? " (propia)" : " (estrategia)"), on: j.play.id === jplay.id }))}
        canEdit={canEdit}
        note3d={note3d}
        editor={jugadaEditor()}
        onToggle={playToggle}
        onStep={jStep}
        onSeek={jSeek}
        on3d={toggle3d}
        onSlow={() => setSpd((v) => !v)}
        onOnion={() => setOnion((v) => !v)}
        onTrails={() => setTrails((v) => !v)}
        onRiv={() => setRivOn((v) => !v)}
        onBall={() => setBallOn((v) => !v)}
        onPick={jPick}
        onAddPaso={jAddPaso}
        onNew={jNew}
        onCharla={() => {
          // «Verla en la charla»: the charla presents this jugada
          setJChosen(true);
          goModo("charla");
        }}
        onRename={jRename}
        onDuplicate={jDuplicate}
        onDelete={jDelete}
        onPaso={jSeek}
        onMovePaso={jMovePaso}
        onCopyPaso={jCopyPaso}
        onDelPaso={jDelPaso}
        onTitle={jTitle}
        onNote={jNote}
        onAddRival={jAddRival}
        onDelRival={jDelRival}
        onAddMissing={jAddMissing}
        onDropGone={jDropGone}
      />
    ) : modo === "dibujar" ? (
      <DibujarPanel
        ro={!canEdit}
        tool={tool}
        color={inkColor}
        text={inkText}
        strokes={strokes.map((x) => ({ id: x.id, label: strokeLabel(x), sel: x.id === inkSel }))}
        selLabel={inkSel ? strokeLabel(strokes.find((x) => x.id === inkSel) ?? strokes[0]) : null}
        canUndo={canEdit && (u.ink.length > 0 || strokes.length > 0)}
        onTool={(k) => {
          setTool(k);
          buzz(6);
        }}
        onColor={(c) => {
          setInkColor(c);
          buzz(6);
        }}
        onText={setInkText}
        onUndo={inkUndo}
        onClear={inkClear}
        onSelect={(id) => patchUi({ inkSel: id })}
        onDelete={inkDelete}
      />
    ) : cv ? (
      <CharlaGuion v={cv} title={match?.short ?? session.name} note3d={chNote3d} />
    ) : null;

  return (
    <div
      ref={rootRef}
      className={rootCls}
      data-modo={modo}
      data-snap={snap}
      aria-busy={!seenReady}
      style={vars({ "--kp": fit.kp, "--kh": fit.kh, "--kd": fit.kd, "--fh": C.Fh })}
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
          ink={ink}
          jug={jug}
          pieces={pieces}
          focusCards={modo !== "jugadas" && modo !== "dibujar" && !charlaOn}
          bug={modo === "jugadas" ? { a: rh.bugA, b: rh.bugB, k: rh.bugK, aria: rh.bugAria } : null}
          trailsDraw={!!fx.from && !rm}
          trailsDur={spd ? "3.2s" : "1.7s"}
          wipe={wipe}
          camT={chCamT}
          spot={heroCard ? { id: heroCard.id, x: heroCard.x, y: heroCard.y, ar: L.roles.captainId === heroCard.id } : null}
          cele={chFinal ? { txt: "", sub: "" } : hud.celeOn ? { txt: "¡SIETE LISTO!", sub: hud.sysName + " · QUÍMICA " + hud.qv } : null}
          p3d={
            keep3d ? (
              <Board3D
                shot={shot}
                players={engineSeven(L, sq, props.meId)}
                board={led3d}
                onReady={() => setReady3d(true)}
                onFail={on3dFail}
                events={{ onIntroDone: skipIntro, onFrame: rpl.reached, onStep: chl.reached }}
              />
            ) : null
          }
          liveRef={liveRef}
          onBug={() => setSnap("half")}
          plan={plan}
          hud={cv ? { ...hud, ledTop: cv.led } : hud}
          wmY={(proj(C, 50, 37).y - 15).toFixed(2)}
          sysk={sysk}
          ro={!canEdit}
          editing={modo === "editar"}
          showGal={show.gal}
          kb={u.kb}
          selId={sel?.id ?? null}
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
        {cv && (
          <CharlaOverlay
            v={cv}
            step={chl.step}
            playing={chl.playing}
            rm={rm}
            onToggle={chl.toggle}
            onStep={chl.step1}
            onSeek={chl.seek}
            onExit={() => goModo("editar")}
          />
        )}
        {intro3d && (
          <>
            <button type="button" className="i3-tap" onClick={skipIntro} tabIndex={-1} aria-hidden="true" />
            <button type="button" className="b3 i3-skip" onClick={skipIntro} aria-label="Saltar la presentación">
              Saltar
            </button>
          </>
        )}
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
