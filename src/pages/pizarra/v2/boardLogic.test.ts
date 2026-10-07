import { describe, expect, it } from "vitest";
import { autoPlace, freeSpot, goFree, normalize, resetFree, resolveDrop, setPlaysAs, setSystem, stepSystem, cycleDefLine } from "./ops";
import { applyFan, fanCentre, fanItems, FAN_RADIUS } from "./fan";
import { packRanking, reelFor, suggestSeven, packDelay } from "./pack";
import { slotPos } from "./geometry";
import { isFull, natOf } from "./model";
import { cromo, demoSquad, lineupOf, squadOf } from "./testkit";

const ids = (L: { slots: { playerId: string | null }[] }) => L.slots.map((s) => s.playerId);

describe("normalize", () => {
  it("drops unknown and repeated players, completes the tactics and rebuilds the bench", () => {
    const sq = demoSquad();
    const raw = lineupOf(["evans", "ghost", "tello", "tello"]);
    const L = normalize({ ...raw, tactics: {} as typeof raw.tactics }, sq.list.map((c) => c.id));
    expect(ids(L)).toEqual(["evans", null, "tello", null, null, null, null]);
    expect(L.bench).not.toContain("evans");
    expect(L.bench).toContain("erik");
    expect(L.tactics.defLine).toBe("Media");
  });
  it("rebuilds the seven slots of a damaged board", () => {
    const raw = lineupOf([]);
    const L = normalize({ ...raw, slots: raw.slots.slice(0, 3) }, []);
    expect(L.slots).toHaveLength(7);
  });
});

