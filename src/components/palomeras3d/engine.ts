// «La luz del partido»: CDM Palomeras in three.js. One WebGL context drawing many 2D views (the hero, or the
// six slices of Partidos). Lazy chunk: only <Palomeras>/<PalomerasSlices> import it, after load and when visible.
import * as THREE from "three";
import { cloudAmount, lightingOf, mix, smooth, type Lighting } from "./light";
import { sunScreen, type RigDef } from "./rigs";
import {
  fillPlate,
  floodLevels,
  IGNITE_AT,
  ignitePower,
  MASTS,
  MAST_H,
  PITCH,
  placeFigures,
  plateLook,
  plateX,
  SPONSORS,
  type SceneFigure,
} from "./scene";
import { rng } from "./still";
import type { PalomerasState } from "./types";

const { L, W, HL, HW } = PITCH;

export interface EngineView {
  canvas: HTMLCanvasElement;
  w: number;
  h: number;
  rig: RigDef;
  plates?: HTMLElement | null;
  state: PalomerasState;
  /** DPR cap for this view (≤ 1.5). */
  maxDpr?: number;
  /** Players walk to new spots (false: they jump there). */
  walk?: boolean;
}

export interface EngineOptions {
  views: EngineView[];
  /** The view that animates (goal, ignite, walking). */
  live?: number;
  reduced?: boolean;
  crestUrl?: string;
  /** One frame per change, no loop (screenshots). */
  shot?: boolean;
  /** The WebGL context was lost: the host goes back to the still. */
  onLost?: () => void;
  /** A view was drawn. */
  onRender?: (i: number) => void;
}

export interface Engine {
  setState(i: number, st: PalomerasState): void;
  resize(i: number, w: number, h: number): void;
  setLive(i: number): void;
  ignite(i?: number): void;
  goal(i: number, ours: boolean, scorerId?: string): void;
  mvp(i: number, id: string): void;
  pointer(i: number, nx: number, ny: number): void;
  /** Screen point (CSS px in view i) of a world point. */
  project(i: number, x: number, y: number, z: number): { x: number; y: number } | null;
  setReduced(r: boolean): void;
  pause(): void;
  resume(): void;
  dispose(): void;
}

type Win = Window & { __SHOT?: unknown };

function fontsReady(): Promise<unknown> {
  try {
    return Promise.race([
      Promise.all([document.fonts.load("900 64px Anybody"), document.fonts.load("800 34px Anybody")]),
      new Promise((r) => setTimeout(r, 1200)),
    ]);
  } catch {
    return Promise.resolve();
  }
}

function cv(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}
function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const g = c.getContext("2d");
  if (!g) throw new Error("Sin contexto 2D");
  return g;
}
function tex(c: HTMLCanvasElement, srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
const ease = (x: number) => {
  const t = Math.max(0, Math.min(1, x));
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
};

/* ---------- textures ---------- */
function turfTex() {
  const c = cv(1024, 640);
  const g = ctx2d(c);
  const r = rng(7);
  const n = 14;
  for (let i = 0; i < n; i++) {
    g.fillStyle = i % 2 ? "#5a9a55" : "#4e8e4b";
    g.fillRect((i * 1024) / n, 0, 1024 / n + 1, 640);
  }
  for (let k = 0; k < 26000; k++) {
    const a = r();
    g.fillStyle = a < 0.5 ? "rgba(20,40,20,.18)" : a < 0.85 ? "rgba(160,210,140,.12)" : "rgba(40,30,30,.25)";
    g.fillRect(r() * 1024, r() * 640, 1.3, 1.3);
  }
  const gr = g.createRadialGradient(512, 320, 120, 512, 320, 620);
  gr.addColorStop(0, "rgba(0,0,0,0)");
  gr.addColorStop(1, "rgba(0,0,0,.18)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 1024, 640);
  return tex(c);
}
function radialTex(stops: readonly (readonly [number, string])[], s = 128) {
  const c = cv(s, s);
  const g = ctx2d(c);
  const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  for (const st of stops) gr.addColorStop(st[0], st[1]);
  g.fillStyle = gr;
  g.fillRect(0, 0, s, s);
  return tex(c);
}
function flareTex() {
  const s = 256;
  const c = cv(s, s);
  const g = ctx2d(c);
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, "rgba(255,255,255,1)");
  gr.addColorStop(0.08, "rgba(255,250,235,.9)");
  gr.addColorStop(0.25, "rgba(255,236,200,.25)");
  gr.addColorStop(1, "rgba(255,230,190,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, s, s);
  const h = g.createLinearGradient(0, 0, s, 0);
  h.addColorStop(0, "rgba(190,225,255,0)");
  h.addColorStop(0.5, "rgba(225,242,255,.85)");
  h.addColorStop(1, "rgba(190,225,255,0)");
  g.fillStyle = h;
  g.fillRect(0, 126, s, 4);
  const v = g.createLinearGradient(0, 0, 0, s);
  v.addColorStop(0, "rgba(255,255,255,0)");
  v.addColorStop(0.5, "rgba(255,255,255,.35)");
  v.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = v;
  g.fillRect(127, 40, 2, 176);
  return tex(c);
}
function gridTex(draw: (g: CanvasRenderingContext2D) => void) {
  const c = cv(64, 64);
  const g = ctx2d(c);
  draw(g);
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function lampTex() {
  const c = cv(256, 128);
  const g = ctx2d(c);
  g.fillStyle = "#1b2440";
  g.fillRect(0, 0, 256, 128);
  for (let y = 0; y < 2; y++)
    for (let x = 0; x < 4; x++) {
      const cx = 32 + x * 64;
      const cy = 32 + y * 64;
      const gr = g.createRadialGradient(cx, cy, 2, cx, cy, 28);
      gr.addColorStop(0, "#ffffff");
      gr.addColorStop(0.6, "#e8f2ff");
      gr.addColorStop(1, "#5d6b8a");
      g.fillStyle = gr;
      g.beginPath();
      g.arc(cx, cy, 26, 0, 7);
      g.fill();
    }
  return tex(c);
}
function windowsTex(seed: number) {
  const c = cv(128, 256);
  const g = ctx2d(c);
  const r = rng(seed);
  g.fillStyle = "#000";
  g.fillRect(0, 0, 128, 256);
  for (let y = 6; y < 250; y += 16)
    for (let x = 6; x < 124; x += 14) {
      const on = r();
      if (on < 0.36) {
        g.fillStyle = on < 0.07 ? "#9fd0f2" : on < 0.26 ? "#ffcf8a" : "#ffe6b8";
        g.fillRect(x, y, 7, 9);
      }
    }
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function fasciaTex(away: boolean) {
  const c = cv(2048, 128);
  const g = ctx2d(c);
  const gr = g.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, away ? "#2c4434" : "#16285a");
  gr.addColorStop(1, away ? "#1a2a20" : "#0c1733");
  g.fillStyle = gr;
  g.fillRect(0, 0, 2048, 128);
  g.fillStyle = away ? "#9fb59a" : "#6CABDD";
  g.fillRect(0, 112, 2048, 6);
  g.textBaseline = "middle";
  g.textAlign = "center";
  g.font = "900 64px Anybody";
  if ("letterSpacing" in g) g.letterSpacing = "10px";
  if (away) {
    g.fillStyle = "#e8ecdf";
    g.fillText("CAMPO MUNICIPAL", 560, 62);
    g.fillStyle = "#b9c7b0";
    g.fillText("BIENVENIDOS", 1490, 62);
  } else {
    g.fillStyle = "#eef4ff";
    g.fillText("CDM PALOMERAS", 560, 62);
    g.fillStyle = "#9fd0f2";
    g.fillText("MANCHESTER PITI", 1490, 62);
  }
  return tex(c);
}
function boardDraw(c: HTMLCanvasElement, text: string | undefined, kind: PalomerasState["boardKind"], sponsors: readonly string[]) {
  const g = ctx2d(c);
  const W2 = c.width;
  const H2 = c.height;
  g.textBaseline = "middle";
  g.textAlign = "center";
  if (text) {
    g.fillStyle = kind === "gold" ? "#1a1306" : "#0c1733";
    g.fillRect(0, 0, W2, H2);
    g.fillStyle = kind === "gold" ? "#FFC659" : kind === "rival" ? "#ffd0c8" : "#eef4ff";
    // as many copies as fit with a gap (long messages shrink to one copy), never overlapping
    let size = 46;
    g.font = `900 ${size}px Anybody`;
    let tw = g.measureText(text).width;
    if (tw > W2 * 0.9) {
      size = Math.max(22, Math.floor((size * W2 * 0.9) / tw));
      g.font = `900 ${size}px Anybody`;
      tw = g.measureText(text).width;
    }
    const n = Math.max(1, Math.min(3, Math.floor(W2 / (tw + 140))));
    for (let i = 0; i < n; i++) g.fillText(text, ((i + 0.5) * W2) / n, H2 / 2 + 2);
    return;
  }
  const cols = [
    ["#0c1733", "#eef4ff"],
    ["#6CABDD", "#0c1733"],
    ["#eef4ff", "#0c1733"],
    ["#132a5e", "#9fd0f2"],
  ];
  const list = sponsors.length ? sponsors : SPONSORS;
  const n = list.length * 2;
  const w = W2 / n;
  for (let k = 0; k < n; k++) {
    const cc = cols[k % cols.length];
    g.fillStyle = cc[0];
    g.fillRect(k * w, 0, w + 1, H2);
    g.fillStyle = cc[1];
    g.font = "800 34px Anybody";
    g.fillText(list[k % list.length], k * w + w / 2, H2 / 2 + 2);
  }
}
function cloudTex(seed: number, lit: boolean) {
  const c = cv(256, 128);
  const g = ctx2d(c);
  const r = rng(seed);
  for (let i = 0; i < 16; i++) {
    const x = 40 + r() * 176;
    const y = 50 + r() * 40;
    const rad = 18 + r() * 30;
    const gr = g.createRadialGradient(x, y - rad * 0.3, 2, x, y, rad);
    gr.addColorStop(0, "rgba(255,255,255,.95)");
    gr.addColorStop(0.55, "rgba(236,240,248,.6)");
    gr.addColorStop(1, "rgba(210,220,236,0)");
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, rad, 0, 7);
    g.fill();
  }
  const sh = g.createLinearGradient(0, 30, 0, 110);
  if (lit) {
    sh.addColorStop(0, "rgba(70,64,96,.6)");
    sh.addColorStop(0.55, "rgba(150,120,130,.2)");
    sh.addColorStop(1, "rgba(255,240,215,.95)");
  } else {
    sh.addColorStop(0, "rgba(0,0,0,0)");
    sh.addColorStop(1, "rgba(40,50,80,.55)");
  }
  g.globalCompositeOperation = "source-atop";
  g.fillStyle = sh;
  g.fillRect(0, 0, 256, 128);
  return tex(c);
}

/* ---------- geometry ---------- */
function linesGeo() {
  const pos: number[] = [];
  const idx: number[] = [];
  const Y = 0.03;
  const Wd = 0.14;
  const seg = (ax: number, az: number, bx: number, bz: number) => {
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz) || 1;
    const nx = ((-dz / len) * Wd) / 2;
    const nz = ((dx / len) * Wd) / 2;
    const b = pos.length / 3;
    pos.push(ax + nx, Y, az + nz, ax - nx, Y, az - nz, bx + nx, Y, bz + nz, bx - nx, Y, bz - nz);
    idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
  };
  const arc = (cx: number, cz: number, r: number, a0: number, a1: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const t0 = a0 + ((a1 - a0) * i) / n;
      const t1 = a0 + ((a1 - a0) * (i + 1)) / n;
      seg(cx + Math.cos(t0) * r, cz + Math.sin(t0) * r, cx + Math.cos(t1) * r, cz + Math.sin(t1) * r);
    }
  };
  seg(-HL, -HW, HL, -HW);
  seg(HL, -HW, HL, HW);
  seg(HL, HW, -HL, HW);
  seg(-HL, HW, -HL, -HW);
  seg(0, -HW, 0, HW);
  arc(0, 0, 6, 0, Math.PI * 2, 64);
  for (const s of [1, -1]) {
    const gx = s * HL;
    seg(gx, -10, gx - s * 9, -10);
    seg(gx - s * 9, -10, gx - s * 9, 10);
    seg(gx - s * 9, 10, gx, 10);
    seg(gx, -5, gx - s * 3, -5);
    seg(gx - s * 3, -5, gx - s * 3, 5);
    seg(gx - s * 3, 5, gx, 5);
    arc(gx - s * 8, 0, 0.18, 0, Math.PI * 2, 10);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  const nr: number[] = [];
  for (let i = 0; i < pos.length / 3; i++) nr.push(0, 1, 0);
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nr, 3));
  g.setIndex(idx);
  return g;
}

