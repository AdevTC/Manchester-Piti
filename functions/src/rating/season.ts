// The season's numbers from each match's values (./values): every player's nota in every match (0–10, 6,5 a
// normal match), GLOBAL (his notas' mean × 10 over a cushion of SEASON_CUSHION matches of 6,5) and FOR (the same
// over his last FORM_MATCHES). A nota adds up, in goals over NOTE_SCALE: his volume of play per 50′ against the
// normal of his position (the others who played it, his own matches left out), his one-off events whole, and what
// happened with the team while he was on the pitch against a normal match. A match counts whole from
// FULL_MATCH_MINUTES and in proportion below; without narration it counts half.
// Every nota is «congelada»: rated when its acta is published, with the season's matches up to that one and the
// rival's strength in that day's table, and stored with the acta (./frozen); only a correction of that acta rates
// it again. An acta without stored notas of this model is rated here the same way. Pure.
import { dateMillis } from "../matchEngine.js";
import type { Line } from "../positions.js";
import { durationOf, type Normal, type RatingMatch, type StandingsLike } from "./types.js";
import * as K from "./constants.js";
import { matchValue, xgFactor, type Item, type MatchValue, type PlayerMatchValue, type Role } from "./values.js";
import { NO_RIVAL, NO_RIVAL_GOALS, rivalFactor, rivalGoals, type RivalFactor } from "./rival.js";
import { storedNotasOf, type StoredNotas } from "./frozen.js";

export interface MatchNote {
  matchId: string;
  date: number;
  rival: string;
  nota: number;
  minutes: number;
  /** How much the match counts in GLOBAL and FOR (≤ 1). */
  weight: number;
  narrated: boolean;
}
export interface PlusMinus {
  /** xG difference per 50′ with him on minus with him off, its effective sample (minutes) and the shrunk value
   *  in nota points (what it would add were it active). */
  diff: number;
  sample: number;
  nota: number;
}
export interface PlayerSeason {
  /** GLOBAL 0–99 (null before his first match with a nota, or over several seasons). */
  value: number | null;
  exact: number | null;
  /** FOR: the same over his last matches. */
  form: number | null;
  /** Minutes of his matches with a nota. */
  minutes: number;
  /** Matches he played whose acta does not know his minutes (they give no nota: none is invented). */
  unknownMinutes: number;
  played: number;
  notes: MatchNote[];
  /** What his actions were worth over the season, by kind (values before the volume and rival adjustments). */
  items: Item[];
  plusMinus: PlusMinus | null;
}
export interface SeasonRatings {
  players: Map<string, PlayerSeason>;
  noteOf: (matchId: string, playerId: string) => MatchNote | null;
  /** The matches span more than one season: no GLOBAL (the notas stay, for the positions). */
  multipleSeasons: boolean;
}
/** What happened with the team while he was on the pitch: its part of his nota (in nota points), and the goals for
 *  and the danger against it measured (a short stint pulled toward the whole match's) with what a normal match gives
 *  in his minutes. */
export interface TeamPart {
  value: number;
  for: number;
  against: number;
  normalFor: number;
  normalAgainst: number;
}

const EMPTY: PlayerSeason = { value: null, exact: null, form: null, minutes: 0, unknownMinutes: 0, played: 0, notes: [], items: [], plusMinus: null };
export const emptySeason = (): PlayerSeason => ({ ...EMPTY, notes: [], items: [] });

