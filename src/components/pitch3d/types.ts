// Public types of the MPPitch engine. Pitch coordinates are percentages: x 0..100 across the pitch
// (left → right seen from our goal), y 0..100 from our goal line (0) to the rival goal line (100).

export type Theme = "dark" | "light";
export type Quality = "high" | "low";
export type CameraPreset = "tv" | "top" | "stands" | "low";
/** Galones: C capitán · P penaltis · F faltas · E esquinas (córners). */
export type Role = "C" | "P" | "F" | "E";
export type KitName = "home" | "away";

export interface PitchPoint {
  x: number;
  y: number;
}

export interface PlayerSpec extends PitchPoint {
  id: string;
  name: string;
  num: string | number;
  role?: Role;
  kit?: KitName;
  highlight?: boolean;
}

export interface RivalSpec extends PitchPoint {
  id: string;
}

export interface AssetUrls {
  glb: string;
  layout: string;
  kitHome: string;
  kitAway: string;
  normal: string;
  /** Club crest drawn on the chest (optional; a plain disc is printed without it). */
  crest?: string;
}

export interface MountOptions {
  theme: Theme;
  /** Where the kit comes from (default: the app's /models/ files and crest). */
  assets?: AssetUrls;
  players: PlayerSpec[];
  rivals?: RivalSpec[];
  ball?: PitchPoint | null;
  camera?: CameraPreset;
  quality?: Quality;
  /** Messages scrolling on the LED boards around the pitch. */
  board?: string[];
  /** Floating broadcast-style name plates under each shirt (default true). */
  labels?: boolean;
  /** Runtime problems after mount (WebGL context lost…). Load failures reject `mount` instead. */
  onError?: (error: Error) => void;
  /** Called once the first frame has been drawn. */
  onReady?: () => void;
  /** Testing aids. `maxDt`: largest physics step per frame in s (default 0.25; springs are sub-stepped). */
  debug?: { maxDt?: number };
  /** Abort a mount still loading (the promise rejects with an AbortError). */
  signal?: AbortSignal;
}

export type ArrowKind = "pase" | "carrera" | "conduccion";
export interface ArrowSpec {
  from: PitchPoint;
  to: PitchPoint;
  kind: ArrowKind;
}
export interface PlayFrame {
  players: { id: string; x: number; y: number }[];
  ball?: PitchPoint;
  arrows?: ArrowSpec[];
}
export interface PlayOptions {
  /** 1 = broadcast pace; 2 = twice as fast. */
  speed?: number;
  loop?: boolean;
  /** Called when the jugada reaches frame i (0 at start, frames.length - 1 at the end). */
  onFrame?: (i: number) => void;
  /** Resolves/ends: called when a non-looping jugada finishes. */
  onEnd?: () => void;
}
export interface PlayController {
  pause(): void;
  resume(): void;
  /** Jump to a point of the jugada, 0..1. */
  seek(t: number): void;
  /** End the jugada: players glide back to the board, arrows fade, camera returns. */
  stop(): void;
  /** Resolves when the jugada ends (stop() or the last frame of a non-looping play). */
  readonly done: Promise<void>;
}

export interface RevealOptions {
  onStep?: (i: number, player: PlayerSpec) => void;
  /** Time spent on each player, ms (default 2600). */
  stepMs?: number;
}

export type PickResult = { id: string } | PitchPoint | null;

export interface EngineInfo {
  /** Frames per second over the last second of rendering (0 until measured). */
  fps: number;
  /** Frames rendered since mount: if it does not grow, the page is not giving the engine frames. */
  frames: number;
  drawCalls: number;
  triangles: number;
  dpr: number;
  /** The running sequence, if any. */
  sequence: "intro" | "reveal" | "play" | null;
  /** The preset the camera rests on, or "flying" / "custom" (hero shots, follow cam). */
  camera: string;
  /** Current camera (world metres; debugging / tests). */
  view: { position: number[]; target: number[]; fov: number };
}

export interface Handle {
  setPlayers(players: PlayerSpec[], opts?: { animate?: boolean }): void;
  setRivals(rivals: RivalSpec[], opts?: { animate?: boolean }): void;
  setBall(ball: PitchPoint | null): void;
  setCamera(preset: CameraPreset, opts?: { duration?: number }): Promise<void>;
  setBoard(messages: string[]): void;
  /** ~3.4 s: floodlights power on one by one, crane flyover down to "tv", players rise onto the grass. */
  intro(): Promise<void>;
  /** Presentación / charla: visits each player, then pulls back to the whole seven. */
  reveal(order: string[], opts?: RevealOptions): Promise<void>;
  /** Animated jugada between frames. */
  play(frames: PlayFrame[], opts?: PlayOptions): PlayController;
  /** Player hit under the pointer, else the pitch point (null outside the playing area + run-off). */
  pick(clientX: number, clientY: number): PickResult;
  /** Screen position (px, relative to the mount element) of a player's shirt, for host overlays. */
  project(id: string): { x: number; y: number; visible: boolean } | null;
  setTheme(theme: Theme): void;
  setQuality(quality: Quality): void;
  pause(): void;
  resume(): void;
  info(): EngineInfo;
  dispose(): void;
}
