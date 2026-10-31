import { describe, expect, it, vi } from "vitest";
import { squadOf } from "../numeros/adapt";
import { makeND, type NMatch, type NSeasonData } from "../numeros/nd";
import { numerosView, type Act, type Env, type NuState } from "../numeros/view";
import { jugadores, plantilla, podiumOrder, sortOf, sortRows, spotOf, statsSheet, versus } from "./jugadoresView";

describe("El palco · Jugadores · the pure pieces", () => {
  it("the podium stands 2-1-3 (two: 2-1; one alone)", () => {
    expect(podiumOrder(["a", "b", "c"])).toEqual(["b", "a", "c"]);
    expect(podiumOrder(["a", "b", "c", "d"])).toEqual(["b", "a", "c"]);
    expect(podiumOrder(["a", "b"])).toEqual(["b", "a"]);
    expect(podiumOrder(["a"])).toEqual(["a"]);
    expect(podiumOrder([])).toEqual([]);
  });

  it("cara a cara: the longer bar wins and one line says by how much", () => {
    const a = { name: "Alcides", tiles: [{ t: "partidos", v: 4 }, { t: "goles", v: 6 }, { t: "asistencias", v: 1 }] };
    const b = { name: "Jordi", tiles: [{ t: "partidos", v: 4 }, { t: "goles", v: 2 }, { t: "asistencias", v: 3 }] };
    const r = versus(a, b);
    expect(r.rows.map((x) => x.cls)).toEqual(["", "is-a", "is-b"]);
    expect(r.rows[1]).toMatchObject({ aw: 100, bw: 33, aria: "goles: Alcides 6, Jordi 2" });
    expect(r.rows[0]).toMatchObject({ aw: 100, bw: 100 });
    expect(r.sum).toBe("Empate: 1 a 1 en estas cifras.");
    const c = versus(a, { name: "Jordi", tiles: [{ t: "partidos", v: 3 }, { t: "goles", v: 2 }, { t: "asistencias", v: 1 }] });
    expect(c.sum).toBe("Alcides gana 2 de 3 cifras.");
    const d = versus(a, { name: "Jordi", tiles: [{ t: "partidos", v: 5 }, { t: "goles", v: 7 }, { t: "asistencias", v: 0 }] });
    expect(d.sum).toBe("Jordi gana 2 de 3 cifras; Alcides, 1.");
    // zeros: no bar, no winner, no division by zero
    expect(versus({ name: "A", tiles: [{ t: "goles", v: 0 }] }, { name: "B", tiles: [{ t: "goles", v: 0 }] }).rows[0]).toMatchObject({ aw: 0, bw: 0, cls: "" });
    // a missing figure on the other side reads «–» and «sin dato»
    expect(versus({ name: "A", tiles: [{ t: "goles", v: 2 }] }, { name: "B", tiles: [] }).rows[0]).toMatchObject({ b: "–", aria: "goles: A 2, B sin dato", cls: "is-a" });
  });

  it("Puestos: a spot nobody has played shows itself, not the busiest one (the bug found prototyping)", () => {
    const spots = [
      { code: "POR", empty: false, min: 90 },
      { code: "LD", empty: false, min: 140 },
      { code: "MCO", empty: true, min: 0 },
    ];
    expect(spotOf(spots, "MCO")?.code).toBe("MCO");
    expect(spotOf(spots, "POR")?.code).toBe("POR");
    expect(spotOf(spots, "")?.code).toBe("LD");
    expect(spotOf([{ code: "POR", empty: true, min: 0 }], "")?.code).toBe("POR");
  });

  it("the whole table sorts both ways, «–» always last, then by dorsal", () => {
    const rows = [
      { n: 10 as const, cells: [{ v: 3 }, { v: "–" }] },
      { n: 7 as const, cells: [{ v: 5 }, { v: 2 }] },
      { n: 1 as const, cells: [{ v: 3 }, { v: 9 }] },
      { n: "" as const, cells: [{ v: "1.234" }, { v: "–" }] },
    ];
    expect(sortRows(rows, 0, -1).map((r) => r.n)).toEqual(["", 7, 1, 10]);
    expect(sortRows(rows, 0, 1).map((r) => r.n)).toEqual([1, 10, 7, ""]);
    expect(sortRows(rows, 1, -1).map((r) => r.n)).toEqual([1, 7, 10, ""]);
    expect(sortRows(rows, 1, 1).map((r) => r.n)).toEqual([7, 1, 10, ""]);
  });

  it("the sort key keeps its direction («goles:asc») and falls back to the set's first column", () => {
    expect(sortOf("goles", ["pj", "goles"])).toEqual({ key: "goles", dir: -1 });
    expect(sortOf("goles:asc", ["pj", "goles"])).toEqual({ key: "goles", dir: 1 });
    expect(sortOf("goles:asc", ["pj", "min"])).toEqual({ key: "pj", dir: -1 });
    expect(sortOf("", ["pj", "min"])).toEqual({ key: "pj", dir: -1 });
  });
});

