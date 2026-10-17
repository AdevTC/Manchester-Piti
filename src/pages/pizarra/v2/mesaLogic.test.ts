import { describe, expect, it } from "vitest";
import { seedLineup } from "../lineupOps";
import type { LineupDoc } from "../lineupDoc";
import { lineupFromBoard, lineupNow, type MatchLineup } from "../../../lib/matchLineup";
import {
  availableOf,
  bringField,
  changeLine,
  desdeMesaOf,
  fieldCopyName,
  fieldOnBoard,
  fieldStory,
  mesaDiff,
  mesaHref,
  mesaState,
  ownThatCame,
  rollOf,
  workingCopy,
} from "./mesaLogic";

const P = (i: number) => "p" + i;
const SEVEN = [0, 1, 2, 3, 4, 5, 6].map(P);
const board = (ids: string[], formation: "2-3-1" | "3-2-1" = "2-3-1") => seedLineup(formation, ids);
const asMatch = (ids: string[], formation: "2-3-1" | "3-2-1" = "2-3-1"): MatchLineup => ({ ...lineupFromBoard(board(ids, formation))!, boardId: "b", setBy: "u", setAt: 1 });
const name = (id: string) => id.toUpperCase();

const doc = (o: Partial<LineupDoc> & { id: string }): LineupDoc => ({ ownerUid: "me", isOfficial: false, matchId: null, updatedAt: 1, createdAt: 1, ...o }) as unknown as LineupDoc;

describe("desdeMesaOf", () => {
  it("lee desde=mesa y el partido", () => {
    expect(desdeMesaOf({ desde: "mesa", partido: "m1" })).toEqual({ on: true, matchId: "m1" });
    expect(desdeMesaOf({ desde: "mesa", partido: 42 })).toEqual({ on: true, matchId: "42" });
  });
  it("sin partido no hay modo", () => {
    expect(desdeMesaOf({ desde: "mesa" }).on).toBe(false);
    expect(desdeMesaOf({ partido: "m1" }).on).toBe(false);
  });
  it("la vuelta y el nombre de la copia", () => {
    expect(mesaHref("m 1")).toBe("/matches/m%201/mesa");
    expect(fieldCopyName(7)).toBe("Siete del campo · J7");
    expect(fieldCopyName(null)).toBe("Siete del campo");
  });
});

describe("workingCopy", () => {
  const off = doc({ id: "off", ownerUid: "admin", isOfficial: true, matchId: "m1" });
  const season = doc({ id: "season", ownerUid: "admin", isOfficial: true, matchId: null });
  it("un admin abre el oficial del partido", () => {
    expect(workingCopy({ matchId: "m1", uid: "admin", isAdmin: true, current: null, officials: [off], mine: [] })).toEqual({ k: "open", id: "off" });
  });
  it("un admin que ya lo tiene abierto se queda", () => {
    expect(workingCopy({ matchId: "m1", uid: "admin", isAdmin: true, current: off, officials: [off], mine: [] })).toEqual({ k: "keep" });
  });
  it("un anotador no edita el oficial: su copia ligada al partido, la más reciente", () => {
    const a = doc({ id: "a", matchId: "m1", updatedAt: 5 });
    const b = doc({ id: "b", matchId: "m1", updatedAt: 9 });
    const other = doc({ id: "c", matchId: "m2", updatedAt: 20 });
    expect(workingCopy({ matchId: "m1", uid: "me", isAdmin: false, current: off, officials: [off], mine: [a, b, other] })).toEqual({ k: "open", id: "b" });
  });
  it("sin copia, copia del oficial (del partido, si no el de la temporada)", () => {
    expect(workingCopy({ matchId: "m1", uid: "me", isAdmin: false, current: off, officials: [off, season], mine: [] })).toEqual({ k: "copy", from: "off" });
    expect(workingCopy({ matchId: "m1", uid: "me", isAdmin: false, current: null, officials: [season], mine: [] })).toEqual({ k: "copy", from: "season" });
  });
  it("un admin sin oficial del partido no toca el de la temporada: hace su copia", () => {
    expect(workingCopy({ matchId: "m1", uid: "admin", isAdmin: true, current: null, officials: [season], mine: [] })).toEqual({ k: "copy", from: "season" });
  });
  it("sin oficial ni copia, uno nuevo desde la convocatoria", () => {
    expect(workingCopy({ matchId: "m1", uid: "me", isAdmin: false, current: null, officials: [], mine: [doc({ id: "x", matchId: null })] })).toEqual({ k: "new" });
  });
  it("el tablero propio del enlace, ligado al partido, se queda", () => {
    const mine = doc({ id: "mine", matchId: "m1" });
    expect(workingCopy({ matchId: "m1", uid: "me", isAdmin: false, current: mine, officials: [off], mine: [mine] })).toEqual({ k: "keep" });
  });
});

