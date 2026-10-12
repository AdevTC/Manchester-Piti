// La pizarra «FUT» — the app screen, sized from the screen's height (--vh). Phone: the command bar, the
// pitch fitted to the width, the tools in a bottom sheet (half / full) above the mode bar. Tablet: the
// pitch fitted to the height, the panel docked under it. Desktop: the site header, the command bar, the
// «Acciones» rail flush left, the pitch (keeper always in view), the panel flush right and the prompt bar
// along the bottom, with the keyboard shortcuts (1–8, Q / E, R, C / G / F, Esc, Ctrl Z).
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
import type { FormationName, Lineup } from "../formations";
import { CAMS, camGeo, proj, slotLabel, slotPos, slotZone, TEMPO_PULSE } from "./geometry";
import { fits, GALONES, isAvailable, isFull, natOf, type Squad } from "./model";
import { chemOf, tierOf } from "./quimica";
import { autoPlace, cycleDefLine, editSig, goFree, normalize, place, resetFree, resolveDrop, rolesLost, setDefLine, setSystem, snapAll, stepSystem, swap, toggleRole } from "./ops";
import { suggestSeven } from "./pack";
import { applyFan, fanCentre, fanItems, type FanItem, type FanSub } from "./fan";
import { EMPTY_HISTORY, pushHistory, redo, undo, type History } from "./history";
import { cycle, settle, snapOf, step, type Snap } from "./sheet";
import { DIR_KEYS, moveStroke, nudgeOf, nudgePoint, placeOf, slotInDirection, strokeMid, toPlace } from "./drag";
import { ago, FX0, fxDuration, hud as buildHud, joinLive, pitchView, planLayer, positionsOf, tacSummary, vars, type Fx, type Modo } from "./view";
import { useDragController } from "./useDragController";
import { useBoardSound, buzz } from "./sound";
import { plural } from "./plural";
import { useNoScrollJump } from "./useNoScrollJump";
import type { BoardSession } from "./useBoardSession";
import { Stage } from "./Stage";
import { AppBar, BenchTab, MasPanel, ModeBar, OnceTabs, ReadOnlyStrip, Sheet, SquadBars, SystemTab, type OnceTab } from "./Panels";
import { avisoTxt, avisoUrl, benchGroups, calledOf, convHead, pitchFound, reparto, squadInfo, type BenchGroup, type BenchHand, type Reparto } from "./bench";
import { AjustesPanel, CompararPanel, CompartirPanel, PlanTab, QuimicaPanel } from "./SheetPanels";
import { SHOW0, type BoardPrefs, type ShowKey } from "./prefs";
import { TablerosPanel, type BoardRowView, type ReactionsView, type TbTab } from "./Tableros";
import { Fan, Ficha } from "./Overlays";
import { Icon } from "./icons";
import { planNote, setTactic, tacRows } from "./plan";
import { changes, cmpMarks, PLAYED_ID, playedOption, playedSeven, tape } from "./compare";
import { boardLink, boardMeta, convocatoriaFromBoard, matchLabel, matchShort, type CalMatch } from "./boards";
import { charlaJugada, charlaLast, charlaView, pushIn, STEP_JUGADA, STEP_PLAN, stepKind, type CharlaMatch } from "./charla";
import { useCharla } from "./useCharla";
import { CharlaGuion, CharlaOverlay } from "./CharlaOverlay";
import { DEAL_MS, INTRO_2D_MS, INTRO_MAX_MS, INTRO_WAIT_MS, introKind, introSeen, markIntroSeen, type IntroKind } from "./intro";
import { engineCast, engineDriven, enginePasos, engineSeven, type Shot } from "./director";
import { cartelBlob, cartelFile, cartelLayout, crestImage, download, preparedFor, shareCartel } from "./cartel";
import { DELETE_MS } from "./useBoardSession";
import { deepHash } from "./deeplink";
import { dataToLineupDoc, extractLineup, lineupToData, type LineupDoc, type LineupMeta } from "../lineupDoc";
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
import { framePointToPitch, hitStroke, inkView, strokeLabel, TOOL_HINT } from "./telestrator";
import { emptyStack, inkBack, inkForward, inkOp, mergePlay, popFuture, popPast, pushOp, undoScopeOf, withPlay, type InkOp, type PlayOp, type Stack } from "./undoScope";
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
import type { MatchCard } from "./Panels";
import { noteToolOpened, RAIL_ORDER } from "./rail";
import { useReducedMotion, useStadiumMount } from "./useDevice";
import { fichaOf } from "./ficha";
import { PromptBar } from "./PromptBar";
import type { PromptActs, PromptCtx } from "./prompt";
import { SelBar } from "./SelBar";
import { selBarView } from "./handView";
import { readBenchView, writeBenchView, type BenchView } from "./benchView";
import { shownBench, usePhone, useWide } from "./useWide";
import { useCambios } from "./useCambios";
import { orderTxt, ROLE_TAKER, takersOf } from "./takers";

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
  /** Captains: the match's one convocatoria takes the official's siete (setConvocatoria). */
  onSyncConvocatoria?: (matchId: string, lineup: { starters: string[]; bench: string[] }) => Promise<void>;
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
  sub: FanSub;
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
  /** The telestrator's own undo / redo: each change to the strokes, by stroke id. */
  ink: Stack<InkOp>;
  /** The jugadas' own undo / redo: each edit of a jugada. */
  jh: Stack<PlayOp>;
  /** The stroke marked on the pitch (Dibujar), and the rival marked in a jugada's paso. */
  inkSel: string | null;
  rivSel: string | null;
}
const UI0 = { sel: null, pick: null, fan: null, fic: null, hist: EMPTY_HISTORY, kb: null, ink: emptyStack<InkOp>(), jh: emptyStack<PlayOp>(), inkSel: null, rivSel: null };

/** The tools «Más» opens (their «Volver» goes back to it). */
const MAS_KIDS: Modo[] = ["tableros", "comparar", "compartir", "ajustes"];

/** Focus a panel's first visible heading (else the panel itself), without scrolling. */
function focusHeading(sheet: HTMLElement | null): void {
  if (!sheet) return;
  const hs = Array.from(sheet.querySelectorAll<HTMLElement>("h2, h3"));
  const h = hs.find((x) => typeof x.checkVisibility !== "function" || x.checkVisibility()) ?? sheet;
  if (!h.hasAttribute("tabindex")) h.setAttribute("tabindex", "-1");
  h.focus({ preventScroll: true });
}

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
  /** The board whose deletion this toast can still undo. */
  del?: string;
}

/** A board deleted a moment ago: the session deletes it for good after DELETE_MS; until then, `run` undoes it. */
interface PendingDel {
  id: string;
  name: string;
  run: () => void;
}

