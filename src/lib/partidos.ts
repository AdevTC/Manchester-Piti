import { clockReading } from "../../functions/src/matchClock";
// Pure logic for the Partidos page (Celeste, "Noche de focos"): the season of one team as the page
// tells it — the tile strip, the numbers, the next/live match and the calendar rows — plus the live
// score read from the acta while a match is being played (goals are only stored once it's finished).
import { dateMillis, EVENT_LABELS, eventMinute, isCompleted, isVisibleMatch, matchPhase, minuteOfPlay, type MatchEvent } from "../../functions/src/matchEngine";
import type { ClubMatch } from "./clubData";
import { jornadas } from "./derived/jornada";
import { withGuestNames, type MatchGuest } from "./derived/guests";
import { resultLetter, type ResultLetter } from "./derived/result";
import { capital } from "./derived/words";
import { eventMetaOf, eventSentence, isMesaType, settled } from "./eventMeta";
import { eventSeconds } from "../../functions/src/matchAnalysis";

export type Result = ResultLetter;
export type Filter = "all" | "next" | "results";
/** Event types that count as a goal for us / against us (the score is read from them while a match is live). */
export const OURS = new Set(["goal", "goal_penalty", "goal_freekick", "opponent_own_goal"]);
export const THEIRS = new Set(["opponent_goal", "own_goal"]);
const TZ = "Europe/Madrid";

const byDate = (a: ClubMatch, b: ClubMatch) => dateMillis(a.date) - dateMillis(b.date);

/** Goals for/against: the stored score once finished, otherwise counted from the acta's events. A possible
 *  duplicate still unresolved (`dupOf` without `dupOk`, eventMeta isPendingDup) counts once, as the server does. */
export function scoreOf(m: Pick<ClubMatch, "goalsFor" | "goalsAgainst" | "events" | "status">) {
  if ((!m.status || m.status === "finished") && typeof m.goalsFor === "number" && typeof m.goalsAgainst === "number") return { gf: m.goalsFor, ga: m.goalsAgainst };
  let gf = 0, ga = 0;
  for (const e of settled(m.events)) {
    if (OURS.has(e.type)) gf++;
    else if (THEIRS.has(e.type)) ga++;
  }
  return { gf, ga };
}

export function resultOf(m: Pick<ClubMatch, "goalsFor" | "goalsAgainst" | "events">): Result {
  const { gf, ga } = scoreOf(m);
  return resultLetter(gf, ga);
}

/** Our scorers in a match, most goals first: "ADRIÁN T.C. ×2, HUBEROSKI" — a guest of that match
 *  (`guests`) as «Rafa (invitado)». */
export function scorersLine(events: MatchEvent[] | undefined, memberName: (id: string) => string, match?: { guests?: MatchGuest[] } | null) {
  const nameOf = withGuestNames(match, memberName);
  const count = new Map<string, number>();
  const standing = settled(events);
  for (const e of standing) if (OURS.has(e.type) && e.type !== "opponent_own_goal" && e.playerId) count.set(e.playerId, (count.get(e.playerId) ?? 0) + 1);
  const own = standing.filter((e) => e.type === "opponent_own_goal").length;
  const parts = [...count.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => (n > 1 ? `${nameOf(id)} ×${n}` : nameOf(id)));
  if (own) parts.push(own > 1 ? `autogol rival ×${own}` : "autogol rival");
  return parts.join(", ");
}

/** `awaiting`: played, its acta still to come (matchPhase awaiting_result) — never «por jugar». */
export type TileState = "played" | "live" | "next" | "awaiting" | "future";
export interface Tile {
  id: string;
  j: number;
  rival: string;
  state: TileState;
  result?: Result;
}

