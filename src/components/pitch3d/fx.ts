// Broadcast AR on the grass: arrows painted with an animated draw, light trails behind runners,
// the ball (with its glow and shadow) and the light column of the presentación.
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  ShaderMaterial,
  SphereGeometry,
  Vector2,
  type Texture,
} from "three";
import { BALL_R, C, SHIRT_H, toWorld } from "./constants";
import { ballTexture } from "./textures";
import type { ArrowSpec } from "./types";

const ARROW_VERT = /* glsl */ `
attribute vec2 aUv;
varying vec2 vUv;
void main(){ vUv = aUv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const ARROW_FRAG = /* glsl */ `
uniform vec3 uColor; uniform float uProgress, uOpacity, uDash, uTime, uLen;
varying vec2 vUv;
void main(){
  float along = vUv.x;
  if (along > uProgress) discard;
  float across = abs(vUv.y);
  float core = 1.0 - smoothstep(0.2, 0.34, across);
  float glow = pow(1.0 - across, 2.0) * 0.5;
  float d = along * uLen;
  float dash = uDash > 0.5 ? smoothstep(0.38, 0.46, fract(d / 1.7 - uTime * 0.9)) : 1.0;
  float flow = uDash > 0.5 ? 1.0 : 0.8 + 0.2 * sin(d * 1.4 - uTime * 7.0);
  float tip = smoothstep(uProgress - 0.08, uProgress, along) * step(uProgress, 0.995);
  float a = (core * dash + glow * (0.6 + 0.4 * dash)) * uOpacity * smoothstep(0.0, 0.04, along);
  gl_FragColor = vec4(uColor * flow * (1.0 + core * 0.5 + tip * 1.5), a);
}`;

const TRAIL_FRAG = /* glsl */ `
uniform vec3 uColor; uniform float uOpacity;
varying vec2 vUv;
void main(){
  float across = abs(vUv.y);
  float age = vUv.x; // 0 newest … 1 oldest
  float a = pow(1.0 - age, 1.6) * (1.0 - smoothstep(0.1, 1.0, across)) * uOpacity;
  gl_FragColor = vec4(uColor * (1.2 - age * 0.5), a * 0.75);
}`;

const ARROW_COLORS = { pase: C.skyHi, carrera: C.gold, conduccion: C.white } as const;

/** Ribbon geometry (flat on the grass) along a polyline; aUv.x = 0..1 along, aUv.y = -1..1 across. */
function ribbon(points: Vector2[], width: number, y: number): { geo: BufferGeometry; len: number } {
  const n = points.length, pos = new Float32Array(n * 6), uv = new Float32Array(n * 4), idx: number[] = [];
  let total = 0;
  const acc: number[] = [0];
  for (let i = 1; i < n; i++) acc.push((total += points[i].distanceTo(points[i - 1])));
  for (let i = 0; i < n; i++) {
    const a = points[Math.max(0, i - 1)], b = points[Math.min(n - 1, i + 1)];
    let dx = b.x - a.x, dz = b.y - a.y;
    const l = Math.hypot(dx, dz) || 1;
    dx /= l;
    dz /= l;
    const nx = -dz * (width / 2), nz = dx * (width / 2), p = points[i];
    pos.set([p.x + nx, y, p.y + nz, p.x - nx, y, p.y - nz], i * 6);
    const u = total ? acc[i] / total : 0;
    uv.set([u, 1, u, -1], i * 4);
    if (i < n - 1) idx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
  }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(pos, 3));
  geo.setAttribute("aUv", new BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return { geo, len: total };
}

/** One AR arrow (pase straight, carrera curved + dashed, conducción wavy) with its head. */
export class Arrow {
  group = new Group();
  mat: ShaderMaterial;
  private head: Mesh;
  private headMat: MeshBasicMaterial;
  progress = 0;
  opacity = 1;

  constructor(spec: ArrowSpec) {
    const [ax, az] = toWorld(spec.from.x, spec.from.y);
    const [bx, bz] = toWorld(spec.to.x, spec.to.y);
    const A = new Vector2(ax, az), B = new Vector2(bx, bz), d = B.clone().sub(A), L = d.length();
    const dir = d.clone().normalize(), nrm = new Vector2(-dir.y, dir.x);
    // trim off the rings at both ends
    const s0 = Math.min(2.0, L * 0.2), s1 = Math.max(s0 + 0.5, L - Math.min(2.2, L * 0.2));
    const pts: Vector2[] = [];
    const N = 48;
    for (let i = 0; i <= N; i++) {
      const t = s0 / L + ((s1 - s0) / L) * (i / N);
      const p = A.clone().addScaledVector(d, t);
      if (spec.kind === "carrera") p.addScaledVector(nrm, Math.sin(Math.PI * t) * L * 0.12);
      if (spec.kind === "conduccion") p.addScaledVector(nrm, Math.sin(t * L * 2.1) * 0.45 * Math.sin(Math.PI * t));
      pts.push(p);
    }
    const { geo, len } = ribbon(pts, 1.0, 0.05);
    const color = new Color(ARROW_COLORS[spec.kind]);
    this.mat = new ShaderMaterial({
      vertexShader: ARROW_VERT,
      fragmentShader: ARROW_FRAG,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      uniforms: { uColor: { value: color }, uProgress: { value: 0 }, uOpacity: { value: 1 }, uDash: { value: spec.kind === "carrera" ? 1 : 0 }, uTime: { value: 0 }, uLen: { value: len } },
    });
    const body = new Mesh(geo, this.mat);
    body.renderOrder = 3;
    // head: a flat chevron
    const hg = new BufferGeometry();
    hg.setAttribute("position", new BufferAttribute(new Float32Array([0, 0, 1.0, -0.85, 0, -0.6, 0, 0, -0.12, 0.85, 0, -0.6]), 3));
    hg.setIndex([0, 1, 2, 0, 2, 3]);
    this.headMat = new MeshBasicMaterial({ color, transparent: true, depthWrite: false, toneMapped: false, side: DoubleSide });
    this.head = new Mesh(hg, this.headMat);
    const end = pts[pts.length - 1], prev = pts[pts.length - 3];
    this.head.position.set(end.x, 0.06, end.y);
    this.head.rotation.y = Math.atan2(end.x - prev.x, end.y - prev.y);
    this.head.renderOrder = 3;
    this.group.add(body, this.head);
  }

  tick(t: number) {
    this.mat.uniforms.uProgress.value = this.progress;
    this.mat.uniforms.uOpacity.value = this.opacity;
    this.mat.uniforms.uTime.value = t;
    const h = Math.max(0, Math.min(1, (this.progress - 0.9) / 0.1));
    this.head.scale.setScalar(0.001 + h * (1 + Math.sin(Math.min(1, h) * Math.PI) * 0.35));
    this.headMat.opacity = this.opacity * h;
  }

  dispose() {
    this.group.removeFromParent();
    this.group.traverse((o) => (o as Mesh).geometry?.dispose());
    this.mat.dispose();
    this.headMat.dispose();
  }
}

/** A fading light trail behind a runner; points are given newest first each frame. */
export class Trail {
  mesh: Mesh;
  private geo: BufferGeometry;
  private mat: ShaderMaterial;
  private n: number;
  constructor(color: number, n = 28) {
    this.n = n;
    this.geo = new BufferGeometry();
    this.geo.setAttribute("position", new BufferAttribute(new Float32Array(n * 6), 3));
    const uv = new Float32Array(n * 4), idx: number[] = [];
    for (let i = 0; i < n; i++) {
      uv.set([i / (n - 1), 1, i / (n - 1), -1], i * 4);
      if (i < n - 1) idx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
    }
    this.geo.setAttribute("aUv", new BufferAttribute(uv, 2));
    this.geo.setIndex(idx);
    this.mat = new ShaderMaterial({
      vertexShader: ARROW_VERT,
      fragmentShader: TRAIL_FRAG,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
      uniforms: { uColor: { value: new Color(color) }, uOpacity: { value: 0 } },
    });
    this.mesh = new Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
  }
  /** `pts` newest first (world x,z); fewer points collapse onto the last. */
  set(pts: Vector2[], opacity: number) {
    const pos = this.geo.attributes.position as BufferAttribute, arr = pos.array as Float32Array;
    this.mat.uniforms.uOpacity.value = pts.length > 1 ? opacity : 0;
    if (pts.length < 2) return;
    for (let i = 0; i < this.n; i++) {
      const p = pts[Math.min(pts.length - 1, i)];
      const a = pts[Math.max(0, Math.min(pts.length - 1, i - 1))], b = pts[Math.min(pts.length - 1, i + 1)];
      let dx = a.x - b.x, dz = a.y - b.y;
      const l = Math.hypot(dx, dz) || 1;
      dx /= l;
      dz /= l;
      const w = 0.8 * (1 - (i / this.n) * 0.6);
      arr.set([p.x - dz * w, 0.045, p.y + dx * w, p.x + dz * w, 0.045, p.y - dx * w], i * 6);
    }
    pos.needsUpdate = true;
  }
  dispose() {
    this.mesh.removeFromParent();
    this.geo.dispose();
    this.mat.dispose();
  }
}

export class Ball {
  group = new Group();
  ball: Mesh;
  private tex: Texture;
  private glowMat: MeshBasicMaterial;
  private shadowMat: MeshBasicMaterial;
  private shadow: Mesh;
  pos = new Vector2();
  target = new Vector2();
  height = 0;
  driven = false;
  visible = true;

  constructor(ringTex: Texture, blobTex: Texture, ringGeo: PlaneGeometry) {
    this.tex = ballTexture();
    this.ball = new Mesh(new SphereGeometry(BALL_R, 32, 20), new MeshStandardMaterial({ map: this.tex, roughness: 0.42, emissive: 0xffffff, emissiveIntensity: 0.08 }));
    this.ball.castShadow = true;
    this.glowMat = new MeshBasicMaterial({ map: ringTex, color: C.white, transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false, opacity: 0.55 });
    const glow = new Mesh(ringGeo, this.glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.04;
    glow.scale.setScalar(BALL_R * 3.2);
    glow.renderOrder = 2;
    this.shadowMat = new MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.6 });
    this.shadow = new Mesh(ringGeo, this.shadowMat);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.03;
    this.group.add(this.shadow, glow, this.ball);
  }

  tick(dt: number) {
    if (!this.driven) {
      const k = 1 - Math.exp(-dt * 6);
      this.pos.lerp(this.target, k);
      this.height *= 1 - k;
    }
    const prevX = this.group.position.x, prevZ = this.group.position.z;
    this.group.position.set(this.pos.x, 0, this.pos.y);
    this.ball.position.y = BALL_R + this.height;
    const mx = this.pos.x - prevX, mz = this.pos.y - prevZ;
    this.ball.rotation.x += mz / BALL_R;
    this.ball.rotation.z -= mx / BALL_R;
    const s = 1 / (1 + this.height * 0.35);
    this.shadow.scale.setScalar(BALL_R * 2.8 * (1 + this.height * 0.25));
    this.shadowMat.opacity = 0.6 * s;
    this.glowMat.opacity = 0.5 * s;
    this.group.visible = this.visible;
  }

  dispose() {
    this.group.removeFromParent();
    this.ball.geometry.dispose();
    (this.ball.material as MeshStandardMaterial).dispose();
    this.tex.dispose();
    this.glowMat.dispose();
    this.shadowMat.dispose();
  }
}

const COLUMN_VERT = /* glsl */ `
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
const COLUMN_FRAG = /* glsl */ `
uniform vec3 uColor; uniform float uOpacity, uTime;
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main(){
  float edge = pow(1.0 - abs(dot(vN, vV)), 1.5);
  float rise = pow(1.0 - vUv.y, 2.2);
  float scan = 0.75 + 0.25 * sin(vUv.y * 60.0 - uTime * 5.0);
  float a = (rise * (0.22 + edge * 0.7)) * scan * uOpacity;
  gl_FragColor = vec4(uColor * a, 1.0);
}`;

