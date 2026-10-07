// The players: the club's real shirt mesh (shared geometry) floating over an AR ring, with the
// name/number printed on a small per-player kit texture (512², upgraded to 1024² for close-ups),
// a sky rim light, a contact shadow and a broadcast name plate. Rivals are one instanced shirt
// tinted in rival red (no prints), facing our goal.
import {
  AdditiveBlending,
  Box3,
  CanvasTexture,
  Color,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Quaternion,
  SRGBColorSpace,
  Sprite,
  SpriteMaterial,
  Texture,
  Vector2,
  Vector3,
  type BufferGeometry,
  type Scene,
  type WebGLRenderer,
} from "three";
import type { Assets } from "./assets";
import { C, RING_SCALE, SHIRT_FLOAT, SHIRT_H, easeOutBack, toWorld } from "./constants";
import { drawPrints, KIT_INK } from "../jersey3d/prints";
import { blobTexture, canvas, dashTexture, drawPlate, ringTexture } from "./textures";
import type { KitName, PlayerSpec, Quality, RivalSpec } from "./types";

const PRINT = 512, HERO = 1024, KIT = 2048;

type ShirtMat = MeshPhysicalMaterial | MeshStandardMaterial;
interface RimUniforms {
  uRim: { value: number };
  uRimColor: { value: Color };
}

/** Adds a fresnel rim (emissive) to a standard/physical material: the hologram edge light. */
function withRim(m: ShirtMat, color: number, amount: number): RimUniforms {
  const u: RimUniforms = { uRim: { value: amount }, uRimColor: { value: new Color(color) } };
  m.onBeforeCompile = (s) => {
    s.uniforms.uRim = u.uRim;
    s.uniforms.uRimColor = u.uRimColor;
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uRim;\nuniform vec3 uRimColor;")
      .replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\n\tfloat mpF = pow(1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), 2.6);\n\ttotalEmissiveRadiance += uRimColor * mpF * uRim;",
      );
  };
  m.customProgramCacheKey = () => "mp-rim";
  return u;
}

interface ShirtPart {
  geometry: BufferGeometry;
  matrix: Matrix4;
  role: "outer" | "inner" | "trim";
}

/** Shared pieces: the shirt parts, base kit textures, ring/plate textures. */
export class Kit {
  parts: ShirtPart[] = [];
  base: Record<KitName, Texture>;
  normal: Texture;
  ring: Texture;
  dash: Texture;
  blob: Texture;
  rivalTex: Texture;
  hero: { canvas: HTMLCanvasElement; tex: CanvasTexture; owner: string | null };
  private disposables: { dispose(): void }[] = [];
  A: Assets;
  quality: Quality;

