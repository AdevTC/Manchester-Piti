import { describe, expect, it } from "vitest";
import { turnsFor, type Rota, type RotaMatch, type Turn } from "../../../lib/derived/rota";
import { matchChip, mineWhen, ruedaMatches, ruedaRows, ruedaSchedule, turnPlayed, turnTiles, turnWho, turnosHead } from "./turnosModel";

const turn = (id: string, name: string, icon: Turn["job"]["icon"], playerId: string | null, p: Partial<Turn> = {}): Turn => ({
  job: { id, name, icon, awayOnly: false, order: [] },
  playerId,
  computed: playerId,
  pinned: false,
  swappedFrom: null,
  skipped: [],
  frozen: false,
  ...p,
});
const cap = (id: string) => id[0].toUpperCase() + id.slice(1);

describe("turnWho", () => {
  it("«Tú, Kevin», a name, or nobody", () => {
    expect(turnWho(turn("b", "Balones", "ball", "kevin"), "kevin", cap)).toEqual({ who: "Tú, Kevin", sub: "", mine: true });
    expect(turnWho(turn("b", "Balones", "ball", "jordi"), "kevin", cap).who).toBe("Jordi");
    expect(turnWho(turn("m", "La mesa", "key", null), "kevin", cap).who).toBe("Nadie disponible");
  });
  it("says a captain's swap", () => {
    expect(turnWho(turn("c", "Coche", "car", "erik", { pinned: true, swappedFrom: "kevin" }), null, (id) => id).sub).toBe("cambio del capitán (le tocaba a kevin)");
  });
});

describe("turnTiles", () => {
  it("his first and big, the away-only job at home as «Nadie esta vez»", () => {
    const jobs = [
      { id: "lavar", name: "Lavar la equipación", icon: "shirt" as const, awayOnly: false, order: [] },
      { id: "coche", name: "Coche", icon: "car" as const, awayOnly: true, order: [] },
      { id: "agua", name: "El agua", icon: "bottle" as const, awayOnly: false, order: [] },
    ];
    const tiles = turnTiles(jobs, [turn("lavar", "Lavar la equipación", "shirt", "jordi"), turn("agua", "El agua", "bottle", "kevin")], { home: true }, "kevin", cap);
    expect(tiles.map((t) => [t.key, t.icon, t.who, t.mine, t.off])).toEqual([
      ["agua", "bottle", "Tú, Kevin", true, false],
      ["lavar", "shirt", "Jordi", false, false],
      ["coche", "car", "Nadie esta vez", false, true],
    ]);
  });
});

describe("la rueda, as the backend hands the turns out", () => {
  const day = (d: number) => Date.UTC(2026, 10, d, 15);
  const rota: Rota = {
    jobs: [
      { id: "lavar", name: "Lavar la equipación", icon: "shirt", awayOnly: false, order: ["a", "b", "c"] },
      { id: "coche", name: "Coche a los partidos fuera", icon: "car", awayOnly: true, order: ["a", "b", "c"] },
    ],
  };
  const NOW = Date.UTC(2026, 9, 25, 10);
  const all: RotaMatch[] = [
    { id: "p1", date: Date.UTC(2026, 9, 18, 15), home: true, status: "finished", seasonId: "s" },
    { id: "n1", date: day(1), home: true, status: "scheduled", seasonId: "s" },
    { id: "f2", date: day(8), home: false, status: "scheduled", seasonId: "s" },
    { id: "x", date: day(10), home: false, status: "cancelled", seasonId: "s" },
    { id: "o", date: day(12), home: false, status: "scheduled", seasonId: "other" },
    { id: "f3", date: day(15), home: true, status: "scheduled", seasonId: "s" },
  ];
  const docs = { p1: { frozen: true, turns: { lavar: { playerId: "a" } } } };
  // (c is away on f2's day: the wheel skips him there, as turnsFor does)
  const absences = [{ playerId: "c", from: "2026-11-07", to: "2026-11-09" }];

  it("the matches: the next one, then the season's later ones to play", () => {
    expect(ruedaMatches(all[1], all, NOW, 5).map((m) => m.id)).toEqual(["n1", "f2", "f3"]);
    expect(ruedaMatches(all[1], all, NOW, 2).map((m) => m.id)).toEqual(["n1", "f2"]);
  });
  it("each later match over the history plus the ones before it", () => {
    const next = turnsFor(all[1], rota, [{ id: "p1", turns: { lavar: "a" } }], [], [], undefined);
    const sched = ruedaSchedule(ruedaMatches(all[1], all, NOW, 5), next, all, rota, docs, absences, NOW);
    const who = sched.map(({ m, turns }) => [m.id, Object.fromEntries(turns.map((t) => [t.job.id, t.playerId]))]);
    expect(who).toEqual([
      ["n1", { lavar: "b" }],
      ["f2", { lavar: "a", coche: "b" }],
      ["f3", { lavar: "c" }],
    ]);
    const w = ruedaRows(rota.jobs, sched, (id) => ({ j: { n1: "J3", f2: "J4", f3: "J5" }[id] ?? "", rival: "Pitutis" }), "b", cap);
    expect(w.cols.map((c) => [c.j, c.where])).toEqual([
      ["J3", "en casa · 1 nov"],
      ["J4", "fuera · 8 nov"],
      ["J5", "en casa · 15 nov"],
    ]);
    expect(w.rows[0].cells.map((c) => c.name)).toEqual(["Tú", "A", "C"]);
    expect(w.rows[1].cells.map((c) => [c.name, c.off])).toEqual([
      ["en casa", true],
      ["Tú", false],
      ["en casa", true],
    ]);
    expect(w.rows[1].aria).toBe("Coche a los partidos fuera: J3: en casa, no hay, J4: te toca a ti, J5: en casa, no hay");
    expect(w.mine.map((t) => [t.i, t.job, t.line])).toEqual([
      [0, "Lavar la equipación", "J3 · Pitutis, en casa · dom 1 nov"],
      [1, "Coche a los partidos fuera", "J4 · en casa de Pitutis · dom 8 nov"],
    ]);
    expect([mineWhen(0, false, false), mineWhen(0, true, true), mineWhen(1, false, false), mineWhen(3, false, false)]).toEqual(["Ahora", "Hecho", "En 1 jornada", "En 3 jornadas"]);
  });
});

