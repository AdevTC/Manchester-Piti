import { describe, expect, it } from "vitest";
import { autoByEncajeOn, autoPlace, dropBenchedRoles, freeSpot, goFree, normalize, place, resetFree, resolveDrop, rolesLost, setPlaysAs, setSystem, stepSystem, swap, toBench, cycleDefLine } from "./ops";
import { applyFan, fanCentre, fanItems, FAN_RADIUS } from "./fan";
import { packRanking, reelFor, sevenByEncajeOn, suggestSeven, packDelay } from "./pack";
import { convocatoriaFromBoard, withConvocatoria } from "./boards";
import { slotPos } from "./geometry";
import { isFull, natOf, type Cromo } from "./model";
import { cromo, demoSquad, lineupOf, squadOf } from "./testkit";
import { lineOf, type PosCode } from "../../../lib/positions";

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
    expect(stepSystem(L, 1).formation).toBe("2-1-2-1");
    expect(stepSystem(L, -1).formation).toBe("1-3-1-1");
  });
  it("Libre keeps every spot; reset puts them back on the system", () => {
    const f = goFree(L);
    expect(f.freeMode).toBe(true);
    expect([f.slots[3].x, f.slots[3].y]).toEqual([17, 49]);
    const moved = { ...f, slots: f.slots.map((s) => ({ ...s, x: 10, y: 10 })) };
    const back = resetFree(moved);
    expect(back.freeMode).toBe(true);
    expect([back.slots[3].x, back.slots[3].y]).toEqual([17, 49]);
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
  it("«Jugar de» by code: a line-only player keeps any code (only his own line clears it); natOf reads its line", () => {
    const a = setPlaysAs(L, sq, "tello", "DFC");
    expect(a.playerPositions.tello).toBe("DFC");
    expect(natOf(a, sq, "tello")).toBe("DEF");
    expect(natOf(setPlaysAs(L, sq, "tello", "MCD"), sq, "tello")).toBe("MED");
    expect(setPlaysAs(a, sq, "tello", "DEF").playerPositions.tello).toBeUndefined();
  });
  it("«Jugar de» by code: an exact player's preferida clears it, anything else is kept", () => {
    const ex = squadOf([cromo("rodri", 16, "MED", { ps: { main: "MCD", also: ["MC"], line: "MED" } })]);
    const B = lineupOf(["rodri"], "2-3-1", ex);
    const a = setPlaysAs(B, ex, "rodri", "MC");
    expect(a.playerPositions.rodri).toBe("MC");
    expect(setPlaysAs(a, ex, "rodri", "MCD").playerPositions).toEqual({});
    expect(setPlaysAs(B, ex, "rodri", "MCD")).toEqual(B);
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
  it("with a convocatoria: never brings in someone it doesn't call; «Voy» before «Duda»", () => {
    const sq = withConvocatoria(demoSquad(), new Map([["kevin", "duda"], ["erik", "voy"]]));
    const L = lineupOf(["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", null], "2-3-1", sq);
    expect(autoPlace(L, sq, new Set(["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "kevin"])).slots[6].playerId).toBe("kevin");
    expect(autoPlace(L, sq, new Set(["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi"])).slots[6].playerId).toBeNull();
    // (adrian, 96, has not answered: erik said «Voy»)
    expect(autoPlace(L, sq).slots[6].playerId).toBe("erik");
  });
});

describe("the galones belong to the seven", () => {
  const sq = demoSquad();
  const L = { ...lineupOf(["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "adrian"], "2-3-1", sq), roles: { captainId: "tello", penaltiesId: "tello", cornersId: "adrian" } };
  const nm = (id: string) => sq.byId.get(id)?.name ?? id;
  it("whoever goes to the bench leaves his galones (and says so)", () => {
    const b = toBench(L, "tello");
    expect(b.roles).toEqual({ cornersId: "adrian" });
    expect(rolesLost(L, b, nm)).toBe("TELLO deja la capitanía y los penaltis");
    const f = applyFan(fanItems(L, sq, "tello", false)[5], L, sq, "tello");
    expect(f.kind === "lineup" && f.lineup.roles.captainId).toBeUndefined();
  });
  it("a bench player coming in for him, a swap with the bench and Auto-colocar too", () => {
    const p = place(L, "kevin", 6);
    expect(p.roles).toEqual({ captainId: "tello", penaltiesId: "tello" });
    expect(rolesLost(L, p, nm)).toBe("ADRIAN deja los córners");
    expect(swap(L, "tello", "illescas").roles).toEqual(L.roles);
    const r = resolveDrop(L, sq, { id: "tello", from: "pitch" }, { k: "bench" }, false);
    expect(r && "lineup" in r && r.lineup.roles.captainId).toBeUndefined();
  });
  it("a stored board's galones off the pitch are dropped when it is opened; moving on the pitch keeps them", () => {
    const stale = { ...lineupOf(["evans"], "2-3-1", sq), roles: { captainId: "kevin", penaltiesId: "evans" } };
    expect(normalize(stale, sq.list.map((c) => c.id)).roles).toEqual({ penaltiesId: "evans" });
    expect(dropBenchedRoles(L)).toBe(L);
    expect(rolesLost(L, swap(L, "tello", "adrian"), nm)).toBeNull();
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
  it("deals the convocatoria's siete first: a whole one is exactly those seven, a partial one is completed", () => {
    // the pack alone would take m1, f1, gk1, d1, d2, m2, …: the convocatoria wins (even the low-form m3 and gk2)
    const own = ["gk2", "d2", "m2", "m3", "f2", "d1", "m1"];
    const whole = suggestSeven(lineupOf([], "2-3-1", sq), sq, own);
    expect(new Set(ids(whole))).toEqual(new Set(own));
    expect(whole.slots[0].playerId).toBe("gk2");
    const part = suggestSeven(lineupOf([], "2-3-1", sq), sq, ["m3", "f2"]);
    expect(ids(part)).toContain("m3");
    expect(ids(part)).toContain("f2");
    expect(part.slots.filter((s) => s.playerId)).toHaveLength(7);
    expect(part.slots[0].playerId).toBe("gk1");
  });
  it("never deals the convocatoria's bajas or «no va»: the pack completes the seven", () => {
    const own = ["gk2", "d3", "m2", "m3", "f2", "d1", "m4"];
    const n = suggestSeven(lineupOf([], "2-3-1", sq), sq, own);
    expect(ids(n)).not.toContain("d3");
    expect(ids(n)).not.toContain("m4");
    expect(n.slots.filter((s) => s.playerId)).toHaveLength(7);
    ["gk2", "m2", "m3", "f2", "d1"].forEach((id) => expect(ids(n)).toContain(id));
  });
  it("keeps «Jugar de» for those who stay on the pitch, and drops the galones of those who leave", () => {
    const L = { ...lineupOf(["gk2", "d3", null, "m3", null, null, null], "2-3-1", sq), playerPositions: { m3: "DEL" as const, d3: "MED" as const }, roles: { captainId: "d3", penaltiesId: "m1" } };
    const n = suggestSeven(L, sq, ["m3"]);
    expect(ids(n)).toContain("m3");
    expect(ids(n)).not.toContain("d3");
    expect(n.playerPositions).toEqual({ m3: "DEL" });
    expect(ids(n)).toContain("m1");
    expect(n.roles).toEqual({ penaltiesId: "m1" });
  });
  it("with a convocatoria: only those it calls, «Voy» before no answer before «Duda»", () => {
    const s2 = squadOf([
      cromo("a", 1, "MED", { recentMin: 10, cv: "voy" }),
      cromo("b", 2, "MED", { recentMin: 300, cv: "duda" }),
      cromo("c", 3, "MED", { recentMin: 100 }),
      cromo("d", 4, "MED", { recentMin: 500 }),
      cromo("e", 5, "MED", { recentMin: 900, cv: "no" }),
    ]);
    expect(packRanking(s2, new Set(["a", "b", "c", "e"]))).toEqual(["a", "c", "b"]);
    expect(packRanking(s2)).toEqual(["a", "d", "c", "b"]);
    const n = suggestSeven(lineupOf([], "2-3-1", s2), s2, [], new Set(["a", "b"]));
    expect(ids(n).filter(Boolean).sort()).toEqual(["a", "b"]);
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
  it("lays the galones, Jugar de, Banquillo, Mover a and Ficha on a circle from the top", () => {
    const items = fanItems(L, sq, "tello", false);
    expect(items.map((i) => i.label)).toEqual(["Capitán", "Penaltis", "Faltas", "Córners", "Jugar de", "Banquillo", "Mover a", "Ficha"]);
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
  it("Jugar de opens the codes of his line in this system; a code sets the override; Banquillo leaves the slot picked", () => {
    const main = fanItems(L, sq, "tello", false);
    expect(applyFan(main[4], L, sq, "tello")).toEqual({ kind: "sub", sub: true });
    // tello is in a DFC slot of 2-3-1: its DEF line is DFC · DFC (once), then the rest, then back
    const sub = fanItems(L, sq, "tello", true);
    expect(sub.map((i) => i.label)).toEqual(["Central", "Otra posición…", "Volver"]);
    expect(sub[0]).toMatchObject({ kind: "code", code: "DFC", glyph: "DFC", aria: "TELLO juega de central (DFC)", on: false });
    const dfc = applyFan(sub[0], L, sq, "tello");
    expect(dfc).toMatchObject({ kind: "lineup", toast: "TELLO juega de central (DFC) en este siete" });
    expect(dfc.kind === "lineup" && dfc.lineup.playerPositions.tello).toBe("DFC");
    if (dfc.kind === "lineup") expect(fanItems(dfc.lineup, sq, "tello", true)[0].on).toBe(true);
    expect(applyFan(sub[1], L, sq, "tello")).toEqual({ kind: "sub", sub: "otra" });
    expect(applyFan(sub[2], L, sq, "tello")).toEqual({ kind: "sub", sub: false });
    const bench = applyFan(main[5], L, sq, "tello");
    expect(bench).toMatchObject({ kind: "lineup", pick: 2 });
    expect(bench.kind === "lineup" && bench.lineup.slots[2].playerId).toBeNull();
    // «Mover a…» opens the list of the seven's puestos (moving without dragging)
    expect(applyFan(main[6], L, sq, "tello")).toEqual({ kind: "mover" });
    expect(main[6].aria).toBe("Mover a TELLO a otro puesto: elegir de una lista");
    expect(applyFan(main[7], L, sq, "tello")).toEqual({ kind: "ficha" });
  });
  it("Jugar de: his slot's code first, then the rest of its line in this system; his preferida is on", () => {
    const ex = squadOf([...sq.list, cromo("rodri", 16, "MED", { ps: { main: "MC", also: [], line: "MED" } })]);
    // 2-3-1 = POR · DFC · DFC · MI · MC · MD · DC: rodri in MD
    const B = lineupOf(["evans", "illescas", "tello", "huberoski", "eguzquiza", "rodri", "adrian"], "2-3-1", ex);
    const sub = fanItems(B, ex, "rodri", true);
    expect(sub.map((i) => i.code ?? i.kind)).toEqual(["MD", "MI", "MC", "otra", "volver"]);
    expect(sub.filter((i) => i.on).map((i) => i.code)).toEqual(["MC"]);
    // a legacy line override: none of the codes is on
    expect(fanItems({ ...B, playerPositions: { rodri: "DEL" } }, ex, "rodri", true).some((i) => i.on)).toBe(false);
    // the keeper's slot: only POR
    expect(fanItems(B, ex, "evans", true).map((i) => i.code ?? i.kind)).toEqual(["POR", "otra", "volver"]);
    // choosing his preferida clears the override
    const O = { ...B, playerPositions: { rodri: "MI" as const } };
    const mc = applyFan(sub[2], O, ex, "rodri");
    expect(mc.kind === "lineup" && mc.lineup.playerPositions).toEqual({});
  });
  it("«Otra posición…»: all 13 codes grouped by line, «MCD · Pivote», back to Jugar de", () => {
    const all = fanItems(L, sq, "tello", "otra");
    expect(all).toHaveLength(14);
    expect(all.slice(0, 13).map((i) => i.code)).toEqual(["POR", "DFC", "LIB", "LI", "LD", "MCD", "MC", "MI", "MD", "MCO", "EI", "ED", "DC"]);
    expect([...new Set(all.slice(0, 13).map((i) => i.group))]).toEqual(["Porteros", "Defensas", "Medios", "Delanteros"]);
    expect(all[5]).toMatchObject({ kind: "code", label: "MCD · Pivote", aria: "TELLO juega de pivote (MCD)" });
    expect(applyFan(all[13], L, sq, "tello")).toEqual({ kind: "sub", sub: true });
    const piv = applyFan(all[5], L, sq, "tello");
    expect(piv.kind === "lineup" && piv.lineup.playerPositions.tello).toBe("MCD");
  });
  it("keeps its centre inside the app screen", () => {
    expect(fanCentre(10, 10, 390, 844)).toEqual({ cx: 118, cy: 150 });
    expect(fanCentre(380, 840, 390, 844)).toEqual({ cx: 272, cy: 614 });
    expect(fanCentre(200, 400, 390, 844)).toEqual({ cx: 200, cy: 400 });
  });
});

describe("the convocatoria from the official (one source)", () => {
  it("is null when the pitch already is its siete (or it is not known); else the siete + the banquillo keeps the rest called", () => {
    expect(convocatoriaFromBoard(undefined, ["a"])).toBeNull();
    expect(convocatoriaFromBoard({ starters: ["a", "b"], bench: ["c"] }, ["b", null, "a"])).toBeNull();
    expect(convocatoriaFromBoard({ starters: ["a", "b"], bench: ["c", "d"] }, ["a", "c", null])).toEqual({ starters: ["a", "c"], bench: ["d", "b"] });
  });
});

describe("«siete listo» by encaje", () => {
  const xp = (id: string, num: number, main: "POR" | "DFC" | "MC" | "DC", also: ("POR" | "MC")[] = []) =>
    cromo(id, num, main === "POR" ? "POR" : main === "DFC" ? "DEF" : main === "MC" ? "MED" : "DEL", { ps: { main, also, line: main === "POR" ? "POR" : main === "DFC" ? "DEF" : main === "MC" ? "MED" : "DEL" } });
  const sq = squadOf([xp("k", 1, "POR"), xp("d1", 2, "DFC"), xp("d2", 3, "DFC"), xp("m1", 4, "MC"), xp("m2", 5, "MC"), xp("m3", 6, "MC"), xp("f", 9, "DC"), xp("both", 7, "DFC", ["POR"]), cromo("u", 8, undefined)]);
  it("a declared keeper (preferida or también) in goal, or one we know nothing about; never an outfield player", () => {
    expect(isFull(lineupOf(["k", "d1", "d2", "m1", "m2", "m3", "f"], "2-3-1", sq), sq)).toBe(true);
    expect(isFull(lineupOf(["both", "d1", "d2", "m1", "m2", "m3", "f"], "2-3-1", sq), sq)).toBe(true);
    expect(isFull(lineupOf(["u", "d1", "d2", "m1", "m2", "m3", "f"], "2-3-1", sq), sq)).toBe(true);
    expect(isFull(lineupOf(["d1", "k", "d2", "m1", "m2", "m3", "f"], "2-3-1", sq), sq)).toBe(false);
  });
});

describe("Auto-colocar and «Sugerir siete» by encaje (exact positions)", () => {
  // 2-3-1: POR · DFC DFC · MI MC MD · DC
  const x = (id: string, num: number, main: PosCode, also: PosCode[] = [], extra: Partial<Cromo> = {}) => cromo(id, num, lineOf(main), { ps: { main, also, line: lineOf(main) }, ...extra });
  const base = [x("gk", 1, "POR"), x("c1", 2, "DFC", [], { rt: 80 }), x("c2", 3, "DFC", [], { rt: 75 }), x("mi", 4, "MI"), x("mc", 5, "MC"), x("md", 6, "MD")];

  it("Auto-colocar: everyone where he is preferida or también rather than adaptado, even against his form", () => {
    // xa: MC (también MI), 90 · ya: MC, 60 · greedy by form would put xa in MC and ya adaptado in MI
    const sq = squadOf([x("gk", 1, "POR"), x("c1", 2, "DFC"), x("c2", 3, "DFC"), x("xa", 4, "MC", ["MI"], { rt: 90 }), x("ya", 5, "MC", [], { rt: 60 }), x("za", 6, "MD"), x("dc", 9, "DC")]);
    const L = lineupOf(["gk", "dc", "c2", "ya", "za", "xa", "c1"], "2-3-1", sq);
    expect(ids(autoPlace(L, sq))).toEqual(["gk", "c1", "c2", "xa", "ya", "za", "dc"]);
  });
  it("Auto-colocar: from the bench, in place before adaptado, preferida before también, then form", () => {
    const L6 = (sq: ReturnType<typeof squadOf>) => lineupOf(["gk", "c1", "c2", "mi", "mc", "md", null], "2-3-1", sq);
    // ext: EI 99 (adaptado at DC) · d2: DC 60 · d3: DC 80 · d4: MCO también DC 95
    const sq = squadOf([...base, x("ext", 11, "EI", [], { rt: 99 }), x("d2", 12, "DC", [], { rt: 60 }), x("d3", 13, "DC", [], { rt: 80 }), x("d4", 14, "MCO", ["DC"], { rt: 95 })]);
    expect(autoPlace(L6(sq), sq).slots[6].playerId).toBe("d3");
    const s2 = squadOf([...base, x("ext", 11, "EI", [], { rt: 99 }), x("d4", 14, "MCO", ["DC"], { rt: 60 })]);
    expect(autoPlace(L6(s2), s2).slots[6].playerId).toBe("d4");
    // the same bajas, «no voy» and convocatoria as always
    const s3 = squadOf([...base, x("ext", 11, "EI", [], { rt: 50 }), x("hurt", 12, "DC", [], { rt: 99, baja: "Lesionado" }), x("no", 13, "DC", [], { rt: 99, cv: "no" }), x("notcalled", 14, "DC", [], { rt: 99 })]);
    expect(autoPlace(L6(s3), s3, new Set(["gk", "c1", "c2", "mi", "mc", "md", "ext", "hurt", "no"])).slots[6].playerId).toBe("ext");
  });
  it("Auto-colocar: the seven on the pitch stay when they are in place (a better bench never pushes them out)", () => {
    const sq = squadOf([...base, x("dc", 9, "DC", [], { rt: 50 }), x("star", 10, "DC", [], { rt: 99 }), x("c3", 11, "DFC", [], { rt: 99 })]);
    const L = lineupOf(["gk", "c2", "c1", "mi", "mc", "md", "dc"], "2-3-1", sq);
    const n = autoPlace(L, sq);
    expect(ids(n)).toEqual(ids(L));
    // someone out of place on the pitch: a bench player in place takes that slot, and between the
    // three centrales of the pitch for two slots, form decides
    const L2 = lineupOf(["gk", "c2", "c1", "mi", "mc", "md", "c3"], "2-3-1", sq);
    const n2 = autoPlace(L2, sq);
    expect(new Set(ids(n2))).toEqual(new Set(["gk", "c1", "c3", "mi", "mc", "md", "star"]));
    expect(n2.slots[6].playerId).toBe("star");
  });
  it("Auto-colocar: never an outfield player in goal while a keeper is available", () => {
    const sq = squadOf([...base.slice(1), x("dc", 9, "DC", [], { rt: 99 }), x("lib", 10, "LIB", [], { rt: 95 }), x("gk2", 13, "POR", [], { rt: 45 })]);
    const L = lineupOf(["lib", "c1", "c2", "mi", "mc", "md", "dc"], "2-3-1", sq);
    expect(autoPlace(L, sq).slots[0].playerId).toBe("gk2");
    // nobody can keep goal: the seven still get placed
    const noGk = squadOf(base.slice(1).concat([x("dc", 9, "DC"), x("lib", 10, "LIB")]));
    expect(autoPlace(lineupOf(["lib", "c1", "c2", "mi", "mc", "md", "dc"], "2-3-1", noGk), noGk).slots.filter((s) => s.playerId)).toHaveLength(7);
  });

  it("Sugerir siete: a slightly lower-rated player in his preferida over a better one who'd be fuera", () => {
    // cen: DFC 72 (fuera at DC; the two centrales are better) · pun: DC 65
    const sq = squadOf([...base, x("cen", 7, "DFC", [], { rt: 72 }), x("pun", 9, "DC", [], { rt: 65 })]);
    const n = suggestSeven(lineupOf([], "2-3-1", sq), sq);
    expect(ids(n)).toEqual(["gk", "c1", "c2", "mi", "mc", "md", "pun"]);
  });
  it("Sugerir siete: each to his preferida when it costs only a little form (not the best three medios anywhere)", () => {
    // MI MC MD: mc1 MC 95 · mc2 MC 90 (adaptado at MI/MD: 90 + 10 < 80 + 25) · mi MI 80 · md MD 80
    const sq = squadOf([x("gk", 1, "POR"), x("c1", 2, "DFC"), x("c2", 3, "DFC"), x("dc", 9, "DC"), x("mc1", 5, "MC", [], { rt: 95 }), x("mc2", 6, "MC", [], { rt: 90 }), x("mi", 4, "MI", [], { rt: 80 }), x("md", 8, "MD", [], { rt: 80 })]);
    const n = suggestSeven(lineupOf([], "2-3-1", sq), sq);
    expect(ids(n).slice(3, 6)).toEqual(["mi", "mc1", "md"]);
  });
  it("Sugerir siete: between two in place, form still wins", () => {
    const sq = squadOf([...base, x("pun", 9, "DC", [], { rt: 65 }), x("c3", 7, "DFC", [], { rt: 90 })]);
    const n = suggestSeven(lineupOf([], "2-3-1", sq), sq);
    expect(ids(n)).toContain("c3");
    expect(ids(n)).toContain("c1");
    expect(ids(n)).not.toContain("c2");
    expect(n.slots[6].playerId).toBe("pun");
  });
  it("Sugerir siete: a player in place never loses his slot to one out of it (answers, form or familiarity)", () => {
    // DC: pun in place, «Duda», 50 · lat LD, «Voy», 95, fuera at DC (adaptado only in the defence, behind two in place)
    const famLat = (id: string) => (id === "lat" ? 9 : 0);
    const sq = squadOf([...base, x("pun", 9, "DC", [], { rt: 50, cv: "duda" }), x("lat", 10, "LD", [], { rt: 95, cv: "voy" })]);
    expect(suggestSeven(lineupOf([], "2-3-1", sq), sq, [], null, famLat).slots[6].playerId).toBe("pun");
    // adaptado over fuera at any form, familiarity or not: ext EI, «Duda», 45 (adaptado at DC)
    const s2 = squadOf([...base, x("ext", 11, "EI", [], { rt: 45, cv: "duda" }), x("lat", 10, "LD", [], { rt: 95, cv: "voy" })]);
    expect(suggestSeven(lineupOf([], "2-3-1", s2), s2, [], null, famLat).slots[6].playerId).toBe("ext");
  });
  it("Sugerir siete: between two in place, «Voy» before «Duda» at equal form, and the better form at equal answers", () => {
    const s1 = squadOf([...base, x("dd", 9, "DC", [], { rt: 70, cv: "duda", recentMin: 300 }), x("vv", 10, "DC", [], { rt: 70, cv: "voy" })]);
    expect(suggestSeven(lineupOf([], "2-3-1", s1), s1).slots[6].playerId).toBe("vv");
    const s2 = squadOf([...base, x("p1", 9, "DC", [], { rt: 70, recentMin: 300 }), x("p2", 10, "DC", [], { rt: 72 })]);
    expect(suggestSeven(lineupOf([], "2-3-1", s2), s2).slots[6].playerId).toBe("p2");
  });
  it("says whether it placed by encaje: only when someone it can place has an exact outfield position", () => {
    const exact = squadOf([...base, x("pun", 9, "DC")]);
    expect(autoByEncajeOn(lineupOf(["gk"], "2-3-1", exact), exact)).toBe(true);
    expect(sevenByEncajeOn(lineupOf([], "2-3-1", exact), exact)).toBe(true);
    const lines = demoSquad();
    expect(autoByEncajeOn(lineupOf(["evans"], "2-3-1", lines), lines)).toBe(false);
    expect(sevenByEncajeOn(lineupOf([], "2-3-1", lines), lines)).toBe(false);
    // (the only exact one is a baja, or not called: by lines)
    const hurt = squadOf([cromo("gk", 1, "POR"), cromo("d", 2, "DEF"), x("pun", 9, "DC", [], { baja: "Lesionado" })]);
    expect(autoByEncajeOn(lineupOf([], "2-3-1", hurt), hurt)).toBe(false);
    expect(sevenByEncajeOn(lineupOf([], "2-3-1", exact), exact, [], new Set(["gk"]))).toBe(false);
  });
  it("Sugerir siete: a keeper in goal however low his form; the convocatoria's siete still goes first", () => {
    const sq = squadOf([x("gk", 1, "POR", [], { rt: 45 }), ...base.slice(1), x("pun", 9, "DC", [], { rt: 95 }), x("lib", 10, "LIB", [], { rt: 99 }), x("low", 11, "LI", [], { rt: 45 })]);
    const n = suggestSeven(lineupOf([], "2-3-1", sq), sq);
    expect(n.slots[0].playerId).toBe("gk");
    expect(ids(n)).not.toContain("low");
    const own = suggestSeven(lineupOf([], "2-3-1", sq), sq, ["low"]);
    expect(ids(own)).toContain("low");
    expect(own.slots[0].playerId).toBe("gk");
  });
  it("Sugerir siete: «Jugar de» stays only with whoever was on the pitch and still is", () => {
    const sq = squadOf([...base, x("pun", 9, "DC", [], { rt: 65 }), x("bad", 10, "LI", [], { rt: 40 })]);
    const L = { ...lineupOf(["gk", "c1", "c2", "mi", "bad", "md", null], "2-3-1", sq), playerPositions: { mc: "DEL" as const, bad: "MED" as const, c1: "DEF" as const } };
    const n = suggestSeven(L, sq);
    expect(ids(n)).not.toContain("bad");
    expect(n.playerPositions).toEqual({ c1: "DEF" });
  });
});
