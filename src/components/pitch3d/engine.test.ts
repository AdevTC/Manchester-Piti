import { PerspectiveCamera, Vector3 } from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { KitLayout, Layouts } from "../jersey3d/prints";
import type { Assets } from "./assets";
import type { Handle, PlayFrame, PlayerSpec, RivalSpec } from "./types";

// The real engine (engine.ts + three.js) on a mocked DOM: a 2D-canvas stub, a WebGL2 stub that
// accepts every call, a fake kit (box "shirt", stub layout) and a manual clock driving setTimeout,
// performance.now and requestAnimationFrame. No GPU, no browser. It checks that the sequences
// (intro, charla, jugada) progress and finish on schedule — also when the page starves the engine
// of frames — that a hero shot never has another shirt in front of the lens, and that there is a
// single render loop. Ported from the engine's Node simulation (tools/engine-sim.mjs).

const W = 390, H = 844;

// ---------- fake kit (no network, no GLB decode) ----------
vi.mock("./assets", async () => {
  const { BoxGeometry, Group, Mesh, MeshStandardMaterial } = await import("three");
  // every print box with every size field: drawPrints only does maths on them (2D canvas is a stub)
  const box = () => ({ m: [1, 0, 0, 1, 0, 0] as [number, number, number, number, number, number], w: 40, h: 40, d: 40, cap: 10, R: 80, span: 0.6 });
  const kit = (): KitLayout => ({
    front: { z: box(), crest: box(), num: box(), arc: box(), piti: box(), lines: [] },
    back: { est: box(), name: box(), num: box(), wm: box(), estL: box(), estR: box(), crown: box(), lines: [] },
  });
  const bitmap = () => ({ width: 64, height: 64, close: () => undefined }) as unknown as ImageBitmap;
  const scene = new Group();
  const shirt = new Mesh(new BoxGeometry(1, 1.2, 0.3), new MeshStandardMaterial());
  shirt.name = "Object_0";
  scene.add(shirt);
  const layout: Layouts = { home: kit(), away: kit() };
  const assets: Assets = { gltf: { scene } as unknown as GLTF, layout, home: bitmap(), away: bitmap(), normal: bitmap(), crest: null };
  return { DEFAULT_ASSETS: { glb: "", layout: "", kitHome: "", kitAway: "", normal: "" }, loadAssets: () => Promise.resolve(assets) };
});

