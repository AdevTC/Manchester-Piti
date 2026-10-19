// The weather for a match (Open-Meteo: free, no key). The venue is free text, so it is geocoded by
// name in Spain; when nothing matches, the forecast is Madrid's and the label says so. Only for
// matches in the next 7 days (forecasts further out aren't worth showing).
import { useQuery } from "@tanstack/react-query";
import { dateMillis } from "../../functions/src/matchEngine";
import { wmo, type Sky } from "../../functions/src/weatherLogic";

const TZ = "Europe/Madrid";
const MADRID = { latitude: 40.4168, longitude: -3.7038, name: "Madrid" };
export const WEATHER_WINDOW_MS = 7 * 86_400_000;

export type { Sky } from "../../functions/src/weatherLogic";
export { wmo };

/** The kick-off hour in Madrid time, as Open-Meteo's start_hour wants it: "2026-11-08T12:00". */
export function kickoffHour(ms: number) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" })
      .formatToParts(ms)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:00`;
}

export interface MatchWeather {
  temp: number;
  rain: number | null;
  /** Cloud cover at kick-off, 0–100 % (Open-Meteo's hourly cloud_cover); null when the forecast lacks it. */
  cloud: number | null;
  label: string;
  sky: Sky;
  place: string;
  /** True when the venue wasn't found and the forecast is Madrid's. */
  approx: boolean;
}

/** Reads the forecast response for the kick-off hour. Exported for the tests. */
export function readForecast(json: unknown, place: string, approx: boolean): MatchWeather | null {
  const h = (json as { hourly?: { temperature_2m?: number[]; precipitation_probability?: (number | null)[]; weather_code?: number[]; cloud_cover?: (number | null)[] } })?.hourly;
  const temp = h?.temperature_2m?.[0];
  const code = h?.weather_code?.[0];
  if (typeof temp !== "number" || typeof code !== "number") return null;
  const rain = h?.precipitation_probability?.[0];
  const cloud = h?.cloud_cover?.[0];
  return {
    temp: Math.round(temp),
    rain: typeof rain === "number" ? rain : null,
    cloud: typeof cloud === "number" && Number.isFinite(cloud) ? Math.min(100, Math.max(0, Math.round(cloud))) : null,
    ...wmo(code),
    place,
    approx,
  };
}

async function locate(venue: string | undefined) {
  if (!venue?.trim()) return { ...MADRID, approx: true };
  try {
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(venue.trim())}&count=1&language=es&countryCode=ES`);
    const hit = ((await r.json()) as { results?: { latitude: number; longitude: number; name: string }[] }).results?.[0];
    if (hit) return { latitude: hit.latitude, longitude: hit.longitude, name: hit.name, approx: false };
  } catch {
    /* fall back to Madrid */
  }
  return { ...MADRID, approx: true };
}

export async function fetchMatchWeather(venue: string | undefined, kickoff: number): Promise<MatchWeather | null> {
  const at = await locate(venue);
  const hour = kickoffHour(kickoff);
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${at.latitude}&longitude=${at.longitude}&hourly=temperature_2m,precipitation_probability,weather_code,cloud_cover&timezone=${encodeURIComponent(TZ)}&start_hour=${hour}&end_hour=${hour}`;
  const r = await fetch(url);
  if (!r.ok) return null;
  return readForecast(await r.json(), at.name, at.approx);
}

/** The forecast for a match kicking off within the next 7 days (null otherwise or on failure). */
export function useMatchWeather(m: { venue?: string | null; date?: unknown } | undefined, now: number) {
  const kickoff = m ? dateMillis(m.date) : NaN;
  const enabled = Number.isFinite(kickoff) && kickoff > now && kickoff - now < WEATHER_WINDOW_MS;
  return useQuery({
    queryKey: ["weather", m?.venue ?? "", Number.isFinite(kickoff) ? kickoffHour(kickoff) : ""],
    queryFn: () => fetchMatchWeather(m?.venue ?? undefined, kickoff),
    enabled,
    staleTime: 60 * 60_000,
    retry: false,
  }).data ?? null;
}

// ---------- by hour (the previa: kick-off −1 h … +2 h)

/** One hour of the forecast around the kick-off. */
export interface WeatherHour {
  /** The hour's start (ms). */
  at: number;
  temp: number;
  /** WMO weather code. */
  code: number;
  /** Precipitation probability, 0–100 % (null when the forecast lacks it). */
  rain: number | null;
  label: string;
  sky: Sky;
  /** The kick-off hour (bold on the board). */
  kickoff: boolean;
}
export interface MatchWeatherHourly {
  /** Kick-off −1 h … +2 h: four hours when the forecast has them all. */
  hours: WeatherHour[];
  place: string;
  /** True when the venue wasn't found and the forecast is Madrid's («(el de Madrid)»). */
  approx: boolean;
}
const HOUR_MS = 3_600_000;

/** Reads the forecast response for the hours from `first` (ms, the hour before kick-off) on. Exported for the tests. */
export function readHourly(json: unknown, first: number, kickoff: number, place: string, approx: boolean): MatchWeatherHourly | null {
  const h = (json as { hourly?: { temperature_2m?: unknown[]; precipitation_probability?: unknown[]; weather_code?: unknown[] } })?.hourly;
  const temps = h?.temperature_2m ?? [];
  const kickHour = kickoffHour(kickoff);
  const hours: WeatherHour[] = [];
  for (let i = 0; i < temps.length; i++) {
    const temp = temps[i];
    const code = h?.weather_code?.[i];
    if (typeof temp !== "number" || !Number.isFinite(temp) || typeof code !== "number") continue;
    const rain = h?.precipitation_probability?.[i];
    const at = first + i * HOUR_MS;
    hours.push({ at, temp: Math.round(temp), code, rain: typeof rain === "number" && Number.isFinite(rain) ? rain : null, ...wmo(code), kickoff: kickoffHour(at) === kickHour });
  }
  return hours.length ? { hours, place, approx } : null;
}

export async function fetchMatchWeatherHourly(venue: string | undefined, kickoff: number): Promise<MatchWeatherHourly | null> {
  const at = await locate(venue);
  const first = kickoff - HOUR_MS;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${at.latitude}&longitude=${at.longitude}&hourly=temperature_2m,precipitation_probability,weather_code&timezone=${encodeURIComponent(TZ)}&start_hour=${kickoffHour(first)}&end_hour=${kickoffHour(kickoff + 2 * HOUR_MS)}`;
  const r = await fetch(url);
  if (!r.ok) return null;
  return readHourly(await r.json(), first, kickoff, at.name, at.approx);
}

/**
 * The forecast by hour (kick-off −1 h … +2 h) for a match kicking off within the next 7 days (null otherwise,
 * while loading or on failure: the board then says «La previsión por horas llega una semana antes.»). Cached
 * like useMatchWeather (an hour, per venue and kick-off hour).
 */
export function useMatchWeatherHourly(m: { venue?: string | null; date?: unknown } | undefined, now: number): MatchWeatherHourly | null {
  const kickoff = m ? dateMillis(m.date) : NaN;
  const enabled = Number.isFinite(kickoff) && kickoff > now && kickoff - now < WEATHER_WINDOW_MS;
  return (
    useQuery({
      queryKey: ["weather-hourly", m?.venue ?? "", Number.isFinite(kickoff) ? kickoffHour(kickoff) : ""],
      queryFn: () => fetchMatchWeatherHourly(m?.venue ?? undefined, kickoff),
      enabled,
      staleTime: 60 * 60_000,
      retry: false,
    }).data ?? null
  );
}
