// «Logros»: the medals a player earns with the club, each with the match where he won it and his progress
// towards the ones still to come (spec: docs/superpowers/specs/2026-10-16-logros-design.md). Pure, and built
// on the rules every other page prints, so a medal never disagrees with the stats or the jugador page:
// - the matches are the stats' own: completed and visible (clubAnalytics' chronological), walked in date
//   order (then id); `at` is the match where the threshold was crossed;
// - played, goals and assists per match: playerGame (computeStats: the ledger's row, else the events);
// - minutes: derived/minutesOf's totalMinutes (the known ones only: a legacy acta without minutes adds
//   nothing to «1000 minutos»);
// - result: partidos' scoreOf / resultOf (derived/result's resultLetter);
// - MVP: vestuario's mvpWinners (a vote counts once closed; a shared vote counts for each winner), or the
//   caller's derived/mvpOf when it passes one;
// - positions: positionStats' playerPositions, the rule behind the perfil's positionsPlayed («Dónde has
//   jugado»: only codes with at least 1′); legacy actas without positions add none.
//
// AchievementsCtx: what the rules need besides the matches.
//   mvpResults  useMvpResults() (the vitrina's `results`)
//   mvpOf       optional: a derived/mvpOf reader the page already built (mvpOfFrom over the same games and
//               clock); when given it decides the MVPs instead of mvpResults — same rule, same answer
//   seasons     optional: useSeason().seasons. No rule reads it (a medal's season is its match's); it is
//               accepted so a caller can pass the vitrina's arguments as they are
//   now         the page's clock (an MVP vote counts once it has closed)
import { dateMillis } from "../../../functions/src/matchEngine";
import type { ClubMatch } from "../clubData";
import { chronological, playerGame } from "../clubAnalytics";
import { scoreOf } from "../partidos";
import { playerPositions } from "../positionStats";
import { lineOf } from "../positions";
import { mvpWinners, type MvpResult } from "../vestuario";
import type { MvpOf } from "./mvpOf";
import { medalDay } from "./medalDay";
import { totalMinutes } from "./minutesOf";
import { resultLetter } from "./result";

export type AchievementFamily = "partidos" | "goles" | "asistencias" | "mvp" | "hattrick" | "doblete" | "cero" | "invicto" | "racha" | "comodin" | "minutos" | "debut";

export interface Achievement {
  /** Stable: «goles-10». The six vitrina medals keep theirs: debut, goal, assist, mvp, ten, hat. */
  id: string;
  family: AchievementFamily;
  /** 0 = a single medal (or a family's entry medal before its tiers), 1 bronce, 2 plata, 3 oro. */
  tier: 0 | 1 | 2 | 3;
  /** «10 goles». */
  label: string;
  /** «vs Rayo · 12 oct» (plus the year when it isn't this one) when earned, «7 / 10» when not. */
  detail: string;
  earned: boolean;
  /** The match where the threshold was crossed (earned only). */
  at?: { matchId: string; date: number; rival: string };
  /**
   * Always present. `now` is his real count (it may pass `goal` once earned): matches, goals, assists, MVPs,
   * clean sheets, known minutes (two decimals), different positions; for hat-trick and doblete his most
   * goals in one match; for invicto and racha the run under way (the best one once earned); debut 0 or 1.
   */
  progress?: { now: number; goal: number };
}

export interface AchievementsCtx {
  mvpResults: ReadonlyMap<string, MvpResult>;
  mvpOf?: MvpOf;
  seasons?: readonly { id: string; name: string }[];
  now: number;
}