const median = (xs: readonly number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
/** The weighted mean of notas over a cushion of `cushion` matches of NOTE_BASE, × 10 (GLOBAL's scale). */
export const notesMean = (notes: readonly MatchNote[], cushion: number = K.SEASON_CUSHION) => (10 * (notes.reduce((s, n) => s + n.weight * n.nota, 0) + cushion * K.NOTE_BASE)) / (notes.reduce((s, n) => s + n.weight, 0) + cushion);

/** A normal match when the table does not say: these matches' goals per team per 50′ (both sides'). */
export function seasonNormal(games: readonly RatingMatch[]): Normal {
  let goals = 0;
  let minutes = 0;
  for (const m of games)
    if (typeof m.goalsFor === "number" && typeof m.goalsAgainst === "number") {
      goals += (m.goalsFor + m.goalsAgainst) / 2;
      minutes += durationOf(m);
    }
  const n = minutes > 0 ? (goals * 50) / minutes : 0;
  return { for: n, against: n };
}

/** His team part in a match: the goals for and the danger against while he was on, a short stint pulled toward the
 *  whole match's with TEAM_CUSHION_MINUTES (his own left out of both), above what a normal match gives in his minutes,
 *  weighed by his lines (one the acta does not place, as a midfielder). */
export function teamPart(pv: PlayerMatchValue, normal: Normal, duration: number): TeamPart {
  const t = pv.team.on;
  const c = K.TEAM_CUSHION_MINUTES;
  const pulled = (his: number, whole: number) => (t > 0 ? ((his + (c * whole) / duration) * t) / (t + c) : 0);
  const gf = pulled(pv.team.for, pv.team.matchFor);
  const ga = pulled(pv.team.against, pv.team.matchAgainst);
  const shares = Object.entries(pv.lines) as [Line, number][];
  let wAgainst = 0;
  let wFor = 0;
  for (const [l, share] of shares.length ? shares : ([["MED", 1]] as [Line, number][])) {
    wAgainst += share * K.TEAM_WEIGHTS[l][0];
    wFor += share * K.TEAM_WEIGHTS[l][1];
  }
  const normalFor = (normal.for * t) / 50;
  const normalAgainst = (normal.against * t) / 50;
  return { value: -wAgainst * (ga - normalAgainst) + wFor * (gf - normalFor), for: gf, against: ga, normalFor, normalAgainst };
}

interface Entry {
  pid: string;
  match: RatingMatch;
  minutes: number;
  /** His volume of play and his one-off events, in goals (after the narration volume and the rival). */
  vol: number;
  ev: number;
  roles: Partial<Record<Role, number>>;
  narrated: boolean;
  /** His team part, in nota points. */
  team: number;
}

/** No table: no rival adjustment (one shared array, so the memo below still hits). */
export const NO_STANDINGS: readonly StandingsLike[] = [];
const memo = new WeakMap<readonly RatingMatch[], { standings: readonly StandingsLike[]; result: SeasonRatings }>();
/** `games`: the period's finished matches (ratingMatches); `standings`: every season's current table. */
export function seasonRatings(games: readonly RatingMatch[], standings: readonly StandingsLike[] = NO_STANDINGS): SeasonRatings {
  const hit = memo.get(games);
  if (hit && hit.standings === standings) return hit.result;
  const result = compute(games, standings);
  memo.set(games, { standings, result });
  return result;
}

/** Each match's notas for a page that only shows them (Partidos): read from what every acta froze, and only when
 *  some acta has none of this model is the season rated (seasonRatings). Memoised per array and table. */
const notasMemo = new WeakMap<readonly RatingMatch[], { standings: readonly StandingsLike[]; noteOf: SeasonRatings["noteOf"] }>();
export function matchNotas(games: readonly RatingMatch[], standings: readonly StandingsLike[] = NO_STANDINGS): SeasonRatings["noteOf"] {
  const hit = notasMemo.get(games);
  if (hit && hit.standings === standings) return hit.noteOf;
  let noteOf: SeasonRatings["noteOf"];
  if (games.every((m) => storedNotasOf(m))) {
    const byId = new Map(games.map((m) => [m.id, m]));
    noteOf = (matchId, playerId) => {
      const m = byId.get(matchId);
      const n = m ? storedNotasOf(m)?.players[playerId] : undefined;
      return m && n ? { matchId, date: dateMillis(m.date), rival: m.rival || "Rival", nota: n.nota, minutes: n.minutes, weight: n.weight, narrated: n.narrated } : null;
    };
  } else noteOf = seasonRatings(games, standings).noteOf;
  notasMemo.set(games, { standings, noteOf });
  return noteOf;
}

/** Play order (date, then id): the order every rating walks. */
const byDate = (a: RatingMatch, b: RatingMatch) => dateMillis(a.date) - dateMillis(b.date) || a.id.localeCompare(b.id);
const seasonKey = (m: RatingMatch) => m.seasonId ?? "legacy";
/** A match's season up to it, in play order (it is added when missing; the ones after it are left out). */
function seasonUpTo(match: RatingMatch, games: readonly RatingMatch[]): RatingMatch[] {
  const ordered = [...games.filter((g) => g.id !== match.id), match].sort(byDate);
  const key = seasonKey(match);
  const upTo: RatingMatch[] = [];
  for (const g of ordered) {
    if (seasonKey(g) !== key) continue;
    upTo.push(g);
    if (g.id === match.id) break;
  }
  return upTo;
}

/** Matches rated against each other: each one's notas (matchId → playerId → nota) and its values. */
interface Rated {
  notes: Map<string, Map<string, MatchNote>>;
  values: Map<string, MatchValue>;
}
/** Every player's nota in each of `ordered` (play order), with the F7 calibration of their shots: his volume of
 *  play per 50′ against his position's normal over these matches (his own left out), his events whole and his team
 *  part; `rival` gives each match's factor, `normal` its normal match. */
function rate(ordered: readonly RatingMatch[], rival: RivalFactor, normal: (m: RatingMatch) => Normal): Rated {
  const xg = xgFactor(ordered);
  const values = new Map(ordered.map((m) => [m.id, matchValue(m, xg)]));
  const refVolume = median(ordered.filter((m) => values.get(m.id)!.narrated).map((m) => values.get(m.id)!.volume));
  const entries: Entry[] = [];
  for (const m of ordered) {
    const mv = values.get(m.id)!;
    const k = mv.narrated && refVolume > 0 && mv.volume > 0 ? refVolume / mv.volume : 1;
    const f = rival(m);
    const usual = normal(m);
    for (const [pid, pv] of mv.players) {
      if (pv.minutes === null || pv.minutes <= 0) continue;
      entries.push({ pid, match: m, minutes: pv.minutes, vol: k * (pv.narrGood * f + pv.narrBad / f), ev: pv.actaGood * f + pv.actaBad / f, roles: pv.roles, narrated: mv.narrated, team: teamPart(pv, usual, durationOf(m)).value });
    }
  }

  // each player against the others who played his position (a full-back against the full-backs; his own matches
  // left out): their volume per 50′ over their minutes there, from the team's with POSITION_PRIOR_MINUTES of it —
  // a keeper's from zero (only other keepers set a keeper's normal). A match without narration tells almost none of
  // the play: its few actions count as they are, never against the narrated ones nor setting anybody's normal
  const rated = entries.filter((e) => e.minutes >= K.MIN_RATED_MINUTES);
  const reference = new Map<string, (roles: Partial<Record<Role, number>>) => number>();
  const referenceFor = (pid: string) => {
    let ref = reference.get(pid);
    if (ref) return ref;
    const pool = rated.filter((e) => e.pid !== pid && e.narrated);
    const minutes = pool.reduce((s, e) => s + e.minutes, 0);
    const team = minutes > 0 ? (pool.reduce((s, e) => s + e.vol, 0) * 50) / minutes : 0;
    const position = (r: Role) => {
      let v = 0;
      let w = 0;
      for (const e of pool) {
        const share = e.roles[r] ?? 0;
        v += share * e.vol;
        w += share * e.minutes;
      }
      const prior = r === "POR" ? 0 : team;
      return ((v + (K.POSITION_PRIOR_MINUTES * prior) / 50) * 50) / (w + K.POSITION_PRIOR_MINUTES);
    };
    const cache = new Map<Role, number>();
    ref = (roles) => {
      const shares = Object.entries(roles) as [Role, number][];
      if (!shares.length) return team;
      return shares.reduce((s, [r, share]) => {
        if (!cache.has(r)) cache.set(r, position(r));
        return s + share * cache.get(r)!;
      }, 0);
    };
    reference.set(pid, ref);
    return ref;
  };
  const notes = new Map<string, Map<string, MatchNote>>();
  for (const e of rated) {
    const mu = e.narrated ? referenceFor(e.pid)(e.roles) : 0;
    // (his volume per 50′ with CUSHION_MINUTES of his position's normal: a short stint is pulled to it, not to zero;
    // what happens once counts whole)
    const dev = ((e.vol + (mu * K.CUSHION_MINUTES) / 50) * 50) / (e.minutes + K.CUSHION_MINUTES) - mu + e.ev;
    let of = notes.get(e.match.id);
    if (!of) notes.set(e.match.id, (of = new Map()));
    of.set(e.pid, {
      matchId: e.match.id,
      date: dateMillis(e.match.date),
      rival: e.match.rival || "Rival",
      nota: Math.max(0, Math.min(10, K.NOTE_BASE + dev / K.NOTE_SCALE + e.team)),
      minutes: e.minutes,
      weight: Math.min(1, e.minutes / K.FULL_MATCH_MINUTES) * (e.narrated ? 1 : K.UNNARRATED_WEIGHT),
      narrated: e.narrated,
    });
  }
  return { notes, values };
}

/**
 * A match's notas as its acta freezes them: rated with its season's finished matches up to it (`games`, in any
 * order; this one is added when missing, and the ones after it are left out), every other match with the rival
 * factor frozen with its notas (the table's for one without), and this one with `rival` and `normal` — a correction
 * keeps the ones first stored — else the table's. What publishSheet stores, and what the web rates for an acta
 * stored without notas of this model.
 */
export function frozenNotas(match: RatingMatch, games: readonly RatingMatch[], standings: readonly StandingsLike[], rival?: number | null, normal?: Normal | null): StoredNotas {
  const upTo = seasonUpTo(match, games);
  const table = standings.length ? rivalFactor(standings, upTo) : NO_RIVAL;
  const goals = standings.length ? rivalGoals(standings, upTo) : NO_RIVAL_GOALS;
  const factor = typeof rival === "number" && Number.isFinite(rival) ? rival : table(match);
  const usual = normal ?? goals(match);
  const season = seasonNormal(upTo);
  const r = rate(
    upTo,
    (g) => (g.id === match.id ? factor : (storedNotasOf(g)?.rival ?? table(g))),
    (g) => (g.id === match.id ? usual : goals(g)) ?? season,
  );
  const players: StoredNotas["players"] = {};
  for (const [pid, n] of r.notes.get(match.id) ?? []) players[pid] = { nota: n.nota, minutes: n.minutes, weight: n.weight, narrated: n.narrated };
  return { model: K.MODEL_VERSION, rival: factor, ...(usual ? { normal: usual } : {}), players };
}

/** A match as its notas are rated, for the page that explains them (the acta's ficha): what every action was worth
 *  (with the F7 calibration of its season up to it) and each player's team part. */
export function ratedMatch(match: RatingMatch, games: readonly RatingMatch[], standings: readonly StandingsLike[] = NO_STANDINGS): { values: MatchValue; team: Map<string, TeamPart> } {
  const upTo = seasonUpTo(match, games);
  const values = matchValue(match, xgFactor(upTo));
  const usual = storedNotasOf(match)?.normal ?? (standings.length ? rivalGoals(standings, upTo)(match) : null) ?? seasonNormal(upTo);
  const team = new Map<string, TeamPart>();
  for (const [pid, pv] of values.players) team.set(pid, teamPart(pv, usual, durationOf(match)));
  return { values, team };
}

function compute(games: readonly RatingMatch[], standings: readonly StandingsLike[]): SeasonRatings {
  const ordered = [...games].sort(byDate);
  const table = standings.length ? rivalFactor(standings, ordered) : NO_RIVAL;
  const goals = standings.length ? rivalGoals(standings, ordered) : NO_RIVAL_GOALS;
  const season = seasonNormal(ordered);
  // the whole period together: what the actions were worth and who played
  const whole = rate(
    ordered,
    (m) => storedNotasOf(m)?.rival ?? table(m),
    (m) => storedNotasOf(m)?.normal ?? goals(m) ?? season,
  );
  // each match's notas, frozen: stored with its acta, else rated as its acta would have frozen them
  const notes = new Map<string, Map<string, MatchNote>>();
  for (const m of ordered) {
    const frozen = storedNotasOf(m) ?? frozenNotas(m, ordered, standings);
    const of = new Map<string, MatchNote>();
    for (const [pid, n] of Object.entries(frozen.players))
      of.set(pid, { matchId: m.id, date: dateMillis(m.date), rival: m.rival || "Rival", nota: n.nota, minutes: n.minutes, weight: n.weight, narrated: n.narrated });
    notes.set(m.id, of);
  }

  const players = new Map<string, PlayerSeason>();
  const seasonOf = (pid: string) => {
    let p = players.get(pid);
    if (!p) players.set(pid, (p = emptySeason()));
    return p;
  };
  for (const m of ordered) {
    for (const [pid, pv] of whole.values.get(m.id)!.players) {
      const p = seasonOf(pid);
      p.played++;
      if (pv.minutes === null) p.unknownMinutes++;
    }
    for (const [pid, n] of notes.get(m.id)!) seasonOf(pid).notes.push(n);
  }

  const multipleSeasons = new Set(ordered.map(seasonKey)).size > 1;
  for (const [pid, p] of players) {
    p.minutes = p.notes.reduce((s, n) => s + n.minutes, 0);
    if (p.notes.length && !multipleSeasons) {
      p.exact = notesMean(p.notes, K.SEASON_CUSHION);
      p.value = Math.round(p.exact);
      p.form = Math.round(notesMean(p.notes.slice(-K.FORM_MATCHES), K.FORM_CUSHION));
    }
    // what his actions were worth, over the matches that gave him a nota
    const items = new Map<string, Item>();
    for (const n of p.notes)
      for (const it of whole.values.get(n.matchId)?.players.get(pid)?.items ?? []) {
        const sum = items.get(it.label) ?? { ...it, n: 0, value: 0 };
        sum.n += it.n;
        sum.value += it.value;
        items.set(it.label, sum);
      }
    p.items = [...items.values()].sort((a, b) => a.value - b.value);
    // plus-minus (measured; it counts only once the J11 check shows it is stable)
    let on = 0, off = 0, forOn = 0, againstOn = 0, forOff = 0, againstOff = 0;
    for (const m of ordered) {
      const pm = whole.values.get(m.id)!.players.get(pid)?.plusMinus;
      if (!pm) continue;
      on += pm.on;
      off += pm.off;
      forOn += pm.forOn;
      againstOn += pm.againstOn;
      forOff += pm.forOff;
      againstOff += pm.againstOff;
    }
    if (on > 0 && off > 0) {
      const diff = ((forOn - againstOn) * 50) / on - ((forOff - againstOff) * 50) / off;
      const sample = (on * off) / (on + off);
      const nota = Math.max(-K.PLUS_MINUS_CAP, Math.min(K.PLUS_MINUS_CAP, (diff * sample) / (sample + K.PLUS_MINUS_CUSHION) / K.NOTE_SCALE));
      p.plusMinus = { diff, sample, nota };
      if (K.PLUS_MINUS_ACTIVE && p.exact !== null) {
        p.exact += 10 * nota;
        p.value = Math.round(p.exact);
      }
    }
  }
  return { players, noteOf: (matchId, playerId) => notes.get(matchId)?.get(playerId) ?? null, multipleSeasons };
}
