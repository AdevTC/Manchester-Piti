// What the board reads, from the app's shared subscriptions (no extra listeners): the season's squad as
// cromos (players + their matches + MVPs + bajas) and the season calendar (jornada numbers, the next
// match) for the board's name and the LED boards.
import { useMemo } from "react";
import { isVisibleMatch } from "../../../../functions/src/matchEngine";
import { useClubData, dateMillis, isCompleted, nextFixture, type ClubMatch } from "../../../lib/clubData";
import { mvpWinners, type MvpResult } from "../../../lib/vestuario";
import { useMvpResults } from "../../vestuario/live";
import { useClock } from "../../../hooks/useClock";
import { usePizarraPlayers } from "../usePizarraPlayers";
import { usePizarraStats } from "../usePizarraStats";
import { scoreOf } from "../../../lib/partidos";
import { calendarOrder, jornadaNumbers } from "../../../lib/derived/jornada";
import { buildSquad } from "./ratings";
import type { Squad } from "./model";
import type { CalMatch } from "./boards";

export type { CalMatch };

export interface BoardData {
  squad: Squad;
  /** The squad's ids, the SAME array while they don't change (the squad is rebuilt with its data). */
  squadIds: string[];
  calendar: CalMatch[];
  next: CalMatch | null;
  loading: boolean;
}

/**
 * The ids as one array that keeps its identity while its content is the same: the squad object is
 * rebuilt on every clock tick (the MVP windows), and a new ids array each minute would look like a new
 * squad to whoever depends on it (the autosave re-sent the same board every minute offline).
 */
export function useSameIds(ids: readonly string[]): string[] {
  const key = ids.join("\n");
  return useMemo(() => (key ? key.split("\n") : []), [key]);
}

/**
 * The MVP winners of each match, the SAME map while the winners don't change: the clock ticks every
 * minute only to close the votes' windows, and a new map on each tick rebuilt the whole squad (every
 * cromo's form, the pairs) for nothing. The squad is rebuilt when a winner is decided, not before.
 */
export function useMvpWinners(games: readonly ClubMatch[], results: ReadonlyMap<string, MvpResult>, now: number): Map<string, string[]> {
  const key = useMemo(() => JSON.stringify(games.map((m) => [m.id, mvpWinners(m, results.get(m.id), now)])), [games, results, now]);
  return useMemo(() => new Map(JSON.parse(key) as [string, string[]][]), [key]);
}

export function useBoardData(seasonId: string): BoardData {
  const { players, loading: playersLoading } = usePizarraPlayers();
  const { suspended, loading: statsLoading } = usePizarraStats(seasonId, players);
  const { matches, loading: matchesLoading } = useClubData();
  const mvpResults = useMvpResults();
  const now = useClock(60_000);

  const season = useMemo<ClubMatch[]>(() => boardSeason(matches, seasonId), [matches, seasonId]);

  const calendar = useMemo<CalMatch[]>(() => boardCalendar(season), [season]);

  const games = useMemo(() => season.filter((m) => isCompleted(m)), [season]);
  const mvps = useMvpWinners(games, mvpResults, now);
  const squad = useMemo<Squad>(() => {
    const jornada = new Map(calendar.flatMap((c) => (c.j ? [[c.id, c.j] as const] : [])));
    return buildSquad({ players, games, jornada, suspended, mvps });
  }, [games, calendar, players, suspended, mvps]);

  const next = useMemo<CalMatch | null>(() => {
    const n = nextFixture(season, now);
    return (n && calendar.find((c) => c.id === n.id)) || null;
  }, [season, calendar, now]);

  const squadIds = useSameIds(squad.list.map((c) => c.id));

  return { squad, squadIds, calendar, next, loading: playersLoading || statsLoading || matchesLoading };
}

/** The season's matches (every season's with «all»), in the calendar's order (derived/jornada). */
export function boardSeason(matches: readonly ClubMatch[], seasonId: string): ClubMatch[] {
  return matches
    .filter((m) => isVisibleMatch(m) && (seasonId === "all" || m.seasonId === seasonId))
    .slice()
    .sort(calendarOrder);
}

/**
 * The board's calendar: the season's matches (by date) with the jornada /partidos gives each one
 * (derived/jornada — cancelled ones have none, and with «all seasons» each keeps its own season's number).
 */
export function boardCalendar(season: readonly ClubMatch[]): CalMatch[] {
  season = season.filter(isVisibleMatch);
  const jornada = jornadaNumbers(season);
  return season.map((m) => {
    const played = isCompleted(m);
    const s = played ? scoreOf(m) : null;
    return {
      id: m.id,
      j: jornada.get(m.id) ?? null,
      rival: m.rival || "Rival",
      dateMs: dateMillis(m.date) || 0,
      played,
      gf: s ? s.gf : null,
      ga: s ? s.ga : null,
      home: typeof m.home === "boolean" ? m.home : null,
      venue: typeof m.venue === "string" ? m.venue : "",
      conv: { starters: [...(m.starters ?? [])], bench: [...(m.bench ?? [])], ...(m.notCalled?.length ? { notCalled: [...m.notCalled] } : {}), ...(typeof m.convocatoriaNotifiedAt === "number" ? { notified: true } : {}) },
      ...(m.clock ? { clock: m.clock } : {}),
      ...(m.version ? { version: m.version } : {}),
      ...(typeof m.duration === "number" ? { duration: m.duration } : {}),
      ...(typeof m.liveEndedAt === "number" ? { liveEndedAt: m.liveEndedAt } : {}),
      ...(typeof m.status === "string" ? { status: m.status } : {}),
      ...(m.events?.length ? { events: m.events } : {}),
    };
  });
}
