// @vitest-environment jsdom
// r14 «La pizarra» · Tableros: what the gallery and Comparar say (pure over the store's selectors).
import { describe, expect, it } from "vitest";
import { fakeBoard, fakeWorld, makeTestStore } from "../../store/testkit";
import type { PzMatch, PzSlot } from "../../store/types";
import { cintaRow, cmpHead, cmpLine, compareItems, defaultPair, itemList, itemOf, playedSlots, resOf, savedOf } from "./tablerosView";

const S = (code: string, x: number, y: number, playerId: string | null): PzSlot => ({ code: code as PzSlot["code"], x, y, playerId });
const nm = (id: string) => id.toUpperCase();

describe("compareItems", () => {
  const A = { formation: "3-2-1", slots: [S("POR", 50, 95, "evans"), S("DFC", 50, 80, "erik"), S("LI", 20, 75, "fer"), S("LD", 80, 75, "jordi"), S("MC", 35, 50, "adrian"), S("MC", 65, 50, "egu"), S("DC", 50, 20, "alcides")] };
  it("pairs who comes in with who goes on the same puesto, and says who moves", () => {
    const B = { formation: "3-2-1", slots: [S("POR", 50, 95, "evans"), S("DFC", 50, 80, "adrian"), S("LI", 20, 75, "illescas"), S("LD", 80, 75, "jordi"), S("MC", 35, 50, "erik"), S("MC", 65, 50, "egu"), S("DC", 50, 20, "alcides")] };
    const c = compareItems(A, B, nm);
    expect(c.ins).toEqual(["illescas"]);
    expect(c.outs).toEqual(["fer"]);
    expect(c.moved.sort()).toEqual(["adrian", "erik"]);
    expect(c.rows[0]).toMatchObject({ k: "LI", t: "FER → ILLESCAS", tag: "Cambio" });
    expect(c.rows.filter((r) => r.tag === "Se mueve")).toHaveLength(2);
    expect(cmpHead(c, B, nm)).toBe("Entra ILLESCAS");
    expect(cmpLine(c, A, B, nm)).toBe("Entra ILLESCAS · sale FER · ADRIAN y ERIK cambian de puesto.");
  });
  it("a different system is a row of its own; an empty spot in B is a «Hueco»", () => {
    const B = { formation: "2-3-1", slots: [S("POR", 50, 95, "evans"), S("DFC", 35, 80, "erik"), S("DFC", 65, 80, "fer"), S("MC", 20, 50, "jordi"), S("MC", 50, 50, "adrian"), S("MC", 80, 50, null), S("DC", 50, 20, "alcides")] };
    const c = compareItems(A, B, nm);
    expect(c.sistema).toBe(true);
    expect(c.rows[0]).toMatchObject({ k: "Sist.", tag: "Sistema", t: "3-2-1 → 2-3-1" });
    expect(c.rows.some((r) => r.tag === "Hueco")).toBe(true);
    expect(c.same).toBe(false);
  });
  it("the same seven, placed the same: nothing to change", () => {
    const c = compareItems(A, A, nm);
    expect(c.same).toBe(true);
    expect(c.rows).toEqual([]);
    expect(cmpHead(c, A, nm)).toBe("Los mismos siete");
    expect(cmpLine(c, A, A, nm)).toBe("Igual colocados: nada que cambiar.");
  });
});

describe("words", () => {
  const M = (o: Partial<PzMatch>): PzMatch => ({ ...fakeWorld().matches[0], ...o });
  it("the match band says the result in words, never colour alone", () => {
    expect(resOf(null)).toMatchObject({ l: "·", w: "Sin partido vinculado" });
    expect(resOf(M({ played: true, gf: 3, ga: 1, phase: "jugado" }))).toMatchObject({ l: "G", w: "Victoria · 3–1", cls: "is-g" });
    expect(resOf(M({ played: true, gf: 1, ga: 1, phase: "jugado" }))).toMatchObject({ l: "E", w: "Empate · 1–1" });
    expect(resOf(M({ played: true, gf: 0, ga: 2, phase: "jugado" }))).toMatchObject({ l: "P", w: "Derrota · 0–2" });
    expect(resOf(M({ phase: "juego", gf: 2, ga: 1 }))).toMatchObject({ l: "J3", w: "En juego · 2–1" });
    expect(resOf(M({})).w).toMatch(/^Por jugar · dom 8 nov · 18:00 · En casa$/);
  });
  it("saved: ahora, hoy, the weekday, the date", () => {
    const now = Date.UTC(2026, 10, 5, 19, 0);
    expect(savedOf(now - 30_000, now)).toBe("ahora");
    expect(savedOf(now - 3_600_000, now)).toBe("hoy 19:00");
    expect(savedOf(now - 2 * 86_400_000, now)).toBe("mar 20:00");
    expect(savedOf(now - 20 * 86_400_000, now)).toBe("vie 16 oct");
    expect(savedOf(0, now)).toBe("");
  });
  it("«mejor» goes to the better side, and to none when equal or unknown", () => {
    expect(cintaRow("Media", 66, 64, "hi")).toMatchObject({ aBest: true, bBest: false });
    expect(cintaRow("Media", 60, 64, "hi")).toMatchObject({ aBest: false, bBest: true });
    expect(cintaRow("Media", 60, 60, "hi")).toMatchObject({ aBest: false, bBest: false });
    expect(cintaRow("Media", null, 60, "hi")).toMatchObject({ a: "—", aBest: false, bBest: false });
  });
});

