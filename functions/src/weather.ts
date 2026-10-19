// «Hizo 15°, a la hora del pitido»: once a match's acta is published (status «finished»), the weather at its
// kick-off hour is stamped on it (`matches/{id}.weatherAtKickoff`, public, one read for everyone, no
// weather API from the web for old matches). Open-Meteo (free, no key): the venue is geocoded by name in
// Spain like the web does (Madrid when nothing matches). Never in the way of anything: a failure leaves
// the match without the stamp (a later write of the acta tries again).
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { db } from "./common.js";
import { madridHour, readKickoffWeather, weatherStampDue, type KickoffWeather } from "./weatherLogic.js";

const MADRID = { latitude: 40.4168, longitude: -3.7038 };
/** The forecast API keeps about three months back; older kick-offs are read from the historical forecasts. */
const RECENT_MS = 80 * 86_400_000;
const TIMEOUT_MS = 8000;

async function getJson(url: string): Promise<unknown> {
  const r = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!r.ok) throw new Error(`open-meteo ${r.status}`);
  return r.json();
}

async function locate(venue: unknown): Promise<{ latitude: number; longitude: number }> {
  if (typeof venue !== "string" || !venue.trim()) return MADRID;
  try {
    const j = (await getJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(venue.trim())}&count=1&language=es&countryCode=ES`)) as { results?: { latitude: number; longitude: number }[] };
    const hit = j.results?.[0];
    if (hit && Number.isFinite(hit.latitude) && Number.isFinite(hit.longitude)) return { latitude: hit.latitude, longitude: hit.longitude };
  } catch {
    /* Madrid's */
  }
  return MADRID;
}

/** The weather at `kickoff` (ms) at `venue`, or null. */
export async function kickoffWeather(venue: unknown, kickoff: number, now: number): Promise<KickoffWeather | null> {
  const at = await locate(venue);
  const hour = madridHour(kickoff);
  const q = `latitude=${at.latitude}&longitude=${at.longitude}&hourly=temperature_2m,weather_code,cloud_cover,precipitation&timezone=Europe%2FMadrid&start_hour=${hour}&end_hour=${hour}`;
  const hosts = now - kickoff < RECENT_MS ? ["api.open-meteo.com", "historical-forecast-api.open-meteo.com"] : ["historical-forecast-api.open-meteo.com", "api.open-meteo.com"];
  for (const host of hosts) {
    try {
      const w = readKickoffWeather(await getJson(`https://${host}/v1/forecast?${q}`));
      if (w) return w;
    } catch {
      /* the other one */
    }
  }
  return null;
}

export const weatherOnMatch = onDocumentWritten({ document: "matches/{matchId}", timeoutSeconds: 60 }, async (event) => {
  // (the emulators never call the weather service unless asked: PITI_WEATHER_EMULATOR=1)
  if (process.env.FUNCTIONS_EMULATOR === "true" && process.env.PITI_WEATHER_EMULATOR !== "1") return;
  const now = Date.now();
  const after = event.data?.after.data();
  const kickoff = weatherStampDue(after, now);
  if (kickoff === null) return;
  try {
    const w = await kickoffWeather(after?.venue, kickoff, now);
    if (!w) return;
    // (only if the acta is still the one read: same kick-off, still without a stamp)
    await db.runTransaction(async (tx) => {
      const ref = db.doc(`matches/${event.params.matchId}`);
      const snap = await tx.get(ref);
      if (weatherStampDue(snap.data(), now) !== kickoff) return;
      tx.update(ref, { weatherAtKickoff: w });
    });
  } catch (e) {
    console.warn("weatherOnMatch", event.params.matchId, e);
  }
});