  constructor(A: Assets, quality: Quality, renderer: WebGLRenderer) {
    this.A = A;
    this.quality = quality;
    const scene = A.gltf.scene.clone(true);
    scene.updateMatrixWorld(true);
    const box = new Box3().setFromObject(scene);
    const size = box.getSize(new Vector3()), centre = box.getCenter(new Vector3());
    const s = SHIRT_H / size.y;
    const norm = new Matrix4().makeScale(s, s, s).multiply(new Matrix4().makeTranslation(-centre.x, -box.min.y, -centre.z));
    scene.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      const matName = Array.isArray(mesh.material) ? "" : mesh.material.name;
      const role = mesh.name === "Object_1" || mesh.name === "Object_3" ? "inner" : matName === "Material206971" ? "trim" : "outer";
      this.parts.push({ geometry: mesh.geometry, matrix: norm.clone().multiply(mesh.matrixWorld), role });
    });
    const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const half = (img: ImageBitmap, tint?: string) => {
      const c = canvas(PRINT, PRINT), g = c.getContext("2d") as CanvasRenderingContext2D;
      g.drawImage(img, 0, 0, PRINT, PRINT);
      if (tint) {
        g.globalCompositeOperation = "multiply";
        g.fillStyle = tint;
        g.fillRect(0, 0, PRINT, PRINT);
      }
      const t = new CanvasTexture(c);
      t.flipY = false;
      t.colorSpace = SRGBColorSpace;
      t.anisotropy = aniso;
      return this.keep(t);
    };
    this.base = { home: half(A.home), away: half(A.away) };
    this.rivalTex = half(A.home, "#ff3044");
    this.normal = this.keep(new Texture(A.normal));
    this.normal.flipY = false;
    this.normal.needsUpdate = true;
    this.ring = this.keep(ringTexture());
    this.dash = this.keep(dashTexture());
    this.blob = this.keep(blobTexture());
    const hc = canvas(HERO, HERO);
    const ht = new CanvasTexture(hc);
    ht.flipY = false;
    ht.colorSpace = SRGBColorSpace;
    ht.anisotropy = aniso;
    this.hero = { canvas: hc, tex: this.keep(ht), owner: null };
  }

  keep<T extends { dispose(): void }>(x: T): T {
    this.disposables.push(x);
    return x;
  }

  material(map: Texture, role: ShirtPart["role"], rimColor: number, rim: number): { mat: ShirtMat; rim: RimUniforms } {
    const common = {
      map,
      normalMap: this.normal,
      normalScale: new Vector2(0.9, 0.9),
      roughness: role === "inner" ? 0.9 : role === "trim" ? 0.6 : 0.74,
      metalness: 0,
      color: role === "inner" ? 0xb8c9dc : 0xffffff,
    };
    const mat: ShirtMat =
      this.quality === "high"
        ? new MeshPhysicalMaterial({ ...common, sheen: role === "inner" ? 0.4 : 1, sheenRoughness: 0.5, sheenColor: new Color(0xcfeaff) })
        : new MeshStandardMaterial(common);
    return { mat, rim: withRim(mat, rimColor, rim) };
  }

  /** Paints a kit with the player's name/number into `c` (size PRINT or HERO). */
  paint(c: HTMLCanvasElement, kit: KitName, name: string, num: string) {
    const g = c.getContext("2d") as CanvasRenderingContext2D, sc = c.width / KIT;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(kit === "home" ? this.A.home : this.A.away, 0, 0, c.width, c.height);
    drawPrints(g, sc, this.A.layout[kit], KIT_INK[kit], name.toUpperCase().slice(0, 14), String(num).replace(/\D/g, "").slice(0, 2), this.A.crest);
  }

  dispose() {
    for (const d of this.disposables) d.dispose();
  }
}

const UP = new Vector3(0, 1, 0);
/** Critically damped spring towards `target`, in ≤ 1/60 s sub-steps (stable for long frames). */
function spring(pos: Vector2, vel: Vector2, target: Vector2, dt: number) {
  const w = 5.2;
  for (let left = dt; left > 1e-6; left -= 1 / 60) {
    const h = Math.min(left, 1 / 60);
    vel.x += (w * w * (target.x - pos.x) - 2 * w * vel.x) * h;
    vel.y += (w * w * (target.y - pos.y) - 2 * w * vel.y) * h;
    pos.x += vel.x * h;
    pos.y += vel.y * h;
  }
}
const angleTo = (a: number, b: number) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};

export class Player {
  spec: PlayerSpec;
  root = new Group();
  float = new Group();
  shirt = new Group();
  pos = new Vector2();
  vel = new Vector2();
  target = new Vector2();
  /** When set (jugadas), the position is driven directly instead of by the spring. */
  driven: Vector2 | null = null;
  yaw = Math.PI;
  /** Reveal: forced yaw relative to the camera (0 = front to camera, π = back). */
  yawOverride: number | null = null;
  appear = 1;
  focus = 0;
  private fresh = true;
  /** Presentación: the others step back (plates and rim dim). */
  dim = 0;
  phase = Math.random() * 10;
  private printCanvas = canvas(PRINT, PRINT);
  private printTex: CanvasTexture;
  private mats: ShirtMat[] = [];
  private rims: RimUniforms[] = [];
  private ringMat: MeshBasicMaterial;
  private dashMat: MeshBasicMaterial;
  private ring: Mesh;
  private dash: Mesh;
  private blob: Mesh;
  private plateCanvas = canvas(256, 96);
  private plateTex: CanvasTexture;
  plate: Sprite;
  plateAspect = 3;
  labels = true;
  /** Set by the engine's label layout: where the tag sits (under the ring / over the shirt) or hidden on collision. */
  plateMode: "below" | "above" | "hidden" = "below";
  /** Horizontal nudge (fraction of the tag width) keeping the tag inside the frame. */
  plateShift = 0;
  private plateAlpha = 1;
  private kit: Kit;

