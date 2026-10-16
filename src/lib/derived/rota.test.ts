import { describe, expect, it } from "vitest";
import {
  jobIdFor,
  matchDayText,
  parseRota,
  parseRotaTurns,
  rotaErrors,
  rotaHistory,
  rotaMatch,
  rotaNotice,
  turnsFor,
  turnsLine,
  type Rota,
  type RotaMatch,
} from "./rota";

const DAY = 86_400_000;
// Saturdays at 10:00 Madrid (UTC+2 in October)
const sat = (n: number) => Date.UTC(2026, 9, 3 + 7 * n, 8, 0);
const m = (id: string, n: number, extra: Partial<RotaMatch> = {}): RotaMatch => ({ id, date: sat(n), home: true, status: "finished", seasonId: "s1", ...extra });
const ROTA: Rota = {
  jobs: [
    { id: "lavar", name: "Lavar la equipación", icon: "shirt", awayOnly: false, order: ["hugo", "dani", "leo"] },
    { id: "coche", name: "Coche a los partidos fuera", icon: "car", awayOnly: true, order: ["dani", "leo"] },
  ],
};
const who = (match: RotaMatch, played: RotaMatch[], av = {}, abs: { playerId: string | null; from: string; to: string }[] = [], pin = null) =>
  Object.fromEntries(turnsFor(match, ROTA, played, av, abs, pin).map((t) => [t.job.id, t.playerId]));

describe("turnsFor", () => {
  it("rotates one member per completed match, in order, wrapping round", () => {
    const played = [m("a", 0), m("b", 1), m("c", 2)];
    expect(who(m("x", 3, { status: "scheduled" }), []).lavar).toBe("hugo");
    expect(who(m("x", 3, { status: "scheduled" }), played.slice(0, 1)).lavar).toBe("dani");
    expect(who(m("x", 3, { status: "scheduled" }), played.slice(0, 2)).lavar).toBe("leo");
    expect(who(m("x", 3, { status: "scheduled" }), played).lavar).toBe("hugo");
  });

  it("is deterministic: the order the matches come in doesn't matter, only their dates", () => {
    const played = [m("c", 2), m("a", 0), m("b", 1)];
    expect(who(m("x", 3, { status: "scheduled" }), played)).toEqual(who(m("x", 3, { status: "scheduled" }), [...played].reverse()));
  });

  it("counts only the season's finished matches before this one", () => {
    const played = [m("a", 0), m("p", 1, { status: "postponed" }), m("c", 1, { status: "cancelled" }), m("o", 1, { seasonId: "s0" }), m("later", 5)];
    expect(who(m("x", 3, { status: "scheduled" }), played).lavar).toBe("dani");
  });

  it("skips a «No puedo» and the cursor moves past him (he waits for the order to come round)", () => {
    const x = m("x", 1, { status: "scheduled" });
    const t = turnsFor(x, ROTA, [m("a", 0)], { x: [{ playerId: "dani", response: "no" }] }, [], null)[0];
    expect(t.playerId).toBe("leo");
    expect(t.skipped).toEqual(["dani"]);
    // the next match: after Leo comes Hugo (Dani lost this round)
    expect(who(m("y", 2, { status: "scheduled" }), [m("a", 0), m("x", 1)], { x: [{ playerId: "dani", response: "no" }] }).lavar).toBe("hugo");
  });

  it("a «Duda» or a «Voy» is no skip", () => {
    expect(who(m("x", 1, { status: "scheduled" }), [m("a", 0)], { x: [{ playerId: "dani", response: "maybe" }] }).lavar).toBe("dani");
  });

  it("skips a member whose absence covers the match's Madrid day", () => {
    const x = m("x", 1, { status: "scheduled" });
    expect(who(x, [m("a", 0)], {}, [{ playerId: "dani", from: "2026-10-08", to: "2026-10-12" }]).lavar).toBe("leo");
    // an absence of another day, or of someone else, changes nothing
    expect(who(x, [m("a", 0)], {}, [{ playerId: "dani", from: "2026-10-11", to: "2026-10-12" }]).lavar).toBe("dani");
    expect(who(x, [m("a", 0)], {}, [{ playerId: null, from: "2026-10-01", to: "2026-10-30" }]).lavar).toBe("dani");
  });

  it("nobody when everyone in the order is out", () => {
    const x = m("x", 0, { status: "scheduled" });
    const all = { x: ["hugo", "dani", "leo"].map((p) => ({ playerId: p, response: "no" })) };
    const t = turnsFor(x, ROTA, [], all, [], null)[0];
    expect(t.playerId).toBeNull();
    expect(t.skipped).toEqual(["hugo", "dani", "leo"]);
  });

  it("the car (awayOnly) has no turn at home and counts only away matches", () => {
    const played = [m("a", 0, { home: false }), m("b", 1, { home: true }), m("c", 2, { home: true })];
    expect(who(m("x", 3, { status: "scheduled", home: true }), played).coche).toBeUndefined();
    expect(who(m("x", 3, { status: "scheduled", home: false }), played).coche).toBe("leo");
    expect(turnsFor(m("x", 3, { home: true }), ROTA, played, {}, [], null).map((t) => t.job.id)).toEqual(["lavar"]);
  });

  it("a captain's pin overrides this match without moving the rota", () => {
    const x = m("x", 1, { status: "scheduled" });
    const t = turnsFor(x, ROTA, [m("a", 0)], {}, [], { lavar: { playerId: "leo", swappedFrom: "dani" } })[0];
    expect(t).toMatchObject({ playerId: "leo", computed: "dani", pinned: true, swappedFrom: "dani" });
    // «Lo hizo otro» on a past match: the next turn is still the one after the computed member
    expect(who(m("y", 2, { status: "scheduled" }), [m("a", 0), m("x", 1)]).lavar).toBe("leo");
  });

  it("ignores a malformed pin", () => {
    const t = turnsFor(m("x", 0), ROTA, [], {}, [], { lavar: { playerId: "" } })[0];
    expect(t.pinned).toBe(false);
    expect(t.playerId).toBe("hugo");
  });

  it("an empty order or no rota: nobody / nothing", () => {
    expect(turnsFor(m("x", 0), { jobs: [{ id: "j", name: "J", icon: "bag", awayOnly: false, order: [] }] }, [], {}, [], null)[0].playerId).toBeNull();
    expect(turnsFor(m("x", 0), null, [], {}, [], null)).toEqual([]);
  });

  it("a finished match's own turns ignore itself and the matches after it", () => {
    const played = [m("a", 0), m("b", 1), m("c", 2)];
    expect(who(played[1], played).lavar).toBe("dani");
  });
});

