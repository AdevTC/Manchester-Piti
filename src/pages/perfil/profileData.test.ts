import { describe, expect, it } from "vitest";
import type { ClubMatch } from "../../lib/clubData";
import type { PlayerDoc } from "../../lib/schemas";
import {
  accessInfo,
  boardsLine,
  canSendPositions,
  convocatoriaLine,
  convocatoriaMatches,
  fichaInfo,
  monthYear,
  porraLine,
  positionsInfo,
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

describe("la línea de cada uno, leída de sus posiciones", () => {
  it("positions manda sobre el texto antiguo, y las palabras se leen", () => {
    const ps: PlayerDoc[] = [
      { id: "lat", seasons: ["t1"], positions: { main: "LD", also: [] }, naturalPosition: "DEL" },
      { id: "por", seasons: ["t1"], naturalPosition: "Portero" },
    ];
    const byId = new Map(seasonPlayers(ps, "t1", SEASONS, null).map((p) => [p.id, p.naturalPosition]));
    expect(byId.get("lat")).toBe("DEF");
    expect(byId.get("por")).toBe("POR");
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

describe("las posiciones viajan a la pizarra", () => {
  it("seasonPlayers lleva las posiciones resueltas (también las leídas del texto antiguo)", () => {
    const ps: PlayerDoc[] = [
      { id: "lat", seasons: ["t1"], positions: { main: "LD", also: ["MD"] }, naturalPosition: "DEL" },
      { id: "old", seasons: ["t1"], naturalPosition: "Lateral derecho" },
      { id: "nada", seasons: ["t1"] },
    ];
    const byId = new Map(seasonPlayers(ps, "t1", SEASONS, null).map((p) => [p.id, p]));
    expect(byId.get("lat")!.positions).toEqual({ main: "LD", also: ["MD"] });
    expect(byId.get("old")!.positions).toEqual({ main: "LD", also: [] });
    expect(byId.get("old")!.naturalPosition).toBe("DEF");
    expect(byId.get("nada")!.positions).toEqual({ main: null, also: [] });
  });
});

describe("Tus posiciones: lo que dice la ficha vinculada", () => {
  it("sin ficha (o sin documento): nada que enseñar", () => {
    expect(positionsInfo(undefined, "t1")).toBeNull();
  });
  it("sin posiciones: vacío, sin propuesta, ninguna", () => {
    expect(positionsInfo({ naturalPosition: "Defensa", seasons: ["t1"] }, "t1")).toEqual({ approved: { main: null, also: [] }, proposal: null, state: "ninguna", inSeason: true });
  });
  it("aprobadas: las de positions (o el código del texto antiguo), con el estado de la última revisión", () => {
    expect(positionsInfo({ positions: { main: "MCD", also: ["MC", "DFC"] }, positionsReview: { status: "aprobada", at: 1, by: "cap" }, seasons: ["t1"] }, "t1")).toEqual({
      approved: { main: "MCD", also: ["MC", "DFC"] },
      proposal: null,
      state: "aprobada",
      inSeason: true,
    });
    expect(positionsInfo({ naturalPosition: "Pivote" }, "t1")?.approved).toEqual({ main: "MCD", also: [] });
  });
  it("pendiente: la propuesta, limpia (códigos raros fuera, la preferida no se repite)", () => {
    const info = positionsInfo({ positions: { main: "DFC", also: [] }, positionsProposal: { main: "MCD", also: ["MCD", "XX", "MC"], at: 1 }, positionsReview: { status: "rechazada", at: 1 }, seasons: ["t1"] }, "t1");
    expect(info).toEqual({ approved: { main: "DFC", also: [] }, proposal: { main: "MCD", also: ["MC"] }, state: "pendiente", inSeason: true });
  });
  it("ajustada y rechazada se leen de la revisión", () => {
    expect(positionsInfo({ positions: { main: "MC", also: [] }, positionsProposal: null, positionsReview: { status: "ajustada", at: 1 } }, "t1")?.state).toBe("ajustada");
    expect(positionsInfo({ positionsProposal: null, positionsReview: { status: "rechazada", at: 1 } }, "t1")?.state).toBe("rechazada");
  });
  it("una ficha fuera de la temporada actual (o sin temporada en curso) no está en la temporada", () => {
    expect(positionsInfo({ seasons: ["t0"] }, "t1")?.inSeason).toBe(false);
    expect(positionsInfo({}, "t1")?.inSeason).toBe(false);
    expect(positionsInfo({ seasons: ["t1"] }, "")?.inSeason).toBe(false);
    expect(positionsInfo({ seasons: ["t0", "t1"] }, "t1")?.inSeason).toBe(true);
  });
  it("«Enviar al capitán»: solo si hay algo marcado y es distinto de lo aprobado y de lo pendiente (sin importar el orden)", () => {
    const approved = { main: "MCD" as const, also: ["MC" as const, "DFC" as const] };
    const info = { approved, proposal: null, state: "aprobada" as const, inSeason: true };
    expect(canSendPositions({ main: "MCD", also: ["DFC", "MC"] }, info)).toBe(false);
    expect(canSendPositions({ main: "MC", also: ["MCD", "DFC"] }, info)).toBe(true);
    expect(canSendPositions({ main: null, also: [] }, info)).toBe(false);
    const pending = { approved, proposal: { main: "DC" as const, also: [] }, state: "pendiente" as const, inSeason: true };
    expect(canSendPositions({ main: "DC", also: [] }, pending)).toBe(false);
    expect(canSendPositions(approved, pending)).toBe(false);
    expect(canSendPositions({ main: "DC", also: ["MCO"] }, pending)).toBe(true);
    expect(canSendPositions({ main: null, also: ["MI"] }, { approved: { main: null, also: [] }, proposal: null, state: "ninguna", inSeason: true })).toBe(true);
  });
  it("«Enviar al capitán»: nunca con la ficha fuera de la temporada (el capitán no la vería)", () => {
    expect(canSendPositions({ main: "DC", also: [] }, { approved: { main: null, also: [] }, proposal: null, state: "ninguna", inSeason: false })).toBe(false);
  });
});
