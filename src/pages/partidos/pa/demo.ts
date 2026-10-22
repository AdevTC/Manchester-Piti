// DEV only (?demo=larga): the long demo season of the PA- boards — 26 jornadas, 14 teams, the J17 live at minute
// 23, two postponed — as the page's data, so its shape can be checked against the boards with the emulators'
// production data untouched. `momento=antes` moves the clock to six hours before the J17. Never in a build.
import { LONG_SEASON_ID, longSeasonFixture } from "../../../lib/derived/vidrio/fixtures";
import type { ClubMatch } from "../../../lib/clubData";
import type { StandingRow } from "../../../lib/standings";

export interface Demo {
  matches: ClubMatch[];
  players: { id: string; firstName: string; shirtName: string; number: number; seasons: string[] }[];
  season: { id: string; name: string; captainPlayerId: string };
  standings: { id: string; competition: string; jornada: number; updatedAt: number; updatedBy: string; rows: StandingRow[] };
  now: number;
}

export function demoSeason(momento: string | null): Demo {
  const f = longSeasonFixture();
  return {
    matches: f.matches,
    players: f.squad.map((p) => ({ id: p.id, firstName: p.name, shirtName: p.name.toUpperCase(), number: Number(p.num) || 0, seasons: [LONG_SEASON_ID] })),
    season: { id: LONG_SEASON_ID, name: "Temporada larga", captainPlayerId: "adrian" },
    standings: { id: LONG_SEASON_ID, competition: "Liga F7", jornada: 16, updatedAt: f.kickoff - 6 * 86_400_000, updatedBy: "Adrián T.C.", rows: f.standings },
    now: momento === "antes" ? f.kickoff - 6 * 3_600_000 : f.now,
  };
}
