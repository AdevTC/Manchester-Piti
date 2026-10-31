// «Tú»'s shared derived data (IMPL-SPEC «Code layout»): from the profile's raw reads (useProfileData's `raw`,
// any season) to what every place draws — each jornada of the season as the river/table rows (played, didn't
// play, absent, the next one, the ones to come) with the frozen nota of its acta and its band word, the season's
// figures, the form, his place among the squad in five rankings, his best partner on the pitch, ONE rewards list
// (evoluciones + logros + MVPs + personal records, each with the match that earned it) and the card's tier road.
// Pure: built on the rules the rest of the web prints (clubAnalytics.playerGame, partidos.scoreOf, the frozen
// notas through seasonRating.matchNotas, derived/achievements, derived/card), so nothing here disagrees with the
// match page, the stats or the jugador page.
import { dateMillis, isCompleted, matchPhase } from "../../../../functions/src/matchEngine";
import type { ClubMatch } from "../../../lib/clubData";
import { playerGame } from "../../../lib/clubAnalytics";
import { scoreOf } from "../../../lib/partidos";
import { POSITIONS, type PosCode } from "../../../lib/positions";
import { resultLetter, type ResultLetter } from "../../../lib/derived/result";
import { jornadaLabel } from "../../../lib/derived/jornada";
import { durationOf } from "../../../lib/derived/vidrio/matchMarks";
import { achievements, type Achievement } from "../../../lib/derived/achievements";
import { seasonPlayers } from "../../../lib/derived/seasonPlayers";
import { evoluciones, seasonSquad, TIERS, type CardView, type Evo, type Tier } from "../../../lib/derived/card";
import { matchNotas, ratingMatches } from "../../../lib/seasonRating";
import { notaBand, notaText, type NotaBand } from "../../../lib/rating/semaforo";
import { TIER_ORO, TIER_PLATA } from "../../../lib/rating/constants";
import { mvpWinners, type MvpResult } from "../../../lib/vestuario";
import type { Standings } from "../../../lib/standings";
import type { PlayerDoc } from "../../../lib/schemas";
import { dateFormat } from "../../../lib/intlCache";

const TZ = "Europe/Madrid";
/** A convocatoria answer (matchPrivate/{match}/availability/{uid}). */
export type Answer = "yes" | "maybe" | "no";

/** How a jornada went for him: played · in the acta without minutes · not there (with why) · the next one to
 *  play · one still to come. */
export type RowKind = "played" | "didnt" | "absent" | "next" | "up";

/** One figure of his acta row that the acta actually recorded (only the ones present and above zero). */
export interface LedgerFigure {
  k: string;
  /** «Pases completados». */
  label: string;
  v: number;
}

/** One jornada of the season, as the river, the table and the match sheet draw it. */
export interface JornadaRow {
  matchId: string;
  /** Its jornada in the season's calendar (null: a friendly or one without a number). */
  j: number | null;
  /** «J3»; «—» without a number. */
  jLabel: string;
  kind: RowKind;
  rival: string;
  /** Home / away; null when the calendar doesn't say (never read as «en casa»: bug 14). */
  home: boolean | null;
  dateMs: number;
  /** The match's state (scheduled, postponed, finished…) as the calendar has it. */
  status: string;
  /** OUR goals first («3–8»), null until it is played. */
  gf: number | null;
  ga: number | null;
  /** G · E · P (null until it is played). */
  result: ResultLetter | null;
  /** The match's real length in minutes (50 when the acta doesn't say). */
  dur: number;
  /** His minutes (whole; null: not played, or an acta that doesn't know them). */
  min: number | null;
  /** In the starting seven (null: not in the acta). */
  start: boolean | null;
  /** The position where he played most minutes in it (null: not played or not recorded). */
  pos: PosCode | null;
  posLong: string | null;
  /** When he was on the pitch (minutes from kick-off), from the acta. */
  stints: { from: number; to: number }[];
  g: number;
  a: number;
  /** The frozen nota of the acta (the one the match page shows); null without one (under 10′, not played…). */
  nota: number | null;
  /** «7,4» / «—». */
  notaText: string;
  band: NotaBand;
  /** «Buena», «Sin nota». */
  bandWord: string;
  ledger: LedgerFigure[];
  /** He won (or shared) its closed MVP vote. */
  mvp: boolean;
  /** His convocatoria answer, when he gave one. */
  answer: Answer | null;
  /** Why he wasn't there (absent only): «No convocado», «Dijiste que no podías». */
  reason: string | null;
}

