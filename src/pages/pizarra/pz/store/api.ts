// r14 «La pizarra»: the store's public API (the prototype's window.PZ, STORE-API.md), as a type. A place reads it with
// `const P = usePz()` (store/context) and re-renders on every change: read with P.sel.*, change with P.act.*.
import type {
  Camera,
  DragState,
  Estado,
  LayerId,
  Layout,
  PlaceBadge,
  PlaceId,
  PrimaryAction,
  PzBoard,
  PzDiff,
  PzGalon,
  PzLink,
  PzMatch,
  PzMe,
  PzPlayer,
  PzRoute,
  PzRsvp,
  PzState,
  PzStatus,
  PzVer,
  PzView,
  PzWorld,
  SheetHeight,
  StageSpec,
  VersionId,
} from "./types";
import type { PosCode } from "../../../../lib/positions";
import type { FormationName, Lineup } from "../../formations";
import type { PizarraPrefs } from "../../data/prefs";

export interface ShirtStill {
  /** The printed still (his name and dorsal printed by the 3D scene) or the kit's blank still; undefined while it
   *  renders (draw the fallback shirt). */
  src: string | undefined;
  printed: boolean;
  num: string;
  name: string;
  kit: "home" | "away";
}

export interface ToastOptions {
  /** `true` = undo the last history entry; a function = run it once. */
  undo?: boolean | (() => void) | null;
  long?: boolean;
  action?: { t: string; run: () => void } | null;
  icon?: string;
  ms?: number;
  /** false: no aria-live announcement (the caller says something else). */
  say?: boolean;
}

export interface Candidate {
  pid: string;
  g: number | null;
  fitT: string;
  on: boolean;
  can: boolean;
  r: PzRsvp;
  score: number;
  why: string;
}
export interface StartSource {
  id: "ultimo" | "rival" | "oficial";
  t: string;
  s: string;
  can: boolean;
  formation: FormationName | null;
  slots: { code: PosCode; x: number; y: number; playerId: string | null }[] | null;
}
export interface PublishCheck {
  block: string;
  warns: { pid: string; t: string }[];
  st: PzStatus;
  M: PzMatch | null;
  started: boolean;
  versions: string[];
}

export interface PzSel {
  me(): PzMe;
  canEdit(b?: PzBoard | null): boolean;
  player(id: string | null | undefined): PzPlayer | null;
  name(id: string | null | undefined): string;
  posName(code: string): string;
  shirt(pid: string | null | undefined, o?: { away?: boolean }): ShirtStill;
  fit(pid: string, code: PosCode): number | null;
  fitWord(g: number | null): string;
  band(v: number | null): { t: string; tone: "top" | "good" | "ok" | "low" | "bad" | "mute" };
  notaWord(n: number | null): string;
  lastNota(pid: string): PzPlayer["notas"][number] | null;
  match(id?: string | null): PzMatch | null;
  rsvp(pid: string): PzRsvp;
  /** `members`: the members without a ficha who answered (they never take a slot). */
  counts(): { yes: number; maybe: number; no: number; none: number; baja: number; guests: number; members: { uid: string; who: string; v: "yes" | "maybe" | "no"; why?: string }[] };
  board(id?: string | null): PzBoard | null;
  boards(): PzBoard[];
  official(): PzBoard | null;
  ver(b?: PzBoard | null, v?: VersionId): PzVer | null;
  versions(b?: PzBoard | null): { id: VersionId; t: string; exists: boolean; cur: boolean }[];
  placed(v?: PzVer | null): string[];
  status(v?: PzVer | null): PzStatus;
  links(v?: PzVer | null): PzLink[];
  chem(v?: PzVer | null): { v: number; t: string; links: PzLink[]; nat: number };
  media(v?: PzVer | null): number | null;
  diff(a: PzVer | null, b: PzVer | null): PzDiff | null;
  candidates(slot: number, v?: PzVer | null): Candidate[];
  suggestion(v?: PzVer | null): (string | null)[];
  sources(): StartSource[];
  galones(pid: string, b?: PzBoard | null, v?: PzVer | null): PzGalon[];
  taker(b: PzBoard, v: PzVer, k: "penalties" | "freekicks" | "corners"): string | null;
  headline(): { t: string; s: string; tone: "ok" | "warn" | "calm" };
  placeSub(place: PlaceId): string;
  placeBadge(place: PlaceId): PlaceBadge | null;
  shareSheet(place?: PlaceId): string;
  primary(place?: PlaceId): PrimaryAction | null;
  view(spec?: StageSpec): PzView;
  stage(): StageSpec;
  /** Something would be lost by reloading now (an unsaved edit, an open sheet, a drawing, a drag, the charla, a 12 s
   *  undo window): the app's update waits (lib/updateHold). */
  busy(): boolean;
  /** The newest history entry (what the bar's Deshacer would undo). */
  histTop(): { id: number; scope: string; label: string } | null;
  canUndo(): boolean;
  canRedo(): boolean;
  undoLabel(): string;
  redoLabel(): string;
  saveLine(): { t: string; icon: string; tone: "ok" | "warn" | "bad" | "mute" };
  reactions(b?: PzBoard | null): { ok: number; dudas: number; mine: "ok" | "dudas" | null; who?: string[] };
  sheetMeta(): { title: string; kicker: string } | null;
  prefs(): PzPrefs;
  /** Selectors a place defined with `P.define(name, fn)`. */
  [defined: string]: unknown;
}

