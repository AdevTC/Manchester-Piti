// «Vidrio» · a long season for the tests and the previews — TEST DATA ONLY, never read by a page in
// production. 14 teams, a double round robin of 26 jornadas on Sundays from 13 Sep 2026 (a Christmas break
// of two Sundays), J17 against Orduña fc being played tonight (Sunday 17 Jan 2027, 19:00) at minute 23, 2–1,
// with 38 plays by then. On the way: three legacy jornadas without a clock (minutes typed in the acta), a
// guest who scores (J6), a shared Pichichi (Alcides and Adrián T.C., 7 each), J9 postponed and never played,
// J20 postponed ahead, and a table where Sporting de Brugal is level with us on points.
import type { ClubMatch, MatchEvent } from "../../clubData";
import type { SquadMember } from "../../home";
import type { StandingRow } from "../../standings";
import { readyClock, transitionClock, type MatchClock } from "../../../../functions/src/matchClock";
import type { EventType } from "../../../../functions/src/matchEngine";

export const LONG_SEASON_ID = "t-larga";
const MIN = 60_000;
const DAY = 86_400_000;

/** The squad, with Huberoski's birthday ten days after tonight. */
export const LONG_SQUAD: readonly SquadMember[] = [
  ["evans", "Evans", "1"], ["illescas", "Illescas", "4"], ["alcides", "Alcides", "7"], ["josito", "Josito", "8"],
  ["erik", "Erik", "9"], ["adrian", "Adrián T.C.", "10"], ["kevin", "Kevin", "11"], ["fer", "Fer", "12"],
  ["huberoski", "Huberoski", "14"], ["andia", "Andia", "19"], ["pellete", "Pellete", "20"], ["almachi", "Almachi", "21"],
  ["eguzquiza", "Eguzquiza", "22"], ["jordi", "Jordi", "28"], ["jorge", "Jorge", "30"], ["brawan", "Brawan", "33"],
].map(([id, name, num]) => ({ id, name, num, ...(id === "huberoski" ? { birthDate: "1994-01-27" } : {}) }));

/** The rivals in the order of the first leg (Orduña fc fourth: J4 away, J17 at home). */
export const LONG_RIVALS = [
  "Chamartín Bohemios", "Entrepibas F.C.", "Inter de Usera", "Orduña fc", "Red Demons", "Los Gatos de Lavapiés",
  "Sporting de Brugal", "Atlético Pirulí", "Pitutis", "Unión Carabanchel 2015", "SQUIRTLES FC", "Deportivo Bocata", "Olímpica Latina",
] as const;

/** A Madrid wall-clock time as ms (CEST until 25 Oct 2026 and from 28 Mar 2027, CET in between). */
export function madridMs(y: number, mo: number, d: number, h: number, mi = 0): number {
  const utc = Date.UTC(y, mo - 1, d, h, mi);
  const summer = utc < Date.UTC(2026, 9, 25, 1) || utc >= Date.UTC(2027, 2, 28, 1);
  return utc - (summer ? 2 : 1) * 3_600_000;
}

/** The 26 Sundays (13 Sep 2026 … 21 Mar 2027, without 27 Dec and 3 Jan). */
function sundays(): number[] {
  const out: number[] = [];
  let d = Date.UTC(2026, 8, 13);
  while (out.length < 26) {
    const iso = new Date(d).toISOString().slice(0, 10);
    if (iso !== "2026-12-27" && iso !== "2027-01-03") out.push(d);
    d += 7 * DAY;
  }
  return out;
}
const KICKS = [10, 12, 16, 17, 18, 19, 20, 11, 12, 17, 19, 16, 18, 11, 17, 16, 19, 12, 17, 18, 16, 11, 19, 20, 17, 12];

/** Our results J1–J16 (null: J9, postponed). */
const RESULTS: readonly ([number, number] | null)[] = [[3, 1], [2, 0], [1, 2], [4, 2], [2, 2], [1, 0], [0, 3], [5, 1], null, [2, 1], [2, 3], [1, 1], [3, 0], [1, 4], [2, 1], [0, 1]];
/** Our 29 goals in order: Alcides 7, Adrián T.C. 7, Kevin 4, Erik 3, Jordi 2, Eguzquiza 2, a guest (J6), Huberoski, Josito, Fer. */
const SCORERS = [
  "alcides", "adrian", "kevin", "alcides", "erik", "adrian", "jordi", "alcides", "adrian", "kevin", "eguzquiza", "alcides", "guest:g1", "adrian", "erik",
  "huberoski", "alcides", "kevin", "adrian", "josito", "alcides", "erik", "adrian", "jordi", "kevin", "eguzquiza", "alcides", "adrian", "fer",
];
const ASSISTERS = ["jordi", "adrian", "josito", "eguzquiza", "alcides", "fer"];
const STARTERS = ["evans", "illescas", "fer", "jordi", "eguzquiza", "alcides", "adrian"];
const BENCH = ["erik", "kevin", "josito", "huberoski"];

