// Real refraction for the lens glass (the boards' VK.refract): a displacement map shaped like a convex squircle
// bezel (steep at the rim, flat inside) drives an SVG feDisplacementMap, three passes a little apart give the
// faint chromatic edge, and the element's backdrop-filter becomes `blur() url(#map) saturate()`. Chromium only
// (env.canRefract); everywhere else the blur glass stays. One filter per size, in one hidden <svg>; the last 24
// sizes stay cached (a resize drag would otherwise leave a filter behind for every width it went through).
import { Lru } from "./lru";

const NS = "http://www.w3.org/2000/svg";

/** Signed distance from (x, y) to a w × h rounded rectangle of radius r (negative inside). */
export function roundedRectSdf(x: number, y: number, w: number, h: number, r: number): number {
  const hw = w / 2;
  const hh = h / 2;
  const rr = Math.min(r, hw, hh);
  const px = Math.abs(x - hw) - (hw - rr);
  const py = Math.abs(y - hh) - (hh - rr);
  const ox = Math.max(px, 0);
  const oy = Math.max(py, 0);
  return Math.sqrt(ox * ox + oy * oy) + Math.min(Math.max(px, py), 0) - rr;
}

export interface DisplacementMap {
  width: number;
  height: number;
  /** RGBA, R = x shift and G = y shift around 128 (no shift). */
  data: Uint8ClampedArray;
}

/** The map for a w × h glass with corner radius r and a bezel `bezel` px wide, sampled at ≤ 560 px. */
export function displacementMap(w: number, h: number, r: number, bezel: number): DisplacementMap {
  const s = Math.min(1, 560 / Math.max(w, h));
  const W = Math.max(8, Math.round(w * s));
  const H = Math.max(8, Math.round(h * s));
  const data = new Uint8ClampedArray(W * H * 4);
  const sdf = (x: number, y: number) => roundedRectSdf(x, y, w, h, r);
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const x = (i + 0.5) / s;
      const y = (j + 0.5) / s;
      const k = (j * W + i) * 4;
      const inside = -sdf(x, y);
      let dx = 0;
      let dy = 0;
      if (inside < bezel) {
        const e = 1.2;
        const gx = sdf(x + e, y) - sdf(x - e, y);
        const gy = sdf(x, y + e) - sdf(x, y - e);
        const gl = Math.sqrt(gx * gx + gy * gy) || 1;
        const t = Math.max(0, Math.min(1, inside / bezel));
        const m = Math.pow(1 - t, 2.2);
        dx = -(gx / gl) * m;
        dy = -(gy / gl) * m;
      }
      data[k] = Math.round(128 + dx * 127);
      data[k + 1] = Math.round(128 + dy * 127);
      data[k + 2] = 128;
      data[k + 3] = 255;
    }
  }
  return { width: W, height: H, data };
}

export interface LensOptions {
  /** Bezel width in px (default 22). */
  bezel?: number;
  /** Strength: displacement = bezel × strength (default 1.3). */
  strength?: number;
  /** The blur under the refraction in px (default 10). */
  blur?: number;
}

/** The backdrop-filter value for a filter id. */
export const lensBackdrop = (id: string, blur = 10): string => `blur(${blur}px) url(#${id}) saturate(1.7) brightness(1.05)`;

/** A filter a lensed element still shows (useRefraction marks it [data-vd-lensed=id]) is never dropped: it goes
 *  once that element has moved on to another size. */
const inUse = (id: string): boolean => !!document.querySelector(`[data-vd-lensed="${id}"]`);

const LENS_CACHE = 24;
const cache = new Lru<string>(
  LENS_CACHE,
  (id) => !inUse(id),
  (id) => document.getElementById(id)?.remove(),
);
let seq = 0;
// (one canvas for every map: each build resizes it, which clears it, and putImageData then writes every pixel)
let canvas: HTMLCanvasElement | null = null;

function defsRoot(): SVGSVGElement {
  let svg = document.getElementById("vd-lens-defs") as SVGSVGElement | null;
  if (!svg) {
    svg = document.createElementNS(NS, "svg");
    svg.id = "vd-lens-defs";
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.setAttribute("aria-hidden", "true");
    svg.style.position = "absolute";
    svg.style.left = "-9999px";
    document.body.appendChild(svg);
  }
  return svg;
}

function el(tag: string, attrs: Record<string, string>): SVGElement {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
}

/** The filter for one size (created once, then cached); null when the map can't be drawn (no canvas). */
export function lensFilter(w: number, h: number, r: number, bezel = 22, strength = 1.3): string | null {
  const key = [Math.round(w), Math.round(h), Math.round(r), bezel, strength].join("x");
  const hit = cache.get(key);
  if (hit) return hit;
  const map = displacementMap(w, h, r, bezel);
  const c = (canvas ??= document.createElement("canvas"));
  c.width = map.width;
  c.height = map.height;
  const g = c.getContext("2d");
  if (!g) return null;
  const img = g.createImageData(map.width, map.height);
  img.data.set(map.data);
  g.putImageData(img, 0, 0);
  const href = c.toDataURL();
  const id = `vd-lf-${seq++}`;
  const f = el("filter", { id, x: "0", y: "0", width: String(w), height: String(h), filterUnits: "userSpaceOnUse", primitiveUnits: "userSpaceOnUse", "color-interpolation-filters": "sRGB" });
  const im = el("feImage", { x: "0", y: "0", width: String(w), height: String(h), preserveAspectRatio: "none", result: "map", href });
  f.appendChild(im);
  const S = bezel * strength;
  const channels: [string, string, number][] = [
    ["R", "1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0", 1],
    ["G", "0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0", 1.06],
    ["B", "0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0", 1.13],
  ];
  for (const [ch, values, k] of channels) {
    f.appendChild(el("feDisplacementMap", { in: "SourceGraphic", in2: "map", scale: String(Math.round(S * k * 10) / 10), xChannelSelector: "R", yChannelSelector: "G", result: `d${ch}` }));
    f.appendChild(el("feColorMatrix", { in: `d${ch}`, type: "matrix", values, result: `c${ch}` }));
  }
  f.appendChild(el("feComposite", { in: "cR", in2: "cG", operator: "arithmetic", k1: "0", k2: "1", k3: "1", k4: "0", result: "rg" }));
  f.appendChild(el("feComposite", { in: "rg", in2: "cB", operator: "arithmetic", k1: "0", k2: "1", k3: "1", k4: "0" }));
  defsRoot().appendChild(f);
  cache.set(key, id);
  return id;
}