/** The season's figures (only played jornadas count). */
export interface SeasonFigures {
  /** Completed jornadas of the season (played or not by him). */
  jornadas: number;
  played: number;
  /** His known minutes (null when no acta of his knows them). */
  minutes: number | null;
  /** The plain mean of his frozen notas (null without one). */
  average: number | null;
  /** His best nota's jornada (null without one). */
  best: JornadaRow | null;
  goals: number;
  assists: number;
  /** Goals + assists. */
  ga: number;
  mvps: number;
}

/** One of the five rankings (minutos, partidos, goles, asistencias, nota media). */
export type RankKey = "minutos" | "partidos" | "goles" | "asistencias" | "nota";
export interface RankRow {
  key: RankKey;
  /** «Minutos». */
  label: string;
  /** His value (nota media with one decimal; null: no nota yet). */
  value: number | null;
  /** «140′», «2», «6,1», «—». */
  text: string;
  /** His place (competition ranking: 1 + how many have more); null at zero / without value: never a fake rank. */
  rank: number | null;
  /** How many are ranked in it (the squad; for the nota, those with one). */
  of: number;
  /** Others with exactly his value (> 0): «empatado con 2». */
  tied: number;
  /** At zero: how many more are at zero («Aún a cero, como N más»). */
  zeroWith: number;
  /** The first of the ranking (null when everybody is at zero). */
  leader: { playerId: string; name: string; value: number } | null;
}

/** His partner on the pitch: the teammate he shared most minutes with (stints overlap). */
export interface PartnerInfo {
  playerId: string;
  name: string;
  num: string;
  /** Whole minutes together. */
  minutes: number;
  /** Jornadas where they overlapped. */
  matches: number;
}

/** One piece of the reward wall. */
export type RewardKind = "evolucion" | "logro" | "mvp" | "record";
export interface RewardMatch {
  matchId: string;
  j: number | null;
  rival: string;
  dateMs: number;
  /** «J1 · contra Orduña · 12 oct». */
  label: string;
}
export interface Reward {
  id: string;
  kind: RewardKind;
  /** «Primer gol», «MVP de la J3», «Mejor nota · 7,4». */
  t: string;
  /** What it asks: «Marca tu primer gol». */
  d: string;
  /** What it puts on the card (evoluciones; «Medalla en tu vitrina» for a logro). */
  reward: string;
  /** Gold is only our goals and the MVP. */
  gold: boolean;
  earned: boolean;
  /** The match that earned it (earned only; null when unknown). */
  match: RewardMatch | null;
  /** Progress (not earned): current, goal, percentage. */
  progress: { cur: number; goal: number; pct: number } | null;
  /** «Te faltan 2 goles» (not earned). */
  need: string;
}
export interface Rewards {
  /** Earned, oldest first (by their match). */
  earned: Reward[];
  /** Still to earn, closest first. */
  next: Reward[];
}

/** The card's tier and the road to the next one (thresholds from lib/rating/constants, as lib/derived/card). */
export interface TierInfo {
  rating: number | null;
  tier: Tier | null;
  /** «Bronce», «Por estrenar». */
  name: string;
  provisional: boolean;
  plata: number;
  oro: number;
  /** The next tier up and how much is missing (null at Oro, or without a rating). */
  next: { name: "Plata" | "Oro"; at: number; missing: number } | null;
  /** «Tipos de carta» with his marked. */
  tiers: { k: Tier; label: string; rule: string; mine: boolean }[];
}

