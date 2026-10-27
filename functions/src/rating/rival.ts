// The rival's strength from the current league table (`standings/{seasonId}`): a strong rival makes the good
// actions of that match worth more and its mistakes cost less (× / ÷ up to 1 + RIVAL_MAX), a weak one the
// other way; and what it usually scores and concedes is a normal match against it (the team's part of a nota).
// Only with a table no more than RIVAL_MAX_LAG jornadas behind our matches; a rival the table does not name
// clearly adjusts nothing. Pure.
import { durationOf, type Normal, type RatingMatch, type StandingsLike, type StandingsRowLike } from "./types.js";
import { RIVAL_MAX, RIVAL_MAX_LAG, RIVAL_PRIOR_MATCHES } from "./constants.js";

/** A name compared without accents, case or extra spaces (the web's standings.ts norm). */
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("es").replace(/\s+/g, " ").trim();

const goalsOf = (v: unknown): number | undefined => (Number.isInteger(v) && (v as number) >= 0 ? (v as number) : undefined);
/** A stored table (`standings/{seasonId}`) as the rival's strength reads it: null unless it has ≥ 2 rows and
 *  exactly one is us (the web's mapStandings drops the same). */
export function standingsLike(id: string, data: unknown): StandingsLike | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const rows = Array.isArray(d.rows)
    ? d.rows.flatMap((r: unknown) => {
        const o = r && typeof r === "object" ? (r as Record<string, unknown>) : null;
        const ok = o && typeof o.team === "string" && typeof o.isUs === "boolean" && Number.isInteger(o.pj) && Number.isInteger(o.pts) && (o.pj as number) >= 0 && (o.pts as number) >= 0;
        if (!ok) return [];
        const row: StandingsRowLike = { team: o.team as string, isUs: o.isUs as boolean, pj: o.pj as number, pts: o.pts as number };
        const gf = goalsOf(o.gf);
        const gc = goalsOf(o.gc);
        return [gf !== undefined && gc !== undefined ? { ...row, gf, gc } : row];
      })
    : [];
  if (rows.length < 2 || rows.filter((r) => r.isUs).length !== 1) return null;
  const jornada = Number.isInteger(d.jornada) && (d.jornada as number) >= 0 ? (d.jornada as number) : null;
  return { id, jornada, rows };
}

/** A match's factor (1 = no adjustment). */
export type RivalFactor = (m: RatingMatch) => number;
export const NO_RIVAL: RivalFactor = () => 1;
/** A normal match against a match's rival (null: the table does not say). */
export type RivalGoals = (m: RatingMatch) => Normal | null;
export const NO_RIVAL_GOALS: RivalGoals = () => null;

// (club words a league adds or drops: «Orduña fc» is «ORDUÑA F.C.» in the table)
const FILLER = new Set(["fc", "cf", "cd", "ud", "sd", "ad", "cp", "club", "de", "del", "la", "el", "los", "las", "futbol", "f7", "c", "f", "d"]);
const tokens = (name: string) => norm(name).replace(/[^\p{L}\p{N} ]/gu, " ").split(" ").filter((t) => t && !FILLER.has(t));

/** The table row of a rival as a match names it: the same name, or one name's words inside the other's. */
function rowOf<T extends { team: string; isUs: boolean }>(rows: readonly T[], rival: string): T | null {
  const want = tokens(rival);
  if (!want.length) return null;
  const key = want.join(" ");
  const others = rows.filter((r) => !r.isUs);
  const exact = others.filter((r) => tokens(r.team).join(" ") === key);
  if (exact.length === 1) return exact[0];
  const within = (a: string[], b: string[]) => a.length > 0 && a.every((t) => b.includes(t)) && a.some((t) => t.length >= 4);
  const close = others.filter((r) => {
    const have = tokens(r.team);
    return within(want, have) || within(have, want);
  });
  return close.length === 1 ? close[0] : null;
}

