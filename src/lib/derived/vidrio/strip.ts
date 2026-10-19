// «Vidrio» · the ribbon of light: one season as a strip of jornadas (the Partidos ribbon, its minimap and
// Inicio's season strip). Per match: its number, date, the light at kick-off and at the whistle (the sun over
// Palomeras), where it stands (jugado · directo · hoy · próximo · aplazado · suspendido · pendiente), the
// letter and the score; the months it crosses, the weeks without a match, «hoy» and the paging window. Pure:
// built on the rules every other surface reads (matchPhase, kickoffState, the one jornada numbering, scoreOf,
// the Madrid day, sun.ts), never a second copy of them.
import type { ClubMatch } from "../../clubData";
import { scoreOf } from "../../partidos";
import { norm } from "../../standings";
import { dateMillis, isVisibleMatch, matchPhase } from "../../../../functions/src/matchEngine";
import { calendarOrder, jornadas } from "../jornada";
import { kickoffState } from "../kickoff";
import { madridDate, MONTHS_SHORT } from "../madrid";
import { resultLetter, type ResultLetter } from "../result";
import { floodlightsOn, lightOf, sunPosition, sunTimes, type LightKey } from "../sun";

const DAY = 86_400_000;
const MIN = 60_000;

/** Where a jornada stands. «pendiente»: its time went by and there is no acta to tell it — a clock nobody
 *  started (or a legacy match without a clock): no score, no letter. A clock that ran to its final whistle
 *  but whose acta is still to come is «jugado» with `provisional` set (the score read from its plays). */
export type StripState = "jugado" | "directo" | "hoy" | "proximo" | "aplazado" | "suspendido" | "pendiente";
/** G · E · P, and A for a postponed jornada. */
export type StripLetter = ResultLetter | "A";

/** The light of a kick-off: at the first whistle, at the planned final one, the masts, and that day's sunset. */
export interface MatchLight {
  light: LightKey;
  lightEnd: LightKey;
  /** The floodlights are on by the end of the match (floodlightsOn, live). */
  floodlights: boolean;
  /** ms of that Madrid day's sunset over Palomeras. */
  sunset: number;
}

/** The light at a kick-off `at` (ms) for a match of `duration` minutes. */
export function lightAt(at: number, duration = 50): MatchLight {
  const end = at + duration * MIN;
  const endElevation = sunPosition(end).elevation;
  return {
    light: lightOf(sunPosition(at).elevation),
    lightEnd: lightOf(endElevation),
    floodlights: floodlightsOn(endElevation, true),
    sunset: sunTimes(at).sunset,
  };
}

/** A match's place on the strip at `now` (see StripState). */
export function stripStateOf(m: ClubMatch, now: number): StripState {
  const phase = matchPhase(m, now);
  if (phase === "cancelled") return "suspendido";
  if (phase === "postponed") return "aplazado";
  if (phase === "finished") return "jugado";
  if (phase === "playing") return "directo";
  if (phase === "awaiting_result") return clockRan(m) ? "jugado" : "pendiente";
  // scheduled or undated: today (Madrid's day, or a late kick-off still waiting for its whistle) or ahead
  if (kickoffState(m, now) === "pending_whistle") return "hoy";
  const at = dateMillis(m.date);
  return Number.isFinite(at) && madridDate(at) === madridDate(now) ? "hoy" : "proximo";
}

/** The clock ran to its final whistle (the plays it recorded are the match). */
const clockRan = (m: ClubMatch) => m.clock?.phase === "ended";

/** The score a strip may show: played (the acta's, or the plays' while the acta is pending), live (the plays'). */
function stripScore(m: ClubMatch, state: StripState, now: number): { score: { gf: number; ga: number } | null; provisional: boolean } {
  if (state !== "jugado" && state !== "directo") return { score: null, provisional: false };
  // (scoreOf: the acta's numbers once finished, the plays that stand before)
  return { score: scoreOf(m), provisional: matchPhase(m, now) !== "finished" };
}

export interface StripGap {
  /** Madrid days since the previous dated jornada. */
  days: number;
  /** Whole weeks without a match in between (14 days → 1). */
  weeks: number;
  /** The first Madrid day (YYYY-MM-DD) that would have had a match, a week after the previous one. */
  firstFreeDay: string;
}

