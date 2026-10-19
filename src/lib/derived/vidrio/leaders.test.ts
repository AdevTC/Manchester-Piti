import { describe, expect, it } from "vitest";
import { readyClock } from "../../../../functions/src/matchClock";
import type { ClubMatch } from "../../clubData";
import { longSeasonFixture } from "./fixtures";
import { seasonLeaders } from "./leaders";

const f = longSeasonFixture();
/** The season before tonight's kick-off: J17's clock not started yet. */
const beforeTonight = f.matches.map((m) => (m.id === f.liveId ? { ...m, clock: readyClock(), events: [] } : m));

describe("seasonLeaders · the long season", () => {
  it("before tonight: a shared Pichichi, 7 each, ranked 1, 1, 3…; the guest's goal is nobody's", () => {
    const l = seasonLeaders(beforeTonight, f.seasonId, f.squad, f.kickoff - 60_000);
    expect(l.goals.map((r) => [r.name, r.value, r.rank, r.shared])).toEqual([
      ["Adrián T.C.", 7, 1, true],
      ["Alcides", 7, 1, true],
      ["Kevin", 4, 3, false],
      ["Erik", 3, 4, false],
      ["Eguzquiza", 2, 5, true],
      ["Jordi", 2, 5, true],
      ["Fer", 1, 7, true],
      ["Huberoski", 1, 7, true],
      ["Josito", 1, 7, true],
    ]);
    expect(l.goals.reduce((s, r) => s + r.value, 0)).toBe(28);
    expect(l.topScorers.map((r) => r.id)).toEqual(["adrian", "alcides"]);
    expect(l.goalsLine).toBe("Pichichi compartido: Adrián T.C. y Alcides, 7 goles.");
    expect(l.goalsHint).toBe("Adrián T.C. y Alcides, 7");
    expect(l.live).toBe(false);
    expect(l.goals.every((r) => r.provisional === 0)).toBe(true);
  });

  it("tonight, live: each of them scored again (provisional), and so did their assists", () => {
    const l = seasonLeaders(f.matches, f.seasonId, f.squad, f.now);
    expect(l.live).toBe(true);
    expect(l.topScorers.map((r) => [r.name, r.value, r.provisional])).toEqual([
      ["Adrián T.C.", 8, 1],
      ["Alcides", 8, 1],
    ]);
    const before = seasonLeaders(beforeTonight, f.seasonId, f.squad, f.kickoff - 60_000);
    const assists = (x: typeof l, id: string) => x.assists.find((r) => r.id === id);
    expect(assists(l, "jordi")!.value).toBe(assists(before, "jordi")!.value + 1);
    expect(assists(l, "jordi")!.provisional).toBe(1);
    expect(assists(l, "adrian")!.provisional).toBe(1);
  });

  it("assists are ranked the same way (competition ranking, a tie by name)", () => {
    const { assists } = seasonLeaders(f.matches, f.seasonId, f.squad, f.now);
    expect(assists.length).toBeGreaterThan(3);
    assists.forEach((r, i) => {
      if (i) expect(r.value).toBeLessThanOrEqual(assists[i - 1].value);
      expect(r.rank).toBe(assists.findIndex((x) => x.value === r.value) + 1);
    });
  });
});

describe("seasonLeaders · the lines", () => {
  const base: ClubMatch = { id: "m1", seasonId: "s", status: "finished", rival: "X", date: 1_700_000_000_000, goalsFor: 2, goalsAgainst: 0, events: [] };
  const squad = [
    { id: "a", name: "Adrián T.C.", num: "10" },
    { id: "b", name: "Borja", num: "9" },
  ];

  it("one leader", () => {
    const m = { ...base, events: [{ id: "1", type: "goal" as const, playerId: "a", assistPlayerId: "b", minute: 3 }, { id: "2", type: "goal" as const, playerId: "a", minute: 9 }] };
    const l = seasonLeaders([m], "s", squad, 1_800_000_000_000);
    expect(l.goalsLine).toBe("Adrián T.C. manda, con 2 goles.");
    expect(l.assistsLine).toBe("Borja es quien más pases de gol da.");
    expect(l.goalsHint).toBe("Adrián T.C., 2");
  });

  it("shared assists", () => {
    const m = { ...base, events: [{ id: "1", type: "goal" as const, playerId: "a", assistPlayerId: "b", minute: 3 }, { id: "2", type: "goal" as const, playerId: "b", assistPlayerId: "a", minute: 9 }] };
    expect(seasonLeaders([m], "s", squad, 1_800_000_000_000).assistsLine).toBe("Adrián T.C. y Borja reparten más que nadie: 1 asistencia cada uno.");
  });

  it("nobody yet", () => {
    const l = seasonLeaders([], "s", squad, 1_800_000_000_000);
    expect(l).toMatchObject({ goals: [], assists: [], topScorers: [], goalsLine: "Aún sin goles.", assistsLine: "Ni un pase de gol todavía.", goalsHint: "Aún sin goles", live: false });
  });
});
