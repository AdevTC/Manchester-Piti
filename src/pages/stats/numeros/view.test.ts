import { describe, expect, it, vi } from "vitest";
import { makeND, type NMatch, type NSeasonData } from "./nd";
import { squadOf } from "./adapt";
import { numerosView, type Act, type Env, type NuState } from "./view";

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
    m(1, { st: "fin", gf: 3, ga: 1, goals: [["a", "b", 6], ["b", "c", 21], ["a", null, 44]], opp: [11], starters: ["por", "a", "b", "c"], cards: [["c", 15]], vote: { open: true, total: 5, eligible: 7 } }),
    m(2, { st: "fin", gf: 0, ga: 0, starters: ["por", "a", "b"], bench: ["c"] }),
    m(3, {}),
  ],
};
const BASE: NuState = {
  place: "temporada", upto: 99, playing: false, raceK: "goles", star: null, temporada: "esta", campo: "todo", jug: [], partidos: [], grow: null, sheet: null, sheetId: null,
  rankK: "goles", pick: null, rival: null, campoView: "pases", puesto: "", team: "us", parte: "all", recView: "rachas", cromoK: "todos", evoK: "goles", ysi: {}, sortK: "goles",
  q: "", rq: "", catQ: "", catFam: "", catN: 24, catX: false, allStats: false, colSet: "basico", wsSet: "resumen", clockK: "ambos", streakK: "g", evoIds: null, sq: "",
};
const act: Act = { set: vi.fn(), open: vi.fn(), closeSheet: vi.fn(), go: vi.fn(), grow: vi.fn(), say: vi.fn(), stop: vi.fn(), seek: vi.fn(), narrow: () => false, ask: vi.fn(), csv: vi.fn(), json: vi.fn() };
const squad = squadOf(people, S.matches);
const env = (p: Partial<Env> = {}): Env => ({
  nd: makeND(squad), S, moment: { edge: 2, live: false, closed: false }, others: [], catalog: null, demo: false, today: "2026-10-23",
  viewer: { kind: "fan", playerId: null, name: "", porraKey: null }, ...p,
});

describe("Números · the season without a table", () => {
  const v = numerosView(BASE, env(), act);
  it("says the points and the calendar, not a position", () => {
    expect(v.screen.title).toBe("4 puntos tras 2 jornadas");
    expect(v.tem.noTable).toBe(true);
    expect(v.tem.calendar.map((j) => j.pts)).toEqual(["3", "4", "por jugar"]);
    expect(v.lede).toBe("Temporada 1, después de 2 jornadas. Oficial desde el acta; queda 1 por jugar.");
  });
  it("the race, the MVP line and «Lo que dicen los números»", () => {
    expect(v.tem.raceCap).toBe("En cabeza tras la J2: Alcides, 2");
    expect(v.tem.mvpLine).toBe("Aún sin MVP: sale al cerrar la votación de cada partido.");
    expect(v.tem.said[0]).toBe("Alcides manda en los goles, con 2 goles.");
  });
  it("the moviola looks back: «Estás viendo la temporada tal como estaba tras la J1»", () => {
    const back = numerosView({ ...BASE, upto: 1 }, env(), act);
    expect(back.lede).toBe("Estás viendo la temporada tal como estaba tras la J1.");
    expect(back.time.back).toBe(true);
    expect(back.tem.mvpLine).toBe("La votación del MVP de la J1 sigue abierta: 5 de 7 votos. El MVP sale al cerrarla.");
  });
});

describe("Números · the boards' faults, fixed", () => {
  it("a one-match streak is singular and its range one jornada", () => {
    const v = numerosView({ ...BASE, place: "records", upto: 1 }, env(), act);
    expect(v.records.title).toBe("1 victoria seguida");
    expect(v.records.players.find((p) => p.name === "Alcides")?.range).toBe("J1");
  });
  it("the card leaves out a full name that only repeats the name", () => {
    const v = numerosView({ ...BASE, place: "jugadores", pick: "b" }, env(), act);
    expect(v.jug.card.full).toBe("");
    expect(numerosView({ ...BASE, place: "jugadores", pick: "a" }, env(), act).jug.card.full).toBe("Cristian Rodríguez");
  });
});

describe("Números · the porra", () => {
  it("a member sees an empty porra said in words; a fan sees the door", () => {
    const socio = { kind: "socio" as const, playerId: null, name: "", porraKey: null };
    const v = numerosView({ ...BASE, place: "jugadores", rankK: "porra" }, env({ viewer: socio }), act);
    expect(v.jug.title).toBe("La porra, aún sin puntos");
    expect(v.jug.porraEmpty).toMatch(/^Aún no hay puntos de porra/);
    const fan = numerosView({ ...BASE, place: "jugadores", rankK: "porra" }, env(), act);
    expect(fan.jug.title).toBe("La porra es del vestuario");
    expect(fan.jug.porraEmpty).toBe("");
  });
});

describe("Números · «El cielo»: nobody shares a point", () => {
  it("places each line in its column(s), spread wing to wing", () => {
    const many = squadOf(
      Array.from({ length: 16 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, num: String(i + 1), first: "", last: "", line: i < 1 ? "POR" : "", spots: [] })),
      [],
    );
    const points = new Set(many.map((p) => `${p.x},${p.y}`));
    expect(points.size).toBe(16);
    expect(squad.find((p) => p.id === "por")).toMatchObject({ x: 6, y: 50 });
    expect(squad.find((p) => p.id === "c")).toMatchObject({ x: 22, y: 84, pos: "DEF" });
  });
});
