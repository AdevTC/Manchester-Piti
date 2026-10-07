// The night (or day) stadium around the board: grass with mowing stripes and chalk lines, goals
// with nets, LED ribbon boards, low stands with an instanced crowd (phone lights flickering), four
// floodlight masts with lamp panels, glare and fake volumetric cones, a sky dome and the lights.
import {
  AdditiveBlending,
  BackSide,
  BoxGeometry,
  CircleGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  FogExp2,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Points,
  RepeatWrapping,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  UniformsLib,
  UniformsUtils,
  Vector3,
  type Material,
  type Object3D,
  type Scene,
  type Texture,
  type WebGLRenderer,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  BOARD_GAP,
  C,
  GOAL_D,
  GOAL_H,
  GOAL_W,
  MAST_H,
  PITCH_L,
  PITCH_W,
  RUNOFF,
  STAND_DEPTH,
  STAND_GAP,
  STAND_RISE,
  STAND_TIERS,
  lerp,
  rng,
} from "./constants";
import { canvas, drawBoard, fadeTexture, flareTexture, glowTexture, grassTexture, groundFadeTexture, lampTexture, makeTexture, netTexture, poolTexture, seatsTexture } from "./textures";
import type { Quality } from "./types";

const HW = PITCH_W / 2, HL = PITCH_L / 2;

