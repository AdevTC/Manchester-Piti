import { describe, expect, it } from "vitest";
import { strokeSchema } from "../../../lib/schemas";
import { addStroke, parseDrawings, strokeToData, type Stroke } from "../drawings";
import { CAMS, proj } from "./geometry";
import { demoSquad, lineupOf } from "./testkit";
import { hitStroke, inkView } from "./telestrator";
import { newRival, rivalSpots } from "./rival";
import {
  boardPlaces,
  cartelExtras,
  drawCartelExtras,
  extraLabel,
  extraView,
  fueraOf,
  hitExtra,
  livePoints,
  makeFoco,
  makeFuera,
  makeMedir,
  makeUnir,
  metres,
  metresTxt,
  nearestPlayer,
  offsideY,
  PITCH_M,
  rivalTokens,
  togglePick,
  type CartelCtx,
} from "./drawTools";

const sq = demoSquad();
const SEVEN = ["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "adrian"];
const L = lineupOf(SEVEN, "2-3-1", sq);
const C = CAMS.tv;
const nm = (id: string) => id.toUpperCase();

describe("metres on a 60 × 40 m pitch", () => {
  it("counts the width as 40 m and the length as 60 m", () => {
    expect(PITCH_M).toEqual({ w: 40, l: 60 });
    expect(metres({ x: 0, y: 0 }, { x: 100, y: 0 })).toBeCloseTo(40);
    expect(metres({ x: 0, y: 0 }, { x: 0, y: 100 })).toBeCloseTo(60);
    expect(metres({ x: 0, y: 0 }, { x: 30, y: 40 })).toBeCloseTo(Math.hypot(12, 24));
    expect(metres({ x: 0, y: 0 }, { x: 50, y: 0 }, { w: 30, l: 50 })).toBeCloseTo(15);
  });
  it("says it in Spanish, one decimal at most", () => {
    expect(metresTxt(12.46)).toBe("12,5 m");
    expect(metresTxt(8)).toBe("8 m");
  });
});

describe("the strokes pinned to the players", () => {
  const places = boardPlaces(L);
  it("knows where each of the seven stands", () => {
    expect(Object.keys(places).sort()).toEqual([...SEVEN].sort());
  });
  it("Unir takes 2 to 4 different players of the seven, and follows them", () => {
    expect(makeUnir(["illescas"], places, "gold")).toBeNull();
    expect(makeUnir(["illescas", "illescas"], places, "gold")).toBeNull();
    expect(makeUnir(["a", "b"], places, "gold")).toBeNull();
    expect(makeUnir(["illescas", "tello", "huberoski", "eguzquiza", "almachi"], places, "gold")).toBeNull();
    const u = makeUnir(["illescas", "tello"], places, "gold");
    expect(u && strokeSchema.safeParse(u).success).toBe(true);
    expect(u?.anchors).toEqual(["illescas", "tello"]);
    // tello moves (a swap of slots): the line goes with him
    const moved = { ...L, slots: L.slots.map((s, i) => (i === 2 ? { ...s, playerId: "huberoski" } : i === 3 ? { ...s, playerId: "tello" } : s)) };
    const live = livePoints(u as Stroke, boardPlaces(moved), moved, null);
    expect(live[1]).toEqual(boardPlaces(moved).tello);
    // someone off the pitch: his stored point stays
    const gone = { ...L, slots: L.slots.map((s) => (s.playerId === "tello" ? { ...s, playerId: null } : s)) };
    expect(livePoints(u as Stroke, boardPlaces(gone), gone, null)[1]).toEqual((u as Stroke).points[1]);
  });
  it("Foco takes one of the seven; Medir two points, or two players", () => {
    expect(makeFoco("nadie", places, "sky")).toBeNull();
    const f = makeFoco("adrian", places, "sky");
    expect(f && strokeSchema.safeParse(f).success).toBe(true);
    expect(makeMedir({ x: 10, y: 10 }, { x: 10.5, y: 10.5 }, "white")).toBeNull();
    const m = makeMedir({ x: 10, y: 10 }, { x: 60, y: 10 }, "white");
    expect(m && strokeSchema.safeParse(m).success).toBe(true);
    expect(m?.anchors).toBeUndefined();
    const mp = makeMedir(places.illescas, places.adrian, "white", ["illescas", "adrian"]);
    expect(mp?.anchors).toEqual(["illescas", "adrian"]);
    expect(extraLabel(m as Stroke, nm, (m as Stroke).points)).toBe("Medir 20 m · blanco");
    expect(extraLabel(mp as Stroke, nm, [places.illescas, places.adrian])).toMatch(/^Medir \d+(,\d)? m \(ILLESCAS–ADRIAN\) · blanco$/);
  });
  it("the fuera de juego sits at our last defender, or theirs, never past halfway, and moves by itself", () => {
    const ys = L.slots.map((_, i) => boardPlaces(L)[L.slots[i].playerId as string].y).sort((a, b) => b - a);
    expect(offsideY(L, "nos", null)).toBeCloseTo(Math.max(50, ys[1]));
    expect(offsideY(L, "rival", null)).toBeNull();
    const r = newRival("2-3-1");
    const ry = rivalSpots(r)
      .map((p) => p.y)
      .sort((a, b) => a - b);
    expect(offsideY(L, "rival", r)).toBeCloseTo(Math.min(50, ry[1]));
    expect(offsideY(lineupOf(["evans"], "2-3-1", sq), "nos", null)).toBeNull();
    const fu = makeFuera("nos", 71.234, "white");
    expect(strokeSchema.safeParse(fu).success).toBe(true);
    expect(fu.points[0].y).toBe(71.2);
    // the defence goes up: the line follows
    const high = { ...L, tactics: { ...L.tactics, defLine: "Alta" } };
    const now = livePoints(fu, boardPlaces(high), high, null);
    expect(now[0].y).toBeCloseTo(offsideY(high, "nos", null) as number);
    expect(fueraOf([fu], "nos")).toBe(fu);
    expect(fueraOf([fu], "rival")).toBeUndefined();
    expect(extraLabel(fu, nm, now)).toBe("Fuera de juego · nuestra última línea · blanco");
  });
  it("the store keeps anchors and side; an invalid pinned stroke is dropped on read", () => {
    const u = makeUnir(["illescas", "tello", "adrian"], places, "gold") as Stroke;
    const fu = makeFuera("rival", 30, "sky");
    const back = parseDrawings([strokeToData(u), strokeToData(fu), { ...strokeToData(u), anchors: ["solo"] }, { id: "x", kind: "fuera", color: "sky", points: [{ x: 0, y: 1 }, { x: 100, y: 1 }] }], "d1");
    expect(back).toEqual([u, fu]);
    // the undo of the telestrator treats them as any stroke: they go through addStroke
    expect(addStroke([], u)).toEqual([u]);
  });
  it("picks for Unir toggle, up to four", () => {
    expect(togglePick([], "a")).toEqual(["a"]);
    expect(togglePick(["a"], "a")).toEqual([]);
    const four = ["a", "b", "c", "d"];
    expect(togglePick(four, "e")).toBe(four);
    expect(togglePick(["a"], "b", 2)).toEqual(["a", "b"]);
  });
  it("a tap finds the nearest of the seven within reach", () => {
    const cards = [
      { id: "a", x: 20, y: 20 },
      { id: "b", x: 25, y: 20 },
    ];
    expect(nearestPlayer(cards, 24, 20)).toBe("b");
    expect(nearestPlayer(cards, 60, 60)).toBeNull();
  });
});

describe("on the frame", () => {
  const places = boardPlaces(L);
  const u = makeUnir(["illescas", "tello", "huberoski"], places, "gold") as Stroke;
  const f = makeFoco("adrian", places, "sky") as Stroke;
  const m = makeMedir({ x: 10, y: 10 }, { x: 60, y: 10 }, "white") as Stroke;
  const fu = makeFuera("nos", 70, "white");
  const pase: Stroke = { id: "p", kind: "pase", color: "gold", points: [{ x: 85, y: 5 }, { x: 95, y: 25 }] };
  const all = [pase, u, f, m, fu];
  it("draws a closed polygon for three or more, a label with the metres, a spotlight and the fuera de juego", () => {
    const v = extraView(all, L, null, C, u.id);
    expect(v.lines.map((l) => l.kind)).toEqual(["unir", "medir", "fuera"]);
    expect(v.lines[0].d.endsWith("Z")).toBe(true);
    expect(v.lines[0].sel).toBe(true);
    expect(v.labels.map((l) => l.text)).toEqual(["20 m", "FUERA · NOSOTROS"]);
    expect(v.focos).toHaveLength(1);
    const at = proj(C, places.adrian.x, places.adrian.y);
    expect(v.focos[0]).toMatchObject({ x: at.x.toFixed(2), y: at.y.toFixed(2), cls: "c-s" });
  });
  it("the telestrator leaves them to drawTools (no double drawing, no double hit)", () => {
    const ink = inkView(all, C, null);
    expect(ink.paths.map((p) => p.id)).toEqual(["p"]);
    const a = proj(C, places.tello.x, places.tello.y);
    const b = proj(C, places.huberoski.x, places.huberoski.y);
    const mid = [(a.x + b.x) / 2, (a.y + b.y) / 2];
    expect(hitStroke(all, C, mid[0], mid[1])).toBeNull();
    expect(hitExtra(all, L, null, C, mid[0], mid[1])).toBe(u.id);
    expect(hitExtra(all, L, null, C, at().x, at().y)).toBe(f.id);
    expect(hitExtra([pase], L, null, C, mid[0], mid[1])).toBeNull();
    function at() {
      return proj(C, places.adrian.x, places.adrian.y);
    }
  });
  it("the rival's seven are seven red tokens with their dorsal and their note", () => {
    const r = newRival("3-2-1");
    r.players[6] = { num: 9, note: "presionar al 9 por su izquierda" };
    const t = rivalTokens(r, C);
    expect(t).toHaveLength(7);
    expect(t[6]).toMatchObject({ num: "9", noted: true });
    expect(t[6].aria).toBe("Rival: el 9 (dc). presionar al 9 por su izquierda");
    expect(t[0]).toMatchObject({ num: "", noted: false });
  });
});

describe("in the cartel", () => {
  const places = boardPlaces(L);
  const u = makeUnir(["illescas", "tello"], places, "gold") as Stroke;
  const f = makeFoco("adrian", places, "sky") as Stroke;
  const fu = makeFuera("nos", 70, "white");
  const cromos = [
    { id: "illescas", x: 30, y: 70 },
    { id: "tello", x: 70, y: 70 },
    { id: "adrian", x: 50, y: 20 },
  ];
  it("puts the pinned points on the cartel's cromos, the fuera de juego across, and the rival when shown", () => {
    const r = newRival();
    const ex = cartelExtras([u, f, fu], L, r, cromos, true);
    expect(ex[0]).toEqual({ k: "line", pts: [[30, 70], [70, 70]], closed: false, color: "#FFC659", dash: false });
    expect(ex[1]).toEqual({ k: "foco", at: [50, 20], color: "#9fd0f2" });
    expect(ex[2]).toMatchObject({ k: "line", closed: false, dash: true, label: "FUERA DE JUEGO" });
    expect(ex.filter((e) => e.k === "rival")).toHaveLength(7);
    expect(cartelExtras([u], L, r, cromos, false).filter((e) => e.k === "rival")).toHaveLength(0);
    expect(cartelExtras([], L, null, cromos, true)).toEqual([]);
  });
  it("draws them on the canvas: lines, the spotlight, the red tokens with their dorsal", () => {
    const calls: string[] = [];
    const ctx = new Proxy({} as Record<string, unknown>, {
      get: (t, k: string) => (k in t ? t[k] : (...a: unknown[]) => calls.push(k + "(" + a.map((x) => (typeof x === "number" ? Math.round(x) : String(x))).join(",") + ")")),
      set: (t, k: string, v) => {
        t[k] = v;
        calls.push(k + "=" + String(v));
        return true;
      },
    }) as unknown as CartelCtx;
    const r = newRival();
    r.players[0] = { num: 1 };
    drawCartelExtras(ctx, cartelExtras([u, f], L, r, cromos, true), { x: 0, y: 0, w: 1000, h: 1000 });
    expect(calls).toContain("moveTo(300,700)");
    expect(calls).toContain("lineTo(700,700)");
    expect(calls.filter((c) => c === "fillStyle=#d8344a")).toHaveLength(7);
    expect(calls).toContain("fillText(1," + Math.round(500) + "," + Math.round(1000 * (6 + rivalSpots(r)[0].y * 0.86) / 100 + 1) + ")");
    expect(calls.filter((c) => c.startsWith("save"))).toHaveLength(calls.filter((c) => c.startsWith("restore")).length);
  });
});

it("never reads the other strokes as pinned ones", () => {
  expect(extraView([{ id: "z", kind: "zona", color: "gold", points: [{ x: 1, y: 1 }, { x: 9, y: 9 }] }], L, null, C, null)).toEqual({ lines: [], labels: [], focos: [] });
});