describe("turnosHead", () => {
  const base = { j: "J3", rival: "Pitutis", cancelled: false, cap: false, socio: false, myJob: null, played: false, done: false, when: "domingo 1 a las 16:00", home: true, jobs: 4 };
  it("says the room's status in every state", () => {
    expect(turnosHead({ ...base, state: "nomatch" }).title).toBe("Sin partido a la vista");
    expect(turnosHead({ ...base, state: "off" }).sub).toBe("La J3 contra Pitutis está aplazada.");
    expect(turnosHead({ ...base, state: "norota", cap: true }).title).toBe("Sin turnos esta temporada");
    expect(turnosHead({ ...base, state: "noturns" }).title).toBe("Turnos de la J3: ninguno");
    expect(turnosHead({ ...base, state: "error" }).sub).toBe("No se han podido cargar los turnos.");
    expect(turnosHead({ ...base, state: "turns" }).title).toBe("Turnos de la J3: 4 trabajos");
    expect(turnosHead({ ...base, state: "turns", socio: true }).sub).toBe("Sin ficha no entras en la rueda. Vincula tu ficha y te tocará como a todos.");
    expect(turnosHead({ ...base, state: "turns", myJob: "El agua" }).title).toBe("Te toca: el agua");
    expect(turnosHead({ ...base, state: "turns", myJob: "El agua", played: true }).title).toBe("El agua: ¿hecho?");
    expect(turnosHead({ ...base, state: "turns", myJob: "El agua", played: true, done: true }).title).toBe("El agua: hecho");
  });
});

describe("turnPlayed and the match chip", () => {
  it("is played once finished or kicked off, never when called off", () => {
    expect(turnPlayed({ status: "finished", date: "2026-10-18T19:00" }, 0)).toBe(true);
    expect(turnPlayed({ status: "scheduled", date: "2099-01-01T10:00" }, Date.now())).toBe(false);
    expect(turnPlayed({ status: "postponed", date: "2000-01-01T10:00" }, Date.now())).toBe(false);
    expect(turnPlayed(undefined, Date.now())).toBe(false);
  });
  it("says how far the match is, in words", () => {
    const now = Date.UTC(2026, 9, 29, 10);
    expect(matchChip({ status: "scheduled", date: Date.UTC(2026, 10, 1, 15) }, now)).toEqual({ t: "En 3 días", cls: "is-off" });
    expect(matchChip({ status: "scheduled", date: Date.UTC(2026, 9, 30, 15) }, now).t).toBe("Mañana");
    expect(matchChip({ status: "postponed", date: Date.UTC(2026, 9, 30, 15) }, now)).toEqual({ t: "Aplazado", cls: "is-warn" });
    expect(matchChip({ status: "finished", date: Date.UTC(2026, 9, 25, 15) }, now)).toEqual({ t: "Jugado", cls: "is-ok" });
  });
});