const SKY_V =
  "varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }";
const SKY_F = [
  "uniform vec3 uTop, uMid, uHor, uSunCol, uSunDir; uniform float uSunVis, uNight, uGlow, uCloud;",
  "varying vec3 vDir;",
  "float hash(vec3 p){ p = fract(p*0.3183099+0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }",
  "void main(){",
  "  vec3 d = normalize(vDir); float h = d.y;",
  "  vec3 c = mix(uHor, uMid, smoothstep(-0.02, 0.2, h));",
  "  c = mix(c, uTop, smoothstep(0.16, 0.62, h));",
  "  float sd = max(dot(d, normalize(uSunDir)), 0.0);",
  "  c += uSunCol * (pow(sd, 6.0) * 0.32 + pow(sd, 60.0) * 0.5) * uSunVis * (1.0 - uCloud*0.5);",
  "  c = mix(c, uSunCol * 1.6 + 0.4, smoothstep(0.99955, 0.9997, sd) * uSunVis * (1.0 - uCloud*0.7));",
  "  c += vec3(0.18, 0.3, 0.55) * uGlow * exp(-max(h, 0.0) * 14.0) * 0.45;",
  "  float st = step(0.9972, hash(floor(d * 420.0))) * smoothstep(0.08, 0.5, h) * uNight * (1.0 - uCloud);",
  "  c += vec3(st) * 0.85;",
  "  gl_FragColor = vec4(c, 1.0);",
  "  #include <tonemapping_fragment>",
  "  #include <colorspace_fragment>",
  "}",
].join("\n");
const CONE_V =
  "varying vec3 vN; varying vec3 vV; varying float vH; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); vH = uv.y; gl_Position = projectionMatrix*mv; }";
const CONE_F =
  "uniform float uOp; uniform vec3 uCol; varying vec3 vN; varying vec3 vV; varying float vH; void main(){ float e = pow(abs(dot(vN,vV)), 2.0); gl_FragColor = vec4(uCol * e * pow(vH, 1.4) * uOp, 1.0); }";

interface Fig {
  g: THREE.Group;
  shirt: THREE.MeshStandardMaterial;
  arms: [THREE.Mesh, THREE.Mesh];
  pos: THREE.Vector3;
  tgt: THREE.Vector3;
  data: SceneFigure;
  gone: boolean;
}
interface ViewRt {
  cfg: EngineView;
  dpr: number;
  cam: THREE.PerspectiveCamera;
  ctx: CanvasRenderingContext2D;
  st: PalomerasState;
  dirty: boolean;
  par: [number, number];
  parS: [number, number];
  i: number;
  plateEls: Map<string, HTMLElement>;
  synced: boolean;
}
interface Mast {
  lamp: THREE.MeshBasicMaterial;
  flare: THREE.SpriteMaterial;
  fs: THREE.Sprite;
  halo: THREE.SpriteMaterial;
  cone: THREE.ShaderMaterial;
  pool: THREE.MeshBasicMaterial;
}
interface Net {
  attr: THREE.BufferAttribute;
  base: Float32Array;
  side: number;
  t0: number;
}

export async function createEngine(o: EngineOptions): Promise<Engine> {
  await fontsReady();
  return build(o);
}