describe("¿Quién ha venido?", () => {
  it("sin lista no hay filtro; con lista, solo los que han venido", () => {
    const called = new Set(["a", "b", "c"]);
    expect(rollOf(null)).toBeNull();
    expect(rollOf([])).toBeNull();
    expect(availableOf(called, rollOf(null))).toBe(called);
    expect([...availableOf(called, rollOf(["a", "z"]))!]).toEqual(["a", "z"]);
  });
  it("el siete de la convocatoria que ha venido va primero en el sobre", () => {
    expect(ownThatCame(["a", "b", "c"], rollOf(["c", "a"]))).toEqual(["a", "c"]);
    expect(ownThatCame(["a", "b"], null)).toEqual(["a", "b"]);
  });
});

describe("mesaDiff", () => {
  const conv = { starters: SEVEN, bench: ["p7", "p8"], notCalled: ["p9"] };
  it("sin siete en el tablero no hay nada que mandar", () => {
    expect(mesaDiff({ board: lineupFromBoard(board(SEVEN.slice(0, 6))), match: null, conv, present: null, name })).toBeNull();
  });
  it("el mismo siete: todo igual", () => {
    const rows = mesaDiff({ board: lineupFromBoard(board(SEVEN)), match: asMatch(SEVEN), conv, present: null, name })!;
    expect(rows.map((r) => [r.k, r.state])).toEqual([
      ["sistema", "igual"],
      ["siete", "igual"],
      ["banquillo", "igual"],
      ["portero", "igual"],
    ]);
  });
  it("entra uno del banquillo: cambia el siete y el banquillo, en palabras", () => {
    const next = [...SEVEN.slice(0, 6), "p7"];
    const rows = mesaDiff({ board: lineupFromBoard(board(next, "3-2-1")), match: asMatch(SEVEN), conv, present: null, name })!;
    const by = Object.fromEntries(rows.map((r) => [r.k, r]));
    expect(by.sistema).toMatchObject({ state: "cambia", now: "3-2-1", note: "antes 2-3-1" });
    expect(by.siete).toMatchObject({ state: "cambia", out: ["P6"], in: ["P7"] });
    expect(by.banquillo).toMatchObject({ state: "cambia", out: ["P7"], in: ["P6"] });
    expect(by.portero).toMatchObject({ state: "igual", now: "P0" });
  });
  it("los mismos siete en otro sitio: cambia, y dice quién", () => {
    // 2-3-1: 1 DFC · 2 DFC · 3 MI · 4 MC
    const swapped = [SEVEN[0], SEVEN[3], SEVEN[2], SEVEN[1], ...SEVEN.slice(4)];
    const siete = mesaDiff({ board: lineupFromBoard(board(swapped)), match: asMatch(SEVEN), conv, present: null, name })!.find((r) => r.k === "siete")!;
    expect(siete.state).toBe("cambia");
    expect(siete.now).toBe("Mismos siete");
    expect(siete.note).toBe("Cambian de sitio: P3 a " + asMatch(SEVEN).slots[1].code + ", P1 a " + asMatch(SEVEN).slots[3].code);
    const sides = [SEVEN[0], SEVEN[2], SEVEN[1], ...SEVEN.slice(3)];
    const lado = mesaDiff({ board: lineupFromBoard(board(sides)), match: asMatch(SEVEN), conv, present: null, name })!.find((r) => r.k === "siete")!;
    expect(lado).toMatchObject({ state: "cambia", note: "Cambian de lado: P2, P1" });
  });
  it("cambia el portero", () => {
    const next = [SEVEN[1], SEVEN[0], ...SEVEN.slice(2)];
    const gk = mesaDiff({ board: lineupFromBoard(board(next)), match: asMatch(SEVEN), conv, present: null, name })!.find((r) => r.k === "portero")!;
    expect(gk).toMatchObject({ state: "cambia", now: "P1", note: "antes P0" });
  });
  it("con lista, el banquillo es quien ha venido", () => {
    const bench = mesaDiff({ board: lineupFromBoard(board(SEVEN)), match: asMatch(SEVEN), conv, present: [...SEVEN, "p8", "p9"], name })!.find((r) => r.k === "banquillo")!;
    expect(bench).toMatchObject({ state: "cambia", out: ["P7"], in: ["P9"] });
  });
  it("sin alineación en el partido todo cambia y se compara con la convocatoria", () => {
    const rows = mesaDiff({ board: lineupFromBoard(board(SEVEN)), match: null, conv, present: null, name })!;
    expect(rows.find((r) => r.k === "siete")).toMatchObject({ state: "cambia", out: [], in: [] });
    expect(rows.find((r) => r.k === "sistema")?.state).toBe("cambia");
  });
});

