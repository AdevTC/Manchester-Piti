// «Exportar la jugada como vídeo»: the 2D replay drawn frame by frame on a 1280 × 720 canvas (the pitch
// lying down, our goal on the left; the cromos as numbered discs, the rivals in red, the ball on its arc,
// the paso's title and note at the side) and recorded with MediaRecorder (MP4 where the browser records
// it, else WebM) for 6–12 s; then to the group with the share sheet, else downloaded. No 3D engine. The
// drawing, the recorder's states and the share fallback are pure enough to test with fakes.
import type { BoardPoint } from "../../../lib/schemas";
import { playPoseAt, type Play } from "../plays";
import { download, type ShareResult } from "./cartel";
import { rateFactor } from "./playPaths";

export const CLIP_W = 1280;
export const CLIP_H = 720;
export const CLIP_FPS = 30;
export const CLIP_MIN_MS = 6000;
export const CLIP_MAX_MS = 12000;
/** The first paso held before anything moves, and the last one held at the end (ms). */
export const CLIP_INTRO_MS = 700;
export const CLIP_OUTRO_MS = 1100;
/** One move at 1× (the replay's beat). */
const MOVE_MS = 2300;
/** The pitch in the frame (px): 60 × 40 m lying down. */
export const CLIP_PITCH = { x: 400, y: 90, w: 840, h: 560 } as const;
/** The text column left of the pitch: nothing written there reaches the grass. */
const COL_W = CLIP_PITCH.x - 40 - 28;

/** The clip's length (ms): every move at the replay's speed, plus the opening and the ending, kept to 6–12 s. */
export function clipLength(nPasos: number, rate = 1): number {
  const moves = Math.max(1, nPasos - 1);
  const raw = CLIP_INTRO_MS + moves * MOVE_MS * rateFactor(rate) + CLIP_OUTRO_MS;
  return Math.round(Math.max(CLIP_MIN_MS, Math.min(CLIP_MAX_MS, raw)));
}

/** Where the jugada is (0–1, as playPoseAt reads it) `ms` into a clip lasting `total`. */
export function clipT(ms: number, total: number): number {
  const body = total - CLIP_INTRO_MS - CLIP_OUTRO_MS;
  if (ms <= CLIP_INTRO_MS || body <= 0) return 0;
  if (ms >= total - CLIP_OUTRO_MS) return 1;
  return (ms - CLIP_INTRO_MS) / body;
}

/** A pitch point (x across, y 0 = their goal line) → the frame (px), our goal on the left. */
export function clipPoint(p: BoardPoint): [number, number] {
  return [CLIP_PITCH.x + ((100 - p.y) / 100) * CLIP_PITCH.w, CLIP_PITCH.y + (p.x / 100) * CLIP_PITCH.h];
}

/** The canvas calls a clip frame makes (a CanvasRenderingContext2D has them; tests record them). */
export interface ClipCtx {
  save(): void;
  restore(): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  strokeRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void;
  arc(x: number, y: number, r: number, a0: number, a1: number): void;
  fill(): void;
  stroke(): void;
  fillText(t: string, x: number, y: number, maxWidth?: number): void;
  setLineDash(d: number[]): void;
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  globalAlpha: number;
}

export interface ClipScene {
  play: Play;
  /** Our players by id: dorsal and name. */
  who: Record<string, { num: number; name: string }>;
  /** «J8 · MAD SKY», or the board's name. */
  head: string;
}

const NAVY = "#0c1733";
const GOLD = "#FFC659";
const SKY = "#9fd0f2";
const INK = "#eef4ff";
const RED = "#d8344a";
const DISPLAY = "'Anybody', 'Archivo', sans-serif";
const MONO = "'Geist Mono', ui-monospace, monospace";

/** A note cut into lines of at most `max` characters (at most `lines` of them). */
export function wrapText(t: string, max: number, lines: number): string[] {
  const out: string[] = [];
  let cur = "";
  t.split(/\s+/)
    .filter(Boolean)
    .forEach((w) => {
      const next = cur ? cur + " " + w : w;
      if (next.length > max && cur) {
        out.push(cur);
        cur = w;
      } else cur = next;
    });
  if (cur) out.push(cur);
  if (out.length > lines) {
    const kept = out.slice(0, lines);
    kept[lines - 1] = kept[lines - 1].slice(0, max - 1) + "…";
    return kept;
  }
  return out;
}

