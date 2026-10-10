import { describe, expect, it } from "vitest";
import type { PlayerDoc, SeasonDoc } from "../../../lib/schemas";
import { matchState, mergeMatches, type AdminMatch } from "../data/adminLogic";
import { archiveImpact, copyRosterPlan, countsNote, nextSeasonName, seasonCards, seasonNameError, seasonShowcase, seasonTag } from "./seasonsLogic";

const NOW = Date.UTC(2026, 10, 2, 9);
const day = 86_400_000;
const seasons: SeasonDoc[] = [
  { id: "t0", name: "Temporada 0 · pre-Piti", archived: true },
  { id: "t1", name: "Temporada 1", captainPlayerId: "adrian" },
  { id: "t2", name: "Temporada 2" },
  { id: "v", name: "Verano 2026" },
];
const players: PlayerDoc[] = [
  { id: "adrian", shirtName: "ADRI", number: 10, seasons: ["t1", "t0"], seasonDetails: { t1: { shirtName: "ADRIÁN T.C.", number: 10 }, t0: { shirtName: "ADRI", number: 7 } } },
  { id: "erik", shirtName: "ERIK", number: 9, seasons: ["t1"] },
  { id: "solo", shirtName: "SOLO", number: 3, seasons: ["v"] },
  { id: "sin", shirtName: "SIN", seasons: ["t1"] },
];
const matches: AdminMatch[] = mergeMatches(
  [
    { id: "a", seasonId: "t1", rival: "A", date: NOW - 7 * day, status: "finished", goalsFor: 1, goalsAgainst: 0 },
    { id: "b", seasonId: "t1", rival: "B", date: NOW + 6 * day, status: "scheduled" },
    { id: "c", seasonId: "t1", rival: "C", date: NOW + 9 * day, status: "cancelled" },
    { id: "d", seasonId: "v", rival: "D", date: NOW - 60 * day, status: "finished", goalsFor: 2, goalsAgainst: 2 },
  ],
  [],
);
const stateOf = (m: AdminMatch) => matchState(m, NOW);

describe("seasonCards", () => {
  const cards = seasonCards({ seasons, players, matches, stateOf, activeId: "t1", now: NOW, hidden: { t0: { matches: 18, players: 9 } } });
  it("puts the active season first and the archived last, with their numbers", () => {
    expect(cards.map((c) => `${c.name}:${c.state}`)).toEqual(["Temporada 1:active", "Verano 2026:done", "Temporada 2:prep", "Temporada 0 · pre-Piti:archived"]);
    expect(cards[0]).toMatchObject({ captain: "ADRIÁN T.C.", jornadas: "1 de 2", players: 3, matches: "1 jugado" });
    expect(cards[2]).toMatchObject({ captain: "Sin elegir", jornadas: "0 de 0", players: 0, matches: "0 jugados" });
    expect(cards[3]).toMatchObject({ jornadas: "18 de 18", players: 9, matches: "18 partidos" });
  });
  it("says «—» while an archived season is still being counted", () => {
    const c = seasonCards({ seasons, players, matches, stateOf, activeId: "t1", now: NOW }).find((x) => x.id === "t0");
    expect(c).toMatchObject({ jornadas: "—", players: null, matches: "—" });
  });
});

describe("season names", () => {
  it("checks length and repeats", () => {
    expect(seasonNameError("T3", seasons, null)).toBe("Mínimo 3 letras.");
    expect(seasonNameError("x".repeat(41), seasons, null)).toBe("Máximo 40 letras.");
    expect(seasonNameError(" temporada 1 ", seasons, null)).toBe("Ya hay una temporada con ese nombre.");
    expect(seasonNameError("Temporada 1", seasons, "t1")).toBeNull();
    expect(seasonNameError("Temporada 3", seasons, null)).toBeNull();
  });
  it("proposes the next one", () => {
    expect(nextSeasonName(seasons)).toBe("Temporada 3");
    expect(nextSeasonName([{ name: "Verano" }])).toBe("Temporada 2");
    expect(nextSeasonName([])).toBe("Temporada 1");
  });
});