/** The clock of a played match: 25 + 25 minutes with a 5-minute break. */
function playedClock(ko: number): MatchClock {
  const a = transitionClock(readyClock(), "start", ko);
  const b = transitionClock(a, "halftime", ko + 25 * MIN);
  const c = transitionClock(b, "second", ko + 30 * MIN);
  return transitionClock(c, "finish", ko + 55 * MIN);
}

/** An event at minute `m` (1-based, as shown): clock-stamped with its period, or typed in the acta (legacy). */
function at(m: number, legacy: boolean, slot = 0): Pick<MatchEvent, "minute" | "elapsedSeconds" | "period"> {
  if (legacy) return { minute: m };
  return { minute: m - 1, elapsedSeconds: (m - 1) * 60 + 5 + slot * 10, period: m <= 25 ? 1 : 2 };
}

/** Tonight's 38 plays by minute 23: [minute, type, player, assist]. */
const TONIGHT: readonly [number, EventType, string?, string?][] = [
  [1, "chance", "alcides"], [2, "foul_received", "jordi"], [3, "corner", "eguzquiza"], [3, "chance", "illescas"], [4, "opponent_chance"],
  [5, "foul", "fer"], [6, "goal", "alcides", "adrian"], [7, "opponent_chance"], [8, "save", "evans"], [8, "opponent_corner"],
  [9, "opponent_corner"], [10, "foul_received", "alcides"], [10, "chance", "eguzquiza"], [11, "opponent_corner"], [11, "opponent_goal"],
  [12, "chance", "adrian"], [13, "foul_received", "adrian"], [13, "opponent_yellow"], [14, "corner", "jordi"], [14, "chance", "eguzquiza"],
  [15, "yellow_card", "eguzquiza"], [16, "opponent_chance"], [16, "foul", "illescas"], [17, "opponent_chance"], [17, "chance", "alcides"],
  [18, "woodwork", "adrian"], [18, "corner", "adrian"], [19, "chance", "alcides"], [19, "foul_received", "fer"], [20, "opponent_chance"],
  [20, "save", "evans"], [21, "goal", "adrian", "jordi"], [21, "opponent_chance"], [22, "opponent_corner"], [22, "foul", "alcides"],
  [22, "chance", "jordi"], [23, "corner", "eguzquiza"], [23, "foul_received", "eguzquiza"],
];

/** The 14-team table before tonight (the captains' standings doc). Sporting de Brugal: 26 points, like us. */
export const LONG_STANDINGS: readonly StandingRow[] = (
  [
    ["Chamartín Bohemios", 16, 11, 3, 2, 38, 17],
    ["Entrepibas F.C.", 16, 10, 3, 3, 33, 18],
    ["Inter de Usera", 15, 9, 4, 2, 30, 17],
    ["Red Demons", 16, 9, 2, 5, 28, 22],
    ["Los Gatos de Lavapiés", 16, 8, 3, 5, 27, 23],
    ["Manchester Piti", 15, 8, 2, 5, 29, 22],
    ["Sporting de Brugal", 16, 7, 5, 4, 24, 22],
    ["Atlético Pirulí", 16, 7, 2, 7, 25, 26],
    ["Pitutis", 16, 6, 3, 7, 22, 25],
    ["Unión Carabanchel 2015", 15, 5, 4, 6, 20, 25],
    ["SQUIRTLES FC", 16, 5, 2, 9, 19, 28],
    ["Deportivo Bocata", 16, 4, 3, 9, 17, 29],
    ["Orduña fc", 15, 3, 3, 9, 15, 31],
    ["Olímpica Latina", 16, 2, 2, 12, 12, 35],
  ] as const
).map(([team, pj, g, e, p, gf, gc]) => ({ team, pj, g, e, p, gf, gc, pts: g * 3 + e, isUs: team === "Manchester Piti" }));