function pitch(ctx: ClipCtx) {
  const { x, y, w, h } = CLIP_PITCH;
  for (let k = 0; k < 12; k++) {
    ctx.fillStyle = k % 2 ? "#0e4e33" : "#12603f";
    ctx.fillRect(x + (w * k) / 12, y, w / 12 + 1, h);
  }
  ctx.strokeStyle = "rgba(238,246,255,.6)";
  ctx.lineWidth = 3;
  ctx.setLineDash([]);
  ctx.strokeRect(x, y, w, h);
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w / 2, y + h);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h / 2, h * 0.15, 0, Math.PI * 2);
  ctx.stroke();
  // the areas and the goals (12 × 24 m areas on a 60 × 40 m pitch)
  const aw = w * 0.15;
  const ah = h * 0.5;
  ctx.strokeRect(x, y + (h - ah) / 2, aw, ah);
  ctx.strokeRect(x + w - aw, y + (h - ah) / 2, aw, ah);
  ctx.lineWidth = 6;
  ctx.strokeStyle = INK;
  ctx.beginPath();
  ctx.moveTo(x - 6, y + h * 0.42);
  ctx.lineTo(x - 6, y + h * 0.58);
  ctx.moveTo(x + w + 6, y + h * 0.42);
  ctx.lineTo(x + w + 6, y + h * 0.58);
  ctx.stroke();
}

function disc(ctx: ClipCtx, at: [number, number], r: number, fill: string, ring: string) {
  ctx.beginPath();
  ctx.arc(at[0], at[1], r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = ring;
  ctx.stroke();
}

/** Draws the clip at `ms` of `total` (one video frame). Returns the paso it shows. */
export function drawClipFrame(ctx: ClipCtx, scene: ClipScene, ms: number, total: number): number {
  const { play } = scene;
  const n = play.frames.length;
  const pose = playPoseAt(play, clipT(ms, total));
  const paso = Math.max(0, Math.min(n - 1, pose.frame));
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, CLIP_W, CLIP_H);
  pitch(ctx);
  // the arrows of the move under way (they fade as it happens)
  const seg = play.frames[Math.max(0, Math.min(n - 2, Math.floor(clipT(ms, total) * (n - 1))))];
  if (seg && pose.u < 1) {
    ctx.globalAlpha = 0.85 - pose.u * 0.6;
    seg.arrows.forEach((a) => {
      const A = clipPoint(a.from);
      const B = clipPoint(a.to);
      ctx.setLineDash(a.kind === "carrera" ? [4, 10] : a.kind === "conduccion" ? [14, 8] : []);
      ctx.strokeStyle = a.kind === "pase" ? GOLD : SKY;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(A[0], A[1]);
      ctx.lineTo(B[0], B[1]);
      ctx.stroke();
    });
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }
  pose.rivals.forEach((r) => disc(ctx, clipPoint(r), 17, RED, "#ffffff"));
  Object.entries(pose.players).forEach(([id, p]) => {
    const at = clipPoint(p);
    const w = scene.who[id];
    disc(ctx, at, 22, SKY, NAVY);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = NAVY;
    ctx.font = `900 22px ${DISPLAY}`;
    ctx.fillText(w ? String(w.num) : "·", at[0], at[1] + 1);
    if (w) {
      ctx.fillStyle = INK;
      ctx.font = `800 15px ${DISPLAY}`;
      ctx.fillText(w.name.slice(0, 12), at[0], at[1] + 36);
    }
  });
  // the ball, lifted on a pase (its shadow stays on the grass)
  const b = clipPoint(pose.ball);
  const lift = pose.ball.h * 4;
  ctx.globalAlpha = 0.35;
  disc(ctx, [b[0], b[1] + 4], 9, "#000000", "rgba(0,0,0,0)");
  ctx.globalAlpha = 1;
  disc(ctx, [b[0], b[1] - lift], 10, "#ffffff", GOLD);
  // the side: what is being shown
  const f = play.frames[paso];
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = SKY;
  ctx.font = `600 20px ${MONO}`;
  ctx.fillText("REPETICIÓN · LA PIZARRA", 40, 116, COL_W);
  ctx.fillStyle = INK;
  ctx.font = `900 40px ${DISPLAY}`;
  wrapText(play.name.toUpperCase(), 13, 2).forEach((l, k) => ctx.fillText(l, 40, 170 + k * 44, COL_W));
  ctx.fillStyle = GOLD;
  ctx.font = `800 26px ${DISPLAY}`;
  ctx.fillText("PASO " + (paso + 1) + "/" + n, 40, 290, COL_W);
  ctx.fillStyle = INK;
  ctx.font = `800 24px ${DISPLAY}`;
  wrapText(f?.title || "Paso " + (paso + 1), 22, 2).forEach((l, k) => ctx.fillText(l, 40, 328 + k * 30, COL_W));
  if (f?.note) {
    ctx.fillStyle = "#c9d8ef";
    ctx.font = `600 19px ${MONO}`;
    wrapText(f.note, 28, 5).forEach((l, k) => ctx.fillText(l, 40, 400 + k * 26, COL_W));
  }
  ctx.fillStyle = "#c9d8ef";
  ctx.font = `600 18px ${MONO}`;
  ctx.fillText(scene.head.toUpperCase().slice(0, 30), 40, 640, COL_W);
  // the clip's progress, under the pitch
  ctx.fillStyle = "rgba(238,246,255,.18)";
  ctx.fillRect(CLIP_PITCH.x, 676, CLIP_PITCH.w, 6);
  ctx.fillStyle = GOLD;
  ctx.fillRect(CLIP_PITCH.x, 676, CLIP_PITCH.w * Math.max(0, Math.min(1, ms / total)), 6);
  ctx.restore();
  return paso;
}