// ---- with the real view model
const m = (j: number, p: Partial<NMatch>): NMatch => ({
  id: `m${j}`, j, day: `Dom ${j} oct`, long: "", month: 10, time: "19:00", home: j % 2 === 1, rival: `Rival ${j}`, venue: "", st: "por", gf: null, ga: null,
  goals: [], opp: [], cards: [], reds: [], saves: [], wood: [], chances: [], corners: [], fouls: [], frec: [], oppChances: 0, oppCorners: 0, oppCards: 0,
  starters: [], bench: [], notCalled: [], subs: 0, minutes: null, mvp: null, system: null, ...p,
});
const people = [
  { id: "por", name: "Evans", num: "1", first: "", last: "", line: "POR", spots: ["POR"] },
  { id: "a", name: "Alcides", num: "7", first: "Cristian", last: "Rodríguez", line: "DEL", spots: [] },
  { id: "b", name: "Adrián T.C.", num: "10", first: "", last: "", line: "MED", spots: [] },
  { id: "c", name: "Jordi", num: "28", first: "", last: "", line: "DEF", spots: ["LD"] },
];
const S: NSeasonData = {
  id: "t1", slug: "temporada-1", name: "Temporada 1", league: "Liga de fútbol 7", real: true, standings: [], mvpDemo: false, porra: null,
  matches: [
    m(1, { st: "fin", gf: 4, ga: 1, goals: [["a", "b", 6], ["b", "c", 21], ["a", null, 44], ["c", "a", 47]], opp: [11], starters: ["por", "a", "b", "c"] }),
    m(2, { st: "fin", gf: 1, ga: 0, goals: [["a", "c", 12]], starters: ["por", "a", "b"], bench: ["c"] }),
    m(3, {}),
  ],
};
const BASE: NuState = {
  place: "jugadores", upto: 99, playing: false, raceK: "goles", star: null, temporada: "esta", campo: "todo", jug: [], partidos: [], grow: null, sheet: null, sheetId: null,
  rankK: "goles", pick: null, rival: null, campoView: "pases", puesto: "", team: "us", parte: "all", recView: "rachas", cromoK: "todos", evoK: "goles", ysi: {}, sortK: "goles",
  q: "", rq: "", catQ: "", catFam: "", catN: 24, catX: false, allStats: false, colSet: "basico", wsSet: "resumen", clockK: "ambos", streakK: "g", evoIds: null, sq: "",
  jugView: "ranking", vsOn: false, vsB: null, allRank: false, allTable: false, jkey: null, replay: false, exFmt: "json",
};
const mkAct = (): Act => ({ set: vi.fn(), open: vi.fn(), closeSheet: vi.fn(), go: vi.fn(), grow: vi.fn(), say: vi.fn(), stop: vi.fn(), seek: vi.fn(), play: vi.fn(), narrow: () => false, ask: vi.fn(), csv: vi.fn(), json: vi.fn() });
const env: Env = {
  nd: makeND(squadOf(people, S.matches)), S, moment: { edge: 2, live: false, closed: false }, others: [], catalog: null, demo: false, today: "2026-10-23",
  viewer: { kind: "fan", playerId: null, name: "", porraKey: null },
};
const at = (p: Partial<NuState> = {}, act = mkAct()) => {
  const st = { ...BASE, ...p };
  return { j: jugadores(numerosView(st, env, act), st, act), st, act };
};

