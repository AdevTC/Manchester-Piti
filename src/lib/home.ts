// Pure logic for the public home ("El vestidor"): everything shown is derived from real
// match and player data, and every text is a template chosen by the season's moment.
import { dateMillis, isCompleted, matchPhase } from "../../functions/src/matchEngine";
import type { ClubMatch } from "./clubData";
import { computeStats, EMPTY_STATS, type PlayerStats } from "./playerStats";
import { kickoffLabel, plural } from "./vestuario";
import type { CalendarEvent } from "./calendarLinks";

const DAY = 86_400_000;
const GOAL = /^goal/;
export type Result = "G" | "E" | "P";

export interface SquadMember {
  id: string;
  name: string;
  num: string;
  birthDate?: string;
}
export interface PlayerLine extends SquadMember {
  stats: PlayerStats;
}

export function resultOf(m: { goalsFor?: number; goalsAgainst?: number }): Result {
  const gf = m.goalsFor ?? 0,
    ga = m.goalsAgainst ?? 0;
  return gf > ga ? "G" : gf === ga ? "E" : "P";
}
const byDate = (a: ClubMatch, b: ClubMatch) => dateMillis(a.date) - dateMillis(b.date);

/** The season as the home tells it: played games (oldest first), the live one, the next one. */
export function seasonPulse(matches: ClubMatch[], seasonId: string, now: number) {
  const season = matches.filter((m) => m.seasonId === seasonId);
  const played = season.filter((m) => isCompleted(m)).sort(byDate);
  const live = season.find((m) => matchPhase(m, now) === "playing");
  const next = season.filter((m) => matchPhase(m, now) === "scheduled").sort(byDate)[0];
  const results = played.map(resultOf);
  const gf = played.reduce((s, m) => s + (m.goalsFor ?? 0), 0);
  const ga = played.reduce((s, m) => s + (m.goalsAgainst ?? 0), 0);
  return {
    played,
    live,
    next,
    last: played.at(-1),
    wins: results.filter((r) => r === "G").length,
    draws: results.filter((r) => r === "E").length,
    losses: results.filter((r) => r === "P").length,
    gf,
    ga,
    /** Most recent first. */
    form: results.slice(-5).reverse(),
    upcoming: season.filter((m) => ["scheduled", "playing", "unscheduled", "awaiting_result"].includes(matchPhase(m, now))).sort(byDate),
  };
}
export type Pulse = ReturnType<typeof seasonPulse>;

export function playerLines(squad: SquadMember[], played: ClubMatch[]): PlayerLine[] {
  return squad.map((p) => ({ ...p, stats: played.length ? computeStats(p.id, played) : EMPTY_STATS }));
}
/** Top `n` by a stat, ties by name; players at 0 are left out. */
export function leaders(lines: PlayerLine[], key: "goals" | "assists", n = 3) {
  return lines
    .filter((l) => l.stats[key] > 0)
    .sort((a, b) => b.stats[key] - a.stats[key] || a.name.localeCompare(b.name, "es"))
    .slice(0, n);
}

function scorersOf(m: ClubMatch, nameOf: (id: string) => string) {
  const count = new Map<string, number>();
  for (const e of m.events ?? []) if (GOAL.test(e.type) && e.playerId) count.set(e.playerId, (count.get(e.playerId) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ id, name: nameOf(id), n }));
}
const feat = (n: number) => (n >= 3 ? "un hat-trick" : n === 2 ? "un doblete" : "un gol");

