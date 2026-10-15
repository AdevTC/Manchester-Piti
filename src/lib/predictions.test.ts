import { describe, expect, it } from "vitest";
import { predictionOpen, predictionsRevealed, scorePrediction } from "../../functions/src/predictions";
import type { MatchEvent } from "../../functions/src/matchEngine";
const goal = (playerId: string, assistPlayerId?: string): MatchEvent => ({ id: `${playerId}-${assistPlayerId}`, type: "goal", playerId, assistPlayerId });
const result = { goalsFor: 2, goalsAgainst: 1 };
describe("porra con goleadores", () => {
  it("conserva las porras antiguas y no acumula exacto con signo", () => {
    expect(scorePrediction(result, result, [goal("a")]).total).toBe(3);
    expect(scorePrediction({ goalsFor: 1, goalsAgainst: 0 }, result).total).toBe(1);
  });
  it("premia goleador y asistente en la misma jugada más el segundo gol", () => {
    const p = { ...result, goals: [{ playerId: "a", assistPlayerId: "b" }, { playerId: "c", assistPlayerId: null }] };
    expect(scorePrediction(p, result, [goal("c"), goal("a", "b")])).toEqual({ score: 3, scorers: 2, assists: 1, actions: 2, scorerPoints: 4, assistPoints: 1, actionPoints: 6, multiplePoints: 2, total: 16 });
  });
  it("omitir asistente no equivale a apostar sin asistencia", () => {
    expect(scorePrediction({ ...result, goals: [{ playerId: "a" }] }, result, [goal("a")]).total).toBe(5);
    expect(scorePrediction({ ...result, goals: [{ playerId: "a", assistPlayerId: null }] }, result, [goal("a")]).total).toBe(8);
    expect(scorePrediction({ ...result, goals: [{ playerId: "a", assistPlayerId: null }] }, result, [goal("a", "b")]).actions).toBe(0);
  });
  it("goleador y asistente suman por separado pero sin extra si sus jugadas no coinciden", () => {
    expect(scorePrediction({ ...result, goals: [{ playerId: "a", assistPlayerId: "b" }] }, result, [goal("a", "c"), goal("d", "b")])).toMatchObject({ scorers: 1, assists: 1, actions: 0, total: 6 });
  });
  it("repetir una apuesta no multiplica un único gol real", () => {
    const p = { ...result, goals: Array.from({ length: 3 }, () => ({ playerId: "a", assistPlayerId: "b" })) };
    expect(scorePrediction(p, result, [goal("a", "b")])).toMatchObject({ scorers: 1, assists: 1, actions: 1, multiplePoints: 0, total: 9 });
    expect(scorePrediction(p, result, [goal("a", "b"), goal("a", "b"), goal("a", "b")])).toMatchObject({ scorers: 3, actions: 3, multiplePoints: 4, total: 25 });
  });
  it("cuenta penaltis y faltas, excluye autogoles y asistencias históricas sin jugada", () => {
    const events: MatchEvent[] = ["goal_penalty", "goal_freekick", "opponent_own_goal", "own_goal", "opponent_goal", "assist"].map((type, i) => ({ id: `${i}`, type: type as MatchEvent["type"], playerId: "a" }));
    expect(scorePrediction({ ...result, goals: Array.from({ length: 6 }, () => ({ playerId: "a", assistPlayerId: null })) }, result, events)).toMatchObject({ scorers: 2, actions: 2 });
  });
  it("las correcciones del acta cambian los puntos", () => {
    const p = { ...result, goals: [{ playerId: "a", assistPlayerId: "b" }] };
    expect(scorePrediction(p, result, [goal("a", "b")]).total).toBe(9);
    expect(scorePrediction(p, result, [goal("c", "b")]).total).toBe(4);
  });
  it("solo el inicio real cierra y revela; un reset vuelve a abrir", () => {
    expect(predictionOpen({ status: "scheduled" })).toBe(true);
    expect(predictionsRevealed({ status: "scheduled" })).toBe(false);
    for (const phase of ["first", "halftime", "second", "ended"]) {
      expect(predictionOpen({ status: "scheduled", clock: { phase } })).toBe(false);
      expect(predictionsRevealed({ status: "scheduled", clock: { phase } })).toBe(true);
    }
    expect(predictionOpen({ status: "scheduled", clock: { phase: "ready" } })).toBe(true);
    for (const status of ["finished", "cancelled", "postponed"]) expect(predictionOpen({ status })).toBe(false);
    expect(predictionOpen({ status: "scheduled", published: false })).toBe(false);
    expect(predictionOpen({ status: "scheduled", liveEndedAt: 100 })).toBe(false);
  });
});
