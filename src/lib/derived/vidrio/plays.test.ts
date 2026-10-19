import { describe, expect, it } from "vitest";
import type { ClubMatch, MatchEvent } from "../../clubData";
import { longSeasonFixture } from "./fixtures";
import { filterPlays, playHalf, playKind, playsLog } from "./plays";

const f = longSeasonFixture();
const byId = (id: string) => f.matches.find((m) => m.id === id)!;

describe("playsLog · tonight (J17, 38 plays by minute 23)", () => {
  const log = playsLog(byId("j17"), f.nameOf);

  it("every play that stands, newest first (a tie in the same minute: the later written first)", () => {
    expect(log.count).toBe(38);
    expect(log.rows.slice(0, 2).map((r) => [r.id, r.minute, r.title, r.sub])).toEqual([
      ["j17-38", 23, "Le hacen falta a Eguzquiza", ""],
      ["j17-37", 23, "Córner para el Piti", "Lo saca Eguzquiza"],
    ]);
    expect(log.rows.at(-1)).toMatchObject({ id: "j17-1", minute: 1, minuteText: "1′" });
  });

  it("tells the goals the way the site does, with whose they are", () => {
    const goals = filterPlays(log.rows, "gol");
    expect(goals.map((r) => [r.minute, r.title, r.sub, r.ours])).toEqual([
      [21, "Gol de Adrián T.C.", "Asistencia de Jordi", true],
      [11, "Gol de Orduña fc", "", false],
      [6, "Gol de Alcides", "Asistencia de Adrián T.C.", true],
    ]);
    expect(goals[0]).toMatchObject({ kind: "gol", goal: "for", tag: "GOL", glyph: "ball", half: 1, people: ["adrian", "jordi"] });
  });

  it("counts the kinds for the filters", () => {
    expect(log.counts).toEqual({ gol: 3, tarjeta: 2, cambio: 0, ocasion: 15, parada: 2, otro: 16 });
    expect(filterPlays(log.rows, "tarjeta").map((r) => [r.title, r.card, r.ours])).toEqual([
      ["Amarilla a Eguzquiza", "a", true],
      ["Amarilla a Orduña", "a", false],
    ]);
    expect(filterPlays(log.rows, "cambio")).toEqual([]);
    expect(filterPlays(log.rows, "todo")).toHaveLength(38);
  });

  it("all in the first half so far", () => {
    expect(log.halves.map((h) => [h.half, h.label, h.rows.length])).toEqual([[1, "Primera parte", 38]]);
  });
});

describe("playsLog · the edge cases", () => {
  it("a legacy acta (minutes typed, no clock): halves by minute against half the duration", () => {
    const log = playsLog(byId("j1"), f.nameOf);
    expect(log.rows.map((r) => [r.minute, r.half, r.ours])).toEqual([
      [37, 2, true],
      [26, 2, false],
      [26, 2, true],
      [15, 1, true],
    ]);
  });

  it("a guest's goal names him as the match's guest", () => {
    const goal = playsLog(byId("j6"), f.nameOf).rows.find((r) => r.kind === "gol" && r.ours)!;
    expect(goal.title).toBe("Gol de Rafa (invitado)");
  });

  it("skips pending duplicates and narrated actions; plays without a minute go last, «Sin minuto»", () => {
    const events: MatchEvent[] = [
      { id: "a", type: "goal", playerId: "alcides", elapsedSeconds: 100, period: 1 },
      { id: "b", type: "goal", playerId: "alcides", elapsedSeconds: 110, period: 1, dupOf: "a" },
      { id: "c", type: "pass", playerId: "jordi", elapsedSeconds: 200, period: 1 },
      { id: "d", type: "substitution", playerId: "illescas", inPlayerId: "erik", elapsedSeconds: 1800, period: 2 },
      { id: "e", type: "yellow_card", playerId: "fer" },
      { id: "f", type: "own_goal", playerId: "fer", elapsedSeconds: 1900, period: 2 },
      { id: "g", type: "opponent_own_goal", elapsedSeconds: 1950, period: 2 },
    ];
    const m: ClubMatch = { id: "x", rival: "Atlético Demo", duration: 50, events };
    const log = playsLog(m, f.nameOf);
    expect(log.rows.map((r) => r.id)).toEqual(["g", "f", "d", "a", "e"]);
    expect(log.rows.map((r) => r.ours)).toEqual([true, false, true, true, true]);
    expect(log.rows[2]).toMatchObject({ kind: "cambio", title: "Entra Erik, sale Illescas", half: 2 });
    expect(log.rows[3].sub).toBe("El primero suyo hoy");
    expect(log.halves.map((h) => [h.label, h.rows.map((r) => r.id)])).toEqual([
      ["Segunda parte", ["g", "f", "d"]],
      ["Primera parte", ["a"]],
      ["Sin minuto", ["e"]],
    ]);
    expect(playsLog(m, f.nameOf, "Otro FC").rows[0].title).toBe("Autogol de Otro FC");
  });

  it("an empty match has an empty log", () => {
    expect(playsLog({ id: "y" } as ClubMatch, f.nameOf)).toEqual({ rows: [], count: 0, counts: { gol: 0, tarjeta: 0, cambio: 0, ocasion: 0, parada: 0, otro: 0 }, halves: [] });
  });
});

describe("playKind and playHalf", () => {
  it("kinds", () => {
    expect(playKind({ type: "penalty_saved" })).toBe("parada");
    expect(playKind({ type: "woodwork" })).toBe("ocasion");
    expect(playKind({ type: "penalty_missed" })).toBe("ocasion");
    expect(playKind({ type: "red_card" })).toBe("tarjeta");
    expect(playKind({ type: "opponent_corner" })).toBe("otro");
    expect(playKind({ type: "own_goal" })).toBe("gol");
  });

  it("halves: the period, else the seconds, else the minute; a 60-minute match splits at 30", () => {
    expect(playHalf({ period: 2, minute: 3 })).toBe(2);
    expect(playHalf({ elapsedSeconds: 1499 })).toBe(1);
    expect(playHalf({ elapsedSeconds: 1500 })).toBe(2);
    expect(playHalf({ minute: 25 })).toBe(1);
    expect(playHalf({ minute: 28 }, 60)).toBe(1);
    expect(playHalf({ minute: 31 }, 60)).toBe(2);
    expect(playHalf({})).toBeNull();
  });
});