export interface Narrative {
  kick: string;
  head: string;
  em: string;
}
/** The home's headline, by moment: live, just played (4 days), countdown, pre-season or mid-season. */
export function narrative(p: Pulse, ctx: { seasonName: string; squadSize: number; now: number; nameOf: (id: string) => string; scorer?: PlayerLine }): Narrative {
  const { seasonName, squadSize, now, nameOf, scorer } = ctx;
  const leaderLine = scorer ? `${scorer.name} lidera el Pichichi con ${plural(scorer.stats.goals, "gol", "goles")}.` : "El Pichichi sigue sin dueño.";
  if (p.live) {
    return {
      kick: `${seasonName} · en directo`,
      head: `¡En juego! Piti ${p.live.goalsFor ?? 0}–${p.live.goalsAgainst ?? 0} ${p.live.rival ?? "rival"}.`,
      em: "El marcador se actualiza solo desde el acta.",
    };
  }
  const jornada = `jornada ${p.played.length}`;
  if (p.last && now - dateMillis(p.last.date) < 4 * DAY) {
    const m = p.last,
      r = resultOf(m),
      top = scorersOf(m, nameOf)[0];
    const score = `${m.goalsFor ?? 0}–${m.goalsAgainst ?? 0}`;
    const leads = !!top && top.id === scorer?.id;
    const who = top ? (leads ? `${top.name} firmó ${feat(top.n)}: ya suma ${scorer!.stats.goals} y lidera el Pichichi.` : `${top.name} firmó ${feat(top.n)}.`) : "";
    if (r === "G") return { kick: `${seasonName} · ${jornada}`, head: `¡Victoria! ${score} ante ${m.rival ?? "el rival"}.`, em: leads ? who : `${who} ${leaderLine}`.trim() };
    if (r === "E") return { kick: `${seasonName} · ${jornada}`, head: `Empate a ${m.goalsFor ?? 0} ante ${m.rival ?? "el rival"}.`, em: who || leaderLine };
    return { kick: `${seasonName} · ${jornada}`, head: `Tocó perder ante ${m.rival ?? "el rival"}, ${score}.`, em: p.next ? `Revancha: ${kickoffLabel(p.next.date)} ante ${p.next.rival ?? "el rival"}.` : who || "El próximo domingo, revancha." };
  }
  if (!p.played.length) {
    if (p.next)
      return { kick: `${seasonName} · cuenta atrás`, head: "Cuenta atrás para el estreno.", em: `${kickoffLabel(p.next.date)} ante ${p.next.rival ?? "el rival"}. ${squadSize} dorsales listos.` };
    return { kick: `${seasonName} · pretemporada`, head: `La ${seasonName} está a punto de empezar.`, em: `${squadSize} dorsales, cero goles y toda la historia por escribir.` };
  }
  if (p.next) return { kick: `${seasonName} · ${jornada}`, head: `${kickoffLabel(p.next.date)}: ${p.next.rival ?? "próximo rival"}.`, em: leaderLine };
  return { kick: `${seasonName} · ${jornada}`, head: `${plural(p.played.length, "partido", "partidos")}, ${plural(p.gf, "gol", "goles")}.`, em: leaderLine };
}

/** One line about a player, from the most notable thing they have done this season. */
export function playerMoment(line: PlayerLine, ctx: { pichichiId?: string; lastMatch?: ClubMatch }) {
  const { goals, assists, matchesPlayed } = line.stats;
  const inGames = matchesPlayed ? ` en ${plural(matchesPlayed, "partido", "partidos")}` : "";
  const scoredLast = !!ctx.lastMatch?.events?.some((e) => GOAL.test(e.type) && e.playerId === line.id);
  if (!goals && !assists && !matchesPlayed) return "Aún sin estrenar: su primer gol se contará aquí.";
  if (ctx.pichichiId === line.id) return `Pichichi del equipo: ${plural(goals, "gol", "goles")}${inGames}.`;
  if (scoredLast) return `Marcó en el último partido. Ya suma ${plural(goals, "gol", "goles")}.`;
  if (assists > goals) return `${plural(assists, "asistencia", "asistencias")}: el que reparte juego.`;
  if (goals) return `${plural(goals, "gol", "goles")}${inGames}.`;
  return `${plural(matchesPlayed, "partido jugado", "partidos jugados")} esta temporada.`;
}

export interface Moment {
  line: PlayerLine;
  kick: string;
  text: string;
}
/** The one player the home puts forward: last match's scorer, then the Pichichi, then the next birthday. */
export function playerOfTheMoment(lines: PlayerLine[], p: Pulse, now: number): Moment | null {
  if (!lines.length) return null;
  const byId = (id: string) => lines.find((l) => l.id === id);
  const [pichichi] = leaders(lines, "goals", 1);
  if (p.last && now - dateMillis(p.last.date) < 10 * DAY) {
    const top = scorersOf(p.last, (id) => byId(id)?.name ?? "").find((s) => byId(s.id));
    if (top) {
      const lead = pichichi?.id === top.id ? ` Ya suma ${plural(pichichi.stats.goals, "gol", "goles")} y lidera el Pichichi.` : "";
      return { line: byId(top.id)!, kick: "Goleador del último partido", text: `Firmó ${feat(top.n)} ante ${p.last.rival ?? "el rival"}.${lead}` };
    }
  }
  if (pichichi) {
    const { goals, matchesPlayed } = pichichi.stats;
    const games = matchesPlayed ? ` en ${plural(matchesPlayed, "partido", "partidos")}` : "";
    return { line: pichichi, kick: "Pichichi", text: `${plural(goals, "gol", "goles")}${games}: nadie en la plantilla ha marcado más.` };
  }
  const [bday] = upcomingBirthdays(lines, now, 1);
  if (bday) {
    const kick = bday.days === 0 ? "¡Cumple hoy!" : bday.days === 1 ? "Cumple mañana" : `Cumple en ${bday.days} días`;
    return { line: byId(bday.id)!, kick, text: `Cumple el ${bday.label}. Cuando empiecen los partidos, aquí saldrá el goleador de cada jornada.` };
  }
  return { line: lines[0], kick: `Dorsal ${lines[0].num}`, text: "Aún sin estrenar: el primer gol de la temporada lo pondrá aquí." };
}

