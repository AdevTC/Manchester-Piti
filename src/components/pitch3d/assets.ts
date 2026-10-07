// Loads the real kit: the GLB shirt (Meshopt), the UV layout of the prints, the home/away kit
// atlases, the fabric normal map, the crest and the print faces. Shared between mounts (cached by
// URL set) and retried after a failure. Same files as the 3D shirt of the vestuario (/models/).
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { FONT_NUM, FONT_TXT, type Layouts } from "../jersey3d/prints";
import type { AssetUrls } from "./types";

export interface Assets {
  gltf: GLTF;
  layout: Layouts;
  home: ImageBitmap;
  away: ImageBitmap;
  normal: ImageBitmap;
  crest: ImageBitmap | null;
}

/** The app's copies (public/models, public/crest-256.webp); the service worker caches /models/. */
export const DEFAULT_ASSETS: AssetUrls = {
  glb: "/models/jersey.glb",
  layout: "/models/kit-layout.json",
  kitHome: "/models/kit-home.png",
  kitAway: "/models/kit-away.png",
  normal: "/models/jersey-normal.webp",
  crest: "/crest-256.webp",
};

function blobOf(src: string): Promise<Blob> {
  return fetch(src).then((r) => {
    if (!r.ok) throw new Error(`${src}: ${r.status}`);
    return r.blob();
  });
}
const image = (src: string) => blobOf(src).then((b) => createImageBitmap(b, { colorSpaceConversion: "none", premultiplyAlpha: "none" }));
function json<T>(src: string): Promise<T> {
  return fetch(src).then((r) => {
    if (!r.ok) throw new Error(`${src}: ${r.status}`);
    return r.json() as Promise<T>;
  });
}
function loadGltf(src: string): Promise<GLTF> {
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(src);
}

/**
 * Faces used on canvases; the page declares them with @font-face (styles/fonts.css). The shirt
 * prints keep the real kit lettering (Barlow, as in the app's 3D shirt); tags and LED boards use
 * the club faces.
 */
export const PRINT_FACES = [`600 100px ${FONT_NUM}`, `700 100px ${FONT_NUM}`, `600 100px ${FONT_TXT}`, `700 100px ${FONT_TXT}`];
export const UI_FACES = ["800 condensed 60px Anybody", "600 44px Geist", "700 30px 'Geist Mono'"];

function faces(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return Promise.resolve();
  const all = Promise.all([...PRINT_FACES, ...UI_FACES].map((f) => document.fonts.load(f).catch(() => null))).then(() => undefined);
  // never hold the stadium hostage to a font: fall back after 2.5 s
  return Promise.race([all, new Promise<void>((ok) => setTimeout(ok, 2500))]);
}

const cache = new Map<string, Promise<Assets>>();

export function loadAssets(urls: AssetUrls): Promise<Assets> {
  const key = Object.values(urls).join("|");
  let p = cache.get(key);
  if (!p) {
    p = (async () => {
      const f = faces();
      const [gltf, layout, home, away, normal, crest] = await Promise.all([
        loadGltf(urls.glb),
        json<Layouts>(urls.layout),
        image(urls.kitHome),
        image(urls.kitAway),
        image(urls.normal),
        urls.crest ? image(urls.crest).catch(() => null) : Promise.resolve(null),
      ]);
      await f;
      return { gltf, layout, home, away, normal, crest };
    })();
    cache.set(key, p);
    p.catch(() => cache.delete(key));
  }
  return p;
}