describe("drop: what a released cromo does", () => {
  const sq = demoSquad();
  const L = lineupOf(["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "adrian"], "2-3-1", sq);
  it("pitch cromo on an occupied ghost slot swaps the two", () => {
    const r = resolveDrop(L, sq, { id: "adrian", from: "pitch" }, { k: "gslot", i: 1 }, true);
    expect(r && "lineup" in r && ids(r.lineup)).toEqual(["evans", "adrian", "tello", "huberoski", "eguzquiza", "almachi", "illescas"]);
  });
  it("pitch cromo on another pitch cromo swaps them", () => {
    const r = resolveDrop(L, sq, { id: "tello", from: "pitch" }, { k: "tok", id: "evans", from: "pitch" }, true);
    expect(r && "lineup" in r && ids(r.lineup).slice(0, 3)).toEqual(["tello", "illescas", "evans"]);
  });
  it("pitch cromo on the bench goes to the bench", () => {
    const r = resolveDrop(L, sq, { id: "almachi", from: "pitch" }, { k: "bench" }, true);
    expect(r && "lineup" in r && r.lineup.slots[5].playerId).toBeNull();
    expect(r && "lineup" in r && r.lineup.bench).toContain("almachi");
  });
  it("bench cromo on a pitch cromo takes his place; he goes to the bench", () => {
    const r = resolveDrop(L, sq, { id: "kevin", from: "bench" }, { k: "tok", id: "adrian", from: "pitch" }, true);
    expect(r && "lineup" in r && r.lineup.slots[6].playerId).toBe("kevin");
    expect(r && "lineup" in r && r.lineup.bench).toContain("adrian");
  });
  it("a baja cannot be placed", () => {
    const r = resolveDrop(L, sq, { id: "brawan", from: "bench" }, { k: "gslot", i: 1 }, true);
    expect(r).toEqual({ toast: "BRAWAN está de baja: no se puede colocar" });
    const r2 = resolveDrop(L, sq, { id: "tello", from: "pitch" }, { k: "tok", id: "andia", from: "bench" }, true);
    expect(r2).toEqual({ toast: "ANDIA está de baja" });
  });
  it("bench cromo on the open pitch goes to the nearest empty slot", () => {
    const holes = lineupOf(["evans", null, "tello", null, "eguzquiza", "almachi", "adrian"], "2-3-1", sq);
    const p = slotPos(holes, 3);
    const r = resolveDrop(holes, sq, { id: "kevin", from: "bench" }, { k: "pitch", u: p.u + 4, v: p.v + 2 }, true);
    expect(r && "lineup" in r && r.lineup.slots[3].playerId).toBe("kevin");
  });
  it("dropping back where it was is no change; bench onto bench is no change", () => {
    expect(resolveDrop(L, sq, { id: "adrian", from: "pitch" }, { k: "gslot", i: 6 }, true)).toBeNull();
    expect(resolveDrop(L, sq, { id: "kevin", from: "bench" }, { k: "bench" }, true)).toBeNull();
    expect(resolveDrop(L, sq, { id: "kevin", from: "bench" }, null, true)).toBeNull();
  });
  it("free mode: the cromo stays where it lands, on the grid when it is on", () => {
    const free = goFree(L);
    const r = resolveDrop(free, sq, { id: "adrian", from: "pitch" }, { k: "pitch", u: 61.7, v: 33.2 }, true);
    expect(r && "lineup" in r && [r.lineup.slots[6].x, r.lineup.slots[6].y]).toEqual([60, 35]);
    const r2 = resolveDrop(free, sq, { id: "adrian", from: "pitch" }, { k: "pitch", u: 61.7, v: 33.2 }, false);
    expect(r2 && "lineup" in r2 && [r2.lineup.slots[6].x, r2.lineup.slots[6].y]).toEqual([62, 33]);
    expect(freeSpot(-10, 120, false)).toEqual([4, 96]);
  });
});

describe("systems and free mode", () => {
  const sq = demoSquad();
  const L = lineupOf(["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "adrian"], "2-3-1", sq);
  it("changing the system keeps each player in his slot index", () => {
    const n = setSystem(goFree(L), "3-2-1");
    expect(n.formation).toBe("3-2-1");
    expect(n.freeMode).toBe(false);
    expect(ids(n)).toEqual(ids(L));
    expect(stepSystem(L, 1).formation).toBe("3-2-1");
    expect(stepSystem(L, -1).formation).toBe("2-1-2-1");
  });
  it("Libre keeps every spot; reset puts them back on the system", () => {
    const f = goFree(L);
    expect(f.freeMode).toBe(true);
    expect([f.slots[3].x, f.slots[3].y]).toEqual([17, 50]);
    const moved = { ...f, slots: f.slots.map((s) => ({ ...s, x: 10, y: 10 })) };
    const back = resetFree(moved);
    expect(back.freeMode).toBe(true);
    expect([back.slots[3].x, back.slots[3].y]).toEqual([17, 50]);
  });
  it("cycles the línea Baja → Media → Alta", () => {
    expect(cycleDefLine(L).tactics.defLine).toBe("Alta");
    expect(cycleDefLine(cycleDefLine(L)).tactics.defLine).toBe("Baja");
  });
  it("reads a per-board position stored as a word", () => {
    expect(natOf({ ...L, playerPositions: { tello: "Medio" as never } }, sq, "tello")).toBe("MED");
    expect(natOf({ ...L, playerPositions: { tello: "???" as never } }, sq, "tello")).toBe("DEF");
  });
  it("«Jugar de» his natural zone clears the override", () => {
    const a = setPlaysAs(L, sq, "tello", "MED");
    expect(a.playerPositions.tello).toBe("MED");
    expect(setPlaysAs(a, sq, "tello", "DEF").playerPositions.tello).toBeUndefined();
  });
});

describe("Auto-colocar", () => {
  it("puts each cromo in his natural zone, the bajas out, the keeper in goal", () => {
    const sq = demoSquad();
    const L = lineupOf(["adrian", "brawan", null, "evans", null, null, null], "2-3-1", sq);
    const n = autoPlace(L, sq);
    expect(n.slots[0].playerId).toBe("evans");
    expect(ids(n)).not.toContain("brawan");
    expect(sq.byId.get(n.slots[6].playerId as string)?.pos).toBe("DEL");
    expect(n.slots.filter((s) => s.playerId)).toHaveLength(7);
    expect(isFull(n, sq)).toBe(true);
  });
});

describe("«Sugerir siete»: the pack", () => {
  const sq = squadOf([
    cromo("gk1", 1, "POR", { rt: 60, recentMin: 150 }),
    cromo("gk2", 13, "POR", { rt: 90, recentMin: 0 }),
    cromo("d1", 2, "DEF", { recentMin: 100 }),
    cromo("d2", 3, "DEF", { recentMin: 90 }),
    cromo("d3", 4, "DEF", { recentMin: 140, baja: "Lesionado" }),
    cromo("m1", 6, "MED", { recentMin: 150, recentGA: 2 }),
    cromo("m2", 8, "MED", { recentMin: 120 }),
    cromo("m3", 16, "MED", { recentMin: 10 }),
    cromo("m4", 18, "MED", { recentMin: 80, cv: "no" }),
    cromo("f1", 9, "DEL", { recentMin: 130, recentGA: 3 }),
    cromo("f2", 11, "DEL", { recentMin: 20 }),
  ]);
  it("ranks by recent minutes and goals+assists, then the rating; skips bajas and «no voy»", () => {
    const r = packRanking(sq);
    // m1: 150 + 2·15 + 70 = 250 · f1: 130 + 3·15 + 70 = 245 · gk1: 150 + 60 = 210
    expect(r.slice(0, 3)).toEqual(["m1", "f1", "gk1"]);
    expect(r).not.toContain("d3");
    expect(r).not.toContain("m4");
    expect(r.indexOf("gk1")).toBeLessThan(r.indexOf("gk2"));
  });
  it("deals each slot from its own zone, a keeper in goal, and clears the overrides", () => {
    const L = { ...lineupOf([], "2-3-1", sq), playerPositions: { d1: "MED" as const } };
    const n = suggestSeven(L, sq);
    expect(ids(n)).toEqual(["gk1", "d1", "d2", "m1", "m2", "m3", "f1"]);
    expect(n.playerPositions).toEqual({});
  });
  it("still deals seven when a zone runs short", () => {
    const n = suggestSeven(lineupOf([], "2-1-3", sq), sq);
    expect(n.slots.filter((s) => s.playerId)).toHaveLength(7);
    expect(n.slots[0].playerId).toBe("gk1");
  });
  it("spins a reel of squad dorsales before each cromo lands, one after another", () => {
    expect(reelFor(0, [1, 2, 3])).toHaveLength(12);
    expect(reelFor(2, [7])).toEqual(Array(12).fill(7));
    expect(reelFor(1, [])).toEqual([]);
    expect(packDelay(3)).toBeGreaterThan(packDelay(2));
  });
});

describe("the long-press fan", () => {
  const sq = demoSquad();
  const L = lineupOf(["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "adrian"], "2-3-1", sq);
  it("lays the galones, Jugar de, Banquillo and Ficha on a circle from the top", () => {
    const items = fanItems(L, sq, "tello", false);
    expect(items.map((i) => i.label)).toEqual(["Capitán", "Penaltis", "Faltas", "Córners", "Jugar de", "Banquillo", "Ficha"]);
    expect(items[0]).toMatchObject({ dx: 0, dy: -FAN_RADIUS, glyph: "C", on: false });
    items.forEach((it) => expect(Math.round(Math.hypot(it.dx, it.dy))).toBeGreaterThanOrEqual(FAN_RADIUS - 1));
  });
  it("Capitán gives the armband, and a second time takes it off", () => {
    const cap = fanItems(L, sq, "tello", false)[0];
    const o = applyFan(cap, L, sq, "tello");
    expect(o.kind).toBe("lineup");
    if (o.kind !== "lineup") return;
    expect(o.lineup.roles.captainId).toBe("tello");
    expect(o.toast).toBe("Capitán: TELLO");
    const again = applyFan(fanItems(o.lineup, sq, "tello", false)[0], o.lineup, sq, "tello");
    expect(again.kind === "lineup" && again.lineup.roles.captainId).toBeUndefined();
  });
  it("Jugar de opens the zones; a zone sets the override; Banquillo leaves the slot picked", () => {
    const main = fanItems(L, sq, "tello", false);
    expect(applyFan(main[4], L, sq, "tello")).toEqual({ kind: "sub", sub: true });
    const sub = fanItems(L, sq, "tello", true);
    expect(sub.map((i) => i.label)).toEqual(["POR", "DEF", "MED", "DEL", "Volver"]);
    expect(sub[1].on).toBe(true);
    const med = applyFan(sub[2], L, sq, "tello");
    expect(med.kind === "lineup" && med.lineup.playerPositions.tello).toBe("MED");
    const bench = applyFan(main[5], L, sq, "tello");
    expect(bench).toMatchObject({ kind: "lineup", pick: 2 });
    expect(bench.kind === "lineup" && bench.lineup.slots[2].playerId).toBeNull();
    expect(applyFan(main[6], L, sq, "tello")).toEqual({ kind: "ficha" });
  });
  it("keeps its centre inside the app screen", () => {
    expect(fanCentre(10, 10, 390, 844)).toEqual({ cx: 118, cy: 150 });
    expect(fanCentre(380, 840, 390, 844)).toEqual({ cx: 272, cy: 614 });
    expect(fanCentre(200, 400, 390, 844)).toEqual({ cx: 200, cy: 400 });
  });
});