describe("what Comparar can show", () => {
  const off = fakeBoard({ id: "off", name: "J3 · Red Demons", isOfficial: true, ids: ["evans", "fer", "erik", "jordi", "adrian", "eguzquiza", "alcides"] });
  const mine = fakeBoard({ id: "b1", name: "Mi siete", ownerUid: "u-jordi" });
  const j2: PzMatch = { ...fakeWorld().matches[0], id: "j2", j: 2, rival: "Pitutis", played: true, gf: 3, ga: 8, phase: "jugado", cal: { ...fakeWorld().matches[0].cal, id: "j2", played: true, conv: { starters: ["evans", "fer", "erik", "kevin", "adrian", "eguzquiza", "alcides"], bench: [] } } };
  const W = fakeWorld({ boards: [mine, off], official: { boardId: "off", matchId: "j3" }, matches: [j2, ...fakeWorld().matches] });
  it("the official against the board on screen by default; the address wins when both exist", () => {
    const { P } = makeTestStore({ world: W, boardId: "b1", place: "tableros", sub: "comparar" });
    expect(defaultPair(P, { snaps: {} })).toEqual(["b:off:titular", "b:b1:titular"]);
    const h = makeTestStore({ world: W, boardId: "b1", place: "tableros", sub: "comparar", q: { a: "j:j2", b: "b:off:titular" } });
    expect(defaultPair(h.P, { snaps: {} })).toEqual(["j:j2", "b:off:titular"]);
  });
  it("items: a board's version, the seven that played (on the official's shape), a snapshot; unknown keys are null", () => {
    const { P } = makeTestStore({ world: W, boardId: "b1" });
    expect(itemOf(P, "b:off:titular", { snaps: {} })).toMatchObject({ kind: "board", t: "Oficial · J3 · Red Demons", formation: "3-2-1" });
    expect(itemOf(P, "b:off:planb", { snaps: {} })).toBeNull();
    const j = itemOf(P, "j:j2", { snaps: {} });
    expect(j).toMatchObject({ kind: "match", t: "El siete que jugó · J2", short: "J2 · Pitutis" });
    expect(j?.slots.filter((s) => s.playerId)).toHaveLength(7);
    expect(itemOf(P, "j:j3", { snaps: {} })).toBeNull();
    const snap = { id: "h1", kind: "sistema" as const, label: "Pasa al 3-2-1", entra: [], formation: "3-2-1" as const, freeMode: false, system: "3-2-1", slots: off.lineup.slots.map((s) => ({ playerId: s.playerId ?? null, code: "MC", x: s.x, y: s.y })), roles: {}, takers: {}, tactics: {}, isOfficial: false, at: 0 };
    expect(itemOf(P, "h:b1:h1", { snaps: { b1: [snap] } })).toMatchObject({ kind: "snap", t: "Pasa al 3-2-1" });
    expect(itemOf(P, "h:b1:nope", { snaps: { b1: [snap] } })).toBeNull();
    expect(itemOf(P, "x:y", { snaps: {} })).toBeNull();
    const groups = itemList(P, { snaps: { b1: [snap] } }).map((x) => x.g);
    expect(groups).toContain("El oficial");
    expect(groups).toContain("El siete que jugó");
    expect(groups).toContain("Cómo estaba");
  });
  it("the seven that played keeps the official's players on their spot and fills the rest by fit", () => {
    const off2 = fakeBoard({ id: "o2", isOfficial: true, matchId: "j2", ids: ["evans", "fer", "erik", "jordi", "adrian", "eguzquiza", "alcides"] });
    const { P } = makeTestStore({ world: { ...W, boards: [mine, off2] } });
    const ps = playedSlots(P, j2);
    expect(ps?.slots.map((s) => s.playerId)).toEqual(["evans", "fer", "erik", "kevin", "adrian", "eguzquiza", "alcides"]);
  });
});