// ---------- 2D canvas + WebGL2 stubs ----------
const noop = () => undefined;
function ctx2d(): unknown {
  const t: Record<string | symbol, unknown> = {
    font: "10px sans-serif",
    measureText: (s: string) => {
      const px = parseFloat(/(\d+(?:\.\d+)?)px/.exec(String(t.font))?.[1] ?? "10");
      const w = String(s).length * px * 0.55;
      return { width: w, actualBoundingBoxLeft: 0, actualBoundingBoxRight: w, actualBoundingBoxAscent: px * 0.7 };
    },
    createRadialGradient: () => ({ addColorStop: noop }),
    createLinearGradient: () => ({ addColorStop: noop }),
    getImageData: (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
  };
  return new Proxy(t, { get: (o, k) => (k in o ? o[k] : noop), set: (o, k, v) => ((o[k] = v), true) });
}
function glStub(canvas: HTMLCanvasElement): unknown {
  const ids = new Map<string, number>(), names = new Map<number, string>();
  const id = (name: string) => {
    let v = ids.get(name);
    if (v === undefined) {
      v = 0x9000 + ids.size;
      ids.set(name, v);
      names.set(v, name);
    }
    return v;
  };
  const param = (p: number) => {
    const n = names.get(p) ?? "";
    if (n === "VERSION") return "WebGL 2.0 (stub)";
    if (n === "SHADING_LANGUAGE_VERSION") return "WebGL GLSL ES 3.00";
    if (n === "SCISSOR_BOX" || n === "VIEWPORT") return new Int32Array([0, 0, canvas.width, canvas.height]);
    if (n.startsWith("MAX_")) return n.includes("TEXTURE_IMAGE_UNITS") || n === "MAX_VERTEX_ATTRIBS" ? 16 : n === "MAX_SAMPLES" ? 4 : 4096;
    return 0;
  };
  const fns: Record<string, unknown> = {
    getParameter: param,
    getExtension: (name: string) =>
      name === "WEBGL_lose_context" ? { loseContext: noop, restoreContext: noop } : new Proxy({}, { get: (_, k) => (typeof k === "string" ? id(k) : undefined) }),
    getSupportedExtensions: () => [],
    getContextAttributes: () => ({ alpha: false, antialias: true, depth: true, stencil: false, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: "high-performance" }),
    getShaderPrecisionFormat: () => ({ precision: 23, rangeMin: 127, rangeMax: 127 }),
    getShaderParameter: () => true,
    getProgramParameter: (_: unknown, p: number) => (names.get(p) === "ACTIVE_UNIFORMS" || names.get(p) === "ACTIVE_ATTRIBUTES" ? 0 : true),
    getProgramInfoLog: () => "",
    getShaderInfoLog: () => "",
    getShaderSource: () => "",
    getAttribLocation: () => -1,
    getUniformLocation: () => null,
    checkFramebufferStatus: () => id("FRAMEBUFFER_COMPLETE"),
    isContextLost: () => false,
    getError: () => 0,
    canvas,
    drawingBufferWidth: W,
    drawingBufferHeight: H,
  };
  return new Proxy(fns, {
    get(o, k) {
      if (typeof k !== "string") return undefined;
      if (k in o) return o[k];
      if (/^[A-Z0-9_]+$/.test(k)) return id(k);
      if (k.startsWith("create")) return () => ({});
      return noop;
    },
  });
}

// ---------- manual clock: setTimeout + performance.now (fake timers) and our own rAF queue ----------
let rafQ = new Map<number, FrameRequestCallback>(), rafId = 0, maxChains = 0, nextFrame = 0;
let frameEvery = 1000 / 60;
const now = () => performance.now();
/** Advance `ms` of simulated time in 4 ms ticks: due timers fire, a frame runs every `frameEvery` ms. */
async function run(ms: number) {
  const end = now() + ms;
  while (now() < end) {
    await vi.advanceTimersByTimeAsync(4);
    if (now() >= nextFrame) {
      nextFrame += frameEvery;
      const q = rafQ;
      rafQ = new Map();
      maxChains = Math.max(maxChains, q.size);
      for (const cb of q.values()) cb(now());
    }
  }
}

const restore: (() => void)[] = [];
function stubProto<T extends object>(proto: T, key: string, desc: PropertyDescriptor) {
  const prev = Object.getOwnPropertyDescriptor(proto, key);
  Object.defineProperty(proto, key, { configurable: true, ...desc });
  restore.push(() => (prev ? Object.defineProperty(proto, key, prev) : Reflect.deleteProperty(proto, key)));
}
beforeAll(() => {
  stubProto(HTMLElement.prototype, "clientWidth", { get: () => W });
  stubProto(HTMLElement.prototype, "clientHeight", { get: () => H });
  stubProto(Element.prototype, "getBoundingClientRect", { value: () => ({ left: 0, top: 0, x: 0, y: 0, width: W, height: H, right: W, bottom: H }) });
  stubProto(HTMLCanvasElement.prototype, "getContext", {
    value(this: HTMLCanvasElement & { __2d?: unknown; __gl?: unknown }, type: string) {
      if (type === "2d") return (this.__2d ??= ctx2d());
      if (type === "webgl2") return (this.__gl ??= glStub(this));
      return null;
    },
  });
});
afterAll(() => {
  for (const r of restore.splice(0).reverse()) r();
});
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  rafQ = new Map();
  maxChains = 0;
  frameEvery = 1000 / 60;
  nextFrame = now();
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => (rafQ.set(++rafId, cb), rafId));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => void rafQ.delete(id));
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      cb: (e: { isIntersecting: boolean }[]) => void;
      constructor(cb: (e: { isIntersecting: boolean }[]) => void) {
        this.cb = cb;
      }
      observe() {
        this.cb([{ isIntersecting: true }]);
      }
      disconnect() {}
    },
  );
  vi.spyOn(console, "debug").mockImplementation(noop);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