export interface StripSegment<W = unknown> {
  /** Its place on the strip (0-based). */
  index: number;
  id: string;
  match: ClubMatch;
  /** The one numbering (derived/jornada); null for a cancelled match or a draft. */
  jornada: number | null;
  /** ms of the kick-off; null undated. */
  at: number | null;
  /** The Madrid day, YYYY-MM-DD; null undated. */
  day: string | null;
  /** 0–11, Madrid's month; null undated. */
  month: number | null;
  year: number | null;
  rival: string;
  home: boolean;
  state: StripState;
  letter: StripLetter | null;
  score: { gf: number; ga: number } | null;
  /** The score is read from the plays (live, or played with its acta still to come). */
  provisional: boolean;
  /** lightAt(kick-off); null undated. */
  light: MatchLight | null;
  /** 0–1 across the season's dated span (the minimap); null undated. */
  span: number | null;
  /** The first jornada of its month on the strip. */
  monthStart: boolean;
  /** The weeks without a match before it (null when it follows the previous one within a week). */
  gapBefore: StripGap | null;
  weather: W | null;
}

export interface StripMonth {
  /** The segment the month starts at. */
  index: number;
  month: number;
  year: number;
  /** «oct», «sept». */
  label: string;
}

export interface SeasonStrip<W = unknown> {
  segments: StripSegment<W>[];
  months: StripMonth[];
  /** Every gap of a week or more, with the segment it comes before. */
  gaps: (StripGap & { before: number })[];
  /** The jornada being played, else today's one; null when there is none today. */
  todayIndex: number | null;
  /** What the ribbon opens on: today's jornada, else the next to play, else the last one; null when empty. */
  focusIndex: number | null;
  counts: { total: number; played: number; live: number; today: number; upcoming: number; postponed: number; cancelled: number; pending: number };
}

const dayNumber = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / DAY;
};
const addDays = (day: string, n: number) => new Date((dayNumber(day) + n) * DAY).toISOString().slice(0, 10);

/** The matches a season's strip shows: visible, in the season, published (a draft is not in the calendar). */
export const stripMatches = (matches: readonly ClubMatch[], seasonId: string): ClubMatch[] =>
  matches.filter((m) => isVisibleMatch(m) && m.seasonId === seasonId && (m as { published?: boolean }).published !== false).sort(calendarOrder);

/** One season as the ribbon tells it at `now`. `weatherByMatch` (match id → anything) rides along. */
export function seasonStrip<W = unknown>(
  matches: readonly ClubMatch[],
  seasonId: string,
  now: number,
  weatherByMatch?: ReadonlyMap<string, W> | Readonly<Record<string, W>>,
): SeasonStrip<W> {
  const list = stripMatches(matches, seasonId);
  const number = jornadas(list, seasonId);
  const weatherOf = (id: string): W | null => {
    if (!weatherByMatch) return null;
    if (weatherByMatch instanceof Map) return weatherByMatch.get(id) ?? null;
    return Object.hasOwn(weatherByMatch, id) ? ((weatherByMatch as Readonly<Record<string, W>>)[id] ?? null) : null;
  };
  const dated = list.map((m) => dateMillis(m.date)).filter(Number.isFinite);
  const first = dated.length ? Math.min(...dated) : 0;
  const spanMs = dated.length ? Math.max(...dated) - first : 0;

  const segments: StripSegment<W>[] = [];
  const months: StripMonth[] = [];
  const gaps: SeasonStrip<W>["gaps"] = [];
  let prevDay: string | null = null;
  let prevMonth: string | null = null;
  list.forEach((m, index) => {
    const raw = dateMillis(m.date);
    const at = Number.isFinite(raw) ? raw : null;
    const day = at === null ? null : madridDate(at);
    const [year, month] = day ? day.split("-").map(Number) : [null, null];
    const state = stripStateOf(m, now);
    const { score, provisional } = stripScore(m, state, now);
    const letter: StripLetter | null = state === "aplazado" ? "A" : state === "jugado" && score ? resultLetter(score.gf, score.ga) : null;
    const monthKey = day ? day.slice(0, 7) : null;
    const monthStart = !!monthKey && monthKey !== prevMonth;
    if (monthStart && month !== null && year !== null) months.push({ index, month: month - 1, year, label: MONTHS_SHORT[month - 1] ?? "" });
    let gapBefore: StripGap | null = null;
    if (day && prevDay) {
      const days = dayNumber(day) - dayNumber(prevDay);
      const weeks = Math.round(days / 7) - 1;
      if (weeks >= 1) {
        gapBefore = { days, weeks, firstFreeDay: addDays(prevDay, 7) };
        gaps.push({ ...gapBefore, before: index });
      }
    }
    if (day) prevDay = day;
    if (monthKey) prevMonth = monthKey;
    segments.push({
      index,
      id: m.id,
      match: m,
      jornada: number.get(m.id) ?? null,
      at,
      day,
      month: month === null ? null : month - 1,
      year,
      rival: m.rival ?? "Rival",
      home: m.home !== false,
      state,
      letter,
      score,
      provisional,
      light: at === null ? null : lightAt(at, m.duration ?? 50),
      span: at === null ? null : spanMs > 0 ? (at - first) / spanMs : 0,
      monthStart,
      gapBefore,
      weather: weatherOf(m.id),
    });
  });

  const find = (s: StripState) => segments.findIndex((x) => x.state === s);
  const live = find("directo");
  const today = live >= 0 ? live : find("hoy");
  const next = find("proximo");
  const count = (s: StripState) => segments.filter((x) => x.state === s).length;
  return {
    segments,
    months,
    gaps,
    todayIndex: today >= 0 ? today : null,
    focusIndex: !segments.length ? null : today >= 0 ? today : next >= 0 ? next : segments.length - 1,
    counts: {
      total: segments.length,
      played: count("jugado"),
      live: count("directo"),
      today: count("hoy"),
      upcoming: count("proximo"),
      postponed: count("aplazado"),
      cancelled: count("suspendido"),
      pending: count("pendiente"),
    },
  };
}

