// The cromo on the pitch speaks by exact position: it prints the slot's code, a fit mark when the player's
// positions are known, and with someone in the hand every target lights by how well he would fit there.
import { describe, expect, it } from "vitest";
import type { PosCode, ResolvedPositions } from "../../../lib/positions";
import { lineOf } from "../../../lib/positions";
import type { Lineup } from "../formations";
import { chem } from "./quimica";
import { cromo, lineupOf, squadOf } from "./testkit";
import { FIT_GLYPH, FIT_WORDS, FX0, pitchView, type PitchArgs } from "./view";

const ps = (main: PosCode | null, ...also: PosCode[]): ResolvedPositions => ({ main, also, line: main ? lineOf(main) : null });
const withPs = (id: string, num: number, main: PosCode | null, ...also: PosCode[]) => cromo(id, num, main ? lineOf(main) : undefined, { ps: ps(main, ...also) });

// 2-3-1 = POR · DFC · DFC · MI · MC · MD · DC
const sq = squadOf([
  withPs("gk", 1, "POR"),
  withPs("cen", 2, "DFC"),
  withPs("tamb", 3, "LI", "DFC"),
  withPs("adap", 4, "MC"),
  withPs("fuera", 5, "DC"),
  cromo("linea", 6, "MED"),
  cromo("nada", 7, undefined),
  cromo("lindef", 8, "DEF"),
  withPs("banca", 9, "MCD", "MC"),
]);
const SEVEN = ["gk", "cen", "tamb", "adap", "fuera", "linea", "nada"];

const view = (L: Lineup, o: Partial<PitchArgs> = {}) =>
  pitchView({ L, sq, ch: chem(L, sq), cam: "tv", modo: "editar", fx: FX0, selId: null, pick: null, ro: false, rm: false, meId: null, ...o });
const card = (v: ReturnType<typeof view>, id: string) => {
  const c = v.cards.find((x) => x.id === id);
  if (!c) throw new Error("no card " + id);
  return c;
};

describe("the cromo prints the slot's exact position and how well he fits", () => {
  const v = view(lineupOf(SEVEN, "2-3-1", sq));

  it("prints the slot code, not the line", () => {
    expect(v.cards.map((c) => c.zoneTxt)).toEqual(["POR", "DFC", "DFC", "MI", "DC›MC", "MD", "DC"]);
  });

  it("grades: preferida 3, también 2, adaptado 1, fuera 0; a line alone or nothing known is no mark", () => {
    expect(SEVEN.map((id) => card(v, id).fit)).toEqual([3, 3, 2, 1, 0, null, null]);
  });

  it("is out of position only on grade 0", () => {
    expect(SEVEN.filter((id) => card(v, id).oop)).toEqual(["fuera"]);
    expect(card(v, "fuera").cls.split(" ")).toContain("oop");
    expect(card(v, "adap").cls.split(" ")).not.toContain("oop");
  });

  it("says the fit in words on the cromo's label", () => {
    expect(card(v, "gk").aria).toContain("GK, dorsal 1, POR, en su posición,");
    expect(card(v, "tamb").aria).toContain("DFC, también juega aquí,");
    expect(card(v, "adap").aria).toContain("MI, adaptado,");
    expect(card(v, "fuera").aria).toContain("MC, fuera de su posición (natural DC),");
    expect(card(v, "linea").aria).toMatch(/^LINEA, dorsal 6, MD, forma/);
    expect(card(v, "nada").aria).toMatch(/^NADA, dorsal 7, DC, forma/);
  });

  it("the marks follow the table: ✓ también · ~ adaptado · ! fuera, none for preferida", () => {
    expect(FIT_GLYPH).toEqual({ 3: "", 2: "✓", 1: "~", 0: "!" });
    expect(FIT_WORDS).toEqual({ 3: "en su posición", 2: "también juega aquí", 1: "adaptado", 0: "fuera de su posición" });
  });

  it("a line-only player out of his line keeps the old «nat›slot», now with the slot code", () => {
    const w = view(lineupOf(["gk", "cen", "tamb", "adap", "lindef", "linea", "nada"], "2-3-1", sq));
    expect(card(w, "lindef")).toMatchObject({ zoneTxt: "DEF›MC", oop: true, fit: 0 });
  });

  it("an outfield player in goal is out of position", () => {
    const w = view(lineupOf(["cen", "gk"], "2-3-1", sq));
    expect(card(w, "cen")).toMatchObject({ zoneTxt: "DFC›POR", oop: true, fit: 0 });
    expect(card(w, "gk")).toMatchObject({ zoneTxt: "POR›DFC", oop: true, fit: 0 });
  });

  it("a per-board «Jugar de» on the slot's line counts as también; on another line, fuera", () => {
    const L = { ...lineupOf(SEVEN, "2-3-1", sq), playerPositions: { linea: "MED" as const, fuera: "MED" as const, cen: "DEL" as const } };
    const w = view(L);
    expect(card(w, "linea")).toMatchObject({ fit: 2, oop: false, zoneTxt: "MD" });
    expect(card(w, "fuera")).toMatchObject({ fit: 2, oop: false, zoneTxt: "MC" });
    expect(card(w, "cen")).toMatchObject({ fit: 0, oop: true, zoneTxt: "DEL›DFC" });
  });

  it("free mode prints the nearest catalogue position", () => {
    const base = lineupOf(SEVEN, "2-3-1", sq);
    const L = { ...base, freeMode: true, slots: base.slots.map((s, i) => (i === 2 ? { ...s, x: 14, y: 70 } : s)) };
    expect(card(view(L), "tamb")).toMatchObject({ zoneTxt: "LI", fit: 3 });
  });
});

