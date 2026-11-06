import { describe, expect, it, vi } from "vitest";
import { makeND, seasonMoment, type LRow, type NMatch, type NSeasonData } from "./nd";
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
  jugView: "ranking", vsOn: false, vsB: null, allRank: false, allTable: false, jkey: null, replay: false, exFmt: "json",
};
const act: Act = { set: vi.fn(), open: vi.fn(), closeSheet: vi.fn(), go: vi.fn(), grow: vi.fn(), say: vi.fn(), stop: vi.fn(), seek: vi.fn(), play: vi.fn(), narrow: () => false, ask: vi.fn(), csv: vi.fn(), json: vi.fn() };
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
    const v = numerosView({ ...BASE, place: "temporada", upto: 1 }, env(), act);
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

describe("Números · minutes known", () => {
  const Z = { min: 0, tit: 0, ban: 0, nc: 0, pl: 0, sin: 0, sout: 0, st: [], dy: 0, pcm: 0, prc: 0, psv: 0, pms: 0, gpen: 0, gfk: 0, wood: 0, ch: 0, sv: 0, f: 0, fr: 0, pas: 0, pok: 0, pko: 0 } as unknown as LRow;
  const L = (min: number): LRow => ({ ...Z, min, pl: min ? 1 : 0, tit: min ? 1 : 0 });
  const ND = makeND(squad);
  it("a match being played does not turn everyone's minutes into starts", () => {
    const gs = [m(1, { st: "fin", gf: 1, ga: 0, starters: ["a"], ledger: { a: L(50), b: L(20) }, minutes: { a: 50, b: 20 } }), m(2, { st: "live", gf: 1, ga: 0, starters: ["a"] })];
    const a = ND.rows(gs).find((r) => r.id === "a")!;
    expect(a.minKnown).toBe(true);
    expect(ND.metricOf(a, "min")).toBe(50);
  });
  it("a signing missing from the earlier actas played 0′ in them: minutes, not starts", () => {
    const gs = [m(1, { st: "fin", gf: 1, ga: 0, ledger: { a: L(50) }, minutes: { a: 50 } }), m(2, { st: "fin", gf: 1, ga: 0, ledger: { a: L(50), c: L(30) }, minutes: { a: 50, c: 30 } })];
    const rs = ND.rows(gs);
    expect(rs.find((r) => r.id === "c")).toMatchObject({ minKnown: true, min: 30 });
    expect(rs.find((r) => r.id === "a")).toMatchObject({ minKnown: true, min: 100 });
  });
});

describe("Números · the locked cromos say what is left in good Spanish", () => {
  it("«falta 1 gol», «falta 1 victoria», «faltan 6 victorias»", () => {
    const ND = makeND(squad);
    const goals = Array.from({ length: 9 }, (_, i): [string, null, number] => ["a", null, i + 1]);
    const gs = [m(1, { st: "fin", gf: 9, ga: 0, goals, starters: ["a"] }), ...[2, 3, 4].map((j) => m(j, { st: "fin", gf: 1, ga: 0, starters: ["a"] }))];
    const left = Object.fromEntries(ND.collection(gs, ND.rows(gs)).map((c) => [c.title, c.left]));
    expect(left["10 goles del equipo"]).toBe("falta 1 gol");
    expect(left["5 victorias"]).toBe("falta 1 victoria");
    expect(left["10 victorias"]).toBe("faltan 6 victorias");
    expect(left["5 asistencias de un jugador"]).toBe("faltan 5");
  });
});

describe("Números · Rivales", () => {
  it("names the rival that sticks in our throat only when one does", () => {
    expect(numerosView({ ...BASE, place: "rivales" }, env(), act).rivales.sub).toContain("El que más se nos atraganta: Rival 2.");
    const won: NSeasonData = { ...S, matches: [S.matches[0], { ...S.matches[1], gf: 1, ga: 0, goals: [["a", null, 10]] }, S.matches[2]] };
    const v = numerosView({ ...BASE, place: "rivales" }, env({ nd: makeND(squadOf(people, won.matches)), S: won }), act);
    expect(v.rivales.title).toBe("Contra Rival 1, siempre ganando");
    expect(v.rivales.sub).not.toContain("atraganta");
  });
});

describe("Números · the moment of the season", () => {
  it("a postponed jornada still to play keeps the season open", () => {
    const fin = m(1, { st: "fin", gf: 1, ga: 0 });
    expect(seasonMoment({ matches: [fin, m(2, { st: "fin", gf: 0, ga: 0 })] })).toEqual({ edge: 2, live: false, closed: true });
    expect(seasonMoment({ matches: [fin, m(2, { st: "apl" }), m(3, { st: "fin", gf: 2, ga: 2 })] })).toEqual({ edge: 3, live: false, closed: false });
  });
});

describe("Números · Rivales over every season", () => {
  it("«todas las temporadas» counts the other seasons' matches against each rival, and a rival only met before", () => {
    const S0: NSeasonData = { ...S, id: "t0", slug: "temporada-0", name: "Temporada 0", matches: [m(1, { id: "old1", st: "fin", gf: 2, ga: 0 }), m(2, { id: "old2", st: "fin", gf: 1, ga: 1, rival: "Viejo rival" })] };
    const v = numerosView({ ...BASE, place: "rivales", temporada: "todas" }, env({ others: [{ S: S0, moment: { edge: 2, live: false, closed: true } }] }), act);
    const pj = Object.fromEntries(v.rivales.all.map((r: { rival: string; pj: number }) => [r.rival, r.pj]));
    expect(pj["Rival 1"]).toBe(2);
    expect(pj["Viejo rival"]).toBe(1);
    expect(numerosView({ ...BASE, place: "rivales" }, env({ others: [{ S: S0, moment: { edge: 2, live: false, closed: true } }] }), act).rivales.all.some((r: { rival: string }) => r.rival === "Viejo rival")).toBe(false);
  });
});

describe("Números · la evolución's axis", () => {
  it("names its ends by the jornadas played (a postponed one between them)", () => {
    const ND = makeND(squad);
    const se = ND.season({ ...S, matches: [m(1, { st: "fin", gf: 1, ga: 0, goals: [["a", null, 3]] }), m(2, { st: "apl" }), m(3, { st: "fin", gf: 1, ga: 0 })] }, { edge: 3, live: false, closed: false });
    expect(ND.evo(se, 3, ["a"], "goles")).toMatchObject({ n: 2, firstJ: 1, lastJ: 3 });
  });
});

describe("Números · individual records and guests", () => {
  it("a guest's hat-trick leaves the record to the best of the squad (the row stays)", () => {
    const ND = makeND(squad, { "guest:g1": "Pepe" });
    const gs = [m(1, { st: "fin", gf: 4, ga: 0, goals: [["guest:g1", "a", 2], ["guest:g1", null, 9], ["guest:g1", null, 20], ["a", "b", 30]] })];
    const rec = ND.recordsOf(gs).ind;
    expect(rec.goals).toMatchObject({ id: "a", v: 1 });
    expect(rec.early).toMatchObject({ id: "a", v: 30 });
    expect(rec.ga).toMatchObject({ id: "a", v: 2 });
    const v = numerosView({ ...BASE, upto: 1 }, env({ nd: ND, S: { ...S, matches: [gs[0], S.matches[2]] }, moment: { edge: 1, live: false, closed: false } }), act);
    expect(v.records.indRec.find((r) => r.t === "Más goles en un partido")).toMatchObject({ has: true, v: "1" });
  });
});
