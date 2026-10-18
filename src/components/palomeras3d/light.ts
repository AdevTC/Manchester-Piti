// The light over Palomeras: sky colours by the sun's elevation (celeste by day, gold at golden hour, navy
// at night), the weather on top, and the CSS sky of the first paint. Pure, no three.js.
import { sunPosition } from "../../lib/derived/sun";
import type { PalomerasState, WeatherKind } from "./types";

/** [elevation, top, mid, horizon, sun colour] */
type Stop = readonly [number, string, string, string, string];
export const SKY_STOPS: readonly Stop[] = [
  [-18, "#02061a", "#050c26", "#0a1536", "#000000"],
  [-9, "#040b24", "#0a1737", "#1a2b5c", "#1b2b5a"],
  [-5, "#0a1838", "#22386d", "#7d6276", "#e07a4a"],
  [-1.5, "#132d60", "#47669f", "#ef985c", "#ff8a3d"],
  [1.5, "#1b4380", "#7a9dcf", "#ffbd73", "#ffae48"],
  [5, "#1f4a8c", "#7f9fd0", "#ffc277", "#ffbc4f"],
  [12, "#24599a", "#86acd9", "#ffd291", "#ffd58c"],
  [25, "#2a67a7", "#6cabdd", "#d4e8f6", "#fff4dc"],
  [45, "#2a65a5", "#62a6dc", "#d8ecf8", "#fffaf0"],
];

const hex = (h: string): [number, number, number] => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];
const toHex = (c: readonly number[]) =>
  "#" + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");

/** Mixes two #rrggbb colours (k = 0 → a, 1 → b). */
export function mix(a: string, b: string, k: number): string {
  const A = hex(a);
  const B = hex(b);
  return toHex([A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k]);
}

/** Hermite smoothstep of x between a and b. */
export function smooth(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export interface SkyLight {
  top: string;
  mid: string;
  hor: string;
  sun: string;
  el: number;
  /** 0 at night → 1 by day. */
  day: number;
  /** 1 at night → 0 once the sun is up. */
  night: number;
  /** Cloud veil over the sky colours (0 clear, .16 cloudy, .62 rain). */
  cloud: number;
  /** Strength of the sunlight. */
  sunI: number;
  /** Golden hour, 0..1. */
  golden: number;
}

/** The sky at a solar elevation, under a kind of weather. */
export function skyAt(el: number, weather: WeatherKind = "despejado"): SkyLight {
  const K = SKY_STOPS;
  let i = 0;
  while (i < K.length - 2 && el > K[i + 1][0]) i++;
  const a = K[i];
  const b = K[i + 1];
  const k = Math.max(0, Math.min(1, (el - a[0]) / (b[0] - a[0])));
  let top = mix(a[1], b[1], k);
  let mid = mix(a[2], b[2], k);
  let hor = mix(a[3], b[3], k);
  const sun = mix(a[4], b[4], k);
  const day = smooth(-8, 10, el);
  const cloud = weather === "lluvia" ? 0.62 : weather === "nublado" ? 0.16 : 0;
  if (cloud) {
    top = mix(top, mix("#141d33", "#46566f", day), cloud);
    mid = mix(mid, mix("#1d2846", "#8d9bb0", day), cloud);
    hor = mix(hor, mix("#29324f", "#b4bccb", day), cloud * 0.8);
  }
  let sunI = smooth(-0.8, 9, el) * (1 - cloud * 0.75);
  let golden = smooth(-2, 1.5, el) * (1 - smooth(6, 16, el));
  if (weather === "lluvia") {
    sunI *= 0.18;
    golden *= 0.2;
  }
  return { top, mid, hor, sun, el, day, night: 1 - smooth(-7, 2, el), cloud, sunI, golden };
}

/** The app's weather (`MatchWeather`-shaped) → the three skies the ground knows. */
export function weatherKind(weather: PalomerasState["weather"]): WeatherKind {
  if (!weather) return "despejado";
  if (weather.sky === "rain" || weather.sky === "snow" || weather.sky === "storm") return "lluvia";
  if (typeof weather.rain === "number" && weather.rain >= 70) return "lluvia";
  if (weather.sky === "cloud" || weather.sky === "fog") return "nublado";
  if (typeof weather.cloud === "number" && weather.cloud >= 60) return "nublado";
  return "despejado";
}

/** How much of the cloud deck shows (0..1), from the cloud cover when the forecast carries it. */
export function cloudAmount(weather: PalomerasState["weather"]): number {
  const kind = weatherKind(weather);
  if (kind === "lluvia") return 1;
  const cover = weather?.cloud;
  if (typeof cover === "number") return Math.max(0.1, Math.min(1, cover / 100));
  return kind === "nublado" ? 0.7 : 0.18;
}

const MADRID_CLOCK = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Madrid",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});
/** Minutes since midnight on the Madrid clock (fractional). */
export function madridMinutes(ms: number): number {
  let h = 0;
  let m = 0;
  let s = 0;
  for (const p of MADRID_CLOCK.formatToParts(ms)) {
    if (p.type === "hour") h = Number(p.value);
    else if (p.type === "minute") m = Number(p.value);
    else if (p.type === "second") s = Number(p.value);
  }
  return h * 60 + m + s / 60;
}

export interface Lighting {
  el: number;
  minutes: number;
  kind: WeatherKind;
  sky: SkyLight;
}

/** Everything the painters need from `at` and the weather. */
export function lightingOf(at: number, weather?: PalomerasState["weather"]): Lighting {
  const el = sunPosition(at).elevation;
  const kind = weatherKind(weather ?? null);
  return { el, minutes: madridMinutes(at), kind, sky: skyAt(el, kind) };
}

/**
 * The first-paint CSS sky (server render): sky stops down to the horizon, then the ground. The horizon is
 * `--pm-hy` (set per rig by <Palomeras>), 50% when absent.
 */
export function skyCss(at: number, weather?: PalomerasState["weather"]): string {
  const { sky: s } = lightingOf(at, weather);
  const g0 = mix("#141c2a", "#2c3a48", s.day);
  const g1 = mix("#12261a", "#2c4a35", s.day);
  const g2 = mix("#173320", "#3f7346", s.day);
  const hy = "var(--pm-hy, 50%)";
  return (
    `linear-gradient(180deg, ${s.top} 0%, ${s.mid} calc(${hy} * .7), ${s.hor} ${hy}, ` +
    `${g0} calc(${hy} + .5%), ${g1} calc(${hy} + 9%), ${g2} 100%)`
  );
}
