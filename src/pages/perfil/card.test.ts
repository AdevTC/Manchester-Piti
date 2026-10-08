import { describe, expect, it } from "vitest";
import type { ClubMatch } from "../../lib/clubData";
import type { MvpResult } from "../../lib/vestuario";
import { buildSquad, type SquadPlayer } from "../pizarra/v2/ratings";
import { buildCard, evoluciones, formScore, nextEvolution, onStreak, seasonShort, tickerFor, tierOf, type CardInput } from "./card";

const DAY = 86_400_000;
let seq = 0;
const ev = (type: "match_played" | "goal", playerId: string, assistPlayerId?: string) => ({ id: `e${seq++}`, type, playerId, ...(assistPlayerId ? { assistPlayerId } : {}) });
const played = (id: string) => ev("match_played", id);
const goal = (scorer: string, assist?: string) => ev("goal", scorer, assist);
function match(id: string, day: number, events: ClubMatch["events"], gf = 1, ga = 0, extra: Partial<ClubMatch> = {}): ClubMatch {
  return { id, seasonId: "t1", rival: `Rival ${id}`, status: "finished", date: day * DAY, goalsFor: gf, goalsAgainst: ga, events, ...extra };
}
const player = (id: string, number: number, naturalPosition?: string, shirtName = id.toUpperCase()): SquadPlayer => ({ id, shirtName, firstName: id, number, naturalPosition, injured: false, active: true });
const SQUAD = [player("adri", 10, "DEL", "ADRI"), player("erik", 9, "DEL"), player("evans", 1, "POR"), player("illescas", 4, "DEF")];
const NOW = 400 * DAY;

function input(over: Partial<CardInput> = {}): CardInput {
  return {
    state: "vinculada",
    playerId: "adri",
    nickname: "adrian_tc",
    captain: false,
    squad: SQUAD,
    matches: [],
    seasonId: "t1",
    seasonName: "Temporada 1",
    seasons: [{ id: "t1", name: "Temporada 1" }],
    mvpResults: new Map(),
    now: NOW,
    ...over,
  };
}

const SEASON: ClubMatch[] = [
  match("j1", 10, [played("adri"), played("erik"), goal("adri", "erik")], 1, 0),
  match("j2", 17, [played("adri"), played("erik"), played("evans"), goal("erik", "adri"), goal("erik")], 2, 2),
  match("j3", 24, [played("erik"), played("evans")], 0, 1),
  match("j4", 31, [played("adri"), played("erik"), goal("adri"), goal("adri", "erik")], 2, 1, { voteClosesAt: 32 * DAY }),
  match("j5", 38, [played("adri"), played("illescas"), goal("illescas", "adri")], 1, 3),
  match("j6", 45, [], 0, 0, { status: "scheduled", goalsFor: undefined, goalsAgainst: undefined }),
];
const MVP = new Map<string, MvpResult>([["j4", { id: "j4", counts: { adri: 3, erik: 1 }, total: 4 }]]);

describe("la carta: valoración = la del cromo de la pizarra", () => {
  it("es exactamente la de buildSquad para la misma temporada", () => {
    const card = buildCard(input({ matches: SEASON, mvpResults: MVP }));
    const games = SEASON.filter((m) => m.status === "finished");
    const sq = buildSquad({ players: SQUAD, games, jornada: new Map(SEASON.map((m, i) => [m.id, i + 1])), suspended: new Set(), mvps: new Map(games.map((m) => [m.id, m.id === "j4" ? ["adri"] : []])) });
    expect(card.rating).toBe(sq.byId.get("adri")!.rt);
    expect(card.ratingText).toBe(String(card.rating));
  });
  it("un solo partido: 55 + 2 + 1,6 + 12 → 71, plata", () => {
    const card = buildCard(input({ matches: [match("j1", 10, [played("adri"), goal("adri")])] }));
    expect(card.rating).toBe(71);
    expect(card.tier).toBe("plata");
    expect(card.tierKey).toBe("plata");
    expect(card.tierName).toBe("Plata");
    expect(card.tierWhy).toBe("Valoración de 65 a 79.");
    expect(card.clubLine).toBe("MANCHESTER PITI · T1 · J1");
    expect(card.totals).toEqual({ played: 1, goals: 1, assists: 0, minutes: 50, mvps: 0 });
  });
  it("los límites de los tipos: 64 bronce, 65 plata, 79 plata, 80 oro", () => {
    expect(tierOf(64)).toBe("bronce");
    expect(tierOf(65)).toBe("plata");
    expect(tierOf(79)).toBe("plata");
    expect(tierOf(80)).toBe("oro");
  });
});

