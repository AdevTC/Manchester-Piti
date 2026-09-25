// three.js jersey scene (lazy-loaded chunk). Render-on-demand: it only animates while visible,
// stops when the page is hidden and settles completely under prefers-reduced-motion.
import {
  Box3,
  CanvasTexture,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  MeshPhysicalMaterial,
  NeutralToneMapping,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  SpotLight,
  SRGBColorSpace,
  Texture,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Mesh,
  type Object3D,
} from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { PRINT_FONTS } from "./fonts";
import { STILL } from "./scene-constants";
import { drawPrints, FONT_NUM, FONT_TXT, KIT_INK, type KitName, type Layouts } from "./prints";

export interface JerseyOptions {
  kit: KitName;
  theme: "dark" | "light";
  name: string;
  num: string;
  view?: "front" | "back";
  /** Spin in from the front to reveal the name on the back. */
  reveal?: boolean;
  zoom?: number;
  lift?: number;
}
export interface JerseyHandle {
  set(next: Partial<JerseyOptions>): void;
  /** Full eased turn; the new name/number are printed while the shirt faces front. */
  swap(next: Partial<JerseyOptions>): void;
  turn(): void;
  dispose(): void;
}

const KIT = 2048;
const BASE = "/models/";
const image = (src: string) =>
  new Promise<HTMLImageElement>((ok, ko) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = ko;
    i.src = src;
  });
interface Assets {
  home: HTMLImageElement;
  away: HTMLImageElement;
  crest: HTMLImageElement;
  normal: HTMLImageElement;
  gltf: GLTF;
  layout: Layouts;
}
// The prints need their own faces; the jersey loads them itself so it looks the same on every page.
function printFontsCss() {
  return new Promise<void>((resolve) => {
    let link = document.querySelector<HTMLLinkElement>("link[data-jersey-fonts]");
    if (link?.sheet) return resolve();
    if (!link) {
      link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = PRINT_FONTS;
      link.dataset.jerseyFonts = "";
      document.head.appendChild(link);
    }
    link.addEventListener("load", () => resolve(), { once: true });
    link.addEventListener("error", () => resolve(), { once: true });
    setTimeout(resolve, 4000); // never block the shirt on a slow font host
  });
}
let shared: Promise<Assets> | null = null;
function assets() {
  shared ??= (async () => {
    await printFontsCss();
    await Promise.all(
      [`600 100px ${FONT_NUM}`, `700 100px ${FONT_NUM}`, `600 100px ${FONT_TXT}`, `700 100px ${FONT_TXT}`].map((f) =>
        document.fonts.load(f).catch(() => null),
      ),
    );
    const [home, away, crest, normal, layout, gltf] = await Promise.all([
      image(BASE + "kit-home.png"),
      image(BASE + "kit-away.png"),
      image("/crest.png"),
      image(BASE + "jersey-normal.webp"),
      fetch(BASE + "kit-layout.json").then((r) => r.json() as Promise<Layouts>),
      new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(BASE + "jersey.glb"),
    ]);
    return { home, away, crest, normal, gltf, layout };
  })();
  shared.catch(() => {
    shared = null; // allow a retry after a network error
  });
  return shared;
}

const KNIT = `
vec2 mpKnit(vec2 uv){
  vec2 k = uv * vec2(620.0, 760.0);
  vec2 f = fract(k) - 0.5;
  float hole = 1.0 - smoothstep(0.14, 0.3, length(f * vec2(1.0, 1.4)));
  float fade = 1.0 - smoothstep(0.45, 1.4, length(fwidth(k)));
  return -f * hole * 1.3 * fade;
}`;