// ---------- the demo's seven, rivals and córner (engine coordinates: y 0 = our goal line) ----------
const SEVEN: PlayerSpec[] = (
  [
    ["evans", "1", 50, 6, undefined],
    ["illescas", "4", 30, 25, "C"],
    ["tello", "20", 70, 25, undefined],
    ["huberoski", "14", 17, 48, "F"],
    ["eguzquiza", "8", 50, 44, undefined],
    ["erik", "9", 83, 48, "E"],
    ["adrian", "10", 50, 73, "P"],
  ] as const
).map(([id, num, x, y, role]) => ({ id, name: id.toUpperCase(), num, x, y, role }));
const RIVALS: RivalSpec[] = [[50, 95], [36, 82], [64, 82], [22, 64], [50, 66], [78, 64], [50, 52]].map(([x, y], i) => ({ id: "r" + (i + 1), x, y }));
const CORNER: PlayFrame[] = [
  {
    players: [{ id: "erik", x: 97, y: 99 }, { id: "huberoski", x: 76, y: 86 }, { id: "adrian", x: 52, y: 84 }, { id: "eguzquiza", x: 62, y: 77 }, { id: "illescas", x: 46, y: 66 }, { id: "tello", x: 72, y: 58 },
      { id: "r1", x: 50, y: 98 }, { id: "r2", x: 44, y: 92 }, { id: "r3", x: 58, y: 91 }, { id: "r4", x: 70, y: 88 }, { id: "r5", x: 52, y: 86 }, { id: "r6", x: 62, y: 80 }, { id: "r7", x: 48, y: 72 }],
    ball: { x: 98.6, y: 99.4 },
    arrows: [{ from: { x: 98, y: 99 }, to: { x: 82, y: 92 }, kind: "pase" }, { from: { x: 76, y: 86 }, to: { x: 82, y: 92 }, kind: "carrera" }, { from: { x: 52, y: 84 }, to: { x: 45, y: 93 }, kind: "carrera" }],
  },
  {
    players: [{ id: "huberoski", x: 82, y: 92 }, { id: "erik", x: 91, y: 96 }, { id: "adrian", x: 45, y: 93 }, { id: "eguzquiza", x: 60, y: 84 }, { id: "r4", x: 78, y: 90 }, { id: "r2", x: 46, y: 94 }, { id: "r5", x: 56, y: 89 }],
    ball: { x: 82.6, y: 92.4 },
    arrows: [{ from: { x: 82, y: 92 }, to: { x: 67, y: 90 }, kind: "conduccion" }, { from: { x: 60, y: 84 }, to: { x: 56, y: 93 }, kind: "carrera" }],
  },
  {
    players: [{ id: "huberoski", x: 67, y: 90 }, { id: "eguzquiza", x: 56, y: 93 }, { id: "r4", x: 71, y: 92 }, { id: "r3", x: 61, y: 94 }, { id: "r5", x: 60, y: 90 }],
    ball: { x: 66.4, y: 90.4 },
    arrows: [{ from: { x: 66, y: 90.5 }, to: { x: 46, y: 100.4 }, kind: "pase" }],
  },
  { players: [{ id: "huberoski", x: 64, y: 92 }, { id: "eguzquiza", x: 53, y: 96 }, { id: "adrian", x: 47, y: 96 }, { id: "r1", x: 53, y: 99 }], ball: { x: 46, y: 101 } },
];

async function mountEngine(errors: string[]): Promise<{ h: Handle; el: HTMLElement }> {
  const { mount } = await import("./engine");
  const el = document.createElement("div");
  document.body.append(el);
  let h: Handle | null | false = null;
  mount(el, { theme: "dark", quality: "low", players: SEVEN, rivals: RIVALS, ball: { x: 50, y: 50 }, onError: (e) => errors.push(e.message) }).then(
    (x) => (h = x),
    (e: unknown) => {
      errors.push(String(e));
      h = false;
    },
  );
  // the mount polls shader compilation with timers: keep the clock running meanwhile
  for (let i = 0; i < 500 && h === null; i++) await run(20);
  if (!h) throw new Error("mount failed: " + errors.join("; "));
  return { h, el };
}

