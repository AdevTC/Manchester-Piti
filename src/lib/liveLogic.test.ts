import { describe, expect, it } from "vitest";
import { liveProblem } from "../../functions/src/liveLogic";

const MIN = 60_000;
const KICKOFF = Date.UTC(2026, 10, 8, 11);
const match = { status: "scheduled", date: KICKOFF, duration: 50, starters: ["a", "b", "c"], bench: ["d"] };
const goal = { type: "goal", minute: 19, playerId: "a", assistPlayerId: "b" };

describe("modo banda rules", () => {
  it("accepts a goal by a called-up player during the match", () => {
    expect(liveProblem(match, goal, KICKOFF + 20 * MIN)).toBeNull();
    expect(liveProblem(match, { type: "opponent_goal", minute: 6 }, KICKOFF + 7 * MIN)).toBeNull();
  });
  it("only from half an hour before to an hour and a half after", () => {
    expect(liveProblem(match, goal, KICKOFF - 31 * MIN)).toMatch(/media hora antes/);
    expect(liveProblem(match, goal, KICKOFF - 29 * MIN)).toBeNull();
    expect(liveProblem(match, goal, KICKOFF + 141 * MIN)).toMatch(/hora y media/);
  });
  it("never on a finished, cancelled or postponed match", () => {
    for (const status of ["finished", "cancelled", "postponed"]) expect(liveProblem({ ...match, status }, goal, KICKOFF)).toMatch(/editor/);
  });
  it("players must be called up; assists and substitutions need two different ones", () => {
    expect(liveProblem(match, { ...goal, playerId: "z" }, KICKOFF)).toMatch(/convocado/);
    expect(liveProblem(match, { ...goal, assistPlayerId: "a" }, KICKOFF)).toMatch(/asistencia/);
    expect(liveProblem(match, { type: "substitution", minute: 30, playerId: "c", inPlayerId: "c" }, KICKOFF)).toMatch(/cambio/);
    expect(liveProblem(match, { type: "substitution", minute: 30, playerId: "c", inPlayerId: "d" }, KICKOFF)).toBeNull();
  });
  it("a plain goal can wait for its scorer («Lo completo luego»), not with an assist nor a penalty", () => {
    expect(liveProblem(match, { type: "goal", minute: 12 }, KICKOFF)).toBeNull();
    expect(liveProblem(match, { type: "goal", minute: 12, assistPlayerId: "a" }, KICKOFF)).toMatch(/convocado/);
    expect(liveProblem(match, { type: "goal_penalty", minute: 12 }, KICKOFF)).toMatch(/convocado/);
  });
  it("the minute has to fit the match", () => {
    expect(liveProblem(match, { ...goal, minute: 66 }, KICKOFF)).toMatch(/no cabe/);
  });
});