export interface ClubMedal {
  id: string;
  kicker: string;
  title: string;
  detail: string;
  earned: boolean;
  tone: "gold" | "sky";
}
/** The club's season trophy cabinet: fills itself as the firsts happen. */
export function clubMedals(p: Pulse, lines: PlayerLine[], nameOf: (id: string) => string, dateLabel: (d: unknown) => string): ClubMedal[] {
  const first = p.played[0];
  const firstGoal = p.played.find((m) => (m.events ?? []).some((e) => GOAL.test(e.type) && e.playerId));
  const firstGoalBy = firstGoal ? scorersOf(firstGoal, nameOf).map((s) => s.name) : [];
  const firstWin = p.played.find((m) => resultOf(m) === "G");
  const [pichichi] = leaders(lines, "goals", 1);
  const [assister] = leaders(lines, "assists", 1);
  const record = [...p.played].sort((a, b) => (b.goalsFor ?? 0) - (a.goalsFor ?? 0))[0];
  return [
    { id: "debut", kicker: "Primer partido", title: first ? dateLabel(first.date) : "Jornada 1", detail: first ? `${first.goalsFor ?? 0}–${first.goalsAgainst ?? 0} ante ${first.rival ?? "el rival"}` : "fecha por confirmar", earned: !!first, tone: "gold" },
    { id: "goal", kicker: "Primer gol", title: firstGoalBy[0] ?? "Por marcar", detail: firstGoal ? `ante ${firstGoal.rival ?? "el rival"}` : "¿quién lo hará?", earned: !!firstGoal, tone: "sky" },
    { id: "win", kicker: "Primera victoria", title: firstWin ? `${firstWin.goalsFor}–${firstWin.goalsAgainst}` : "Por ganar", detail: firstWin ? `ante ${firstWin.rival ?? "el rival"}` : "se celebrará aquí", earned: !!firstWin, tone: "gold" },
    { id: "pichichi", kicker: "Pichichi", title: pichichi?.name ?? "Por decidir", detail: pichichi ? plural(pichichi.stats.goals, "gol", "goles") : "todos a cero", earned: !!pichichi, tone: "gold" },
    { id: "assist", kicker: "Rey de la asistencia", title: assister?.name ?? "Por decidir", detail: assister ? plural(assister.stats.assists, "asistencia", "asistencias") : "0 asistencias", earned: !!assister, tone: "sky" },
    { id: "record", kicker: "Tarde de récord", title: record && (record.goalsFor ?? 0) > 0 ? plural(record.goalsFor ?? 0, "gol", "goles") : "Por batir", detail: record && (record.goalsFor ?? 0) > 0 ? `ante ${record.rival ?? "el rival"}` : "el listón está en cero", earned: !!record && (record.goalsFor ?? 0) > 0, tone: "gold" },
  ];
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
/** Next birthdays of the squad (day and month only), soonest first. */
export function upcomingBirthdays(squad: SquadMember[], now: number, n = 3) {
  const today = new Date(now);
  const base = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return squad
    .filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.birthDate ?? ""))
    .map((p) => {
      const [, m, d] = p.birthDate!.split("-").map(Number);
      let at = Date.UTC(today.getUTCFullYear(), m - 1, d);
      if (at < base) at = Date.UTC(today.getUTCFullYear() + 1, m - 1, d);
      return { ...p, label: `${d} ${MONTHS[m - 1]}`, days: Math.round((at - base) / DAY) };
    })
    .sort((a, b) => a.days - b.days || a.name.localeCompare(b.name, "es"))
    .slice(0, n);
}

export function countdownParts(target: number, now: number) {
  const left = Math.max(0, target - now);
  return { d: Math.floor(left / DAY), h: Math.floor((left % DAY) / 3_600_000), m: Math.floor((left % 3_600_000) / 60_000) };
}

/** A one-event iCalendar file for "Añadir a mi calendario". */
/** A match as a calendar event (kick-off to final whistle plus 30 min). */
export function matchEvent(m: { id: string; date?: unknown; rival?: string | null; venue?: string | null; duration?: number | null }, origin: string): CalendarEvent {
  const start = dateMillis(m.date);
  return {
    uid: m.id,
    title: `Manchester Piti vs ${m.rival ?? "rival"}`,
    start,
    end: start + (m.duration ?? 60) * 60_000 + 30 * 60_000,
    location: m.venue ?? undefined,
    url: `${origin}/matches/${m.id}`,
  };
}