  constructor(kit: Kit, spec: PlayerSpec, ringGeo: PlaneGeometry) {
    this.kit = kit;
    this.spec = { ...spec };
    this.printTex = kit.keep(new CanvasTexture(this.printCanvas));
    this.printTex.flipY = false;
    this.printTex.colorSpace = SRGBColorSpace;
    this.printTex.anisotropy = kit.base.home.anisotropy;
    const kitName = spec.kit ?? "home";
    for (const part of kit.parts) {
      const map = part.role === "inner" ? kit.base[kitName] : this.printTex;
      const { mat, rim } = kit.material(map, part.role, C.skyHi, 0.25);
      this.mats.push(mat);
      this.rims.push(rim);
      const m = new Mesh(part.geometry, mat);
      m.matrixAutoUpdate = false;
      m.matrix.copy(part.matrix);
      m.castShadow = part.role === "outer";
      this.shirt.add(m);
    }
    this.float.add(this.shirt);
    this.root.add(this.float);
    this.ringMat = new MeshBasicMaterial({ map: kit.ring, color: C.sky, transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false });
    this.dashMat = new MeshBasicMaterial({ map: kit.dash, color: C.sky, transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false, opacity: 0.8 });
    this.ring = new Mesh(ringGeo, this.ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.03;
    this.ring.scale.setScalar(RING_SCALE);
    this.ring.renderOrder = 2;
    this.dash = new Mesh(ringGeo, this.dashMat);
    this.dash.rotation.x = -Math.PI / 2;
    this.dash.position.y = 0.035;
    this.dash.scale.setScalar(RING_SCALE);
    this.dash.renderOrder = 2;
    this.blob = new Mesh(ringGeo, new MeshBasicMaterial({ map: kit.blob, transparent: true, depthWrite: false, opacity: 0.55 }));
    this.blob.rotation.x = -Math.PI / 2;
    this.blob.position.y = 0.025;
    this.blob.scale.setScalar(RING_SCALE * 0.95);
    this.root.add(this.blob, this.ring, this.dash);
    this.plateTex = kit.keep(new CanvasTexture(this.plateCanvas));
    this.plateTex.colorSpace = SRGBColorSpace;
    this.plate = new Sprite(new SpriteMaterial({ map: this.plateTex, sizeAttenuation: false, depthTest: false, depthWrite: false, transparent: true, toneMapped: false, fog: false }));
    this.plate.center.set(0.5, 1.1);
    this.plate.renderOrder = 30;
    this.root.add(this.plate);
    this.repaint();
    const [wx, wz] = toWorld(spec.x, spec.y);
    this.pos.set(wx, wz);
    this.target.set(wx, wz);
  }

  update(spec: PlayerSpec) {
    const printChange = spec.name !== this.spec.name || String(spec.num) !== String(this.spec.num) || (spec.kit ?? "home") !== (this.spec.kit ?? "home");
    const plateChange = printChange || spec.role !== this.spec.role || !!spec.highlight !== !!this.spec.highlight;
    this.spec = { ...spec };
    if (printChange) this.paintPrints();
    if (plateChange) this.paintPlate();
    const [wx, wz] = toWorld(spec.x, spec.y);
    this.target.set(wx, wz);
  }

  private repaint() {
    this.paintPrints();
    this.paintPlate();
  }
  private paintPrints() {
    this.kit.paint(this.printCanvas, this.spec.kit ?? "home", this.spec.name, String(this.spec.num));
    this.printTex.needsUpdate = true;
    if (this.kit.hero.owner === this.spec.id) this.heroPrints(true);
  }
  private paintPlate() {
    const old = this.plateTex;
    this.plateAspect = drawPlate(this.plateCanvas, this.spec, !!this.spec.highlight);
    // the plate canvas changes size with the name: a fresh texture avoids a stale GPU allocation
    this.plateTex = this.kit.keep(new CanvasTexture(this.plateCanvas));
    this.plateTex.colorSpace = SRGBColorSpace;
    (this.plate.material as SpriteMaterial).map = this.plateTex;
    old.dispose();
  }

  /** Swap to the shared 1024² print canvas (close-ups) or back. */
  heroPrints(on: boolean) {
    const hero = this.kit.hero;
    if (on) {
      if (hero.owner && hero.owner !== this.spec.id) return;
      hero.owner = this.spec.id;
      this.kit.paint(hero.canvas, this.spec.kit ?? "home", this.spec.name, String(this.spec.num));
      hero.tex.needsUpdate = true;
    } else if (hero.owner === this.spec.id) hero.owner = null;
    this.shirt.children.forEach((_m, i) => {
      if (this.kit.parts[i].role === "inner") return;
      (this.mats[i] as MeshStandardMaterial).map = on ? hero.tex : this.printTex;
    });
  }

  setPosition(x: number, y: number) {
    const [wx, wz] = toWorld(x, y);
    this.pos.set(wx, wz);
    this.target.set(wx, wz);
    this.vel.set(0, 0);
  }

  /** Per frame. `cam` = camera position; `plateScale` = sprite scale for 1 px of plate height. */
  tick(dt: number, t: number, cam: Vector3, plateScale: number, reduce: boolean) {
    if (this.driven) {
      if (dt > 0) this.vel.set((this.driven.x - this.pos.x) / dt, (this.driven.y - this.pos.y) / dt);
      this.pos.copy(this.driven);
    } else {
      // critically damped spring (formation morph / drag), sub-stepped so long frames stay stable
      spring(this.pos, this.vel, this.target, dt);
    }
    this.root.position.set(this.pos.x, 0, this.pos.y);
    // facing: back to the camera (names read), biased towards the rival goal and the run
    const dx = cam.x - this.pos.x, dz = cam.z - this.pos.y, dl = Math.hypot(dx, dz) || 1;
    let fx = -dx / dl, fz = -dz / dl - 0.2;
    const sp = this.vel.length();
    if (sp > 0.6) {
      fx += (this.vel.x / sp) * 0.7;
      fz += (this.vel.y / sp) * 0.7;
    }
    let want = Math.atan2(fx, fz);
    if (this.yawOverride !== null) want = Math.atan2(dx, dz) + this.yawOverride;
    // first frame: face the camera at once (never start edge-on)
    this.yaw += this.fresh ? angleTo(this.yaw, want) : angleTo(this.yaw, want) * Math.min(1, dt * (this.yawOverride !== null ? 3.2 : 4));
    this.fresh = false;
    const e = easeOutBack(Math.min(1, Math.max(0, this.appear)));
    const bob = reduce ? 0 : Math.sin(t * 1.7 + this.phase) * 0.09;
    this.float.position.y = SHIRT_FLOAT + bob + (1 - e) * -(SHIRT_H + 1);
    this.float.rotation.set(0, 0, 0);
    // lean into the run
    const lean = Math.min(0.22, sp * 0.028);
    if (sp > 0.3) {
      const ax = new Vector3(this.vel.y, 0, -this.vel.x).normalize();
      this.float.quaternion.setFromAxisAngle(ax, lean);
    }
    this.float.quaternion.multiply(new Quaternion().setFromAxisAngle(UP, this.yaw));
    const hi = this.spec.highlight ? 1 : 0;
    const capt = this.spec.role === "C";
    const ringCol = hi || capt ? C.gold : C.sky;
    this.ringMat.color.set(ringCol);
    this.dashMat.color.set(hi ? C.white : ringCol);
    const pulse = hi && !reduce ? 1 + Math.sin(t * 4) * 0.06 : 1;
    const ringK = (0.35 + 0.65 * Math.min(1, Math.max(0, this.appear))) * (1 + this.focus * 0.25) * pulse;
    this.ring.scale.setScalar(RING_SCALE * ringK);
    this.dash.scale.setScalar(RING_SCALE * ringK * 0.98);
    this.dash.rotation.z = reduce ? 0 : t * (hi ? 1.2 : 0.4);
    const vis = Math.min(1, Math.max(0, this.appear));
    this.ringMat.opacity = vis * (0.75 + 0.25 * hi + this.focus * 0.3);
    this.dashMat.opacity = vis * (0.55 + 0.35 * hi);
    (this.blob.material as MeshBasicMaterial).opacity = vis * 0.5;
    const rim = (0.28 + hi * 0.9 + this.focus * 0.7) * (1 - this.dim * 0.6);
    for (const r of this.rims) {
      r.uRim.value = rim;
      r.uRimColor.value.set(hi ? C.skyHi : C.skyHi);
    }
    // plate: constant on-screen size, hidden while rising, laid out by the engine to avoid overlaps
    const pm = this.plate.material as SpriteMaterial;
    const plateWant = this.plateMode === "hidden" ? 0 : 1;
    this.plateAlpha += (plateWant - this.plateAlpha) * Math.min(1, dt * 10);
    if (this.plateMode === "above") {
      this.plate.position.y = SHIRT_FLOAT + SHIRT_H + 0.35 + bob;
      this.plate.center.set(0.5 - this.plateShift, -0.1);
    } else {
      this.plate.position.y = 0.05;
      this.plate.center.set(0.5 - this.plateShift, 1.1);
    }
    pm.opacity = this.labels ? vis * this.plateAlpha * (1 - this.dim * 0.75) : 0;
    this.plate.visible = pm.opacity > 0.02;
    const h = plateScale * (1 + this.focus * 0.3);
    this.plate.scale.set(h * this.plateAspect, h, 1);
  }

  dispose() {
    for (const m of this.mats) m.dispose();
    this.ringMat.dispose();
    this.dashMat.dispose();
    (this.blob.material as MeshBasicMaterial).dispose();
    (this.plate.material as SpriteMaterial).dispose();
    this.printTex.dispose();
    this.plateTex.dispose();
    if (this.kit.hero.owner === this.spec.id) this.kit.hero.owner = null;
  }
}

/** Rivals: instanced red shirts (no prints) facing our goal, with red AR rings. */
export class Rivals {
  group = new Group();
  meshes: InstancedMesh[] = [];
  rings: InstancedMesh;
  items: { id: string; pos: Vector2; vel: Vector2; target: Vector2; driven: Vector2 | null; yaw: number; phase: number; fresh: boolean }[] = [];
  appear = 1;
  private mats: ShirtMat[] = [];
  private ringMat: MeshBasicMaterial;
  private dummy = new Object3D();
  private m4 = new Matrix4();
  private cap = 0;
  private kit: Kit;
  private ringGeo: PlaneGeometry;

