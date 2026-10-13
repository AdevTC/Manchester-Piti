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
import { systemDef } from "../../../lib/formations";
import { CAMS, camGeo, proj, slotPos, slotZone, TEMPO_PULSE } from "./geometry";
import { GALONES, isAvailable, isFull, type Squad } from "./model";
import { chemOf, tierOf } from "./quimica";
import { autoByEncajeOn, autoPlace, cycleDefLine, editSig, goFree, normalize, place, resetFree, resolveDrop, rolesLost, setDefLine, setSystem, snapAll, stepSystem, swap, toggleRole } from "./ops";
import { sevenByEncajeOn, suggestSeven } from "./pack";
import { boardInPlace, encajeCandidates, hasFitData, shownFit, slotCode } from "./encaje";
import { applyFan, fanCentre, fanItems, type FanItem, type FanSub } from "./fan";
import { EMPTY_HISTORY, pushHistory, redo, undo, type History } from "./history";
import { cycle, settle, snapOf, step, type Snap } from "./sheet";
import { DIR_KEYS, moveStroke, nudgeOf, nudgePoint, placeOf, slotInDirection, strokeMid, toPlace } from "./drag";
import { ago, FX0, fxDuration, hud as buildHud, joinLive, natTxtOf, pitchView, planLayer, positionsOf, tacSummary, vars, type Fx, type Modo } from "./view";
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
// Bloque 5 · presentar: la voz en off, el vídeo de la jugada, varias fichas a la vez, el modo presentación
import type { VozStore } from "./vozStore";
import { useVozCharla } from "./useVozCharla";
import { VozPanel } from "./VozPanel";
import { JugadaVideo } from "./JugadaVideo";
import { clockTxt, type PlayVideo } from "./playVideo";
import { useMultiSel } from "./useMultiSel";
import { MultiSelBar, MultiSelLayer, type MultiRing } from "./MultiSelView";
import { centreOf, clampGroupDelta, fichasTxt, frameShift, freePoints, moveFreeGroup, movePiecesGroup, piecePoints } from "./multiSel";
import { usePresenta } from "./usePresenta";
import { PresentaBar } from "./PresentaBar";
import { presJugadaTxt, presKey, presLed } from "./presenta";
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
  setPlayVideo,
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
  freeName,
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
import { useVariants } from "./useVariants";
import { VariantPills } from "./VariantPills";
import { charlaPlanB, cmpVariantKey, variantCmpOptions, variantNameError, variantView } from "./variants";
import { famCodeCount, famCount, famLine, familiarity, famSlot } from "./familiarity";
import type { CardView } from "./view";
import { MoverA } from "./MoverA";
import { OficialBanner } from "./OficialBanner";
import { useOficialBanner } from "./useOficialBanner";
import { moveOptions } from "./moveTo";
import { useTactica } from "./useTactica";
import { charlaShape } from "./phases";
import { lastPlayed, sevenFromStarters } from "./record";
import { isExtraKind } from "./drawKinds";
import { boardPlaces, cartelExtras, extraLabel, extraView, fueraOf, hitExtra, livePoints, makeFoco, makeFuera, makeMedir, makeUnir, metres, metresTxt, nearestPlayer, offsideY, rivalTokens, togglePick, type Side } from "./drawTools";
import { bendTo, curveHandles, curveOf, drawingToPlay, rateLabel, trailsDurOf, type Rate } from "./playPaths";
import { newRival, rivalName, setRivalNote, setRivalNum, setRivalSystem, type RivalSeven } from "./rival";
import { DrawLayer, DrawToolsBar } from "./DrawExtras";
import { RivalPanel } from "./RivalPanel";
import { BoardShare } from "./BoardShare";
import { ClipExport } from "./ClipExport";
import type { Cartel } from "./cartel";
// Bloque 5 · equipo y organización (pachanga, capitán rotativo, tableros organizados, plan imprimible)
import { PachangaPanel } from "./PachangaPanel";
import { applyCaptain, armbands, nextCaptain, rowTxt, whyTxt } from "./captain";
import { noteOpened, recentIds } from "./boardList";
import { matchDay as dayOf } from "./boards";
import { PrintPlan } from "./PrintPlan";
import { printView } from "./printSheet";
import { OFFLINE_TXT, useOnline } from "./online";

/** The cartel with Bloque 4's extras on its pitch (none: the cartel as it was). */
function withCartelExtras(c: Cartel, strokes: Stroke[], L: Lineup, rivalOn: boolean): Cartel {
  const extras = cartelExtras(strokes, L, L.rival, c.cromos, rivalOn);
  return extras.length ? { ...c, extras } : c;
}

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
  /** Bloque 5 · the charla's voice clips of this board (vozStore.ts; none in tests or without Firebase). */
  voz?: VozStore;
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
const MAS_KIDS: Modo[] = ["tableros", "comparar", "compartir", "ajustes", "pachanga"];

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
const HASH_MODOS: Modo[] = ["quimica", "jugadas", "dibujar", "mas", "tableros", "comparar", "compartir", "ajustes", "charla", "pachanga"];
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
  pachanga: "Pachanga",
};

