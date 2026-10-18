import { describe, expect, it } from "vitest";
import type { ClubMatch } from "../../lib/clubData";
import type { StandingRow } from "../../lib/standings";
import { readyClock, transitionClock } from "../../../functions/src/matchClock";
import { matchdayOf } from "../../lib/derived/matchday";
import { boardOf, dayLine, lightLabel, placeLabel, provisionalTable, rowTag, sliceLight, sliceMatches, venueName } from "./model";

const madrid = (iso: string) => Date.parse(iso); // with an explicit offset
const m = (id: string, over: Partial<ClubMatch> = {}): ClubMatch => ({ id, seasonId: "t1", rival: id.toUpperCase(), status: "scheduled", date: 0, ...over }) as ClubMatch;
const row = (team: string, pts: number, isUs = false): StandingRow => ({ team, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts, isUs });

describe("the light of a kick-off in words", () => {
  it("noon, dusk and night in Palomeras", () => {
    expect(lightLabel(madrid("2026-10-25T14:00:00+01:00")).text).toMatch(/^Sol de mediodía, a \d+°$/);
    expect(lightLabel(madrid("2026-11-22T17:00:00+01:00")).text).toMatch(/^Atardecer, sol a \d°$/);
    expect(lightLabel(madrid("2026-11-08T21:00:00+01:00")).text).toBe("De noche, con focos");
    expect(lightLabel(madrid("2026-11-08T21:00:00+01:00")).sunny).toBe(false);
  });
  it("played jornadas go to night, the live one is drawn now", () => {
    const ko = madrid("2026-10-18T13:00:00+02:00");
    const done = m("a", { status: "finished", date: ko, goalsFor: 1, goalsAgainst: 0 });
    const night = sliceLight(done, ko + 3 * 86_400_000, false);
    expect(night.floodlights).toBe("glow");
    expect(lightLabel(night.at).sunny).toBe(false);
    expect(sliceLight(m("b", { date: ko }), ko + 600_000, true).at).toBe(ko + 600_000);
  });
});

describe("words of the calendar", () => {
  it("venues as people write them", () => {
    expect(venueName("CDM PALOMERAS")).toBe("CDM Palomeras");
    expect(venueName("Campo de Pitutis")).toBe("Campo de Pitutis");
    expect(placeLabel({ home: false, venue: "Campo de Pitutis" })).toBe("Fuera, en Pitutis");
    expect(placeLabel({ home: true, venue: "CDM PALOMERAS" })).toBe("En casa, Palomeras");
  });
  it("the day line of a slice", () => {
    const now = madrid("2026-10-18T12:00:00+02:00");
    expect(dayLine(madrid("2026-10-18T19:00:00+02:00"), now)).toBe("hoy, dom 18 oct");
    expect(dayLine(madrid("2026-10-25T14:00:00+01:00"), now)).toBe("dom 25 oct");
    expect(dayLine(madrid("2026-10-25T14:00:00+01:00"), now, true)).toBe("dom 25 oct, en 7 días");
  });
  it("row tags: home, away, live, result with its letter, postponed", () => {
    const ko = madrid("2026-10-18T19:00:00+02:00");
    expect(rowTag(m("a", { date: ko, home: true }), ko - 1, null)).toEqual({ text: "En casa", kind: "c" });
    expect(rowTag(m("a", { date: ko, home: false }), ko - 1, null)).toEqual({ text: "Fuera", kind: "f" });
    expect(rowTag(m("a", { date: ko, status: "finished", goalsFor: 0, goalsAgainst: 2 }), ko + 1e8, null)).toEqual({ text: "0–2", kind: "r", result: "P" });
    expect(rowTag(m("a", { date: ko, status: "postponed" }), ko - 1, null).text).toBe("Aplazado, sin fecha");
    const live = m("a", { version: 2, date: ko, duration: 50, clock: transitionClock(readyClock(), "start", ko), events: [] });
    expect(rowTag(live, ko + 10 * 60_000, 11)).toEqual({ text: "En juego 0–0, 11′", kind: "l" });
  });
});

describe("which jornadas get a slice", () => {
  const season = ["j1", "j2", "j3", "j4", "j5", "j6", "j7", "j8"].map((id) => m(id));
  it("the featured first, then the ones after it in order, filling from before at the end of the season", () => {
    expect(sliceMatches(season, season[2]).map((x) => x.id)).toEqual(["j3", "j4", "j5", "j6", "j7", "j8"]);
    expect(sliceMatches(season, season[6]).map((x) => x.id)).toEqual(["j7", "j3", "j4", "j5", "j6", "j8"]);
    expect(sliceMatches(season, null).map((x) => x.id)).toEqual(["j1", "j2", "j3", "j4", "j5", "j6"]);
    expect(sliceMatches([], null)).toEqual([]);
  });
});

describe("the table if the match ended now", () => {
  it("adds the live result to us and to the rival (matched without case or accents)", () => {
    const ko = madrid("2026-10-18T19:00:00+02:00");
    const live = m("j1", {
      version: 2,
      date: ko,
      rival: "Orduña fc",
      clock: transitionClock(readyClock(), "start", ko),
      events: [{ id: "g", type: "goal", minute: 3, elapsedSeconds: 180, playerId: "x" } as NonNullable<ClubMatch["events"]>[number]],
    });
    const t = provisionalTable([row("Entrepibas", 0), row("ORDUNA FC", 0), row("Manchester Piti", 0, true)], live);
    expect(t?.map((r) => [r.team, r.pts, r.pj])).toEqual([
      ["Manchester Piti", 3, 1],
      ["Entrepibas", 0, 0],
      ["ORDUNA FC", 0, 1],
    ]);
    expect(provisionalTable([row("A", 0)], null)).toBeNull();
  });
});

describe("the club scoreboard over the featured jornada", () => {
  it("before the kick-off it counts down in words a once-a-minute clock can't misread («13 min», never «0:13»)", () => {
    const ko = madrid("2026-10-18T19:00:00+02:00");
    const j1 = m("j1", { date: ko });
    const at = (now: number) => boardOf(matchdayOf([j1], "t1", now), j1, now);
    expect(at(ko - 13 * 60_000)).toMatchObject({ k: "Faltan", c: "13 min", plate: "Hoy 19:00" });
    expect(at(ko - 125 * 60_000)).toMatchObject({ k: "Faltan", c: "2:05 h" });
  });
});
