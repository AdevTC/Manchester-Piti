import { describe, expect, it } from "vitest";
import { campoLayout, GAP_X, GAP_Y, SOURCE_TEXT, systemMark, systemText, toPitch, type CampoDot } from "./campoPositions";
import { F7_SPOTS } from "../../lib/ficha";
import { playedLinesOf, topPlayedCode } from "../../lib/playedSummary";
import type { PosCode } from "../../lib/positions";
import { SYSTEMS_CATALOGUE } from "../../lib/formations";

// The Campo after the acta (C3): each starter where he played most, on the system's spot for that code;
// a substitute who played elsewhere than the slot he took gets a ring of his own; without codes, the
// orientative 1-3-2-1 of always. Before the acta (members): the official board's slot codes.
type Played = Partial<Record<PosCode, number>>;
const row = (pp: Played | undefined, o: { started?: boolean; estimated?: boolean; inFor?: string; at?: number } = {}) => ({
  played: true,
  started: o.started ?? true,
  exchanges: o.inFor ? [{ minute: o.at ?? 25, with: o.inFor, direction: "in" as const }] : [],
  ...(pp ? { positionsPlayed: pp } : {}),
  ...(o.estimated ? { positionsEstimated: true as const } : {}),
});
const SEVEN = ["g", "a", "b", "c", "d", "e", "f"];
const at = (dots: CampoDot[], id: string) => dots.find((d) => d.id === id)!;
const xy = (d: CampoDot) => [d.x, d.y];
const touching = (dots: CampoDot[]) => dots.flatMap((p, i) => dots.slice(i + 1).filter((q) => Math.abs(p.x - q.x) < GAP_X && Math.abs(p.y - q.y) < GAP_Y).map((q) => `${p.id}~${q.id}`));
// a 2-3-1 as the official board and the acta store it (60′ each)
const clasico = () => ({
  g: row({ POR: 60 }),
  a: row({ DFC: 60 }),
  b: row({ DFC: 60 }),
  c: row({ MI: 60 }),
  d: row({ MC: 60 }),
  e: row({ MD: 60 }),
  f: row({ DC: 35 }),
});

describe("playedLinesOf / topPlayedCode", () => {
  it("most minutes first, ties in catalogue order; junk ignored", () => {
    expect(playedLinesOf({ MC: 20, DFC: 20, DC: 5, ZZ: 99, LI: 0, MD: "7" })).toEqual([
      { code: "DFC", minutes: 20 },
      { code: "MC", minutes: 20 },
      { code: "DC", minutes: 5 },
    ]);
    expect(topPlayedCode({ MC: 30.5, DFC: 30 })).toBe("MC");
    expect(topPlayedCode(undefined)).toBeNull();
    expect(topPlayedCode({})).toBeNull();
  });
});

describe("systemText / systemMark", () => {
  it("«2-3-1 · Clásico», «Libre · sin sistema fijo», nothing without a known system", () => {
    expect(systemText("2-3-1")).toBe("2-3-1 · Clásico");
    expect(systemText("1-3-1-1")).toBe("1-3-1-1 · Escalera");
    expect(systemText("libre")).toBe("Libre · sin sistema fijo");
    expect(systemText(null)).toBeNull();
    expect(systemText(undefined)).toBeNull();
    expect(systemText("5-5")).toBeNull();
    expect(systemMark("3-2-1")).toBe("3-2-1");
    expect(systemMark("libre")).toBe("Libre");
    expect(systemMark(null)).toBeNull();
  });
  it("the copy of each source", () => {
    expect(SOURCE_TEXT.board).toBe("Posiciones de la pizarra oficial");
    expect(SOURCE_TEXT.estimated).toBe("Posiciones estimadas por su preferida");
    expect(SOURCE_TEXT.orientative).toBe("Posiciones orientativas");
  });
});

