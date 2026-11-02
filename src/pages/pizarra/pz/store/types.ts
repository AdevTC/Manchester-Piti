// r14 «La pizarra»: the store's shapes (the React port of the prototype's PI-store.js, STORE-API.md and
// CAMPO-API.md). Names follow the prototype so a place ports its logic almost as is; the data behind them is the
// app's real data (src/pages/pizarra/*.ts, v2/*): a board keeps the app's typed `Lineup`, read through `ver()`.
import type { ReactNode } from "react";
import type { FormationName, Lineup, SlotState } from "../../formations";
import type { Tactics } from "../../tactics";
import type { Line, PosCode } from "../../../../lib/positions";
import type { CalMatch } from "../../v2/boards";

export type PlaceId = "siete" | "plan" | "jugadas" | "partido" | "tableros" | "pachanga" | "charla";
export type Layout = "desktop" | "tablet" | "phone";
/** Where a place's component is mounted (SHELL-API § Mount points). */
export type Region = "lead" | "side" | "peek" | "panel" | "sheet" | "stage" | "full" | "dock";
export type Camera = "pizarra" | "grada" | "foco";
export type LayerId = "nada" | "media" | "nota" | "quimica" | "forma" | "minutos";
export type VersionId = "titular" | "segunda" | "planb";
export type SheetHeight = "peek" | "half" | "full";
/** The data's state: read, being read, could not be read, or read but the device is offline. */
export type Estado = "normal" | "cargando" | "error" | "offline";
export type Tone = "ok" | "warn" | "bad" | "mute" | "guest";

/** /pizarra/<place>[/<sub>]?<q>: the place shown, its sub-screen and the address' parameters (strings). */
export interface PzRoute {
  place: PlaceId | "perdido";
  sub: string;
  q: Record<string, string>;
}

// ── the people ───────────────────────────────────────────────────────────────────────────────────────────
/** A player as the pizarra reads him (a squad member, or a guest brought for a match). */
export interface PzPlayer {
  id: string;
  /** The shirt name of this season (seasonDetails), as printed. */
  shirt: string;
  num: number | null;
  first: string;
  last: string;
  line: Line | null;
  main: PosCode | null;
  also: PosCode[];
  /** GLOBAL 0–99 (the same number as Tú's La carta and the cromo); null before his first nota. */
  global: number | null;
  /** FOR (his last five). */
  forma: number | null;
  provisional: boolean;
  /** Bronce · Plata · Oro (Tú's tiers) or «Invitado». */
  type: string;
  pj: number;
  starts: number;
  min: number;
  goals: number;
  assists: number;
  mvp: number;
  /** His notas this season, oldest first. */
  notas: { j: number | null; matchId: string; rival: string; n: number; min: number }[];
  /** Minutes per F7 puesto this season ('?' = minutes without a known puesto). */
  playedAt: Record<string, number>;
  /** Not available for any match: «Lesionado» · «Sancionado» · «Inactivo». */
  baja?: string;
  guest?: boolean;
  note?: string;
  /** Who brought a guest. */
  by?: string;
}

export interface PzMe {
  uid: string;
  name: string;
  nick: string;
  label: string;
  pid: string | null;
  /** A captain (admin role): edits any board, publishes the official. */
  cap: boolean;
  general: boolean;
  /** A member without a ficha (reads only). */
  socia: boolean;
  jugador: boolean;
  fuera: boolean;
  member: boolean;
}

export type RsvpV = "yes" | "maybe" | "no" | "none" | "ausente" | "baja" | "guest";
export interface PzRsvp {
  v: RsvpV;
  t: string;
  icon: string;
  tone: Tone;
  why: string;
  until?: string;
  at?: number | null;
  /** He can be placed (not a «No va», not out). */
  can: boolean;
}

// ── the matches and the boards ───────────────────────────────────────────────────────────────────────────
export interface PzMatch {
  id: string;
  j: number | null;
  rival: string;
  home: boolean | null;
  /** Kick-off (ms, Madrid wall clock as stored). */
  at: number;
  played: boolean;
  gf: number | null;
  ga: number | null;
  venue: string;
  /** The live phase la mesa says: before · on · half-time · finished. */
  phase: "antes" | "juego" | "descanso" | "jugado";
  /** The calendar row the rest of the app reads (convocatoria, clock, events, status…). */
  cal: CalMatch;
}

export interface PzBoard {
  id: string;
  name: string;
  ownerUid: string;
  ownerNick: string;
  matchId: string | null;
  isOfficial: boolean;
  /** The unsaved board on screen before its first change (the session's draft). */
  draft: boolean;
  createdAt: number;
  updatedAt: number;
  /** The app's lineup (the session's unsaved edits included for the board on screen). */
  lineup: Lineup;
}