describe("mesaState", () => {
  it("al día, otro siete o sin siete", () => {
    expect(mesaState(lineupFromBoard(board(SEVEN)), asMatch(SEVEN))).toBe("al-dia");
    expect(mesaState(lineupFromBoard(board([...SEVEN.slice(0, 6), "p7"])), asMatch(SEVEN))).toBe("otro");
    expect(mesaState(null, asMatch(SEVEN))).toBe("otro");
    expect(mesaState(lineupFromBoard(board(SEVEN)), null)).toBe("sin");
  });
});

describe("en el campo ahora", () => {
  const lineup = asMatch(SEVEN);
  const events = [
    { type: "substitution", playerId: "p4", inPlayerId: "p8", elapsedSeconds: 29 * 60 + 10, period: 1 },
    { type: "goal", playerId: "p6", minute: 12 },
    { type: "red_card", playerId: "p2", elapsedSeconds: 60, period: 2 },
    { type: "substitution", playerId: "p5", inPlayerId: "p9", minute: 20, dupOf: "x" },
  ];
  it("cuenta la historia como lineupNow", () => {
    const s = fieldStory(lineup, events);
    expect(s.now).toEqual(lineupNow(lineup, events));
    expect(s.changes.map((c) => changeLine(c, name))).toEqual(["P8 entró por P4 (" + lineup.slots[4].code + ") en el 30′", "Roja a P2 (" + lineup.slots[2].code + ") en el 2′"]);
  });
  it("Traer aquí pone en cada casilla a quien juega ahora", () => {
    const s = fieldStory(lineup, events);
    const L = bringField(board(["p1", "p0", "x9"], "3-2-1"), lineup, s.now);
    expect(L.formation).toBe("2-3-1");
    expect(L.slots.map((x) => x.playerId)).toEqual(["p0", "p1", null, "p3", "p8", "p5", "p6"]);
    expect(L.bench).not.toContain("p8");
    expect(L.bench).toContain("x9");
  });
  it("sabe cuándo el tablero ya tiene el campo", () => {
    const now = lineupNow(lineup, events.slice(0, 1));
    const L = bringField(board(SEVEN), lineup, now);
    expect(fieldOnBoard(lineupFromBoard(L), lineup, now)).toBe(true);
    expect(fieldOnBoard(lineupFromBoard(board(SEVEN)), lineup, now)).toBe(false);
  });
  it("en modo libre trae los sitios", () => {
    const free: MatchLineup = { ...lineup, system: "libre", slots: lineup.slots.map((s, i) => ({ ...s, x: 10 + i, y: 20 + i })) };
    const L = bringField(board(SEVEN), free, free.slots);
    expect(L.freeMode).toBe(true);
    expect(L.slots[3]).toMatchObject({ playerId: "p3", x: 13, y: 23 });
  });
});
