// Deterministic team chemistry/rating from real player stats. Pure (no React).
// Normalized against the season squad so the number is relative to the club's
// own scale and nothing is fabricated; missing data counts as zero, never up.
import { EMPTY_STATS, type MatchLike, type PlayerStats, type StatEvent } from "../../lib/playerStats";
import type { SlotState, Zone } from "./formations";

export interface SquadNorms {
  maxGA: number;
  maxPJ: number;
  maxSeasons: number;
  maxCards: number;
}

export function squadNorms(squad: { s: PlayerStats; seasons: number }[]): SquadNorms {
  let maxGA = 0, maxPJ = 0, maxSeasons = 0, maxCards = 0;
  squad.forEach(({ s, seasons }) => {
    maxGA = Math.max(maxGA, s.goals + s.assists);
    maxPJ = Math.max(maxPJ, s.matchesPlayed);
    maxSeasons = Math.max(maxSeasons, seasons);
    maxCards = Math.max(maxCards, s.yellowCards + 2 * s.redCards);
  });
  return { maxGA, maxPJ, maxSeasons, maxCards };
}

export interface PlacedPlayer {
  id: string;
  s: PlayerStats;
  seasons: number;
  zone: Zone; // the slot's zone (for line stats)
  outOfPosition: boolean;
}

export interface Rating {
  score: number; // 0..100
  tier: string;
  prod: number; // 0..1 axes (for the radar)
  exp: number;
  disc: number;
  fit: number;
  oop: number;
  empty: number;
  missing: number;
  rationale: string;
}

const ratio = (v: number, m: number): number => (m > 0 ? v / m : 0);

export function teamRating(placed: PlacedPlayer[], emptySlots: number, norms: SquadNorms): Rating {
  const n = placed.length;
  if (n === 0) {
    return { score: 0, tier: "Sin once", prod: 0, exp: 0, disc: 0, fit: 0, oop: 0, empty: emptySlots, missing: 0, rationale: "Coloca jugadores para valorar el once." };
  }
  let P = 0, E = 0, D = 0, oop = 0, missing = 0;
  placed.forEach(({ s, seasons, outOfPosition }) => {
    P += ratio(s.goals + s.assists, norms.maxGA);
    E += 0.5 * ratio(seasons, norms.maxSeasons) + 0.5 * ratio(s.matchesPlayed, norms.maxPJ);
    D += 1 - ratio(s.yellowCards + 2 * s.redCards, norms.maxCards);
    if (outOfPosition) oop += 1;
    if (s.matchesPlayed === 0) missing += 1;
  });
  P /= n;
  E /= n;
  D /= n;
  const base = 0.5 * P + 0.25 * E + 0.25 * D;
  const fit = Math.max(0.4, Math.min(1, 1 - 0.05 * oop - 0.12 * emptySlots));
  const score = Math.round(100 * base * fit);
  const tier = score >= 80 ? "Élite" : score >= 65 ? "Sólido" : score >= 50 ? "Competitivo" : "En construcción";
  const driver = P >= E && P >= D ? "Producción alta" : E >= D ? "Bloque con experiencia" : "Disciplina sólida";
  const flags: string[] = [];
  if (oop) flags.push(`${oop} fuera de posición`);
  if (emptySlots) flags.push(`${emptySlots} hueco${emptySlots > 1 ? "s" : ""}`);
  if (missing) flags.push(`${missing} sin historial`);
  return { score, tier, prod: P, exp: E, disc: D, fit, oop, empty: emptySlots, missing, rationale: [driver, ...flags].join(" · ") };
}

export interface LineStat {
  zone: Zone;
  count: number;
  goals: number;
  assists: number;
  pj: number;
  cards: number;
}

export function lineStats(placed: PlacedPlayer[]): LineStat[] {
  const zones: Zone[] = ["DEF", "MED", "DEL"];
  return zones.map((zone) => {
    const inZone = placed.filter((p) => p.zone === zone);
    return {
      zone,
      count: inZone.length,
      goals: inZone.reduce((a, p) => a + p.s.goals, 0),
      assists: inZone.reduce((a, p) => a + p.s.assists, 0),
      pj: inZone.reduce((a, p) => a + p.s.matchesPlayed, 0),
      cards: inZone.reduce((a, p) => a + p.s.yellowCards + 2 * p.s.redCards, 0),
    };
  });
}

// Recent-form score per player over the last `n` matches (already date-desc).
export function recentForm(matchesByDateDesc: MatchLike[], n = 5): Map<string, number> {
  const form = new Map<string, number>();
  const add = (id: string, v: number) => form.set(id, (form.get(id) ?? 0) + v);
  matchesByDateDesc.slice(0, n).forEach((m) => {
    (m.events ?? []).forEach((ev: StatEvent) => {
      const { type, playerId, assistPlayerId } = ev;
      if (playerId) {
        if (type === "goal" || type === "goal_penalty" || type === "goal_freekick") add(playerId, 2);
        else if (type === "assist") add(playerId, 1);
        else if (type === "yellow_card") add(playerId, -0.5);
        else if (type === "red_card" || type === "double_yellow") add(playerId, -2);
      }
      if (type === "goal" && assistPlayerId) add(assistPlayerId, 1);
    });
  });
  return form;
}

export interface PlayerMeta {
  naturalPosition?: Zone;
  seasonsCount: number;
}

/** Rate an arbitrary stored lineup (slots + per-lineup positions) against the
 *  season's stats/norms. Used by the compare view. */
export function ratingForLineupDoc(
  slots: SlotState[],
  playerPositions: Record<string, Zone>,
  statsById: Map<string, PlayerStats>,
  metaById: Map<string, PlayerMeta>,
  norms: SquadNorms,
): { rating: Rating; lines: LineStat[] } {
  const placed: PlacedPlayer[] = slots
    .filter((s) => s.playerId)
    .map((s) => {
      const id = s.playerId as string;
      const z = playerPositions[id] ?? metaById.get(id)?.naturalPosition;
      return {
        id,
        s: statsById.get(id) ?? EMPTY_STATS,
        seasons: metaById.get(id)?.seasonsCount ?? 0,
        zone: s.zone,
        outOfPosition: !!z && z !== s.zone,
      };
    });
  return { rating: teamRating(placed, slots.length - placed.length, norms), lines: lineStats(placed) };
}

// A player is suspended if, in the most recent match they appeared in, they got
// a red card or a double yellow. Matches must be ordered most-recent-first.
export function suspendedSet(matchesByDateDesc: MatchLike[]): Set<string> {
  const seen = new Set<string>();
  const suspended = new Set<string>();
  matchesByDateDesc.forEach((m) => {
    const appeared = new Set<string>();
    const flagged = new Set<string>();
    (m.events ?? []).forEach((ev) => {
      if (!ev.playerId) return;
      appeared.add(ev.playerId);
      if (ev.type === "red_card" || ev.type === "double_yellow") flagged.add(ev.playerId);
    });
    appeared.forEach((id) => {
      if (seen.has(id)) return; // a more recent match already decided this player
      seen.add(id);
      if (flagged.has(id)) suspended.add(id);
    });
  });
  return suspended;
}