/** One season as the page tells it. `now` decides what is live, next and played. */
export function seasonView(matches: ClubMatch[], seasonId: string, now: number) {
  // (the one numbering — derived/jornada: published, not cancelled, by date, in its own season — and
  // the season in that order)
  const jornada = jornadas(matches, seasonId);
  const season = matches.filter((m) => jornada.has(m.id)).sort((a, b) => (jornada.get(a.id) ?? 0) - (jornada.get(b.id) ?? 0));
  const live = season.find((m) => matchPhase(m, now) === "playing");
  const next = season.find((m) => matchPhase(m, now) === "scheduled");
  const played = season.filter((m) => isCompleted(m));
  const results = played.map(resultOf);
  const tiles: Tile[] = season.map((m) => ({
    id: m.id,
    j: jornada.get(m.id) ?? 0,
    rival: m.rival ?? "Rival",
    state: m === live ? "live" : m === next ? "next" : isCompleted(m) ? "played" : matchPhase(m, now) === "awaiting_result" ? "awaiting" : "future",
    result: isCompleted(m) ? resultOf(m) : undefined,
  }));
  return {
    season,
    live,
    next,
    played,
    tiles,
    /** Jornada number (derived/jornada) of each match in the season. */
    jornada,
    wins: results.filter((r) => r === "G").length,
    draws: results.filter((r) => r === "E").length,
    losses: results.filter((r) => r === "P").length,
    gf: played.reduce((s, m) => s + scoreOf(m).gf, 0),
    ga: played.reduce((s, m) => s + scoreOf(m).ga, 0),
  };
}
export type SeasonView = ReturnType<typeof seasonView>;

/** Calendar rows: upcoming first (soonest first), then results (latest first), by filter and rival search.
 *  «Resultados» also lists the played ones still waiting for their acta (a clock that never started
 *  included: «Pendiente del acta»), so no match falls out of both filters. */
export function calendarRows(matches: ClubMatch[], filter: Filter, search: string, now: number) {
  const q = search.trim().toLocaleLowerCase("es");
  const upcoming = (m: ClubMatch) => ["scheduled", "playing", "postponed", "unscheduled"].includes(matchPhase(m, now));
  const result = (m: ClubMatch) => isCompleted(m) || matchPhase(m, now) === "awaiting_result";
  return matches
    .filter(isVisibleMatch)
    .filter((m) => !q || (m.rival ?? "").toLocaleLowerCase("es").includes(q))
    .filter((m) => filter === "all" || (filter === "next" ? upcoming(m) : result(m)))
    .sort((a, b) => {
      const ua = upcoming(a), ub = upcoming(b);
      if (ua !== ub) return ua ? -1 : 1;
      return ua ? byDate(a, b) : byDate(b, a);
    });
}

