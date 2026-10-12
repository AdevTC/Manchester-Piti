import { describe, expect, it, vi } from "vitest";
import { newPlay, type Play } from "../plays";
import {
  CLIP_INTRO_MS,
  CLIP_MAX_MS,
  CLIP_MIN_MS,
  CLIP_NO_FORMAT,
  CLIP_NO_RECORDER,
  CLIP_OUTRO_MS,
  CLIP_PITCH,
  clipExt,
  clipFile,
  clipLength,
  clipPoint,
  clipSupport,
  clipT,
  drawClipFrame,
  pickMime,
  recordClip,
  shareClip,
  wrapText,
  type ClipCtx,
  type Clock,
  type RecorderLike,
} from "./clip";

/** A canvas context that records every call and every style set. */
function recCtx(): { ctx: ClipCtx; calls: string[] } {
  const calls: string[] = [];
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (t, k: string) => (k in t ? t[k] : (...a: unknown[]) => calls.push(k + "(" + a.map((x) => (typeof x === "number" ? Math.round(x) : String(x))).join(",") + ")")),
    set: (t, k: string, v) => {
      t[k] = v;
      calls.push(k + "=" + String(v));
      return true;
    },
  }) as unknown as ClipCtx;
  return { ctx, calls };
}

function corner(): Play {
  const p = newPlay("Córner a favor", { adrian: { x: 50, y: 40 }, erik: { x: 30, y: 20 } }, { ball: { x: 100, y: 0 }, rivals: [{ id: "r1", x: 50, y: 5 }] });
  return {
    ...p,
    frames: [
      { ...p.frames[0], title: "Saque", note: "Kevin la pone al primer palo, donde entra Adrián desde atrás" },
      { ...p.frames[1], players: { ...p.frames[1].players, adrian: { x: 50, y: 10 } }, ball: { x: 50, y: 10 }, title: "Remate" },
    ],
  };
}
const who = { adrian: { num: 10, name: "ADRIAN" }, erik: { num: 9, name: "ERIK" } };

describe("the clip's timeline", () => {
  it("lasts 6–12 s: every move at the replay's beat and speed, with the opening and the end held", () => {
    expect(clipLength(2, 1)).toBe(CLIP_MIN_MS);
    expect(clipLength(4, 1)).toBe(CLIP_INTRO_MS + 3 * 2300 + CLIP_OUTRO_MS);
    expect(clipLength(4, 0.5)).toBe(CLIP_MAX_MS);
    expect(clipLength(8, 1.5)).toBe(CLIP_MAX_MS);
    expect(clipLength(3, 1.5)).toBe(CLIP_MIN_MS);
  });
  it("holds the first paso, runs the jugada, holds the last", () => {
    expect(clipT(0, 8000)).toBe(0);
    expect(clipT(CLIP_INTRO_MS, 8000)).toBe(0);
    expect(clipT(8000 - CLIP_OUTRO_MS, 8000)).toBe(1);
    expect(clipT(CLIP_INTRO_MS + (8000 - CLIP_INTRO_MS - CLIP_OUTRO_MS) / 2, 8000)).toBeCloseTo(0.5);
  });
  it("lays the pitch down: our goal on the left, their goal line on the right", () => {
    expect(clipPoint({ x: 0, y: 100 })).toEqual([CLIP_PITCH.x, CLIP_PITCH.y]);
    expect(clipPoint({ x: 100, y: 0 })).toEqual([CLIP_PITCH.x + CLIP_PITCH.w, CLIP_PITCH.y + CLIP_PITCH.h]);
  });
  it("wraps a note into short lines, with an ellipsis when it does not fit", () => {
    expect(wrapText("uno dos tres cuatro", 8, 3)).toEqual(["uno dos", "tres", "cuatro"]);
    expect(wrapText("uno dos tres cuatro cinco seis", 8, 2)).toEqual(["uno dos", "tres…"]);
  });
});