/** The lit scene with the kit on a pivot; shared by the live jersey and the still renderer. */
function stage(canvas: HTMLCanvasElement, o: Required<JerseyOptions>, A: Assets, preserve = false) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance", preserveDrawingBuffer: preserve });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  const camera = new PerspectiveCamera(26, 1, 0.1, 50);
  const key = new SpotLight(0xffffff, 85, 20, Math.PI / 6.5, 0.6, 1.5);
  const rimL = new DirectionalLight(0x9fd0f2, 3.2);
  rimL.position.set(-4, 2.5, -2.5);
  const rimR = new DirectionalLight(0xffc659, 1.4);
  rimR.position.set(4, 1.5, -2.5);
  const fill = new HemisphereLight(0x9fd0f2, 0x0a1532, 0.4);
  scene.add(key, key.target, rimL, rimR, fill);

  const kitCanvas = document.createElement("canvas");
  kitCanvas.width = kitCanvas.height = KIT;
  const kitTex = new CanvasTexture(kitCanvas);
  kitTex.flipY = false;
  kitTex.colorSpace = SRGBColorSpace;
  kitTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = maskCanvas.height = KIT / 2;
  const maskTex = new CanvasTexture(maskCanvas);
  maskTex.flipY = false;
  const normalTex = new Texture(A.normal);
  normalTex.flipY = false;
  normalTex.needsUpdate = true;
  const baseTex = {} as Record<KitName, Texture>;
  for (const k of ["home", "away"] as const) {
    const t = new Texture(A[k]);
    t.flipY = false;
    t.colorSpace = SRGBColorSpace;
    t.needsUpdate = true;
    baseTex[k] = t;
  }
  const fabric = (color: number, extra: Partial<ConstructorParameters<typeof MeshPhysicalMaterial>[0]> = {}) => {
    const m = new MeshPhysicalMaterial({
      map: kitTex,
      color,
      normalMap: normalTex,
      normalScale: new Vector2(0.9, 0.9),
      roughness: 0.74,
      metalness: 0,
      sheen: 1,
      sheenRoughness: 0.5,
      sheenColor: new Color(0xcfeaff),
      ...extra,
    });
    m.onBeforeCompile = (s) => {
      s.fragmentShader = s.fragmentShader
        .replace("#include <normalmap_pars_fragment>", "#include <normalmap_pars_fragment>\n" + KNIT)
        .replace("mapN.xy *= normalScale;", "mapN.xy *= normalScale;\n\tmapN.xy += mpKnit( vNormalMapUv );");
    };
    return m;
  };
  // vinyl prints skip the fabric's velvet sheen (sheen colour masked by the prints)
  const outer = fabric(0xffffff, { sheenColorMap: maskTex });
  const inner = fabric(0xb8c9dc, { sheen: 0.4, roughness: 0.9, map: baseTex[o.kit] });
  const trim = fabric(0xffffff, { roughness: 0.6, sheen: 0.7 });
  const shirt = A.gltf.scene.clone(true);
  shirt.traverse((node: Object3D) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh) return;
    const matName = Array.isArray(mesh.material) ? "" : mesh.material.name;
    // Object_1 / Object_3 are the inside faces: kit colours without the prints.
    mesh.material = mesh.name === "Object_1" || mesh.name === "Object_3" ? inner : matName === "Material206971" ? trim : outer;
  });
  const box = new Box3().setFromObject(shirt);
  const size = box.getSize(new Vector3()), centre = box.getCenter(new Vector3());
  shirt.position.sub(centre);
  const pivot = new Group();
  pivot.add(shirt);
  pivot.scale.setScalar(2.5 / size.y);
  scene.add(pivot);

  function paint() {
    const layout = A.layout[o.kit];
    const name = o.name.toUpperCase().slice(0, 14), num = o.num.replace(/\D/g, "").slice(0, 2);
    const g = kitCanvas.getContext("2d")!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(A[o.kit], 0, 0, KIT, KIT);
    drawPrints(g, 1, layout, KIT_INK[o.kit], name, num, A.crest);
    const gm = maskCanvas.getContext("2d")!;
    gm.setTransform(1, 0, 0, 1, 0, 0);
    gm.fillStyle = "#fff";
    gm.fillRect(0, 0, KIT, KIT);
    drawPrints(gm, 0.5, layout, { ink: "#000", accent: "#000" }, name, num, null);
    kitTex.needsUpdate = true;
    maskTex.needsUpdate = true;
    outer.sheenColor.set(o.kit === "home" ? 0xcfeaff : 0x555566);
    inner.map = baseTex[o.kit];
  }
  function light() {
    const day = o.theme === "light";
    key.color.set(day ? 0xfff1d6 : 0xffffff);
    key.intensity = day ? 70 : 85;
    key.position.set(day ? 3.5 : 0.6, 5.5, 3.2);
    rimL.color.set(day ? 0xffffff : 0x9fd0f2);
    rimL.intensity = day ? 1.2 : 3.2;
    rimR.color.set(day ? 0xdcefff : 0xffc659);
    rimR.intensity = day ? 1.0 : 1.4;
    fill.color.set(day ? 0xdcefff : 0x9fd0f2);
    fill.groundColor.set(day ? 0xb9c8da : 0x0a1532);
    fill.intensity = day ? 1.1 : 0.4;
  }
  paint();
  light();
  const dispose = () => {
    for (const m of [outer, inner, trim]) m.dispose();
    for (const tex of [kitTex, maskTex, normalTex, baseTex.home, baseTex.away]) tex.dispose();
    pmrem.dispose();
    renderer.dispose();
  };
  return { renderer, scene, camera, pivot, paint, light, dispose };
}