describe("la carta: estados", () => {
  it("temporada sin empezar: todo «—» y se revela en la J1", () => {
    const card = buildCard(input({ matches: [match("j1", 500, [], 0, 0, { status: "scheduled", goalsFor: undefined, goalsAgainst: undefined, rival: "MAD SKY" })] }));
    expect(card.started).toBe(false);
    expect(card.showNumbers).toBe(false);
    expect(card.rating).toBeNull();
    expect(card.ratingText).toBe("—");
    expect(card.attrs.map((a) => a.text)).toEqual(["—", "—", "—", "—", "—", "—"]);
    expect(card.attrs.every((a) => a.value === null && a.p === 0)).toBe(true);
    expect(card.tierKey).toBe("nuevo");
    expect(card.tierName).toBe("Por estrenar");
    expect(card.tierWhy).toMatch(/^Se revela en la J1, el \d+ de [a-z]+ contra MAD SKY\.$/);
    expect(card.clubLine).toBe("SE REVELA EN LA J1");
    expect(card.goalRank).toBeNull();
    expect(card.partner).toBeNull();
    // still the official ticker: the ficha is his
    expect(card.ticker.text).toBe("¡YA ES OFICIAL! · ADRI · DORSAL 10 · DELANTERO ·");
  });
  it("sin partidos de ningún tipo: se revela con el primero", () => {
    const card = buildCard(input());
    expect(card.tierWhy).toBe("Se revela con el primer partido de la temporada.");
    expect(card.series).toEqual([]);
    expect(card.last5).toEqual([]);
  });
  it("pendiente: sobre cerrado con el dorsal pedido", () => {
    const card = buildCard(input({ state: "pendiente", playerId: "erik", matches: SEASON }));
    expect(card.tierKey).toBe("pack");
    expect(card.tierName).toBe("Sobre cerrado");
    expect(card.tierWhy).toBe("Esperando a que el capitán la abra.");
    expect(card.number).toBe("9");
    expect(card.rating).toBeNull();
    expect(card.attrs.every((a) => a.text === "—")).toBe(true);
    expect(card.ticker).toEqual({ tone: "warn", text: "FICHAJE EN TRÁMITE · @ADRIAN_TC PIDE EL 9 · EL CAPITÁN LO REVISA ·", sr: "FICHAJE EN TRÁMITE · @ADRIAN_TC PIDE EL 9 · EL CAPITÁN LO REVISA" });
    expect(card.series).toEqual([]);
    expect(card.evo.every((e) => !e.done && e.cur === 0)).toBe(true);
  });
  it("sin ficha: carta por revelar", () => {
    const card = buildCard(input({ state: "sin-ficha", playerId: null, matches: SEASON }));
    expect(card.tierKey).toBe("down");
    expect(card.tierName).toBe("Por revelar");
    expect(card.tierWhy).toBe("Elige tu dorsal y el capitán te la confirma.");
    expect(card.ticker).toEqual({ tone: "off", text: "SIN DORSAL TODAVÍA · @ADRIAN_TC · RECLAMA TU FICHA ·", sr: "SIN DORSAL TODAVÍA · @ADRIAN_TC · RECLAMA TU FICHA" });
    expect(card.name).toBe("");
    expect(card.nextEvo?.text).toBe("Tu primer objetivo, en cuanto juegues");
    expect(card.nextEvo?.id).toBe("debut");
  });
});

describe("el videomarcador", () => {
  it("capitán, nombre largo y sin posición", () => {
    expect(tickerFor({ state: "vinculada", name: "EGUZQUIZA", number: "8", posLong: "Centrocampista", captain: true, nickname: "egu" }).text).toBe(
      "¡YA ES OFICIAL! · EGUZQUIZA · DORSAL 8 · CENTROCAMPISTA · CAPITÁN ·",
    );
    expect(tickerFor({ state: "vinculada", name: "ADRIÁN T.C.", number: "10", posLong: null, captain: false, nickname: "a" }).sr).toBe("¡YA ES OFICIAL! · ADRIÁN T.C. · DORSAL 10");
    expect(tickerFor({ state: "pendiente", name: "", number: "", posLong: null, captain: false, nickname: "nuevo" }).sr).toBe("FICHAJE EN TRÁMITE · @NUEVO PIDE SU FICHA · EL CAPITÁN LO REVISA");
  });
  it("la carta del capitán lleva el brazalete en el marcador", () => {
    const card = buildCard(input({ captain: true, matches: SEASON }));
    expect(card.captain).toBe(true);
    expect(card.ticker.sr.endsWith("· CAPITÁN")).toBe(true);
  });
});

