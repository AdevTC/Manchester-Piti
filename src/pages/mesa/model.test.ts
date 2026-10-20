import { describe, expect, it } from "vitest";
import type { MatchEvent } from "../../../functions/src/matchEngine";
import { buzzOf, eventText, fieldSpots, mesaClock, mesaEvents, mesaPlayers, mesaScore, nextPlannedSub, pickScreen, pitchTop, rivalShortOf, spreadTops, stintsOf } from "./model";

const ev = (id: string, type: MatchEvent["type"], at: number, more: Partial<MatchEvent> = {}): MatchEvent => ({ id, type, elapsedSeconds: at, period: 1, ...more });

describe("qué pantalla toca", () => {
  it("la fase elige la pantalla y ?vista=cronica abre lo que va pasando", () => {
    expect(pickScreen("ready", undefined)).toBe("antes");
    expect(pickScreen(undefined, undefined)).toBe("antes");
    expect(pickScreen("first", undefined)).toBe("enjuego");
    expect(pickScreen("second", undefined)).toBe("enjuego");
    expect(pickScreen("halftime", undefined)).toBe("descanso");
    expect(pickScreen("ended", undefined)).toBe("final");
    expect(pickScreen("first", "cronica")).toBe("cronica");
    expect(pickScreen("ended", "cronica")).toBe("cronica");
  });
});

describe("el marcador con duplicados", () => {
  it("un posible duplicado sin resolver cuenta una vez; «Son dos» cuenta los dos", () => {
    const events = [ev("a", "goal", 60, { playerId: "p1", byUid: "u1" }), ev("b", "goal", 70, { playerId: "p1", byUid: "u2", dupOf: "a" }), ev("c", "opponent_goal", 100), ev("d", "opponent_own_goal", 200)];
    expect(mesaScore(events)).toEqual({ us: 2, them: 1 });
    expect(mesaScore(events.map((e) => (e.id === "b" ? { ...e, dupOk: true } : e)))).toEqual({ us: 3, them: 1 });
    expect(mesaScore([ev("x", "own_goal", 5, { playerId: "p1" })])).toEqual({ us: 0, them: 1 });
    expect(mesaScore(undefined)).toEqual({ us: 0, them: 0 });
  });
});

describe("el reloj de la mesa", () => {
  const T = 1_000_000;
  it("cuenta el tiempo de juego y se congela en la pausa (heldAt)", () => {
    const c = mesaClock({ revision: 2, phase: "first", firstStartedAt: T }, T + 1122_000, 50);
    expect(c).toMatchObject({ phase: "first", playing: true, held: false, elapsedSeconds: 1122, periodSeconds: 1122, period: 1, halfSeconds: 1500, minute: 19, text: "18:42", added: 0 });
    const h = mesaClock({ revision: 3, phase: "first", firstStartedAt: T, heldAt: T + 600_000, added: { 1: 2 } }, T + 900_000, 50);
    expect(h).toMatchObject({ playing: false, held: true, elapsedSeconds: 600, added: 2, text: "10:00" });
  });
  it("en la 2ª el reloj sigue desde lo jugado en la 1ª", () => {
    const c = mesaClock({ revision: 5, phase: "second", firstStartedAt: T, firstEndedAt: T + 1500_000, secondStartedAt: T + 1800_000 }, T + 1860_000, 50);
    expect(c).toMatchObject({ period: 2, elapsedSeconds: 1560, periodSeconds: 60, minute: 27 });
  });
});

describe("quién juega y cuánto", () => {
  it("un cambio cierra un tramo y abre otro; el que sale puede volver; la roja cierra", () => {
    const events = [ev("s1", "substitution", 300, { playerId: "a", inPlayerId: "x" }), ev("s2", "substitution", 600, { playerId: "x", inPlayerId: "a" }), ev("r", "red_card", 700, { playerId: "b" })];
    const st = stintsOf(["a", "b"], events);
    expect(st.get("a")).toEqual([{ from: 0, to: 300 }, { from: 600, to: null }]);
    expect(st.get("x")).toEqual([{ from: 300, to: 600 }]);
    expect(st.get("b")).toEqual([{ from: 0, to: 700 }]);
    const info = (id: string) => ({ name: id.toUpperCase(), number: "", guest: false });
    const { field, bench } = mesaPlayers(["a", "b"], ["x", "y"], events, 900, info, null, { y: 2 });
    expect(field.map((p) => [p.id, p.minutes])).toEqual([["a", 10]]);
    expect(bench.map((p) => [p.id, p.played, p.offAt, p.sentOff, p.pending])).toEqual([
      ["b", true, 12, true, 0],
      ["x", true, 10, false, 0],
      ["y", false, null, false, 2],
    ]);
    expect(field[0].stickers).toEqual({ goals: 0, assists: 0, yellow: false, red: false, injured: false });
  });
  it("las pegatinas no cuentan dos veces un duplicado sin resolver", () => {
    const info = (id: string) => ({ name: id, number: "7", guest: false });
    const events = [ev("g1", "goal", 60, { playerId: "a", assistPlayerId: "b" }), ev("g2", "goal", 65, { playerId: "a", dupOf: "g1" }), ev("y", "yellow_card", 90, { playerId: "b" }), ev("t", "injury", 95, { playerId: "b" })];
    const { field } = mesaPlayers(["a", "b"], [], events, 120, info, null, {});
    const a = field.find((p) => p.id === "a")!;
    const b = field.find((p) => p.id === "b")!;
    expect(a.stickers.goals).toBe(1);
    expect(b.stickers).toMatchObject({ assists: 1, yellow: true, red: false, injured: true });
  });
});