const LIM = PIZARRA_LIMITS;
/** The reparto and the bench while their pages are not on screen (nothing is worked out for them). */
const NO_REPARTO: Reparto = { rows: [], txt: "", rot: null };
const NO_GROUPS: BenchGroup[] = [];
const NO_ERRS: string[] = [];
/** The editor's check of a jugada (Zod), once per jugada object (they are immutable values). */
const playErrs = new WeakMap<Play, string[]>();
function validated(p: Play): string[] {
  let e = playErrs.get(p);
  if (!e) playErrs.set(p, (e = validatePlay(p)));
  return e;
}
/** (only to read a lineup back as the store would: see markOurs) */
const STORE_META: LineupMeta = { ownerUid: "", ownerNickname: "", seasonId: "", name: "", isOfficial: false, matchId: null };
const PLAYS_FULL = "Ya hay " + plural(LIM.plays, "jugada propia", "jugadas propias") + " en este tablero: borra una para guardar otra.";
const PASOS_MSG = "Una jugada tiene entre " + LIM.framesMin + " y " + LIM.framesMax + " pasos.";
const NO_3D = "Este dispositivo no muestra el estadio 3D: la jugada se ve con la cámara 2D que sigue al balón.";
const FAIL_3D = "El estadio 3D no ha podido arrancar: la jugada se ve con la cámara 2D que sigue al balón.";

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

  // (read live: the system's setting can change with the page open)
  const rm = useReducedMotion();
  const [start] = useState(fromHash);
  const [modo, setModo] = useState<Modo>(start.modo);
  const [snap, setSnap] = useState<Snap>(() => snapOf(start.modo));
  const [tab, setTab] = useState<OnceTab>(start.tab);
  // The bench as FUT list rows or cromos (R), remembered on this device.
  const [benchView, setBenchViewState] = useState<BenchView>(readBenchView);
  const wide = useWide();
  const phone = usePhone();
  const setBenchView = (v: BenchView) => {
    setBenchViewState(v);
    writeBenchView(v);
  };
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
  // An announcement made since the last render: the next one in the same tick joins it.
  const liveOpen = useRef(false);
  useEffect(() => {
    liveOpen.current = false;
  });
  const [q, setQ] = useState("");
  const [zf, setZf] = useState("Todos");
  const [oc, setOc] = useState(false);
  // «Buscar en la plantilla» open (its filters only apply while it is)
  const [srx, setSrx] = useState(false);
  const [dragKind, setDragKind] = useState<null | "tok" | "line">(null);
  const [dragFrom, setDragFrom] = useState<null | "pitch" | "bench">(null);
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
  // The jugada picked in Jugadas (else the charla presents the board's first own one, or the córner).
  const [jChosen, setJChosen] = useState(false);
  // La charla with holes in the seven waits for «Presentar igualmente» or «Empezar por el plan».
  const [chOk, setChOk] = useState(false);
  // Loading only counts until the board has shown once (a later blip must not jump the footer).
  const [seenReady, setSeenReady] = useState(ready);
  if (ready && !seenReady) setSeenReady(true);

  const rootRef = useRef<HTMLDivElement>(null);
  // Where the focus goes once the panel goModo opened is on screen, and what opened each panel.
  const focusNext = useRef<"heading" | { el?: HTMLElement; sel?: string } | null>(null);
  const openedBy = useRef(new Map<Modo, HTMLElement>());
  const appRef = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const swpRef = useRef<SVGPathElement>(null);
  const liveRef = useRef<SVGPathElement>(null);
  const fxTimer = useRef(0);
  const toastTimer = useRef(0);
  // Boards deleted a moment ago (undoable until the session deletes them), and their timers.
  const [pendDel, setPendDel] = useState<PendingDel[]>([]);
  const pendRef = useRef<PendingDel[]>([]);
  const delTimers = useRef(new Map<string, number>());
  /** «X deja la capitanía»: said along with the message of the change that cost it (same tick). */
  const lostNote = useRef<string | null>(null);
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
      delTimers.current.forEach((t) => window.clearTimeout(t));
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
  // ── derived ──
  // (once per lineup and squad: the HUD, the cromos, the bars, the panels and the cartel all read it)
  const ch = chemOf(L, sq);
  const squadIds = useMemo(() => sq.list.map((c) => c.id), [sq]);
  const nm = (id: string) => sq.byId.get(id)?.name ?? "Jugador";
  const onPitch = new Set(L.slots.map((s) => s.playerId).filter((x): x is string => !!x));
  let sel = u.sel;
  if (sel && (sel.k === "p" ? !onPitch.has(sel.id) : onPitch.has(sel.id) || !sq.byId.has(sel.id))) sel = null;
  const pick = u.pick != null && u.pick >= 0 && u.pick < L.slots.length ? u.pick : null;
  // The player in the hand, while editing an editable board: his action bar, the targets that glow.
  const inHand = modo === "editar" && canEdit ? sel : null;
  const fan = u.fan && onPitch.has(u.fan.id) ? u.fan : null;
  const fic = u.fic && sq.byId.has(u.fic.id) ? u.fic : null;
  const match = props.match;
  const hud = buildHud(L, sq, ch, fx, rm, match);
  const tacSum = tacSummary(L);

  /**
   * The board's one announcer (the `.sr` live region): the plates, the toast, the hint and the read-only
   * strip are not live. What one action says in several places in the same tick is joined into one
   * message (and said once: a part another part already says is dropped).
   */
  const announce = (msg: string) => {
    if (!msg) return;
    const joining = liveOpen.current;
    liveOpen.current = true;
    setLive((l) => ({ msg: joining ? joinLive(l.msg, msg) : msg, n: l.n + 1 }));
  };
  /** A deleted board's toast (the latest still pending), to come back after any other message. */
  const delToast = (): Toast | null => {
    const d = pendRef.current[pendRef.current.length - 1];
    return d ? { msg: "«" + d.name + "» borrado", act: { label: "Deshacer", aria: "Deshacer el borrado de «" + d.name + "»", run: d.run }, del: d.id } : null;
  };
  const say = (msg: string, act?: Toast["act"], ms = 2600) => {
    window.clearTimeout(toastTimer.current);
    // what a change cost the galones is said with whatever the change says itself
    const note = lostNote.current;
    const full = note && note !== msg ? note + " · " + msg : msg;
    setToast({ msg: full, act });
    // (the toast is not a live region: the board's one announcer says it)
    announce(full);
    // (a board deletion still pending comes back once this one has been read)
    toastTimer.current = window.setTimeout(() => setToast(delToast()), ms);
  };
  const fail = (err: unknown) => say(apiError(err));
  /** A deleted board is no longer pending (undone, or deleted for good): its row and toast go. */
  const dropPend = (bid: string) => {
    window.clearTimeout(delTimers.current.get(bid));
    delTimers.current.delete(bid);
    pendRef.current = pendRef.current.filter((x) => x.id !== bid);
    setPendDel(pendRef.current);
    setToast((t) => (t?.del === bid ? delToast() : t));
  };
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

  // ── the lineup's undo knows which changes were ours: one from another tab or device (the session's
  // lineup turning into something we never committed) starts the history again, so Deshacer can never
  // put back a lineup over it ──
  const ours = useRef<{ key: string; sigs: Set<string> }>({ key: "", sigs: new Set() });
  const markOurs = (next: Lineup) => {
    if (ours.current.key !== session.key) ours.current = { key: session.key, sigs: new Set() };
    ours.current.sigs.add(editSig(next));
    // (and as it reads back once stored)
    ours.current.sigs.add(editSig(normalize(extractLineup(dataToLineupDoc("x", lineupToData(next, STORE_META))), squadIds)));
  };
  const lsig = editSig(L);
  useEffect(() => {
    if (!ready) return;
    const o = ours.current;
    if (o.key === session.key && o.sigs.has(lsig)) return;
    const remote = o.key === session.key;
    ours.current = { key: session.key, sigs: new Set([lsig]) };
    if (remote) setUi((prev) => (prev.key === session.key && (prev.hist.past.length || prev.hist.future.length) ? { ...prev, hist: EMPTY_HISTORY } : prev));
  }, [lsig, session.key, ready]);

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
    markOurs(next);
    patchUi({ hist: pushHistory(u.hist, L), ...o.ui });
    // whoever left the pitch left his galones: said now, and with the change's own message if it has one
    const lost = rolesLost(L, next, nm);
    if (lost) {
      lostNote.current = lost;
      say(lost);
      window.setTimeout(() => {
        if (lostNote.current === lost) lostNote.current = null;
      }, 0);
    }
    if (o.snap) setSnap(o.snap);
    runFx(morph(o.drop ?? null, { rip, cele, ...o.fx }));
    snd("clac");
    // the química scoreboard flips when its number changes
    if (chemOf(next, sq).v !== ch.v) {
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
    commit(place(L, id, i), { ui: { sel: null, pick: null, kb: null }, snap: "half" });
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
  // (the editor's check of your jugada, with Zod: once per jugada, and only while Jugadas is open)
  const jOwn = cur.own;
  const jErrs = modo === "jugadas" && jOwn ? validated(jplay) : NO_ERRS;
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
  const editJugada = (fn: (p: Play) => Play, refused: string, goTo?: number, tag?: string): Play | null => {
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
    pushJ({ id: next.id, before: cur.own ? jplay : null, after: next, jid0: jplay.id, jid1: next.id, tag });
    if (!cur.own) {
      setJid(next.id);
      setJChosen(true);
      rpl.reset(session.key + ":" + next.id, false, goTo ?? jf);
      say("«" + jplay.name + "» ya es tuya: se guarda con el tablero");
    } else if (goTo != null && goTo !== jf) rpl.seek(goTo, next.frames.length);
    return next;
  };
  /** One edit of the jugadas into their own undo (typing a paso's title or note is one step). */
  const pushJ = (op: PlayOp) => patchUi({ jh: pushOp(u.jh, op, mergePlay) });
  /** Show jugada `id` after an undo / redo (on the same paso when it is the same jugada). */
  const showJugada = (id: string, plays: Play[]) => {
    const n = jugadaList({ ...L, plays }).find((j) => j.play.id === id)?.play.frames.length ?? 1;
    setJid(id);
    setJChosen(true);
    rpl.reset(session.key + ":" + id, false, id === jplay.id ? Math.min(jf, n - 1) : 0);
    patchUi({ rivSel: null });
  };
  /** Ctrl Z in Jugadas: the last edit of a jugada, undone on the jugadas there are now. */
  const jUndo = () => {
    if (!canEdit) return;
    const r = popPast(u.jh);
    if (!r) return;
    const plays = withPlay(L.plays ?? [], r.op.id, r.op.before);
    if (!saveExtras({ ...L, plays })) return;
    patchUi({ jh: r.stack });
    showJugada(r.op.before || r.op.jid0 !== r.op.id ? r.op.jid0 : DEFAULT_JUGADA, plays);
    buzz([6, 20, 6]);
    announce("Deshecho en la jugada");
  };
  const jRedo = () => {
    if (!canEdit) return;
    const r = popFuture(u.jh);
    if (!r) return;
    const plays = withPlay(L.plays ?? [], r.op.id, r.op.after);
    if (!saveExtras({ ...L, plays })) return;
    patchUi({ jh: r.stack });
    showJugada(r.op.after ? r.op.jid1 : DEFAULT_JUGADA, plays);
    buzz([6, 20, 6]);
    announce("Rehecho en la jugada");
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
  const jTitle = (v: string) => editJugada((p) => setFrameText(p, jf, { title: v }), "", undefined, "t" + jf);
  const jNote = (v: string) => editJugada((p) => setFrameText(p, jf, { note: v }), "", undefined, "n" + jf);
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
    pushJ({ id: pl.id, before: null, after: pl, jid0: jplay.id, jid1: pl.id });
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
    editJugada((p) => renamePlay(p, v), "", undefined, "name");
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
    pushJ({ id: copy.id, before: null, after: copy, jid0: jplay.id, jid1: copy.id });
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
    patchUi({ rivSel: null, jh: pushOp(u.jh, { id: was.id, before: was, after: null, jid0: was.id, jid1: DEFAULT_JUGADA }) });
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
  // The keyboard's way to move a piece (a focused one, with the arrows): the same edit as a drag, one
  // undo step per piece while the arrows keep moving it, and where it went, in words.
  const curFrame = jplay.frames[jf];
  const pieceAria: Record<string, string> = {};
  if (pieces && curFrame) {
    pieceAria.b = "Balón, en " + placeOf(curFrame.ball) + ". Flechas para moverlo; con Mayús, más lejos";
    curFrame.rivals.forEach((r, k) => {
      pieceAria["r:" + r.id] = "Rival " + (k + 1) + ", en " + placeOf(r) + ". Flechas para moverlo; Intro para marcarlo";
    });
  }
  const onPieceKey = (piece: string, dx: number, dy: number) => {
    if (!pieces || !curFrame) return;
    setUntouched(false);
    rpl.pause();
    const kind = piece === "b" ? "b" : piece.slice(0, 2);
    const id = piece.slice(2);
    const from = kind === "b" ? curFrame.ball : kind === "r:" ? curFrame.rivals.find((r) => r.id === id) : curFrame.players[id];
    if (!from) return;
    const to = nudgePoint(from, dx, dy);
    if (to.x === from.x && to.y === from.y) return;
    const tag = "k" + jf + piece;
    const done =
      kind === "b"
        ? editJugada((p) => moveBall(p, jf, to), "", undefined, tag)
        : kind === "r:"
          ? editJugada((p) => moveRival(p, jf, id, to), "", undefined, tag)
          : editJugada((p) => movePlayer(p, jf, id, to), "No caben más de siete en un paso.", undefined, tag);
    if (!done) return;
    if (!rm) runFx(morph(null));
    buzz(6);
    announce((kind === "b" ? "Balón" : kind === "r:" ? "Rival" : nm(id)) + " movido " + toPlace(to));
  };

  // ── Dibujar: strokes of light on the grass, with their own undo ──
  const strokes = L.drawings ?? [];
  const inkSel = u.inkSel && strokes.some((x) => x.id === u.inkSel) ? u.inkSel : null;
  const setInk = (next: Stroke[]): boolean => {
    if (!saveExtras({ ...L, drawings: next })) return false;
    patchUi({ ink: pushOp(u.ink, inkOp(strokes, next)), inkSel: null });
    return true;
  };
  // (undone by stroke id, on the strokes there are now: what another tab drew meanwhile stays)
  const inkUndo = () => {
    if (!canEdit) return;
    const r = popPast(u.ink);
    if (r) {
      if (!saveExtras({ ...L, drawings: inkBack(strokes, r.op) })) return;
      patchUi({ ink: r.stack, inkSel: null });
    } else if (strokes.length) {
      // nothing drawn in this visit: the last stroke goes (and can come back with Rehacer)
      const next = undoStroke(strokes);
      if (!saveExtras({ ...L, drawings: next })) return;
      patchUi({ ink: { past: [], future: u.ink.future.concat([inkOp(strokes, next)]) }, inkSel: null });
    } else return;
    buzz([6, 20, 6]);
    announce("Trazo deshecho");
  };
  const inkRedo = () => {
    if (!canEdit) return;
    const r = popFuture(u.ink);
    if (!r || !saveExtras({ ...L, drawings: inkForward(strokes, r.op) })) return;
    patchUi({ ink: r.stack, inkSel: null });
    buzz([6, 20, 6]);
    announce("Trazo rehecho");
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
  const markedTxt = (st: Stroke) => "Marcado: " + strokeLabel(st) + ", en " + placeOf(strokeMid(st.points)) + ". Flechas para moverlo; «Borrar trazo» o Supr lo quita.";
  /** The marked stroke moved with the arrows (the keyboard's drag): it stays marked, each step undoable. */
  const inkNudge = (id: string, dx: number, dy: number) => {
    if (!canEdit) return;
    const next = moveStroke(strokes, id, dx, dy);
    if (next === strokes || !saveExtras({ ...L, drawings: next })) return;
    patchUi({ ink: pushOp(u.ink, inkOp(strokes, next)) });
    const st = next.find((x) => x.id === id);
    if (st) announce("Trazo movido " + toPlace(strokeMid(st.points)));
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
        announce(markedTxt(st));
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
  // fewer than seven: «Faltan N: ¿presentar igualmente?» before anything plays
  const chMissing = chSlots.filter((x) => !x).length;
  const chGate = charlaOn && ready && !chOk && chMissing > 0;
  const live3dC = charlaOn && can3d && ready3d;
  const chArgs = { L, sq, play: chPlay, playShort: chItem.short, match, boardName: session.name, sysName: hud.sysName, tacSum, qv: ch.v, in3d: live3dC, loading: !ready };
  /** What a step says, for screen readers (the graphics change without focus moving). */
  const sayStep = (to: number, playing: boolean) => {
    const v = charlaView({ ...chArgs, step: to, playing });
    announce(v.n + " · " + v.nk.toLowerCase() + ": " + (v.lt ? v.lt.t + (v.lt.d ? ". " + v.lt.d : "") : (v.plan ?? []).map((c) => c.t + ": " + c.d).join(" ") + (v.cambios ? " Cambios: " + v.cambios.join("; ") + "." : "")));
  };
  // (a link straight to the charla waits for the board before it runs)
  const chl = useCharla({
    on: charlaOn && ready && !chGate,
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
  // (while the charla asks about the holes, nothing plays)
  const chPlaying = chl.playing && !chGate;
  const cv = charlaOn ? charlaView({ ...chArgs, step: chl.step, playing: chPlaying }) : null;
  const chKind = cv?.kind ?? null;

  // ── día de partido: Siete → Cambios, the scrubbed minute on the pitch, the live plate ──
  const cb = useCambios({
    L,
    sq,
    called: calledOf(props.conv.match),
    canEdit,
    ready,
    roMsg,
    match: props.calendar.find((c) => c.id === session.matchId) ?? null,
    isAdmin: props.isAdmin,
    now: props.now,
    open: modo === "editar" && tab === "c",
    commit: (next) => commit(next),
    say,
    announce,
    onOpen: () => {
      setModo("editar");
      setTab("c");
      setSnap("half");
      focusNext.current = "heading";
      setMk((k) => k + 1);
    },
  });

  // ── what the pitch shows ──
  // The plan is painted while its tab is open (and at the charla's plan); the plan, the química and
  // Comparar show the cromos as discs.
  const showPlan = (modo === "editar" && tab === "p") || chKind === "plan";
  const mini = modo === "quimica" || modo === "comparar" || modo === "jugadas" || modo === "dibujar" || showPlan;
  const view = pitchView({ L: cb.pitch, sq, ch, cam, modo, fx, selId: sel?.id ?? null, hand: inHand, pick, ro: !canEdit, rm, meId: props.meId, mini, present: charlaOn ? chl.step : undefined });
  const plan = planLayer(L, cam, modo, showPlan);

  // ── the stadium: what it films ──
  // (it is mounted the first time a 3D moment wants it and stays, paused, for the next one; after a
  // minute with no 3D moment it is unmounted, and «3D» off unmounts it at once)
  const wantNow = can3d && (intro3d || charlaOn || (want3d && rpl.playing));
  const keep3d = useStadiumMount(can3d, wantNow);
  if (!keep3d && ready3d) setReady3d(false);
  const led3d = ["Manchester Piti", "Sistema " + (L.freeMode ? "libre" : L.formation), "Química " + ch.v, props.match?.short ?? "", "Vamos Piti"].filter(Boolean);
  const heroId = chKind === "siete" ? chSlots[chl.step - 1] : null;
  let shot: Shot;
  if (intro3d) shot = intro.phase === "run" ? { kind: "intro", players: engineSeven(L, sq, props.meId) } : { kind: "hold" };
  else if (charlaOn && cv)
    shot = {
      kind: "charla",
      step: chl.step,
      playing: chPlaying,
      players: engineSeven(L, sq, chPlaying ? null : heroId),
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
      canMove: canEdit && !cb.preview && (modo === "editar" || modo === "quimica"),
      canLine: canEdit && modo === "editar" && plan.dlOn,
      magnets: canEdit && modo === "editar" && !L.freeMode,
      draw: canEdit && modo === "dibujar",
      drawRo: ready && ro && modo === "dibujar",
      pieces,
    },
    {
      // a bench cromo lifted off the phone strip (long press): the hand feels it
      onLift: () => buzz(12),
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
        commit(r.lineup, { drop, ui: { sel: null, pick: null, kb: null }, snap: "half" });
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
      onGrab: (dy, v) => {
        setSnap(settle(dy, v, snap));
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
  /** Siete → Cambios with another minute on the pitch: the seven is edited at minute 0. */
  const scrubbed = () => {
    if (!cb.preview) return false;
    say("El campo enseña otro minuto: vuelve al 0′ para cambiar el siete");
    return true;
  };
  const tapCard = (id: string, el: HTMLElement) => {
    if (ctl.guarded() || !ready) return;
    if (modo !== "editar" && modo !== "quimica") return;
    if (scrubbed()) return;
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
      commit(swap(L, sel.id, id), { ui: { sel: null, pick: null, kb: null }, snap: "half" });
      buzz([12, 30, 12]);
      announce("Cambio: " + nm(sel.id) + " por " + nm(id));
      return;
    }
    if (sel?.k === "b") {
      placeAt(i, sel.id);
      return;
    }
    patchUi({ sel: { k: "p", id }, pick: null, kb: null });
    setModo("editar");
    setTab("b");
    setSnap("half");
    buzz(8);
    announce(nm(id) + " en la mano: toca otro cromo o un hueco. Con el teclado, flechas para elegir sitio e Intro para soltar.");
  };
  const tapSlot = (i: number) => {
    if (ctl.guarded() || !canEdit || scrubbed()) return;
    if (sel) {
      placeAt(i, sel.id);
      return;
    }
    patchUi({ pick: pick === i ? null : i, kb: null });
    setModo("editar");
    setTab("b");
    setSnap("half");
    buzz(8);
  };
  // A bench player: a slot picked or a pitch player in the hand → he comes in there; else he is in the hand.
  const tapBench = (id: string) => {
    if (ctl.guarded() || !canEdit) return;
    const c = sq.byId.get(id);
    if (c?.baja) {
      say(c.name + ": " + c.baja.toLowerCase() + ", no se puede colocar");
      return;
    }
    if (pick != null) {
      placeAt(pick, id);
      return;
    }
    if (sel?.k === "p") {
      const i = L.slots.findIndex((s) => s.playerId === sel.id);
      if (i >= 0) {
        placeAt(i, id);
        say(nm(id) + " entra por " + nm(sel.id));
        return;
      }
    }
    if (sel?.id === id) {
      patchUi({ sel: null, kb: null });
      return;
    }
    patchUi({ sel: { k: "b", id }, pick: null, kb: null });
    buzz(8);
    announce(nm(id) + " en la mano: toca un hueco o un cromo del campo.");
  };

  // ── board actions ──
  const doUndo = () => {
    if (!canEdit) return;
    const r = undo(u.hist, L);
    if (!r) return;
    session.commit({ ...r.lineup, drawings: L.drawings, plays: L.plays });
    markOurs(r.lineup);
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
    markOurs(r.lineup);
    patchUi({ hist: r.history, sel: null, pick: null, fan: null, kb: null });
    runFx(morph(null, { rw: "AVANCE" }));
    buzz([6, 20, 6]);
    snd("flip");
    announce("Rehecho");
  };
  // Deshacer / Rehacer (the keys and the command bar's buttons) act on the tool on screen: the siete's
  // lineup, Dibujar's strokes, the jugadas' edits; elsewhere nothing (never the lineup hidden behind).
  const scope = canEdit ? undoScopeOf(modo) : null;
  const ctxUndo = () => (scope === "lineup" ? doUndo() : scope === "ink" ? inkUndo() : scope === "jugada" ? jUndo() : undefined);
  const ctxRedo = () => (scope === "lineup" ? doRedo() : scope === "ink" ? inkRedo() : scope === "jugada" ? jRedo() : undefined);
  const canUndoCtx = scope === "lineup" ? u.hist.past.length > 0 : scope === "ink" ? u.ink.past.length > 0 || strokes.length > 0 : scope === "jugada" ? u.jh.past.length > 0 : false;
  const canRedoCtx = scope === "lineup" ? u.hist.future.length > 0 : scope === "ink" ? u.ink.future.length > 0 : scope === "jugada" ? u.jh.future.length > 0 : false;
  const doSuggest = () => {
    if (!canEdit) return;
    // The board's match (linked, else the next): its convocatoria's siete comes first in the pack.
    const cm = props.calendar.find((c) => c.id === session.matchId) ?? props.nextMatch;
    const own = cm?.conv?.starters ?? [];
    const next = suggestSeven(L, sq, own, calledOf(cm));
    if (!next.slots.some((s) => s.playerId)) {
      say("No hay nadie disponible para el sobre");
      return;
    }
    commit(next, { ui: { sel: null, pick: null, kb: null }, fx: { spin: !rm } });
    buzz([10, 40, 10, 40, 10, 40, 60]);
    say(own.length && cm ? "Sobre abierto: el siete de la convocatoria de " + matchShort(cm) : "Sobre abierto: los siete en mejor forma" + (sq.recentLabel ? " (" + sq.recentLabel + ")" : ""));
  };
  const doAuto = () => {
    if (!canEdit) return;
    const next = autoPlace(L, sq, called);
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
      setChOk(false);
      chl.reset();
      if (prefs.v3) ask3d();
      sayStep(0, !rm);
    }
    // The focus follows: into the new panel's heading; back to what opened a panel when it closes (Esc,
    // «Volver», «Más»'s back buttons — not the rail, which opens the panel it names).
    const act = document.activeElement instanceof HTMLElement && rootRef.current?.contains(document.activeElement) ? document.activeElement : null;
    const fromRail = !!act?.closest(".mbar");
    const closing = m !== "plan" && !fromRail && target !== modo && (target === "editar" || (target === "mas" && MAS_KIDS.includes(modo)));
    if (closing) {
      const opener = openedBy.current.get(modo);
      focusNext.current = target === "mas" ? { sel: '[data-go="' + modo + '"]' } : opener?.isConnected ? { el: opener } : "heading";
    } else {
      if (act && target !== modo) openedBy.current.set(target, act);
      // (la charla takes the focus to its own transport)
      focusNext.current = target === "charla" ? null : "heading";
    }
    // (its «nuevo» badge goes once the tool has been opened twice on this device)
    if (target !== modo) noteToolOpened(target);
    setUntouched(false);
    setModo(target);
    setSnap(snapOf(target));
    setTab(m === "plan" ? "p" : "b");
    patchUi({ sel: null, pick: null, fan: null, fic: null, kb: null, inkSel: null, rivSel: null });
    setMk((k) => k + 1);
    buzz(10);
  };
  // (after the panel is on screen: see goModo)
  useEffect(() => {
    const f = focusNext.current;
    if (!f) return;
    focusNext.current = null;
    const root = rootRef.current;
    const el = f === "heading" ? null : (f.el ?? (f.sel ? root?.querySelector<HTMLElement>(f.sel) : null));
    if (el?.isConnected) el.focus({ preventScroll: true });
    else focusHeading(sheetRef.current);
  }, [mk]);
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
  const onTab = (t: OnceTab) => setTab(t);
  const cycleSnap = () => {
    if (ctl.guarded()) return;
    setSnap(cycle(snap));
    buzz(6);
  };
  const stepSnap = (d: 1 | -1) => setSnap(step(snap, d));
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
    // (Ctrl Z / Ctrl Y are the board's keys: see boardKeys) — typing keeps every key, Escape included
    if (field || e.defaultPrevented) return;
    if (modo === "dibujar" && inkSel && (e.key === "Delete" || e.key === "Backspace")) {
      e.preventDefault();
      inkDelete(inkSel);
      return;
    }
    // the marked stroke moves with the arrows (Shift: further)
    const inkD = modo === "dibujar" && inkSel && canEdit && !e.altKey && !e.ctrlKey && !e.metaKey ? nudgeOf(e.key, e.shiftKey) : null;
    if (inkD && inkSel) {
      e.preventDefault();
      inkNudge(inkSel, inkD[0], inkD[1]);
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
        announce("Cancelado");
      }
      return;
    }
    if (!sel || !canEdit || modo !== "editar") return;
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

  // ── the player in the hand: his action bar (and the C / G / F / Esc keys) ──
  const tokEl = (id: string): HTMLElement | null => {
    const els = rootRef.current?.querySelectorAll<HTMLElement>("[data-tok]") ?? [];
    return cardEl(id) ?? Array.from(els).find((e) => e.getAttribute("data-tok") === id) ?? null;
  };
  const capSel = () => {
    if (!inHand || inHand.k !== "p" || !canEdit) return;
    const was = L.roles.captainId === inHand.id;
    commit(toggleRole(L, "captainId", inHand.id), { ui: { sel: inHand } });
    buzz(10);
    say(was ? "Sin capitán" : "Capitán: " + nm(inHand.id));
  };
  const galSel = () => {
    if (inHand?.k === "p") openFan(inHand.id, cardEl(inHand.id));
  };
  const ficSel = () => {
    if (inHand) openFic(inHand.id, tokEl(inHand.id));
  };
  const dropSel = () => {
    if (!sel && pick == null && u.kb == null) return;
    patchUi({ sel: null, pick: null, kb: null });
    buzz(6);
  };
  const selV = inHand
    ? (() => {
        const c = sq.byId.get(inHand.id);
        const at = L.slots.findIndex((s) => s.playerId === inHand.id);
        return c ? selBarView(c, inHand.k === "p" && at >= 0 ? slotLabel(L, at) : null, L.roles.captainId === inHand.id) : null;
      })()
    : null;
  // Rendered once: at the top of the Siete tool on phones (sb-s), on the pitch's apron elsewhere (sb-p,
  // which the CSS hides on a mouse desktop: the prompt bar has the hand there).
  const selBarEl: ReactNode = selV ? <SelBar k={phone ? "sb-s" : "sb-p"} v={selV} onCap={capSel} onGal={galSel} onFicha={ficSel} onClear={dropSel} /> : null;
  const selS = phone ? selBarEl : null;

  // ── the keyboard (mouse + keyboard screens; the prompt bar teaches it): 1–8 the tools; Siete: Q / E the
  // tabs, R the bench as list or cromos, and with a player in the hand C capitán · G galones · F ficha ·
  // Esc soltar; Esc otherwise back to the siete; Ctrl Z deshacer (Dibujar: the last stroke); the replay
  // and the charla: Space plays / pauses, ← → a step back / forward, and Esc leaves the charla (or skips
  // the 3D intro). Typing, the fan and the ficha keep their keys. ──
  const ONCE_TABS: OnceTab[] = ["b", "s", "p", "c"];
  const boardKeys = (e: globalThis.KeyboardEvent) => {
    if (intro3d && e.key === "Escape") {
      skipIntro();
      return;
    }
    // (Alt: AltGr types characters with Ctrl + Alt on Windows; it is never a shortcut here)
    if (fan || fic || e.defaultPrevented || e.altKey) return;
    const t = e.target instanceof HTMLElement ? e.target : null;
    const root = rootRef.current;
    if (t && t !== document.body && root && !root.contains(t)) return;
    const tag = t?.tagName ?? "";
    const typing = tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || !!t?.isContentEditable;
    // Ctrl Z / ⌘ Z undoes what the tool on screen did; Ctrl ⇧ Z / Ctrl Y redoes it (see undoScope.ts)
    if (e.ctrlKey || e.metaKey) {
      const k = e.key.toLowerCase();
      if (typing || (k !== "z" && k !== "y")) return;
      e.preventDefault();
      if (k === "y" || e.shiftKey) ctxRedo();
      else ctxUndo();
      return;
    }
    if (modo === "charla" && e.key === "Escape") {
      e.preventDefault();
      goModo("editar");
      return;
    }
    if (typing) return;
    if (/^[1-8]$/.test(e.key)) {
      e.preventDefault();
      goModo(RAIL_ORDER[+e.key - 1]);
      return;
    }
    if (modo === "jugadas" || modo === "charla") {
      if (e.key === " " || e.key === "Spacebar") {
        // a focused control keeps its own Space
        if (tag === "BUTTON" || tag === "A") return;
        e.preventDefault();
        if (modo === "charla") chl.toggle();
        else playToggle();
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const d = e.key === "ArrowLeft" ? -1 : 1;
        if (modo === "charla") chl.step1(d);
        else jStep(d);
        return;
      }
    }
    if (e.key === "Escape") {
      e.preventDefault();
      if ((modo === "dibujar" && inkSel) || (modo === "jugadas" && rivSel)) patchUi({ inkSel: null, rivSel: null });
      else if (sel || pick != null || u.kb != null) dropSel();
      else if (modo !== "editar") goModo("editar");
      return;
    }
    // (Cambios: , . the minute on the pitch, N a cambio, M repartir, H hacer el cambio)
    if (modo === "editar" && tab === "c" && !e.ctrlKey && !e.metaKey && cb.key(e)) {
      e.preventDefault();
      return;
    }
    if (modo !== "editar" || e.ctrlKey || e.shiftKey) return;
    const k = e.key.toLowerCase();
    if (k === "q" || k === "e") {
      setTab(ONCE_TABS[(ONCE_TABS.indexOf(tab) + (k === "q" ? ONCE_TABS.length - 1 : 1)) % ONCE_TABS.length]);
      buzz(6);
    } else if (k === "r") setBenchView(benchView === "lista" ? "cromos" : "lista");
    else if (k === "c") capSel();
    else if (k === "g") galSel();
    else if (k === "f") ficSel();
  };
  const keysLatest = useRef(boardKeys);
  useEffect(() => {
    keysLatest.current = boardKeys;
  });
  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => keysLatest.current(e);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // ── the squad bars, the convocatoria, the bench (Banquillo · Sin convocar · Bajas), the reparto ──
  const sInfo = squadInfo(L, sq, ch);
  const cm = props.conv.match;
  const called = calledOf(cm);
  const conv = convHead({ sq, match: cm, loading: props.conv.loading, error: props.conv.error });
  // «Solo los que van» = those who said «Voy» (it needs answers to the convocatoria).
  const ocOn = oc && conv.answered;
  // The bench's groups are only worked out while the Convocatoria page is on screen (and the React
  // Compiler keeps them while their inputs don't change).
  const benchOn = modo === "editar" && tab === "b";
  const selP = sel?.k === "p" ? L.slots.findIndex((s) => s.playerId === sel.id) : -1;
  const benchHand: BenchHand | null = !benchOn || !canEdit ? null : sel && selP >= 0 ? { kind: "p", name: nm(sel.id), zone: slotZone(L, selP) } : pick != null ? { kind: "slot", zone: slotZone(L, pick) } : null;
  const groups = benchOn
    ? benchGroups({
        bench: sq.list.filter((c) => !onPitch.has(c.id)),
        called,
        filter: { on: srx, q, zf, oc: ocOn },
        hand: benchHand,
        selId: sel?.k === "b" ? sel.id : null,
        meId: props.meId,
      })
    : NO_GROUPS;
  // «Buscar en la plantilla» finds the ones on the pitch too: tapping one marks him there
  const found = pitchFound(L, sq, { on: srx, q, zf, oc: ocOn }, (i) => slotLabel(L, i));
  const onFound = (id: string) => {
    const i = L.slots.findIndex((s) => s.playerId === id);
    if (i < 0) return;
    cardEl(id)?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    buzz(8);
    if (canEdit) {
      patchUi({ sel: { k: "p", id }, pick: null, kb: null });
      announce(nm(id) + " está en el campo, de " + slotLabel(L, i) + ": en la mano. Toca otro cromo o un hueco.");
    } else say(nm(id) + " está en el campo, de " + slotLabel(L, i));
  };
  // (the reparto only while the Plan page shows it)
  const planOn = modo === "editar" && tab === "p";
  const rp = planOn ? reparto(L, sq, called) : NO_REPARTO;
  const rot = rp.rot;
  const galLeg = GALONES.map((g) => {
    const h = L.roles[g.key];
    const kind = ROLE_TAKER[g.key];
    const order = kind ? takersOf(L)[kind] : [];
    // (only who wears it on the pitch: a galón never stays on the bench; the dead balls say their order)
    return { l: g.letter, t: g.label + " · " + (order.length > 1 ? orderTxt(order, nm) : h && onPitch.has(h) ? nm(h) : "sin asignar") };
  });
  const doRotate = () => {
    if (!canEdit) {
      say(ready ? roMsg : "Cargando el tablero…");
      return;
    }
    if (!rot) {
      say("El reparto ya está equilibrado");
      return;
    }
    const r = rot;
    placeAt(r.i, r.id);
    say(nm(r.id) + " entra por " + nm(r.out) + ": más minutos para quien menos ha jugado");
  };
  // «Avisar a los que dudan»: a message for the team's group (the share sheet, else the clipboard)
  const doAvisar = async () => {
    const txt = avisoTxt(conv.aviso, cm, avisoUrl(window.location.origin));
    if (!txt) {
      say("Nadie a quien avisar: no hay dudas ni convocados sin responder");
      return;
    }
    buzz(10);
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ text: txt });
        return;
      }
      await navigator.clipboard.writeText(txt);
      say("Aviso copiado: pégalo en el grupo");
    } catch (err) {
      // (closing the share sheet is not an error)
      if (err instanceof DOMException && err.name === "AbortError") return;
      say("Manda el aviso: " + txt, undefined, 6000);
    }
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
        setTab("b");
        announce(nm(fan.id) + " al banquillo");
      }
    }
  };
  const ficha = fic ? fichaOf({ id: fic.id, L, sq, ch, match, ox: fic.ox, oy: fic.oy, side: fic.side }) : null;

  // ── the plan ──
  const tac = tacRows(L);
  const onTactic = (k: Parameters<typeof setTactic>[1], v: string) => {
    if (!canEdit) return;
    const next = setTactic(L, k, v);
    if (next === L) return;
    commit(next);
    buzz(8);
    if (k === "defLine") say("Línea " + v.toLowerCase() + ": la defensa se mueve");
    // (the stepper is not a live region: the board's one announcer says the new value)
    else announce((tac.find((t) => t.key === k)?.label ?? "Consigna") + ": " + v);
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
  // («El siete que jugó» of the linked match first, when its acta says who started)
  const played = playedOption(linked);
  const cmpOpts = [...(played ? [played] : []), ...cmpDocs.map((d) => ({ id: d.id, name: (d.isOfficial && !/^oficial/i.test(d.name) ? "Oficial · " : "") + d.name }))];
  const cmpId = cmpPick && cmpOpts.some((o) => o.id === cmpPick) ? cmpPick : (cmpOpts[0]?.id ?? null);
  const cmpDoc = cmpDocs.find((d) => d.id === cmpId) ?? null;
  const LB =
    modo !== "comparar"
      ? null
      : cmpId === PLAYED_ID && linked?.conv
        ? playedSeven(L, linked.conv.starters, sq)
        : cmpDoc
          ? normalize(extractLineup(cmpDoc), squadIds)
          : null;
  const cmp = LB ? cmpMarks(L, LB, cam) : [];
  const chg = LB ? changes(L, LB) : { ins: [], outs: [] };

  // ── Compartir: the cartel ──
  // (laid out, and its key stringified, only while Compartir is open)
  const shareOn = modo === "compartir";
  const cartel = shareOn ? cartelLayout(L, sq, ch, match, props.seasonName) : null;
  const cartelKey = cartel ? JSON.stringify(cartel) : "";
  const cartelNow = useRef(cartel);
  useEffect(() => {
    cartelNow.current = cartel;
  });
  useEffect(() => {
    if (!cartelKey) return;
    let dead = false;
    const t = window.setTimeout(() => {
      const c = cartelNow.current;
      if (!c) return;
      void crestImage()
        .then((crest) => cartelBlob(c, crest))
        .then((blob) => {
          if (!dead && blob) setPrepared({ key: cartelKey, blob });
        })
        .catch((err: unknown) => console.error("No se pudo preparar el cartel", err));
    }, 300);
    return () => {
      dead = true;
      window.clearTimeout(t);
    };
  }, [cartelKey]);
  const toGroup = async (mode: "share" | "png") => {
    if (shareBusy) return;
    if (ch.n < 7) {
      say("Completa el siete para compartir");
      return;
    }
    // «Mandar al grupo» only with the PNG already prepared: no await before the share sheet, so Safari
    // still sees the tap (the PNG is prepared as soon as Compartir opens)
    const png = preparedFor(prepared, cartelKey);
    if (mode === "share" && !png) {
      say("Preparando el cartel…");
      return;
    }
    setShareBusy(true);
    try {
      const file = cartelFile(session.name);
      if (mode === "share" && png) {
        const r = await shareCartel(png, file, "Los siete · " + session.name, (match ? match.short + " · " : "") + hud.sysName + " · química " + ch.v);
        if (r === "downloaded") say("Cartel descargado: mándalo al grupo");
        else if (r === "shared") say("Cartel listo para el grupo");
        return;
      }
      const blob = png ?? (await cartelBlob(cartel ?? cartelLayout(L, sq, ch, match, props.seasonName), await crestImage()));
      if (!blob) {
        say("Este navegador no puede crear el cartel");
        return;
      }
      download(blob, file);
      say("Cartel guardado como PNG");
    } catch (err) {
      console.error("No se pudo crear el cartel", err);
      say("No se ha podido crear el cartel");
    } finally {
      setShareBusy(false);
    }
  };
  const copyLink = async (charla: boolean) => {
    if (!session.id) return;
    const url = boardLink(window.location.origin, session.id, charla, props.seasonId);
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
      errors: jErrs,
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
    // a player in the hand: his action bar instead of the hint, the targets glow
    selV ? "has-sel" : "",
    // the bench as FUT list rows (desktop: the bench renders only the view on screen, see useWide)
    shownBench(benchView, wide) === "lista" ? "b-lista" : "",
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
      <>
        <SquadBars info={sInfo} sysName={hud.sysName} matchShort={match?.short ?? ""} qv={ch.v} qTier={tierOf(ch.v)[0]} />
        {selS}
        <OnceTabs tab={tab} onTab={onTab} />
        {tab === "b" && (
          <BenchTab
            ro={!canEdit}
            hot={dragFrom === "pitch"}
            recentLabel={sq.recentLabel}
            conv={conv}
            groups={groups}
            srx={srx}
            q={q}
            zf={zf}
            oc={ocOn}
            ocOff={!conv.answered}
            seasons={props.seasons}
            seasonId={props.seasonId}
            onSuggest={doSuggest}
            onAuto={doAuto}
            onAvisar={() => void doAvisar()}
            onSrx={() => setSrx(!srx)}
            onTapBench={tapBench}
            onQ={setQ}
            onZf={setZf}
            onOc={() => setOc(!oc)}
            onSeason={props.onSeason}
            benchView={benchView}
            onBenchView={setBenchView}
            found={found}
            onFound={onFound}
          />
        )}
        {tab === "s" && (
          <SystemTab
            formation={L.formation}
            free={L.freeMode}
            grid={prefs.grid}
            ro={!canEdit}
            ch={ch}
            sq={sq}
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
        {tab === "c" && cb.tab}
        {tab === "p" && <PlanTab rows={tac} ro={!canEdit} rep={rp.rows} repTxt={rp.txt} canRotate={!!rot} note={planNote(L)} onSet={onTactic} onRotate={doRotate} />}
      </>
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
          // Undoable until the session deletes it (DELETE_MS): a row in Tableros, and a toast that comes
          // back after any other message.
          const run = () => {
            dropPend(bid);
            undoDel();
            say("«" + was + "» recuperado");
          };
          pendRef.current = [...pendRef.current.filter((x) => x.id !== bid), { id: bid, name: was, run }];
          setPendDel(pendRef.current);
          window.clearTimeout(delTimers.current.get(bid));
          delTimers.current.set(
            bid,
            window.setTimeout(() => dropPend(bid), DELETE_MS),
          );
          say("«" + was + "» borrado", { label: "Deshacer", aria: "Deshacer el borrado de «" + was + "»", run }, DELETE_MS);
        }}
        pending={pendDel.map((d) => ({ id: d.id, name: d.name, undo: d.run }))}
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
                  const done = "Publicado como oficial · " + (mid ? "este partido" : "toda la temporada");
                  // One source: a match's official that is not its convocatoria's siete asks to update it.
                  const pm = mid ? calById(mid) : null;
                  const sync = pm && props.onSyncConvocatoria ? convocatoriaFromBoard(pm.conv, L.slots.map((x) => x.playerId)) : null;
                  const syncTo = props.onSyncConvocatoria;
                  if (!pm || !sync || !syncTo) {
                    say(done);
                    return;
                  }
                  say(
                    done + " · ¿Actualizar la convocatoria con este siete?",
                    {
                      label: "Actualizar",
                      aria: "Actualizar la convocatoria de " + matchShort(pm) + " con este siete",
                      run: () => {
                        syncTo(pm.id, sync)
                          .then(() => say("Convocatoria de " + matchShort(pm) + " al día: este es su siete"))
                          .catch(tbFail);
                      },
                    },
                    9000,
                  );
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
    ) : modo === "compartir" && cartel ? (
      <CompartirPanel cartel={cartel} block={shareBlock} busy={shareBusy} ready={!!preparedFor(prepared, cartelKey)} canLink={!!session.id} onShare={() => void toGroup("share")} onPng={() => void toGroup("png")} onLink={(charla) => void copyLink(charla)} onBack={() => goModo("mas")} />
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
        onIntro3d={can3d ? () => setIntro({ kind: "3d", phase: "wait" }) : undefined}
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
        canUndo={canEdit && (u.ink.past.length > 0 || strokes.length > 0)}
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
        onSelect={(id) => {
          patchUi({ inkSel: id });
          const st = id ? strokes.find((x) => x.id === id) : undefined;
          if (st) announce(markedTxt(st));
        }}
        onDelete={inkDelete}
      />
    ) : cv ? (
      <CharlaGuion v={cv} title={match?.short ?? session.name} note3d={chNote3d} />
    ) : null;

  // ── the chrome: the camera's geometry for the layout, the rail's match card, the prompt bar ──
  const geo = camGeo(cam);
  const saveCls = ro ? "ro" : session.status;
  const cvMatch = props.conv.match;
  const cvN = conv;
  const matchCard: MatchCard | null = match
    ? {
        kick: cvMatch && props.nextMatch && cvMatch.id !== props.nextMatch.id ? "Partido del tablero" : "Próximo partido",
        title: match.short,
        when: [match.date, match.time].filter(Boolean).join(" · "),
        counts: cvMatch && !props.conv.loading && !props.conv.error && cvN.voy + cvN.duda + cvN.no > 0 ? { voy: cvN.voy, duda: cvN.duda, no: cvN.no } : null,
        note: !cvMatch ? "Sin convocatoria" : props.conv.error ? "No se ha podido leer la convocatoria" : props.conv.loading ? "Leyendo la convocatoria…" : "Nadie ha respondido aún",
      }
    : null;
  const pmCtx: PromptCtx = {
    modo,
    ro: !canEdit,
    hand: selV && inHand ? { k: inHand.k, name: selV.name, rt: selV.rt } : null,
    benchView,
    playing: charlaOn ? chPlaying && !!cv && chl.step < cv.last : rpl.playing,
    pieces,
    marked: modo === "dibujar" && !!inkSel,
    tab,
    live: !!cb.live && props.isAdmin,
  };
  const pmActs: PromptActs = {
    undo: doUndo,
    undoStroke: inkUndo,
    redoStroke: inkRedo,
    undoJugada: jUndo,
    captain: capSel,
    galones: galSel,
    ficha: ficSel,
    drop: dropSel,
    toggle: charlaOn ? chl.toggle : playToggle,
    prev: () => (charlaOn ? chl.step1(-1) : jStep(-1)),
    next: () => (charlaOn ? chl.step1(1) : jStep(1)),
    siete: () => goModo("editar"),
    exitCharla: () => goModo("editar"),
    addSub: cb.add,
    repartir: cb.repartir,
    hacer: cb.hacer,
  };

  return (
    <div
      ref={rootRef}
      className={rootCls}
      data-modo={modo}
      data-snap={snap}
      style={vars({ "--fh": C.Fh, "--vr": geo.vr, "--cut": geo.cut, "--kb": geo.kb })}
      onPointerDown={ctl.onPointerDown}
      onKeyDown={onKey}
      onContextMenu={(e) => {
        // a long press on a cromo opens the fan, not the browser's menu
        if ((e.target as Element).closest("[data-tok],[data-dline],[data-grab]")) e.preventDefault();
      }}
    >
      <div className="vx-grain" aria-hidden="true" />
      {props.header}
      {/* (busy while the board first loads: only the board, never the site's header and footer) */}
      <section className="app" aria-label="La pizarra" aria-busy={!seenReady} ref={appRef}>
        <Stage
          cam={cam}
          view={view}
          ink={ink}
          jug={jug}
          pieces={pieces}
          focusCards={modo !== "jugadas" && modo !== "dibujar" && !charlaOn}
          selbar={phone ? null : selBarEl}
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
                events={{ onIntroDone: skipIntro, onFrame: rpl.reached, onStep: (i: number) => !chGate && chl.reached(i) }}
              />
            ) : null
          }
          liveRef={liveRef}
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
          pieceAria={pieceAria}
          onPieceKey={onPieceKey}
          onPieceTap={onPieceTap}
        />
        <AppBar
          crest={props.crest}
          name={session.name}
          matchShort={match?.short ?? null}
          saveTxt={saveTxt}
          saveCls={saveCls}
          hud={hud}
          cele={!!chFinal || hud.celeOn}
          sysk={sysk}
          ro={!canEdit}
          noUndo={!canUndoCtx}
          noRedo={!canRedoCtx}
          bug={modo === "jugadas" ? { a: rh.bugA, b: rh.bugB, k: rh.bugK, aria: rh.bugAria } : null}
          shareOn={modo === "compartir"}
          onName={() => goModo("tableros")}
          onUndo={ctxUndo}
          onRedo={ctxRedo}
          onShare={() => goModo("compartir")}
          onCharla={() => goModo("charla")}
          onSys={(d) => canEdit && toSystem(stepSystem(L, d))}
          onSysPick={goSis}
          onQuimica={() => goModo("quimica")}
          onBug={() => setSnap("half")}
          live={cb.plate}
        />
        {ro && ready && <ReadOnlyStrip label={session.official ? "OFICIAL · SOLO LECTURA" : "SOLO LECTURA · @" + session.owner.toUpperCase()} onDuplicate={session.duplicate} onMine={session.openMine} />}
        {/* (not live: it changes with every paso of a replay; what matters is announced on its own) */}
        <p className="hint">
          <i aria-hidden="true" />
          <span key={hint}>{hint}</span>
        </p>
        <Sheet title={SHEET_TITLE[modo]} snap={snap} mk={mk} sheetRef={sheetRef} onCycle={cycleSnap} onStep={stepSnap}>
          {shown}
        </Sheet>
        <ModeBar modo={modo} onGo={goModo} card={matchCard} />
        <PromptBar ctx={pmCtx} acts={pmActs} saveTxt={saveTxt} saveCls={saveCls} />
        {cv && (
          <CharlaOverlay
            v={cv}
            step={chl.step}
            playing={chPlaying}
            rm={rm}
            onToggle={chl.toggle}
            onStep={chl.step1}
            onSeek={chl.seek}
            onExit={() => goModo("editar")}
            gate={
              chGate
                ? {
                    missing: chMissing,
                    onAnyway: () => setChOk(true),
                    onPlan: () => {
                      setChOk(true);
                      chl.seek(STEP_PLAN);
                      if (!rm) chl.toggle();
                    },
                  }
                : null
            }
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
            // «Jugar de» opens a new set of items: a fresh fan focuses its first one again (and closing
            // it still gives the focus back to the cromo)
            key={fan.id + ":" + (fan.sub === true ? "sub" : fan.sub || "main")}
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
        {/* (not live: say() hands its words to the board's one announcer, the .sr below) */}
        <div className={"tst" + (toast ? " on" : "")}>
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
        {/* The board's one announcer. (An invisible mark that alternates makes the same words a new
            message, so they are said again; it also keeps this hidden copy from reading as the toast.) */}
        <p className="sr" aria-live="polite">
          {live.msg ? live.msg + (live.n % 2 ? "​" : "‌") : ""}
        </p>
        <div className="pz-dragl" ref={layerRef} aria-hidden="true" />
      </section>
      {props.footer}
    </div>
  );
}
