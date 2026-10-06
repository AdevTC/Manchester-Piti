// The weather for a match (Open-Meteo: free, no key). The venue is free text, so it is geocoded by
// name in Spain; when nothing matches, the forecast is Madrid's and the label says so. Only for
// matches in the next 7 days (forecasts further out aren't worth showing).
import { useQuery } from "@tanstack/react-query";
import { dateMillis } from "../../functions/src/matchEngine";

const TZ = "Europe/Madrid";
const MADRID = { latitude: 40.4168, longitude: -3.7038, name: "Madrid" };
export const WEATHER_WINDOW_MS = 7 * 86_400_000;

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
  label: string;
  sky: Sky;
  place: string;
  /** True when the venue wasn't found and the forecast is Madrid's. */
  approx: boolean;
}

/** Reads the forecast response for the kick-off hour. Exported for the tests. */
export function readForecast(json: unknown, place: string, approx: boolean): MatchWeather | null {
  const h = (json as { hourly?: { temperature_2m?: number[]; precipitation_probability?: (number | null)[]; weather_code?: number[] } })?.hourly;
  const temp = h?.temperature_2m?.[0];
  const code = h?.weather_code?.[0];
  if (typeof temp !== "number" || typeof code !== "number") return null;
  const rain = h?.precipitation_probability?.[0];
  return { temp: Math.round(temp), rain: typeof rain === "number" ? rain : null, ...wmo(code), place, approx };
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
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${at.latitude}&longitude=${at.longitude}&hourly=temperature_2m,precipitation_probability,weather_code&timezone=${encodeURIComponent(TZ)}&start_hour=${hour}&end_hour=${hour}`;
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