export interface MeInput {
  /** His linked ficha (null: not a player — every list is empty). */
  playerId: string | null;
  /** The season to derive (useProfileData's current one, or Partidos' ?temporada=). */
  seasonId: string;
  matches: ClubMatch[];
  players: PlayerDoc[];
  seasons: { id: string; name: string }[];
  mvpResults: Map<string, MvpResult>;
  standings: readonly Standings[];
  now: number;
  /** His convocatoria answers by match. */
  answers: ReadonlyMap<string, Answer>;
  /** The card (buildCard) for the tier and the evoluciones; optional (null: tier info from scratch). */
  card?: CardView | null;
}

/** Everything a place needs about him, for one season. */
export interface Me {
  seasonId: string;
  rows: JornadaRow[];
  /** The next jornada (also in rows, kind «next»). */
  next: JornadaRow | null;
  figures: SeasonFigures;
  /** His last 5 completed jornadas, oldest first (played, didn't, absent). */
  form: JornadaRow[];
  ranks: RankRow[];
  partner: PartnerInfo | null;
  rewards: Rewards;
  tier: TierInfo;
}

const LEDGER_LABELS: readonly [string, string][] = [
  ["passesCompleted", "Pases completados"],
  ["passes", "Pases"],
  ["keyPasses", "Pases clave"],
  ["shots", "Remates"],
  ["shotsOnTarget", "Remates a puerta"],
  ["dribblesWon", "Regates ganados"],
  ["recoveries", "Recuperaciones"],
  ["interceptions", "Intercepciones"],
  ["tacklesWon", "Entradas ganadas"],
  ["duelsWon", "Duelos ganados"],
  ["clearances", "Despejes"],
  ["saves", "Paradas"],
  ["penaltySaved", "Penaltis parados"],
  ["yellowCards", "Amarillas"],
  ["redCards", "Rojas"],
];

/** The figures his acta row recorded (present and above zero), in a fixed order. */
export function ledgerFigures(row: Record<string, unknown> | undefined): LedgerFigure[] {
  if (!row) return [];
  return LEDGER_LABELS.flatMap(([k, label]) => {
    const v = row[k];
    return typeof v === "number" && Number.isFinite(v) && v > 0 ? [{ k, label, v }] : [];
  });
}

const shortDate = (ms: number) => dateFormat("es-ES", { timeZone: TZ, day: "numeric", month: "short" }).format(ms).replace(".", "");
/** «J1 · contra Orduña · 12 oct». */
export const matchLabel = (r: Pick<JornadaRow, "j" | "rival" | "dateMs">): string => [r.j ? `J${r.j}` : "", `contra ${r.rival}`, Number.isFinite(r.dateMs) ? shortDate(r.dateMs) : ""].filter(Boolean).join(" · ");

const topPos = (pp: Partial<Record<PosCode, number>> | undefined): PosCode | null => {
  const best = Object.entries(pp ?? {}).filter(([, v]) => typeof v === "number" && v > 0).sort((a, b) => (b[1] as number) - (a[1] as number))[0];
  return best ? (best[0] as PosCode) : null;
};

