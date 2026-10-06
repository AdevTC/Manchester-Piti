import { describe, expect, it } from "vitest";
import { analysePlayer } from "./clubAnalytics";
import type { ClubMatch } from "./clubData";
import { collection, constellation, framesInLead, goalClock, goalLinks, minutesHeat, per50, percentile, points, radarAverage, radarPoints, radarScores, raceFrames, rivalTable, tickerLines, winRateWith } from "./statsView";

type Ev = NonNullable<ClubMatch["events"]>[number];
const goal = (minute: number, playerId: string, assistPlayerId?: string): Ev => ({ id: `${minute}${playerId}`, type: "goal", minute, playerId, ...(assistPlayerId ? { assistPlayerId } : {}) });
const against = (minute: number): Ev => ({ id: `r${minute}`, type: "opponent_goal", minute });
const match = (n: number, rival: string, events: Ev[], ledger?: ClubMatch["ledger"]): ClubMatch => ({
  id: "j" + n,
  rival,
  date: Date.UTC(2026, 8, n),
  duration: 50,
  status: "finished",
  goalsFor: events.filter((e) => e.type === "goal").length,
  goalsAgainst: events.filter((e) => e.type === "opponent_goal").length,
  events,
  ledger,
});
const row = (minutes: number, extra = {}) => ({ minutes, started: true, benched: false, notCalled: false, played: minutes > 0, subIn: 0, subOut: 0, dismissed: false, stints: [], exchanges: [], goals: 0, assists: 0, yellowCards: 0, redCards: 0, doubleYellows: 0, penaltyCommitted: 0, penaltyReceived: 0, penaltySaved: 0, penaltyMissed: 0, goalPenalty: 0, goalFreekick: 0, ownGoals: 0, woodwork: 0, ...extra });
const games = [
  match(1, "Accept", [goal(8, "ana", "bea"), against(15), goal(44, "bea")], { ana: row(50, { goals: 1 }), bea: row(50, { goals: 1, assists: 1 }), cris: row(0) }),
  match(2, "MAMBO FC", [goal(12, "bea", "ana"), against(31), against(33)], { ana: row(50, { assists: 1 }), bea: row(25, { goals: 1 }), cris: row(25) }),
  match(3, "accept ", [goal(46, "ana", "bea"), goal(48, "ana")], { ana: row(50, { goals: 2 }), bea: row(50, { assists: 1 }), cris: row(0) }),
];
const players = [
  { id: "ana", shirtName: "ANA", naturalPosition: "DEL" },
  { id: "bea", shirtName: "BEA", naturalPosition: "MED" },
  { id: "cris", shirtName: "CRIS", naturalPosition: "DEF" },
];
const rows = players.map((p) => analysePlayer(p, games));

describe("La carrera del Pichichi", () => {
  it("replays the cumulative standing jornada by jornada, ties sharing the rank", () => {
    const frames = raceFrames(rows, "goals");
    expect(frames.map((f) => f.rows.map((r) => `${r.id}:${r.value}#${r.rank}`))).toEqual([["ana:1#1", "bea:1#1"], ["bea:2#1", "ana:1#2"], ["ana:3#1", "bea:2#2"]]);
    expect(frames[2].rows[0]).toMatchObject({ delta: 2, pos: 0 });
    expect(framesInLead(frames)).toEqual(new Map([["ana", 2], ["bea", 2]]));
  });
});

describe("El reloj de goles", () => {
  it("counts ours and theirs by 5′ slice and finds the peaks", () => {
    const c = goalClock(games);
    expect(c.slices).toHaveLength(10);
    expect(c.slices[9]).toEqual({ from: 45, to: 50, us: 2, them: 0 });
    expect(c.slices[1]).toMatchObject({ us: 1 });
    expect(c.peakUs?.from).toBe(45);
    expect(c.peakThem?.from).toBe(30);
  });
  it("a player's own clock only counts his goals", () => {
    expect(goalClock(games, "bea").slices.reduce((s, x) => s + x.us + x.them, 0)).toBe(2);
  });
});

describe("La constelación", () => {
  it("links assister → scorer and places stars by position", () => {
    const links = goalLinks(games);
    expect(links).toEqual([{ from: "bea", to: "ana", n: 2 }, { from: "ana", to: "bea", n: 1 }]);
    const { nodes } = constellation(rows, links);
    expect(nodes.map((n) => n.id).sort()).toEqual(["ana", "bea"]);
    const ana = nodes.find((n) => n.id === "ana")!, bea = nodes.find((n) => n.id === "bea")!;
    expect(ana.y).toBeLessThan(bea.y);
    expect(ana.r).toBeGreaterThan(bea.r - 0.01);
  });
});

describe("Radar, ritmo y porcentajes", () => {
  it("scores stay in 0–1 and the polygon has one point per axis", () => {
    const s = radarScores(rows[0], rows, games.length);
    expect(s).toHaveLength(6);
    expect(s.every((v) => v >= 0 && v <= 1)).toBe(true);
    expect(s[0]).toBe(1);
    expect(radarAverage(rows, games.length)).toHaveLength(6);
    expect(radarPoints(s, 100, 80).split(" ")).toHaveLength(6);
  });
  it("G+A per 50′ uses only games with minutes; win rate only the games he played", () => {
    expect(per50(rows[0])).toBe(1.33);
    expect(per50(rows[2])).toBe(0);
    expect(winRateWith(rows[0])).toBe(67);
    expect(percentile(rows[0], rows, (r) => r.ga)).toBe(50);
    expect(percentile(rows[2], rows, (r) => r.ga)).toBe(0);
  });
  it("points: 3 a win, 1 a draw", () => {
    expect(points(games)).toBe(6);
  });
});

describe("Minutos, rivales, colección y rótulo", () => {
  it("heatmap levels follow the minutes of each game", () => {
    expect(minutesHeat(rows)[1].cells.map((c) => c.level)).toEqual([1, 0.5, 1]);
  });
  it("groups the same rival whatever the spelling, newest game first", () => {
    const t = rivalTable(games);
    expect(t[0]).toMatchObject({ name: "Accept", played: 2, wins: 2 });
    expect(t[0].games.map((g) => g.id)).toEqual(["j3", "j1"]);
  });
  it("the collection has reached milestones and the next ones with what's missing", () => {
    const c = collection(rows);
    expect(c.got.some((s) => s.playerId === "ana" && s.metric === "goals" && s.value === 1)).toBe(true);
    expect(c.next.find((s) => s.playerId === "ana" && s.metric === "goals")).toMatchObject({ value: 5, left: 2 });
  });
  it("the ticker speaks about live streaks and leaders", () => {
    const lines = tickerLines(rows, games);
    expect(lines).toContain("Pichichi: ANA con 3");
    expect(lines.some((l) => l.includes("Mayor victoria: 2–0"))).toBe(true);
  });
});