export interface LongSeasonFixture {
  seasonId: string;
  /** Tonight, minute 23 of J17 (the clock has run 22:30). */
  now: number;
  /** J17's kick-off. */
  kickoff: number;
  /** J17's id. */
  liveId: string;
  matches: ClubMatch[];
  standings: StandingRow[];
  squad: SquadMember[];
  /** The squad's names by id. */
  nameOf: (id: string) => string;
}

/** The long season, built fresh each call (tests may change it). */
export function longSeasonFixture(): LongSeasonFixture {
  const days = sundays();
  const matches: ClubMatch[] = [];
  let goal = 0;
  let liveKo = 0;
  days.forEach((sunday, i) => {
    const n = i + 1;
    const date = new Date(sunday);
    const ko = madridMs(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), n === 17 ? 19 : KICKS[i]);
    const rival = LONG_RIVALS[i % 13];
    const firstLeg = n <= 13;
    const home = firstLeg ? n % 2 === 1 : (n - 13) % 2 === 0;
    const legacy = n <= 3;
    const base: ClubMatch = {
      id: `j${n}`,
      seasonId: LONG_SEASON_ID,
      ...(legacy ? {} : { version: 2 as const }),
      rival,
      competition: "Liga F7",
      date: { seconds: Math.floor(ko / 1000), nanoseconds: 0 },
      duration: 50,
      home,
      venue: home ? "CDM Palomeras" : `Campo de ${rival}`,
      status: "scheduled",
      starters: [...STARTERS],
      bench: [...BENCH],
      notCalled: [],
      events: [],
      report: "",
    };
    if (n <= 16) {
      const res = RESULTS[i];
      if (!res) {
        matches.push({ ...base, status: "postponed", clock: readyClock() });
        return;
      }
      const [gf, ga] = res;
      const events: MatchEvent[] = [];
      for (let k = 0; k < gf; k++) {
        const scorer = SCORERS[goal];
        const assist = goal % 3 === 2 ? undefined : ASSISTERS.filter((a) => a !== scorer)[goal % 5];
        goal++;
        events.push({ id: `j${n}-g${k}`, type: "goal", playerId: scorer, ...(assist ? { assistPlayerId: assist } : {}), ...at(4 + Math.floor(((k + 1) * 44) / (gf + 1)), legacy) });
      }
      for (let k = 0; k < ga; k++) events.push({ id: `j${n}-r${k}`, type: "opponent_goal", ...at(6 + Math.floor(((k + 1) * 40) / (ga + 1)), legacy, 1) });
      if (n % 3 === 0) events.push({ id: `j${n}-a`, type: "yellow_card", playerId: "eguzquiza", ...at(30, legacy, 2) });
      if (n === 4) events.push({ id: `j${n}-p`, type: "woodwork", playerId: "adrian", ...at(12, legacy, 2) });
      if (n === 8) events.push({ id: `j${n}-s`, type: "save", playerId: "evans", ...at(33, legacy, 3) });
      matches.push({
        ...base,
        status: "finished",
        goalsFor: gf,
        goalsAgainst: ga,
        events,
        ...(legacy ? { liveEndedAt: ko + 55 * MIN } : { clock: playedClock(ko), liveEndedAt: ko + 55 * MIN, voteClosesAt: ko + 2 * DAY }),
        ...(n === 6 ? { guests: [{ id: "g1", name: "Rafa" }], bench: [...BENCH, "guest:g1"] } : {}),
      });
      return;
    }
    if (n === 17) {
      liveKo = ko;
      const events = TONIGHT.map(([m, type, playerId, assist], k): MatchEvent => ({
        id: `j17-${k + 1}`,
        type,
        ...(playerId ? { playerId } : {}),
        ...(assist ? { assistPlayerId: assist } : {}),
        ...at(m, false, k % 3),
      }));
      matches.push({ ...base, events, clock: transitionClock(readyClock(), "start", ko) });
      return;
    }
    matches.push({ ...base, status: n === 20 ? "postponed" : "scheduled", clock: readyClock(), starters: [], bench: [] });
  });
  const names = new Map(LONG_SQUAD.map((p) => [p.id, p.name]));
  return {
    seasonId: LONG_SEASON_ID,
    now: liveKo + 22 * MIN + 30_000,
    kickoff: liveKo,
    liveId: "j17",
    matches,
    standings: LONG_STANDINGS.map((r) => ({ ...r })),
    squad: LONG_SQUAD.map((p) => ({ ...p })),
    nameOf: (id) => names.get(id) ?? id,
  };
}
