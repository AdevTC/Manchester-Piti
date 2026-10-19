// The weather words, shared by the web (src/lib/weather.ts: the forecast for the previa) and the backend
// (weather.ts: the weather at kick-off stamped on a played match, `matches/{id}.weatherAtKickoff`).
// Open-Meteo (free, no key), WMO weather codes. Pure: apart so the app's tests can run it.

export type Sky = "sun" | "cloud" | "fog" | "rain" | "snow" | "storm";

/** WMO weather interpretation code → a short Spanish label and the kind of sky. */
export function wmo(code: number): { label: string; sky: Sky } {
  if (code === 0) return { label: "Despejado", sky: "sun" };
  if (code === 1) return { label: "Casi despejado", sky: "sun" };
  if (code === 2) return { label: "Nubes y claros", sky: "cloud" };
  if (code === 3) return { label: "Nublado", sky: "cloud" };
  if (code === 45 || code === 48) return { label: "Niebla", sky: "fog" };
  if (code >= 51 && code <= 57) return { label: "Llovizna", sky: "rain" };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { label: code >= 80 ? "Chubascos" : "Lluvia", sky: "rain" };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { label: "Nieve", sky: "snow" };
  if (code >= 95) return { label: "Tormenta", sky: "storm" };
  return { label: "Variable", sky: "cloud" };
}

/** `matches/{id}.weatherAtKickoff`: the weather at the kick-off hour of a played match («Hizo 15°»). */
export interface KickoffWeather {
  /** °C, rounded. */
  temp: number;
  label: string;
  sky: Sky;
  /** Cloud cover 0–100 % (null when the source lacks it). */
  cloud: number | null;
  /** For a past hour: the precipitation in mm (null when the source lacks it). */
  rain: number | null;
}

const TZ = "Europe/Madrid";
/** An hour in Madrid time, as Open-Meteo's start_hour wants it: "2026-11-08T12:00". */
export function madridHour(ms: number): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" })
      .formatToParts(ms)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:00`;
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Open-Meteo's answer for one hour (`hourly` with temperature_2m, weather_code, cloud_cover,
 *  precipitation) → the stamp; null when the temperature or the code is missing. */
export function readKickoffWeather(json: unknown): KickoffWeather | null {
  const h = (json as { hourly?: Record<string, unknown[] | undefined> } | null)?.hourly;
  const temp = num(h?.temperature_2m?.[0]);
  const code = num(h?.weather_code?.[0]);
  if (temp === null || code === null) return null;
  const cloud = num(h?.cloud_cover?.[0]);
  const rain = num(h?.precipitation?.[0]);
  return {
    temp: Math.round(temp),
    ...wmo(code),
    cloud: cloud === null ? null : Math.min(100, Math.max(0, Math.round(cloud))),
    rain: rain === null ? null : Math.max(0, Math.round(rain * 10) / 10),
  };
}

/** A stored stamp read back (null when missing or malformed: never shown half). */
export function parseKickoffWeather(v: unknown): KickoffWeather | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const temp = num(o.temp);
  if (temp === null || typeof o.label !== "string" || !o.label || typeof o.sky !== "string") return null;
  if (!["sun", "cloud", "fog", "rain", "snow", "storm"].includes(o.sky)) return null;
  return { temp, label: o.label, sky: o.sky as Sky, cloud: num(o.cloud), rain: num(o.rain) };
}