export async function mountJersey(canvas: HTMLCanvasElement, initial: JerseyOptions): Promise<JerseyHandle> {
  const o: Required<JerseyOptions> = { view: "back", reveal: true, zoom: 1, lift: 0, ...initial };
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const A = await assets();
  const { renderer, scene, camera, pivot, paint, light, dispose: disposeStage } = stage(canvas, o, A);

  const home = o.view === "front" ? 0 : Math.PI;
  let yaw = o.reveal && !reduceMotion ? home - Math.PI : home;
  let target = home, vel = 0, dragging = false, lastX = 0, t = 0, raf = 0, last = 0, visible = true, alive = true;
  let tween: { from: number; to: number; start: number; dur: number } | null = null;
  let pending: Partial<JerseyOptions> | null = null;
  const ease = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const onDown = (e: PointerEvent) => {
    dragging = true;
    lastX = e.clientX;
    canvas.setPointerCapture(e.pointerId);
    wake();
  };
  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    vel = dx * 0.012;
    target += vel;
    wake();
  };
  const onUp = () => {
    dragging = false;
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    target += e.key === "ArrowLeft" ? -0.4 : 0.4;
    wake();
  };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("keydown", onKey);
  function resize() {
    const w = canvas.clientWidth || 300, h = canvas.clientHeight || 400;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.set(0, 0.05 + o.lift, 6.4 / o.zoom);
    camera.updateProjectionMatrix();
    wake();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) wake();
  });
  io.observe(canvas);
  function wake() {
    if (!raf && visible && alive && !document.hidden) {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }
  }
  function tick(now: number) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;
    if (!dragging) {
      target += vel;
      vel *= 0.92;
    }
    if (tween) {
      const p = Math.min(1, (now - tween.start) / tween.dur);
      yaw = target = tween.from + (tween.to - tween.from) * ease(p);
      if (pending && p >= 0.5) {
        Object.assign(o, pending);
        pending = null;
        paint();
      }
      if (p >= 1) tween = null;
    } else yaw += (target - yaw) * Math.min(1, dt * (t < 2.2 ? 2.4 : 6));
    pivot.rotation.y = yaw + (reduceMotion ? 0 : Math.sin(t * 0.7) * 0.1);
    pivot.rotation.z = reduceMotion ? 0 : Math.sin(t * 0.9) * 0.012;
    pivot.position.y = reduceMotion ? 0 : Math.sin(t * 1.1) * 0.03;
    renderer.render(scene, camera);
    const settled = !tween && Math.abs(target - yaw) < 1e-3 && Math.abs(vel) < 1e-4;
    if (visible && alive && !document.hidden && !(reduceMotion && settled)) raf = requestAnimationFrame(tick);
  }
  const onVisibility = () => {
    if (!document.hidden) wake();
  };
  document.addEventListener("visibilitychange", onVisibility);
  resize();

  return {
    set(next) {
      const repaint = (["kit", "name", "num"] as const).some((k) => k in next && next[k] !== o[k]);
      Object.assign(o, next);
      if (repaint) paint();
      light();
      resize();
    },
    swap(next) {
      const repaint = (["kit", "name", "num"] as const).some((k) => k in next && next[k] !== o[k]);
      if (!repaint) return;
      if (reduceMotion || !visible || document.hidden) {
        Object.assign(o, next);
        paint();
        wake();
        return;
      }
      pending = { ...(pending ?? {}), ...next };
      const turns = Math.round((yaw - home) / (2 * Math.PI));
      tween = { from: yaw, to: home + (turns + 1) * 2 * Math.PI, start: performance.now(), dur: 1100 };
      vel = 0;
      wake();
    },
    turn() {
      target = Math.round(target / Math.PI) * Math.PI + Math.PI;
      wake();
    },
    dispose() {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("keydown", onKey);
      disposeStage();
    },
  };
}

export interface StillRequest {
  kit: KitName;
  theme: "dark" | "light";
  name: string;
  num: string;
  /** Turn away from the straight back view, in radians (the duel angles the shirts towards each other). */
  yaw?: number;
}
let stills: Promise<{ canvas: HTMLCanvasElement; o: Required<JerseyOptions>; s: ReturnType<typeof stage> }> | null = null;
let queue: Promise<unknown> = Promise.resolve();
/** A photo of the real kit's back (transparent WebP), rendered off-screen with one shared renderer. */
export function renderStill(r: StillRequest): Promise<Blob> {
  stills ??= assets().then((A) => {
    const canvas = document.createElement("canvas");
    const o: Required<JerseyOptions> = { view: "back", reveal: false, zoom: STILL.zoom, lift: STILL.lift, kit: r.kit, theme: r.theme, name: r.name, num: r.num };
    const s = stage(canvas, o, A, true);
    s.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    s.renderer.setSize(STILL.w, STILL.h, false);
    s.camera.aspect = STILL.w / STILL.h;
    s.camera.position.set(0, 0.05 + STILL.lift, 6.4 / STILL.zoom);
    s.camera.updateProjectionMatrix();
    return { canvas, o, s };
  });
  stills.catch(() => {
    stills = null;
  });
  const job = queue.then(() =>
    stills!.then(
      ({ canvas, o, s }) =>
        new Promise<Blob>((ok, ko) => {
          Object.assign(o, { kit: r.kit, theme: r.theme, name: r.name, num: r.num });
          s.paint();
          s.light();
          s.pivot.rotation.set(0, Math.PI + (r.yaw ?? 0), 0);
          s.renderer.render(s.scene, s.camera);
          canvas.toBlob((b) => (b ? ok(b) : ko(new Error("still"))), "image/webp", 0.9);
        }),
    ),
  );
  queue = job.catch(() => null);
  return job;
}
