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
let worker: Promise<Worker | null> | null = null;
let nextId = 1;
const pending = new Map<number, { ok: (b: Blob) => void; ko: (e: Error) => void }>();

function startWorker(): Promise<Worker | null> {
  if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    let w: Worker;
    try {
      w = new Worker(new URL("./stills.worker.ts", import.meta.url), { type: "module" });
    } catch {
      return resolve(null);
    }
    const give = (value: Worker | null) => {
      clearTimeout(timer);
      if (!value) w.terminate();
      resolve(value);
    };
    const timer = setTimeout(() => give(null), READY_TIMEOUT_MS);
    w.onerror = () => give(null);
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
  const w = await (worker ??= startWorker());
  if (!w) return onMainThread(req, type, scale);
  const id = nextId++;
  try {
    return await new Promise<Blob>((ok, ko) => {
      pending.set(id, { ok, ko });
      w.postMessage({ id, req, type, scale, dpr: devicePixelRatio } satisfies StillJob);
    });
  } catch {
    // The worker failed this one (e.g. lost its GPU context): stop using it, finish here.
    worker = Promise.resolve(null);
    w.terminate();
    return onMainThread(req, type, scale);
  }
}