/** A slot as the prototype reads it. */
export interface PzSlot {
  code: PosCode;
  x: number;
  y: number;
  playerId: string | null;
}
/** One version of a board's seven (Titular · 2ª parte · Plan B). */
export interface PzVer {
  id: VersionId;
  t: string;
  /** The variant exists (a missing one falls back to the titular's seven). */
  exists: boolean;
  formation: FormationName;
  freeMode: boolean;
  slots: PzSlot[];
  tactics: Tactics;
}

export interface PzStatus {
  n: number;
  total: number;
  full: boolean;
  gk: boolean;
  missing: PosCode[];
  warns: { pid: string; t: string }[];
}
export interface PzLink {
  i: number;
  j: number;
  a: string;
  b: string;
  t: 1 | 2 | 3;
  word: string;
  why: string;
  tog: number;
}
export interface PzGalon {
  k: "C" | "V" | "P" | "F" | "E";
  t: string;
  aria: string;
}

// ── the world the store reads (rebuilt from the app's data on every change) ─────────────────────────────
export interface PzWorld {
  /** The clock (ms). */
  now: number;
  season: { id: string; name: string };
  squad: PzPlayer[];
  guests: PzPlayer[];
  matches: PzMatch[];
  /** The next match's id (or null). */
  next: string | null;
  boards: PzBoard[];
  /** The official of the board's match / the season (null = none). */
  official: { boardId: string; matchId: string | null } | null;
  /** The answers of the board's match («Voy», «Duda», «No va»), by player id (`why`: an answer written by an
   *  absence says so). */
  rsvp: Record<string, { v: "yes" | "maybe" | "no"; why?: string; at?: number }>;
  /** The team's absences still to come or under way («no puedo del 12 al 19»), by player (YYYY-MM-DD, Madrid). */
  absences: { pid: string; from: string; to: string; note: string }[];
  /** Minutes two players were on the pitch together this season (pairKey a|b). */
  together: (a: string, b: string) => number;
  /** Matches the team has finished this season. */
  games: number;
}

// ── the stage (CAMPO-API) ────────────────────────────────────────────────────────────────────────────────
export type StageSource = "siete" | "ahora" | "jugada" | "pachanga" | "comparar" | "tokens" | "none";
export type PathKind = "pase" | "carrera" | "conduccion" | "flecha" | "lapiz" | "zona";
export type PathColor = "blanco" | "celeste" | "amarillo" | "coral";
export interface OverlayHandle {
  axis: "y";
  min: number;
  max: number;
  step?: number;
  label: string;
  onMove: (y: number) => void;
  onEnd?: () => void;
}
export interface OverlayPath {
  kind: PathKind;
  pts?: [number, number][];
  /** A ready SVG path in pitch units (instead of pts). */
  d?: string;
  color?: PathColor;
  label?: string;
  handle?: OverlayHandle;
}
export interface Overlay {
  paths: OverlayPath[];
}
export interface StageLabel {
  x: number;
  y: number;
  t: string;
  align?: "left" | "center" | "right";
  pat?: "rayas" | "malla" | "liso";
}
export type TokenKind = "us" | "rival" | "petos" | "sinpetos" | "ghost";
export interface Token {
  /** Stable: a token keeps its id to glide. */
  id: string;
  kind: TokenKind;
  pid?: string;
  x: number;
  y: number;
  label?: string;
  num?: number | string;
  code?: string;
  note?: string;
  ring?: "entra" | "sale" | "mueve";
  tag?: string;
  bib?: string;
  pat?: "rayas" | "malla" | "liso";
  on?: boolean;
}
export interface Mark {
  k: "amarilla" | "tocado" | "gol" | "roja";
  t: string;
  short?: string;
}
/** What a place asks the pitch to show (act.setStage merges it; it resets to the place's defaults on a route change). */
export interface StageSpec {
  source?: StageSource;
  camera?: Camera;
  focus?: { pid?: string; x?: number; y?: number; dx?: number } | null;
  zoom?: { x: number; y: number; s: number } | null;
  layer?: LayerId;
  rival?: boolean;
  drawings?: boolean;
  editable?: boolean;
  overlay?: Overlay | null;
  marks?: Record<string, Mark[]> | null;
  ball?: { x: number; y: number } | null;
  caption?: string;
  glideMs?: number;
  chrome?: boolean;
  plates?: "" | "short";
  labels?: StageLabel[];
  tappable?: boolean;
  rivalName?: string;
  rivalCode?: string;
  gradaPad?: number;
  // per source
  boardId?: string;
  version?: VersionId;
  slots?: PzSlot[];
  next?: { min: number; out: string; in: string } | null;
  entra?: boolean;
  playId?: string;
  play?: PzPlay;
  step?: number;
  ghost?: boolean | { x: number; y: number }[];
  rate?: number;
  teams?: string[][];
  names?: string[];
  pats?: ("rayas" | "malla" | "liso")[];
  a?: { boardId?: string; version?: VersionId };
  b?: { boardId?: string; version?: VersionId };
  tokens?: Token[];
}
/** A play as the `jugada` source reads it (the app's Play converted by the Jugadas place, or the library's). */
export interface PzPlay {
  id: string;
  name: string;
  steps: { title: string; note?: string; p: [number, number][]; r?: [number, number][]; b?: [number, number]; dur?: number }[];
}

