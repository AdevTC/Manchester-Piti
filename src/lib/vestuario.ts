// Pure vestuario domain logic: everything the page shows is derived from real match data.
import { dateMillis, isCompleted } from "../../functions/src/matchEngine";
import type { ClubMatch } from "./clubData";
import { chronological, playerGame } from "./clubAnalytics";

const TZ = "Europe/Madrid";
const GOAL_TYPES = new Set(["goal", "goal_penalty", "goal_freekick"]);

/** Season the vestuario is about: the next match's, else the latest played, else the newest season. */
export function currentSeasonId(
  next: ClubMatch | undefined,
  matches: ClubMatch[],
  seasons: { id: string }[],
) {
  return (
    next?.seasonId ||
    matches.find((m) => m.status === "finished")?.seasonId ||
    matches[0]?.seasonId ||
    seasons.at(-1)?.id ||
    ""
  );
}

function madridHour(now: number) {
  return Number(
    new Intl.DateTimeFormat("es-ES", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(now),
  );
}
export function greeting(now: number) {
  const h = madridHour(now);
  return h >= 6 && h < 14 ? "Buenos días" : h >= 14 && h < 21 ? "Buenas tardes" : "Buenas noches";
}
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** "Sábado, 16:00" in club time. */
export function kickoffLabel(date: unknown) {
  const ms = dateMillis(date);
  const day = new Intl.DateTimeFormat("es-ES", { timeZone: TZ, weekday: "long" }).format(ms);
  const time = new Intl.DateTimeFormat("es-ES", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(ms);
  return `${capital(day)}, ${time}`;
}
export function slotParts(ms: number) {
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("es-ES", { timeZone: TZ, ...o }).format(ms);
  return { day: capital(f({ weekday: "long" })), date: f({ day: "numeric" }), month: f({ month: "short" }), time: f({ hour: "2-digit", minute: "2-digit" }) };
}
/** "3 d 14 h 22 min" until `target`; "¡Ya!" once it has passed. */
export function countdown(target: number, now: number) {
  const left = target - now;
  if (left <= 0) return "¡Ya!";
  const d = Math.floor(left / 86_400_000),
    h = Math.floor((left % 86_400_000) / 3_600_000),
    m = Math.floor((left % 3_600_000) / 60_000);
  return [d ? `${d} d` : "", d || h ? `${h} h` : "", `${m} min`].filter(Boolean).join(" ");
}
export function initials(name = "") {
  const parts = name.trim().split(/[\s._-]+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2)).toUpperCase();
}
export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// ---------- MVP
export interface MvpResult {
  id: string;
  counts: Record<string, number>;
  total: number;
}
/** Winners of a match's MVP vote once it has closed (ties share it). */
export function mvpWinners(match: ClubMatch, result: MvpResult | undefined, now: number) {
  if (!result?.total || !match.voteClosesAt || now < match.voteClosesAt) return [];
  const top = Math.max(...Object.values(result.counts));
  return top > 0 ? Object.keys(result.counts).filter((id) => result.counts[id] === top) : [];
}
export function mvpWins(playerId: string, matches: ClubMatch[], results: Map<string, MvpResult>, now: number) {
  return matches.filter((m) => mvpWinners(m, results.get(m.id), now).includes(playerId)).length;
}
export function podium(result: MvpResult | undefined) {
  return Object.entries(result?.counts ?? {})
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([playerId, votes]) => ({ playerId, votes }));
}