/** Days/hours/minutes/seconds until `target` (zeros once it has passed), as two-digit strings. */
export function countdownParts(target: number, now: number) {
  const left = Math.max(0, Math.floor((target - now) / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  return { d: pad(Math.floor(left / 86400)), h: pad(Math.floor((left % 86400) / 3600)), m: pad(Math.floor((left % 3600) / 60)), s: pad(left % 60), done: left === 0 };
}

/** The minute being played, as the data counts it: a clock's whole minutes elapsed (0 in the first one: the
 *  minute live events are stamped with), or for a match without a clock the schedule's 1–duration. Null when
 *  not live. To SHOW a minute to people use shownMinute / eventMinute (football's 1-based convention). */
export function liveMinute(m: Pick<ClubMatch, "date" | "duration" | "clock">, now: number) {
  if (m.clock) return m.clock.phase === "ready" ? null : Math.floor(clockReading(m.clock, now).elapsedSeconds / 60);
  const start = dateMillis(m.date);
  if (!Number.isFinite(start) || now < start) return null;
  return Math.min(m.duration ?? 50, Math.floor((now - start) / 60_000) + 1);
}

/** minuteOfPlay / eventMinute live in functions/src/matchEngine (the push notices read minutes the same way). */
export { eventMinute, minuteOfPlay };

/** The live minute to SHOW (the island, the boards, the admin LED): the clock's in football's convention, or for a
 *  match without a clock the schedule's (already 1-based, capped at its duration). Null when not live. */
export function shownMinute(m: Pick<ClubMatch, "date" | "duration" | "clock">, now: number): number | null {
  if (!m.clock) return liveMinute(m, now);
  if (m.clock.phase === "ready") return null;
  const r = clockReading(m.clock, now);
  return minuteOfPlay(r.elapsedSeconds, r.playing);
}

/** A cambio's minute to SHOW, from a ledger exchange (the acta's time: fractional when the clock stamped it):
 *  its substitution event's eventMinute, so it reads as it did live; without one, the exchange's own. */
export function exchangeMinute(events: readonly MatchEvent[] | undefined, playerId: string, ex: { minute: number; with: string; direction: "in" | "out" }): number {
  const sub = events?.find(
    (e) =>
      e.type === "substitution" &&
      (ex.direction === "out" ? e.playerId === playerId && e.inPlayerId === ex.with : e.inPlayerId === playerId && e.playerId === ex.with) &&
      Math.abs((e.elapsedSeconds ?? (e.minute ?? 0) * 60) / 60 - ex.minute) < 1e-6,
  );
  const shown = sub ? eventMinute(sub) : null;
  return shown ?? (Number.isInteger(ex.minute) ? ex.minute : minuteOfPlay(ex.minute * 60));
}

/** The offset from a stored live minute (liveMinute's count) to the shown one: +1 on a clock, 0 without one. */
export const shownOffset = (m: Pick<ClubMatch, "clock">): number => (m.clock ? 1 : 0);

const fmt = (ms: number, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("es-ES", { timeZone: TZ, ...o }).format(ms);
/** Date pieces for a calendar row: "DOM", "8", "NOV", "12:00", "domingo, 8 nov" (and "Domingo, 8 nov" to open a line). */
export function dateParts(date: unknown) {
  const ms = dateMillis(date);
  if (!Number.isFinite(ms)) return { wd: "—", day: "?", mon: "", time: "—", long: "Fecha por confirmar", longCap: "Fecha por confirmar" };
  const long = fmt(ms, { weekday: "long", day: "numeric", month: "short" }).replace(".", "");
  return {
    wd: fmt(ms, { weekday: "short" }).replace(".", "").toUpperCase(),
    day: fmt(ms, { day: "numeric" }),
    mon: fmt(ms, { month: "short" }).replace(".", "").toUpperCase(),
    time: fmt(ms, { hour: "2-digit", minute: "2-digit" }),
    long,
    longCap: capital(long),
  };
}

/** The latest play in the acta (by time of play; a tie, the later written), as la mesa records them
 *  (eventMeta isMesaType: never a narrated pass) and without a pending duplicate. `title` / `sub` tell it
 *  (eventMeta eventSentence: «Gol de Erik», «Falta de Atlético»); `who` / `label` are its parts; `tag` the
 *  strap's word; `tone` gold for our goal, coral for theirs; the minute as shown (eventMinute). */
export function lastEvent(events: MatchEvent[] | undefined, nameOf: (id: string) => string, rival: string) {
  const list = settled(events)
    .map((e, order) => ({ e, order }))
    .filter(({ e }) => isMesaType(e.type) && (typeof e.minute === "number" || typeof e.elapsedSeconds === "number"));
  const e = list.sort((a, b) => eventSeconds(a.e) - eventSeconds(b.e) || a.order - b.order).at(-1)?.e;
  if (!e) return null;
  const meta = eventMetaOf(e);
  const said = eventSentence(e, { nameOf, rival });
  const who = meta.side === "them" ? rival : e.type === "substitution" && e.inPlayerId ? nameOf(e.inPlayerId) : e.playerId ? nameOf(e.playerId) : "Manchester Piti";
  const tone = meta.goal === "for" ? ("gold" as const) : meta.side === "them" || meta.goal === "against" ? ("coral" as const) : ("sky" as const);
  return { id: e.id, minute: eventMinute(e) ?? (e.minute as number), who, label: EVENT_LABELS[e.type] ?? e.type, goal: OURS.has(e.type), title: said.title, sub: said.sub, tag: meta.tag, tone };
}