interface Def {
  id: string;
  family: AchievementFamily;
  tier: Achievement["tier"];
  label: string;
  goal: number;
}
/** The catalogue, in the order every list shows it. */
const CATALOGUE: readonly Def[] = [
  { id: "debut", family: "debut", tier: 0, label: "Debut", goal: 1 },
  { id: "ten", family: "partidos", tier: 0, label: "10 partidos", goal: 10 },
  { id: "partidos-25", family: "partidos", tier: 1, label: "25 partidos", goal: 25 },
  { id: "partidos-50", family: "partidos", tier: 2, label: "50 partidos", goal: 50 },
  { id: "partidos-100", family: "partidos", tier: 3, label: "100 partidos", goal: 100 },
  { id: "goal", family: "goles", tier: 0, label: "Primer gol", goal: 1 },
  { id: "goles-10", family: "goles", tier: 1, label: "10 goles", goal: 10 },
  { id: "goles-25", family: "goles", tier: 2, label: "25 goles", goal: 25 },
  { id: "goles-50", family: "goles", tier: 3, label: "50 goles", goal: 50 },
  { id: "assist", family: "asistencias", tier: 1, label: "Asistente", goal: 3 },
  { id: "asistencias-10", family: "asistencias", tier: 2, label: "10 asistencias", goal: 10 },
  { id: "asistencias-25", family: "asistencias", tier: 3, label: "25 asistencias", goal: 25 },
  { id: "mvp", family: "mvp", tier: 1, label: "MVP", goal: 1 },
  { id: "mvp-3", family: "mvp", tier: 2, label: "MVP ×3", goal: 3 },
  { id: "mvp-5", family: "mvp", tier: 3, label: "MVP ×5", goal: 5 },
  { id: "hat", family: "hattrick", tier: 0, label: "Hat-trick", goal: 3 },
  { id: "doblete", family: "doblete", tier: 0, label: "Doblete", goal: 2 },
  // bronce: a clean-sheet win at POR or in defence; plata and oro: as POR only (5 and 10)
  { id: "cero", family: "cero", tier: 1, label: "Portería a cero", goal: 1 },
  { id: "cero-5", family: "cero", tier: 2, label: "5 porterías a cero", goal: 5 },
  { id: "cero-10", family: "cero", tier: 3, label: "10 porterías a cero", goal: 10 },
  { id: "invicto", family: "invicto", tier: 0, label: "Invicto", goal: 5 },
  { id: "racha", family: "racha", tier: 0, label: "Racha goleadora", goal: 3 },
  { id: "comodin", family: "comodin", tier: 0, label: "Comodín", goal: 4 },
  { id: "minutos", family: "minutos", tier: 0, label: "1000 minutos", goal: 1000 },
];