describe("the hand lights each target by the held player's fit", () => {
  // the bench player «banca» (MCD, también MC) in the hand; slots 3 (MI) and 6 (DC) empty
  const L = lineupOf(["gk", "cen", "tamb", null, "adap", "linea", null], "2-3-1", sq);
  const g = (cls: string) => cls.split(" ").find((k) => k.startsWith("pzp-g")) ?? "";

  it("a bench player in the hand: each occupied target and each empty slot gets his grade there", () => {
    const v = view(L, { hand: { k: "b", id: "banca" } });
    // POR 0 · DFC 1 (neighbour of MCD) · DFC 1 · MC 2 · MD 1
    expect(v.cards.map((c) => [c.id, g(c.cls)])).toEqual([
      ["gk", "pzp-g0"],
      ["cen", "pzp-g1"],
      ["tamb", "pzp-g1"],
      ["adap", "pzp-g2"],
      ["linea", "pzp-g1"],
    ]);
    expect(v.slots.map((s) => [s.lab, s.cls])).toEqual([
      ["MI", "pzp-g1"],
      ["DC", "pzp-g0"],
    ]);
    expect(card(v, "adap").aria).toContain("(para BANCA: también juega aquí)");
    expect(v.slots[1].aria).toBe("Hueco DC vacío: toca para elegir jugador. Para BANCA: fuera de su posición");
  });

  it("a pitch player in the hand: every other cromo and the empty slots, never himself", () => {
    const v = view(L, { hand: { k: "p", id: "gk" } });
    expect(g(card(v, "gk").cls)).toBe("");
    expect(v.cards.filter((c) => c.id !== "gk").every((c) => g(c.cls) === "pzp-g0")).toBe(true);
    expect(v.slots.every((s) => s.cls === "pzp-g0")).toBe(true);
  });

  it("nothing known about the held player (or only his line, on it): no tint", () => {
    const v = view(L, { hand: { k: "p", id: "linea" } });
    // linea is MED by line only: MI / MC are unknown, other lines are fuera
    expect(v.slots.map((s) => s.cls)).toEqual(["", "pzp-g0"]);
    expect(g(card(v, "adap").cls)).toBe("");
    const n = view(L, { hand: { k: "p", id: "nada" } });
    expect(n.slots.map((s) => s.cls)).toEqual(["", ""]);
  });

  it("no hand: no tint and the slots' label as before", () => {
    const v = view(L);
    expect(v.cards.every((c) => g(c.cls) === "")).toBe(true);
    expect(v.slots.map((s) => [s.cls, s.aria])).toEqual([
      ["", "Hueco MI vacío: toca para elegir jugador"],
      ["", "Hueco DC vacío: toca para elegir jugador"],
    ]);
  });
});
