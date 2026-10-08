import { describe, expect, it } from "vitest";
import type { ClubMatch } from "../../lib/clubData";
import type { PlayerDoc } from "../../lib/schemas";
import {
  accessInfo,
  boardsLine,
  convocatoriaLine,
  convocatoriaMatches,
  fichaInfo,
  monthYear,
  porraLine,
  resolveShirt,
  seasonPlayers,
  squadShirts,
  type Answer,
} from "./profileData";

const SEASONS = [{ id: "t0" }, { id: "t1" }];
const P: PlayerDoc[] = [
  { id: "adri", shirtName: "ADRI", firstName: "Adrián", number: 10, seasons: ["t0", "t1"], naturalPosition: "Delantero", seasonDetails: { t1: { shirtName: "ADRIÁN T.C.", number: 7 } } },
  { id: "erik", shirtName: "ERIK", firstName: "Erik", number: 9, seasons: ["t1"] },
  { id: "old", shirtName: "", firstName: "Viejo", lastName: "Gloria", number: 3, seasons: ["t0"], active: false },
  { id: "hurt", shirtName: "HURT", firstName: "H", number: 5, seasons: ["t1"], injured: true },
];

describe("la ficha: vinculada, pendiente o sin ficha", () => {
  it("vinculada manda sobre cualquier petición", () => {
    expect(fichaInfo("adri", { playerId: "erik", status: "pending" })).toEqual({ state: "vinculada", playerId: "adri", rejectedPlayerId: null });
  });
  it("pendiente con la ficha pedida", () => {
    expect(fichaInfo(undefined, { playerId: "erik", status: "pending" })).toEqual({ state: "pendiente", playerId: "erik", rejectedPlayerId: null });
  });
  it("sin ficha, recordando la que el capitán no aprobó", () => {
    expect(fichaInfo(null, null)).toEqual({ state: "sin-ficha", playerId: null, rejectedPlayerId: null });
    expect(fichaInfo(null, { playerId: "erik", status: "rejected" })).toEqual({ state: "sin-ficha", playerId: null, rejectedPlayerId: "erik" });
  });
});

describe("la plantilla de la temporada, como la imprime la pizarra", () => {
  it("el nombre y el dorsal de la temporada mandan sobre los de siempre", () => {
    expect(resolveShirt(P[0], "t1", SEASONS)).toEqual({ shirtName: "ADRIÁN T.C.", number: 7 });
    expect(resolveShirt(P[0], "t0", SEASONS)).toEqual({ shirtName: "ADRIÁN T.C.", number: 7 }); // latest season with its own
    expect(resolveShirt(P[1], "t1", SEASONS)).toEqual({ shirtName: "ERIK", number: 9 });
  });
  it("solo los de la temporada (y tú aunque no estés), por dorsal", () => {
    expect(seasonPlayers(P, "t1", SEASONS, null).map((p) => p.id)).toEqual(["hurt", "adri", "erik"]);
    expect(seasonPlayers(P, "t1", SEASONS, "old").map((p) => p.id)).toEqual(["old", "hurt", "adri", "erik"]);
    const old = seasonPlayers(P, "t1", SEASONS, "old")[0];
    expect(old).toMatchObject({ active: false, injured: false, firstName: "Viejo" });
    expect(seasonPlayers(P, "t1", SEASONS, null)[0].injured).toBe(true);
  });
  it("todas las espaldas del club para «Ya la lleva…»", () => {
    expect(squadShirts(P, "t1", SEASONS)).toEqual([
      { id: "adri", name: "ADRIÁN T.C.", number: 7 },
      { id: "erik", name: "ERIK", number: 9 },
      { id: "old", name: "Viejo Gloria", number: 3 },
      { id: "hurt", name: "HURT", number: 5 },
    ]);
  });
});

describe("tu acceso y el dorso de la carta", () => {
  const SEP = Date.UTC(2026, 8, 20, 12);
  it("«sep 2026» en hora del club", () => {
    expect(monthYear(SEP)).toBe("sep 2026");
    expect(monthYear(Date.UTC(2026, 11, 31, 23, 30))).toBe("ene 2027"); // already January in Madrid
  });
  it("por invitación: te abrió el capitán", () => {
    expect(accessInfo({ joinedAt: SEP, via: "invite", by: "cap" }, null, "me", "capi")).toEqual({ since: SEP, sinceText: "sep 2026", howIn: "Por invitación", whoOpened: "@capi" });
    expect(accessInfo({ joinedAt: SEP, via: "request", by: "cap" }, null, "me", "").whoOpened).toBe("Un capitán");
    expect(accessInfo({ joinedAt: SEP, via: "request", by: "cap" }, null, "me", "").howIn).toBe("Llamando a la puerta");
  });
  it("de los de la clave: nadie te abrió, y socio desde el primer perfil", () => {
    const before = Date.UTC(2025, 2, 1);
    expect(accessInfo({ joinedAt: SEP, via: "returning", by: "me" }, before, "me", "")).toEqual({ since: before, sinceText: "mar 2025", howIn: "Con la clave antigua", whoOpened: "Nadie: de los primeros" });
    expect(accessInfo(null, null, "me", "")).toEqual({ since: null, sinceText: "—", howIn: "Con la clave antigua", whoOpened: "Nadie: de los primeros" });
  });
});

describe("tus cosas en el vestuario", () => {
  it("tus pizarras: cuántas y la última que tocaste", () => {
    expect(boardsLine([])).toEqual({ count: 0, last: null });
    const line = boardsLine([
      { id: "a", name: "2-3-1", updatedAt: 5, createdAt: 1 },
      { id: "b c", name: "Contra MAD SKY", updatedAt: 9, createdAt: 2 },
      { id: "d", name: "Nueva", updatedAt: null, createdAt: 7 },
    ]);
    expect(line).toEqual({ count: 3, last: { id: "b c", name: "Contra MAD SKY", at: 9, href: "/pizarra?tablero=b%20c" } });
  });
  it("tu porra: pronósticos, exactos y puesto", () => {
    const rows = [
      { uid: "a", points: 9, exact: 3, played: 5 },
      { uid: "me", points: 7, exact: 2, played: 7 },
      { uid: "c", points: 1, exact: 0, played: 2 },
    ];
    expect(porraLine(rows, "me")).toEqual({ predictions: 7, exact: 2, points: 7, rank: 2, of: 3 });
    expect(porraLine(rows, "nobody")).toBeNull();
  });
  it("convocatorias: las jugadas y la próxima, nunca las aplazadas", () => {
    const m = (id: string, status: ClubMatch["status"]): ClubMatch => ({ id, status, seasonId: "t1", date: 1 });
    const cal = [m("j1", "finished"), m("j2", "cancelled"), m("j3", "finished"), m("j4", "scheduled"), m("j5", "scheduled"), m("j6", "postponed")];
    expect(convocatoriaMatches(cal, "j4").map((x) => x.id)).toEqual(["j1", "j3", "j4"]);
    const answers = new Map<string, Answer>([["j1", "yes"], ["j3", "maybe"], ["j2", "no"]]);
    expect(convocatoriaLine(answers, ["j1", "j3", "j4"], "j4")).toEqual({ answered: 2, total: 3, yes: 1, maybe: 1, no: 0, next: null, nextId: "j4" });
    answers.set("j4", "no");
    expect(convocatoriaLine(answers, ["j1", "j3", "j4"], "j4")).toMatchObject({ answered: 3, no: 1, next: "no" });
    expect(convocatoriaLine(new Map(), [], null)).toEqual({ answered: 0, total: 0, yes: 0, maybe: 0, no: 0, next: null, nextId: null });
  });
});
