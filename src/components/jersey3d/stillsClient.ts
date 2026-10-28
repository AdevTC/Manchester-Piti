// Where the kit stills are rendered: in a Web Worker when the browser can run WebGL there, so the
// page stays responsive; otherwise on the main thread exactly as before (scene.renderStill).
import type { StillRequest } from "./scene";

export interface StillJob {
  id: number;
  req: StillRequest;
  type: "image/webp" | "image/png";
  scale: number;
  dpr: number;
}
export type StillReply = { ready: boolean } | { id: number; blob: Blob } | { id: number; error: string };

const READY_TIMEOUT_MS = 8000;
/** A worker with nothing to render goes after this long: it holds its own three.js, the kit and a GL context. */
const IDLE_MS = 20_000;
/** A worker that keeps dying (out of memory on a phone, say) is not started again: the main thread renders. */
const MAX_CRASHES = 2;
let worker: Promise<Worker | null> | null = null;
/** The worker that is up, once it said it is ready. */
let current: Worker | null = null;
let nextId = 1;
let busy = 0;
let crashes = 0;
let idle: ReturnType<typeof setTimeout> | undefined;
const pending = new Map<number, { ok: (b: Blob) => void; ko: (e: Error) => void }>();
/** The job's worker went away (crashed or stopped): the job finishes on the main thread. */
class WorkerGone extends Error {}

/** Stops the worker that is up; its jobs fail over to the main thread. `next` is what later requests use. */
function stop(next: Promise<Worker | null> | null) {
  clearTimeout(idle);
  current?.terminate();
  current = null;
  worker = next;
  for (const job of pending.values()) job.ko(new WorkerGone("stills worker gone"));
  pending.clear();
}

function startWorker(): Promise<Worker | null> {
  if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    let w: Worker;
    try {
      w = new Worker(new URL("./stills.worker.ts", import.meta.url), { type: "module" });
    } catch {
      return resolve(null);
    }
    let started = false;
    const give = (value: Worker | null) => {
      // (once: a "ready" that comes after the timeout gave up on this worker must not bring it back)
      if (started) return;
      clearTimeout(timer);
      started = true;
      if (value) current = value;
      else w.terminate();
      resolve(value);
    };
    const timer = setTimeout(() => give(null), READY_TIMEOUT_MS);
    w.onerror = () => {
      if (!started) return give(null);
      // It died after starting: fail its jobs (they finish on the main thread) and start a fresh one next time.
      if (w === current) stop(++crashes >= MAX_CRASHES ? Promise.resolve(null) : null);
    };
    w.onmessage = (e: MessageEvent<StillReply>) => {
      const m = e.data;
      if ("ready" in m) return give(m.ready ? w : null);
      const job = pending.get(m.id);
      if (!job) return;
      pending.delete(m.id);
      if ("blob" in m) job.ok(m.blob);
      else job.ko(new Error(m.error));
    };
  });
}

const onMainThread = async (req: StillRequest, type: StillJob["type"], scale: number) =>
  (await import("./scene")).renderStill(req, type, scale);

/** A still of the real kit; same contract as scene.renderStill, rendered off the main thread when possible. */
export async function renderStillFast(req: StillRequest, type: StillJob["type"] = "image/webp", scale = 1): Promise<Blob> {
  clearTimeout(idle);
  busy++;
  try {
    const w = await (worker ??= startWorker());
    // (no worker, or it went away between handing itself over and here)
    if (!w || w !== current) return await onMainThread(req, type, scale);
    const id = nextId++;
    try {
      return await new Promise<Blob>((ok, ko) => {
        pending.set(id, { ok, ko });
        w.postMessage({ id, req, type, scale, dpr: devicePixelRatio } satisfies StillJob);
      });
    } catch (error) {
      // The worker failed this one (e.g. lost its GPU context): stop using it, finish here.
      if (!(error instanceof WorkerGone) && w === current) stop(Promise.resolve(null));
      return await onMainThread(req, type, scale);
    }
  } finally {
    if (--busy === 0 && current) idle = setTimeout(() => stop(null), IDLE_MS);
  }
}