/** The season's jornadas for him (played, didn't play, absent with why, the next one, the ones to come). */
export function jornadaRows(i: Pick<MeInput, "playerId" | "seasonId" | "matches" | "players" | "seasons" | "mvpResults" | "standings" | "now" | "answers">): JornadaRow[] {
  const squad = seasonPlayers(i.players, i.seasonId, i.seasons, i.playerId);
  const { calendar, jornada } = seasonSquad(squad, i.matches, i.seasonId, i.mvpResults, i.now, i.standings);
  const noteOf = matchNotas(ratingMatches(calendar), i.standings);
  const pid = i.playerId ?? "";
  // the next one: the first of the calendar still to be played (scheduled or under way)
  const nextId = calendar.find((m) => !isCompleted(m) && ["scheduled", "playing"].includes(matchPhase(m, i.now)))?.id ?? null;
  return calendar.map((m): JornadaRow => {
    const j = jornada.get(m.id) ?? null;
    const done = isCompleted(m);
    const { gf, ga } = scoreOf(m);
    const ledger = m.ledger?.[pid];
    const g = done && pid ? playerGame(pid, m) : null;
    const played = !!g?.played;
    const nota = played ? (noteOf(m.id, pid)?.nota ?? null) : null;
    const band = notaBand(nota);
    const answer = i.answers.get(m.id) ?? null;
    const inActa = !!ledger && !ledger.notCalled;
    const kind: RowKind = done ? (played ? "played" : inActa ? "didnt" : "absent") : m.id === nextId ? "next" : "up";
    const pos = played ? topPos(ledger?.positionsPlayed) : null;
    return {
      matchId: m.id,
      j,
      jLabel: jornadaLabel(j) || "—",
      kind,
      rival: m.rival?.trim() || "Rival",
      home: typeof m.home === "boolean" ? m.home : null,
      dateMs: dateMillis(m.date),
      status: m.status ?? "scheduled",
      gf: done ? gf : null,
      ga: done ? ga : null,
      result: done ? resultLetter(gf, ga) : null,
      dur: durationOf(m),
      min: played && g?.minutes != null ? Math.round(g.minutes) : null,
      start: ledger ? !!ledger.started : null,
      pos,
      posLong: pos ? POSITIONS[pos].name : null,
      stints: played ? (ledger?.stints ?? []).map((s) => ({ from: s.from, to: s.to })) : [],
      g: g?.goals ?? 0,
      a: g?.assists ?? 0,
      nota,
      notaText: notaText(nota),
      band: band.k,
      bandWord: band.word,
      ledger: played ? ledgerFigures(ledger as unknown as Record<string, unknown>) : [],
      mvp: done && !!pid && mvpWinners(m, i.mvpResults.get(m.id), i.now).includes(pid),
      answer,
      reason: kind === "absent" ? (answer === "no" ? "Dijiste que no podías" : ledger?.notCalled ? "No convocado" : "No estaba en el acta") : null,
    };
  });
}

/** The season's figures from its rows. */
export function seasonFigures(rows: readonly JornadaRow[]): SeasonFigures {
  const done = rows.filter((r) => r.kind === "played" || r.kind === "didnt" || r.kind === "absent");
  const played = rows.filter((r) => r.kind === "played");
  const timed = played.filter((r) => r.min !== null);
  const notas = played.filter((r) => r.nota !== null);
  const best = notas.reduce<JornadaRow | null>((b, r) => (!b || (r.nota as number) > (b.nota as number) ? r : b), null);
  const goals = played.reduce((s, r) => s + r.g, 0);
  const assists = played.reduce((s, r) => s + r.a, 0);
  return {
    jornadas: done.length,
    played: played.length,
    minutes: timed.length ? timed.reduce((s, r) => s + (r.min as number), 0) : null,
    average: notas.length ? notas.reduce((s, r) => s + (r.nota as number), 0) / notas.length : null,
    best,
    goals,
    assists,
    ga: goals + assists,
    mvps: played.filter((r) => r.mvp).length,
  };
}

/** His last `n` completed jornadas, oldest first (a «No jugaste» is part of the form). */
export const formOf = (rows: readonly JornadaRow[], n = 5): JornadaRow[] => rows.filter((r) => r.kind === "played" || r.kind === "didnt" || r.kind === "absent").slice(-n);

const RANK_LABEL: Record<RankKey, string> = { minutos: "Minutos", partidos: "Partidos", goles: "Goles", asistencias: "Asistencias", nota: "Nota media" };