describe("la carta: números", () => {
  const card = buildCard(input({ matches: SEASON, mvpResults: MVP }));
  it("los seis atributos en el orden del diseño, con su barra contra el mejor de la plantilla", () => {
    expect(card.attrs.map((a) => a.k)).toEqual(["GOL", "MVP", "ASI", "PJ", "MIN", "FOR"]);
    const at = Object.fromEntries(card.attrs.map((a) => [a.k, a]));
    expect(at.GOL.value).toBe(3);
    expect(at.ASI.value).toBe(2);
    expect(at.MVP.value).toBe(1);
    expect(at.PJ.value).toBe(4);
    expect(at.MIN.value).toBe(200);
    expect(at.GOL.p).toBe(1); // the top scorer of the squad
    expect(at.PJ.p).toBe(4 / 5);
    expect(at.MVP.p).toBe(1);
    expect(at.FOR.value).toBe(card.form);
    expect(at.FOR.p).toBeCloseTo(card.form! / 99);
  });
  it("forma: últimos cinco partidos, 45 + G+A·5 + MVP·3 + jugados", () => {
    // adri in J1–J5: G+A = 1+1+0+2+1 = 5, 1 MVP, 4 played → 45 + 25 + 3 + 4
    expect(card.form).toBe(77);
    const mv = (m: ClubMatch) => (m.id === "j4" ? ["adri"] : []);
    expect(formScore("evans", SEASON.slice(0, 5), mv)).toBe(47);
    const flood = Array.from({ length: 5 }, (_, i) => match(`f${i}`, i, [goal("adri"), goal("adri"), goal("adri")]));
    expect(formScore("adri", flood, () => ["adri"])).toBe(99);
  });
  it("gol a gol y los últimos cinco", () => {
    expect(card.series.map((s) => [s.label, s.goals, s.played, s.p])).toEqual([
      ["J1", 1, true, 0.33],
      ["J2", 0, true, 0.06],
      ["J3", 0, false, 0.03],
      ["J4", 2, true, 0.67],
      ["J5", 0, true, 0.06],
    ]);
    expect(card.last5.map((r) => r.l).join("")).toBe("GEPGP");
    expect(card.last5[0]).toEqual({ r: "g", l: "G", j: "J1", aria: "J1: Victoria" });
    expect(card.clubLine).toBe("MANCHESTER PITI · T1 · J1–J5");
  });
  it("goleadores del equipo", () => {
    expect(card.goalRank).toBe(1);
    expect(card.rankText).toBe("Máximo goleador del equipo · 3 goles en 4 partidos");
    const erik = buildCard(input({ playerId: "erik", matches: SEASON, mvpResults: MVP }));
    expect(erik.goalRank).toBe(2);
    expect(erik.rankText).toBe("2.º en goles del equipo · 2 goles en 4 partidos");
    const evans = buildCard(input({ playerId: "evans", matches: SEASON }));
    expect(evans.rankText).toBe("Aún sin goles esta temporada · 0 goles en 2 partidos");
  });
  it("tu socio en el campo (bestPartner)", () => {
    expect(card.partner).toMatchObject({ playerId: "erik", name: "ERIK", number: "9", together: 3, fromYou: 1, fromThem: 2, combos: 3 });
    expect(card.partner?.note).toBe("3 goles entre los dos, con pase de uno al otro");
  });
});

describe("«En racha»: G o A en las tres últimas jornadas que jugó", () => {
  const ga = (id: string, day: number) => match(id, day, [played("me"), goal("me")]);
  const asi = (id: string, day: number) => match(id, day, [played("x"), goal("x", "me")]);
  const blank = (id: string, day: number) => match(id, day, [played("me")]);
  const absent = (id: string, day: number) => match(id, day, [played("x")]);
  it("goles y asistencias cuentan; una jornada sin jugar no rompe la racha", () => {
    expect(onStreak("me", [blank("a", 1), ga("b", 2), asi("c", 3), absent("d", 4), ga("e", 5)])).toBe(true);
  });
  it("una de las tres sin G ni A la rompe", () => {
    expect(onStreak("me", [blank("a", 1), ga("b", 2), ga("c", 3), ga("d", 4)])).toBe(true);
    expect(onStreak("me", [ga("a", 1), ga("b", 2), blank("c", 3), ga("d", 4)])).toBe(false);
  });
  it("hacen falta tres partidos jugados", () => {
    expect(onStreak("me", [ga("a", 1), ga("b", 2)])).toBe(false);
    expect(onStreak("me", [])).toBe(false);
  });
  it("la racha manda sobre la valoración", () => {
    const hot = [match("j1", 1, [played("adri"), goal("adri")]), match("j2", 2, [played("adri"), goal("erik", "adri")]), match("j3", 3, [played("adri"), goal("adri")])];
    const card = buildCard(input({ matches: hot }));
    expect(card.racha).toBe(true);
    expect(card.tier).toBe("racha");
    expect(card.tierName).toBe("En racha");
    expect(card.tierWhy).toBe("Carta especial: has marcado o asistido en las 3 últimas jornadas.");
  });
});