  constructor(kit: Kit, ringGeo: PlaneGeometry) {
    this.kit = kit;
    this.ringGeo = ringGeo;
    this.ringMat = new MeshBasicMaterial({ map: kit.ring, color: C.rival, transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false, opacity: 0.7 });
    this.rings = new InstancedMesh(ringGeo, this.ringMat, 1);
    this.build(11);
  }

  private build(cap: number) {
    for (const m of this.meshes) {
      this.group.remove(m);
      m.dispose();
    }
    this.group.remove(this.rings);
    this.rings.dispose();
    this.meshes = [];
    for (const m of this.mats) m.dispose();
    this.mats = [];
    this.cap = cap;
    for (const part of this.kit.parts) {
      if (part.role === "inner") continue;
      const { mat } = this.kit.material(this.kit.rivalTex, part.role, 0xff8a8a, 0.18);
      this.mats.push(mat);
      const im = new InstancedMesh(part.geometry, mat, cap);
      im.instanceMatrix.setUsage(DynamicDrawUsage);
      im.castShadow = part.role === "outer";
      im.frustumCulled = false;
      im.userData.local = part.matrix;
      this.meshes.push(im);
      this.group.add(im);
    }
    this.rings = new InstancedMesh(this.ringGeo, this.ringMat, cap);
    this.rings.frustumCulled = false;
    this.rings.renderOrder = 2;
    this.group.add(this.rings);
  }