/** His place in each ranking among the season's squad (ties share a place; zeros are never ranked). */
export function ranksOf(i: Pick<MeInput, "playerId" | "seasonId" | "matches" | "players" | "seasons" | "mvpResults" | "standings" | "now">): RankRow[] {
  const squadP = seasonPlayers(i.players, i.seasonId, i.seasons, i.playerId);
  const { squad, games } = seasonSquad(squadP, i.matches, i.seasonId, i.mvpResults, i.now, i.standings);
  const noteOf = matchNotas(ratingMatches(games), i.standings);
  const list = squad.list;
  const avg = new Map<string, number>();
  for (const c of list) {
    const ns = games.flatMap((m) => {
      const n = noteOf(m.id, c.id)?.nota;
      return typeof n === "number" ? [n] : [];
    });
    if (ns.length) avg.set(c.id, Math.round((ns.reduce((s, n) => s + n, 0) / ns.length) * 10) / 10);
  }
  const val: Record<RankKey, (id: string) => number | null> = {
    minutos: (id) => Math.round(squad.byId.get(id)?.stats.minutes ?? 0),
    partidos: (id) => squad.byId.get(id)?.stats.played ?? 0,
    goles: (id) => squad.byId.get(id)?.stats.goals ?? 0,
    asistencias: (id) => squad.byId.get(id)?.stats.assists ?? 0,
    nota: (id) => avg.get(id) ?? null,
  };
  const me = i.playerId;
  return (Object.keys(RANK_LABEL) as RankKey[]).map((key) => {
    const vals = list.flatMap((c) => {
      const v = val[key](c.id);
      return v === null ? [] : [{ id: c.id, name: c.name, v }];
    });
    const mine = me ? val[key](me) : null;
    const others = vals.filter((x) => x.id !== me);
    const top = [...vals].sort((a, b) => b.v - a.v || a.name.localeCompare(b.name, "es"))[0];
    const zero = mine === null || mine <= 0;
    const text = mine === null ? "—" : key === "nota" ? mine.toFixed(1).replace(".", ",") : key === "minutos" ? `${mine}′` : String(mine);
    return {
      key,
      label: RANK_LABEL[key],
      value: mine,
      text,
      rank: zero ? null : others.filter((x) => x.v > (mine as number)).length + 1,
      of: vals.length,
      tied: zero ? 0 : others.filter((x) => x.v === mine).length,
      zeroWith: mine === 0 ? others.filter((x) => x.v <= 0).length : 0,
      leader: top && top.v > 0 ? { playerId: top.id, name: top.name, value: top.v } : null,
    };
  });
}

const overlap = (a: readonly { from: number; to: number }[], b: readonly { from: number; to: number }[]): number => {
  let t = 0;
  for (const x of a) for (const y of b) t += Math.max(0, Math.min(x.to, y.to) - Math.max(x.from, y.from));
  return t;
};

/** His partner on the pitch: most minutes together (the actas' stints), a guest never counts; null without one. */
export function partnerOf(i: Pick<MeInput, "playerId" | "seasonId" | "matches" | "players" | "seasons" | "mvpResults" | "standings" | "now">): PartnerInfo | null {
  const me = i.playerId;
  if (!me) return null;
  const squadP = seasonPlayers(i.players, i.seasonId, i.seasons, me);
  const { squad, games } = seasonSquad(squadP, i.matches, i.seasonId, i.mvpResults, i.now, i.standings);
  const tot = new Map<string, { min: number; matches: number }>();
  for (const m of games) {
    const mine = m.ledger?.[me]?.stints ?? [];
    if (!mine.length) continue;
    for (const [id, row] of Object.entries(m.ledger ?? {})) {
      if (id === me || id.startsWith("guest:") || !row?.stints?.length) continue;
      const t = overlap(mine, row.stints);
      if (t <= 0) continue;
      const cur = tot.get(id) ?? { min: 0, matches: 0 };
      tot.set(id, { min: cur.min + t, matches: cur.matches + 1 });
    }
  }
  const name = (id: string) => squad.byId.get(id)?.name ?? i.players.find((p) => p.id === id)?.shirtName ?? "";
  const best = [...tot.entries()].sort((a, b) => b[1].min - a[1].min || name(a[0]).localeCompare(name(b[0]), "es"))[0];
  if (!best) return null;
  const c = squad.byId.get(best[0]);
  return { playerId: best[0], name: name(best[0]), num: c && c.num ? String(c.num) : "", minutes: Math.round(best[1].min), matches: best[1].matches };
}