describe("rotaHistory", () => {
  it("orders by date then id, and an undated target sees every finished match", () => {
    const h = rotaHistory({ id: "x", date: null, seasonId: "s1" }, [m("b", 0), m("a", 0), m("c", -1)]);
    expect(h.map((x) => x.id)).toEqual(["c", "a", "b"]);
  });
});

describe("turnsLine", () => {
  const nameOf = (id: string) => ({ hugo: "Hugo", dani: "Dani", leo: "Leo" })[id] ?? id;
  const x = m("x", 1, { status: "scheduled", home: false });
  const turns = turnsFor(x, ROTA, [m("a", 0, { home: false })], {}, [], null);
  it("«Te toca…» when it's mine", () => {
    expect(turnsLine(turns, nameOf, "dani")).toEqual({ mine: true, text: "Te toca: lavar la equipación" });
    expect(turnsLine(turns, nameOf, "leo")).toEqual({ mine: true, text: "Te toca: coche a los partidos fuera" });
  });
  it("lists who does what otherwise", () => {
    expect(turnsLine(turns, nameOf, "hugo")).toEqual({ mine: false, text: "Lava: Dani · Coche: Leo" });
    expect(turnsLine([], nameOf, "hugo")).toBeNull();
  });
});

describe("rotaNotice", () => {
  it("«Te toca lavar la equipación tras el partido del sábado», once per match and job", () => {
    const n = rotaNotice("m1", { id: "lavar", name: "Lavar la equipación" }, { date: sat(1), rival: "Rayo" }, sat(1) - 2 * DAY);
    expect(n.title).toBe("Te toca lavar la equipación tras el partido del sábado");
    expect(n.body).toContain("Contra Rayo.");
    expect(n).toMatchObject({ topic: "personal", tag: "rota-m1-lavar", log: "rota-m1-lavar", url: "/matches/m1?tab=vestuario" });
  });
  it("other jobs say «en el partido», a far match its day number", () => {
    expect(rotaNotice("m1", { id: "balones", name: "Balones y petos" }, { date: sat(1) }, sat(1) - 2 * DAY).title).toBe("Te toca llevar los balones y petos en el partido del sábado");
    expect(matchDayText(sat(1), sat(1) - 10 * DAY)).toBe("del sábado 10");
    expect(matchDayText(null, 0)).toBe("del próximo partido");
  });
});

describe("parse and validate", () => {
  it("parseRota drops bad jobs and cleans orders", () => {
    expect(parseRota({ jobs: [{ id: "a", name: "A", icon: "zzz", order: ["x", "x", 3, ""] }, { id: "", name: "B" }] })).toEqual({
      jobs: [{ id: "a", name: "A", icon: "shirt", awayOnly: false, order: ["x"] }],
    });
    expect(parseRota(null)).toBeNull();
  });
  it("parseRotaTurns keeps the well-formed overrides", () => {
    expect(parseRotaTurns({ lavar: { playerId: "p", swappedFrom: "q", at: 1 }, x: { playerId: 3 }, y: null })).toEqual({ lavar: { playerId: "p", swappedFrom: "q" } });
  });
  it("rotaErrors says what the rules would refuse", () => {
    const job = { id: "a", name: "A", icon: "shirt" as const, awayOnly: false, order: [] };
    expect(rotaErrors({ jobs: [job] })).toEqual([]);
    expect(rotaErrors({ jobs: Array.from({ length: 7 }, (_, i) => ({ ...job, id: `j${i}` })) })).toContain("Como mucho 6 turnos.");
    expect(rotaErrors({ jobs: [{ ...job, name: "x".repeat(31) }] })[0]).toMatch(/30 letras/);
    expect(rotaErrors({ jobs: [{ ...job, name: " " }] })[0]).toMatch(/nombre/);
    expect(rotaErrors({ jobs: [job, job] })[0]).toMatch(/identificador/);
    expect(rotaErrors({ jobs: [{ ...job, order: Array.from({ length: 41 }, (_, i) => `p${i}`) }] })[0]).toMatch(/40 jugadores/);
  });
  it("jobIdFor slugs and keeps ids unique", () => {
    expect(jobIdFor("Lavar la equipación", [])).toBe("lavar-la-equipacion");
    expect(jobIdFor("Agua", ["agua"])).toBe("agua-2");
    expect(jobIdFor("¡¡", [])).toBe("turno");
  });
  it("rotaMatch reads a club match", () => {
    expect(rotaMatch({ id: "a", date: sat(0), home: false, status: "scheduled", seasonId: "s1" })).toEqual({ id: "a", date: sat(0), home: false, status: "scheduled", seasonId: "s1" });
    expect(rotaMatch({ id: "a", date: undefined }).date).toBeNull();
  });
});
