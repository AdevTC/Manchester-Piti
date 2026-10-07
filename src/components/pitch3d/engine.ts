// MPPitch engine: one renderer, one scene, a render loop that sleeps when the element is off-screen,
// the tab is hidden or the host pauses it. The engine clock is WALL time (performance.now, minus
// the time the host kept it paused): sequences (intro, charla, jugadas) stay on schedule even when
// frames are slow, throttled or missing — every wait/tween/flight also arms a timeout that advances
// the clock without a frame, so a sequence can never hang. pause() freezes the clock.
import {
  Group,
  NeutralToneMapping,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Plane,
  PlaneGeometry,
  PMREMGenerator,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { DEFAULT_ASSETS, loadAssets, type Assets } from "./assets";
import { CameraRig, FLIGHT_GRACE, followOrbit, heroDistance, orbitPosition, preset, type FlightEase, type Orbit } from "./camera";
import { GOAL_H, GOAL_W, HL_BOWL, HW_BOWL, PITCH_L, PITCH_W, RUNOFF, SHIRT_FLOAT, SHIRT_H, clamp, lerp, toPitch, toWorld } from "./constants";
import { Ball, Column } from "./fx";
import { Jugada } from "./play";
import { Kit, Player, Rivals } from "./players";
import { buildStadium } from "./stadium";
import { unsupportedReason } from "./support";
import type { CameraPreset, EngineInfo, Handle, MountOptions, PickResult, PlayController, PlayFrame, PlayOptions, PlayerSpec, Quality, RevealOptions, RivalSpec, Theme } from "./types";

const MAX_DPR = 1.75;

class Cancelled extends Error {
  constructor() {
    super("cancelled");
  }
}

export async function mount(el: HTMLElement, opts: MountOptions): Promise<Handle> {
  const why = unsupportedReason();
  if (why) throw new Error(`MPPitch: 3D desactivado en este dispositivo (${why})`);
  const assets = opts.assets ?? DEFAULT_ASSETS;
  let quality: Quality = opts.quality ?? "high";
  /** Largest physics step per frame (springs are sub-stepped inside), s. */
  const maxDt = opts.debug?.maxDt ?? 0.25;
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

  // ---------- DOM ----------
  if (getComputedStyle(el).position === "static") el.style.position = "relative";
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;outline:none";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "Pizarra 3D: el campo con la alineación");
  const vignette = document.createElement("div");
  vignette.style.cssText =
    "position:absolute;inset:0;pointer-events:none;transition:opacity .8s ease;background:radial-gradient(115% 85% at 50% 46%,transparent 52%,rgba(2,5,14,.42) 78%,rgba(2,5,14,.78) 100%)";
  el.append(canvas, vignette);

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance", stencil: false });
  } catch (e) {
    canvas.remove();
    vignette.remove();
    throw e instanceof Error ? e : new Error(String(e));
  }
  let dpr = Math.min(window.devicePixelRatio || 1, quality === "high" ? MAX_DPR : 1);
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping;
  renderer.shadowMap.type = PCFSoftShadowMap;

  let A: Assets;
  try {
    A = await loadAssets(assets);
    if (opts.signal?.aborted) throw new DOMException("MPPitch: montaje cancelado", "AbortError");
  } catch (e) {
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
    vignette.remove();
    throw e instanceof Error ? e : new Error(String(e));
  }

  // ---------- scene ----------
  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const env = pmrem.fromScene(room, 0.04);
  scene.environment = env.texture;
  const camera = new PerspectiveCamera(36, 1, 0.5, 1200);
  const aspect0 = (el.clientWidth || 390) / (el.clientHeight || 844);
  const rig = new CameraRig(camera, opts.camera ?? "tv", aspect0);
  const stadium = buildStadium(scene, renderer, quality, opts.board ?? ["Manchester Piti", "2-3-1", "Química 77", "Vamos Piti"]);
  const kit = new Kit(A, quality, renderer);
  const ringGeo = new PlaneGeometry(1, 1);
  const players = new Map<string, Player>();
  const rivals = new Rivals(kit, ringGeo);
  rivals.addTo(scene);
  const ball = new Ball(kit.ring, kit.blob, ringGeo);
  scene.add(ball.group);
  const column = new Column(kit.ring, ringGeo);
  scene.add(column.group);
  const fxLayer = new Group();
  scene.add(fxLayer);
  const labels = opts.labels ?? true;

  function setPlayers(list: PlayerSpec[], animate = true) {
    const seen = new Set<string>();
    for (const spec of list) {
      seen.add(spec.id);
      let p = players.get(spec.id);
      if (!p) {
        p = new Player(kit, spec, ringGeo);
        p.labels = labels;
        players.set(spec.id, p);
        scene.add(p.root);
      } else {
        p.update(spec);
        if (!animate) p.setPosition(spec.x, spec.y);
      }
    }
    for (const [id, p] of players)
      if (!seen.has(id)) {
        p.root.removeFromParent();
        p.dispose();
        players.delete(id);
      }
  }
  function setBall(b: { x: number; y: number } | null | undefined) {
    ball.visible = !!b;
    if (b) {
      const [wx, wz] = toWorld(b.x, b.y);
      ball.target.set(wx, wz);
      if (!started) ball.pos.set(wx, wz);
    }
  }
  setPlayers(opts.players, false);
  rivals.set(opts.rivals ?? [], false);
  let started = false;
  setBall(opts.ball);

  // ---------- state ----------
  let day = opts.theme === "light" ? 1 : 0, dayTarget = day;
  const power: [number, number, number, number] = [1, 1, 1, 1];
  let raf = 0, alive = true, visible = true, userPaused = false;
  let pausedAt = 0, pausedTotal = 0;
  /** Engine clock (s): wall time minus host pauses. */
  const nowClock = () => ((userPaused ? pausedAt : performance.now()) - pausedTotal) / 1000;
  let clock = nowClock();
  let frames = 0, frameCount = 0, fpsT = 0, fps = 0, lowFor = 0;
  let seq = 0;
  /** What is running, for info() / debugging. */
  let running_: "intro" | "reveal" | "play" | null = null;
  /** The camera tracks the running jugada until the host picks a camera preset. */
  let followPlay = false;
  /** Restores a clean state for the running sequence; called when it ends or is cancelled. */
  let finalize: (() => void) | null = null;
  let jugada: Jugada | null = null;
  let focusId: string | null = null;
  const timers: { at: number; ok: () => void }[] = [];
  const tweens: { start: number; dur: number; fn: (p: number) => void; ok: () => void }[] = [];
  /** Fallback: advance the clock without a frame shortly after something is due (no hangs without rAF). */
  const pumpAfter = (ms: number) =>
    void setTimeout(() => {
      if (!alive) return;
      if (userPaused) return pumpAfter(400);
      advance();
    }, ms);
  const wait = (ms: number) =>
    new Promise<void>((ok) => {
      timers.push({ at: nowClock() + ms / 1000, ok });
      pumpAfter(ms + 15);
    });
  const tween = (ms: number, fn: (p: number) => void) =>
    new Promise<void>((ok) => {
      if (ms <= 0) {
        fn(1);
        ok();
      } else {
        tweens.push({ start: nowClock(), dur: ms / 1000, fn, ok });
        pumpAfter(ms + 15);
      }
    });
  /** Camera flight on the engine clock, with the wall-clock guard (≤ duration + 0.5 s) and a pump. */
  const fly = (to: Orbit, ms: number, arc = 0.1, ease: FlightEase = "inOut") => {
    const p = rig.fly(to, reduceMotion ? 0 : ms, nowClock() * 1000, arc, ease);
    if (!reduceMotion && ms > 0) {
      pumpAfter(ms + 15);
      pumpAfter(ms + FLIGHT_GRACE + 15);
    }
    wake();
    return p;
  };
  const guard = (my: number) => {
    if (my !== seq || !alive) throw new Cancelled();
  };

  // ---------- loop ----------
  function aspect() {
    return (canvas.clientWidth || 1) / (canvas.clientHeight || 1);
  }
  function resize() {
    const w = el.clientWidth || 1, h = el.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (rig.resting && !rig.flying) rig.orbit = preset(rig.resting, w / h);
    wake();
  }
  const camPos = new Vector3();
  /**
   * Moves the engine clock to wall time and settles everything that is due: timers, tweens, the
   * jugada playhead and the camera flight. Runs every frame, and from timeouts when frames stall.
   * Returns the elapsed engine time (s).
   */
  function advance(): number {
    const c = nowClock();
    const step = Math.max(0, c - clock);
    clock = c;
    for (let i = timers.length - 1; i >= 0; i--)
      if (clock >= timers[i].at) {
        const t = timers[i];
        timers.splice(i, 1);
        t.ok();
      }
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i], p = clamp((clock - tw.start) / tw.dur, 0, 1);
      tw.fn(p);
      if (p >= 1) {
        tweens.splice(i, 1);
        tw.ok();
      }
    }
    if (jugada) jugada.tick(step, clock);
    rig.update(clock * 1000, Math.min(step, maxDt));
    return step;
  }
  function frame() {
    raf = 0;
    const step = advance();
    const dt = Math.min(maxDt, step);
    frameCount++;
    day += (dayTarget - day) * Math.min(1, dt * 2.2);
    if (Math.abs(dayTarget - day) < 0.001) day = dayTarget;
    camPos.copy(camera.position);
    const L = (power[0] + power[1] + power[2] + power[3]) / 4;
    renderer.toneMappingExposure = lerp(1.12, 1.0, day);
    scene.environmentIntensity = lerp(0.12 + 0.3 * L, 0.75, day);
    vignette.style.opacity = String(lerp(1, 0.45, day));
    stadium.update({ day, power, time: clock, fov: camera.fov, cam: camPos });
    const cssH = el.clientHeight || 1;
    const platePx = clamp(cssH * 0.031, 18, 28);
    const plateScale = (platePx * 2 * Math.tan((camera.fov * Math.PI) / 360)) / cssH;
    for (const p of players.values()) p.tick(dt, clock, camPos, plateScale, reduceMotion);
    layoutPlates(platePx);
    rivals.tick(dt, clock, camPos, reduceMotion);
    ball.tick(dt);
    const fp = focusId ? players.get(focusId) : null;
    if (fp) column.group.position.set(fp.pos.x, 0, fp.pos.y);
    column.tick(clock, fp?.spec.role === "C");
    renderer.render(scene, camera);
    if (!started) {
      started = true;
      opts.onReady?.();
    }
    // fps + adaptive resolution
    frames++;
    fpsT += step;
    if (fpsT >= 1) {
      fps = frames / fpsT;
      frames = 0;
      fpsT = 0;
      if (quality === "high" && fps < 42 && dpr > 1) {
        if (++lowFor >= 2) {
          dpr = Math.max(1, dpr - 0.25);
          renderer.setPixelRatio(dpr);
          resize();
          lowFor = 0;
        }
      } else lowFor = 0;
    }
    if (running()) raf = requestAnimationFrame(frame);
  }
  const running = () => alive && visible && !userPaused && !document.hidden;

  /**
   * Name tags never overlap: greedy placement in screen space (focused/highlighted first, then
   * nearest to the camera). Each tag tries under its ring, then over its shirt, else hides.
   */
  const placed: { x0: number; y0: number; x1: number; y1: number }[] = [];
  const pv = new Vector3();
  function layoutPlates(platePx: number) {
    const W = el.clientWidth || 1, H = el.clientHeight || 1;
    const list = [...players.values()].filter((p) => p.labels && p.appear > 0.4);
    const scr = (x: number, y: number, z: number) => {
      pv.set(x, y, z).project(camera);
      return { x: ((pv.x + 1) / 2) * W, y: ((1 - pv.y) / 2) * H, z: pv.z };
    };
    const items = list.map((p) => {
      const foot = scr(p.pos.x, 0.05, p.pos.y);
      const head = scr(p.pos.x, SHIRT_FLOAT + SHIRT_H + 0.35, p.pos.y);
      const h = platePx * (1 + p.focus * 0.3), w = h * p.plateAspect;
      const rank = p.focus > 0.5 ? -2 : p.spec.highlight ? -1 : foot.z;
      return { p, foot, head, h, w, rank };
    });
    items.sort((a, b) => a.rank - b.rank);
    placed.length = 0;
    const pad = 3;
    const free = (r: { x0: number; y0: number; x1: number; y1: number }) =>
      r.x1 > 0 && r.x0 < W && r.y1 > 0 && r.y0 < H && placed.every((q) => r.x1 + pad < q.x0 || r.x0 - pad > q.x1 || r.y1 + pad < q.y0 || r.y0 - pad > q.y1);
    for (const it of items) {
      if (it.foot.z > 1) {
        it.p.plateMode = "hidden";
        continue;
      }
      // nudge tags at the frame edge back inside (same nudge for both sides)
      const m = 6, x0 = it.foot.x - it.w / 2, x1 = it.foot.x + it.w / 2;
      const dx = x0 < m ? m - x0 : x1 > W - m ? W - m - x1 : 0;
      it.p.plateShift = dx / it.w; // sprite center.x = 0.5 - shift moves the quad right by dx
      const below = { x0: x0 + dx, x1: x1 + dx, y0: it.foot.y + it.h * 0.1, y1: it.foot.y + it.h * 1.1 };
      const above = { x0: it.head.x - it.w / 2 + dx, x1: it.head.x + it.w / 2 + dx, y0: it.head.y - it.h * 1.1, y1: it.head.y - it.h * 0.1 };
      // keep the current side if it is still free (no flicker between sides)
      const order = it.p.plateMode === "above" ? [above, below] : [below, above];
      const pick = order.find(free);
      if (!pick) it.p.plateMode = "hidden";
      else {
        it.p.plateMode = pick === above ? "above" : "below";
        placed.push(pick);
      }
    }
  }
  function wake() {
    if (!raf && running()) raf = requestAnimationFrame(frame);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(el);
  const io = new IntersectionObserver((entries) => {
    visible = entries[entries.length - 1].isIntersecting; // the latest state wins
    wake();
  });
  io.observe(el);
  const onVis = () => wake();
  document.addEventListener("visibilitychange", onVis);
  const onLost = (e: Event) => {
    e.preventDefault();
    cancelAnimationFrame(raf);
    raf = 0;
    alive = false;
    opts.onError?.(new Error("MPPitch: se perdió el contexto WebGL"));
  };
  canvas.addEventListener("webglcontextlost", onLost);

  resize();
  await renderer.compileAsync(scene, camera).catch(() => undefined);
  if (!alive || opts.signal?.aborted) {
    handleDispose();
    throw new DOMException("MPPitch: montaje cancelado", "AbortError");
  }

  // ---------- sequences ----------
  /** Ends a running jugada without a camera move (the caller sets the camera). */
  function stopPlay() {
    if (!jugada) return;
    jugada.stop();
    jugada = null;
    followPlay = false;
    if (running_ === "play") running_ = null;
  }
  function cancelSequences() {
    seq++;
    for (const t of timers.splice(0)) t.ok();
    for (const t of tweens.splice(0)) {
      t.fn(1);
      t.ok();
    }
    const f = finalize;
    finalize = null;
    f?.();
  }
  async function intro() {
    cancelSequences();
    stopPlay();
    const my = seq;
    const tv = preset("tv", aspect());
    rig.resting = "tv";
    if (reduceMotion) {
      power.fill(1);
      for (const p of players.values()) p.appear = 1;
      rivals.appear = 1;
      await rig.fly(tv, 0, 0);
      return;
    }
    power.fill(0);
    for (const p of players.values()) p.appear = 0;
    rivals.appear = 0;
    const hadBall = ball.visible;
    ball.visible = false;
    const done = () => {
      power.fill(1);
      for (const p of players.values()) p.appear = 1;
      rivals.appear = 1;
      ball.visible = hadBall;
      if (running_ === "intro") running_ = null;
    };
    finalize = done;
    const st = preset("stands", aspect());
    const start: Orbit = { ...st, target: st.target.clone().setY(8), dist: st.dist * 1.12, el: st.el + 0.08 };
    running_ = "intro";
    await rig.fly(start, 0, 0);
    const flight = fly(tv, 3300, 0.05);
    try {
      // floodlights: one by one, with a short strike flicker
      const order = [2, 1, 3, 0];
      order.forEach((m, k) => {
        void wait(250 + k * 360).then(() => {
          if (my !== seq) return;
          void tween(520, (p) => {
            power[m] = p < 0.12 ? 0.9 : p < 0.2 ? 0.15 : p < 0.32 ? 1 : p < 0.38 ? 0.45 : Math.min(1, 0.6 + p * 0.4);
          });
        });
      });
      await wait(1750);
      guard(my);
      const list = [...players.values()].sort((a, b) => b.pos.y - a.pos.y);
      list.forEach((p, i) => void wait(i * 75).then(() => tween(760, (q) => (p.appear = q))));
      await wait(520);
      guard(my);
      void tween(700, (q) => (rivals.appear = q));
      await wait(420);
      ball.visible = hadBall;
      await flight;
      guard(my);
      power.fill(1);
    } catch (e) {
      if (!(e instanceof Cancelled)) {
        opts.onError?.(e instanceof Error ? e : new Error(String(e)));
        throw e;
      }
    } finally {
      if (finalize === done) {
        finalize = null;
        done();
      }
    }
  }

  /**
   * Close hero shot of one shirt (~42% of the frame height). Candidate orbits around the player are
   * tested with a real camera: a candidate is rejected if ANY other shirt (ours or a rival) closer
   * to the lens than the hero would appear in the frame, if the lens sits inside the clearance of
   * another shirt, outside the bowl, or behind a goal net. The straightest shot from our side wins;
   * if every angle is blocked at shirt height the camera rises (higher elevations) until one is clear.
   */
  const heroProbe = new PerspectiveCamera();
  const hv = new Vector3();
  /** The line-of-sight test of the last heroOrbit() (reused to vet the slow drift of the shot). */
  let heroBlockage: (o: Orbit) => number = () => 0;
  function heroOrbit(p: Player): Orbit {
    const portrait = aspect() < 0.9;
    const fov = portrait ? 34 : 27;
    const dist = heroDistance(fov, 0.42);
    const target = new Vector3(p.pos.x, SHIRT_FLOAT + SHIRT_H * 0.5, p.pos.y);
    const others: Vector2[] = [...[...players.values()].filter((q) => q !== p).map((q) => q.pos), ...rivals.items.map((r) => r.pos)];
    const pref = (-p.pos.x / (PITCH_W / 2)) * 0.35;
    const azs = Array.from({ length: 36 }, (_, k) => pref + (k % 2 ? -1 : 1) * Math.ceil(k / 2) * 0.175);
    heroProbe.fov = fov;
    heroProbe.aspect = aspect();
    heroProbe.near = 0.5;
    heroProbe.far = 400;
    heroProbe.updateProjectionMatrix();
    const halfW = SHIRT_H * 0.45, CLEAR = SHIRT_H * 1.1;
    /** Area (NDC², 0 = clear) of foreground shirts intruding into the frame, or Infinity if invalid. */
    const blockage = (o: Orbit) => {
      orbitPosition(o, heroProbe.position);
      const cx = heroProbe.position.x, cz = heroProbe.position.z;
      if (Math.abs(cx) > HW_BOWL || Math.abs(cz) > HL_BOWL) return Infinity;
      if (Math.abs(cz) > PITCH_L / 2 - 0.5 && Math.abs(cx) < GOAL_W / 2 + 1.5 && heroProbe.position.y < GOAL_H + 1) return Infinity;
      heroProbe.lookAt(o.target);
      heroProbe.updateMatrixWorld(true);
      const heroDepth = Math.hypot(p.pos.x - cx, p.pos.y - cz);
      let area = 0;
      for (const q of others) {
        const d = Math.hypot(q.x - cx, q.y - cz);
        if (d < CLEAR) return Infinity; // the lens would sit inside another shirt
        if (d > heroDepth - 0.5) continue; // behind (or level with) the hero: background, fine
        // projected box of q's shirt (sideways half-width, hem to collar)
        const sx = -(q.y - cz) / d, sz = (q.x - cx) / d;
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, front = true;
        for (const k of [-1, 1])
          for (const y of [SHIRT_FLOAT, SHIRT_FLOAT + SHIRT_H]) {
            hv.set(q.x + sx * halfW * k, y, q.y + sz * halfW * k).project(heroProbe);
            if (hv.z > 1 || hv.z < -1) front = false;
            x0 = Math.min(x0, hv.x);
            x1 = Math.max(x1, hv.x);
            y0 = Math.min(y0, hv.y);
            y1 = Math.max(y1, hv.y);
          }
        if (!front) continue;
        const ox = Math.max(0, Math.min(1.05, x1) - Math.max(-1.05, x0)), oy = Math.max(0, Math.min(1.05, y1) - Math.max(-1.05, y0));
        area += ox * oy;
      }
      return area;
    };
    heroBlockage = blockage;
    let fallback: Orbit | null = null, fallbackArea = Infinity;
    for (const el of [-0.03, 0.16, 0.34, 0.55, 0.8]) {
      for (const az of azs) {
        const o: Orbit = { target: target.clone(), az, el, dist, fov };
        const area = blockage(o);
        if (area === 0) return o; // the straightest clear shot at the lowest clear height
        if (area < fallbackArea) {
          fallbackArea = area;
          fallback = o;
        }
      }
    }
    // nothing fully clear: the least-blocked candidate (from above at worst)
    return fallback ?? { target, az: pref, el: 0.8, dist, fov };
  }

  async function reveal(order: string[], o: RevealOptions = {}) {
    cancelSequences();
    stopPlay();
    const my = seq;
    const stepMs = o.stepMs ?? 2800;
    running_ = "reveal";
    const back = rig.resting ?? "tv";
    rig.resting = null;
    const list = order.map((id) => players.get(id)).filter((p): p is Player => !!p);
    let current: Player | null = null;
    const release = (p: Player) => {
      p.yawOverride = null;
      p.heroPrints(false);
      p.focus = 0;
    };
    const done = () => {
      if (current) release(current);
      current = null;
      focusId = null;
      column.opacity = 0;
      for (const p of players.values()) p.dim = 0;
      if (!rig.resting) rig.resting = back;
      if (running_ === "reveal") running_ = null;
    };
    finalize = done;
    try {
      for (const p of players.values()) void tween(500, (q) => (p.dim = Math.max(p.dim, q)));
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        const hero = heroOrbit(p);
        // the first approach gets close fast (ease-out); then crane moves player to player
        await (i === 0 ? fly(hero, 1100, 0, "out") : fly(hero, 1000, 0.04));
        guard(my);
        // a slow orbit while the shirt turns (not awaited: the next flight takes over)
        // the drift (slow orbit + dolly) must stay clear too: try both directions, else just dolly in
        const drift = [0.24, -0.24, 0]
          .map((da): Orbit => ({ ...hero, target: hero.target.clone(), az: hero.az + da, dist: hero.dist * 0.93 }))
          .find((o) => heroBlockage(o) === 0);
        if (drift) void fly(drift, stepMs + 300, 0);
        if (current) release(current);
        current = p;
        focusId = p.spec.id;
        p.dim = 0;
        for (const q of players.values()) if (q !== p) q.dim = 1;
        p.heroPrints(true);
        p.yawOverride = 0;
        void tween(450, (q) => {
          p.focus = q;
          column.opacity = Math.max(column.opacity, q);
        });
        o.onStep?.(i, { ...p.spec });
        console.debug(`[MPPitch] charla ${i + 1}/${list.length}: ${p.spec.name}`);
        await wait(stepMs * 0.3);
        guard(my);
        p.yawOverride = Math.PI; // the shirt turns: name and number
        await wait(stepMs * 0.7);
        guard(my);
        if (i < list.length - 1) await tween(250, (q) => (column.opacity = 1 - q));
        guard(my);
      }
      await tween(350, (q) => (column.opacity = 1 - q));
      if (current) release(current);
      current = null;
      focusId = null;
      for (const p of players.values()) void tween(600, (q) => (p.dim = Math.min(p.dim, 1 - q)));
      rig.resting = back;
      await fly(preset(back, aspect()), 1500, 0.08);
    } catch (e) {
      if (!(e instanceof Cancelled)) {
        opts.onError?.(e instanceof Error ? e : new Error(String(e)));
        throw e;
      }
    } finally {
      if (finalize === done) {
        finalize = null;
        done();
      }
    }
  }

  function play(frames: PlayFrame[], o: PlayOptions = {}): PlayController {
    stopPlay();
    cancelSequences();
    if (frames.length < 1) throw new Error("MPPitch.play: hacen falta frames");
    const back = rig.resting ?? "tv";
    rig.resting = null;
    running_ = "play";
    // fly down to the action first; the jugada then makes the camera track the ball
    const b0 = frames[0].ball ? toWorld(frames[0].ball.x, frames[0].ball.y) : [ball.pos.x, ball.pos.y];
    void fly(followOrbit(aspect(), new Vector3(b0[0] * 0.8, 0, b0[1] * 0.85)), 1000, 0, "out");
    followPlay = true;
    const j = new Jugada({ players, rivals, ball, layer: fxLayer, track: (v) => rig.setTrack(followPlay ? v : null), reduceMotion }, frames, o);
    jugada = j;
    wake();
    const end = () => {
      if (jugada !== j) return j.stop();
      const owned = followPlay; // the host may have picked a camera meanwhile
      stopPlay();
      if (owned) {
        rig.resting = back;
        void fly(preset(back, aspect()), 1400, 0.08);
      }
    };
    const ctl: PlayController = {
      pause: () => j.pause(),
      resume: () => {
        j.resume();
        wake();
      },
      seek: (t) => {
        j.seek(t);
        wake();
      },
      stop: end,
      done: j.done,
    };
    return ctl;
  }

  // ---------- picking ----------
  const ray = new Raycaster(), ground = new Plane(new Vector3(0, 1, 0), 0), hit = new Vector3(), v3 = new Vector3();
  function screenOf(x: number, y: number, z: number) {
    v3.set(x, y, z).project(camera);
    const r = canvas.getBoundingClientRect();
    return { x: ((v3.x + 1) / 2) * r.width, y: ((1 - v3.y) / 2) * r.height, z: v3.z };
  }
  function pick(clientX: number, clientY: number): PickResult {
    const r = canvas.getBoundingClientRect();
    const px = clientX - r.left, py = clientY - r.top;
    const best = { id: "", d: Infinity };
    const test = (id: string, wx: number, wz: number) => {
      const top = screenOf(wx, SHIRT_FLOAT + SHIRT_H, wz), bot = screenOf(wx, 0, wz);
      if (top.z > 1 || bot.z > 1) return;
      const h = Math.abs(bot.y - top.y), w = Math.max(18, h * 0.62);
      const cx = (top.x + bot.x) / 2, cy = (top.y + bot.y) / 2;
      const dx = (px - cx) / (w / 2), dy = (py - cy) / (Math.max(24, h) / 2);
      const d = dx * dx + dy * dy;
      // nearer (lower z) shirts win ties
      if (d <= 1 && d + top.z * 0.01 < best.d) {
        best.id = id;
        best.d = d + top.z * 0.01;
      }
    };
    for (const p of players.values()) test(p.spec.id, p.pos.x, p.pos.y);
    for (const rv of rivals.items) test(rv.id, rv.pos.x, rv.pos.y);
    if (best.id) return { id: best.id };
    ray.setFromCamera(new Vector2((px / r.width) * 2 - 1, -(py / r.height) * 2 + 1), camera);
    if (!ray.ray.intersectPlane(ground, hit)) return null;
    if (Math.abs(hit.x) > PITCH_W / 2 + RUNOFF || Math.abs(hit.z) > PITCH_L / 2 + RUNOFF) return null;
    const q = toPitch(hit.x, hit.z);
    return { x: clamp(q.x, 0, 100), y: clamp(q.y, 0, 100) };
  }

  const handle: Handle = {
    setPlayers(list, o) {
      setPlayers(list, o?.animate ?? true);
    },
    setRivals(list: RivalSpec[], o) {
      rivals.set(list, o?.animate ?? true);
    },
    setBall,
    setCamera(name: CameraPreset, o) {
      cancelSequences();
      followPlay = false;
      rig.setTrack(null);
      rig.resting = name;
      wake();
      return fly(preset(name, aspect()), o?.duration ?? 1400, 0.1);
    },
    setBoard(messages) {
      stadium.setBoard(messages);
    },
    intro,
    reveal,
    play,
    pick,
    project(id) {
      const p = players.get(id);
      const rv = p ? null : rivals.items.find((r) => r.id === id);
      if (!p && !rv) return null;
      const pos = p ? p.pos : rv!.pos;
      const s = screenOf(pos.x, SHIRT_FLOAT + SHIRT_H / 2, pos.y);
      return { x: s.x, y: s.y, visible: s.z < 1 };
    },
    setTheme(t: Theme) {
      dayTarget = t === "light" ? 1 : 0;
      if (reduceMotion) day = dayTarget;
      wake();
    },
    setQuality(q: Quality) {
      quality = q;
      stadium.setQuality(q, renderer);
      dpr = Math.min(window.devicePixelRatio || 1, q === "high" ? MAX_DPR : 1);
      renderer.setPixelRatio(dpr);
      resize();
    },
    pause() {
      if (userPaused) return;
      pausedAt = performance.now();
      userPaused = true;
      cancelAnimationFrame(raf);
      raf = 0;
    },
    resume() {
      if (!userPaused) return;
      const ms = performance.now() - pausedAt;
      pausedTotal += ms;
      rig.shiftWall(ms);
      userPaused = false;
      wake();
    },
    info(): EngineInfo {
      return { fps: Math.round(fps * 10) / 10, frames: frameCount, drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, dpr, sequence: running_, camera: rig.resting ?? (rig.flying ? "flying" : "custom"), view: { position: camera.position.toArray(), target: rig.orbit.target.toArray(), fov: camera.fov } };
    },
    dispose: () => handleDispose(),
  };
  function handleDispose() {
    if (!canvas.isConnected) return;
    cancelSequences();
    alive = false;
    cancelAnimationFrame(raf);
    ro.disconnect();
    io.disconnect();
    document.removeEventListener("visibilitychange", onVis);
    canvas.removeEventListener("webglcontextlost", onLost);
    stopPlay();
    for (const p of players.values()) p.dispose();
    players.clear();
    rivals.dispose();
    ball.dispose();
    column.dispose();
    ringGeo.dispose();
    stadium.dispose();
    kit.dispose();
    env.dispose();
    room.dispose();
    pmrem.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
    vignette.remove();
  }
  wake();
  return handle;
}