/** The evoluciones that are the same thing as a medal: its match comes from the medal. */
const EVO_MEDAL: Partial<Record<Evo["id"], string>> = { debut: "debut", goal: "goal", double: "doblete", mvp: "mvp", fijo: "ten", goleador: "goles-10", hat: "hat" };
const GOLD_EVO = new Set<Evo["id"]>(["goal", "double", "hat", "mvp", "goleador"]);
const GOLD_FAMILY = new Set(["goles", "hattrick", "doblete", "racha", "mvp"]);
/** «Te faltan 2 goles», by what the medal counts. */
function needOf(a: { family?: string; id: string }, left: number): string {
  const n = Math.max(0, Math.ceil(left));
  const f = a.family ?? a.id;
  const many = (one: string, more: string) => `Te ${n === 1 ? `falta 1 ${one}` : `faltan ${n} ${more}`}`;
  if (f === "partidos" || f === "debut" || a.id === "debut" || a.id === "fijo") return many("partido", "partidos");
  if (f === "goles" || a.id === "goal" || a.id === "goleador") return many("gol", "goles");
  if (f === "asistencias") return many("asistencia", "asistencias");
  if (f === "minutos") return `Te faltan ${n} minutos`;
  if (f === "comodin") return many("puesto distinto", "puestos distintos");
  if (f === "mvp") return "Que el vestuario te vote MVP de una jornada";
  if (f === "cero") return many("portería a cero", "porterías a cero");
  return "";
}

/** ONE reward wall: the card's evoluciones (career), the medals not already an evolución, his MVPs of the season
 *  and — only with 3 or more played — his personal records of the season. Each earned piece names its match. */
export function rewardsOf(i: Pick<MeInput, "playerId" | "matches" | "seasons" | "mvpResults" | "now">, rows: readonly JornadaRow[], evo?: Evo[]): Rewards {
  const pid = i.playerId;
  if (!pid) return { earned: [], next: [] };
  const medals: Achievement[] = achievements(pid, i.matches, { mvpResults: i.mvpResults, seasons: i.seasons, now: i.now });
  const byId = new Map(medals.map((a) => [a.id, a]));
  const rowById = new Map(rows.map((r) => [r.matchId, r]));
  const matchOf = (at: Achievement["at"]): RewardMatch | null => {
    if (!at) return null;
    const r = rowById.get(at.matchId);
    const m = { matchId: at.matchId, j: r?.j ?? null, rival: r?.rival ?? at.rival, dateMs: at.date };
    return { ...m, label: matchLabel(m) };
  };
  const out: Reward[] = [];
  const evos = evo ?? evoluciones(pid, i.matches, i.mvpResults, i.seasons, i.now);
  const used = new Set<string>();
  for (const e of evos) {
    const medal = EVO_MEDAL[e.id] ? byId.get(EVO_MEDAL[e.id] as string) : undefined;
    if (medal) used.add(medal.id);
    out.push({
      id: `evo-${e.id}`,
      kind: e.id === "mvp" ? "mvp" : "evolucion",
      t: e.k,
      d: e.d,
      reward: e.reward,
      gold: GOLD_EVO.has(e.id),
      earned: e.done,
      match: e.done ? matchOf(medal?.at) : null,
      progress: e.done ? null : { cur: e.cur, goal: e.goal, pct: e.pct },
      need: e.done ? "" : e.id === "double" || e.id === "hat" ? `${e.goal} goles en un mismo partido` : e.id === "duo" ? `Te faltan ${e.goal - e.cur} goles combinados con el mismo compañero` : needOf({ id: e.id }, e.goal - e.cur),
    });
  }
  for (const a of medals) {
    if (used.has(a.id)) continue;
    const goal = a.progress?.goal ?? 1;
    const cur = Math.min(goal, a.progress?.now ?? 0);
    out.push({
      id: `logro-${a.id}`,
      kind: "logro",
      t: a.label,
      d: a.detail,
      reward: "Medalla en tu vitrina",
      gold: GOLD_FAMILY.has(a.family),
      earned: a.earned,
      match: a.earned ? matchOf(a.at) : null,
      progress: a.earned ? null : { cur: Math.floor(cur), goal, pct: Math.round((cur / goal) * 100) },
      need: a.earned ? "" : a.family === "hattrick" || a.family === "doblete" ? `${goal} goles en un mismo partido` : a.family === "racha" ? `Gol en ${goal} partidos seguidos` : a.family === "invicto" ? `${goal} partidos seguidos sin perder contigo` : needOf(a, goal - cur),
    });
  }
  // his MVPs of the season, one piece each
  for (const r of rows.filter((x) => x.mvp)) out.push({ id: `mvp-${r.matchId}`, kind: "mvp", t: r.j ? `MVP de la J${r.j}` : "MVP", d: "Ganaste la votación al mejor del partido", reward: "Estrella en la carta", gold: true, earned: true, match: { matchId: r.matchId, j: r.j, rival: r.rival, dateMs: r.dateMs, label: matchLabel(r) }, progress: null, need: "" });
  // personal records: only once there is something to compare (3 played)
  const played = rows.filter((r) => r.kind === "played");
  if (played.length >= 3) {
    const rec = (id: string, t: string, r: JornadaRow | undefined, gold = false) => r && out.push({ id: `rec-${id}`, kind: "record", t, d: "Tu récord de la temporada", reward: "", gold, earned: true, match: { matchId: r.matchId, j: r.j, rival: r.rival, dateMs: r.dateMs, label: matchLabel(r) }, progress: null, need: "" });
    const by = (f: (r: JornadaRow) => number | null) => played.filter((r) => f(r) !== null).reduce<JornadaRow | undefined>((b, r) => (!b || (f(r) as number) > (f(b) as number) ? r : b), undefined);
    const best = by((r) => r.nota);
    if (best) rec("nota", `Mejor nota · ${best.notaText}`, best);
    const most = by((r) => r.min);
    if (most) rec("min", `Más minutos · ${most.min}′`, most);
    const goals = by((r) => (r.g > 0 ? r.g : null));
    if (goals) rec("goles", `Más goles · ${goals.g}`, goals, true);
  }
  const earned = out.filter((r) => r.earned).sort((a, b) => (a.match?.dateMs ?? 0) - (b.match?.dateMs ?? 0));
  const next = out.filter((r) => !r.earned).sort((a, b) => (b.progress?.pct ?? 0) - (a.progress?.pct ?? 0) || (a.progress?.goal ?? 0) - (b.progress?.goal ?? 0));
  return { earned, next };
}