/** Smallest k in 1..n with f(k) ≥ goal for a non-decreasing f (prefix totals), else 0. */
function firstReach(n: number, f: (k: number) => number, goal: number) {
  if (n === 0 || f(n) < goal) return 0;
  let lo = 1, hi = n;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (f(mid) >= goal) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

/**
 * Every medal of the catalogue for `playerId`, in catalogue order: earned or not, with the match where it
 * was won and his progress (see AchievementsCtx at the top of the file).
 */
export function achievements(playerId: string, matches: ClubMatch[], ctx: AchievementsCtx): Achievement[] {
  const games = chronological(matches);
  const won = (m: ClubMatch) =>
    ctx.mvpOf ? ctx.mvpOf(m.id, playerId) === playerId : mvpWinners(m, ctx.mvpResults.get(m.id), ctx.now).includes(playerId);

  // count-based families: the running total after each match, and the match where each goal was reached
  const reached = new Map<string, ClubMatch>();
  const totals = { partidos: 0, goles: 0, asistencias: 0, mvp: 0, porCero: 0, defCero: 0 };
  let bestGoals = 0;
  let unbeaten = 0, bestUnbeaten = 0;
  let scoring = 0, bestScoring = 0;
  const mark = (id: string, now: number, goal: number, m: ClubMatch) => {
    if (now >= goal && !reached.has(id)) reached.set(id, m);
  };
  for (const m of games) {
    const g = playerGame(playerId, m);
    // racha: scored in consecutive matches of the club (a match without his goal breaks it), as the jugador's goalStreak
    scoring = g.goals > 0 ? scoring + 1 : 0;
    bestScoring = Math.max(bestScoring, scoring);
    mark("racha", scoring, 3, m);
    // a closed MVP vote counts whether or not he is marked as played (as everywhere else on the site)
    if (won(m)) {
      totals.mvp++;
      for (const d of CATALOGUE) if (d.family === "mvp") mark(d.id, totals.mvp, d.goal, m);
    }
    if (!g.played) continue;
    const { gf, ga } = scoreOf(m);
    const result = resultLetter(gf, ga);
    totals.partidos++;
    totals.goles += g.goals;
    totals.asistencias += g.assists;
    bestGoals = Math.max(bestGoals, g.goals);
    // invicto: his own matches in a row without a defeat (a match he misses neither counts nor breaks it)
    unbeaten = result === "P" ? 0 : unbeaten + 1;
    bestUnbeaten = Math.max(bestUnbeaten, unbeaten);
    if (result === "G" && ga === 0) {
      const codes = playerPositions(playerId, [m]).lines.map((l) => l.code);
      if (codes.includes("POR")) totals.porCero++;
      if (codes.some((c) => c === "POR" || lineOf(c) === "DEF")) totals.defCero++;
    }
    mark("debut", 1, 1, m);
    for (const d of CATALOGUE) {
      if (d.family === "partidos") mark(d.id, totals.partidos, d.goal, m);
      else if (d.family === "goles") mark(d.id, totals.goles, d.goal, m);
      else if (d.family === "asistencias") mark(d.id, totals.asistencias, d.goal, m);
    }
    mark("hat", g.goals, 3, m);
    mark("doblete", g.goals, 2, m);
    mark("cero", totals.defCero, 1, m);
    mark("cero-5", totals.porCero, 5, m);
    mark("cero-10", totals.porCero, 10, m);
    mark("invicto", unbeaten, 5, m);
  }

  // prefix rules: the site's totals over the first k matches, which only grow with k
  const minutesAt = (k: number) => totalMinutes(games.slice(0, k), playerId);
  const codesAt = (k: number) => playerPositions(playerId, games.slice(0, k)).lines.length;
  const minutes = minutesAt(games.length);
  const codes = codesAt(games.length);
  const minutesK = firstReach(games.length, minutesAt, 1000);
  if (minutesK) reached.set("minutos", games[minutesK - 1]);
  const codesK = firstReach(games.length, codesAt, 4);
  if (codesK) reached.set("comodin", games[codesK - 1]);

  const nowOf = (d: Def): number => {
    switch (d.family) {
      case "debut": return totals.partidos > 0 ? 1 : 0;
      case "partidos": return totals.partidos;
      case "goles": return totals.goles;
      case "asistencias": return totals.asistencias;
      case "mvp": return totals.mvp;
      case "hattrick":
      case "doblete": return bestGoals;
      case "cero": return d.id === "cero" ? totals.defCero : totals.porCero;
      case "invicto": return reached.has(d.id) ? bestUnbeaten : unbeaten;
      case "racha": return reached.has(d.id) ? bestScoring : scoring;
      case "comodin": return codes;
      case "minutos": return minutes;
    }
  };

  return CATALOGUE.map((d) => {
    const m = reached.get(d.id);
    const now = nowOf(d);
    const base = { id: d.id, family: d.family, tier: d.tier, label: d.label, progress: { now, goal: d.goal } };
    if (!m) return { ...base, earned: false, detail: `${Math.floor(now)} / ${d.goal}` };
    const date = dateMillis(m.date);
    const rival = m.rival ?? "rival";
    return { ...base, earned: true, detail: `vs ${rival} · ${medalDay(date, ctx.now)}`, at: { matchId: m.id, date, rival } };
  });
}

/**
 * The next `n` medals to chase: the first unearned medal of each family (25 goles waits for 10 goles),
 * closest to done first (progress now / goal), ties in catalogue order.
 */
export function nextToChase(list: Achievement[], n = 3): Achievement[] {
  const seen = new Set<AchievementFamily>();
  const next: Achievement[] = [];
  for (const a of list) {
    if (a.earned || seen.has(a.family)) continue;
    seen.add(a.family);
    next.push(a);
  }
  const ratio = (a: Achievement) => (a.progress && a.progress.goal > 0 ? Math.min(1, a.progress.now / a.progress.goal) : 0);
  return next
    .map((a, i) => ({ a, i }))
    .sort((x, y) => ratio(y.a) - ratio(x.a) || x.i - y.i)
    .slice(0, n)
    .map((x) => x.a);
}