export function Board(props: BoardProps) {
  const { squad: sq, prefs } = props;
  // ── the version of the seven on screen (Titular · 2ª parte · Plan B): the board edits it as its lineup ──
  const vIds = useMemo(() => sq.list.map((c) => c.id), [sq]);
  const vr = useVariants(props.session, vIds);
  const session = vr.session;
  const L = session.lineup;
  const ready = session.ready;
  const ro = session.readOnly;
  const canEdit = ready && !ro;
  const cam = prefs.cam === "top" ? "top" : "tv";
  const C = CAMS[cam];
  const show = { ...SHOW0, ...prefs.show };

  // (read live: the system's setting can change with the page open)
  const rm = useReducedMotion();
  // (Bloque 5: offline on the field, the save line says so even with nothing pending)
  const online = useOnline();
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
  // «Mover a…» open for a cromo of the seven (from the fan)
  const [mover, setMover] = useState<{ key: string; id: string } | null>(null);
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
  // «Sin responder» (in «Buscar en la plantilla»)
  const [sinF, setSinF] = useState(false);
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
  // Bloque 4: the players picked for Unir / Medir, the rival's red tokens on the pitch, Tableros by rival.
  const [picked, setPicked] = useState<string[]>([]);
  const [rivalOn, setRivalOn] = useState(true);
  const [rivalPick, setRivalPick] = useState<string | null>(null);
  // Jugadas: which one, the replay's toggles, the crest wipe, the 3D stadium.
  const [jidPick, setJid] = useState<string>(DEFAULT_JUGADA);
  // (the replay's speed: 0,5× · 1× · 1,5×; spd = the design's 0,5×, which the 3D stadium also plays)
  const [rate, setRate] = useState<Rate>(1);
  const spd = rate === 0.5;
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
  // (the Sistema tiles' pool, sorted: the same identity while nobody joins or leaves it)
  const candKey = encajeCandidates(L, sq).sort().join(",");
  const encCands = useMemo(() => (candKey ? candKey.split(",") : []), [candKey]);
  const nm = (id: string) => sq.byId.get(id)?.name ?? "Jugador";
  // «El oficial ha cambiado: entra X» (since this device last saw it; never to whoever is editing it)
  const offB = props.official;
  const ofb = useOficialBanner(offB, !!offB && offB.id === props.session.id && ready && !ro, nm);
  const offOther = offB && offB.id !== props.session.id ? offB.id : null;
  const onPitch = new Set(L.slots.map((s) => s.playerId).filter((x): x is string => !!x));
  let sel = u.sel;
  if (sel && (sel.k === "p" ? !onPitch.has(sel.id) : onPitch.has(sel.id) || !sq.byId.has(sel.id))) sel = null;
  const pick = u.pick != null && u.pick >= 0 && u.pick < L.slots.length ? u.pick : null;
  // The player in the hand, while editing an editable board: his action bar, the targets that glow.
  const inHand = modo === "editar" && canEdit ? sel : null;
  const fan = u.fan && onPitch.has(u.fan.id) ? u.fan : null;
  const moverOn = mover && mover.key === session.key && canEdit && modo === "editar" && onPitch.has(mover.id) ? mover.id : null;
  const fic = u.fic && sq.byId.has(u.fic.id) ? u.fic : null;
  const match = props.match;
  const hud = buildHud(L, sq, ch, fx, rm, match);
  // ── familiarity: where each one has lined up in the season's officials already played ──
  const cal0 = props.calendar;
  const fam = useMemo(() => familiarity(session.officials, (mid) => !!cal0.find((c) => c.id === mid)?.played), [session.officials, cal0]);
  const famAt = (id: string, i: number) => famSlot(fam, L, sq, id, i);
  const withFam = (c: CardView): CardView => {
    const f = famAt(c.id, c.i);
    if (!f.mark) return c;
    // (said with who he is, before what a tap does)
    const k = c.aria.indexOf(". Toca");
    return { ...c, fam: f.mark, aria: k >= 0 ? c.aria.slice(0, k) + ", " + f.txt + c.aria.slice(k) : c.aria + ", " + f.txt };
  };
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
  // (the official's banner is said once, when it appears)
  const annLatest = useRef(announce);
  useEffect(() => {
    annLatest.current = announce;
  });
  useEffect(() => {
    if (!ofb.msg) return;
    const t = window.setTimeout(() => annLatest.current(ofb.msg ?? ""), 0);
    return () => window.clearTimeout(t);
  }, [ofb.msg]);
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
      announce("¡Siete listo! " + (next.freeMode ? "Libre" : systemDef(next.formation).label));
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
    announce(occ && occ !== id ? nm(id) + " por " + nm(occ) + " en " + slotCode(L, i) : nm(id) + " a " + slotCode(L, i));
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
    slow: rate,
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
    // a path's handle let go: the run bends through where it was put (playPaths.ts)
    if (kind === "c:") {
      if (!at || !at.inside) return;
      const bent = editJugada((p) => bendTo(p, jf, id, framePointToPitch(C, at.X, at.Y)), "");
      if (bent) {
        buzz(8);
        announce("Carrera de " + nm(id) + (curveOf(bent, jf, id) ? " curvada" : " recta"));
      }
      return;

    }
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
    if (kind === "c:") {
      const h = curveHandles(jplay, jf, C, () => true).find((x) => x.id === id);
      if (!h) return;
      if (editJugada((p) => bendTo(p, jf, id, nudgePoint(h.mid, dx, dy)), "", undefined, "k" + jf + piece)) {
        buzz(6);
        announce("Carrera de " + nm(id) + " curvada " + toPlace(nudgePoint(h.mid, dx, dy)));
      }
      return;
    }
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

  // ── Bloque 5 · varias fichas a la vez: the cromos in free mode, the pieces of a paso being edited.
  // Shift / Ctrl-click (or «Seleccionar» on a touch screen) picks; dragging one moves them all; with the
  // keyboard, Mayús + Intro picks the focused one and the arrows move the group (multiSel.ts). ──
  const msFree = canEdit && modo === "editar" && !!L.freeMode;
  const ms = useMultiSel(msFree ? "f:" + session.key : pieces ? "j:" + session.key + ":" + jplay.id + ":" + jf : null, (k) =>
    msFree ? onPitch.has(k) : piecePoints(jplay, jf, [k]).size > 0,
  );
  const msName = (k: string) => (k === "b" ? "El balón" : k.startsWith("r:") ? "Un rival" : nm(k.startsWith("p:") ? k.slice(2) : k));
  const msTap = (k: string) => {
    const next = ms.toggle(k);
    buzz(8);
    announce(msName(k) + (next.includes(k) ? " elegido" : " fuera del grupo") + " · " + (next.length ? fichasTxt(next.length) + " para mover juntas" : "ninguna ficha elegida"));
  };
  /** Moves the group: `to` sends each pitch point; `drop` = where a drag let them go (frame %), to glide from. */
  const msMove = (keys: string[], to: (p: { x: number; y: number }) => { x: number; y: number }, drop: { dX: number; dY: number } | null, tag?: string) => {
    if (!keys.length) return;
    const d = drawn.current;
    const at = (xy: [number, number] | null | undefined): [number, number] | null => (xy && drop ? [xy[0] + drop.dX, xy[1] + drop.dY] : null);
    if (msFree) {
      const next = moveFreeGroup(L, keys, to, prefs.grid);
      const from = drop ? Object.fromEntries(keys.map((k): [string, [number, number] | null] => [k, at(d?.p[k])]).filter((x): x is [string, [number, number]] => !!x[1])) : null;
      if (next === L) {
        runFx(morph(from));
        return;
      }
      commit(next, { drop: from, ui: { sel: null, pick: null, kb: null } });
      buzz([12, 30, 12]);
      announce(fichasTxt(keys.length) + " movidas " + toPlace(centreOf(freePoints(next, keys))));
      return;
    }
    const moved = editJugada((p) => movePiecesGroup(p, jf, keys, to), "", undefined, tag);
    const pf: Record<string, [number, number]> = {};
    const rf: Record<string, [number, number]> = { ...(d?.r ?? {}) };
    let bf: [number, number] | null = null;
    keys.forEach((k) => {
      if (k === "b") bf = at(d?.b) ?? bf;
      else if (k.startsWith("r:")) {
        const v = at(d?.r[k.slice(2)]);
        if (v) rf[k.slice(2)] = v;
      } else {
        const v = at(d?.p[k.slice(2)]);
        if (v) pf[k.slice(2)] = v;
      }
    });
    runFx(morph(drop ? pf : null, drop ? { rfrom: rf, bfrom: bf ?? d?.b ?? null } : {}));
    if (!moved) return;
    buzz(10);
    announce(fichasTxt(keys.length) + " movidas " + toPlace(centreOf([...piecePoints(moved, jf, keys).values()])));
  };
  /** The arrows (pitch %): the group as far as it can go while all of it stays on the pitch. */
  const msNudge = (dx0: number, dy0: number) => {
    // (with the 5 % grid on, a step is one square of it)
    const sq5 = (v: number) => (msFree && prefs.grid && v && Math.abs(v) < 5 ? Math.sign(v) * 5 : v);
    const dx = sq5(dx0);
    const dy = sq5(dy0);
    const pts = msFree ? freePoints(L, ms.keys) : [...piecePoints(jplay, jf, ms.keys).values()];
    const [cx, cy] = msFree ? clampGroupDelta(pts, dx, dy, 4, 96) : clampGroupDelta(pts, dx, dy, 0, 100);
    if (!cx && !cy) return;
    if (!msFree) {
      setUntouched(false);
      rpl.pause();
    }
    msMove(ms.keys, (p) => ({ x: p.x + cx, y: p.y + cy }), null, "k" + jf + "grupo");
  };
  /** (captured before the pieces' own keys) Mayús + Intro picks the focused ficha, Esc lets the group go,
   *  and the arrows on a ficha of the group move all of it. */
  const msKeyCapture = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!ms.on || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target as Element;
    const tag = (t as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    const key = msFree ? t.closest("[data-tok][data-zone='p']")?.getAttribute("data-tok") : t.closest("[data-piece]")?.getAttribute("data-piece");
    if (e.key === "Enter" && e.shiftKey && key && !key.startsWith("c:")) {
      e.preventDefault();
      e.stopPropagation();
      msTap(key);
      return;
    }
    if (e.key === "Escape" && ms.keys.length && !sel) {
      e.preventDefault();
      e.stopPropagation();
      ms.clear();
      announce("Fichas soltadas");
      return;
    }
    const d = key && !sel && ms.keys.includes(key) && (msFree || ms.keys.length > 1) ? nudgeOf(e.key, e.shiftKey) : null;
    if (d) {
      e.preventDefault();
      e.stopPropagation();
      msNudge(d[0], d[1]);
    }
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
  const markedTxt = (st: Stroke) =>
    pinnedStroke(st)
      ? "Marcado: " + inkLabel(st) + ". Va pegado a los jugadores; «Borrar trazo» o Supr lo quita."
      : "Marcado: " + inkLabel(st) + ", en " + placeOf(strokeMid(st.points)) + ". Flechas para moverlo; «Borrar trazo» o Supr lo quita.";
  /** The marked stroke moved with the arrows (the keyboard's drag): it stays marked, each step undoable. */
  const inkNudge = (id: string, dx: number, dy: number) => {
    const pin = strokes.find((x) => x.id === id);
    if (pin && pinnedStroke(pin)) {
      announce("Va pegado a los jugadores: se mueve con ellos");
      return;
    }
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
    // Unir, Foco, Medir: a tap on one of the seven picks him, a drag measures (see drawPinned)
    if (isExtraKind(tool) && drawPinned(pts, tap)) return;
    if (tap && tool !== "texto") {
      // a tap marks the stroke under it (or lets go of the marked one)
      const id = hitStroke(strokes, C, pts[0][0], pts[0][1]) ?? hitExtra(strokes, L, L.rival, C, pts[0][0], pts[0][1]);
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

  // ── Dibujar, Bloque 4: Unir, Foco, Medir and the fuera de juego, pinned to the players (drawTools.ts) ──
  const places = boardPlaces(L);
  const pickable = picked.filter((id) => !!places[id]);
  const inkLabel = (st: Stroke): string => (isExtraKind(st.kind) ? extraLabel(st, nm, livePoints(st, places, L, L.rival)) : strokeLabel(st));
  const pinnedStroke = (st: Stroke): boolean => !!st.anchors || st.kind === "fuera";
  /** The seven where the frame draws them (frame %), to find the one a tap lands on. */
  const pinCards = () =>
    Object.entries(places).map(([id, q]) => {
      const f = proj(C, q.x, q.y);
      return { id, x: f.x, y: f.y };
    });
  const addPinned = (st: Stroke | null, msg: string, bad: string): boolean => {
    if (!st) {
      if (bad) say(bad);
      return false;
    }
    if (!canAddStroke(strokes)) {
      say("Ya hay " + plural(LIM.strokes, "trazo") + ": borra alguno para dibujar más");
      return false;
    }
    const next = addStroke(strokes, st);
    if (next === strokes || !setInk(next)) return false;
    setFresh((f) => new Set(f).add(st.id));
    buzz(10);
    say(msg);
    return true;
  };
  /** One of the seven picked for the tool on screen (a tap on the grass or a chip in Dibujar). */
  const pickPlayer = (id: string) => {
    if (!canEdit) return;
    if (tool === "foco") {
      addPinned(makeFoco(id, places, inkColor), "Foco en " + nm(id), "Ese jugador no está en el campo");
      return;
    }
    if (tool === "medir") {
      const two = togglePick(pickable, id, 2);
      if (two.length < 2) {
        setPicked(two);
        announce(two.length ? nm(id) + " elegido: elige otro para medir" : "Ninguno elegido");
        return;
      }
      setPicked([]);
      const a = places[two[0]];
      const b = places[two[1]];
      addPinned(makeMedir(a, b, inkColor, [two[0], two[1]]), nm(two[0]) + " – " + nm(two[1]) + ": " + metresTxt(metres(a, b)), "Están demasiado cerca para medir");
      return;
    }
    const next = togglePick(pickable, id, 4);
    if (next === pickable && !pickable.includes(id)) {
      say("Como mucho cuatro: pulsa «Unir» o quita a alguno");
      return;
    }
    setPicked(next);
    buzz(6);
    announce((next.includes(id) ? nm(id) + " elegido" : nm(id) + " fuera") + " · " + plural(next.length, "jugador", "jugadores") + " para unir");
  };
  const doUnir = () => {
    if (addPinned(makeUnir(pickable, places, inkColor), "Unidos: " + pickable.map(nm).join(", ") + ". Se mueven juntos", "Elige de 2 a 4 jugadores para unirlos")) setPicked([]);
  };
  /** A gesture with Unir / Foco / Medir: true when it was theirs (a drag measures; a tap picks a player). */
  const drawPinned = (pts: [number, number][], tap: boolean): boolean => {
    const [X0, Y0] = pts[0];
    const [X1, Y1] = pts[pts.length - 1];
    if (tool === "medir" && !tap) {
      const a = nearestPlayer(pinCards(), X0, Y0, C.Fh);
      const b = nearestPlayer(pinCards(), X1, Y1, C.Fh);
      const both: [string, string] | null = a && b && a !== b ? [a, b] : null;
      const pa = both ? places[both[0]] : framePointToPitch(C, X0, Y0);
      const pb = both ? places[both[1]] : framePointToPitch(C, X1, Y1);
      addPinned(makeMedir(pa, pb, inkColor, both), "Medido: " + metresTxt(metres(pa, pb)), "Arrastra un poco más para medir");
      return true;
    }
    if (!tap) return tool === "unir" || tool === "foco";
    const id = nearestPlayer(pinCards(), X0, Y0, C.Fh);
    if (!id) return false;
    pickPlayer(id);
    return true;
  };
  const toggleFuera = (side: Side) => {
    if (!canEdit) return;
    const had = fueraOf(strokes, side);
    if (had) {
      if (setInk(removeStroke(strokes, had.id))) say("Fuera de juego quitado", inkUndoAct("Deshacer: recuperar la línea del fuera de juego"));
      return;
    }
    const y = offsideY(L, side, L.rival);
    if (y == null) {
      say(side === "rival" ? "Añade el siete rival (Siete → Plan) para ver su línea" : "Hacen falta dos en el campo para la línea");
      return;
    }
    addPinned(makeFuera(side, y, inkColor), side === "rival" ? "Fuera de juego en su último defensa: se mueve solo" : "Fuera de juego en nuestro último defensa: se mueve solo", "");
  };
  /** «Convertir el dibujo en jugada»: the carreras, pases and conducciones become a two-paso jugada. */
  const toJugada = () => {
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
    const pl = drawingToPlay(strokes, L, freeName("Del dibujo", list.map((x) => x.name)));
    if (!pl) {
      say("Ningún trazo sale de un jugador: dibuja la carrera o el pase desde un cromo");
      return;
    }
    if (!saveExtras({ ...L, plays: savePlay(list, pl) })) return;
    pushJ({ id: pl.id, before: null, after: pl, jid0: jplay.id, jid1: pl.id });
    setUntouched(false);
    setJid(pl.id);
    setJChosen(true);
    rpl.reset(session.key + ":" + pl.id, false);
    goModo("jugadas");
    buzz([10, 30, 10]);
    say("«" + pl.name + "» creada desde el dibujo: dos pasos para retocar");
  };

  // ── el rival (Siete → Plan): their seven, a dorsal and a note each, red tokens with «Rival» ──
  const setRival = (next: RivalSeven | null, msg: string, act?: Toast["act"]): boolean => {
    if (!saveExtras({ ...L, rival: next })) return false;
    if (msg) say(msg, act);
    return true;
  };
  const rivalAdd = () => {
    if (L.rival) return;
    if (setRival(newRival(), "Siete rival en el campo, en rojo: apunta sus dorsales y qué hacer con cada uno")) setRivalOn(true);
  };
  const rivalRemove = () => {
    const was = L.rival;
    if (!was) return;
    const k = session.key;
    setRival(null, "Rival quitado", {
      label: "Deshacer",
      aria: "Deshacer: recuperar el siete rival",
      run: () => {
        const now = later.current;
        if (now.key === k) now.save({ ...now.L, rival: was });
      },
    });
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
  const chArgs = { L, sq, play: chPlay, playShort: chItem.short, match, boardName: session.name, sysName: hud.sysName, tacSum, qv: ch.v, in3d: live3dC, loading: !ready, planB: charlaOn ? charlaPlanB(vr.titular, squadIds, nm) : null, sinBalon: charlaOn ? charlaShape(L, nm) : null };
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

  // ── Bloque 5 · la voz en off of each step (read only while the charla is on), and the presentation ──
  const vozWant = props.voz?.want;
  useEffect(() => {
    vozWant?.(charlaOn);
  }, [vozWant, charlaOn]);
  const voz = useVozCharla({
    store: props.voz,
    on: charlaOn && ready && !chGate,
    step: chl.step,
    last: chLast,
    playing: chPlaying,
    canEdit,
    pause: () => {
      if (chl.playing && !rm) chl.toggle();
    },
    resume: () => {
      if (!chl.playing && !rm && chl.step < chLast) chl.toggle();
    },
    announce,
  });
  const pres = usePresenta(rootRef, announce);

  // ── Bloque 4 · la táctica: con / sin balón and the fases on the pitch, the styles, the conditional plan,
  // the química por jugador (useTactica.tsx) ──
  const tq = useTactica({
    key: session.key,
    L,
    sq,
    canEdit,
    commit: (next) => commit(next),
    say,
    announce,
    glide: () => {
      if (!rm) runFx(morph(null, { slow: true }));
    },
    nm,
  });

  // ── día de partido: Siete → Cambios, the scrubbed minute on the pitch, the live plate ──
  const cb = useCambios({
    liveExtra: tq.liveExtra,
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
  // (the Plan tab may show a phase or a style's preview: the cromos go there and can't be moved meanwhile)
  const tpv = tq.pitch(cb.pitch, modo === "editar" && tab === "p", cam);
  const view0 = pitchView({ L: tpv.L, sq, ch, cam, modo, fx, selId: sel?.id ?? null, hand: inHand, pick, ro: !canEdit || tpv.on, rm, meId: props.meId, mini, present: charlaOn ? chl.step : undefined });
  // (each cromo's own química: 0–3 diamonds)
  const view1 = { ...view0, cards: tq.withDiamonds(view0.cards, cb.pitch) };
  // (the familiarity badge on the cromos while the siete is edited: «++», «+», «!»)
  const view = modo === "editar" && !mini && fam.games ? { ...view1, cards: view1.cards.map((c) => withFam(c)) } : view1;
  const plan0 = planLayer(tpv.planL ?? L, cam, modo, showPlan);
  const plan = tpv.on ? { ...plan0, dlOn: false, tarrs: tpv.arrows ?? plan0.tarrs } : plan0;

  // ── the stadium: what it films ──
  // (it is mounted the first time a 3D moment wants it and stays, paused, for the next one; after a
  // minute with no 3D moment it is unmounted, and «3D» off unmounts it at once)
  const wantNow = can3d && (intro3d || charlaOn || (want3d && rpl.playing));
  const keep3d = useStadiumMount(can3d, wantNow);
  if (!keep3d && ready3d) setReady3d(false);
  const led3d = ["Manchester Piti", "Sistema " + (L.freeMode ? "libre" : systemDef(L.formation).label), "Química " + ch.v, props.match?.short ?? "", "Vamos Piti"].filter(Boolean);
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
      canMove: canEdit && !cb.preview && !tpv.on && (modo === "editar" || modo === "quimica"),
      canLine: canEdit && modo === "editar" && plan.dlOn,
      magnets: canEdit && modo === "editar" && !L.freeMode,
      draw: canEdit && modo === "dibujar",
      drawRo: ready && ro && modo === "dibujar",
      pieces,
      multi: ms.on && (!msFree || (!cb.preview && !tpv.on)),
      selecting: ms.selecting,
      group: ms.keys,
    },
    {
      onMultiTap: msTap,
      onGroup: (keys, d) => msMove(keys, (p) => frameShift(cam, p, d.dX, d.dY), d),
      // a bench cromo lifted off the phone strip (long press): the hand feels it
      onLift: () => buzz(12),
      // «+2 química aquí» over the spot the carried cromo would land on
      onTarget: (src, t) => tq.onTarget(src, t, frameRef.current),
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
        announce(k >= 0 ? nm(src.id) + " a " + slotCode(r.lineup, k) : nm(src.id) + " al banquillo");
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
    const next = suggestSeven(L, sq, own, calledOf(cm), (id, z, code) => (code ? famCodeCount(fam, id, code) : famCount(fam, id, z)));
    if (!next.slots.some((s) => s.playerId)) {
      say("No hay nadie disponible para el sobre");
      return;
    }
    commit(next, { ui: { sel: null, pick: null, kb: null }, fx: { spin: !rm } });
    buzz([10, 40, 10, 40, 10, 40, 60]);
    // (with exact positions the pack deals by encaje first, form only between equals)
    const best = sevenByEncajeOn(L, sq, own, calledOf(cm)) ? "los siete que mejor encajan, por forma" : "los siete en mejor forma";
    say(own.length && cm ? "Sobre abierto: el siete de la convocatoria de " + matchShort(cm) : "Sobre abierto: " + best + (sq.recentLabel ? " (" + sq.recentLabel + ")" : ""));
  };
  const doAuto = () => {
    if (!canEdit) return;
    const next = autoPlace(L, sq, called);
    const exact = autoByEncajeOn(L, sq, called);
    if (next.slots.every((s, i) => s.playerId === L.slots[i]?.playerId)) {
      say(next.slots.some((s) => s.playerId) ? (exact ? "Ya está cada cromo donde mejor encaja" : "Ya está cada cromo en su sitio") : "No hay nadie disponible para colocar");
      return;
    }
    commit(next, { ui: { sel: null, pick: null, kb: null } });
    buzz([10, 30, 10, 30, 10]);
    say((exact ? "Cada cromo donde mejor encaja" : "Cada cromo a su sitio natural") + " · bajas y «no voy» fuera");
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
      // (la charla presents the titular: its Plan B comes with the plan)
      vr.select("titular");
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
    // (and what it would do to the química por jugador: « · +1 química aquí»)
    const q = sel && !(sel.k === "p" && occ === sel.id) && isAvailable(sq, sel.id) ? tq.chemTxt(place(L, sel.id, k), sel.id) : "";
    return (occ && occ !== sel?.id ? "Sobre " + nm(occ) + ", " + slotCode(L, k) + ": Intro para cambiarlos" : "Hueco " + slotCode(L, k) + ": Intro para soltarlo") + q;
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
        return c ? selBarView(c, inHand.k === "p" && at >= 0 ? slotCode(L, at) : null, L.roles.captainId === inHand.id) : null;
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
    if (fan || fic || moverOn || e.defaultPrevented || e.altKey) return;
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
    // (Bloque 5 · P opens or closes the presentation, Esc closes it; its hidden panels' keys wait)
    const pk = presKey(e, pres.on, typing);
    if (pk) {
      e.preventDefault();
      if (pk === "toggle") pres.toggle();
      else if (pk === "exit") pres.exit();
      return;
    }
    if (modo === "charla" && e.key === "Escape") {
      e.preventDefault();
      goModo("editar");
      return;
    }
    if (typing) return;
    if (/^[1-9]$/.test(e.key)) {
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
      // Home / End: the first or the last step (the page never scrolls with them here)
      if (e.key === "Home" || e.key === "End") {
        e.preventDefault();
        const end = e.key === "End";
        if (modo === "charla") chl.seek(end ? chLast : 0);
        else jSeek(end ? Math.max(0, nJ - 1) : 0);
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
  const benchHand: BenchHand | null = !benchOn || !canEdit ? null : sel && selP >= 0 ? { kind: "p", name: nm(sel.id), zone: slotZone(L, selP), code: slotCode(L, selP) } : pick != null ? { kind: "slot", zone: slotZone(L, pick), code: slotCode(L, pick) } : null;
  const groups = benchOn
    ? benchGroups({
        bench: sq.list.filter((c) => !onPitch.has(c.id)),
        called,
        filter: { on: srx, q, zf, oc: ocOn, sin: sinF },
        hand: benchHand,
        selId: sel?.k === "b" ? sel.id : null,
        meId: props.meId,
      })
    : NO_GROUPS;
  // «Buscar en la plantilla» finds the ones on the pitch too: tapping one marks him there
  const found = pitchFound(L, sq, { on: srx, q, zf, oc: ocOn, sin: sinF }, (i) => slotCode(L, i));
  const onFound = (id: string) => {
    const i = L.slots.findIndex((s) => s.playerId === id);
    if (i < 0) return;
    cardEl(id)?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    buzz(8);
    if (canEdit) {
      patchUi({ sel: { k: "p", id }, pick: null, kb: null });
      announce(nm(id) + " está en el campo, de " + slotCode(L, i) + ": en la mano. Toca otro cromo o un hueco.");
    } else say(nm(id) + " está en el campo, de " + slotCode(L, i));
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
    else if (o.kind === "mover") {
      patchUi({ fan: null });
      setMover({ key: session.key, id: fan.id });
    } else {
      commit(o.lineup, { ui: { fan: null, pick: o.pick ?? null, sel: null } });
      if (o.toast) say(o.toast);
      if (o.pick != null) {
        setModo("editar");
        setTab("b");
        announce(nm(fan.id) + " al banquillo");
      }
    }
  };
  const ficha0 = fic ? fichaOf({ id: fic.id, L, sq, ch, match, ox: fic.ox, oy: fic.oy, side: fic.side }) : null;
  // (where he has lined up in the season's officials: the familiarity, on the ficha's back)
  const famL = fic && fam.games ? famLine(fam, fic.id, hasFitData([fic.id], sq, L)) : "";
  const ficha = ficha0 && fam.games ? { ...ficha0, facts: [...(ficha0.facts ?? []), { k: "En el oficial", v: famL || "Aún no ha salido en un oficial jugado" }] } : ficha0;

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
      const lm = calById(d.matchId);
      const rv = lm?.rival;
      return {
        id: d.id,
        name: on ? session.name : d.name,
        meta: boardMeta(Ld, sq, on ? session.savedAt : (d.updatedAt ?? d.createdAt), props.now),
        on,
        official: d.isOfficial,
        deletable: !d.isOfficial || props.isAdmin,
        ...(rv ? { rival: rv } : {}),
        // (Bloque 5: what the search, the tag filter and the sorts read)
        tags: (on ? vr.titular.tags : d.tags) ?? [],
        at: d.updatedAt ?? d.createdAt ?? 0,
        ...(lm ? { matchMs: lm.dateMs, matchTxt: matchShort(lm) } : {}),
      };
    });
  // The boards opened on this device («Recientes» in Tableros): this one, once it is stored.
  useEffect(() => {
    if (ready && session.id) noteOpened(props.seasonId, session.id);
  }, [ready, session.id, props.seasonId]);
  // «Capitán rotativo» (Tableros → Partido): only worked out while Tableros is open
  const capPick = modo === "tableros" ? nextCaptain(vr.titular, sq, armbands(session.officials, cal)) : null;
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
  // («Copiar el siete del último partido», in Tableros)
  const lastM = modo === "tableros" ? lastPlayed(cal) : null;

  // ── Comparar: another board (yours or the official) face to face ──
  const cmpDocs = (() => {
    const seen = new Set<string>();
    return [...session.mine, ...session.officials].filter((d) => d.id !== session.id && (seen.has(d.id) ? false : (seen.add(d.id), true)));
  })();
  // («El siete que jugó» of the linked match first, when its acta says who started)
  const played = playedOption(linked);
  // (the board's other versions of the seven first: Titular · 2ª parte · Plan B)
  const cmpOpts = [...variantCmpOptions(vr.titular, vr.active), ...(played ? [played] : []), ...cmpDocs.map((d) => ({ id: d.id, name: (d.isOfficial && !/^oficial/i.test(d.name) ? "Oficial · " : "") + d.name }))];
  const cmpId = cmpPick && cmpOpts.some((o) => o.id === cmpPick) ? cmpPick : (cmpOpts[0]?.id ?? null);
  const cmpDoc = cmpDocs.find((d) => d.id === cmpId) ?? null;
  const cmpVar = cmpVariantKey(cmpId);
  const LB =
    modo !== "comparar"
      ? null
      : cmpVar
        ? variantView(vr.titular, cmpVar, squadIds)
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
  // (with the strokes pinned to the players and, while «Rival» is on, the rival's tokens)
  const cartel = shareOn ? withCartelExtras(cartelLayout(L, sq, ch, match, props.seasonName), strokes, L, rivalOn) : null;
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
  // out of position as the cromo says it («!»: shownFit 0), printed as the cromo prints it (nat›code)
  const oopNames = L.slots
    .map((s, i) => {
      const c = s.playerId ? sq.byId.get(s.playerId) : undefined;
      if (!c || shownFit(L, sq, c.id, i) !== 0) return null;
      return c.name + " (" + (natTxtOf(L, sq, c.id) ?? "?") + "›" + slotCode(L, i) + ")";
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
  // Bloque 4 on the pitch: the pinned strokes, the rival's tokens (Plan, Dibujar), the players picked for a
  // tool, the handles that bend the paso's runs
  const rivalShown = !!L.rival && rivalOn && (modo === "dibujar" || (modo === "editar" && tab === "p"));
  const drawLayer = (
    <DrawLayer
      view={ink ? extraView(strokes, L, L.rival, C, modo === "dibujar" ? inkSel : null) : null}
      rival={rivalShown && L.rival ? rivalTokens(L.rival, C, L.slots.map((_, i) => { const q = slotPos(L, i); return { x: q.u, y: q.v }; })) : null}
      picked={
        modo === "dibujar" && canEdit
          ? pickable.map((id) => {
              const f = proj(C, places[id].x, places[id].y);
              return { id, x: f.x.toFixed(2), y: f.y.toFixed(2) };
            })
          : []
      }
      handles={pieces && modo === "jugadas" ? curveHandles(jplay, jf, C, (id) => sq.byId.has(id)) : null}
      handleAria={(h) => "Curva de la carrera de " + nm(h.id) + " al paso " + (jf + 1) + (h.bent ? ", curvada" : ", recta") + ". Arrástrala o usa las flechas para curvarla"}
    />
  );
  // «La jugada en vídeo» (Jugadas and Compartir): the jugada on screen, at the replay's speed
  const clipEl =
    modo === "jugadas" || modo === "compartir" ? (
      <ClipExport
        key={"clip:" + jplay.id}
        play={jplay}
        who={Object.fromEntries(participants(jplay).map((id) => [id, { num: sq.byId.get(id)?.num ?? 0, name: nm(id) }]))}
        head={match?.short ?? session.name}
        rate={rate}
        say={(m) => say(m)}
      />
    ) : null;
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
              : modo === "editar" && tab === "c" && !sel
                ? cb.live
                  ? "En directo, minuto " + cb.live.minute + ": el campo enseña el plan a esta hora."
                  : "Arrastra una tanda por la línea del partido; desliza el minuto para ver el campo en ese momento."
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
            ? OFFLINE_TXT
            : session.status === "error"
              ? "Sin guardar · revisa la conexión"
              : !online
                ? OFFLINE_TXT
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
    modo === "jugadas" && rate === 1.5 ? "dr-fast" : "",
    modo === "jugadas" && !trails ? "no-trails" : "",
    follow || !!chCamT ? "fcam" : "",
    live3d || live3dC ? "v3" : "",
    pieces ? "j-edit" : "",
    // Dibujar on an editable board: the pitch is a canvas
    canEdit && modo === "dibujar" ? "d-on" : "",
    // Bloque 5 · modo presentación: the chrome hidden, the pitch over the whole screen
    pres.on ? "b5p-pres" : "",
  ].filter(Boolean).join(" ");
  // ── Bloque 5 on screen: the rings under the fichas picked, their bar, the jugada's video, the voice, the
  // presentation's LED and controls ──
  const msRings: MultiRing[] = ms.keys.flatMap((k): MultiRing[] => {
    const xy = msFree ? drawnNow.p[k] : k === "b" ? jug?.drawn.b : k.startsWith("r:") ? jug?.drawn.r[k.slice(2)] : jug?.drawn.p[k.slice(2)];
    return xy ? [{ key: k, x: xy[0], y: xy[1] }] : [];
  });
  const msBar = ms.on ? (
    <MultiSelBar
      n={ms.keys.length}
      selecting={ms.selecting}
      onSelecting={() => {
        ms.setSelecting(!ms.selecting);
        announce(ms.selecting ? "Seleccionar, apagado" : "Seleccionar: toca las fichas que quieras mover juntas");
      }}
      onClear={() => {
        ms.clear();
        announce("Fichas soltadas");
      }}
    />
  ) : null;
  const jVideo = (v: PlayVideo | null): boolean => {
    const same = v ? jplay.video?.url === v.url.trim() && jplay.video?.at === v.at : !jplay.video;
    if (same) return true;
    if (!editJugada((p) => setPlayVideo(p, v), "", undefined, "video")) return false;
    buzz(8);
    say(v ? "Vídeo enlazado a la jugada (" + clockTxt(v.at) + ")" : "Vídeo quitado de la jugada");
    return true;
  };
  const presEl = pres.on ? (
    <PresentaBar
      led={presLed({ match: match?.short ?? null, board: session.name, sys: hud.sysName, qv: ch.v, free: !!L.freeMode })}
      modo={charlaOn ? "charla" : modo === "jugadas" ? "jugadas" : "otro"}
      jugada={modo === "jugadas" ? { txt: presJugadaTxt(jf, nJ, jplay.frames[jf]?.title ?? ""), playing: rpl.playing, onToggle: playToggle, onStep: jStep } : null}
      onCharla={() => goModo("charla")}
      onJugadas={() => goModo("jugadas")}
      onExit={pres.exit}
    />
  ) : null;
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
            sinF={sinF}
            onSin={() => setSinF(!sinF)}
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
            cands={encCands}
            now={boardInPlace(L, sq)}
            dm={tq.dm}
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
              say("Posiciones del sistema " + systemDef(L.formation).label);
            }}
          />
        )}
        {tab === "c" && cb.tab}
        {tab === "p" && <PlanTab rows={tac} ro={!canEdit} rep={rp.rows} repTxt={rp.txt} canRotate={!!rot} note={planNote(L)} top={tq.planTop(cal, linked, !canEdit)} after={tq.planAfter(cb.live, !canEdit)} onSet={onTactic} onRotate={doRotate} />}
        {tab === "p" && (
          <RivalPanel
            rival={L.rival}
            on={rivalOn}
            ro={!canEdit}
            matchRival={linked?.rival ?? null}
            onAdd={rivalAdd}
            onRemove={rivalRemove}
            onSystem={(f) => L.rival && setRival(setRivalSystem(L.rival, f), "Rival en " + f)}
            onNum={(i, v) => {
              const next = L.rival ? setRivalNum(L.rival, i, v) : null;
              if (next && next !== L.rival) setRival(next, "Dorsal guardado: " + rivalName(next, i).toLowerCase());
            }}
            onNote={(i, v) => {
              const next = L.rival ? setRivalNote(L.rival, i, v) : null;
              if (next && next !== L.rival) setRival(next, next.players[i].note ? "Nota guardada para " + rivalName(next, i).toLowerCase() : "Nota quitada");
            }}
            onToggle={() => {
              setRivalOn(!rivalOn);
              announce(rivalOn ? "Rival fuera del campo" : "Rival en el campo, en rojo");
            }}
          />
        )}
      </>
    ) : modo === "mas" ? (
      <MasPanel tacSum={tacSum} onGo={goModo} />
    ) : modo === "quimica" ? (
      <QuimicaPanel ch={ch} sq={sq} seasonName={props.seasonName} oop={oopNames} dm={tq.dm} />
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
        lastMatch={lastM ? matchShort(lastM) : null}
        onNewFromLast={() => {
          if (!lastM) return;
          const ms = matchShort(lastM);
          session
            .newBoard({ formation: L.formation, slots: sevenFromStarters(L.formation, lastM.conv?.starters ?? [], sq, L), name: "Como en " + ms })
            .then(() => say("Tablero nuevo con el siete de " + ms))
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
        rivalPick={rivalPick}
        onRivalPick={(r) => {
          setRivalPick(r);
          announce(r ? "Tableros contra " + r : "Todos los tableros");
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
        tags={vr.titular.tags ?? []}
        onTags={(tags) => {
          if (!canEdit) return;
          // (the tags are the board's, whatever version of the seven is on screen)
          props.session.commit({ ...vr.titular, tags });
          announce(tags.length ? "Etiquetas: " + tags.join(", ") : "Sin etiquetas");
        }}
        recent={recentIds(props.seasonId)}
        captain={
          capPick
            ? {
                name: capPick.id ? nm(capPick.id) : null,
                why: whyTxt(capPick, nm),
                rows: capPick.rows.map((r) => ({ id: r.id, name: nm(r.id), txt: rowTxt(r) })),
                already: capPick.already,
                canApply: canEdit,
                onApply: () => {
                  const cid = capPick.id;
                  if (!cid) return;
                  commit(applyCaptain(L, cid));
                  say("Brazalete para " + nm(cid) + ": capitán del próximo partido");
                },
              }
            : null
        }
      />
    ) : modo === "pachanga" ? (
      <PachangaPanel sq={sq} when={dayOf(props.now)} onBack={() => goModo("mas")} say={announce} />
    ) : modo === "comparar" ? (
      <CompararPanel
        options={cmpOpts}
        cmpId={cmpId}
        aName={session.name + (vr.active !== "titular" ? " · " + vr.name : "")}
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
      <CompartirPanel
        cartel={cartel}
        block={shareBlock}
        busy={shareBusy}
        ready={!!preparedFor(prepared, cartelKey)}
        canLink={!!session.id}
        onShare={() => void toGroup("share")}
        onPng={() => void toGroup("png")}
        onLink={(charla) => void copyLink(charla)}
        onBack={() => goModo("mas")}
        extra={
          <BoardShare
            link={session.id ? boardLink(typeof window === "undefined" ? "" : window.location.origin, session.id, false, props.seasonId) : null}
            name={session.name}
            readOnly={ro}
            canClone={ready && !!session.id}
            onClone={() => {
              session
                .copyBoard(null, true)
                .then((v) => say("Clonado: «" + v + "» es tuyo para editar"))
                .catch(tbFail);
            }}
            clip={clipEl}
            clipName={jplay.name}
            print={
              <PrintPlan
                view={() =>
                  printView(L, sq, {
                    name: session.name + (vr.active !== "titular" ? " · " + vr.name : ""),
                    match: match ? [match.short, match.date, match.time, match.place].filter(Boolean).join(" · ") : "",
                    called: match?.called ? new Set(match.called) : null,
                  })
                }
                onFail={say}
              />
            }
          />
        }
      />
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
        rate={rate}
        onion={onion}
        trails={trails}
        riv={rivOn}
        ball={ballOn}
        lib={jl.map((j) => ({ id: j.play.id, short: j.short, aria: j.play.name + (j.own ? " (propia)" : " (estrategia)"), on: j.play.id === jplay.id }))}
        canEdit={canEdit}
        note3d={note3d}
        clip={clipEl}
        video={<JugadaVideo key={"video:" + jplay.id} video={jplay.video ?? null} canEdit={canEdit} onSave={jVideo} />}
        editor={jugadaEditor()}
        onToggle={playToggle}
        onStep={jStep}
        onSeek={jSeek}
        on3d={toggle3d}
        onRate={(r) => {
          setRate(r === 0.5 || r === 1.5 ? r : 1);
          announce("Repetición a " + rateLabel(r));
        }}
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
        strokes={strokes.map((x) => ({ id: x.id, label: inkLabel(x), sel: x.id === inkSel }))}
        selLabel={inkSel ? inkLabel(strokes.find((x) => x.id === inkSel) ?? strokes[0]) : null}
        canUndo={canEdit && (u.ink.past.length > 0 || strokes.length > 0)}
        onTool={(k) => {
          setTool(k);
          setPicked([]);
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
        extra={
          <DrawToolsBar
            tool={tool}
            onTool={(k) => {
              setTool(k);
              setPicked([]);
              buzz(6);
            }}
            players={L.slots.flatMap((x) => {
              const c = x.playerId ? sq.byId.get(x.playerId) : undefined;
              return c ? [{ id: c.id, name: c.name, num: c.num }] : [];
            })}
            picked={pickable}
            onPick={pickPlayer}
            onUnir={doUnir}
            fuera={{ nos: !!fueraOf(strokes, "nos"), rival: !!fueraOf(strokes, "rival"), canRival: !!L.rival }}
            onFuera={toggleFuera}
            rival={{ has: !!L.rival, on: rivalOn }}
            onRival={() => {
              setRivalOn(!rivalOn);
              announce(rivalOn ? "Rival fuera del campo" : "Rival en el campo, en rojo");
            }}
            canConvert={canEdit && drawingToPlay(strokes, L, "x") !== null}
            onConvert={toJugada}
          />
        }
      />
    ) : cv ? (
      <CharlaGuion v={cv} title={match?.short ?? session.name} note3d={chNote3d} />
    ) : null;

  // ── the chrome: the camera's geometry for the layout, the rail's match card, the prompt bar ──
  const geo = camGeo(cam);
  const saveCls = ro ? "ro" : session.status;
  // ── the versions of the seven (pills over the pitch) ──
  const variantPills =
    modo === "charla" ? null : (
      <VariantPills
        // (the «+» to make one only while editing the siete)
        pills={modo === "editar" ? vr.pills : vr.pills.filter((x) => !x.add)}
        active={vr.active}
        activeName={vr.name}
        canEdit={canEdit}
        onPick={(k) => {
          if (k === vr.active) return;
          vr.select(k);
          patchUi({ sel: null, pick: null, kb: null, fan: null });
          if (!rm) runFx(morph(null));
          buzz(8);
          announce("En el campo: " + (k === "titular" ? "el siete titular" : "la versión «" + (vr.pills.find((x) => x.key === k)?.label ?? "") + "»"));
        }}
        onAdd={(id) => {
          if (!canEdit) {
            say(roMsg);
            return;
          }
          if (!vr.add(id)) return;
          buzz(10);
          say("Versión «" + (vr.pills.find((x) => x.key === id)?.label ?? "") + "» creada: una copia del titular para cambiarla");
        }}
        onRename={(id, raw) => {
          const err = variantNameError(vr.titular, id, raw);
          if (err) return err;
          vr.rename(id, raw);
          announce("Versión renombrada: «" + raw.trim().replace(/\s+/g, " ") + "»");
          return null;
        }}
        onRemove={(id) => {
          const was = vr.remove(id);
          if (!was) return;
          const nmV = vr.name;
          buzz(10);
          say("Versión «" + nmV + "» quitada", { label: "Deshacer", aria: "Deshacer: recuperar la versión «" + nmV + "»", run: () => vr.restore(was) });
        }}
      />
    );
  const cvMatch = props.conv.match;
  const cvN = conv;
  const matchCard: MatchCard | null = match
    ? {
        kick: cvMatch && props.nextMatch && cvMatch.id !== props.nextMatch.id ? "Partido del tablero" : "Próximo partido",
        title: match.short,
        when: [match.date, match.time].filter(Boolean).join(" · "),
        counts: cvMatch && !props.conv.loading && !props.conv.error && cvN.voy + cvN.duda + cvN.no > 0 ? { voy: cvN.voy, duda: cvN.duda, no: cvN.no, sin: cvN.sin } : null,
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
      onKeyDownCapture={msKeyCapture}
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
          selbar={
            <>
              {phone ? null : selBarEl}
              {msBar}
            </>
          }
          trailsDraw={!!fx.from && !rm}
          trailsDur={trailsDurOf(rate)}
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
          extras={
            <>
              {drawLayer}
              <MultiSelLayer rings={msRings} />
            </>
          }
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
          extra={
            <button type="button" className="b3 b5p-pres-b" onClick={pres.enter} aria-label="Presentar: el campo a toda pantalla (P)">
              <Icon n="eye" w={16} />
              <span>Presentar</span>
            </button>
          }
        />
        {ro && ready && <ReadOnlyStrip label={session.official ? "OFICIAL · SOLO LECTURA" : "SOLO LECTURA · @" + session.owner.toUpperCase()} onDuplicate={session.duplicate} onMine={session.openMine} />}
        {/* (not live: it changes with every paso of a replay; what matters is announced on its own) */}
        <p className="hint">
          <i aria-hidden="true" />
          <span key={hint}>{hint}</span>
        </p>
        <Sheet title={SHEET_TITLE[modo]} snap={snap} mk={mk} sheetRef={sheetRef} onCycle={cycleSnap} onStep={stepSnap}>
          {/* «El oficial ha cambiado» and the versions of the seven head the panel: over the pitch they covered
              the LED board and the far cromos */}
          {ready && modo !== "charla" && ofb.msg && <OficialBanner msg={ofb.msg} onView={offOther ? () => { ofb.dismiss(); session.open(offOther); } : null} onOk={ofb.dismiss} />}
          {ready && modo === "editar" && variantPills}
          {shown}
        </Sheet>
        <ModeBar modo={modo} onGo={goModo} card={matchCard} />
        <PromptBar ctx={pmCtx} acts={pmActs} saveTxt={saveTxt} saveCls={saveCls} extra={[{ k: "P", t: "Presentar", go: pres.enter }]} />
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
            voz={<VozPanel v={voz} />}
          />
        )}
        {presEl}
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
            title={nm(fan.id) + " · " + slotCode(L, L.slots.findIndex((s) => s.playerId === fan.id))}
            items={fanList}
            onItem={onFanItem}
            onClose={() => patchUi({ fan: null })}
          />
        )}
        {moverOn && (
          <MoverA
            name={nm(moverOn)}
            num={sq.byId.get(moverOn)?.num ?? 0}
            options={moveOptions(L, sq, moverOn, fam)}
            onPick={(i) => {
              setMover(null);
              placeAt(i, moverOn);
            }}
            onClose={() => setMover(null)}
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
        {tq.dropBadge(canEdit && modo === "editar" && dragKind === "tok", prefs.grid, cam)}
      </section>
      {props.footer}
    </div>
  );
}