describe("archiveImpact", () => {
  it("counts the published matches and who would disappear from the plantilla", () => {
    expect(archiveImpact("t1", seasons, players, matches)).toEqual({ matches: 3, players: 3, hiddenPlayers: 3 });
    expect(archiveImpact("v", seasons, players, matches)).toEqual({ matches: 1, players: 1, hiddenPlayers: 1 });
  });
});

describe("copyRosterPlan", () => {
  it("signs the season's squad up with that season's shirt and dorsal", () => {
    expect(copyRosterPlan(players, "t1")).toEqual([
      { id: "erik", shirtName: "ERIK", number: 9 },
      { id: "adrian", shirtName: "ADRIÁN T.C.", number: 10 },
    ]);
    expect(copyRosterPlan(players, "t0")).toEqual([{ id: "adrian", shirtName: "ADRI", number: 7 }]);
    expect(copyRosterPlan(players, "t2")).toEqual([]);
  });
});

describe("seasonShowcase (the vitrina)", () => {
  const ms: AdminMatch[] = mergeMatches(
    [
      { id: "a", seasonId: "t1", rival: "A", date: NOW - 21 * day, status: "finished", goalsFor: 4, goalsAgainst: 1, events: [{ id: "1", type: "goal", playerId: "erik" }, { id: "2", type: "goal_penalty", playerId: "erik" }, { id: "3", type: "own_goal", playerId: "adrian" }] },
      { id: "b", seasonId: "t1", rival: "B", date: NOW - 14 * day, status: "finished", goalsFor: 2, goalsAgainst: 0, events: [{ id: "4", type: "goal_freekick", playerId: "adrian" }] },
      { id: "c", seasonId: "t1", rival: "C", date: NOW - 7 * day, status: "finished", goalsFor: 1, goalsAgainst: 1 },
      { id: "x", seasonId: "t1", rival: "X", date: NOW - 8 * day, status: "cancelled" },
      { id: "f", seasonId: "t1", rival: "F", date: NOW + 5 * day, status: "scheduled" },
    ],
    [{ id: "d", seasonId: "t1", rival: "D", date: NOW - 1 * day, status: "finished", goalsFor: 9, goalsAgainst: 0 }],
  );
  const sc = seasonShowcase({ seasonId: "t1", matches: ms, stateOf: (m) => matchState(m, NOW), now: NOW, mvpOf: (m) => (m.id === "a" || m.id === "b" ? ["erik"] : []), nameOf: (id) => id.toUpperCase() });
  it("counts only the published actas: record, goals, Pichichi, trophies", () => {
    expect(sc).toMatchObject({ v: 2, e: 1, d: 0, gf: 7, ga: 2, published: 3, total: 5, streak: 2 });
    expect(sc.pichichi).toEqual({ id: "erik", goals: 2 });
    expect(sc.biggest).toEqual({ gf: 4, ga: 1, rival: "A", label: "J1" });
    expect(sc.mvp).toEqual({ ids: ["erik"], times: 2 });
  });
  it("puts every jornada on the shelf: a mark when published, a gap otherwise (cancelled ones left out)", () => {
    expect(sc.shelf.map((s) => `${s.label}:${s.r ?? "-"}`)).toEqual(["J1:V", "J2:V", "J4:E", "J5:-", "J6:-"]);
    expect(sc.shelf.map((s) => s.aria)).toEqual(["J1 · Victoria 4–1 a A", "J2 · Victoria 2–0 a B", "J4 · Empate 1–1 a C", "J5 · sin publicar", "J6 · por jugar"]);
    expect(sc.waiting).toEqual(["J5"]);
  });
  it("says what counts", () => {
    expect(countsNote([])).toBe("Cuentan las actas publicadas");
    expect(countsNote(["J7"])).toBe("Cuentan las actas publicadas · la J7 entra al publicarla");
    expect(countsNote(["J7", "J8"])).toBe("Cuentan las actas publicadas · la J7 y J8 entran al publicarlas");
  });
  it("tags a season for the lower thirds", () => {
    expect(seasonTag("Temporada 1")).toBe("T1");
    expect(seasonTag("Verano 2026")).toBe("TEMP");
  });
});
