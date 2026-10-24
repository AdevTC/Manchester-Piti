// The rival's strength from the current league table (`standings/{seasonId}`): a strong rival makes the good
// actions of that match worth more and its mistakes cost less (× / ÷ up to 1 + RIVAL_MAX), a weak one the
// other way. Only with a table no more than RIVAL_MAX_LAG jornadas behind our matches; a rival the table does
// not name clearly adjusts nothing. Pure.
import type { ClubMatch } from "../clubData";
import { norm, type Standings } from "../standings";
import { RIVAL_MAX, RIVAL_MAX_LAG, RIVAL_PRIOR_MATCHES } from "./constants";

/** A match's factor (1 = no adjustment). */
export type RivalFactor = (m: ClubMatch) => number;
export const NO_RIVAL: RivalFactor = () => 1;

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

/** Each match's factor from its season's table (current), or 1. */
export function rivalFactor(standings: readonly Standings[], games: readonly ClubMatch[]): RivalFactor {
  const bySeason = new Map<string, Map<string, number>>();
  for (const s of standings) {
    const rows = s.rows.filter((r) => !r.isUs && r.pj > 0);
    // (the table counts league matches: a friendly is not a jornada)
    const played = games.filter((m) => m.seasonId === s.id && !/amist/i.test(m.competition ?? "")).length;
    const tableJornada = s.jornada ?? s.rows.find((r) => r.isUs)?.pj ?? 0;
    if (rows.length < 2 || played - tableJornada > RIVAL_MAX_LAG) continue;
    const mean = rows.reduce((t, r) => t + r.pts, 0) / rows.reduce((t, r) => t + r.pj, 0);
    const ppg = new Map(rows.map((r) => [r, (r.pts + RIVAL_PRIOR_MATCHES * mean) / (r.pj + RIVAL_PRIOR_MATCHES)] as const));
    const avg = [...ppg.values()].reduce((t, v) => t + v, 0) / ppg.size;
    const sd = Math.sqrt([...ppg.values()].reduce((t, v) => t + (v - avg) ** 2, 0) / ppg.size);
    if (!(sd > 0)) continue;
    const factors = new Map<string, number>();
    for (const m of games) {
      if (m.seasonId !== s.id || !m.rival) continue;
      const row = rowOf(s.rows, m.rival);
      const p = row ? ppg.get(row) : undefined;
      if (p !== undefined) factors.set(m.id, 1 + RIVAL_MAX * Math.max(-1, Math.min(1, (p - avg) / sd / 2)));
    }
    bySeason.set(s.id, factors);
  }
  return (m) => bySeason.get(m.seasonId ?? "")?.get(m.id) ?? 1;
}