// ───────────────────────────── recording ─────────────────────────────

/** What a MediaRecorder offers that the clip uses. */
export interface RecorderLike {
  state: string;
  start(timeslice?: number): void;
  stop(): void;
  ondataavailable: ((e: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
  onerror: ((e: unknown) => void) | null;
}
export type RecorderCtor = new (stream: MediaStream, opts?: { mimeType?: string; videoBitsPerSecond?: number }) => RecorderLike;
export interface CaptureCanvas {
  captureStream(fps?: number): MediaStream;
}
/** The clock the recording runs on (requestAnimationFrame in the browser; a fake one in tests). */
export interface Clock {
  now(): number;
  next(cb: () => void): number;
  cancel(id: number): void;
}

/** The formats tried, best first: MP4 where the browser records it (Safari), else WebM. */
export const CLIP_MIMES = ["video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"] as const;

export function pickMime(isSupported: (t: string) => boolean): string | null {
  for (const m of CLIP_MIMES) {
    try {
      if (isSupported(m)) return m;
    } catch {
      /* a browser that throws on a type does not record it */
    }
  }
  return null;
}
export const clipExt = (mime: string): "mp4" | "webm" => (mime.startsWith("video/mp4") ? "mp4" : "webm");

export const CLIP_NO_RECORDER = "Este navegador no puede grabar vídeo: prueba con Chrome, Edge, Firefox o un Safari reciente.";
export const CLIP_NO_FORMAT = "Este navegador no graba vídeo en MP4 ni en WebM: prueba con Chrome, Edge, Firefox o un Safari reciente.";

export type ClipSupport = { ok: true; mime: string; Recorder: RecorderCtor } | { ok: false; why: string };

/** Whether this browser can record the clip (feature detection: MediaRecorder, canvas capture, a format). */
export function clipSupport(env: { MediaRecorder?: unknown; canCapture?: boolean } = browserEnv()): ClipSupport {
  const R = env.MediaRecorder as (RecorderCtor & { isTypeSupported?: (t: string) => boolean }) | undefined;
  if (typeof R !== "function" || !env.canCapture) return { ok: false, why: CLIP_NO_RECORDER };
  const mime = pickMime((t) => (typeof R.isTypeSupported === "function" ? R.isTypeSupported(t) : false));
  return mime ? { ok: true, mime, Recorder: R } : { ok: false, why: CLIP_NO_FORMAT };
}
function browserEnv(): { MediaRecorder?: unknown; canCapture: boolean } {
  const g = globalThis as { MediaRecorder?: unknown; HTMLCanvasElement?: { prototype: object } };
  return { MediaRecorder: g.MediaRecorder, canCapture: !!g.HTMLCanvasElement && "captureStream" in g.HTMLCanvasElement.prototype };
}

export type ClipPhase = "idle" | "recording" | "stopping" | "done" | "error" | "cancelled";
export interface ClipJob {
  /** The video (rejects on an error, or with an AbortError when cancelled). */
  done: Promise<Blob>;
  cancel: () => void;
  phase: () => ClipPhase;
}

const abortError = (): Error => {
  const e = new Error("Grabación cancelada");
  e.name = "AbortError";
  return e;
};

/**
 * Records `ms` of the canvas: draws the first frame, starts the recorder, then draws a frame on every
 * tick of the clock (reporting the progress, 0–1) until the time is up, and stops. The chunks become
 * one Blob of the recorded type. Every step after an error, a stop or a cancel does nothing.
 */
export function recordClip(o: {
  canvas: CaptureCanvas;
  Recorder: RecorderCtor;
  mime: string;
  ms: number;
  draw: (ms: number) => void;
  clock: Clock;
  fps?: number;
  bitrate?: number;
  onProgress?: (p: number) => void;
}): ClipJob {
  let phase: ClipPhase = "idle";
  let tick = 0;
  const chunks: Blob[] = [];
  let resolve: (b: Blob) => void = () => undefined;
  let reject: (e: Error) => void = () => undefined;
  const done = new Promise<Blob>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  let stream: MediaStream | null = null;
  const stopTracks = () => stream?.getTracks().forEach((t) => t.stop());
  const end = (p: ClipPhase, err: Error) => {
    phase = p;
    o.clock.cancel(tick);
    stopTracks();
    reject(err);
  };
  let rec: RecorderLike;
  try {
    o.draw(0);
    stream = o.canvas.captureStream(o.fps ?? CLIP_FPS);
    rec = new o.Recorder(stream, { mimeType: o.mime, videoBitsPerSecond: o.bitrate ?? 4_000_000 });
  } catch (err) {
    end("error", err instanceof Error ? err : new Error("No se ha podido grabar el vídeo"));
    return { done, cancel: () => undefined, phase: () => phase };
  }
  rec.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  rec.onerror = () => {
    if (phase === "recording" || phase === "stopping") end("error", new Error("La grabación ha fallado"));
  };
  rec.onstop = () => {
    if (phase !== "stopping") return;
    stopTracks();
    if (!chunks.length) {
      phase = "error";
      reject(new Error("El vídeo ha salido vacío"));
      return;
    }
    phase = "done";
    o.onProgress?.(1);
    resolve(new Blob(chunks, { type: o.mime.split(";")[0] }));
  };
  const t0 = o.clock.now();
  phase = "recording";
  try {
    rec.start(250);
  } catch (err) {
    end("error", err instanceof Error ? err : new Error("No se ha podido grabar el vídeo"));
    return { done, cancel: () => undefined, phase: () => phase };
  }
  const step = () => {
    if (phase !== "recording") return;
    const el = o.clock.now() - t0;
    const at = Math.min(el, o.ms);
    o.draw(at);
    o.onProgress?.(at / o.ms);
    if (el >= o.ms) {
      phase = "stopping";
      rec.stop();
    } else tick = o.clock.next(step);
  };
  tick = o.clock.next(step);
  return {
    done,
    cancel: () => {
      if (phase !== "recording" && phase !== "stopping") return;
      const was = rec;
      end("cancelled", abortError());
      try {
        if (was.state !== "inactive") was.stop();
      } catch {
        /* already stopped */
      }
    },
    phase: () => phase,
  };
}

/** The browser's clock: one tick per animation frame (a timer where there is none). */
export const browserClock: Clock = {
  now: () => (typeof performance !== "undefined" ? performance.now() : Date.now()),
  next: (cb) => (typeof requestAnimationFrame === "function" ? requestAnimationFrame(cb) : window.setTimeout(cb, 1000 / CLIP_FPS)),
  cancel: (id) => {
    if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(id);
    window.clearTimeout(id);
  },
};

/** «pizarra-jugada-corner-a-favor.webm». */
export function clipFile(name: string, mime: string): string {
  const slug = name
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return "pizarra-jugada-" + (slug || "propia") + "." + clipExt(mime);
}

type ShareNav = { share?: (d: ShareData) => Promise<void>; canShare?: (d: ShareData) => boolean };

/** To the group: the share sheet with the video where it takes files, else a download. */
export async function shareClip(blob: Blob, filename: string, title: string, nav: ShareNav = navigator as ShareNav, save: (b: Blob, f: string) => void = download): Promise<ShareResult> {
  const file = typeof File === "function" ? new File([blob], filename, { type: blob.type || "video/webm" }) : null;
  if (file && nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
      /* the share sheet failed: the download instead */
    }
  }
  save(blob, filename);
  return "downloaded";
}