describe("El palco · Jugadores · on the view model", () => {
  it("the goals' podium in 2-1-3, the leader's card, the race under it", () => {
    const { j } = at();
    expect(j.kick).toBe("Jugadores · Goles");
    expect(j.podium.map((p) => [p.name, p.rk])).toEqual([
      ["Adrián T.C.", "2º"],
      ["Alcides", "1º"],
      ["Jordi", "2º"],
    ]);
    expect(j.podium[1]).toMatchObject({ s: 108, lvl: "is-1", on: true });
    expect(j.card.name).toBe("Alcides");
    expect(j.moreT).toBe("Todas (39)");
    expect(j.race[0]).toBe("En cabeza tras la J2: Alcides, 3");
  });

  it("cara a cara: the second card defaults to another player and the picker sets ?contra", () => {
    const { j, act } = at({ vsOn: true });
    expect(j.isVs).toBe(true);
    expect(j.vs.a.name).toBe("Alcides");
    expect(j.vs.b.name).not.toBe("Alcides");
    expect(j.vs.rows.length).toBe(5);
    expect(j.vs.sum).toMatch(/gana|Empate/);
    const jordi = j.vs.opts.find((o) => o.t === "Jordi");
    jordi?.pick();
    expect(act.set).toHaveBeenCalledWith({ vsB: "c" });
    const b = at({ vsOn: true, vsB: "c" }).j;
    expect(b.vs.b.name).toBe("Jordi");
    expect(b.vs.opts.find((o) => o.t === "Jordi")?.on).toBe(true);
  });

  it("MVP gold only on the first step of the MVP ranking; «Todas» names another ranking", () => {
    expect(at({ rankK: "asist" }).j.podium.some((p) => p.lvl.includes("is-gold"))).toBe(false);
    const other = at({ rankK: "yc" }).j;
    expect(other.quickOn).toBe(false);
    expect(other.moreT).toBe("Amarillas");
    expect(other.moreCls).toBe("is-on");
  });

  it("Puestos: picking an empty spot keeps it as «Sin estrenar»", () => {
    const { j } = at({ jugView: "campo", campoView: "puestos", puesto: "MCO" });
    expect(j.spot.code).toBe("MCO");
    expect(j.spot.line).toBe("Sin estrenar");
    expect(j.spots.find((s) => s.on)?.code).toBe("MCO");
  });

  it("the whole table: a header flips the direction, a row opens his card in the ranking", () => {
    const act = mkAct();
    const st = { ...BASE, grow: "jugadores" as const, sortK: "goles" };
    const g = plantilla(numerosView(st, env, act), st, act);
    expect(g.rows.map((r) => r.name).slice(0, 2)).toEqual(["Alcides", "Adrián T.C."]);
    const goles = g.cols.find((c) => c.key === "goles");
    expect(goles?.aria).toBe("descending");
    goles?.pick();
    expect(act.set).toHaveBeenCalledWith({ sortK: "goles:asc" });
    g.rows[0].pick();
    expect(act.set).toHaveBeenCalledWith({ grow: null, pick: "a", vsOn: false, jugView: "ranking" });
    expect(g.count).not.toMatch(/ordenado por/);
  });

  it("the stats sheet lists every group and la porra, locked for a fan", () => {
    const act = mkAct();
    const v = numerosView(BASE, env, act);
    const ss = statsSheet(v, BASE, act);
    expect(ss.groups.flatMap((g) => g.items).length).toBe(39);
    const porra = ss.groups.at(-1)?.items[0];
    expect(porra).toMatchObject({ key: "porra", lock: true });
    porra?.pick();
    expect(act.ask).toHaveBeenCalledWith("jugadores", { rankK: "porra", pick: null, allRank: false, jugView: "ranking", grow: null });
  });
});
