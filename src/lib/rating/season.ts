// The season's numbers from each match's values (./values): every player's nota in every match (0–10, 6,5 a
// normal match: his value per 50′ against his line's, in the season's spread), GLOBAL (his notas' mean × 10
// over a cushion of SEASON_CUSHION matches of 6,5) and FOR (the same over his last FORM_MATCHES). A match
// counts whole from FULL_MATCH_MINUTES and in proportion below; without narration it counts half. Pure.
import type { ClubMatch } from "../clubData";
import { dateMillis } from "../../../functions/src/matchEngine";
import type { Line } from "../positions";
import type { Standings } from "../standings";
import * as K from "./constants";
import { matchValue, type Item } from "./values";
import { NO_RIVAL, rivalFactor } from "./rival";

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

const EMPTY: PlayerSeason = { value: null, exact: null, form: null, minutes: 0, unknownMinutes: 0, played: 0, notes: [], items: [], plusMinus: null };
export const emptySeason = (): PlayerSeason => ({ ...EMPTY, notes: [], items: [] });

const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const median = (xs: readonly number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
/** The weighted mean of notas over a cushion of `cushion` matches of NOTE_BASE, × 10 (GLOBAL's scale). */
export const notesMean = (notes: readonly MatchNote[], cushion: number = K.SEASON_CUSHION) => (10 * (notes.reduce((s, n) => s + n.weight * n.nota, 0) + cushion * K.NOTE_BASE)) / (notes.reduce((s, n) => s + n.weight, 0) + cushion);

interface Entry {
  pid: string;
  match: ClubMatch;
  minutes: number;
  value: number;
  raw: number;
  lines: Partial<Record<Line, number>>;
  narrated: boolean;
}

/** No table: no rival adjustment (one shared array, so the memo below still hits). */
export const NO_STANDINGS: readonly Standings[] = [];
const memo = new WeakMap<readonly ClubMatch[], { standings: readonly Standings[]; result: SeasonRatings }>();
/** `games`: the period's finished matches (ratingMatches); `standings`: every season's current table. */
export function seasonRatings(games: readonly ClubMatch[], standings: readonly Standings[] = NO_STANDINGS): SeasonRatings {
  const hit = memo.get(games);
  if (hit && hit.standings === standings) return hit.result;
  const result = compute(games, standings);
  memo.set(games, { standings, result });
  return result;
}

function compute(games: readonly ClubMatch[], standings: readonly Standings[]): SeasonRatings {
  const ordered = [...games].sort((a, b) => dateMillis(a.date) - dateMillis(b.date) || a.id.localeCompare(b.id));
  const values = new Map(ordered.map((m) => [m.id, matchValue(m)]));
  const refVolume = median(ordered.filter((m) => values.get(m.id)!.narrated).map((m) => values.get(m.id)!.volume));
  const rival = standings.length ? rivalFactor(standings, ordered) : NO_RIVAL;

  const players = new Map<string, PlayerSeason>();
  const season = (pid: string) => {
    let p = players.get(pid);
    if (!p) players.set(pid, (p = emptySeason()));
    return p;
  };
  const entries: Entry[] = [];
  for (const m of ordered) {
    const mv = values.get(m.id)!;
    const k = mv.narrated && refVolume > 0 && mv.volume > 0 ? refVolume / mv.volume : 1;
    const f = rival(m);
    for (const [pid, pv] of mv.players) {
      const p = season(pid);
      p.played++;
      if (pv.minutes === null) {
        p.unknownMinutes++;
        continue;
      }
      if (pv.minutes <= 0) continue;
      const value = k * (pv.narrGood * f + pv.narrBad / f) + pv.actaGood * f + pv.actaBad / f;
      entries.push({ pid, match: m, minutes: pv.minutes, value, raw: (value * 50) / pv.minutes, lines: pv.lines, narrated: mv.narrated });
    }
  }

  // each player against his line's mean (his own matches left out), the line's mean pulled to the team's
  const rated = entries.filter((e) => e.minutes >= K.MIN_RATED_MINUTES);
  const reference = new Map<string, (lines: Partial<Record<Line, number>>) => number>();
  const referenceFor = (pid: string) => {
    let ref = reference.get(pid);
    if (ref) return ref;
    const pool = rated.filter((e) => e.pid !== pid);
    const team = mean(pool.map((e) => e.raw));
    const line = (l: Line) => {
      let s = 0;
      let w = 0;
      for (const e of pool) {
        const share = e.lines[l] ?? 0;
        s += share * e.raw;
        w += share;
      }
      return (s + K.LINE_PRIOR * team) / (w + K.LINE_PRIOR);
    };
    const cache = new Map<Line, number>();
    ref = (lines) => {
      const shares = Object.entries(lines) as [Line, number][];
      if (!shares.length) return team;
      return shares.reduce((s, [l, share]) => {
        if (!cache.has(l)) cache.set(l, line(l));
        return s + share * cache.get(l)!;
      }, 0);
    };
    reference.set(pid, ref);
    return ref;
  };
  const scored = rated.map((e) => {
    const mu = referenceFor(e.pid)(e.lines);
    // (CUSHION_MINUTES of his line's mean: a short stint is pulled to it, not to zero)
    const v50 = ((e.value + (mu * K.CUSHION_MINUTES) / 50) * 50) / (e.minutes + K.CUSHION_MINUTES);
    return { e, dev: v50 - mu };
  });
  const sd = Math.max(K.SD_FLOOR, Math.sqrt(mean(scored.map((s) => s.dev ** 2))));
  const notes = new Map<string, MatchNote>();
  for (const { e, dev } of scored) {
    const note: MatchNote = {
      matchId: e.match.id,
      date: dateMillis(e.match.date),
      rival: e.match.rival || "Rival",
      nota: Math.max(0, Math.min(10, K.NOTE_BASE + dev / sd)),
      minutes: e.minutes,
      weight: Math.min(1, e.minutes / K.FULL_MATCH_MINUTES) * (e.narrated ? 1 : K.UNNARRATED_WEIGHT),
      narrated: e.narrated,
    };
    notes.set(`${e.match.id}|${e.pid}`, note);
    season(e.pid).notes.push(note);
  }

  const multipleSeasons = new Set(ordered.map((m) => m.seasonId ?? "legacy")).size > 1;
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
      for (const it of values.get(n.matchId)!.players.get(pid)!.items) {
        const sum = items.get(it.label) ?? { ...it, n: 0, value: 0 };
        sum.n += it.n;
        sum.value += it.value;
        items.set(it.label, sum);
      }
    p.items = [...items.values()].sort((a, b) => a.value - b.value);
    // plus-minus (measured; it counts only once the J11 check shows it is stable)
    let on = 0, off = 0, forOn = 0, againstOn = 0, forOff = 0, againstOff = 0;
    for (const m of ordered) {
      const pm = values.get(m.id)!.players.get(pid)?.plusMinus;
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
      const nota = Math.max(-K.PLUS_MINUS_CAP, Math.min(K.PLUS_MINUS_CAP, (diff * sample) / (sample + K.PLUS_MINUS_CUSHION) / sd));
      p.plusMinus = { diff, sample, nota };
      if (K.PLUS_MINUS_ACTIVE && p.exact !== null) {
        p.exact += 10 * nota;
        p.value = Math.round(p.exact);
      }
    }
  }
  return { players, noteOf: (matchId, playerId) => notes.get(`${matchId}|${playerId}`) ?? null, multipleSeasons };
}