describe("campoLayout", () => {
  it("places each starter by his code on the system's spot (the two centrales left and right)", () => {
    const { dots, source } = campoLayout({ field: SEVEN, ledger: clasico(), system: "2-3-1" });
    expect(source).toBe("board");
    expect(xy(at(dots, "g"))).toEqual(toPitch(50, 95));
    expect(xy(at(dots, "a"))).toEqual(toPitch(30, 74));
    expect(xy(at(dots, "b"))).toEqual(toPitch(70, 74));
    expect(xy(at(dots, "c"))).toEqual(toPitch(17, 49));
    expect(xy(at(dots, "f"))).toEqual(toPitch(50, 22));
    expect(dots.map((d) => d.code)).toEqual(["POR", "DFC", "DFC", "MI", "MC", "MD", "DC"]);
    expect(dots.every((d) => !d.sub && !d.estimated)).toBe(true);
    expect(touching(dots)).toEqual([]);
  });

  it("a starter goes where he played most, even off his slot's order", () => {
    const ledger = { ...clasico(), d: row({ MC: 10, MCO: 50 }) };
    const { dots } = campoLayout({ field: SEVEN, ledger, system: "2-3-1" });
    // no MCO in a 2-3-1: the catalogue's MCO
    expect(at(dots, "d").code).toBe("MCO");
    expect(xy(at(dots, "d"))).toEqual(toPitch(50, 34));
  });

  it("no system (libre, or no board): the catalogue's points; two at one code stand side by side", () => {
    const { dots } = campoLayout({ field: SEVEN, ledger: clasico(), system: "libre" });
    const [cx, cy] = toPitch(50, 76);
    expect(at(dots, "a").y).toBe(cy);
    expect(at(dots, "b").y).toBe(cy);
    expect(at(dots, "a").x).toBe(cx - GAP_X / 2);
    expect(at(dots, "b").x).toBe(cx + GAP_X / 2);
    expect(touching(dots)).toEqual([]);
  });

  it("a crowded centre line never puts a name on another (POR, LIB, DFC, MCD, MC, MCO, DC)", () => {
    const codes: PosCode[] = ["POR", "LIB", "DFC", "MCD", "MC", "MCO", "DC"];
    const ledger = Object.fromEntries(SEVEN.map((id, i) => [id, row({ [codes[i]]: 50 })]));
    const { dots } = campoLayout({ field: SEVEN, ledger, system: null });
    expect(touching(dots)).toEqual([]);
    for (const d of dots) {
      expect(d.x).toBeGreaterThanOrEqual(9);
      expect(d.x).toBeLessThanOrEqual(91);
      expect(d.y).toBeGreaterThanOrEqual(8);
      expect(d.y).toBeLessThanOrEqual(88);
    }
  });

  it("estimated by the preferida: all → estimated, some → mixed", () => {
    const all = Object.fromEntries(Object.entries(clasico()).map(([id, r]) => [id, { ...r, positionsEstimated: true as const }]));
    expect(campoLayout({ field: SEVEN, ledger: all, system: null }).source).toBe("estimated");
    const some = { ...clasico(), c: row({ MI: 60 }, { estimated: true }) };
    const mixed = campoLayout({ field: SEVEN, ledger: some, system: "2-3-1" });
    expect(mixed.source).toBe("mixed");
    expect(at(mixed.dots, "c").estimated).toBe(true);
  });

  it("no position data (old actas, no ledger, live): the orientative 1-3-2-1 by slot", () => {
    const old = Object.fromEntries(SEVEN.map((id) => [id, row(undefined)]));
    for (const ledger of [old, undefined, null]) {
      const r = campoLayout({ field: SEVEN, ledger, system: "2-3-1" });
      expect(r.source).toBe("orientative");
      expect(r.dots.map(xy)).toEqual(F7_SPOTS);
      expect(r.dots.every((d) => d.code === null && !d.sub)).toBe(true);
    }
    // an empty slot keeps its place (the live field after a red card)
    const r = campoLayout({ field: ["g", null, "b"], ledger: null });
    expect(r.dots.map((d) => [d.id, d.x, d.y])).toEqual([
      ["g", ...F7_SPOTS[0]],
      ["b", ...F7_SPOTS[2]],
    ]);
  });

  it("a starter without a code takes the spot the system left free; the copy says some are orientative", () => {
    const ledger = { ...clasico(), e: row(undefined) };
    const { dots, source } = campoLayout({ field: SEVEN, ledger, system: "2-3-1" });
    expect(source).toBe("partial");
    expect(SOURCE_TEXT.partial).toBe("Algunas posiciones, orientativas");
    expect(at(dots, "e").code).toBeNull();
    expect(xy(at(dots, "e"))).toEqual(toPitch(83, 49));
  });

  it("every system's seven stands on its own spots, untouched (no two names touch)", () => {
    for (const sys of SYSTEMS_CATALOGUE) {
      const ledger = Object.fromEntries(SEVEN.map((id, i) => [id, row({ [sys.spots[i][0]]: 50 })]));
      const { dots } = campoLayout({ field: SEVEN, ledger, system: sys.id });
      expect(dots.map(xy), sys.id).toEqual(sys.spots.map(([, u, v]) => toPitch(u, v)));
      expect(touching(dots), sys.id).toEqual([]);
    }
  });

  it("substitutes: on the pitch only when they played elsewhere than the slot they took, as a ring", () => {
    const ledger = {
      ...clasico(),
      // inherited the punta's slot: the bench list says it, not the pitch
      h: row({ DC: 25 }, { started: false, inFor: "f", at: 35 }),
      // came on for the punta h but played extremo izquierdo: his own dot, at that position
      i: row({ EI: 20 }, { started: false, inFor: "h", at: 40 }),
      // a chain: came on for i, at i's code
      j: row({ EI: 5 }, { started: false, inFor: "i", at: 55 }),
      // on the bench, never played
      k: { played: false, started: false, exchanges: [] },
    };
    const { dots } = campoLayout({ field: SEVEN, ledger, system: "2-3-1" });
    expect(dots.filter((d) => d.sub).map((d) => [d.id, d.code])).toEqual([["i", "EI"]]);
    expect(xy(at(dots, "i"))).toEqual(toPitch(16, 22));
    expect(dots.map((d) => d.id)).not.toContain("h");
    expect(dots.map((d) => d.id)).not.toContain("j");
    expect(dots.map((d) => d.id)).not.toContain("k");
    expect(touching(dots)).toEqual([]);
  });

  it("a full midfield: the substitute still gets a place of his own, near his position and on the pitch", () => {
    const ledger = { ...clasico(), i: row({ MCD: 20 }, { started: false, inFor: "d", at: 40 }) };
    const { dots } = campoLayout({ field: SEVEN, ledger, system: "2-3-1" });
    const i = at(dots, "i");
    const [bx, by] = toPitch(50, 62);
    expect(i.sub).toBe(true);
    expect(dots.filter((d) => d !== i).some((d) => d.x === i.x && d.y === i.y)).toBe(false);
    expect(Math.abs(i.x - bx)).toBeLessThanOrEqual(1.5 * GAP_X);
    expect(Math.abs(i.y - by)).toBeLessThanOrEqual(1.5 * GAP_Y);
  });

  it("a substitute at a starter's code (starter + replacement) is offset beside him, never on his name", () => {
    const ledger = { ...clasico(), h: row({ DC: 25 }, { started: false, inFor: "e", at: 35 }) };
    const { dots } = campoLayout({ field: SEVEN, ledger, system: "2-3-1" });
    const h = at(dots, "h");
    expect(h.sub).toBe(true);
    expect(h.y).toBe(at(dots, "f").y);
    expect(Math.abs(h.x - at(dots, "f").x)).toBe(GAP_X);
    expect(touching(dots)).toEqual([]);
  });

  it("before the acta: the official board's codes and system, no substitutes", () => {
    const codes: Record<string, PosCode> = { g: "POR", a: "LI", b: "DFC", c: "LD", d: "MC", e: "MC", f: "DC" };
    const { dots, source } = campoLayout({ field: SEVEN, codes, system: "3-2-1" });
    expect(source).toBe("board");
    expect(xy(at(dots, "a"))).toEqual(toPitch(18, 72));
    expect(xy(at(dots, "d"))).toEqual(toPitch(25, 46));
    expect(xy(at(dots, "e"))).toEqual(toPitch(75, 46));
    expect(dots.some((d) => d.estimated || d.sub)).toBe(false);
  });
});