describe("a frame of the clip", () => {
  it("draws the pitch, the rivals in red, our numbered discs, the ball and what the paso is", () => {
    const { ctx, calls } = recCtx();
    const paso = drawClipFrame(ctx, { play: corner(), who, head: "J8 · MAD SKY" }, 0, 6000);
    expect(paso).toBe(0);
    expect(calls[0]).toBe("save()");
    expect(calls.at(-1)).toBe("restore()");
    // stripes, then the frame of the pitch
    expect(calls.filter((c) => c.startsWith("fillRect(")).length).toBeGreaterThanOrEqual(13);
    expect(calls).toContain("strokeRect(400,90,840,560)");
    // one rival (red), two of ours (sky) with their dorsal and name
    expect(calls.filter((c) => c === "fillStyle=#d8344a")).toHaveLength(1);
    expect(calls.filter((c) => c === "fillStyle=#9fd0f2").length).toBeGreaterThanOrEqual(2);
    const [ax, ay] = clipPoint({ x: 50, y: 40 });
    expect(calls).toContain("fillText(10," + Math.round(ax) + "," + Math.round(ay + 1) + ")");
    expect(calls).toContain("fillText(ADRIAN," + Math.round(ax) + "," + Math.round(ay + 36) + ")");
    // (the name wraps inside the text column: it never reaches the grass)
    expect(calls).toContain("fillText(CÓRNER A,40,170,332)");
    expect(calls).toContain("fillText(FAVOR,40,214,332)");
    expect(calls).toContain("fillText(PASO 1/2,40,290,332)");
    expect(calls).toContain("fillText(Saque,40,328,332)");
    expect(calls.some((c) => c.startsWith("fillText(Kevin la pone"))).toBe(true);
    expect(calls).toContain("fillText(J8 · MAD SKY,40,640,332)");
  });
  it("at the end shows the last paso, with the runner where it ends and the progress bar full", () => {
    const { ctx, calls } = recCtx();
    expect(drawClipFrame(ctx, { play: corner(), who, head: "x" }, 6000, 6000)).toBe(1);
    const [ax, ay] = clipPoint({ x: 50, y: 10 });
    expect(calls).toContain("fillText(10," + Math.round(ax) + "," + Math.round(ay + 1) + ")");
    expect(calls).toContain("fillText(PASO 2/2,40,290,332)");
    expect(calls).toContain("fillRect(400,676,840,6)");
  });
  it("draws the moving arrows while the move is under way", () => {
    const p = corner();
    p.frames[0].arrows = [{ from: { x: 50, y: 40 }, to: { x: 50, y: 10 }, kind: "carrera" }];
    const { ctx, calls } = recCtx();
    drawClipFrame(ctx, { play: p, who, head: "x" }, CLIP_INTRO_MS + 100, 6000);
    expect(calls).toContain("setLineDash(4,10)");
  });
});

describe("recording support", () => {
  it("prefers MP4 where the browser records it, else WebM, else none", () => {
    expect(pickMime((t) => t.startsWith("video/webm"))).toBe("video/webm;codecs=vp9");
    expect(pickMime(() => true)).toBe("video/mp4;codecs=avc1.42E01E");
    expect(pickMime(() => false)).toBeNull();
    expect(
      pickMime(() => {
        throw new Error("x");
      }),
    ).toBeNull();
    expect(clipExt("video/mp4")).toBe("mp4");
    expect(clipExt("video/webm;codecs=vp8")).toBe("webm");
  });
  it("says why it can't, in Spanish (no MediaRecorder, no canvas capture, no format)", () => {
    expect(clipSupport({ MediaRecorder: undefined, canCapture: true })).toEqual({ ok: false, why: CLIP_NO_RECORDER });
    const R = Object.assign(function () {}, { isTypeSupported: (t: string) => t === "video/webm" });
    expect(clipSupport({ MediaRecorder: R, canCapture: false })).toEqual({ ok: false, why: CLIP_NO_RECORDER });
    expect(clipSupport({ MediaRecorder: Object.assign(function () {}, { isTypeSupported: () => false }), canCapture: true })).toEqual({ ok: false, why: CLIP_NO_FORMAT });
    expect(clipSupport({ MediaRecorder: R, canCapture: true })).toMatchObject({ ok: true, mime: "video/webm" });
    // jsdom has neither: the default says so
    expect(clipSupport().ok).toBe(false);
  });
});