describe("pitch3d engine (mocked WebGL, manual clock)", () => {
  it("runs the intro, a charla, a jugada and a cancelled charla on schedule, with one render loop", async () => {
    const errors: string[] = [];
    const { h, el } = await mountEngine(errors);
    await run(200);
    expect(h.info().camera).toBe("tv");

    // intro: ~3.4 s
    let introDone = false;
    void h.intro().then(() => (introDone = true));
    await run(4500);
    expect(introDone).toBe(true);
    expect(h.info().sequence).toBeNull();

    // charla over three players
    const steps: number[] = [];
    let revealDone = false;
    const t0 = now();
    void h.reveal(["evans", "illescas", "tello"], { stepMs: 1200, onStep: () => steps.push(now() - t0) }).then(() => (revealDone = true));
    await run(1800);
    expect(steps.length).toBeGreaterThanOrEqual(1);
    expect(steps[0]).toBeLessThanOrEqual(1700);
    await run(9000);
    expect(steps).toHaveLength(3);
    expect(revealDone).toBe(true);
    expect(h.info().sequence).toBeNull();
    expect(h.info().camera).toBe("tv");

    // the córner: reaches its last frame and ends; stop() flies back to tv
    const frames: number[] = [];
    const ctl = h.play(CORNER, { onFrame: (i) => frames.push(i) });
    let playDone = false;
    void ctl.done.then(() => (playDone = true));
    await run(2000);
    expect(frames.length).toBeGreaterThanOrEqual(2);
    await run(10000);
    expect(playDone).toBe(true);
    expect(frames.at(-1)).toBe(3);
    ctl.stop();
    await run(2000);
    expect(h.info().camera).toBe("tv");
    expect(h.info().sequence).toBeNull();

    // a camera move cancels a running charla cleanly
    void h.reveal(["evans", "illescas"]);
    await run(500);
    void h.setCamera("top", { duration: 600 });
    await run(1000);
    expect(h.info().camera).toBe("top");
    expect(h.info().sequence).toBeNull();

    // picking: the pitch centre on screen maps to a pitch point or a shirt
    expect(h.pick(W / 2, H / 2)).not.toBeNull();

    expect(h.info().frames).toBeGreaterThan(0);
    expect(maxChains).toBeLessThanOrEqual(1);
    h.dispose();
    expect(el.querySelector("canvas")).toBeNull();
    expect(errors).toEqual([]);
  }, 60_000);

  it("keeps the sequences on schedule when the page gives a frame only every 2 s", async () => {
    frameEvery = 2000;
    const errors: string[] = [];
    const { h } = await mountEngine(errors);
    let introDone = false;
    void h.intro().then(() => (introDone = true));
    await run(4500);
    expect(introDone).toBe(true);
    let revealDone = false;
    void h.reveal(["evans", "tello"], { stepMs: 1000 }).then(() => (revealDone = true));
    await run(9000);
    expect(revealDone).toBe(true);
    h.dispose();
    expect(errors).toEqual([]);
  }, 60_000);

  it("never has another shirt in front of the lens in a hero shot of the charla", async () => {
    const errors: string[] = [];
    const { h } = await mountEngine(errors);
    const world = (x: number, y: number) => [(x / 100 - 0.5) * 40, (0.5 - y / 100) * 60];
    const ents = [...SEVEN, ...RIVALS];
    const SH = 4.6, FL = 0.7, HALF = SH * 0.45;
    const bad: string[] = [];
    let shots = 0, done = false;
    void h
      .reveal(
        SEVEN.map((p) => p.id),
        {
          stepMs: 900,
          onStep: (_i, p) => {
            shots++;
            const v = h.info().view;
            const cam = new PerspectiveCamera(v.fov, W / H, 0.5, 400);
            cam.position.fromArray(v.position);
            cam.lookAt(new Vector3().fromArray(v.target));
            cam.updateMatrixWorld(true);
            const [hx, hz] = world(p.x, p.y);
            const heroD = Math.hypot(hx - cam.position.x, hz - cam.position.z);
            for (const q of ents) {
              if (q.id === p.id) continue;
              const [qx, qz] = world(q.x, q.y);
              const d = Math.hypot(qx - cam.position.x, qz - cam.position.z);
              if (d > heroD - 0.5) continue;
              const sx = -(qz - cam.position.z) / d, sz = (qx - cam.position.x) / d;
              for (const k of [-1, 0, 1])
                for (const y of [FL, FL + SH / 2, FL + SH]) {
                  const pr = new Vector3(qx + sx * HALF * k, y, qz + sz * HALF * k).project(cam);
                  if (pr.z < 1 && Math.abs(pr.x) < 1 && Math.abs(pr.y) < 1) bad.push(`${p.id}: ${q.id} delante`);
                }
            }
          },
        },
      )
      .then(() => (done = true));
    await run(25000);
    expect(done).toBe(true);
    expect(shots).toBe(7);
    expect([...new Set(bad)]).toEqual([]);
    h.dispose();
    expect(errors).toEqual([]);
  }, 60_000);
});
