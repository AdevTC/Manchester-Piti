import { describe, expect, it } from "vitest";
import { convocatoriaOf, lineupFromBoard, lineupNow, lineupSeven, lineupWalk, parseMatchLineup, parsePresent, sameLineup } from "./matchLineup";
import { systemDef } from "./formations";

const seven = ["k", "d1", "d2", "mi", "mc", "md", "dc"];
const board = { formation: "2-3-1", freeMode: false, slots: seven.map((playerId) => ({ playerId, x: 0, y: 0 })) };

describe("lineupFromBoard", () => {
  it("toma los códigos y los sitios del sistema, portero en la casilla 0", () => {
    const l = lineupFromBoard(board)!;
    expect(l.system).toBe("2-3-1");
    expect(l.slots.map((s) => s.code)).toEqual(systemDef("2-3-1").spots.map((s) => s[0]));
    expect(l.slots[0]).toMatchObject({ playerId: "k", code: "POR" });
    expect(l.slots[6]).toMatchObject({ playerId: "dc", code: "DC", x: 50, y: 22 });
  });
  it("en modo libre usa dónde está cada casilla", () => {
    const free = { ...board, freeMode: true, slots: board.slots.map((s, i) => (i === 6 ? { ...s, x: 30, y: 10 } : { ...s, x: 50, y: 70 })) };
    const l = lineupFromBoard(free)!;
    expect(l.system).toBe("libre");
    expect(l.slots[6]).toMatchObject({ x: 30, y: 10 });
  });
  it("sin siete completo o con alguien repetido no hay alineación", () => {
    expect(lineupFromBoard({ ...board, slots: board.slots.slice(0, 6) })).toBeNull();
    expect(lineupFromBoard({ ...board, slots: [...board.slots.slice(0, 6), { playerId: "k", x: 0, y: 0 }] })).toBeNull();
  });
});

describe("lineupNow", () => {
  const l = lineupFromBoard(board)!;
  it("quien entra hereda la casilla de quien sale; una roja la vacía", () => {
    const now = lineupNow(l, [
      { type: "substitution", playerId: "mc", inPlayerId: "b1", period: 1, elapsedSeconds: 600 },
      { type: "red_card", playerId: "d1", period: 2, elapsedSeconds: 60 },
    ]);
    expect(now.find((s) => s.playerId === "b1")?.code).toBe("MC");
    expect(now.some((s) => s.playerId === "d1")).toBe(false);
    expect(now).toHaveLength(6);
  });
  it("un cambio por el expulsado llena la casilla que vació su roja, una sola vez", () => {
    const events = [
      { type: "red_card", playerId: "d1", period: 1, elapsedSeconds: 300 },
      { type: "substitution", playerId: "d1", inPlayerId: "b1", period: 1, elapsedSeconds: 420 },
      { type: "substitution", playerId: "d1", inPlayerId: "b2", period: 1, elapsedSeconds: 480 },
    ];
    const now = lineupNow(l, events);
    expect(now).toHaveLength(7);
    expect(now.find((s) => s.playerId === "b1")?.code).toBe(l.slots[1].code);
    expect(now.some((s) => s.playerId === "b2")).toBe(false);
    const walk = lineupWalk(l, events.slice(0, 1));
    expect(walk.vacant).toEqual([{ outId: "d1", slot: l.slots[1] }]);
    expect(lineupWalk(l, events).vacant).toEqual([]);
  });
  it("va en orden de juego (un cambio de la 2ª no pisa uno de la 1ª) e ignora duplicados pendientes", () => {
    const now = lineupNow(l, [
      { type: "substitution", playerId: "b1", inPlayerId: "b2", period: 2, elapsedSeconds: 30 },
      { type: "substitution", playerId: "mc", inPlayerId: "b1", period: 1, elapsedSeconds: 900 },
      { type: "substitution", playerId: "dc", inPlayerId: "b3", period: 1, elapsedSeconds: 100, dupOf: "x" },
    ]);
    expect(now.find((s) => s.code === "MC")?.playerId).toBe("b2");
    expect(now.find((s) => s.code === "DC")?.playerId).toBe("dc");
  });
});

describe("convocatoriaOf", () => {
  const old = { starters: seven, bench: ["b1", "b2"], notCalled: ["b3"] };
  it("con lista de quién ha venido: banquillo = los que han venido y no juegan", () => {
    const c = convocatoriaOf(["k", "d1", "d2", "mi", "b1", "md", "dc"], old, ["k", "d1", "d2", "mi", "mc", "md", "dc", "b1", "b3"]);
    expect(c.bench).toEqual(["mc", "b3"]);
    expect(c.notCalled).toEqual(["b2"]);
  });
  it("sin lista: nadie sale de la convocatoria", () => {
    const c = convocatoriaOf(["k", "d1", "d2", "mi", "b1", "md", "dc"], old, null);
    expect(c.bench).toEqual(["b2", "mc"]);
    expect(c.notCalled).toEqual(["b3"]);
  });
});

describe("leer y comparar", () => {
  const l = { ...lineupFromBoard(board)!, boardId: "b", setBy: "u", setAt: 1 };
  it("parseMatchLineup acepta lo guardado y rechaza lo mal formado", () => {
    expect(parseMatchLineup(l)).toEqual(l);
    expect(parseMatchLineup({ ...l, slots: l.slots.slice(1) })).toBeNull();
    expect(parseMatchLineup({ ...l, slots: [...l.slots.slice(1), l.slots[0]] })).toBeNull();
    expect(parseMatchLineup(undefined)).toBeNull();
    expect(parsePresent(["a", 1])).toBeNull();
  });
  it("sameLineup y lineupSeven", () => {
    expect(sameLineup(l, lineupFromBoard(board))).toBe(true);
    expect(sameLineup(l, { ...l, system: "3-2-1" })).toBe(false);
    expect(lineupSeven(l)).toEqual(seven);
  });
});
