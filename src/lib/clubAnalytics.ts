import { dateMillis, isCompleted } from "../../functions/src/matchEngine";
import type { ClubMatch } from "./clubData";
import type { PlayerDoc } from "./schemas";
import { computeStats } from "./playerStats";

export type Medal = "gold" | "silver" | "bronze" | null;
/** Competition ranking: 1, 2, 2, 4. Zero values never receive a medal. */
export function competitionRanks<T extends { id: string }>(
  rows: T[],
  value: (row: T) => number,
) {
  const sorted = [...rows].sort(
    (a, b) => value(b) - value(a) || a.id.localeCompare(b.id),
  );
  const ranks = new Map<string, number>();
  let rank = 0;
  sorted.forEach((row, index) => {
    if (!index || value(row) !== value(sorted[index - 1])) rank = index + 1;
    ranks.set(row.id, rank);
  });
  return ranks;
}
export function medalFor(rank: number | undefined, goals: number): Medal {
  return goals > 0
    ? rank === 1
      ? "gold"
      : rank === 2
        ? "silver"
        : rank === 3
          ? "bronze"
          : null
    : null;
}
export function opponentInitials(name = ""): string {
  const words =
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/\b([A-Z])\.\s*([A-Z])\.?/g, "$1$2")
      .match(/[A-Z]+|\d+/g) ?? [];
  const useful = words.filter(
    (w) =>
      !["DE", "DEL", "LA", "EL", "LOS", "LAS", "CF", "FC", "CD", "UD"].includes(
        w,
      ),
  );
  const tokens = useful.length ? useful : words;
  if (!tokens.length) return "?";
  if (tokens.length > 1)
    return (
      tokens[0][0] +
      (/^\d+$/.test(tokens.at(-1)!) ? tokens.at(-1)! : tokens[1][0])
    ).slice(0, 3);
  // Compound name used by this league: Superbebientes → SB.
  if (/^SUPER[A-Z]/.test(tokens[0])) return "S" + tokens[0][5];
  return tokens[0].slice(0, 2);
}
export function chronological(matches: ClubMatch[]) {
  return matches
    .filter(isCompleted)
    .sort(
      (a, b) =>
        dateMillis(a.date) - dateMillis(b.date) || a.id.localeCompare(b.id),
    );
}
export function playerGame(playerId: string, match: ClubMatch) {
  const stats = computeStats(playerId, [match]);
  const row = match.ledger?.[playerId];
  return {
    match,
    ...stats,
    played: stats.matchesPlayed > 0,
    ga: stats.goals + stats.assists,
    minutes: row?.minutes ?? null,
  };
}
export interface Streak {
  count: number;
  from?: ClubMatch;
  to?: ClubMatch;
  matchIds: string[];
}
export function streaks<T extends { match: ClubMatch }>(
  games: T[],
  qualifies: (game: T) => boolean,
) {
  let run: Streak = { count: 0, matchIds: [] };
  let best: Streak = run;
  const all: Streak[] = [];
  for (const game of games) {
    if (qualifies(game)) {
      run = {
        count: run.count + 1,
        from: run.from ?? game.match,
        to: game.match,
        matchIds: [...run.matchIds, game.match.id],
      };
      if (run.count > best.count) best = run;
    } else {
      if (run.count) all.push(run);
      run = { count: 0, matchIds: [] };
    }
  }
  if (run.count) all.push(run);
  return { best, current: run, runs: all.sort((a, b) => b.count - a.count) };
}
export function analysePlayer(player: PlayerDoc, games: ClubMatch[]) {
  const series = games.map((match) => playerGame(player.id, match));
  const totals = computeStats(player.id, games);
  const tracked = games.flatMap((m) =>
    m.ledger?.[player.id] ? [m.ledger[player.id]] : [],
  );
  return {
    ...player,
    ...totals,
    series,
    ga: totals.goals + totals.assists,
    tracked: tracked.length,
    minutes: tracked.reduce((s, p) => s + p.minutes, 0),
    starts: tracked.filter((p) => p.started).length,
    bench: tracked.filter((p) => p.benched).length,
    notCalled: tracked.filter((p) => p.notCalled).length,
    subIn: tracked.reduce((s, p) => s + p.subIn, 0),
    subOut: tracked.reduce((s, p) => s + p.subOut, 0),
    penaltyCommitted: tracked.reduce((s, p) => s + p.penaltyCommitted, 0),
    penaltyReceived: tracked.reduce((s, p) => s + p.penaltyReceived, 0),
    braces: series.filter((g) => g.goals >= 2).length,
    hatTricks: series.filter((g) => g.goals >= 3).length,
    multiAssists: series.filter((g) => g.assists >= 2).length,
    goalStreak: streaks(series, (g) => g.goals > 0),
    assistStreak: streaks(series, (g) => g.assists > 0),
    contributionStreak: streaks(series, (g) => g.ga > 0),
    appearanceStreak: streaks(series, (g) => g.played),
    cleanStreak: streaks(
      series,
      (g) => g.played && g.yellowCards === 0 && g.redCards === 0,
    ),
  };
}
export type PlayerAnalysis = ReturnType<typeof analysePlayer>;
export const metrics = {
  goals: "Goles",
  assists: "Asistencias",
  ga: "Goles + asistencias",
  matchesPlayed: "Partidos",
  minutes: "Minutos",
  starts: "Titularidades",
  bench: "Suplencias iniciales",
  notCalled: "No convocado",
  subIn: "Entradas",
  subOut: "Salidas",
  yellowCards: "Amarillas",
  redCards: "Expulsiones",
  doubleYellows: "Dobles amarillas",
  woodwork: "Tiros al palo",
  penaltySaved: "Penaltis parados",
  goalPenalty: "Goles de penalti",
  goalFreekick: "Goles de falta",
  penaltyMissed: "Penaltis fallados",
  penaltyCommitted: "Penaltis cometidos",
  penaltyReceived: "Penaltis recibidos",
} as const;
export type PlayerMetric = keyof typeof metrics;
export const advancedMetrics = new Set<PlayerMetric>([
  "minutes",
  "starts",
  "bench",
  "notCalled",
  "subIn",
  "subOut",
  "penaltyCommitted",
  "penaltyReceived",
]);
export function metricValue(p: PlayerAnalysis, metric: PlayerMetric) {
  return advancedMetrics.has(metric) && !p.tracked ? null : p[metric];
}
export function teamAnalysis(games: ClubMatch[]) {
  const wins = games.filter((m) => m.goalsFor! > m.goalsAgainst!).length;
  const draws = games.filter((m) => m.goalsFor === m.goalsAgainst).length;
  const rows = games.map((match) => ({ match }));
  return {
    played: games.length,
    wins,
    draws,
    losses: games.length - wins - draws,
    gf: games.reduce((n, m) => n + m.goalsFor!, 0),
    ga: games.reduce((n, m) => n + m.goalsAgainst!, 0),
    cleanSheets: games.filter((m) => m.goalsAgainst === 0).length,
    winStreak: streaks(rows, (g) => g.match.goalsFor! > g.match.goalsAgainst!),
    unbeatenStreak: streaks(
      rows,
      (g) => g.match.goalsFor! >= g.match.goalsAgainst!,
    ),
    scoringStreak: streaks(rows, (g) => g.match.goalsFor! > 0),
    cleanStreak: streaks(rows, (g) => g.match.goalsAgainst === 0),
  };
}
export interface RecordEntry {
  id: string;
  value: number;
  match: ClubMatch;
  playerId?: string;
}
export function individualRecords(
  rows: PlayerAnalysis[],
  key: "goals" | "assists" | "ga",
) {
  return rows
    .flatMap((p) =>
      p.series
        .filter((g) => g[key] > 0)
        .map((g) => ({
          id: p.id + ":" + g.match.id,
          playerId: p.id,
          value: g[key],
          match: g.match,
        })),
    )
    .sort(
      (a, b) =>
        b.value - a.value ||
        dateMillis(a.match.date) - dateMillis(b.match.date) ||
        a.id.localeCompare(b.id),
    );
}
export function teamRecords(
  games: ClubMatch[],
  key: "win" | "scored" | "total" | "conceded",
) {
  return games
    .map((m) => ({
      id: m.id,
      match: m,
      value:
        key === "win"
          ? m.goalsFor! - m.goalsAgainst!
          : key === "scored"
            ? m.goalsFor!
            : key === "conceded"
              ? m.goalsAgainst!
              : m.goalsFor! + m.goalsAgainst!,
    }))
    .filter((e) => e.value > 0)
    .sort(
      (a, b) =>
        b.value - a.value ||
        dateMillis(a.match.date) - dateMillis(b.match.date),
    );
}
export const milestoneSteps = [1, 5, 10, 25, 50, 100, 150, 200, 300, 500, 1000];
export function milestones(rows: PlayerAnalysis[]) {
  const result: {
    id: string;
    playerId: string;
    metric: "goals" | "assists" | "matchesPlayed";
    value: number;
    match: ClubMatch;
  }[] = [];
  for (const p of rows)
    for (const metric of ["goals", "assists", "matchesPlayed"] as const) {
      let total = 0;
      for (const g of p.series) {
        const previous = total;
        total += g[metric];
        for (const value of milestoneSteps)
          if (previous < value && total >= value)
            result.push({
              id: p.id + ":" + metric + ":" + value,
              playerId: p.id,
              metric,
              value,
              match: g.match,
            });
      }
    }
  return result.sort(
    (a, b) =>
      dateMillis(b.match.date) - dateMillis(a.match.date) ||
      b.value - a.value ||
      a.id.localeCompare(b.id),
  );
}
export function ageOn(
  birthDate: string | undefined,
  today: Date,
): number | null {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const birth = new Date(birthDate + "T12:00:00Z");
  if (
    !Number.isFinite(+birth) ||
    birth.toISOString().slice(0, 10) !== birthDate
  )
    return null;
  let age = today.getFullYear() - birth.getUTCFullYear();
  if (
    today.getMonth() < birth.getUTCMonth() ||
    (today.getMonth() === birth.getUTCMonth() &&
      today.getDate() < birth.getUTCDate())
  )
    age--;
  return age >= 0 && age < 110 ? age : null;
}