// ───────────────────────── the window of the ribbon ─────────────────────────

export interface StripWindow {
  /** First index shown. */
  start: number;
  /** One past the last index shown. */
  end: number;
  size: number;
  total: number;
  hasPrev: boolean;
  hasNext: boolean;
  /** Where «anterior» / «siguiente» lead (a page keeps one segment of the last one in sight). */
  prevStart: number;
  nextStart: number;
}

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

/** The window of `size` segments starting at `start`, kept inside `total`. */
export function windowAt(start: number, size: number, total: number): StripWindow {
  const w = clamp(Math.floor(size), 0, Math.max(0, total));
  const s = clamp(Math.floor(start), 0, Math.max(0, total - w));
  const step = Math.max(1, w - 1);
  return {
    start: s,
    end: s + w,
    size: w,
    total,
    hasPrev: s > 0,
    hasNext: s + w < total,
    prevStart: clamp(s - step, 0, Math.max(0, total - w)),
    nextStart: clamp(s + step, 0, Math.max(0, total - w)),
  };
}

/** The window of `size` segments with `index` in the middle (at the edges, it stops at the season's ends). */
export function windowAround(index: number, size: number, total: number): StripWindow {
  return windowAt(index - Math.floor(Math.min(size, total) / 2), size, total);
}

/** A page of the ribbon: `direction` 1 (later) or −1 (earlier) from the window starting at `start`. */
export function pageWindow(start: number, direction: 1 | -1, size: number, total: number): StripWindow {
  const now = windowAt(start, size, total);
  return windowAt(direction > 0 ? now.nextStart : now.prevStart, size, total);
}

// ───────────────────────── filters and the rival search ─────────────────────────

export type StripFilter = "todos" | "proximos" | "resultados";
export const STRIP_FILTERS: readonly { id: StripFilter; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "proximos", label: "Próximos" },
  { id: "resultados", label: "Resultados" },
];
const AHEAD: ReadonlySet<StripState> = new Set(["hoy", "directo", "proximo", "aplazado"]);
const RESULTS: ReadonlySet<StripState> = new Set(["jugado", "directo", "pendiente"]);

/** The segments a filter keeps (in order): «Próximos» what is still to play (live and postponed included),
 *  «Resultados» what has a result or is waiting for one (live included). A cancelled one is only in «Todos». */
export function filterStrip<W>(segments: readonly StripSegment<W>[], filter: StripFilter): StripSegment<W>[] {
  if (filter === "proximos") return segments.filter((s) => AHEAD.has(s.state));
  if (filter === "resultados") return segments.filter((s) => RESULTS.has(s.state));
  return [...segments];
}

/** «Buscar rival»: the segments whose rival contains `query` (no accents, any case), up to `limit`. */
export function searchRival<W>(segments: readonly StripSegment<W>[], query: string, limit = 6): StripSegment<W>[] {
  const q = norm(query);
  if (!q) return [];
  return segments.filter((s) => norm(s.rival).includes(q)).slice(0, limit);
}