/** The tables that may adjust these matches: each season's, with its rivals that have played, unless it lags. */
function usableTables(standings: readonly StandingsLike[], games: readonly RatingMatch[]) {
  return standings.flatMap((s) => {
    const rows = s.rows.filter((r) => !r.isUs && r.pj > 0);
    // (the table counts league matches: a friendly is not a jornada)
    const played = games.filter((m) => m.seasonId === s.id && !/amist/i.test(m.competition ?? "")).length;
    const tableJornada = s.jornada ?? s.rows.find((r) => r.isUs)?.pj ?? 0;
    return rows.length < 2 || played - tableJornada > RIVAL_MAX_LAG ? [] : [{ s, rows, games: games.filter((m) => m.seasonId === s.id && !!m.rival) }];
  });
}

/** Each match's factor from its season's table (current), or 1. */
export function rivalFactor(standings: readonly StandingsLike[], games: readonly RatingMatch[]): RivalFactor {
  const bySeason = new Map<string, Map<string, number>>();
  for (const { s, rows, games: theirs } of usableTables(standings, games)) {
    const mean = rows.reduce((t, r) => t + r.pts, 0) / rows.reduce((t, r) => t + r.pj, 0);
    const ppg = new Map(rows.map((r) => [r, (r.pts + RIVAL_PRIOR_MATCHES * mean) / (r.pj + RIVAL_PRIOR_MATCHES)] as const));
    const avg = [...ppg.values()].reduce((t, v) => t + v, 0) / ppg.size;
    const sd = Math.sqrt([...ppg.values()].reduce((t, v) => t + (v - avg) ** 2, 0) / ppg.size);
    if (!(sd > 0)) continue;
    const factors = new Map<string, number>();
    for (const m of theirs) {
      const row = rowOf(s.rows, m.rival!);
      const p = row ? ppg.get(row) : undefined;
      if (p !== undefined) factors.set(m.id, 1 + RIVAL_MAX * Math.max(-1, Math.min(1, (p - avg) / sd / 2)));
    }
    bySeason.set(s.id, factors);
  }
  return (m) => bySeason.get(m.seasonId ?? "")?.get(m.id) ?? 1;
}

/** Each match's normal from its season's table: what the rival scores per match is what we usually concede, and
 *  what it concedes, what we usually score (shrunk with RIVAL_PRIOR_MATCHES to the league's mean, per 50′); null
 *  when the table has no goals or does not name the rival. */
export function rivalGoals(standings: readonly StandingsLike[], games: readonly RatingMatch[]): RivalGoals {
  const bySeason = new Map<string, Map<string, Normal>>();
  for (const { s, rows, games: theirs } of usableTables(standings, games)) {
    // (a row with no goals at all is a table whose goal columns were left empty)
    const told = rows.filter((r) => r.gf !== undefined && r.gc !== undefined && r.gf + r.gc > 0);
    const pj = told.reduce((t, r) => t + r.pj, 0);
    if (told.length < 2 || !(pj > 0)) continue;
    const scored = told.reduce((t, r) => t + r.gf!, 0) / pj;
    const conceded = told.reduce((t, r) => t + r.gc!, 0) / pj;
    const normals = new Map<string, Normal>();
    for (const m of theirs) {
      const row = rowOf(s.rows, m.rival!);
      if (!row || !(row.pj > 0) || row.gf === undefined || row.gc === undefined || row.gf + row.gc === 0) continue;
      const per50 = 50 / durationOf(m);
      normals.set(m.id, {
        against: ((row.gf + RIVAL_PRIOR_MATCHES * scored) / (row.pj + RIVAL_PRIOR_MATCHES)) * per50,
        for: ((row.gc + RIVAL_PRIOR_MATCHES * conceded) / (row.pj + RIVAL_PRIOR_MATCHES)) * per50,
      });
    }
    bySeason.set(s.id, normals);
  }
  return (m) => bySeason.get(m.seasonId ?? "")?.get(m.id) ?? null;
}