describe("dónde va cada camiseta", () => {
  it("sin pizarra, el 2-3-1 por orden con el primero en la portería", () => {
    const { spots, keeper } = fieldSpots(["k", "d1", "d2", "m1", "m2", "m3", "f"], ["k", "d1", "d2", "m1", "m2", "m3", "f"], [], null);
    expect(keeper).toBe("k");
    expect(spots.get("k")).toEqual({ x: 50, y: 93 });
    expect(spots.get("f")).toEqual({ x: 50, y: 14 });
    expect(pitchTop(93)).toBeCloseTo(71, 0);
    expect(pitchTop(14)).toBe(5);
  });
  it("con la pizarra, cada uno en su código; el que entra ocupa el sitio del que sale", () => {
    const codes = { k: "POR", a: "DC", b: "MC" };
    const events = [ev("s", "substitution", 100, { playerId: "a", inPlayerId: "z" })];
    const { spots, keeper } = fieldSpots(["k", "z", "b"], ["k", "a", "b"], events, codes);
    expect(keeper).toBe("k");
    expect(spots.get("z")).toEqual({ x: 50, y: 14 });
  });
  it("el central y el portero en la misma columna: el portero baja (y el central sube si hace falta) hasta que no se pisan", () => {
    // the Elegida 3-2-1: Illescas (50, 74) right in front of Evans (50, 92)
    const spots = [
      { left: 50, top: pitchTop(92) },
      { left: 50, top: pitchTop(74) },
      { left: 18, top: pitchTop(70) },
    ];
    const tops = spreadTops(spots, 280, 64);
    const need = (64 / 280) * 100;
    expect(tops[0] - tops[1]).toBeGreaterThanOrEqual(need - 0.11);
    expect(tops[0]).toBeLessThanOrEqual(76);
    // the full-back in his own column keeps his spot
    expect(tops[2]).toBeCloseTo(pitchTop(70), 1);
  });
  it("fichas en columnas distintas o ya separadas: nadie se mueve", () => {
    const spots = [
      { left: 20, top: 30 },
      { left: 80, top: 32 },
      { left: 50, top: 5 },
      { left: 50, top: 60 },
    ];
    expect(spreadTops(spots, 280, 64)).toEqual([30, 32, 5, 60]);
  });
});

describe("cómo se dice cada jugada", () => {
  const nameOf = (id: string) => ({ p: "Mario", q: "Pablo", h: "Hugo" })[id] ?? id;
  it("con el nombre, el rival y la asistencia", () => {
    expect(eventText({ type: "goal", playerId: "p", assistPlayerId: "q" }, nameOf, "Atlético Demo")).toBe("Gol de Mario, asistencia de Pablo");
    expect(eventText({ type: "goal" }, nameOf, "Atlético Demo")).toBe("Gol del Piti, falta decir quién");
    expect(eventText({ type: "substitution", playerId: "q", inPlayerId: "h" }, nameOf, "X")).toBe("Entra Hugo, sale Pablo");
    expect(eventText({ type: "opponent_foul" }, nameOf, "Atlético Demo")).toBe("Falta de Atlético Demo");
    expect(eventText({ type: "injury", playerId: "p" }, nameOf, "X")).toBe("Mario, tocado");
  });
  it("el código corto del rival y la vibración por tipo", () => {
    expect(rivalShortOf("Atlético Demo")).toBe("ATL");
    expect(rivalShortOf("Rayo Pruebas")).toBe("RAY");
    expect(rivalShortOf("C.D. Rayo")).toBe("RAY");
    expect(rivalShortOf("Lo que sea", "xyz")).toBe("XYZ");
    expect(buzzOf("goal")).toEqual([40, 60, 140]);
    expect(buzzOf("opponent_goal")).toEqual([220]);
    expect(buzzOf("substitution")).toEqual([20, 40, 20]);
    expect(buzzOf("foul")).toEqual([25]);
  });
});

describe("la cola dentro del acta", () => {
  it("las jugadas del móvil se ven (local) hasta que el documento las trae", () => {
    const ctx = { nameOf: (id: string) => id, rival: "Atlético Demo", rivalShort: "ATL", uid: "me", people: new Map([["u2", "David"]]) };
    const server = [ev("live-a", "goal", 60, { playerId: "p", byUid: "u2", editedByUid: "me" })];
    const local = [
      { requestId: "a", type: "goal" as const, playerId: "p", tappedElapsed: 60, period: 1 as const },
      { requestId: "b", type: "opponent_goal" as const, tappedElapsed: 90, period: 1 as const },
    ];
    const list = mesaEvents(server, local, ctx);
    expect(list.map((e) => [e.id, e.local, e.byName, e.editedByName, e.tag])).toEqual([
      ["live-a", false, "David", "Tú", "GOL"],
      ["live-b", true, "Tú", null, "GOL ATL"],
    ]);
    expect(list[1].minute).toBe(2);
  });
});

describe("el cambio previsto en la pizarra", () => {
  it("el primero que aún se puede hacer", () => {
    const subs = [{ min: 20, out: "a", in: "x" }, { min: 10, out: "gone", in: "y" }, { min: 15, out: "b", in: "y" }];
    expect(nextPlannedSub(subs, ["a", "b"], ["x", "y"])).toEqual({ inId: "y", outId: "b" });
    expect(nextPlannedSub(subs, ["c"], ["x"])).toBeNull();
  });
});