/** A fake MediaRecorder (its stop() hands the last chunk, then onstop, as browsers do). */
function fakeRecorder(opts: { chunks?: number; failStart?: boolean } = {}) {
  const made: FakeRec[] = [];
  class FakeRec implements RecorderLike {
    state = "inactive";
    ondataavailable: ((e: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    onerror: ((e: unknown) => void) | null = null;
    stream: MediaStream;
    opts?: { mimeType?: string; videoBitsPerSecond?: number };
    constructor(stream: MediaStream, o?: { mimeType?: string; videoBitsPerSecond?: number }) {
      this.stream = stream;
      this.opts = o;
      made.push(this);
    }
    start = vi.fn(() => {
      if (opts.failStart) throw new Error("no");
      this.state = "recording";
    });
    stop = vi.fn(() => {
      this.state = "inactive";
      for (let k = 0; k < (opts.chunks ?? 1); k++) this.ondataavailable?.({ data: new Blob(["v" + k]) });
      this.onstop?.();
    });
  }
  return { Recorder: FakeRec, made };
}
/** A clock the test drives: tick(ms) moves time on and runs the frame waiting. */
function fakeClock() {
  let t = 1000;
  let q: { id: number; cb: () => void }[] = [];
  let n = 0;
  const clock: Clock = {
    now: () => t,
    next: (cb) => {
      q.push({ id: ++n, cb });
      return n;
    },
    cancel: (id) => {
      q = q.filter((x) => x.id !== id);
    },
  };
  const tick = (ms: number) => {
    t += ms;
    const run = q;
    q = [];
    run.forEach((x) => x.cb());
  };
  return { clock, tick, waiting: () => q.length };
}
function fakeCanvas() {
  const track = { stop: vi.fn() };
  const stream = { getTracks: () => [track] } as unknown as MediaStream;
  return { canvas: { captureStream: vi.fn(() => stream) }, track };
}

describe("the recorder", () => {
  it("draws a frame per tick, reports the progress, stops on time and gives one video", async () => {
    const { Recorder, made } = fakeRecorder({ chunks: 2 });
    const { clock, tick, waiting } = fakeClock();
    const { canvas, track } = fakeCanvas();
    const drawn: number[] = [];
    const prog: number[] = [];
    const job = recordClip({ canvas, Recorder, mime: "video/webm;codecs=vp9", ms: 1000, clock, draw: (ms) => drawn.push(ms), onProgress: (p) => prog.push(p) });
    expect(job.phase()).toBe("recording");
    expect(canvas.captureStream).toHaveBeenCalledWith(30);
    expect(made[0].opts).toEqual({ mimeType: "video/webm;codecs=vp9", videoBitsPerSecond: 4_000_000 });
    expect(made[0].start).toHaveBeenCalledWith(250);
    expect(drawn).toEqual([0]);
    tick(400);
    tick(400);
    expect(job.phase()).toBe("recording");
    tick(400);
    expect(drawn).toEqual([0, 400, 800, 1000]);
    expect(prog).toEqual([0.4, 0.8, 1, 1]);
    expect(made[0].stop).toHaveBeenCalledTimes(1);
    expect(waiting()).toBe(0);
    const blob = await job.done;
    expect(job.phase()).toBe("done");
    expect(blob.type).toBe("video/webm");
    expect(blob.size).toBe(4);
    expect(track.stop).toHaveBeenCalled();
    // nothing after the end
    job.cancel();
    expect(job.phase()).toBe("done");
  });
  it("can be cancelled: it stops, rejects with an AbortError and draws no more", async () => {
    const { Recorder, made } = fakeRecorder();
    const { clock, tick, waiting } = fakeClock();
    const { canvas, track } = fakeCanvas();
    const draw = vi.fn();
    const job = recordClip({ canvas, Recorder, mime: "video/mp4", ms: 5000, clock, draw });
    tick(100);
    job.cancel();
    await expect(job.done).rejects.toMatchObject({ name: "AbortError" });
    expect(job.phase()).toBe("cancelled");
    expect(made[0].stop).toHaveBeenCalled();
    expect(track.stop).toHaveBeenCalled();
    expect(waiting()).toBe(0);
    const n = draw.mock.calls.length;
    tick(100);
    expect(draw).toHaveBeenCalledTimes(n);
  });
  it("fails cleanly: a recorder error, an empty video, a recorder that won't start", async () => {
    {
      const { Recorder, made } = fakeRecorder();
      const { clock } = fakeClock();
      const job = recordClip({ canvas: fakeCanvas().canvas, Recorder, mime: "video/webm", ms: 1000, clock, draw: () => undefined });
      made[0].onerror?.(new Event("error"));
      await expect(job.done).rejects.toThrow("La grabación ha fallado");
      expect(job.phase()).toBe("error");
    }
    {
      const { Recorder } = fakeRecorder({ chunks: 0 });
      const { clock, tick } = fakeClock();
      const job = recordClip({ canvas: fakeCanvas().canvas, Recorder, mime: "video/webm", ms: 100, clock, draw: () => undefined });
      tick(200);
      await expect(job.done).rejects.toThrow("El vídeo ha salido vacío");
    }
    {
      const { Recorder } = fakeRecorder({ failStart: true });
      const { clock, waiting } = fakeClock();
      const job = recordClip({ canvas: fakeCanvas().canvas, Recorder, mime: "video/webm", ms: 100, clock, draw: () => undefined });
      await expect(job.done).rejects.toThrow("no");
      expect(job.phase()).toBe("error");
      expect(waiting()).toBe(0);
    }
    {
      const { Recorder } = fakeRecorder();
      const { clock } = fakeClock();
      const canvas = {
        captureStream: () => {
          throw new Error("sin captura");
        },
      };
      await expect(recordClip({ canvas, Recorder, mime: "video/webm", ms: 100, clock, draw: () => undefined }).done).rejects.toThrow("sin captura");
    }
  });
});

describe("to the group", () => {
  const blob = new Blob(["v"], { type: "video/mp4" });
  it("opens the share sheet with the video where it takes files", async () => {
    const share = vi.fn(async () => undefined);
    const save = vi.fn();
    expect(await shareClip(blob, "a.mp4", "Jugada", { share, canShare: () => true }, save)).toBe("shared");
    const data = (share.mock.calls[0] as unknown as [ShareData])[0];
    expect(data.title).toBe("Jugada");
    expect(data.files?.[0].name).toBe("a.mp4");
    expect(data.files?.[0].type).toBe("video/mp4");
    expect(save).not.toHaveBeenCalled();
  });
  it("a dismissed sheet is not a download; a failed one or none downloads", async () => {
    const save = vi.fn();
    const abort = vi.fn(async () => {
      throw new DOMException("no", "AbortError");
    });
    expect(await shareClip(blob, "a.mp4", "J", { share: abort, canShare: () => true }, save)).toBe("cancelled");
    expect(save).not.toHaveBeenCalled();
    const broken = vi.fn(async () => {
      throw new Error("x");
    });
    expect(await shareClip(blob, "a.mp4", "J", { share: broken, canShare: () => true }, save)).toBe("downloaded");
    expect(await shareClip(blob, "a.mp4", "J", { share: vi.fn(), canShare: () => false }, save)).toBe("downloaded");
    expect(await shareClip(blob, "a.mp4", "J", {}, save)).toBe("downloaded");
    expect(save).toHaveBeenCalledTimes(3);
    expect(save).toHaveBeenCalledWith(blob, "a.mp4");
  });
  it("names the file after the jugada", () => {
    expect(clipFile("Córner a favor (tuya)", "video/webm;codecs=vp9")).toBe("pizarra-jugada-corner-a-favor-tuya.webm");
    expect(clipFile("¡¡!!", "video/mp4")).toBe("pizarra-jugada-propia.mp4");
  });
});
