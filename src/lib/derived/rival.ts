// El rival: what the finished matches already loaded say about one rival — the record (PJ · G-E-P ·
// GF:GC), the last meetings, our scorers against them, the biggest win and the first meeting. One pure
// function feeds the match page's «El rival» (previa and crónica) and the stats page's Rivales pane, so
// both count the same meetings under the same name: accents, case and spaces folded («Accept» and
// «accept » are one rival).
import type { ClubMatch } from "../clubData";
import { dateMillis, isCompleted } from "../../../functions/src/matchEngine";
import { opponentInitials, teamAnalysis } from "../clubAnalytics";
import { isGuestId } from "./guests";
import { rivalKey } from "./rivalLogo";

export { rivalKey };

/** A rival as a match names it («Rival» when it names none, as the stats page always grouped it). */
const rivalOf = (m: Pick<ClubMatch, "rival">): string => m.rival || "Rival";

/** Our goals that have a scorer of ours (an own goal of theirs has none). */
const SCORED = new Set(["goal", "goal_penalty", "goal_freekick"]);

export interface RivalScorer {
  id: string;
  goals: number;
  /** The season of his latest meeting with a goal against them (his name and his page that season). */
  seasonId?: string;
}

export interface RivalDossier {
  /** rivalKey of the name. */
  key: string;
  /** The rival as their first meeting spelled it (the name asked for when there is none). */
  name: string;
  logo?: string;
  initials: string;
  /** Every finished meeting, newest first. */
  games: ClubMatch[];
  /** The record (teamAnalysis of the meetings, oldest first): played, wins (G), draws (E), losses (P), gf, ga… */
  record: ReturnType<typeof teamAnalysis>;
  /** The newest meetings (3 by default), newest first. */
  last: ClubMatch[];
  /** Our scorers against them, most goals first; a tie goes to whoever scored against them more recently. */
  scorers: RivalScorer[];
  /** The widest win (then the one with most goals; the first one to get there on a tie). */
  biggestWin: ClubMatch | null;
  /** The first meeting. */
  first: ClubMatch | null;
}

export interface RivalDossierOptions {
  /** A match id left out (none by default). */
  exclude?: string;
  /** How many of the newest meetings `last` keeps (3). */
  last?: number;
  /** How many scorers (3). */
  scorers?: number;
}

const byDate = (a: ClubMatch, b: ClubMatch) => dateMillis(a.date) - dateMillis(b.date) || a.id.localeCompare(b.id);

/**
 * Everything about `rivalName` from `matches`: only finished meetings count (a match still to be played,
 * live or waiting for its acta is not one), whatever their order in `matches`.
 */
export function rivalDossier(matches: readonly ClubMatch[], rivalName: string | null | undefined, opts: RivalDossierOptions = {}): RivalDossier {
  const asked = rivalName || "Rival";
  const key = rivalKey(asked);
  const chrono = matches.filter((m) => m.id !== opts.exclude && isCompleted(m) && rivalKey(rivalOf(m)) === key).sort(byDate);
  const games = [...chrono].reverse();

  let biggestWin: ClubMatch | null = null;
  for (const m of chrono) {
    const gf = m.goalsFor ?? 0, ga = m.goalsAgainst ?? 0;
    if (gf <= ga) continue;
    const bgf = biggestWin?.goalsFor ?? 0, bga = biggestWin?.goalsAgainst ?? 0;
    if (!biggestWin || gf - ga > bgf - bga || (gf - ga === bgf - bga && gf > bgf)) biggestWin = m;
  }

  const tally = new Map<string, { goals: number; at: number; seasonId?: string }>();
  chrono.forEach((m, at) => {
    for (const e of m.events ?? []) {
      if (!SCORED.has(e.type) || !e.playerId || isGuestId(e.playerId)) continue;
      const t = tally.get(e.playerId);
      tally.set(e.playerId, { goals: (t?.goals ?? 0) + 1, at, seasonId: m.seasonId });
    }
  });
  const scorers = [...tally.entries()]
    .sort(([ia, a], [ib, b]) => b.goals - a.goals || b.at - a.at || ia.localeCompare(ib))
    .slice(0, opts.scorers ?? 3)
    .map(([id, t]) => ({ id, goals: t.goals, ...(t.seasonId ? { seasonId: t.seasonId } : {}) }));

  const name = chrono.length ? rivalOf(chrono[0]) : asked;
  return {
    key,
    name,
    logo: chrono.find((m) => m.rivalLogoUrl)?.rivalLogoUrl,
    initials: chrono.find((m) => m.rivalInitials)?.rivalInitials ?? opponentInitials(name),
    games,
    record: teamAnalysis(chrono),
    last: games.slice(0, opts.last ?? 3),
    scorers,
    biggestWin,
    first: chrono[0] ?? null,
  };
}