describe("evoluciones", () => {
  const old: ClubMatch = match("o1", 1, [played("adri"), goal("adri"), goal("adri"), goal("adri", "erik")], 3, 0, { seasonId: "t0" });
  it("se cuentan en toda la carrera y coinciden con la vitrina", () => {
    const evo = evoluciones("adri", [old, ...SEASON], MVP, [{ id: "t0", name: "Temporada 0" }, { id: "t1", name: "Temporada 1" }], NOW);
    const by = Object.fromEntries(evo.map((e) => [e.id, e]));
    expect(evo.map((e) => e.k)).toEqual(["Debut", "Primer gol", "Doblete", "MVP", "Fijo", "Goleador", "Hat-trick", "Dúo"]);
    expect(by.debut).toMatchObject({ done: true, cur: 1, goal: 1, pct: 100 });
    expect(by.goal.done).toBe(true);
    expect(by.double).toMatchObject({ done: true, cur: 2 });
    expect(by.hat).toMatchObject({ done: true, cur: 3, pct: 100 });
    expect(by.mvp.done).toBe(true);
    expect(by.fijo).toMatchObject({ done: false, cur: 5, goal: 10, pct: 50 });
    expect(by.goleador).toMatchObject({ done: false, cur: 6, pct: 60 });
    // erik ↔ adri: o1 (1), j1 (1), j2 (1), j4 (1) = 4
    expect(by.duo).toMatchObject({ done: false, cur: 4, pct: 40 });
    expect(by.double.reward).toBe("Sello «×2» en la carta");
    expect(by.duo.with).toBe("erik");
    // every reward is something the card shows: none of them changes the rating
    expect(evo.some((e) => /valoración|\+\d/.test(e.reward))).toBe(false);
  });
  it("la próxima es la más cercana; con todo por hacer, el debut", () => {
    const evo = evoluciones("adri", [old, ...SEASON], MVP, [], NOW);
    expect(nextEvolution(evo, true)).toMatchObject({ id: "goleador", text: "Llevas 6 de 10 · faltan 4" });
    const none = evoluciones(null, SEASON, MVP, [], NOW);
    expect(none.every((e) => !e.done && e.cur === 0)).toBe(true);
    expect(nextEvolution(none, false)).toMatchObject({ id: "debut", text: "Tu primer objetivo, en cuanto juegues" });
    expect(nextEvolution(evo.map((e) => ({ ...e, done: true })), true)).toBeNull();
  });
});

describe("la carta enseña lo conseguido", () => {
  const old: ClubMatch = match("o1", 1, [played("adri"), goal("adri"), goal("adri"), goal("adri", "erik")], 3, 0, { seasonId: "t0" });
  it("vinculada: estela, ×2, estrella y balón de oro; aún sin Fijo, Goleador ni Dúo", () => {
    const card = buildCard(input({ matches: [old, ...SEASON], mvpResults: MVP, seasons: [{ id: "t0", name: "Temporada 0" }, { id: "t1", name: "Temporada 1" }] }));
    expect(card.rewards).toEqual({ trail: true, double: true, mvp: true, fijo: false, goleador: false, hat: true, duo: null });
  });
  it("el dúo lleva el dorsal del socio", () => {
    const many = Array.from({ length: 10 }, (_, i) => match("d" + i, 50 + i, [played("adri"), played("erik"), goal("erik", "adri")]));
    const card = buildCard(input({ matches: many }));
    expect(card.rewards.duo).toBe("9");
  });
  it("sin ficha o pendiente: nada en la carta", () => {
    expect(buildCard(input({ state: "pendiente", matches: SEASON })).rewards.trail).toBe(false);
    expect(buildCard(input({ state: "sin-ficha", playerId: null, matches: SEASON })).rewards).toEqual({ trail: false, double: false, mvp: false, fijo: false, goleador: false, hat: false, duo: null });
  });
});

describe("temporada", () => {
  it("«T1» de «Temporada 1»", () => {
    expect(seasonShort("Temporada 1")).toBe("T1");
    expect(seasonShort("Temporada 2026/27")).toBe("T26/27");
    expect(seasonShort("2025-2026")).toBe("T25/26");
    expect(seasonShort("Liga de verano")).toBe("LIGA DE VERANO");
  });
});
