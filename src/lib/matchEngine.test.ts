import { describe, expect, it } from "vitest";
import {
  calculateLedger,
  matchPhase,
  nextFixture,
  type MatchSheet,
  type MatchEvent,
} from "../../functions/src/matchEngine";
import { computeStats } from "./playerStats";
const team = ["a", "b", "c", "d", "e", "f", "g"];
const base = (): MatchSheet => ({
  version: 2,
  seasonId: "season",
  rival: "Rival",
  competition: "Liga",
  date: 100000000,
  duration: 60,
  home: true,
  venue: "",
  status: "finished",
  starters: team,
  bench: ["h", "i"],
  notCalled: ["j"],
  events: [],
  report: "",
});
const event = (
  type: MatchEvent["type"],
  minute: number,
  playerId?: string,
  extra: Partial<MatchEvent> = {},
): MatchEvent => ({
  id: crypto.randomUUID(),
  type,
  minute,
  playerId,
  ...extra,
});
describe("Acta de fútbol 7", () => {
  it("cuenta los siete titulares, suplentes sin jugar y no convocados", () => {
    const r = calculateLedger(base());
    expect(r.errors).toEqual([]);
    expect(Object.values(r.players).reduce((n, p) => n + p.minutes, 0)).toBe(
      420,
    );
    expect(r.players.a).toMatchObject({
      minutes: 60,
      started: true,
      played: true,
    });
    expect(r.players.h).toMatchObject({
      minutes: 0,
      benched: true,
      played: false,
    });
    expect(r.players.j.notCalled).toBe(true);
  });
  it("calcula varios tramos y reingresos sin duplicar minutos", () => {
    const m = base();
    m.events = [
      event("substitution", 20, "a", { inPlayerId: "h" }),
      event("substitution", 45, "h", { inPlayerId: "a" }),
    ];
    const r = calculateLedger(m);
    expect(r.errors).toEqual([]);
    expect(r.players.a.minutes).toBe(35);
    expect(r.players.h.minutes).toBe(25);
    expect(r.players.a.stints).toEqual([
      { from: 0, to: 20 },
      { from: 45, to: 60 },
    ]);
    expect(r.players.h.exchanges).toEqual([
      { minute: 20, with: "a", direction: "in" },
      { minute: 45, with: "a", direction: "out" },
    ]);
  });
  it("expulsar detiene el cómputo y prohíbe el reingreso", () => {
    const m = base();
    m.events = [
      event("red_card", 30, "a"),
      event("substitution", 40, "b", { inPlayerId: "a" }),
    ];
    const r = calculateLedger(m);
    expect(r.players.a.minutes).toBe(30);
    expect(r.errors).toHaveLength(1);
  });
  it("la segunda amarilla no cuenta como tres amarillas", () => {
    const m = base();
    m.events = [event("yellow_card", 10, "a"), event("double_yellow", 32, "a")];
    const r = calculateLedger(m);
    expect(r.errors).toEqual([]);
    expect(r.players.a).toMatchObject({
      yellowCards: 2,
      redCards: 1,
      doubleYellows: 1,
      minutes: 32,
    });
  });
  it("admite una tarjeta en el banquillo sin sumar participación", () => {
    const m = base();
    m.events = [event("yellow_card", 5, "h")];
    const r = calculateLedger(m);
    expect(r.errors).toEqual([]);
    expect(r.players.h.played).toBe(false);
    expect(r.players.h.minutes).toBe(0);
  });
  it("ordena eventos por minuto y respeta su secuencia en el mismo minuto", () => {
    const m = base();
    m.events = [
      event("goal", 50, "h"),
      event("substitution", 20, "a", { inPlayerId: "h" }),
      event("goal", 20, "h", { assistPlayerId: "b" }),
    ];
    const r = calculateLedger(m);
    expect(r.errors).toEqual([]);
    expect(r.players.h.goals).toBe(2);
    expect(r.players.b.assists).toBe(1);
  });
  it("valida minutos, roles, asistentes y cambios imposibles", () => {
    const m = base();
    m.bench.push("a");
    m.events = [
      event("goal", 61, "a"),
      event("goal", 5, "h"),
      event("substitution", 10, "h", { inPlayerId: "i" }),
      event("goal", 11, "b", { assistPlayerId: "b" }),
      event("goal", 12, "c", { assistPlayerId: "j" }),
    ];
    expect(calculateLedger(m).errors.length).toBeGreaterThanOrEqual(5);
  });
  it("contabiliza todos los tipos de gol y de penalti", () => {
    const m = base();
    m.events = [
      event("goal_penalty", 10, "a"),
      event("goal_freekick", 12, "b", { assistPlayerId: "c" }),
      event("opponent_goal", 15),
      event("own_goal", 20, "d"),
      event("opponent_own_goal", 23),
      event("penalty_received", 30, "a"),
      event("penalty_committed", 40, "b"),
      event("penalty_saved", 41, "g"),
    ];
    const r = calculateLedger(m);
    expect(r.errors).toEqual([]);
    expect(r.goalsFor).toBe(3);
    expect(r.goalsAgainst).toBe(2);
    expect(r.players.a.penaltyReceived).toBe(1);
    expect(r.players.b.penaltyCommitted).toBe(1);
    expect(r.players.g.penaltySaved).toBe(1);
    expect(r.players.c.assists).toBe(1);
  });
  it("solo obliga a siete titulares al finalizar y permite preparar encuentros", () => {
    const m = base();
    m.starters = [];
    expect(calculateLedger(m, false).errors).toEqual([]);
    expect(calculateLedger(m, true).errors).toHaveLength(1);
  });
  it("el agregado usa el acta del servidor y no suma también los eventos", () => {
    const m = base();
    m.events = [event("goal", 5, "a")];
    const ledger = calculateLedger(m).players;
    expect(computeStats("a", [{ ...m, ledger }]).goals).toBe(1);
    expect(computeStats("b", [{ ...m, ledger }]).matchesPlayed).toBe(1);
    expect(computeStats("h", [{ ...m, ledger }]).matchesPlayed).toBe(0);
    expect(
      computeStats("a", [{ ...m, ledger, status: "scheduled" }]).goals,
    ).toBe(0);
  });
});
describe("Calendario automático", () => {
  const start = 100000000;
  const a = { id: "a", date: start, status: "scheduled" };
  const b = { id: "b", date: start + 86400000, status: "scheduled" };
  it("cambia exactamente al inicio y al terminar los 60 minutos", () => {
    expect(matchPhase(a, start - 1)).toBe("scheduled");
    expect(matchPhase(a, start)).toBe("playing");
    expect(matchPhase(a, start + 3599999)).toBe("playing");
    expect(matchPhase(a, start + 3600000)).toBe("awaiting_result");
  });
  it("pasa al siguiente sin inventar un resultado", () => {
    expect(nextFixture([b, a], start)?.id).toBe("a");
    expect(nextFixture([b, a], start + 3600000)?.id).toBe("b");
    expect(nextFixture([a], start + 3600000)).toBeUndefined();
  });
  it("ignora cancelados, aplazados y finalizados", () => {
    expect(nextFixture([{ ...a, status: "cancelled" }, b], start)?.id).toBe(
      "b",
    );
    expect(nextFixture([{ ...a, status: "postponed" }, b], start)?.id).toBe(
      "b",
    );
    expect(matchPhase({ ...a, status: "finished" }, start)).toBe("finished");
  });
});