/** The card's tier and the road up (Bronce < 65 · Plata 65–74 · Oro 75+). */
export function tierInfo(card: Pick<CardView, "rating" | "tier" | "tierName" | "global" | "racha"> | null | undefined): TierInfo {
  const rating = card?.rating ?? null;
  const tier = card?.tier ?? null;
  const metal = rating === null ? null : rating >= TIER_ORO ? "oro" : rating >= TIER_PLATA ? "plata" : "bronce";
  const next = rating === null || metal === "oro" ? null : metal === "plata" ? { name: "Oro" as const, at: TIER_ORO, missing: TIER_ORO - rating } : { name: "Plata" as const, at: TIER_PLATA, missing: TIER_PLATA - rating };
  return {
    rating,
    tier,
    name: card?.tierName ?? "Por estrenar",
    provisional: card?.global?.status === "provisional",
    plata: TIER_PLATA,
    oro: TIER_ORO,
    next,
    tiers: TIERS.map((t) => ({ ...t, mine: t.k === "racha" ? !!card?.racha : t.k === metal })),
  };
}

/** Everything about him for one season (the places' shared data). */
export function buildMe(i: MeInput): Me {
  const rows = i.playerId ? jornadaRows(i) : [];
  return {
    seasonId: i.seasonId,
    rows,
    next: rows.find((r) => r.kind === "next") ?? null,
    figures: seasonFigures(rows),
    form: formOf(rows),
    ranks: i.playerId ? ranksOf(i) : [],
    partner: partnerOf(i),
    rewards: rewardsOf(i, rows, i.card && i.card.state === "vinculada" && i.card.playerId === i.playerId ? i.card.evo : undefined),
    tier: tierInfo(i.card),
  };
}