/** Thin flat ribbons for the chalk lines (crisper than any texture). */
function linesGeometry(): BufferGeometry {
  const pos: number[] = [], idx: number[] = [];
  const Y = 0.018, W = 0.13;
  const seg = (ax: number, az: number, bx: number, bz: number, w = W) => {
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz) || 1;
    const nx = (-dz / len) * (w / 2), nz = (dx / len) * (w / 2);
    const b = pos.length / 3;
    pos.push(ax + nx, Y, az + nz, ax - nx, Y, az - nz, bx + nx, Y, bz + nz, bx - nx, Y, bz - nz);
    idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
  };
  const arc = (cx: number, cz: number, r: number, a0: number, a1: number, n = 48) => {
    for (let i = 0; i < n; i++) {
      const t0 = a0 + ((a1 - a0) * i) / n, t1 = a0 + ((a1 - a0) * (i + 1)) / n;
      seg(cx + Math.cos(t0) * r, cz + Math.sin(t0) * r, cx + Math.cos(t1) * r, cz + Math.sin(t1) * r);
    }
  };
  const spot = (cx: number, cz: number, r: number) => {
    const b = pos.length / 3;
    pos.push(cx, Y, cz);
    for (let i = 0; i <= 16; i++) pos.push(cx + Math.cos((i / 16) * Math.PI * 2) * r, Y, cz + Math.sin((i / 16) * Math.PI * 2) * r);
    for (let i = 0; i < 16; i++) idx.push(b, b + 2 + i, b + 1 + i);
  };
  // touchlines, goal lines (slightly wider overlap at the corners)
  seg(-HW, -HL, HW, -HL);
  seg(HW, -HL, HW, HL);
  seg(HW, HL, -HW, HL);
  seg(-HW, HL, -HW, -HL);
  seg(-HW, 0, HW, 0);
  arc(0, 0, 6, 0, Math.PI * 2, 72);
  spot(0, 0, 0.22);
  for (const s of [1, -1]) {
    const gz = s * HL;
    // penalty area 24 × 9, goal area 12 × 3, spot at 8 m
    seg(-12, gz, -12, gz - s * 9);
    seg(-12, gz - s * 9, 12, gz - s * 9);
    seg(12, gz - s * 9, 12, gz);
    seg(-6, gz, -6, gz - s * 3);
    seg(-6, gz - s * 3, 6, gz - s * 3);
    seg(6, gz - s * 3, 6, gz);
    spot(0, gz - s * 8, 0.18);
    // penalty arc outside the area
    const a = Math.acos(1 / 6) ;
    if (s > 0) arc(0, gz - 8, 6, -Math.PI / 2 - (Math.PI / 2 - a), -Math.PI / 2 + (Math.PI / 2 - a), 24);
    else arc(0, gz + 8, 6, Math.PI / 2 - (Math.PI / 2 - a), Math.PI / 2 + (Math.PI / 2 - a), 24);
    // corner arcs
    arc(-HW, gz, 1, s > 0 ? -Math.PI / 2 : 0, s > 0 ? 0 : Math.PI / 2, 10);
    arc(HW, gz, 1, s > 0 ? Math.PI : Math.PI / 2, s > 0 ? Math.PI * 1.5 : Math.PI, 10);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new Float32BufferAttribute(new Array(pos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.setIndex(idx);
  return g;
}

const CROWD_VERT = /* glsl */ `
attribute vec3 color;
attribute float seed;
uniform float uTime, uScale, uSize, uMotion;
varying vec3 vColor;
varying float vSeed;
#include <fog_pars_vertex>
void main(){
  vColor = color;
  vSeed = seed;
  vec3 p = position;
  // a few sections bounce, the rest sway
  float jump = step(0.82, fract(seed * 7.13)) * max(0.0, sin(uTime * 5.0 + seed * 40.0));
  p.y += (sin(uTime * 1.7 + seed * 60.0) * 0.04 + jump * 0.16) * uMotion;
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize * uScale / -mvPosition.z;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const CROWD_FRAG = /* glsl */ `
uniform float uTime, uLight, uDay, uPhones;
varying vec3 vColor;
varying float vSeed;
#include <fog_pars_fragment>
void main(){
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  // head + shoulders silhouette
  float head = 1.0 - smoothstep(0.32, 0.42, length(q - vec2(0.0, -0.42)));
  float body = 1.0 - smoothstep(0.55, 0.66, length((q - vec2(0.0, 0.42)) * vec2(0.9, 1.5)));
  float a = max(head, body);
  if (a < 0.05) discard;
  vec3 col = vColor * (uLight * (0.55 + 0.45 * (1.0 - gl_PointCoord.y)));
  // phone lights: ~4% of the crowd, blinking at their own pace (night only)
  float phone = step(0.958, vSeed) * step(0.35, sin(uTime * (1.2 + vSeed * 3.0) + vSeed * 300.0)) * uPhones * (1.0 - uDay);
  col = mix(col, vec3(1.6, 1.7, 1.9), phone * head);
  gl_FragColor = vec4(col, a);
  #include <fog_fragment>
}`;

const CONE_VERT = /* glsl */ `
varying vec3 vN; varying vec3 vV; varying float vH;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  vH = uv.y;
  gl_Position = projectionMatrix * mv;
}`;
const CONE_FRAG = /* glsl */ `
uniform float uOpacity, uTime; uniform vec3 uColor;
varying vec3 vN; varying vec3 vV; varying float vH;
void main(){
  float edge = pow(abs(dot(vN, vV)), 2.2);
  float along = pow(vH, 1.6) * 0.9 + 0.1 * vH;
  float dust = 0.85 + 0.15 * sin(vH * 40.0 - uTime * 0.6);
  gl_FragColor = vec4(uColor * edge * along * dust * uOpacity, 1.0);
}`;

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w; }`;
const SKY_FRAG = /* glsl */ `
uniform float uDay, uGlow; uniform vec3 uFog; varying vec3 vDir;
float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
void main(){
  float h = clamp(vDir.y, -0.2, 1.0);
  vec3 nTop = vec3(0.004, 0.012, 0.035), nHor = vec3(0.03, 0.07, 0.16);
  vec3 night = mix(nHor, nTop, smoothstep(0.0, 0.55, h));
  // stadium light pollution, a sky-blue haze over the stands
  night += vec3(0.16, 0.32, 0.5) * uGlow * exp(-max(h, 0.0) * 9.0) * 0.5;
  vec3 c = floor(vDir * 380.0);
  float star = step(0.9965, hash(c)) * smoothstep(0.12, 0.5, h) * (1.0 - uGlow * 0.4);
  night += vec3(star) * 0.9;
  vec3 dTop = vec3(0.16, 0.42, 0.78), dHor = vec3(0.78, 0.88, 0.96);
  vec3 day = mix(dHor, dTop, smoothstep(0.0, 0.6, h));
  vec3 col = mix(night, day, uDay);
  // the horizon melts into the fog (no visible ground edge)
  col = mix(uFog, col, smoothstep(-0.02, 0.16, vDir.y));
  gl_FragColor = vec4(col, 1.0);
}`;

export interface StadiumState {
  /** 0 night … 1 day. */
  day: number;
  /** Per mast power (0..1) — the intro switches them on one by one. */
  power: [number, number, number, number];
  time: number;
  /** Vertical field of view of the camera (deg), to size the crowd points. */
  fov: number;
  /** Camera position: the upper stand between the camera and the pitch is hidden (broadcast trick). */
  cam: Vector3;
}

export interface Stadium {
  group: Group;
  key: DirectionalLight;
  update(s: StadiumState): void;
  setBoard(messages: string[]): void;
  setQuality(q: Quality, renderer: WebGLRenderer): void;
  dispose(): void;
}

export function buildStadium(scene: Scene, renderer: WebGLRenderer, quality: Quality, board: string[]): Stadium {
  const group = new Group();
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x);
  const aniso = renderer.capabilities.getMaxAnisotropy();

  // ---------- sky + fog ----------
  const skyMat = keep(new ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: BackSide, depthWrite: false, uniforms: { uDay: { value: 0 }, uGlow: { value: 1 }, uFog: { value: new Color(0x060f24) } } }));
  const sky = new Mesh(keep(new SphereGeometry(400, 32, 16)), skyMat);
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  group.add(sky);
  const fog = new FogExp2(0x060f24, 0.0055);
  scene.fog = fog;

  // ---------- ground + grass + lines ----------
  const groundMat = keep(new MeshStandardMaterial({ color: 0x0b1530, roughness: 0.95, alphaMap: keep(groundFadeTexture()), transparent: true, depthWrite: false }));
  const ground = new Mesh(keep(new CircleGeometry(150, 48)), groundMat);
  ground.renderOrder = -5;
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  group.add(ground);
  const grassTex = keep(grassTexture(aniso));
  const grassMat = keep(new MeshStandardMaterial({ map: grassTex, roughness: 0.92, metalness: 0 }));
  const grass = new Mesh(keep(new PlaneGeometry(PITCH_W + RUNOFF * 2, PITCH_L + RUNOFF * 2)), grassMat);
  grass.rotation.x = -Math.PI / 2;
  grass.receiveShadow = true;
  group.add(grass);
  const lineMat = keep(new MeshStandardMaterial({ color: 0xf2f6ff, roughness: 0.7, emissive: 0xffffff, emissiveIntensity: 0.08, polygonOffset: true, polygonOffsetFactor: -2 }));
  const lines = new Mesh(keep(linesGeometry()), lineMat);
  lines.receiveShadow = true;
  group.add(lines);

  // ---------- goals ----------
  const postMat = keep(new MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, emissive: 0xffffff, emissiveIntensity: 0.15 }));
  const netTex = keep(netTexture());
  const netMat = keep(new MeshBasicMaterial({ map: netTex, transparent: true, opacity: 0.7, side: DoubleSide, depthWrite: false, color: 0xdfe9ff }));
  const post = keep(new CylinderGeometry(0.08, 0.08, 1, 10));
  for (const s of [1, -1]) {
    const goal = new Group();
    const bar = (x: number, y: number, z: number, len: number, axis: "x" | "y" | "z") => {
      const m = new Mesh(post, postMat);
      m.scale.y = len;
      m.position.set(x, y, z);
      if (axis === "x") m.rotation.z = Math.PI / 2;
      if (axis === "z") m.rotation.x = Math.PI / 2;
      m.castShadow = true;
      goal.add(m);
    };
    bar(-GOAL_W / 2, GOAL_H / 2, 0, GOAL_H, "y");
    bar(GOAL_W / 2, GOAL_H / 2, 0, GOAL_H, "y");
    bar(0, GOAL_H, 0, GOAL_W + 0.16, "x");
    const net = (w: number, h: number, x: number, y: number, z: number, rx: number, ry: number) => {
      const t = netTex.clone();
      t.wrapS = t.wrapT = RepeatWrapping;
      t.repeat.set(w / 0.22, h / 0.22);
      keep(t);
      const m = new Mesh(keep(new PlaneGeometry(w, h)), netMat.clone());
      keep(m.material as Material);
      (m.material as MeshBasicMaterial).map = t;
      m.position.set(x, y, z);
      m.rotation.set(rx, ry, 0);
      goal.add(m);
    };
    const backH = GOAL_H * 0.8;
    net(GOAL_W, backH, 0, backH / 2, GOAL_D, 0, 0);
    const topLen = Math.hypot(GOAL_D, GOAL_H - backH);
    net(GOAL_W, topLen, 0, (GOAL_H + backH) / 2, GOAL_D / 2, -Math.PI / 2 + Math.atan2(GOAL_H - backH, GOAL_D), 0);
    net(GOAL_D, GOAL_H * 0.9, -GOAL_W / 2, GOAL_H * 0.45, GOAL_D / 2, 0, Math.PI / 2);
    net(GOAL_D, GOAL_H * 0.9, GOAL_W / 2, GOAL_H * 0.45, GOAL_D / 2, 0, Math.PI / 2);
    goal.position.z = s * HL;
    if (s < 0) goal.rotation.y = Math.PI;
    group.add(goal);
  }

  // ---------- LED boards (pitch-side) + stand-front ribbons ----------
  const boardCanvas = canvas(1024, 64);
  let boardAspect = drawBoard(boardCanvas, board);
  let boardTex = keep(makeTexture(boardCanvas));
  boardTex.wrapS = RepeatWrapping;
  const boardMats: MeshBasicMaterial[] = [];
  const boardTexs: { tex: Texture; len: number; h: number; dir: number }[] = [];
  const boardFrame = keep(new MeshStandardMaterial({ color: 0x0a1226, roughness: 0.6 }));
  const addBoard = (len: number, h: number, x: number, y: number, z: number, ry: number, dir: number, tilt = -0.08) => {
    const t = boardTex.clone();
    t.wrapS = RepeatWrapping;
    t.repeat.set(len / (h * boardAspect), 1);
    boardTexs.push({ tex: t, len, h, dir });
    const mat = new MeshBasicMaterial({ map: t, toneMapped: false, color: 0xffffff });
    boardMats.push(mat);
    const m = new Mesh(keep(new PlaneGeometry(len, h)), mat);
    const back = new Mesh(keep(new BoxGeometry(len + 0.2, h + 0.2, 0.25)), boardFrame);
    const holder = new Group();
    m.position.z = 0.13;
    back.castShadow = true;
    holder.add(back, m);
    holder.position.set(x, y, z);
    holder.rotation.set(tilt, ry, 0, "YXZ");
    group.add(holder);
  };
  const BH = 0.95;
  addBoard(PITCH_L + BOARD_GAP * 2, BH, -(HW + BOARD_GAP), BH / 2 + 0.05, 0, Math.PI / 2, 1);
  addBoard(PITCH_L + BOARD_GAP * 2, BH, HW + BOARD_GAP, BH / 2 + 0.05, 0, -Math.PI / 2, 1);
  addBoard(PITCH_W + BOARD_GAP * 2 - 0.4, BH, 0, BH / 2 + 0.05, -(HL + BOARD_GAP), 0, 1);
  addBoard(PITCH_W + BOARD_GAP * 2 - 0.4, BH, 0, BH / 2 + 0.05, HL + BOARD_GAP, Math.PI, 1);

  // ---------- stands + crowd ----------
  const standMat = keep(new MeshStandardMaterial({ color: 0x0b1531, roughness: 0.9 }));
  const riserMat = keep(new MeshStandardMaterial({ color: 0x060c1e, roughness: 0.9 }));
  const roofMat = keep(new MeshStandardMaterial({ color: 0x050a18, roughness: 0.8, metalness: 0.2 }));
  const stripMat = keep(new MeshBasicMaterial({ color: C.sky, toneMapped: false }));
  const goldStripMat = keep(new MeshBasicMaterial({ color: C.gold, toneMapped: false }));
  const seatsTex = keep(seatsTexture());
  const seatMats: MeshStandardMaterial[] = [];
  const crowdPos: number[] = [], crowdCol: number[] = [], crowdSeed: number[] = [];
  const palette = [
    [0.42, 0.67, 0.87, 0.36], // sky
    [0.93, 0.95, 1.0, 0.16], // white
    [0.1, 0.16, 0.32, 0.22], // navy
    [1.0, 0.78, 0.35, 0.06], // gold
    [0.6, 0.64, 0.7, 0.2], // grey
  ];
  const rand = rng(42);
  const pick = () => {
    let r = rand();
    for (const p of palette) {
      if ((r -= p[3]) <= 0) return p;
    }
    return palette[0];
  };
  const tierD = STAND_DEPTH / STAND_TIERS;
  const sides: { len: number; off: number; ry: number }[] = [
    { len: PITCH_L + 6, off: HW + STAND_GAP, ry: -Math.PI / 2 }, // right side (x+), faces -x
    { len: PITCH_L + 6, off: HW + STAND_GAP, ry: Math.PI / 2 }, // left side
    { len: PITCH_W + 6, off: HL + STAND_GAP, ry: 0 }, // far end (z-), faces +z
    { len: PITCH_W + 6, off: HL + STAND_GAP, ry: Math.PI }, // near end (z+)
  ];
  const rows = quality === "high" ? 2 : 1;
  const spacing = quality === "high" ? 0.62 : 0.8;
  const v = new Vector3();
  /** Per side: outward direction, front offset and the parts that would hide the pitch from a camera behind them. */
  const uppers: { nx: number; nz: number; off: number; parts: Object3D[] }[] = [];
  for (const sd of sides) {
    // local frame: x along the stand, z outward from the pitch (rows go up and back)
    const stand = new Group();
    const front = new Mesh(keep(new BoxGeometry(sd.len, 1.3, 0.3)), riserMat);
    front.position.set(0, 0.65, 0);
    stand.add(front);
    // treads: seats on top (+y), dark risers facing the pitch (+z), dark ends
    const seatTex = seatsTex.clone();
    seatTex.repeat.set(sd.len / 2.6, 1);
    keep(seatTex);
    const seatMat = keep(new MeshStandardMaterial({ map: seatTex, roughness: 0.85 }));
    seatMats.push(seatMat);
    // stepped tiers: one merged mesh for the seat rows, one for the risers and one for the two
    // staircase end caps (a fan from the bottom-back corner: the profile is star-shaped from there)
    const hgt = (i: number) => STAND_RISE * (i + 1) + 1.0;
    const prof: [number, number][] = [[0.15, 0]];
    for (let i = 0; i < STAND_TIERS; i++) prof.push([0.15 + tierD * i, hgt(i)], [0.15 + tierD * (i + 1), hgt(i)]);
    const far: [number, number] = [0.15 + tierD * STAND_TIERS, 0];
    const capPos: number[] = [], capNrm: number[] = [];
    for (const sx of [-1, 1]) {
      const x = (sx * sd.len) / 2;
      for (let k = 0; k < prof.length - 1; k++) {
        const tri = sx < 0 ? [far, prof[k], prof[k + 1]] : [far, prof[k + 1], prof[k]];
        for (const [d, h] of tri) {
          capPos.push(x, h, -d);
          capNrm.push(sx, 0, 0);
        }
      }
    }
    const caps = keep(new BufferGeometry());
    caps.setAttribute("position", new Float32BufferAttribute(capPos, 3));
    caps.setAttribute("normal", new Float32BufferAttribute(capNrm, 3));
    stand.add(new Mesh(caps, standMat));
    const seatsG: BufferGeometry[] = [], risersG: BufferGeometry[] = [];
    for (let i = 0; i < STAND_TIERS; i++) {
      const sg = new PlaneGeometry(sd.len, tierD);
      sg.rotateX(-Math.PI / 2);
      sg.translate(0, hgt(i) + 0.012, -(0.15 + tierD * (i + 0.5)));
      seatsG.push(sg);
      const lo = i ? hgt(i - 1) : 1.3, rh = hgt(i) - lo;
      const rg = new PlaneGeometry(sd.len, rh);
      rg.translate(0, lo + rh / 2, -(0.15 + tierD * i) + 0.012);
      risersG.push(rg);
    }
    const seats = new Mesh(keep(mergeGeometries(seatsG)), seatMat);
    seats.receiveShadow = true;
    const risers = new Mesh(keep(mergeGeometries(risersG)), riserMat);
    for (const g of [...seatsG, ...risersG]) g.dispose();
    stand.add(seats, risers);
    const backH = STAND_RISE * STAND_TIERS + 5;
    const back = new Mesh(keep(new BoxGeometry(sd.len, backH, 0.6)), roofMat);
    back.position.set(0, backH / 2, -(STAND_DEPTH + 0.5));
    stand.add(back);
    // canopy: cantilevered over the upper rows, its front edge an LED line (sky) with a gold underline
    const canopyD = STAND_DEPTH * 0.62;
    const roof = new Mesh(keep(new BoxGeometry(sd.len + 0.6, 0.45, canopyD)), roofMat);
    roof.position.set(0, backH + 0.2, -(STAND_DEPTH + 0.5 - canopyD / 2));
    roof.rotation.x = -0.1;
    stand.add(roof);
    const edgeZ = -(STAND_DEPTH + 0.5 - canopyD) + 0.1, edgeY = backH + 0.2 - Math.sin(0.1) * (canopyD / 2) + 0.05;
    const fascia = new Mesh(keep(new BoxGeometry(sd.len + 0.6, 0.9, 0.2)), roofMat);
    fascia.position.set(0, edgeY - 0.1, edgeZ);
    stand.add(fascia);
    const strip = new Mesh(keep(new BoxGeometry(sd.len + 0.6, 0.16, 0.12)), stripMat);
    strip.position.set(0, edgeY + 0.22, edgeZ + 0.14);
    stand.add(strip);
    const gold = new Mesh(keep(new BoxGeometry(sd.len + 0.6, 0.06, 0.1)), goldStripMat);
    gold.position.set(0, edgeY - 0.45, edgeZ + 0.14);
    stand.add(gold);
    uppers.push({ nx: -Math.sin(sd.ry), nz: -Math.cos(sd.ry), off: sd.off, parts: [back, roof, fascia, strip, gold] });
    // stand-front LED ribbon (scrolls the other way)
    const t = boardTex.clone();
    t.wrapS = RepeatWrapping;
    const rh = 0.8;
    t.repeat.set(sd.len / (rh * boardAspect), 1);
    boardTexs.push({ tex: t, len: sd.len, h: rh, dir: -1 });
    const rmat = new MeshBasicMaterial({ map: t, toneMapped: false });
    boardMats.push(rmat);
    const ribbon = new Mesh(keep(new PlaneGeometry(sd.len, rh)), rmat);
    ribbon.position.set(0, 0.7, 0.16);
    stand.add(ribbon);
    // stand placement: local -z goes away from the pitch
    stand.rotation.y = sd.ry;
    // local -z (up the rows) maps to the outward direction (-sin ry, 0, -cos ry)
    stand.position.set(-Math.sin(sd.ry) * sd.off, 0, -Math.cos(sd.ry) * sd.off);
    stand.updateMatrixWorld(true);
    group.add(stand);
    // crowd on the treads
    const n = Math.floor(sd.len / spacing);
    for (let i = 0; i < STAND_TIERS; i++)
      for (let r = 0; r < rows; r++)
        for (let k = 0; k < n; k++) {
          if (rand() < 0.1) continue; // empty seats
          const lx = -sd.len / 2 + (k + 0.5 + (r ? 0.5 : 0)) * spacing + (rand() - 0.5) * 0.18;
          const lz = -(0.15 + tierD * (i + 0.35 + r * 0.4));
          const ly = STAND_RISE * (i + 1) + 1.0 + 0.45 + rand() * 0.08;
          v.set(lx, ly, lz).applyMatrix4(stand.matrixWorld);
          crowdPos.push(v.x, v.y, v.z);
          const p = pick(), sh = 0.8 + rand() * 0.35;
          crowdCol.push(p[0] * sh, p[1] * sh, p[2] * sh);
          crowdSeed.push(rand());
        }
  }
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const cw = STAND_DEPTH * 1.25;
    const cb = new Mesh(keep(new BoxGeometry(cw, STAND_RISE * STAND_TIERS * 0.7 + 1, cw)), roofMat);
    cb.position.set(sx * (HW + STAND_GAP + 3 + cw / 2 - 2), (STAND_RISE * STAND_TIERS * 0.7 + 1) / 2, sz * (HL + STAND_GAP + 3 + cw / 2 - 2));
    cb.rotation.y = Math.PI / 4;
    group.add(cb);
  }
  const crowdGeo = keep(new BufferGeometry());
  crowdGeo.setAttribute("position", new Float32BufferAttribute(crowdPos, 3));
  crowdGeo.setAttribute("color", new Float32BufferAttribute(crowdCol, 3));
  crowdGeo.setAttribute("seed", new BufferAttribute(new Float32Array(crowdSeed), 1));
  const crowdMat = keep(
    new ShaderMaterial({
      vertexShader: CROWD_VERT,
      fragmentShader: CROWD_FRAG,
      transparent: true,
      fog: true,
      uniforms: UniformsUtils.merge([
        UniformsLib.fog,
        { uTime: { value: 0 }, uScale: { value: 400 }, uSize: { value: 0.95 }, uLight: { value: 1 }, uDay: { value: 0 }, uPhones: { value: 1 }, uMotion: { value: 1 } },
      ]),
    }),
  );
  const crowd = new Points(crowdGeo, crowdMat);
  crowd.frustumCulled = false;
  group.add(crowd);

  // ---------- light on the grass: mast pools, centre glow, LED spill ----------
  const poolTex = keep(poolTexture());
  const pools: MeshBasicMaterial[] = [];
  const poolGeo = keep(new PlaneGeometry(1, 1));
  const addDecal = (map: Texture, color: number, w: number, d: number, x: number, z: number, ry = 0, y = 0.012) => {
    const m = keep(new MeshBasicMaterial({ map, color, transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false, opacity: 0 }));
    const mesh = new Mesh(poolGeo, m);
    mesh.rotation.set(-Math.PI / 2, ry, 0, "YXZ"); // lie flat, then turn about the vertical
    mesh.scale.set(w, d, 1);
    mesh.position.set(x, y, z);
    mesh.renderOrder = 1;
    group.add(mesh);
    return m;
  };
  // each mast throws a warm pool on its half of the pitch (index = mast index)
  const poolSpots: [number, number][] = [
    [-HW * 0.42, HL * 0.48],
    [HW * 0.42, -HL * 0.48],
    [-HW * 0.42, -HL * 0.48],
    [HW * 0.42, HL * 0.48],
  ];
  for (const [x, z] of poolSpots) pools.push(addDecal(poolTex, 0xfff2d8, PITCH_W * 0.95, PITCH_L * 0.62, x, z, 0, 0.014));
  const centreGlow = addDecal(poolTex, C.sky, 17, 17, 0, 0, 0, 0.016);
  const spillTex = keep(fadeTexture());
  const spills: MeshBasicMaterial[] = [];
  // the opaque end of the fade (local -y → world (sin ry, 0, cos ry)) sits against the board
  spills.push(addDecal(spillTex, C.gold, PITCH_L + BOARD_GAP * 2, 4.5, -(HW + BOARD_GAP) + 2.25, 0, -Math.PI / 2));
  spills.push(addDecal(spillTex, C.skyHi, PITCH_L + BOARD_GAP * 2, 4.5, HW + BOARD_GAP - 2.25, 0, Math.PI / 2));
  spills.push(addDecal(spillTex, C.skyHi, PITCH_W + BOARD_GAP * 2, 4.5, 0, -(HL + BOARD_GAP) + 2.25, Math.PI));
  spills.push(addDecal(spillTex, C.gold, PITCH_W + BOARD_GAP * 2, 4.5, 0, HL + BOARD_GAP - 2.25, 0));

  // ---------- floodlight masts ----------
  const flare = keep(flareTexture());
  const glow = keep(glowTexture(0.4));
  const lampTex = keep(lampTexture());
  const poleMat = keep(new MeshStandardMaterial({ color: 0x1b2440, roughness: 0.5, metalness: 0.6 }));
  const poleGeo = keep(new CylinderGeometry(0.28, 0.5, MAST_H, 10));
  const headGeo = keep(new BoxGeometry(7.4, 5, 0.8));
  const panelGeo = keep(new PlaneGeometry(7, 4.6));
  const masts: { lamp: MeshBasicMaterial; flare: SpriteMaterial; halo: SpriteMaterial; cone: ShaderMaterial; light: DirectionalLight }[] = [];
  const MX = HW + STAND_GAP + 2.5, MZ = HL + STAND_GAP + 2.5;
  const corners: [number, number][] = [
    [-MX, MZ], // near-left (index 0 = the shadow caster)
    [MX, -MZ],
    [-MX, -MZ],
    [MX, MZ],
  ];
  const target = new Vector3();
  corners.forEach(([x, z]) => {
    const mast = new Group();
    const pole = new Mesh(poleGeo, poleMat);
    pole.position.set(x, MAST_H / 2, z);
    mast.add(pole);
    const head = new Group();
    head.position.set(x, MAST_H + 1.5, z);
    target.set(x * 0.25, 0, z * 0.25);
    head.lookAt(target);
    const housing = new Mesh(headGeo, poleMat);
    housing.position.z = -0.45;
    head.add(housing);
    const lamp = new MeshBasicMaterial({ map: lampTex, toneMapped: false, color: 0xffffff });
    keep(lamp);
    const panel = new Mesh(panelGeo, lamp);
    panel.position.z = 0.02;
    head.add(panel);
    mast.add(head);
    const fl = new SpriteMaterial({ map: flare, blending: AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false, fog: false, color: 0xe8f2ff });
    keep(fl);
    const fs = new Sprite(fl);
    fs.scale.set(34, 34, 1);
    fs.position.set(x, MAST_H + 1.5, z).lerp(target, 0.03);
    mast.add(fs);
    const ha = new SpriteMaterial({ map: glow, blending: AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false, fog: false, color: 0x6cabdd });
    keep(ha);
    const hs = new Sprite(ha);
    hs.scale.set(70, 70, 1);
    hs.position.copy(fs.position);
    mast.add(hs);
    // fake volumetric cone from the head toward the pitch
    const start = new Vector3(x, MAST_H + 1.5, z);
    const aim = new Vector3(x * 0.15, 0, z * 0.15);
    const len = start.distanceTo(aim);
    const coneMat = keep(
      new ShaderMaterial({
        vertexShader: CONE_VERT,
        fragmentShader: CONE_FRAG,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
        uniforms: { uOpacity: { value: 0.1 }, uTime: { value: 0 }, uColor: { value: new Color(0xbfe0ff) } },
      }),
    );
    const cone = new Mesh(keep(new CylinderGeometry(2.6, 17, len, 32, 1, true)), coneMat);
    cone.position.copy(start).lerp(aim, 0.5);
    cone.lookAt(aim);
    cone.rotateX(-Math.PI / 2);
    cone.renderOrder = 5;
    mast.add(cone);
    const light = new DirectionalLight(0xeef4ff, 1);
    light.position.copy(start);
    light.target.position.set(x * 0.1, 0, z * 0.1);
    group.add(light, light.target);
    masts.push({ lamp, flare: fl, halo: ha, cone: coneMat, light });
    group.add(mast);
  });

  // ---------- lights ----------
  const hemi = new HemisphereLight(0x9fd0f2, 0x0a1532, 0.4);
  group.add(hemi);
  const key = masts[0].light;
  key.castShadow = true;
  const sc = key.shadow.camera;
  sc.left = -40;
  sc.right = 40;
  sc.top = 44;
  sc.bottom = -44;
  sc.near = 5;
  sc.far = 140;
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.04;
  key.shadow.radius = 4;
  const sun = new DirectionalLight(0xfff4e0, 0);
  sun.position.set(-34, 70, 26);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 44, bottom: -44, near: 10, far: 180 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.04;
  sun.shadow.radius = 6;
  group.add(sun, sun.target);

  function setQuality(q: Quality, r: WebGLRenderer) {
    const size = q === "high" ? 2048 : 1024;
    for (const l of [key, sun]) {
      l.castShadow = q === "high";
      if (l.shadow.mapSize.x !== size) {
        l.shadow.mapSize.set(size, size);
        l.shadow.map?.dispose();
        l.shadow.map = null;
      }
    }
    r.shadowMap.enabled = q === "high";
    crowdMat.uniforms.uMotion.value = q === "high" ? 1 : 0.4;
  }
  setQuality(quality, renderer);

  const nightGrass = new Color(0xa9c4b4), dayGrass = new Color(0xffffff), tmp = new Color();
  const nightFog = new Color(0x060f24), dayFog = new Color(0xc9dff0);
  const nightStand = new Color(0x0b1531), dayStand = new Color(0x5d6f8f);
  const nightRoof = new Color(0x050a18), dayRoof = new Color(0x2e3a52);
  const nightGround = new Color(0x050b1c), dayGround = new Color(0x55687a);

  function update(s: StadiumState) {
    for (const u of uppers) {
      const behind = s.cam.x * u.nx + s.cam.z * u.nz > u.off + 1 && s.cam.y < 60;
      for (const o of u.parts) o.visible = !behind;
    }
    const day = s.day, night = 1 - day;
    const P = s.power, L = (P[0] + P[1] + P[2] + P[3]) / 4;
    skyMat.uniforms.uDay.value = day;
    skyMat.uniforms.uGlow.value = L;
    crowdMat.uniforms.uTime.value = s.time;
    crowdMat.uniforms.uDay.value = day;
    crowdMat.uniforms.uLight.value = lerp(0.12 + 0.55 * L, 1.0, day);
    crowdMat.uniforms.uScale.value = renderer.domElement.height / 2 / Math.tan((s.fov * Math.PI) / 360);
    crowdMat.uniforms.fogColor.value.copy(fog.color);
    crowdMat.uniforms.fogDensity.value = fog.density;
    masts.forEach((m, i) => {
      const p = P[i] * night;
      m.lamp.color.setScalar(0.08 + p * 1.6);
      m.flare.opacity = p * 0.95;
      m.halo.opacity = p * 0.22;
      m.cone.uniforms.uOpacity.value = p * 0.085;
      m.cone.uniforms.uTime.value = s.time;
      m.light.intensity = P[i] * night * (i === 0 ? 1.5 : 0.75);
    });
    sun.intensity = day * 3.0;
    key.castShadow = renderer.shadowMap.enabled && day < 0.5;
    sun.castShadow = renderer.shadowMap.enabled && day >= 0.5;
    hemi.intensity = lerp(0.12 + 0.3 * L, 1.15, day);
    hemi.color.set(day > 0.5 ? 0xdcefff : 0x9fd0f2);
    hemi.groundColor.set(day > 0.5 ? 0x4d6b3c : 0x0a1532);
    grassMat.color.copy(tmp.copy(nightGrass).multiplyScalar(0.25 + 0.75 * L).lerp(dayGrass, day));
    fog.color.copy(tmp.copy(nightFog).lerp(dayFog, day));
    fog.density = lerp(0.0078, 0.0036, day);
    skyMat.uniforms.uFog.value.copy(fog.color);
    pools.forEach((m, i) => (m.opacity = P[i] * night * 0.2));
    centreGlow.opacity = L * night * 0.14;
    for (const m of spills) m.opacity = L * night * 0.3;
    goldStripMat.color.set(C.gold).multiplyScalar(lerp(0.3 + 0.8 * L, 0.5, day));
    riserMat.color.copy(tmp.set(0x060c1e).lerp(dayRoof, day * 0.7));
    for (const m of seatMats) m.color.setScalar(lerp(0.55 + 0.45 * L, 1.25, day));
    standMat.color.copy(tmp.copy(nightStand).lerp(dayStand, day));
    roofMat.color.copy(tmp.copy(nightRoof).lerp(dayRoof, day));
    groundMat.color.copy(tmp.copy(nightGround).lerp(dayGround, day));
    lineMat.emissiveIntensity = lerp(0.06 + 0.1 * L, 0.0, day);
    lineMat.color.setScalar(lerp(0.35 + 0.6 * L, 1, day));
    stripMat.color.set(C.sky).multiplyScalar(lerp(0.3 + 0.9 * L, 0.6, day));
    // constant scroll speed in metres per second, whatever the board length
    for (const b of boardTexs) b.tex.offset.x = (s.time * 1.4 * b.dir) / (b.h * boardAspect);
    for (const m of boardMats) m.color.setScalar(lerp(0.35 + 0.9 * L, 1.0, day));
  }

  function setBoard(messages: string[]) {
    const old = boardTex;
    boardAspect = drawBoard(boardCanvas, messages);
    boardTex = keep(makeTexture(boardCanvas));
    for (const b of boardTexs) {
      const fresh = boardTex.clone();
      fresh.wrapS = RepeatWrapping;
      fresh.repeat.set(b.len / (b.h * boardAspect), 1);
      b.tex.dispose();
      b.tex = fresh;
    }
    boardTexs.forEach((b, i) => {
      boardMats[i].map = b.tex;
      boardMats[i].needsUpdate = true;
    });
    old.dispose();
  }

  scene.add(group);
  return {
    group,
    key,
    update,
    setBoard,
    setQuality,
    dispose() {
      scene.remove(group);
      for (const b of boardTexs) b.tex.dispose();
      for (const m of boardMats) m.dispose();
      key.shadow.map?.dispose();
      sun.shadow.map?.dispose();
      for (const d of disposables) d.dispose();
    },
  };
}