/** The pizarra's settings that follow you (data/prefs.ts: users/{uid}/private/pizarra, cached in localStorage). */
export type PzPrefs = PizarraPrefs;

export interface PzAct {
  // the seven (undoable, toast with «Deshacer», announce)
  place(pid: string, slot: number): void;
  swap(i: number, j: number): void;
  remove(slot: number): void;
  moveTo(pid: string, slot: number): void;
  setSistema(id: FormationName): void;
  cycleSistema(dir: 1 | -1): void;
  setFree(on: boolean): void;
  nudge(slot: number, x: number, y: number): void;
  setVersion(v: VersionId): void;
  removeVersion(v: VersionId): void;
  setRole(role: string, pid: string): void;
  setPlayAs(pid: string, code: PosCode | null): void;
  suggest(): void;
  startFrom(id: StartSource["id"]): void;
  clear(): void;
  /** Any other field of a board (rival, plan, plays, drawings, condPlan, subs, tags, seasonPlays…): written through
   *  the session (updateDoc), undoable (restores only those fields), toasted. The board on screen unless boardId. */
  saveBoard(patch: Partial<Lineup>, label: string, o?: { boardId?: string; toast?: boolean; long?: boolean; undoable?: boolean }): boolean;
  // taps
  tapSlot(i: number): void;
  tapBench(pid: string): void;
  release(): void;
  select(pid: string | null, from?: "campo" | "banquillo", slot?: number | null): void;
  dropOn(start: { pid: string; from: "campo" | "banquillo"; slot: number | null }, key: string): void;
  // the official
  publishCheck(): PublishCheck;
  publish(o?: { convocatoria?: boolean }): Promise<void>;
  react(v: "ok" | "dudas"): void;
  // boards
  openBoard(id: string): void;
  duplicate(id?: string): void;
  /** Deletes after 12 s (undoable); returns its history entry id. */
  deleteBoard(id: string): number | undefined;
  /** Undo one entry by id, wherever it is in the stack (a card's own «Deshacer»). */
  undoEntry(id: number): boolean;
  // history
  undo(): void;
  redo(): void;
  // UI
  setLayer(id: LayerId): void;
  setCamera(c: Camera, focus?: StageSpec["focus"]): void;
  toggleCamera(): void;
  setDrawing(on: boolean): void;
  setBench(patch: Partial<PzState["bench"]>): void;
  setSheetHeight(h: SheetHeight): void;
  openSheet(name: string, args?: Record<string, unknown>, o?: { title?: string; kicker?: string }): void;
  closeSheet(): void;
  openFicha(pid: string): void;
  setPrimary(p: PrimaryAction | null): void;
  setStage(spec: StageSpec, o?: { replace?: boolean }): void;
  go(url: string, o?: { replace?: boolean }): void;
  back(): void;
  forward(): void;
  dismissToast(): void;
  retry(): void;
  /** Change the pizarra's settings (they follow you to any device). */
  setPrefs(patch: Partial<PzPrefs>): void;
  /** Actions a place added with `P.action(name, fn)`. */
  [added: string]: unknown;
}

export interface PzSlice<T> {
  get(): T;
  set(patch: Partial<T> | ((s: T) => T), o?: { label?: string; undoable?: boolean; toast?: boolean; long?: boolean }): T;
  reset(): void;
}

export interface PzDrag {
  /** pointerdown on a shirt: mouse starts after 7 px, touch after a 400 ms hold (from the bench: a vertical move). */
  begin(e: { clientX: number; clientY: number; button: number; pointerType: string }, payload: { pid: string; from: "campo" | "banquillo"; slot: number | null }): void;
  cancel(): void;
  onGhost(fn: ((x: number, y: number) => void) | null): void;
  active(): boolean;
  state(): DragState | null;
}

export interface PzApi {
  readonly v: number;
  readonly state: PzState;
  sel: PzSel;
  act: PzAct;
  drag: PzDrag;
  /** Navigate inside the pizarra with a View Transition (only the content travels; the pitch stays). */
  nav(url: string): void;
  vt(fn: () => void): void;
  toast(text: string, o?: ToastOptions): void;
  say(text: string): void;
  on(evt: string, fn: (data: unknown) => void): () => void;
  emit(evt: string, data?: unknown): void;
  /** A namespaced, undoable piece of state (its init — a value or a function of the world — runs once per page). */
  slice<T>(name: string, init?: T | ((W: PzWorld, P: PzApi) => T)): PzSlice<T>;
  /** Anything undoable outside the seven and the slices. */
  /** Hold the app's update reload for `ms` (a place's own undo window; long toasts with undo already do). */
  holdFor(ms: number): void;
  /** Returns the entry's id (for P.act.undoEntry). */
  pushUndo(label: string, undo: () => void, redo: () => void, o?: { toast?: boolean; long?: boolean; scope?: string }): number;
  define(name: string, fn: (P: PzApi, ...args: unknown[]) => unknown): void;
  action(name: string, fn: (P: PzApi, ...args: unknown[]) => unknown): void;
  subscribe(fn: () => void): () => void;
  /** The quiet version: what only the toast shows changed (its own expiry). Read by usePzToast; nobody else
   *  re-renders for it. (Optional: a test's fake store has none.) */
  readonly tv?: number;
  subscribeQuiet?(fn: () => void): () => void;
  layout(): Layout;
  estado(): Estado;
  route(): PzRoute;
}
