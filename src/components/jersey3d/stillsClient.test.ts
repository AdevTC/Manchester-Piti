import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StillJob, StillReply } from "./stillsClient";

// Where the stills render: a fake Worker stands in for stills.worker.ts (no WebGL here) and the main-thread
// renderer is a mock, so the tests see which one made each still and when a worker is started or let go.

const scene = vi.hoisted(() => ({ renderStill: vi.fn(async () => new Blob(["main"], { type: "image/webp" })) }));
vi.mock("./scene", () => scene);
// ONE_FALLBACK: Vitest hands the second of two concurrent dynamic imports of a mocked module the real one (which
// can't render here), so where two jobs fail over at once only the first is checked to resolve; the other to settle.

class FakeWorker {
  static all: FakeWorker[] = [];
  onmessage: ((e: MessageEvent<StillReply>) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  jobs: StillJob[] = [];
  terminated = false;
  constructor() {
    FakeWorker.all.push(this);
  }
  postMessage(job: StillJob) {
    this.jobs.push(job);
  }
  terminate() {
    this.terminated = true;
  }
  reply(m: StillReply) {
    this.onmessage?.({ data: m } as MessageEvent<StillReply>);
  }
  crash() {
    this.onerror?.(new Event("error"));
  }
}
const REQ = { kit: "home", theme: "dark", name: "ADRI", num: "10" } as const;
const tick = () => new Promise<void>((ok) => setTimeout(ok, 0));
/** The fresh module (its worker state starts empty). */
const client = () => import("./stillsClient");
/** The latest worker, once it says it is ready. */
async function ready() {
  await tick();
  const w = FakeWorker.all.at(-1);
  if (!w) throw new Error("no worker started");
  w.reply({ ready: true });
  await tick();
  return w;
}

beforeEach(() => {
  vi.resetModules();
  FakeWorker.all = [];
  scene.renderStill.mockClear();
  vi.stubGlobal("Worker", FakeWorker);
  vi.stubGlobal("OffscreenCanvas", class {});
  vi.stubGlobal("devicePixelRatio", 2);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("renderStillFast", () => {
  it("renders in the worker", async () => {
    const { renderStillFast } = await client();
    const p = renderStillFast(REQ);
    const w = await ready();
    expect(w.jobs).toHaveLength(1);
    const blob = new Blob(["worker"]);
    w.reply({ id: w.jobs[0].id, blob });
    expect(await p).toBe(blob);
    expect(scene.renderStill).not.toHaveBeenCalled();
  });

  it("a worker that dies after starting fails its jobs over to the main thread, and the next request starts a new one", async () => {
    const { renderStillFast } = await client();
    const a = renderStillFast(REQ);
    const b = renderStillFast({ ...REQ, num: "7" });
    const w = await ready();
    expect(w.jobs).toHaveLength(2);
    w.crash();
    // neither hangs: both go to the main thread (only the first is checked to resolve: see ONE_FALLBACK)
    await expect(a).resolves.toBeInstanceOf(Blob);
    await b.catch(() => undefined);
    expect(scene.renderStill).toHaveBeenCalledWith(REQ, "image/webp", 1);
    expect(w.terminated).toBe(true);
    const c = renderStillFast(REQ);
    const fresh = await ready();
    expect(fresh).not.toBe(w);
    fresh.reply({ id: fresh.jobs[0].id, blob: new Blob(["again"]) });
    await expect(c).resolves.toBeInstanceOf(Blob);
    expect(scene.renderStill).toHaveBeenCalledTimes(1);
  });

  it("stops starting workers that keep dying", async () => {
    const { renderStillFast } = await client();
    for (let i = 0; i < 2; i++) {
      const p = renderStillFast(REQ);
      (await ready()).crash();
      await p;
    }
    await renderStillFast(REQ);
    expect(FakeWorker.all).toHaveLength(2);
    expect(scene.renderStill).toHaveBeenCalledTimes(3);
  });

  it("a job the worker fails stops using it, and its other jobs do not hang", async () => {
    const { renderStillFast } = await client();
    const a = renderStillFast(REQ);
    const b = renderStillFast({ ...REQ, num: "7" });
    const w = await ready();
    w.reply({ id: w.jobs[0].id, error: "context lost" });
    await expect(a).resolves.toBeInstanceOf(Blob);
    await b.catch(() => undefined);
    expect(w.terminated).toBe(true);
    await expect(renderStillFast(REQ)).resolves.toBeInstanceOf(Blob);
    expect(FakeWorker.all).toHaveLength(1);
    expect(scene.renderStill).toHaveBeenCalledTimes(2);
  });

  it("lets an idle worker go and starts a new one on the next request", async () => {
    const { renderStillFast } = await client();
    const p = renderStillFast(REQ);
    const w = await ready();
    vi.useFakeTimers();
    w.reply({ id: w.jobs[0].id, blob: new Blob(["w"]) });
    await p;
    vi.advanceTimersByTime(19_000);
    expect(w.terminated).toBe(false);
    vi.advanceTimersByTime(2_000);
    expect(w.terminated).toBe(true);
    vi.useRealTimers();
    const q = renderStillFast(REQ);
    const fresh = await ready();
    expect(fresh).not.toBe(w);
    fresh.reply({ id: fresh.jobs[0].id, blob: new Blob(["w2"]) });
    await expect(q).resolves.toBeInstanceOf(Blob);
  });

  it("keeps the worker while a request is waiting", async () => {
    const { renderStillFast } = await client();
    const p = renderStillFast(REQ);
    const w = await ready();
    vi.useFakeTimers();
    vi.advanceTimersByTime(60_000);
    expect(w.terminated).toBe(false);
    w.reply({ id: w.jobs[0].id, blob: new Blob(["w"]) });
    await expect(p).resolves.toBeInstanceOf(Blob);
  });
});