// ---------- season & career
const MILESTONES = [5, 10, 25, 50, 100, 150, 200, 300];
export function nextMilestone(played: number) {
  return MILESTONES.find((m) => m > played) ?? (Math.floor(played / 100) + 1) * 100;
}
function totalsFor(playerId: string, games: ClubMatch[]) {
  const series = games.map((m) => playerGame(playerId, m));
  return {
    series,
    played: series.filter((g) => g.played).length,
    goals: series.reduce((s, g) => s + g.goals, 0),
    assists: series.reduce((s, g) => s + g.assists, 0),
  };
}
/** Goals of `scorer` assisted by `assister` in these games. */
function combos(games: ClubMatch[], assister: string, scorer: string) {
  let n = 0;
  for (const m of games)
    for (const e of m.events ?? [])
      if (GOAL_TYPES.has(e.type) && e.playerId === scorer && e.assistPlayerId === assister) n++;
  return n;
}
export interface SeasonSummary {
  played: number;
  goals: number;
  assists: number;
  mvps: number;
  streak: number;
  careerPlayed: number;
  milestone: number;
  bestGoals: number;
  bestAssists: number;
  assistTarget: { playerId: string; count: number } | null;
}
export function seasonSummary(
  playerId: string,
  seasonId: string,
  matches: ClubMatch[],
  results: Map<string, MvpResult>,
  now: number,
): SeasonSummary {
  const games = chronological(matches);
  const season = games.filter((m) => m.seasonId === seasonId);
  const here = totalsFor(playerId, season);
  const career = totalsFor(playerId, games);
  let streak = 0;
  for (let i = here.series.length - 1; i >= 0 && here.series[i].played; i--) streak++;
  const others = new Map<string, { goals: number; assists: number }>();
  for (const m of games) {
    if (!m.seasonId || m.seasonId === seasonId) continue;
    const g = playerGame(playerId, m);
    const row = others.get(m.seasonId) ?? { goals: 0, assists: 0 };
    row.goals += g.goals;
    row.assists += g.assists;
    others.set(m.seasonId, row);
  }
  const scorers = new Map<string, number>();
  for (const m of season)
    for (const e of m.events ?? [])
      if (GOAL_TYPES.has(e.type) && e.assistPlayerId === playerId && e.playerId)
        scorers.set(e.playerId, (scorers.get(e.playerId) ?? 0) + 1);
  const target = [...scorers.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return {
    played: here.played,
    goals: here.goals,
    assists: here.assists,
    mvps: mvpWins(playerId, season, results, now),
    streak,
    careerPlayed: career.played,
    milestone: nextMilestone(career.played),
    bestGoals: Math.max(0, ...[...others.values()].map((r) => r.goals)),
    bestAssists: Math.max(0, ...[...others.values()].map((r) => r.assists)),
    assistTarget: target ? { playerId: target[0], count: target[1] } : null,
  };
}
/** Copy comparing this season with your best other one. */
export function versusBest(current: number, best: number, noun: string, first: string) {
  if (best === 0) return current > 1 ? `Tus primeros ${noun} con el Piti.` : current === 1 ? `${first} con el Piti.` : "El primero está al caer.";
  if (current > best) return "Ya es tu mejor temporada.";
  if (current === best) return `Igualas tu mejor temporada: ${best}.`;
  return `Tu mejor temporada fueron ${best}. Te ${best - current + 1 === 1 ? "falta 1" : `faltan ${best - current + 1}`} para superarte.`;
}

export interface MedalView {
  id: string;
  label: string;
  detail: string;
  earned: boolean;
  tone: "gold" | "sky";
}
export function vitrina(
  playerId: string,
  matches: ClubMatch[],
  results: Map<string, MvpResult>,
  seasons: { id: string; name: string }[],
  now: number,
): MedalView[] {
  const games = chronological(matches);
  const { series, played, assists } = totalsFor(playerId, games);
  const debut = series.find((g) => g.played);
  const firstGoal = series.find((g) => g.goals > 0);
  const hat = series.find((g) => g.goals >= 3);
  const mvps = mvpWins(playerId, games, results, now);
  const seasonName = (id?: string) => seasons.find((s) => s.id === id)?.name ?? "";
  return [
    { id: "debut", label: "Debut", detail: debut ? seasonName(debut.match.seasonId) || "Hecho" : "por debutar", earned: !!debut, tone: "gold" },
    { id: "goal", label: "Primer gol", detail: firstGoal ? `vs ${firstGoal.match.rival ?? "rival"}` : "por marcar", earned: !!firstGoal, tone: "sky" },
    { id: "assist", label: "Asistente", detail: assists >= 3 ? plural(assists, "pase de gol", "pases de gol") : `${assists} / 3`, earned: assists >= 3, tone: "sky" },
    { id: "mvp", label: "MVP", detail: mvps ? `votado ${plural(mvps, "vez", "veces")}` : "por ganar", earned: mvps > 0, tone: "gold" },
    { id: "ten", label: "10 partidos", detail: played >= 10 ? plural(played, "partido", "partidos") : `${played} / 10`, earned: played >= 10, tone: "gold" },
    { id: "hat", label: "Hat-trick", detail: hat ? `vs ${hat.match.rival ?? "rival"}` : "por conseguir", earned: !!hat, tone: "gold" },
  ];
}

export interface Partner {
  playerId: string;
  together: number;
  wins: number;
  theirGoalsFromYou: number;
  yourGoalsFromThem: number;
}
/** Teammate you've shared the most matches with (then wins, then goal combos). */
export function bestPartner(playerId: string, matches: ClubMatch[], candidates: string[]): Partner | null {
  const games = chronological(matches);
  const mine = games.filter((m) => playerGame(playerId, m).played);
  let best: Partner | null = null;
  for (const other of candidates) {
    if (other === playerId) continue;
    const shared = mine.filter((m) => playerGame(other, m).played);
    if (!shared.length) continue;
    const row: Partner = {
      playerId: other,
      together: shared.length,
      wins: shared.filter((m) => (m.goalsFor ?? 0) > (m.goalsAgainst ?? 0)).length,
      theirGoalsFromYou: combos(shared, playerId, other),
      yourGoalsFromThem: combos(shared, other, playerId),
    };
    const score = (p: Partner) => [p.together, p.wins, p.theirGoalsFromYou + p.yourGoalsFromThem];
    const [a, b] = [score(row), best ? score(best) : [-1, -1, -1]];
    if (a[0] > b[0] || (a[0] === b[0] && (a[1] > b[1] || (a[1] === b[1] && a[2] > b[2])))) best = row;
  }
  return best;
}

// ---------- next match & convocatoria
/** Latest finished match with an MVP vote. */
export function lastVotedMatch(matches: ClubMatch[]) {
  return matches.filter((m) => m.status === "finished" && isCompleted(m) && m.voteClosesAt).sort((a, b) => dateMillis(b.date) - dateMillis(a.date))[0];
}
export function calledUp(match: ClubMatch | undefined, playerId: string | undefined) {
  return !!playerId && !!match && [...(match.starters ?? []), ...(match.bench ?? [])].includes(playerId);
}
export const MIN_PLAYERS = 7;

// ---------- trainings
export interface TrainingSlot {
  id: string;
  at: number;
  /** End of the proposed range; older proposals only have a start. */
  end?: number;
  place: string;
}
/** "21:00–22:30" in club time (just "21:00" for single-time slots). */
export function slotTime(slot: { at: number; end?: number }) {
  const f = (ms: number) => new Intl.DateTimeFormat("es-ES", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(ms);
  return slot.end ? `${f(slot.at)}–${f(slot.end)}` : f(slot.at);
}
/** Vote standing: the most voted slots and those with enough players to train. */
export function slotStanding(slots: TrainingSlot[], votes: { slotIds: string[] }[]) {
  const counts = slotVotes(slots, votes);
  const max = Math.max(0, ...counts.values());
  const ids = (keep: (n: number) => boolean) => new Set([...counts].filter(([, n]) => keep(n)).map(([id]) => id));
  return { counts, top: max > 0 ? ids((n) => n === max) : new Set<string>(), ready: ids((n) => n >= MIN_PLAYERS) };
}
/** A confirmed training stops showing once it has finished (90 min when it has no end). */
export function trainingOver(t: { confirmed?: { at: number; end?: number } }, now: number) {
  return !!t.confirmed && (t.confirmed.end ?? t.confirmed.at + 90 * 60_000) < now;
}
export function slotVotes(slots: TrainingSlot[], votes: { slotIds: string[] }[]) {
  const counts = new Map(slots.map((s) => [s.id, 0]));
  for (const v of votes) for (const id of v.slotIds) if (counts.has(id)) counts.set(id, counts.get(id)! + 1);
  return counts;
}

// ---------- porra
export function porraPosition<T extends { uid: string; points: number }>(rows: T[], uid: string) {
  const i = rows.findIndex((r) => r.uid === uid);
  return i < 0 ? null : { position: i + 1, row: rows[i] };
}

// ---------- first visit
const fold = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
/** Ficha whose names best match the member's nickname ("jordi" → "JORDIX"); null when nothing is close. */
export function suggestFicha<T extends { id: string; names: string[] }>(nickname: string, candidates: T[]): T | null {
  const me = fold(nickname);
  if (me.length < 3) return null;
  let best: T | null = null,
    bestScore = 0;
  for (const c of candidates) {
    for (const raw of c.names) {
      const name = fold(raw);
      if (name.length < 3) continue;
      const score =
        name === me ? 4 : name.startsWith(me) || me.startsWith(name) ? 3 : name.includes(me) || me.includes(name) ? 2 : 0;
      if (score > bestScore) {
        best = c;
        bestScore = score;
      }
    }
  }
  return best;
}
export type StepState = "done" | "now" | "todo";
export interface FirstStepsInput {
  linked: boolean;
  claimPending: boolean;
  matchOpen: boolean;
  answered: boolean;
  posted: boolean;
}
/** "Primeros pasos": entering is done; the first unfinished step that can be done now is highlighted. */
export function firstSteps(s: FirstStepsInput) {
  const steps = [
    { id: "enter", done: true, can: true },
    { id: "ficha", done: s.linked, can: !s.claimPending },
    { id: "rsvp", done: s.answered, can: s.matchOpen },
    { id: "board", done: s.posted, can: true },
  ];
  const now = steps.find((x) => !x.done && x.can)?.id;
  return steps.map((x) => ({ id: x.id, state: (x.done ? "done" : x.id === now ? "now" : "todo") as StepState }));
}
/** Next `weekday` (0 = Sunday) at `hour`, local time, at least an hour from now. */
export function nextWeekday(now: number, weekday: number, hour: number) {
  const d = new Date(now);
  d.setHours(hour, 0, 0, 0);
  d.setDate(d.getDate() + ((weekday - d.getDay() + 7) % 7));
  if (d.getTime() < now + 3_600_000) d.setDate(d.getDate() + 7);
  return d.getTime();
}
