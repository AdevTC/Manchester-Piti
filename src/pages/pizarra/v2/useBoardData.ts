// What the board reads, from the app's shared subscriptions (no extra listeners): the season's squad as
// cromos (players + their matches + MVPs + bajas) and the season calendar (jornada numbers, the next
// match) for the board's name and the LED boards.
import { useMemo } from "react";
import { useClubData, dateMillis, isCompleted, nextFixture, type ClubMatch } from "../../../lib/clubData";
import { mvpWinners } from "../../../lib/vestuario";
import { useMvpResults } from "../../vestuario/live";
import { useClock } from "../../../hooks/useClock";
import { usePizarraPlayers } from "../usePizarraPlayers";
import { usePizarraStats } from "../usePizarraStats";
import { scoreOf } from "../../../lib/partidos";
import { buildSquad } from "./ratings";
import type { Squad } from "./model";
import type { CalMatch } from "./boards";

export type { CalMatch };

export interface BoardData {
  squad: Squad;
  calendar: CalMatch[];
  next: CalMatch | null;
  loading: boolean;
}

export function useBoardData(seasonId: string): BoardData {
  const { players, loading: playersLoading } = usePizarraPlayers();
  const statsArg = useMemo(() => players.map((p) => ({ id: p.id, seasonsCount: p.seasonsCount })), [players]);
  const { suspended, loading: statsLoading } = usePizarraStats(seasonId, statsArg);
  const { matches, loading: matchesLoading } = useClubData();
  const mvpResults = useMvpResults();
  const now = useClock(60_000);

  const season = useMemo<ClubMatch[]>(
    () =>
      matches
        .filter((m) => seasonId === "all" || m.seasonId === seasonId)
        .slice()
        .sort((a, b) => (dateMillis(a.date) || 0) - (dateMillis(b.date) || 0) || a.id.localeCompare(b.id)),
    [matches, seasonId],
  );

  const calendar = useMemo<CalMatch[]>(
    () =>
      season.map((m, i) => {
        const played = isCompleted(m);
        const s = played ? scoreOf(m) : null;
        return {
          id: m.id,
          j: i + 1,
          rival: m.rival || "Rival",
          dateMs: dateMillis(m.date) || 0,
          played,
          gf: s ? s.gf : null,
          ga: s ? s.ga : null,
          home: typeof m.home === "boolean" ? m.home : null,
          venue: typeof m.venue === "string" ? m.venue : "",
        };
      }),
    [season],
  );

  const squad = useMemo<Squad>(() => {
    const games = season.filter((m) => isCompleted(m));
    const jornada = new Map(calendar.map((c) => [c.id, c.j]));
    const mvps = new Map<string, string[]>();
    games.forEach((m) => mvps.set(m.id, mvpWinners(m, mvpResults.get(m.id), now)));
    return buildSquad({ players, games, jornada, suspended, mvps });
  }, [season, calendar, players, suspended, mvpResults, now]);

  const next = useMemo<CalMatch | null>(() => {
    const n = nextFixture(season, now);
    return (n && calendar.find((c) => c.id === n.id)) || null;
  }, [season, calendar, now]);

  return { squad, calendar, next, loading: playersLoading || statsLoading || matchesLoading };
}