  set(list: RivalSpec[], animate: boolean) {
    if (list.length > this.cap) this.build(Math.max(list.length, this.cap * 2));
    const prev = new Map(this.items.map((r) => [r.id, r]));
    this.items = list.map((r, i) => {
      const [wx, wz] = toWorld(r.x, r.y);
      const old = prev.get(r.id);
      if (old) {
        old.target.set(wx, wz);
        if (!animate) old.pos.set(wx, wz);
        return old;
      }
      return { id: r.id, pos: new Vector2(wx, wz), vel: new Vector2(), target: new Vector2(wx, wz), driven: null, yaw: 0, phase: i * 1.3, fresh: true };
    });
  }

  tick(dt: number, t: number, cam: Vector3, reduce: boolean) {
    const e = easeOutBack(Math.min(1, Math.max(0, this.appear)));
    this.items.forEach((r, i) => {
      if (r.driven) {
        if (dt > 0) r.vel.set((r.driven.x - r.pos.x) / dt, (r.driven.y - r.pos.y) / dt);
        r.pos.copy(r.driven);
      } else {
        spring(r.pos, r.vel, r.target, dt);
      }
      const dx = cam.x - r.pos.x, dz = cam.z - r.pos.y, dl = Math.hypot(dx, dz) || 1;
      const want = Math.atan2(dx / dl, dz / dl + 0.2);
      r.yaw += r.fresh ? angleTo(r.yaw, want) : angleTo(r.yaw, want) * Math.min(1, dt * 4);
      r.fresh = false;
      const bob = reduce ? 0 : Math.sin(t * 1.6 + r.phase) * 0.08;
      this.dummy.position.set(r.pos.x, SHIRT_FLOAT + bob + (1 - e) * -(SHIRT_H + 1), r.pos.y);
      this.dummy.rotation.set(0, r.yaw, 0);
      this.dummy.scale.setScalar(0.94);
      this.dummy.updateMatrix();
      for (const m of this.meshes) {
        this.m4.multiplyMatrices(this.dummy.matrix, m.userData.local as Matrix4);
        m.setMatrixAt(i, this.m4);
      }
      this.dummy.position.set(r.pos.x, 0.03, r.pos.y);
      this.dummy.rotation.set(-Math.PI / 2, 0, 0);
      this.dummy.scale.setScalar(RING_SCALE * 0.88 * (0.35 + 0.65 * Math.min(1, Math.max(0, this.appear))));
      this.dummy.updateMatrix();
      this.rings.setMatrixAt(i, this.dummy.matrix);
    });
    for (const m of this.meshes) {
      m.count = this.items.length;
      m.instanceMatrix.needsUpdate = true;
    }
    this.rings.count = this.items.length;
    this.rings.instanceMatrix.needsUpdate = true;
    this.ringMat.opacity = 0.7 * Math.min(1, Math.max(0, this.appear));
  }

  addTo(scene: Scene) {
    scene.add(this.group);
  }

  dispose() {
    for (const m of this.meshes) m.dispose();
    for (const m of this.mats) m.dispose();
    this.rings.dispose();
    this.ringMat.dispose();
    this.group.removeFromParent();
  }
}