/** A slot as the pitch draws it (resolved: player, rsvp, fit, galones, the hand, the drag). */
export interface ViewSlot {
  i: number;
  code: PosCode;
  x: number;
  y: number;
  pid: string | null;
  empty: boolean;
  p: PzPlayer | null;
  galones: PzGalon[];
  fit: number | null;
  fitT: string;
  r: PzRsvp | null;
  me: boolean;
  /** «En la mano». */
  sel: boolean;
  /** The empty slot whose Candidatos are open. */
  picked: boolean;
  /** The drag is over it. */
  over: boolean;
  /** A drag is on (every slot is a target). */
  drop: boolean;
  /** He can't play (No va, baja, ausente). */
  out: boolean;
  marks?: Mark[];
  ring?: "entra" | "sale" | "mueve" | "";
  ringT?: string;
}
/** What PiCampo renders: `P.sel.view(spec)`. */
export interface PzView {
  source: StageSource;
  boardId: string | null;
  formation: FormationName | "";
  free: boolean;
  slots: ViewSlot[];
  tokens: Token[];
  links: { a: ViewSlot; b: ViewSlot; t: 1 | 2 | 3; word: string; why: string }[];
  overlay: Overlay | null;
  ghost: { x: number; y: number }[];
  ball: { x: number; y: number } | null;
  labels: StageLabel[];
  caption: string;
  rivalName: string;
  camera: Camera;
  focus: StageSpec["focus"];
  zoom: StageSpec["zoom"];
  plates: "" | "short";
  layer: LayerId;
  editable: boolean;
  glideMs: number;
  marksExtra: Record<string, Mark[]> | null;
  chrome: boolean;
  tappable: boolean;
  gradaPad: number;
  /** Changes when the seven becomes complete (the light sweeps once). */
  flash: number;
  none?: boolean;
  diff?: PzDiff | null;
}
export interface PzDiff {
  ins: string[];
  outs: string[];
  moved: string[];
  sistema: boolean;
  same: boolean;
  text: string;
}

// ── the shell's registry (a place's live sublabel, primary action, badge; its sheets) ──────────────────
export interface PrimaryAction {
  label: string;
  /** Used on a 1440 board bar when `label` is longer than 16 characters. */
  short?: string;
  icon?: string;
  run: () => void;
  disabled?: boolean;
}
export interface PlaceBadge {
  t: string;
  word?: string;
  live?: boolean;
}
export interface RegionProps {
  region: Region;
  layout: Layout;
}
export interface SheetProps {
  layout: Layout;
  args: Record<string, unknown>;
}
/** A sheet's frame texts: strings or functions of its args. */
export type SheetText = string | ((args: Record<string, unknown>) => string);

export interface Toast {
  id: number;
  text: string;
  undo: (() => void) | null;
  long: boolean;
  action: { t: string; run: () => void } | null;
  icon: string;
}
export interface DragState {
  pid: string;
  from: "campo" | "banquillo";
  slot: number | null;
  x: number;
  y: number;
  label: string;
}
export interface SheetState {
  name: string;
  args: Record<string, unknown>;
  title: string;
  kicker: string;
}
export interface Sel {
  pid: string;
  from: "campo" | "banquillo";
  slot: number | null;
}
export interface HistEntry {
  label: string;
  undo: () => void;
  redo: () => void;
}

/** The store's state (read-only outside actions). */
export interface PzState {
  W: PzWorld;
  me: PzMe;
  estado: Estado;
  /** Why the data couldn't be read (shown in the error state). */
  error: string;
  layout: Layout;
  route: PzRoute;
  boardId: string;
  version: VersionId;
  sel: Sel | null;
  slotPick: number | null;
  layer: LayerId;
  stage: StageSpec;
  drawing: boolean;
  sheet: SheetState | null;
  sheetH: SheetHeight;
  primary: PrimaryAction | null;
  toast: Toast | null;
  /** The aria-live text. */
  say: string;
  drag: DragState | null;
  over: string | null;
  flash: number;
  hist: { undo: HistEntry[]; redo: HistEntry[] };
  slices: Record<string, unknown>;
  bench: { line: string; van: boolean; q: string };
  /** The board's last save (ms) or null. */
  saved: number | null;
  saveStatus: "draft" | "saving" | "saved" | "error" | "offline";
  fichaPid: string | null;
}

export type { CalMatch, FormationName, Lineup, SlotState, Tactics, ReactNode };