/** The presentación light column: an additive cylinder of light and a bright floor disc. */
export class Column {
  group = new Group();
  private mat: ShaderMaterial;
  private discMat: MeshBasicMaterial;
  opacity = 0;
  constructor(ringTex: Texture, ringGeo: PlaneGeometry) {
    this.mat = new ShaderMaterial({
      vertexShader: COLUMN_VERT,
      fragmentShader: COLUMN_FRAG,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
      toneMapped: false,
      uniforms: { uColor: { value: new Color(C.skyHi) }, uOpacity: { value: 0 }, uTime: { value: 0 } },
    });
    const cyl = new Mesh(new CylinderGeometry(SHIRT_H * 0.5, SHIRT_H * 0.5, SHIRT_H * 4, 40, 1, true), this.mat);
    cyl.position.y = SHIRT_H * 2;
    cyl.renderOrder = 6;
    this.discMat = new MeshBasicMaterial({ map: ringTex, color: C.gold, transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false, opacity: 0 });
    const disc = new Mesh(ringGeo, this.discMat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.05;
    disc.scale.setScalar(SHIRT_H * 1.35);
    disc.renderOrder = 2;
    this.group.add(cyl, disc);
    this.group.visible = false;
  }
  tick(t: number, gold: boolean) {
    this.mat.uniforms.uTime.value = t;
    this.mat.uniforms.uOpacity.value = this.opacity;
    (this.mat.uniforms.uColor.value as Color).set(gold ? C.gold : C.skyHi);
    this.discMat.opacity = this.opacity * 0.45;
    this.group.children[1].rotation.z = t * 0.6;
    this.group.visible = this.opacity > 0.01;
  }
  dispose() {
    this.group.removeFromParent();
    this.group.traverse((o) => (o as Mesh).geometry?.dispose());
    this.mat.dispose();
    this.discMat.dispose();
  }
}