function build(o: EngineOptions): Engine {
  const T = THREE;
  const devDpr = window.devicePixelRatio || 1;
  const dprOf = (v: EngineView) => Math.min(devDpr, v.maxDpr ?? 1.5, 1.5);
  const glc = cv(1, 1);
  const R = new T.WebGLRenderer({ canvas: glc, antialias: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
  R.setPixelRatio(1);
  let glW = 1;
  let glH = 1;
  const fitGl = () => {
    let mw = 1;
    let mh = 1;
    for (const v of o.views) {
      const d = dprOf(v);
      mw = Math.max(mw, Math.ceil(v.w * d));
      mh = Math.max(mh, Math.ceil(v.h * d));
    }
    if (mw !== glW || mh !== glH) {
      glW = mw;
      glH = mh;
      R.setSize(mw, mh, false);
    }
  };
  fitGl();
  R.outputColorSpace = T.SRGBColorSpace;
  R.toneMapping = T.ACESFilmicToneMapping;
  R.toneMappingExposure = 1.05;
  R.shadowMap.enabled = true;
  R.shadowMap.type = T.PCFSoftShadowMap;
  let lost = false;
  const onLost = (e: Event) => {
    e.preventDefault();
    lost = true;
    running = false;
    o.onLost?.();
  };
  glc.addEventListener("webglcontextlost", onLost);

  const scene = new T.Scene();
  const fog = new T.Fog(0x8899aa, 120, 520);
  scene.fog = fog;
  const col = (h: string) => new T.Color(h);

  /* sky */
  const skyU = {
    uTop: { value: col("#2a67a7") },
    uMid: { value: col("#6cabdd") },
    uHor: { value: col("#d4e8f6") },
    uSunCol: { value: col("#fff4dc") },
    uSunDir: { value: new T.Vector3(0, 0.3, -1) },
    uSunVis: { value: 1 },
    uNight: { value: 0 },
    uGlow: { value: 0 },
    uCloud: { value: 0 },
  };
  const sky = new T.Mesh(
    new T.SphereGeometry(900, 32, 16),
    new T.ShaderMaterial({ vertexShader: SKY_V, fragmentShader: SKY_F, uniforms: skyU, side: T.BackSide, depthWrite: false }),
  );
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  scene.add(sky);

  const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, cast = true) => {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = cast;
    m.receiveShadow = true;
    return m;
  };

  /* ground, surround, turf, lines */
  const groundMat = new T.MeshStandardMaterial({ color: 0x59606a, roughness: 1 });
  const ground = new T.Mesh(new T.CircleGeometry(700, 48), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  scene.add(ground);
  const concMat = new T.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.95 });
  const conc = new T.Mesh(new T.PlaneGeometry(L + 22, W + 30), concMat);
  conc.rotation.x = -Math.PI / 2;
  conc.position.set(0, -0.01, -1);
  conc.receiveShadow = true;
  scene.add(conc);
  const turfMat = new T.MeshStandardMaterial({ map: turfTex(), roughness: 0.9, metalness: 0 });
  const turf = new T.Mesh(new T.PlaneGeometry(L + 6, W + 6), turfMat);
  turf.rotation.x = -Math.PI / 2;
  turf.receiveShadow = true;
  scene.add(turf);
  const lineMat = new T.MeshStandardMaterial({
    color: 0xf4f8ff,
    roughness: 0.6,
    emissive: 0xffffff,
    emissiveIntensity: 0.05,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const lines = new T.Mesh(linesGeo(), lineMat);
  lines.receiveShadow = true;
  scene.add(lines);

  /* goals with rippling nets */
  const postMat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, emissive: 0xffffff, emissiveIntensity: 0.06 });
  const nt = gridTex((g) => {
    g.strokeStyle = "rgba(240,246,255,.85)";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, 1);
    g.lineTo(64, 1);
    g.moveTo(1, 0);
    g.lineTo(1, 64);
    g.stroke();
  });
  const nets: Net[] = [];
  for (const s of [1, -1]) {
    const gG = new T.Group();
    const pg = new T.CylinderGeometry(0.07, 0.07, 1, 8);
    const bar = (x: number, y: number, z: number, len: number, ax: "x" | "y" | "z") => {
      const m = new T.Mesh(pg, postMat);
      m.scale.y = len;
      m.position.set(x, y, z);
      if (ax === "z") m.rotation.x = Math.PI / 2;
      if (ax === "x") m.rotation.z = Math.PI / 2;
      m.castShadow = true;
      gG.add(m);
    };
    bar(0, 1, -3, 2, "y");
    bar(0, 1, 3, 2, "y");
    bar(0, 2, 0, 6.14, "z");
    const t1 = nt.clone();
    t1.repeat.set(30, 10);
    t1.needsUpdate = true;
    const nm = new T.MeshBasicMaterial({ map: t1, transparent: true, opacity: 0.75, side: T.DoubleSide, depthWrite: false, color: 0xe6eeff });
    const back = new T.PlaneGeometry(6, 2, 24, 8);
    const bm = new T.Mesh(back, nm);
    bm.rotation.y = Math.PI / 2;
    bm.position.set(1.6, 1, 0);
    gG.add(bm);
    const tm = new T.Mesh(new T.PlaneGeometry(1.6, 6), nm);
    tm.rotation.set(-Math.PI / 2, 0, 0);
    tm.position.set(0.8, 2, 0);
    gG.add(tm);
    for (const z of [-3, 3]) {
      const sm = new T.Mesh(new T.PlaneGeometry(1.6, 2), nm);
      sm.position.set(0.8, 1, z);
      gG.add(sm);
    }
    gG.position.x = s * HL;
    if (s < 0) gG.rotation.y = Math.PI;
    scene.add(gG);
    const attr = back.getAttribute("position") as THREE.BufferAttribute;
    nets.push({ attr, base: Float32Array.from(attr.array), side: s, t0: -1e9 });
  }

  /* main stand (far side): stepped seats, crest on the back wall, cantilever roof with a lettered fascia */
  const standG = new T.Group();
  const SZ = -(HW + 6);
  const concrete = new T.MeshStandardMaterial({ color: 0xb9bcc2, roughness: 0.9 });
  const darkMat = new T.MeshStandardMaterial({ color: 0x27304a, roughness: 0.7, metalness: 0.2 });
  const seatMat = new T.MeshStandardMaterial({ color: 0x6cabdd, roughness: 0.55 });
  const wallMat = new T.MeshStandardMaterial({ color: 0xdfe3ea, roughness: 0.85 });
  for (let r = 0; r < 6; r++) {
    standG.add(box(34, 0.5 + r * 0.55, 1.15, concrete, 0, (0.5 + r * 0.55) / 2, SZ - r * 1.15));
    standG.add(box(33, 0.22, 0.42, seatMat, 0, 0.5 + r * 0.55 + 0.11, SZ - r * 1.15 - 0.15));
  }
  const backZ = SZ - 6 * 1.15 - 0.2;
  standG.add(box(35, 8.6, 0.5, wallMat, 0, 4.3, backZ));
  standG.add(box(0.5, 8.6, 7.6, wallMat, -17.6, 4.3, backZ + 3.6));
  standG.add(box(0.5, 8.6, 7.6, wallMat, 17.6, 4.3, backZ + 3.6));
  let crestReady = false;
  let disposed = false;
  const crestMat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, transparent: true, emissive: 0xffffff, emissiveIntensity: 0 });
  const crest = new T.Mesh(new T.CircleGeometry(2.2, 48), crestMat);
  crest.position.set(0, 6.2, backZ + 0.27);
  crest.visible = false;
  standG.add(crest);
  new T.TextureLoader().load(o.crestUrl ?? "/crest-256.webp", (tx) => {
    if (disposed) return tx.dispose();
    tx.colorSpace = T.SRGBColorSpace;
    crestMat.map = tx;
    crestMat.emissiveMap = tx;
    crestMat.needsUpdate = true;
    crestReady = true;
    dirtyAll();
  });
  const stripeMat = new T.MeshStandardMaterial({ color: 0x6cabdd, roughness: 0.6 });
  standG.add(box(35, 0.5, 0.06, stripeMat, 0, 3.55, backZ + 0.26, false));
  const roof = box(37, 0.35, 10.5, darkMat, 0, 9.0, backZ + 4.6);
  roof.rotation.x = -0.07;
  standG.add(roof);
  const fasciaHome = fasciaTex(false);
  const fasciaAway = fasciaTex(true);
  const fMat = new T.MeshStandardMaterial({ map: fasciaHome, roughness: 0.6, emissive: 0xffffff, emissiveIntensity: 0, emissiveMap: fasciaHome });
  const fascia = new T.Mesh(new T.BoxGeometry(37, 1.1, 0.25), [darkMat, darkMat, darkMat, darkMat, fMat, darkMat]);
  fascia.position.set(0, 9.1, backZ + 9.9);
  fascia.castShadow = true;
  standG.add(fascia);
  for (let cx = -15; cx <= 15; cx += 10) standG.add(box(0.28, 9, 0.28, darkMat, cx, 4.5, backZ + 8.6));
  const underMat = new T.MeshBasicMaterial({ color: 0xfff1d6, toneMapped: false });
  standG.add(box(34, 0.08, 0.5, underMat, 0, 8.7, backZ + 7.2, false));
  scene.add(standG);

  /* terrace (near side) and two dugouts */
  for (let tr = 0; tr < 3; tr++) scene.add(box(30, 0.4 + tr * 0.4, 1.2, concrete, 0, (0.4 + tr * 0.4) / 2, HW + 6.5 + tr * 1.2));
  const acryl = new T.MeshStandardMaterial({ color: 0xbfe0ff, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.35 });
  for (const dx of [-6, 6]) {
    scene.add(box(5, 0.1, 1.6, acryl, dx, 2.1, HW + 3.4, false));
    scene.add(box(5, 2.1, 0.08, acryl, dx, 1.05, HW + 4.2, false));
    scene.add(box(4.6, 0.45, 0.5, seatMat, dx, 0.4, HW + 3.9));
  }

  /* spectators (instanced): a small municipal crowd */
  const fanGeo = new T.BoxGeometry(0.42, 0.85, 0.32);
  fanGeo.translate(0, 0.42, 0);
  const FANS = 70;
  const fans = new T.InstancedMesh(fanGeo, new T.MeshStandardMaterial({ roughness: 0.8 }), FANS);
  const fanBase: [number, number, number, number][] = [];
  const fr = rng(11);
  const pal = ["#6CABDD", "#eef4ff", "#1b2b5a", "#9fd0f2", "#5b6475", "#c9d8ef", "#2a4f88", "#FFC659"];
  const m4 = new T.Matrix4();
  for (let f = 0; f < FANS; f++) {
    const onStand = f < 52;
    const row = Math.floor(fr() * 6);
    const x = (fr() - 0.5) * (onStand ? 31 : 27);
    let y = onStand ? 0.5 + row * 0.55 + 0.22 : 0.4 + Math.floor(fr() * 3) * 0.4;
    const z = onStand ? SZ - row * 1.15 - 0.05 : HW + 6.5 + Math.floor(fr() * 3) * 1.2;
    if (!onStand) y = 0.4 + ((z - HW - 6.5) / 1.2) * 0.4 + 0.4;
    fanBase.push([x, y, z, fr()]);
    m4.makeTranslation(x, y, z);
    fans.setMatrixAt(f, m4);
    fans.setColorAt(f, new T.Color(pal[Math.floor(fr() * pal.length)]));
  }
  fans.castShadow = true;
  scene.add(fans);

  /* perimeter fence: ball-stop behind the goals, low fence on the near side */
  const lt = gridTex((g) => {
    g.strokeStyle = "rgba(200,210,220,.55)";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(64, 64);
    g.moveTo(64, 0);
    g.lineTo(0, 64);
    g.stroke();
  });
  const fence = (len: number, h: number, x: number, z: number, ry: number) => {
    const t = lt.clone();
    t.repeat.set(len / 0.9, h / 0.9);
    t.needsUpdate = true;
    const mat = new T.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.25, side: T.DoubleSide, color: 0xb8c0c8, roughness: 0.8 });
    const m = new T.Mesh(new T.PlaneGeometry(len, h), mat);
    m.position.set(x, h / 2, z);
    m.rotation.y = ry;
    m.castShadow = true;
    scene.add(m);
    for (let p = -len / 2; p <= len / 2 + 0.01; p += 4) scene.add(box(0.1, h, 0.1, darkMat, x + Math.cos(ry) * p, h / 2, z - Math.sin(ry) * p));
  };
  fence(W + 14, 5.5, -(HL + 7), -1, Math.PI / 2);
  fence(W + 14, 5.5, HL + 7, -1, Math.PI / 2);
  fence(L + 14, 1.6, 0, HW + 10.5, 0);

  /* perimeter boards */
  const boardC = cv(2048, 64);
  boardDraw(boardC, undefined, undefined, SPONSORS);
  const boardT = tex(boardC);
  boardT.wrapS = T.RepeatWrapping;
  const boards: { mat: THREE.MeshStandardMaterial; tex: THREE.CanvasTexture }[] = [];
  const board = (len: number, x: number, z: number, ry: number, rep: number) => {
    const t = boardT.clone();
    t.repeat.set(rep, 1);
    t.needsUpdate = true;
    const m = new T.MeshStandardMaterial({ map: t, roughness: 0.5, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.1 });
    const b = new T.Mesh(new T.BoxGeometry(len, 0.9, 0.12), [darkMat, darkMat, darkMat, darkMat, m, darkMat]);
    b.position.set(x, 0.55, z);
    b.rotation.y = ry;
    b.castShadow = true;
    scene.add(b);
    boards.push({ mat: m, tex: t });
  };
  board(L, 0, -(HW + 2.4), 0, 1.2);
  board(W - 4, -(HL + 3), 0, Math.PI / 2, 0.8);
  board(W - 4, HL + 3, 0, -Math.PI / 2, 0.8);
  board(14, -16, HW + 2.6, Math.PI, 0.35);
  board(14, 16, HW + 2.6, Math.PI, 0.35);

  /* floodlight masts */
  const flare = flareTex();
  const halo = radialTex([
    [0, "rgba(190,225,255,.6)"],
    [1, "rgba(190,225,255,0)"],
  ]);
  const lampT = lampTex();
  const poolT = radialTex([
    [0, "rgba(255,255,255,1)"],
    [0.55, "rgba(255,255,255,.45)"],
    [1, "rgba(255,255,255,0)"],
  ]);
  const poleMat = new T.MeshStandardMaterial({ color: 0x8a93a3, roughness: 0.45, metalness: 0.6 });
  const masts: Mast[] = MASTS.map((p) => {
    const g = new T.Group();
    const pole = new T.Mesh(new T.CylinderGeometry(0.18, 0.34, MAST_H, 8), poleMat);
    pole.position.set(p[0], MAST_H / 2, p[1]);
    pole.castShadow = true;
    g.add(pole);
    const head = new T.Group();
    head.position.set(p[0], MAST_H + 0.9, p[1]);
    head.lookAt(p[0] * 0.2, 0, p[1] * 0.2);
    const hous = new T.Mesh(new T.BoxGeometry(3.4, 1.8, 0.4), poleMat);
    hous.position.z = -0.22;
    hous.castShadow = true;
    head.add(hous);
    const lamp = new T.MeshBasicMaterial({ map: lampT, toneMapped: false, color: 0x333a4a });
    const panel = new T.Mesh(new T.PlaneGeometry(3.2, 1.6), lamp);
    panel.position.z = 0.01;
    head.add(panel);
    g.add(head);
    const fl = new T.SpriteMaterial({ map: flare, blending: T.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false, fog: false, opacity: 0 });
    const fs = new T.Sprite(fl);
    fs.position.set(p[0] * 0.985, MAST_H + 0.9, p[1] * 0.97);
    fs.scale.set(16, 16, 1);
    g.add(fs);
    const ha = new T.SpriteMaterial({ map: halo, blending: T.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false, fog: false, opacity: 0, color: 0x9fd0f2 });
    const hs = new T.Sprite(ha);
    hs.position.copy(fs.position);
    hs.scale.set(46, 46, 1);
    g.add(hs);
    const start = new T.Vector3(p[0], MAST_H + 0.9, p[1]);
    const aim = new T.Vector3(p[0] * 0.25, 0, p[1] * 0.25);
    const len = start.distanceTo(aim);
    const coneM = new T.ShaderMaterial({
      vertexShader: CONE_V,
      fragmentShader: CONE_F,
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
      side: T.DoubleSide,
      uniforms: { uOp: { value: 0 }, uCol: { value: col("#dcecff") } },
    });
    const cone = new T.Mesh(new T.CylinderGeometry(1.4, 11, len, 24, 1, true), coneM);
    cone.position.copy(start).lerp(aim, 0.5);
    cone.lookAt(aim);
    cone.rotateX(-Math.PI / 2);
    cone.renderOrder = 5;
    g.add(cone);
    const poolM = new T.MeshBasicMaterial({ map: poolT, color: 0xfff1d8, transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false, opacity: 0 });
    const pool = new T.Mesh(new T.PlaneGeometry(L * 0.62, W * 0.7), poolM);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(Math.sign(p[0]) * L * 0.24, 0.04, Math.sign(p[1]) * W * 0.24);
    pool.renderOrder = 2;
    scene.add(pool);
    scene.add(g);
    return { lamp, flare: fl, fs, halo: ha, cone: coneM, pool: poolM };
  });

  /* Madrid rooftops and trees (no landmarks): a ring of low blocks, lit windows at dusk */
  const bldMats: THREE.MeshStandardMaterial[] = [];
  const winTex = [0, 1, 2, 3].map((b) => windowsTex(31 + b));
  const br = rng(23);
  const skyline = new T.Group();
  for (let k = 0; k < 110; k++) {
    const ang = br() * Math.PI * 2;
    const dist = 170 + br() * 150;
    const bw = 12 + br() * 26;
    const bd = 10 + br() * 14;
    const bh = 5 + br() * (dist > 240 ? 15 : 9);
    const wt = winTex[k % 4].clone();
    wt.repeat.set(bw / 14, bh / 20);
    wt.needsUpdate = true;
    const mat = new T.MeshStandardMaterial({ color: 0x7f8ea6, roughness: 1, emissive: 0xffffff, emissiveMap: wt, emissiveIntensity: 0 });
    const bm = new T.Mesh(new T.BoxGeometry(bw, bh, bd), mat);
    bm.position.set(Math.cos(ang) * dist * 1.15, bh / 2, Math.sin(ang) * dist);
    bm.rotation.y = -ang + Math.PI / 2 + (br() - 0.5) * 0.3;
    skyline.add(bm);
    bldMats.push(mat);
    if (br() < 0.35) {
      const tank = new T.Mesh(new T.BoxGeometry(2.4, 2.2, 2.4), mat);
      tank.position.set(bm.position.x + (br() - 0.5) * bw * 0.5, bh + 1.1, bm.position.z);
      skyline.add(tank);
    }
    if (br() < 0.2) {
      const ant = new T.Mesh(new T.CylinderGeometry(0.1, 0.1, 7, 4), darkMat);
      ant.position.set(bm.position.x, bh + 3.5, bm.position.z + 1);
      skyline.add(ant);
    }
  }
  scene.add(skyline);
  const treeMat = new T.MeshStandardMaterial({ color: 0x3f6a4a, roughness: 1, flatShading: true });
  const trunkMat = new T.MeshStandardMaterial({ color: 0x4a3c34, roughness: 1 });
  const tr2 = rng(5);
  for (let q = 0; q < 40; q++) {
    const a2 = tr2() * Math.PI * 2;
    const rr2 = 1 + tr2() * 0.5;
    const rx = (HL + 22) * rr2 * Math.cos(a2);
    const rz = (HW + 24) * rr2 * Math.sin(a2);
    if (rz > 0 && Math.abs(rx) < HL + 30) continue;
    const poplar = tr2() < 0.5;
    const th = poplar ? 9 + tr2() * 5 : 5 + tr2() * 3;
    const crown = new T.Mesh(poplar ? new T.ConeGeometry(1.6, th, 6) : new T.IcosahedronGeometry(2.6 + tr2() * 1.4, 0), treeMat);
    crown.position.set(rx, poplar ? th / 2 + 1 : th, rz);
    crown.castShadow = true;
    scene.add(crown);
    const tH = poplar ? 2 : th - 2;
    const trunk = new T.Mesh(new T.CylinderGeometry(0.2, 0.28, tH, 5), trunkMat);
    trunk.position.set(rx, tH / 2, rz);
    scene.add(trunk);
  }

  /* clouds: soft painted sprites tinted by the sky */
  const cloudTexs = [cloudTex(3, false), cloudTex(9, false), cloudTex(17, false)];
  const cloudLit = [cloudTex(3, true), cloudTex(9, true), cloudTex(17, true)];
  const clouds: { sp: THREE.Sprite; mat: THREE.SpriteMaterial; drift: number }[] = [];
  const cr = rng(41);
  for (let c = 0; c < 14; c++) {
    const mat = new T.SpriteMaterial({ map: cloudTexs[c % 3], transparent: true, depthWrite: false, fog: false, opacity: 0.9 });
    const sp = new T.Sprite(mat);
    const ca = cr() * Math.PI * 2;
    const cd = 420 + cr() * 160;
    const cw = 150 + cr() * 170;
    sp.scale.set(cw, cw * 0.36, 1);
    sp.position.set(Math.cos(ca) * cd, 60 + cr() * 110, Math.sin(ca) * cd);
    clouds.push({ sp, mat, drift: 0.5 + cr() });
    scene.add(sp);
  }

  /* rain */
  const RN = 600;
  const rainPos = new Float32Array(RN * 6);
  const rr = rng(77);
  for (let i = 0; i < RN; i++) {
    const x = (rr() - 0.5) * 120;
    const y = rr() * 50;
    const z = (rr() - 0.5) * 110 + 10;
    rainPos.set([x, y, z, x + 0.12, y - 1.3, z + 0.1], i * 6);
  }
  const rainGeo = new T.BufferGeometry();
  const rainAttr = new T.BufferAttribute(rainPos, 3);
  rainGeo.setAttribute("position", rainAttr);
  const rain = new T.LineSegments(rainGeo, new T.LineBasicMaterial({ color: 0xc9dcf2, transparent: true, opacity: 0.45, fog: false }));
  rain.visible = false;
  rain.frustumCulled = false;
  scene.add(rain);

  /* gold glints from the stand on our goals */
  const GN = 260;
  const gPos = new Float32Array(GN * 3);
  const gVel: [number, number, number][] = [];
  const glintGeo = new T.BufferGeometry();
  const glintAttr = new T.BufferAttribute(gPos, 3);
  glintGeo.setAttribute("position", glintAttr);
  const glintMat = new T.PointsMaterial({
    color: 0xffc659,
    size: 0.42,
    transparent: true,
    opacity: 0,
    blending: T.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    map: radialTex(
      [
        [0, "rgba(255,255,255,1)"],
        [0.4, "rgba(255,230,160,.8)"],
        [1, "rgba(255,200,90,0)"],
      ],
      32,
    ),
  });
  const glints = new T.Points(glintGeo, glintMat);
  glints.frustumCulled = false;
  scene.add(glints);

  /* lights */
  const hemi = new T.HemisphereLight(0xbfdfff, 0x3a4a3a, 0.8);
  scene.add(hemi);
  const sun = new T.DirectionalLight(0xfff4dc, 2.5);
  sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 50, bottom: -50, near: 1, far: 400 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.05;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  const flood = new T.DirectionalLight(0xeef4ff, 0);
  flood.position.set(-8, 46, 22);
  flood.castShadow = true;
  Object.assign(flood.shadow.camera, { left: -45, right: 45, top: 40, bottom: -40, near: 1, far: 140 });
  flood.shadow.camera.updateProjectionMatrix();
  flood.shadow.mapSize.set(1024, 1024);
  flood.shadow.bias = -0.0005;
  flood.shadow.normalBias = 0.05;
  flood.shadow.radius = 5;
  scene.add(flood, flood.target);

  /* players: low-poly lit figures */
  const skin = new T.MeshStandardMaterial({ color: 0xc89878, roughness: 0.8 });
  const hair = new T.MeshStandardMaterial({ color: 0x2a211d, roughness: 0.9 });
  const shortsM = new T.MeshStandardMaterial({ color: 0xf4f7fb, roughness: 0.7 });
  const sockM = new T.MeshStandardMaterial({ color: 0x0c1733, roughness: 0.8 });
  const gkSleeve = new T.MeshStandardMaterial({ color: 0xffc659, roughness: 0.6 });
  const blobT = radialTex(
    [
      [0, "rgba(0,0,0,.55)"],
      [1, "rgba(0,0,0,0)"],
    ],
    64,
  );
  const blobMat = new T.MeshBasicMaterial({ map: blobT, transparent: true, depthWrite: false, opacity: 0.8 });
  const figGeo = {
    sock: new T.BoxGeometry(0.15, 0.48, 0.17),
    leg: new T.BoxGeometry(0.16, 0.3, 0.18),
    shorts: new T.BoxGeometry(0.46, 0.26, 0.28),
    body: new T.CylinderGeometry(0.27, 0.22, 0.62, 8),
    arm: new T.CylinderGeometry(0.07, 0.06, 0.55, 6),
    head: new T.IcosahedronGeometry(0.15, 1),
    cap: new T.SphereGeometry(0.155, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    blob: new T.PlaneGeometry(1.6, 1.6),
  };
  const figs = new Map<string, Fig>();
  const makeFig = (p: SceneFigure): Fig => {
    const g = new T.Group();
    const S = 1.45;
    const shirt = new T.MeshStandardMaterial({ color: p.gk ? 0x1d2c57 : 0x8cc4ec, roughness: 0.55, emissive: 0xffc659, emissiveIntensity: 0 });
    const part = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
      const m = new T.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      g.add(m);
      return m;
    };
    part(figGeo.sock, sockM, -0.12, 0.24, 0);
    part(figGeo.sock, sockM, 0.12, 0.24, 0);
    part(figGeo.leg, skin, -0.12, 0.62, 0);
    part(figGeo.leg, skin, 0.12, 0.62, 0);
    part(figGeo.shorts, shortsM, 0, 0.86, 0);
    part(figGeo.body, shirt, 0, 1.28, 0);
    const sleeve = p.gk ? gkSleeve : shirt;
    const la = part(figGeo.arm, sleeve, -0.34, 1.26, 0);
    la.rotation.z = -0.16;
    const ra = part(figGeo.arm, sleeve, 0.34, 1.26, 0);
    ra.rotation.z = 0.16;
    part(figGeo.head, skin, 0, 1.78, 0);
    part(figGeo.cap, hair, 0, 1.8, 0);
    g.scale.setScalar(S);
    const blob = new T.Mesh(figGeo.blob, blobMat);
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.035;
    blob.scale.setScalar(1 / S);
    g.add(blob);
    scene.add(g);
    return { g, shirt, arms: [la, ra], pos: new T.Vector3(), tgt: new T.Vector3(), data: p, gone: false };
  };

  /* views */
  const views: ViewRt[] = o.views.map((v, i) => {
    const dpr = dprOf(v);
    v.canvas.width = Math.max(1, Math.round(v.w * dpr));
    v.canvas.height = Math.max(1, Math.round(v.h * dpr));
    return {
      cfg: v,
      dpr,
      cam: new T.PerspectiveCamera(50, 1, 0.5, 2400),
      ctx: ctx2d(v.canvas),
      st: v.state,
      dirty: true,
      par: [0, 0],
      parS: [0, 0],
      i,
      plateEls: new Map(),
      synced: false,
    };
  });

  const win = window as Win;
  const shot = !!o.shot || !!win.__SHOT;
  let reduced = !!o.reduced || shot;
  interface GoalAnim {
    t0: number;
    ours: boolean;
    id: string | null;
    mvp: boolean;
  }
  const anim: { ignite: { t0: number } | null; goal: GoalAnim | null; live: number; now: number } = {
    ignite: null,
    goal: null,
    live: o.live ?? 0,
    now: performance.now(),
  };
  const isLiveView = (v: ViewRt) => v.i === anim.live;

  const tmpV = new T.Vector3();
  const RAD = Math.PI / 180;
  const rigCam = (v: ViewRt) => {
    const r = v.cfg.rig;
    const cam = v.cam;
    const { w, h } = v.cfg;
    let dol = 0;
    if (anim.goal && anim.goal.ours && !anim.goal.mvp && isLiveView(v) && !reduced) {
      const gt = (anim.now - anim.goal.t0) / 1000;
      dol = gt < 1.1 ? ease(gt / 1.1) : gt < 3.4 ? 1 : gt < 4.6 ? 1 - ease((gt - 3.4) / 1.2) : 0;
    }
    cam.fov = r.fov;
    cam.aspect = w / h;
    const yaw = r.yaw * RAD;
    const fx = Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const rx = Math.cos(yaw);
    const rz = Math.sin(yaw);
    let px = r.pos[0] + rx * v.parS[0] * 1.6;
    let py = r.pos[1] - v.parS[1] * 0.9;
    let pz = r.pos[2] + rz * v.parS[0] * 1.6;
    /* goal: a short dolly towards the rival goal (+x) */
    const gx = HL - px;
    const gz = -pz;
    const gl = Math.hypot(gx, gz) || 1;
    const dd = dol * Math.min(16, gl * 0.35);
    px += (gx / gl) * dd;
    pz += (gz / gl) * dd;
    py -= dol * 2.5;
    const tp = Math.tan(r.pitch * RAD);
    let lx = fx;
    let lz = fz;
    if (dol) {
      const ax = HL - 6 - px;
      const az = -pz;
      const al = Math.hypot(ax, az) || 1;
      lx = fx + (ax / al - fx) * dol * 0.6;
      lz = fz + (az / al - fz) * dol * 0.6;
      const ll = Math.hypot(lx, lz);
      lx /= ll;
      lz /= ll;
    }
    cam.position.set(px, py, pz);
    cam.lookAt(px + lx * 100, py + tp * 100, pz + lz * 100);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
  };

  let lastBoard = "";
  const apply = (v: ViewRt): Lighting => {
    const st = v.st;
    const lt0 = lightingOf(st.at, st.weather);
    const { el, kind: wx, sky: s } = lt0;
    skyU.uTop.value.set(s.top);
    skyU.uMid.value.set(s.mid);
    skyU.uHor.value.set(s.hor);
    skyU.uSunCol.value.set(s.sun);
    skyU.uNight.value = s.night;
    skyU.uCloud.value = s.cloud;
    /* sun direction: through the lens at the sun's screen point, then honest elevation for the light */
    const sxy = sunScreen(lt0.minutes, el, v.cfg.rig);
    tmpV.set(sxy.x * 2 - 1, 1 - sxy.y * 2, 0.5).unproject(v.cam).sub(v.cam.position).normalize();
    skyU.uSunDir.value.copy(tmpV);
    skyU.uSunVis.value = smooth(-2.5, 0.5, el);
    const hz = Math.hypot(tmpV.x, tmpV.z) || 1;
    const ce = Math.cos(Math.max(el, 1.2) * RAD);
    const se = Math.sin(Math.max(el, 1.2) * RAD);
    sun.position.set((tmpV.x / hz) * ce * 200, se * 200, (tmpV.z / hz) * ce * 200);
    sun.color.set(s.sun);
    sun.intensity = 3.1 * s.sunI * (1 + 0.3 * smooth(20, 40, el));
    sun.shadow.radius = el > 25 ? 1.2 : 4;
    // under rain the light is diffuse: no hard sun shadows (nor beams through the stand's gaps)
    sun.castShadow = s.sunI > 0.05 && wx !== "lluvia";
    hemi.color.set(s.mid);
    hemi.groundColor.set(mix("#2b3328", "#556b4a", s.day));
    hemi.intensity = 0.12 + 0.95 * smooth(-10, 22, el) - s.cloud * 0.1;
    fog.color.set(mix(s.hor, s.mid, 0.25));
    fog.near = 140;
    fog.far = 640 - s.cloud * 200;
    /* floodlights */
    const fl = floodLevels(st.floodlights);
    let P = fl.power;
    let igT = -1;
    if (anim.ignite && isLiveView(v) && !reduced) {
      igT = (anim.now - anim.ignite.t0) / 1000;
      P = ignitePower(igT);
      if (igT > 1.6) anim.ignite = null;
    }
    const Lp = (P[0] + P[1] + P[2] + P[3]) / 4;
    const nightK = 1 - s.day * 0.82;
    masts.forEach((m, i) => {
      const p = P[i];
      let burst = 0;
      if (igT >= 0) {
        const bt = igT - IGNITE_AT[i];
        if (bt > 0 && bt < 0.6) burst = Math.sin((bt / 0.6) * Math.PI) * 1.2;
      }
      const pre = p ? 0 : fl.pre;
      m.lamp.color.setScalar(0.18 + pre * 0.32 + p * 1.9);
      m.flare.opacity = p * (0.35 + 0.65 * nightK) + burst * 0.5 + pre * 0.07;
      m.fs.scale.setScalar(16 + burst * 26);
      m.halo.opacity = p * 0.2 * nightK + burst * 0.15 + pre * 0.05;
      m.cone.uniforms.uOp.value = p * 0.07 * nightK;
      m.pool.opacity = p * 0.26 * nightK;
    });
    skyU.uGlow.value = Lp * s.night;
    flood.intensity = Lp * (1.9 * nightK + 0.2);
    flood.castShadow = Lp > 0.3 && s.sunI < 0.25;
    /* materials */
    turfMat.color.setScalar(0.42 + 0.58 * smooth(-6, 8, el) + 0.3 * Lp * s.night);
    turfMat.roughness = wx === "lluvia" ? 0.45 : 0.9;
    lineMat.emissiveIntensity = 0.03 + 0.1 * Lp * s.night;
    groundMat.color.set(mix("#252b38", "#6a7078", s.day));
    concMat.color.set(mix("#3d4352", "#a5aab0", s.day));
    underMat.color.set(Lp > 0.1 || s.night > 0.6 ? "#fff1d6" : "#59606e");
    crestMat.emissiveIntensity = 0.32 * s.night + 0.05;
    fMat.emissiveIntensity = 0.2 * s.night;
    for (const b of boards) b.mat.emissiveIntensity = 0.12 + 0.55 * s.night;
    const bCol = mix(mix("#0e1630", "#273455", 0.3), mix(s.hor, "#8996ab", 0.55), s.day);
    for (const m of bldMats) {
      m.emissiveIntensity = 0.95 * s.night;
      m.color.set(bCol);
    }
    treeMat.color.set(mix("#16242a", "#3f6a4a", s.day));
    /* weather */
    const cl = cloudAmount(st.weather);
    clouds.forEach((c, i) => (c.sp.visible = i / clouds.length < cl));
    let ctint = mix(mix(mix(s.mid, "#1c2747", 0.5), "#f1f4f9", s.day), mix(s.sun, "#ff9f8a", 0.25), s.golden * 0.6);
    if (wx === "lluvia") ctint = mix(ctint, mix("#232c46", "#8f9aad", s.day), 0.6);
    const litC = s.golden > 0.25 && wx !== "lluvia";
    if (litC) ctint = mix(s.sun, "#ffe9c8", 0.35);
    clouds.forEach((c, i) => {
      const mp = (litC ? cloudLit : cloudTexs)[i % 3];
      if (c.mat.map !== mp) {
        c.mat.map = mp;
        c.mat.needsUpdate = true;
      }
      c.mat.color.set(ctint);
      c.mat.opacity = wx === "lluvia" ? 0.97 : 0.9;
    });
    rain.visible = wx === "lluvia";
    /* boards */
    const sponsors = st.sponsors?.length ? st.sponsors : SPONSORS;
    const bk = `${st.board ?? ""}|${st.boardKind ?? ""}|${sponsors.join("·")}`;
    if (bk !== lastBoard) {
      lastBoard = bk;
      boardDraw(boardC, st.board, st.boardKind, sponsors);
      for (const b of boards) {
        b.tex.image = boardC;
        b.tex.needsUpdate = true;
      }
    }
    /* players */
    syncFigs(v, placeFigures(st.figures));
    const rimC = mix("#6CABDD", s.sun, 0.25);
    const rimK = 0.1 + s.golden * 0.06 + s.night * 0.06;
    for (const [id, f] of figs) {
      const gold = (anim.goal?.ours && anim.goal.id === id) || f.data.tag === "mvp";
      if (!gold) {
        f.shirt.emissive.set(rimC);
        f.shirt.emissiveIntensity = rimK;
      } else f.shirt.emissive.set(0xffc659);
    }
    const aw = !!st.away;
    seatMat.color.set(aw ? "#4f7f63" : "#6CABDD");
    wallMat.color.set(aw ? "#c3c8bb" : "#dfe3ea");
    stripeMat.color.set(aw ? "#7c8a76" : "#6CABDD");
    crest.visible = !aw && crestReady;
    const fm = aw ? fasciaAway : fasciaHome;
    if (fMat.map !== fm) {
      fMat.map = fm;
      fMat.emissiveMap = fm;
      fMat.needsUpdate = true;
    }
    return lt0;
  };

  const TUNNEL = { x: -6, z: HW + 2.6 };
  const syncFigs = (v: ViewRt, list: SceneFigure[]) => {
    const animate = isLiveView(v) && !reduced && v.cfg.walk !== false;
    const walkIn = animate && v.synced;
    v.synced = true;
    const seen = new Set<string>();
    for (const p of list) {
      if (p.leaving) continue;
      seen.add(p.id);
      let f = figs.get(p.id);
      if (!f) {
        f = makeFig(p);
        figs.set(p.id, f);
        if (walkIn) f.pos.set(TUNNEL.x, 0, TUNNEL.z);
        else f.pos.set(p.x, 0, p.z);
      }
      f.gone = false;
      f.g.visible = true;
      f.data = p;
      f.tgt.set(p.x, 0, p.z);
      if (!animate) f.pos.copy(f.tgt);
      if (!animate || f.g.position.lengthSq() === 0) f.g.position.set(f.pos.x, 0, f.pos.z);
      f.shirt.color.set(p.gk ? 0x1d2c57 : 0x8cc4ec);
    }
    for (const [id, f] of figs) {
      if (seen.has(id)) continue;
      const leaving = list.find((p) => p.id === id && p.leaving);
      if (leaving) f.data = leaving;
      if (animate && f.g.visible && !f.gone) {
        f.gone = true;
        f.tgt.set(f.pos.x, 0, HW + 3);
      } else if (!animate) {
        f.g.visible = false;
        f.gone = true;
      }
    }
  };

  const stepFigs = (dt: number) => {
    let moving = false;
    for (const [id, f] of figs) {
      if (!f.g.visible) continue;
      const d = tmpV.copy(f.tgt).sub(f.pos);
      const dist = d.length();
      let bob = 0;
      if (dist > 0.05) {
        moving = true;
        f.pos.addScaledVector(d.normalize(), Math.min(dist, dt * 6.5));
        f.g.rotation.y = Math.atan2(d.x, d.z);
        bob = Math.abs(Math.sin(anim.now / 90)) * 0.08;
      } else {
        f.g.rotation.y += (0.25 - f.g.rotation.y) * Math.min(1, dt * 6);
        if (f.gone) f.g.visible = false;
      }
      let lift = 0;
      let glow = 0;
      if (anim.goal?.ours && anim.goal.id === id) {
        const gt = (anim.now - anim.goal.t0) / 1000;
        const k = reduced ? 1 : gt < 0.5 ? ease(gt / 0.5) : gt < 3.8 ? 1 : Math.max(0, 1 - (gt - 3.8) / 0.8);
        lift = k * 0.9 * (1 + 0.08 * Math.sin(gt * 6));
        glow = k;
        if (k > 0.01 && gt < 4.6) moving = true;
      }
      if (f.data.tag === "mvp") glow = Math.max(glow, 0.55);
      f.g.position.set(f.pos.x, lift + bob, f.pos.z);
      if (glow > 0.01) f.shirt.emissiveIntensity = glow * 0.9;
      f.arms[0].rotation.z = -0.16 - glow * 2.3;
      f.arms[1].rotation.z = 0.16 + glow * 2.3;
    }
    return moving;
  };

  const stepFx = (dt: number) => {
    let busy = false;
    for (const n of nets) {
      const t = (anim.now - n.t0) / 1000;
      if (t > 2.4) continue;
      busy = true;
      const a = n.attr.array as Float32Array;
      const b = n.base;
      for (let i = 0; i < n.attr.count; i++) {
        const x = b[i * 3];
        const y = b[i * 3 + 1];
        const r = Math.hypot(x, y - 1);
        a[i * 3 + 2] = b[i * 3 + 2] + Math.sin(r * 3 - t * 14) * Math.exp(-t * 2.2) * 0.35 * Math.max(0, 1 - r / 4);
      }
      n.attr.needsUpdate = true;
    }
    if (glintMat.opacity > 0 || anim.goal?.ours) {
      const gt = anim.goal ? (anim.now - anim.goal.t0) / 1000 : 99;
      glintMat.opacity = anim.goal?.ours ? (gt < 0.3 ? gt / 0.3 : gt < 3.6 ? 1 : Math.max(0, 1 - (gt - 3.6) / 0.9)) : 0;
      for (let i = 0; i < GN; i++) {
        const vv = gVel[i];
        if (!vv) continue;
        gPos[i * 3] += vv[0] * dt + Math.sin(anim.now / 300 + i) * dt * 0.6;
        gPos[i * 3 + 1] += vv[1] * dt;
        gPos[i * 3 + 2] += vv[2] * dt;
        vv[1] -= 3.2 * dt;
        if (gPos[i * 3 + 1] < 0.05) {
          gPos[i * 3 + 1] = 0.05;
          vv[0] = vv[1] = vv[2] = 0;
        }
      }
      glintAttr.needsUpdate = true;
      busy = true;
    }
    if (rain.visible) {
      for (let j = 0; j < RN; j++) {
        let y0 = rainPos[j * 6 + 1] - dt * 34;
        if (y0 < 0) y0 += 50;
        rainPos[j * 6 + 1] = y0;
        rainPos[j * 6 + 4] = y0 - 1.3;
      }
      rainAttr.needsUpdate = true;
      busy = true;
    }
    for (const c of clouds) c.sp.position.x += dt * c.drift * 0.6;
    /* fans: hop on our goals */
    if (anim.goal?.ours) {
      const gt = (anim.now - anim.goal.t0) / 1000;
      for (let f = 0; f < FANS; f++) {
        const fb = fanBase[f];
        const hop = gt < 3.6 ? Math.abs(Math.sin(gt * 7 + fb[3] * 6)) * 0.35 : 0;
        m4.makeTranslation(fb[0], fb[1] + hop, fb[2]);
        fans.setMatrixAt(f, m4);
      }
      fans.instanceMatrix.needsUpdate = true;
      busy = true;
    }
    return busy;
  };

  const plates = (v: ViewRt) => {
    const el = v.cfg.plates;
    if (!el) return;
    const { w, h } = v.cfg;
    for (const [id, f] of figs) {
      let node = v.plateEls.get(id);
      const vis = f.g.visible && !f.gone && f.data.plate !== "none";
      if (!node) {
        node = document.createElement("span");
        el.appendChild(node);
        v.plateEls.set(id, node);
      }
      const look = plateLook(f.data, !!(anim.goal?.ours && anim.goal.id === id));
      const cls = look.cls + (vis ? "" : " off");
      if (node.className !== cls) node.className = cls;
      fillPlate(node, look);
      tmpV.set(f.g.position.x, f.g.position.y + 3.15, f.g.position.z).project(v.cam);
      const px = plateX(((tmpV.x + 1) / 2) * w, w);
      node.style.transform = `translate(${px.toFixed(1)}px,${(((1 - tmpV.y) / 2) * h).toFixed(1)}px)`;
    }
  };

  const renderView = (v: ViewRt) => {
    rigCam(v);
    apply(v);
    const w = Math.round(v.cfg.w * v.dpr);
    const h = Math.round(v.cfg.h * v.dpr);
    R.setViewport(0, 0, w, h);
    R.setScissor(0, 0, w, h);
    R.setScissorTest(true);
    R.render(scene, v.cam);
    v.ctx.drawImage(glc, 0, glc.height - h, w, h, 0, 0, w, h);
    plates(v);
    v.dirty = false;
    o.onRender?.(v.i);
  };

  let raf = 0;
  let last = performance.now();
  let running = true;
  const kick = () => {
    if (running && !raf && !disposed && !lost) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  };
  const frame = (now: number) => {
    raf = 0;
    if (!running || disposed || lost) return;
    if (document.hidden) {
      setTimeout(kick, 500);
      return;
    }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    anim.now = now;
    const moving = reduced ? false : stepFigs(dt);
    const fx = reduced ? false : stepFx(dt);
    if (reduced) stepFigs(10);
    let work = false;
    for (const v of views) {
      const par = Math.abs(v.par[0] - v.parS[0]) + Math.abs(v.par[1] - v.parS[1]) > 0.002;
      v.parS[0] += (v.par[0] - v.parS[0]) * Math.min(1, dt * 4);
      v.parS[1] += (v.par[1] - v.parS[1]) * Math.min(1, dt * 4);
      const live = isLiveView(v) && !reduced && !!(anim.ignite || anim.goal || moving || fx || par);
      if (v.dirty || live) renderView(v);
      if (live) work = true;
    }
    if (anim.goal && !reduced && anim.now - anim.goal.t0 > 5200) {
      anim.goal = null;
      work = true;
      for (const v of views) v.dirty = true;
    }
    if (!shot && (work || views.some((v) => v.dirty))) raf = requestAnimationFrame(frame);
  };
  const dirtyAll = () => {
    for (const v of views) v.dirty = true;
    kick();
  };
  kick();

  const startGoal = (i: number, ours: boolean, id: string | null, mvp: boolean) => {
    anim.live = i;
    const t0 = performance.now();
    anim.goal = { t0, ours, id, mvp };
    if (!mvp) for (const n of nets) if ((ours && n.side > 0) || (!ours && n.side < 0)) n.t0 = t0;
    if (ours)
      for (let k = 0; k < GN; k++) {
        gPos[k * 3] = (Math.random() - 0.5) * 32;
        gPos[k * 3 + 1] = 9 + Math.random() * 3;
        gPos[k * 3 + 2] = SZ - 1 - Math.random() * 6;
        gVel[k] = [(Math.random() - 0.3) * 4, 2 + Math.random() * 4, 6 + Math.random() * 6];
      }
    const mine = anim.goal;
    if (reduced) {
      dirtyAll();
      setTimeout(() => {
        if (anim.goal === mine) {
          anim.goal = null;
          dirtyAll();
        }
      }, 4200);
      return;
    }
    kick();
  };

  const disposeScene = () => {
    const seen = new Set<unknown>();
    scene.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.geometry && !seen.has(m.geometry)) {
        seen.add(m.geometry);
        m.geometry.dispose();
      }
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      for (const mat of mats) {
        if (seen.has(mat)) continue;
        seen.add(mat);
        for (const val of Object.values(mat)) {
          if (val instanceof THREE.Texture && !seen.has(val)) {
            seen.add(val);
            val.dispose();
          }
        }
        mat.dispose();
      }
    });
    for (const t of [...cloudTexs, ...cloudLit, fasciaAway, fasciaHome, ...winTex, nt, lt, boardT]) t.dispose();
  };

  return {
    setState(i, st) {
      const v = views[i];
      if (!v) return;
      v.st = st;
      v.dirty = true;
      kick();
    },
    resize(i, w, h) {
      const v = views[i];
      if (!v || (v.cfg.w === w && v.cfg.h === h) || w < 1 || h < 1) return;
      v.cfg.w = w;
      v.cfg.h = h;
      v.cfg.canvas.width = Math.round(w * v.dpr);
      v.cfg.canvas.height = Math.round(h * v.dpr);
      fitGl();
      dirtyAll();
    },
    setLive(i) {
      anim.live = i;
    },
    ignite(i) {
      if (i != null) anim.live = i;
      if (!reduced) anim.ignite = { t0: performance.now() };
      dirtyAll();
    },
    goal(i, ours, scorerId) {
      startGoal(i, ours, ours ? (scorerId ?? null) : null, false);
    },
    mvp(i, id) {
      startGoal(i, true, id, true);
    },
    pointer(i, nx, ny) {
      const v = views[i];
      if (v && !reduced) {
        v.par[0] = nx;
        v.par[1] = ny;
        kick();
      }
    },
    project(i, x, y, z) {
      const v = views[i];
      if (!v) return null;
      rigCam(v);
      tmpV.set(x, y, z).project(v.cam);
      if (tmpV.z > 1) return null;
      return { x: ((tmpV.x + 1) / 2) * v.cfg.w, y: ((1 - tmpV.y) / 2) * v.cfg.h };
    },
    setReduced(r) {
      reduced = r || shot;
      dirtyAll();
    },
    pause() {
      running = false;
      cancelAnimationFrame(raf);
      raf = 0;
    },
    resume() {
      if (disposed || lost) return;
      running = true;
      dirtyAll();
    },
    dispose() {
      disposed = true;
      running = false;
      cancelAnimationFrame(raf);
      glc.removeEventListener("webglcontextlost", onLost);
      try {
        disposeScene();
        R.dispose();
        R.forceContextLoss();
      } catch {
        /* already gone */
      }
      for (const v of views) for (const n of v.plateEls.values()) n.remove();
    },
  };
}

