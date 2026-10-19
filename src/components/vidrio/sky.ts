// The light field's pure bits: which of the boards' lights a kick-off gets (from the site's sun), and the bokeh
// discs the canvas draws once (seeded, so every render is the same picture: the server's still and the shots).
import { floodlightsOn, lightOf, sunPosition, type LightKey } from "../../lib/derived/sun";

/** The boards' five lights (v-kit.css): golden hour, floodlit night, a late night without floodlights, midday
 *  in the dark theme, and the «día» theme's day. */
export type SkyLight = "golden" | "flood" | "late" | "noon" | "day";
/** What VidrioSky takes: the site's light key (sun.ts), or «noon» for a midday kick-off. */
export type SkyInput = LightKey | "noon";

/** The board light for a light key. `floodlit` (default: at night) turns the dusk and the night into the
 *  floodlit night; without it the night is the «late» one. */
export function skyLightOf(light: SkyInput, floodlit = light === "noche"): SkyLight {
  switch (light) {
    case "noche":
      return floodlit ? "flood" : "late";
    case "ocaso":
      return floodlit ? "flood" : "golden";
    case "dorada":
      return "golden";
    default:
      return "noon";
  }
}

/** The light over Palomeras at `ms` (a live match switches the floodlights on under 3°). */
export function skyAt(ms: number, live = false): { light: LightKey; floodlit: boolean } {
  const { elevation } = sunPosition(ms);
  return { light: lightOf(elevation), floodlit: floodlightsOn(elevation, live) };
}

export interface Disc {
  x: number;
  y: number;
  r: number;
  /** "r,g,b" */
  rgb: string;
  a: number;
}

/** A seeded random in [0, 1) (Park–Miller). */
export function seeded(seed: number): () => number {
  let s = seed % 2147483647 || 7;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const SEEDS: Record<SkyLight, number> = { golden: 11, day: 5, late: 23, flood: 3, noon: 17 };

/** The out-of-focus lights of the field, w × h (CSS px), ≤ 40 of them: two floodlight banks at night, the sun's
 *  flare chain at the golden hour, a few soft white ones by day. */
export function bokehDiscs(light: SkyLight, w: number, h: number): Disc[] {
  const R = seeded(SEEDS[light]);
  const big = Math.max(Math.min(w, 1440) / 1440, 0.45);
  const out: Disc[] = [];
  const bank = (cx: number, cy: number, n: number, rgb: string, amax: number, rmin: number, rmax: number) => {
    const bw = Math.max(w, 700);
    for (let i = 0; i < n; i++) {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const x = cx + (col - 1.5) * bw * 0.026 + (R() - 0.5) * bw * 0.016;
      const y = cy + row * bw * 0.022 + (R() - 0.5) * bw * 0.012;
      out.push({ x, y, r: rmin + R() * (rmax - rmin), rgb, a: amax * (0.45 + R() * 0.55) });
    }
  };
  if (light === "flood" || light === "late") {
    const a = light === "flood" ? 0.42 : 0.18;
    const n = light === "flood" ? 12 : 7;
    bank(w * 0.045, -h * 0.01, n, "236,246,255", a, 26 * big, 62 * big);
    bank(w * 0.955, -h * 0.01, n, "236,246,255", a, 26 * big, 62 * big);
    for (let i = 0; i < 9; i++) {
      const x = R() * w;
      const y = h * (0.2 + R() * 0.45);
      const r = (5 + R() * 14) * big;
      const rgb = R() > 0.6 ? "255,214,160" : "170,210,250";
      out.push({ x, y, r, rgb, a: (light === "flood" ? 0.07 : 0.04) + R() * 0.07 });
    }
  } else if (light === "golden") {
    const sx = w * 0.74;
    const sy = h * 0.58;
    out.push({ x: sx, y: sy, r: 70 * big, rgb: "255,214,150", a: 0.32 });
    for (let i = 1; i < 7; i++) {
      const t = i / 7;
      out.push({ x: sx + (w * 0.5 - sx) * t * 2.1, y: sy + (h * 0.42 - sy) * t * 2.1, r: (14 + R() * 36) * big, rgb: i % 2 ? "255,200,140" : "190,180,255", a: 0.1 + R() * 0.1 });
    }
    bank(w * 0.045, -h * 0.01, 8, "255,236,200", 0.12, 20 * big, 46 * big);
    bank(w * 0.955, -h * 0.01, 8, "255,236,200", 0.12, 20 * big, 46 * big);
    for (let i = 0; i < 8; i++) out.push({ x: R() * w, y: h * (0.4 + R() * 0.25), r: (5 + R() * 12) * big, rgb: "255,210,160", a: 0.06 + R() * 0.08 });
  } else {
    const n = light === "noon" ? 7 : 10;
    const k = light === "noon" ? 0.6 : 1;
    for (let i = 0; i < n; i++) out.push({ x: R() * w, y: h * (0.05 + R() * 0.5), r: (16 + R() * 50) * big, rgb: "255,255,255", a: (0.08 + R() * 0.1) * k });
  }
  return out.slice(0, 40);
}

/** Paints the discs on a 2D context (additive light: a nearly flat disc, a hint of a brighter rim, a soft
 *  shoulder; never a soap bubble). */
export function paintDiscs(g: CanvasRenderingContext2D, discs: readonly Disc[]): void {
  g.globalCompositeOperation = "lighter";
  for (const d of discs) {
    const gr = g.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r * 1.12);
    gr.addColorStop(0, `rgba(${d.rgb},${d.a * 0.62})`);
    gr.addColorStop(0.78, `rgba(${d.rgb},${d.a * 0.7})`);
    gr.addColorStop(0.9, `rgba(${d.rgb},${d.a * 0.82})`);
    gr.addColorStop(1, `rgba(${d.rgb},0)`);
    g.fillStyle = gr;
    g.beginPath();
    g.arc(d.x, d.y, d.r * 1.06, 0, Math.PI * 2);
    g.fill();
  }
}
