// Where the sun stands over Palomeras at a given instant, and what light that makes: the Inicio hero, the
// calendar's sky chips and the 3D ground all read the sun from here. NOAA's solar calculator (the spreadsheet
// formulas: good to about a minute for sunrise and sunset at these latitudes). Pure.
import { madridDate } from "./madrid";

export interface SunPosition {
  /** Degrees above the horizon (refraction included); negative below it. */
  elevation: number;
  /** Degrees from north, clockwise. */
  azimuth: number;
}

/** The club's ground (Palomeras, Vallecas). */
export const PALOMERAS = { lat: 40.39, lon: -3.66 } as const;

const RAD = Math.PI / 180;
const DAY_MS = 86_400_000;
const sin = (d: number) => Math.sin(d * RAD);
const cos = (d: number) => Math.cos(d * RAD);
const tan = (d: number) => Math.tan(d * RAD);
const deg = (r: number) => r / RAD;
const clamp1 = (x: number) => Math.min(1, Math.max(-1, x));
const mod = (x: number, n: number) => ((x % n) + n) % n;

/** The sun's declination (degrees) and the equation of time (minutes) at `ms`. */
function solar(ms: number): { decl: number; eqTime: number } {
  const jd = ms / DAY_MS + 2440587.5;
  const t = (jd - 2451545) / 36525;
  const l0 = mod(280.46646 + t * (36000.76983 + t * 0.0003032), 360);
  const m = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const c = sin(m) * (1.914602 - t * (0.004817 + 0.000014 * t)) + sin(2 * m) * (0.019993 - 0.000101 * t) + sin(3 * m) * 0.000289;
  const omega = 125.04 - 1934.136 * t;
  const lambda = l0 + c - 0.00569 - 0.00478 * sin(omega);
  const eps0 = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * cos(omega);
  const decl = deg(Math.asin(clamp1(sin(eps) * sin(lambda))));
  const y = tan(eps / 2) ** 2;
  const eqTime =
    4 * deg(y * sin(2 * l0) - 2 * e * sin(m) + 4 * e * y * sin(m) * cos(2 * l0) - 0.5 * y * y * sin(4 * l0) - 1.25 * e * e * sin(2 * m));
  return { decl, eqTime };
}

/** Atmospheric refraction (degrees) for a true elevation, NOAA's piecewise fit. */
function refraction(h: number): number {
  if (h > 85) return 0;
  const te = tan(h);
  const arcsec = h > 5 ? 58.1 / te - 0.07 / te ** 3 + 0.000086 / te ** 5 : h > -0.575 ? 1735 + h * (-518.2 + h * (103.4 + h * (-12.79 + h * 0.711))) : -20.774 / te;
  return arcsec / 3600;
}

/** The sun at `ms` seen from (`lat`, `lon`) (Palomeras by default). */
export function sunPosition(ms: number, lat: number = PALOMERAS.lat, lon: number = PALOMERAS.lon): SunPosition {
  const { decl, eqTime } = solar(ms);
  const utcMinutes = mod(ms, DAY_MS) / 60_000;
  const trueSolar = mod(utcMinutes + eqTime + 4 * lon, 1440);
  const hourAngle = trueSolar / 4 - 180;
  const cosZenith = clamp1(sin(lat) * sin(decl) + cos(lat) * cos(decl) * cos(hourAngle));
  const zenith = deg(Math.acos(cosZenith));
  const trueElevation = 90 - zenith;
  const sinZenith = Math.sin(zenith * RAD);
  // (straight overhead or at a pole the azimuth is undefined: north)
  const azArg = Math.abs(cos(lat) * sinZenith) < 1e-9 ? 1 : clamp1((sin(lat) * cosZenith - sin(decl)) / (cos(lat) * sinZenith));
  const a = deg(Math.acos(azArg));
  const azimuth = hourAngle > 0 ? mod(a + 180, 360) : mod(540 - a, 360);
  return { elevation: trueElevation + refraction(trueElevation), azimuth };
}

/** Minutes after UTC midnight of `dayStart` when the sun crosses the horizon (−0.833°, refraction and the
 *  disc's radius), rising (`-1`) or setting (`+1`); refined once with the sun at that moment. */
function crossing(dayStart: number, lat: number, lon: number, side: -1 | 1): number {
  let minutes = 720 - 4 * lon;
  for (let i = 0; i < 2; i++) {
    const { decl, eqTime } = solar(dayStart + minutes * 60_000);
    const cosH = clamp1((cos(90.833) - sin(lat) * sin(decl)) / (cos(lat) * cos(decl)));
    const ha = deg(Math.acos(cosH));
    minutes = 720 - 4 * (lon - side * ha) - eqTime;
  }
  return minutes;
}

/** Sunrise and sunset (ms) of the Madrid calendar day `ms` falls on, at (`lat`, `lon`). */
export function sunTimes(ms: number, lat: number = PALOMERAS.lat, lon: number = PALOMERAS.lon): { sunrise: number; sunset: number } {
  const [y, m, d] = madridDate(ms).split("-").map(Number);
  const dayStart = Date.UTC(y, m - 1, d);
  return {
    sunrise: Math.round(dayStart + crossing(dayStart, lat, lon, -1) * 60_000),
    sunset: Math.round(dayStart + crossing(dayStart, lat, lon, 1) * 60_000),
  };
}

/** The light the ground is in, by the sun's elevation. */
export type LightKey = "dia" | "tarde" | "dorada" | "ocaso" | "noche";

/** > 25° día · 10–25° tarde · 2–10° hora dorada · −4–2° ocaso · < −4° noche. */
export function lightOf(elevation: number): LightKey {
  if (elevation > 25) return "dia";
  if (elevation > 10) return "tarde";
  if (elevation > 2) return "dorada";
  if (elevation >= -4) return "ocaso";
  return "noche";
}

/** The floodlights: on for a live match once the sun is under 3°, and on any night (under −4°). */
export function floodlightsOn(elevation: number, live: boolean): boolean {
  return (live && elevation < 3) || elevation < -4;
}
