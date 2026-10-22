// «Avisos de este partido»: a device's own choice for ONE match (the match page's sheet), shared by the web
// (src/lib/push.ts, src/pages/match/partido/avisos.ts) and the backend (push.ts: pushSetMatchTopics writes it,
// sendTo honours it). On the device's subscription doc it is `matchTopics: { [matchId]: topic[] }` (an empty
// list = nothing of that match), with `matchTopicsAt: { [matchId]: ms }` (when each was chosen: the oldest go
// first when the map is full). For a notice about that match the override decides alone — even against the
// device's global topics and its «Avisos a medida» preset; every other notice goes as before. No dependencies
// but pushPresets: the web's bundle imports it as it is.
import { presetAllows } from "./pushPresets.js";

/** The topics a device can choose for one match: the sheet's six switches, plus «dates» (an aplazado's
 *  «Avísame cuando haya fecha»). */
export const MATCH_TOPICS = ["start", "goals", "cards", "final", "lineup", "mvp", "dates"] as const;
export type MatchTopic = (typeof MATCH_TOPICS)[number];
const MATCH = new Set<string>(MATCH_TOPICS);
export const isMatchTopic = (t: unknown): t is MatchTopic => typeof t === "string" && MATCH.has(t);

/** At most this many matches keep an override on a device (the oldest choice goes first). */
export const MAX_MATCH_OVERRIDES = 12;
/** A finished match keeps its override this long after its date (its MVP vote closes 48 h after the acta). */
export const MATCH_OVERRIDE_DAYS_MS = 4 * 24 * 3600_000;

/** The device's override for `matchId` (null: none, the device's global topics decide). */
export function matchOverride(matchTopics: unknown, matchId: string | null | undefined): MatchTopic[] | null {
  if (!matchId || !matchTopics || typeof matchTopics !== "object") return null;
  const v = (matchTopics as Record<string, unknown>)[matchId];
  return Array.isArray(v) ? v.filter(isMatchTopic) : null;
}

/** The topic a notice answers to in a match's avisos (the descanso goes on «start» for the global switches,
 *  but it is «Descanso y final» in the match's sheet: Notice.matchTopic says so). */
export const noticeMatchTopic = (n: { topic: string; matchTopic?: string }): string => n.matchTopic ?? n.topic;

/**
 * Whether one device gets a notice: for a notice about `matchId` on one of the match topics, a device with an
 * override for that match gets it iff the override has the notice's topic (whatever its global topics or
 * preset say); any other case is today's rule (presetAllows: «Solo goles» only goals, «Nada» nothing).
 */
export function deviceGets(device: { preset?: unknown; matchTopics?: unknown }, notice: { topic: string; matchTopic?: string }, matchId: string | null | undefined): boolean {
  const topic = noticeMatchTopic(notice);
  if (matchId && isMatchTopic(topic)) {
    const own = matchOverride(device.matchTopics, matchId);
    if (own) return own.includes(topic);
  }
  return presetAllows(device.preset, notice.topic);
}

/** What the server knows of a match when it tidies the overrides (absent: gone). */
export interface MatchInfo {
  exists: boolean;
  archived?: boolean;
  status?: string;
  /** Its date (ms). */
  date?: number | null;
}

/**
 * The overrides a device keeps after choosing `topics` (null: drop it) for `matchId` at `now`: overrides of
 * matches that are gone or archived, or finished more than MATCH_OVERRIDE_DAYS_MS ago, go; then the oldest
 * choices beyond MAX_MATCH_OVERRIDES. The match just chosen always stays.
 */
export function nextMatchTopics(
  current: { matchTopics?: unknown; matchTopicsAt?: unknown },
  matchId: string,
  topics: readonly string[] | null,
  matches: ReadonlyMap<string, MatchInfo>,
  now: number,
): { matchTopics: Record<string, MatchTopic[]>; matchTopicsAt: Record<string, number> } {
  const map: Record<string, MatchTopic[]> = {};
  const at: Record<string, number> = {};
  const oldAt = current.matchTopicsAt && typeof current.matchTopicsAt === "object" ? (current.matchTopicsAt as Record<string, unknown>) : {};
  if (current.matchTopics && typeof current.matchTopics === "object") {
    for (const [id, v] of Object.entries(current.matchTopics as Record<string, unknown>)) {
      if (id === matchId || !Array.isArray(v)) continue;
      const m = matches.get(id);
      if (!m?.exists || m.archived) continue;
      if (m.status === "finished" && typeof m.date === "number" && m.date < now - MATCH_OVERRIDE_DAYS_MS) continue;
      map[id] = v.filter(isMatchTopic);
      const t = oldAt[id];
      at[id] = typeof t === "number" && Number.isFinite(t) ? t : 0;
    }
  }
  const room = MAX_MATCH_OVERRIDES - (topics ? 1 : 0);
  const keep = Object.keys(map).sort((a, b) => at[b] - at[a] || (a < b ? -1 : 1)).slice(0, Math.max(0, room));
  const outMap: Record<string, MatchTopic[]> = {};
  const outAt: Record<string, number> = {};
  for (const id of keep) {
    outMap[id] = map[id];
    outAt[id] = at[id];
  }
  if (topics) {
    outMap[matchId] = [...new Set(topics.filter(isMatchTopic))];
    outAt[matchId] = now;
  }
  return { matchTopics: outMap, matchTopicsAt: outAt };
}

/**
 * This device's topics for a match as its sheet shows them: its override when it has one, else the match
 * topics among its global ones (the app's saved topics).
 */
export function effectiveMatchTopics(override: readonly string[] | null | undefined, global: readonly string[]): MatchTopic[] {
  return [...new Set((override ?? global).filter(isMatchTopic))];
}
