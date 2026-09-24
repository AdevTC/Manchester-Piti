import { describe, expect, it } from "vitest";
import {
  ageOn,
  analysePlayer,
  chronological,
  competitionRanks,
  individualRecords,
  medalFor,
  metricValue,
  milestones,
  opponentInitials,
  teamAnalysis,
  teamRecords,
} from "./clubAnalytics";
import {
  calculateLedger,
  type MatchSheet,
} from "../../functions/src/matchEngine";
import type { ClubMatch } from "./clubData";
function game(id: string, goals: number, against = 0): ClubMatch {
  return {
    id,
    date: Date.UTC(2026, 0, Number(id)),
    goalsFor: goals,
    goalsAgainst: against,
    events: Array.from({ length: goals }, (_, i) => ({
      id: id + ":" + i,
      type: "goal",
      minute: i + 1,
      playerId: "a",
    })),
  };
}
describe("Clasificación compartida y medallas", () => {
  it.each([
    [
      [10, 8, 8, 7],
      [1, 2, 2, 4],
      ["gold", "silver", "silver", null],
    ],
    [
      [10, 10, 8, 7],
      [1, 1, 3, 4],
      ["gold", "gold", "bronze", null],
    ],
    [
      [10, 8, 7, 7],
      [1, 2, 3, 3],
      ["gold", "silver", "bronze", "bronze"],
    ],
    [
      [0, 0, 0],
      [1, 1, 1],
      [null, null, null],
    ],
  ])("aplica puestos por competición a %j", (scores, expected, medals) => {
    const rows = scores.map((goals, i) => ({ id: String(i), goals }));
    const ranks = competitionRanks(rows, (p) => p.goals);
    expect(rows.map((p) => ranks.get(p.id))).toEqual(expected);
    expect(rows.map((p) => medalFor(ranks.get(p.id), p.goals))).toEqual(medals);
    expect(rows.map((p) => p.goals)).toEqual(scores);
  });
  it("conserva los puestos aunque el usuario busque un jugador concreto", () => {
    const rows = [
      { id: "a", goals: 10 },
      { id: "b", goals: 5 },
      { id: "c", goals: 2 },
    ];
    const rank = competitionRanks(rows, (p) => p.goals);
    expect(
      rows
        .filter((p) => p.id === "b")
        .map((p) => medalFor(rank.get(p.id), p.goals)),
    ).toEqual(["silver"]);
  });
});
describe("Iniciales y edad", () => {
  it.each([
    ["Superbebientes", "SB"],
    ["FUSION 7", "F7"],
    ["Fusión7 FC", "F7"],
    ["C.D. Real Madrid", "RM"],
    ["CF Real Madrid", "RM"],
    ["Atlético", "AT"],
    ["", "?"],
    ["Los Leones", "LE"],
  ])("%s → %s", (name, initials) =>
    expect(opponentInitials(name)).toBe(initials),
  );
  it("descuenta el cumpleaños pendiente y rechaza fechas inválidas", () => {
    expect(ageOn("2004-09-25", new Date(2026, 8, 24))).toBe(21);
    expect(ageOn("2004-09-24", new Date(2026, 8, 24))).toBe(22);
    expect(ageOn("2026-02-31", new Date(2026, 8, 24))).toBeNull();
    expect(ageOn(undefined, new Date())).toBeNull();
  });
});
describe("Historial, récords y rachas", () => {
  it("excluye borradores y ordena sin mutar el listado", () => {
    const source = [
      game("3", 1),
      { ...game("4", 4), status: "scheduled" as const },
      game("1", 1),
      game("2", 1),
    ];
    expect(chronological(source).map((g) => g.id)).toEqual(["1", "2", "3"]);
    expect(source[0].id).toBe("3");
  });
  it("un partido sin marcar corta la racha; distingue mejor y actual", () => {
    const p = analysePlayer({ id: "a" }, [
      game("1", 2),
      game("2", 1),
      game("3", 0),
      game("4", 1),
    ]);
    expect(p.goalStreak.best.count).toBe(2);
    expect(p.goalStreak.best.matchIds).toEqual(["1", "2"]);
    expect(p.goalStreak.current.count).toBe(1);
    expect(p.braces).toBe(1);
    expect(p.hatTricks).toBe(0);
  });
  it("no inventa minutos a partir de goles o participaciones antiguas", () => {
    const p = analysePlayer({ id: "a" }, [game("1", 2)]);
    expect(p.goals).toBe(2);
    expect(p.matchesPlayed).toBe(1);
    expect(metricValue(p, "minutes")).toBeNull();
    expect(metricValue(p, "starts")).toBeNull();
    expect(metricValue(p, "goals")).toBe(2);
  });
  it("mezcla actas nuevas y antiguas sin duplicar goles y registra suplentes sin minutos", () => {
    const sheet: MatchSheet = {
      version: 2,
      seasonId: "s",
      rival: "R",
      competition: "Liga",
      date: Date.UTC(2026, 0, 2),
      duration: 60,
      home: true,
      venue: "",
      status: "finished",
      starters: ["a", "b", "c", "d", "e", "f", "g"],
      bench: ["h"],
      notCalled: ["i"],
      events: [{ id: "goal", type: "goal", minute: 10, playerId: "a" }],
      report: "",
    };
    const ledger = calculateLedger(sheet).players;
    const games = [
      game("1", 2),
      { ...sheet, id: "2", goalsFor: 1, goalsAgainst: 0, ledger },
    ];
    const p = analysePlayer({ id: "a" }, games),
      h = analysePlayer({ id: "h" }, games);
    expect(p.goals).toBe(3);
    expect(p.minutes).toBe(60);
    expect(p.tracked).toBe(1);
    expect(p.starts).toBe(1);
    expect(metricValue(h, "minutes")).toBe(0);
    expect(h.bench).toBe(1);
    expect(h.matchesPlayed).toBe(0);
    expect(analysePlayer({ id: "i" }, games).notCalled).toBe(1);
  });
  it("conserva todos los récords empatados", () => {
    const p = analysePlayer({ id: "a" }, [
      game("1", 3),
      game("2", 1),
      game("3", 3),
    ]);
    const records = individualRecords([p], "goals");
    expect(records.map((r) => r.value)).toEqual([3, 3, 1]);
    expect([...competitionRanks(records, (r) => r.value).values()]).toEqual([
      1, 1, 3,
    ]);
  });
  it("registra umbrales cruzados una sola vez en la fecha correcta", () => {
    const p = analysePlayer({ id: "a" }, [
      game("1", 4),
      game("2", 3),
      game("3", 0),
      game("4", 3),
    ]);
    expect(
      milestones([p])
        .filter((m) => m.metric === "goals")
        .map((m) => [m.value, m.match.id]),
    ).toEqual([
      [10, "4"],
      [5, "2"],
      [1, "1"],
    ]);
  });
  it("calcula balances del equipo y rachas sin perder incluyendo empates", () => {
    const games = [
      game("1", 3, 1),
      game("2", 0, 0),
      game("3", 1, 2),
      game("4", 2, 1),
    ];
    const team = teamAnalysis(games);
    expect(team).toMatchObject({
      played: 4,
      wins: 2,
      draws: 1,
      losses: 1,
      gf: 6,
      ga: 4,
      cleanSheets: 1,
    });
    expect(team.unbeatenStreak.best.count).toBe(2);
    expect(team.unbeatenStreak.current.count).toBe(1);
    expect(teamRecords(games, "win").map((e) => e.value)).toEqual([2, 1]);
  });
});
