import { describe, expect, it } from "vitest";
import { LINE_NAMES, POS_CODES, POSITIONS, fitGrade, isPosCode, lineOf, parsePosition, positionLabel, resolvePositions, sanitizePositions } from "./positions";

describe("catálogo de posiciones de fútbol 7", () => {
  it("has the 13 codes, each in its line", () => {
    expect(POS_CODES).toEqual(["POR", "DFC", "LIB", "LI", "LD", "MCD", "MC", "MI", "MD", "MCO", "EI", "ED", "DC"]);
    expect(POS_CODES.map(lineOf)).toEqual(["POR", "DEF", "DEF", "DEF", "DEF", "MED", "MED", "MED", "MED", "MED", "DEL", "DEL", "DEL"]);
  });
  it("puts left on the left and right on the right (team attacking up)", () => {
    expect(POSITIONS.LI.x).toBeLessThan(50);
    expect(POSITIONS.LD.x).toBeGreaterThan(50);
    expect(POSITIONS.EI.x).toBeLessThan(POSITIONS.ED.x);
    expect(POSITIONS.POR.y).toBeGreaterThan(POSITIONS.DC.y);
  });
  it("neighbours are symmetric and never the position itself", () => {
    for (const c of POS_CODES)
      for (const n of POSITIONS[c].neighbours) {
        expect(n).not.toBe(c);
        expect(POSITIONS[n].neighbours).toContain(c);
      }
  });
  it("labels: code, Spanish name, long capitals", () => {
    expect(positionLabel("MCD")).toBe("MCD");
    expect(positionLabel("MCD", "name")).toBe("Pivote");
    expect(positionLabel("MCD", "long")).toBe("PIVOTE");
    expect(LINE_NAMES.MED).toEqual({ name: "Centrocampista", short: "Medio", plural: "Medios" });
  });
  it("isPosCode only accepts the 13 codes", () => {
    expect(isPosCode("MC")).toBe(true);
    expect(isPosCode("mc")).toBe(false);
    expect(isPosCode("MED")).toBe(false);
    expect(isPosCode(3)).toBe(false);
  });
});

describe("parsePosition: whatever was stored, never a guess", () => {
  const cases: [unknown, string | null, string | null][] = [
    ["MC", "MC", "MED"],
    ["mcd", "MCD", "MED"],
    ["Portero", "POR", "POR"],
    ["portera", "POR", "POR"],
    ["Lateral derecho", "LD", "DEF"],
    ["lateral izquierdo", "LI", "DEF"],
    ["Lateral", null, "DEF"],
    ["Defensa central", "DFC", "DEF"],
    ["Central", "DFC", "DEF"],
    ["Líbero", "LIB", "DEF"],
    ["Pivote", "MCD", "MED"],
    ["Mediocentro", "MC", "MED"],
    ["Medio centro", "MC", "MED"],
    ["Mediapunta", "MCO", "MED"],
    ["Interior derecho", "MD", "MED"],
    ["Extremo izquierdo", "EI", "DEL"],
    ["Extremo", null, "DEL"],
    ["Delantero centro", "DC", "DEL"],
    ["Punta", "DC", "DEL"],
    ["DEL", null, "DEL"],
    ["def", null, "DEF"],
    ["Defensa", null, "DEF"],
    ["Centrocampista", null, "MED"],
    ["Delantero", null, "DEL"],
    ["  MED ", null, "MED"],
    ["", null, null],
    ["Banquillo", null, null],
    ["constructor", null, null],
    ["constructor foo", null, null],
    ["toString x", null, null],
    ["__proto__", null, null],
    ["valueOf", null, null],
    ["hasOwnProperty", null, null],
    [null, null, null],
    [7, null, null],
  ];
  for (const [input, code, line] of cases)
    it(`${JSON.stringify(input)} → ${code ?? "—"} / ${line ?? "—"}`, () => {
      expect(parsePosition(input)).toEqual({ code, line });
    });
});

describe("sanitizePositions: a broken map still reads", () => {
  it("keeps valid codes, drops the rest, dedupes, removes main from also, caps at 6", () => {
    expect(sanitizePositions({ main: "MC", also: ["MCD", "MC", "MCD", "XX", 3, "MI", "LD", "LI", "EI", "ED", "DC"] })).toEqual({ main: "MC", also: ["MCD", "MI", "LD", "LI", "EI", "ED"] });
  });
  it("unknown main → null; also not an array → []", () => {
    expect(sanitizePositions({ main: "MED", also: "MC" })).toEqual({ main: null, also: [] });
  });
  it("not an object → null", () => {
    expect(sanitizePositions("MC")).toBeNull();
    expect(sanitizePositions(null)).toBeNull();
  });
});

describe("resolvePositions: new field first, old text as fallback", () => {
  it("uses positions when present (line from main)", () => {
    expect(resolvePositions({ positions: { main: "LD", also: ["MD"] }, naturalPosition: "DEL" })).toEqual({ main: "LD", also: ["MD"], line: "DEF" });
  });
  it("positions without main keeps the old line", () => {
    expect(resolvePositions({ positions: { main: null, also: ["MC"] }, naturalPosition: "Defensa" })).toEqual({ main: null, also: ["MC"], line: "DEF" });
  });
  it("falls back to the old words", () => {
    expect(resolvePositions({ naturalPosition: "Lateral derecho" })).toEqual({ main: "LD", also: [], line: "DEF" });
    expect(resolvePositions({ naturalPosition: "DEL" })).toEqual({ main: null, also: [], line: "DEL" });
    expect(resolvePositions({})).toEqual({ main: null, also: [], line: null });
  });
});

describe("fitGrade", () => {
  const p = { main: "MC" as const, also: ["MCD" as const] };
  it("3 preferida, 2 también, 1 adaptado (same line or neighbour), 0 fuera", () => {
    expect(fitGrade(p, "MC")).toBe(3);
    expect(fitGrade(p, "MCD")).toBe(2);
    expect(fitGrade(p, "MI")).toBe(1); // same line
    expect(fitGrade(p, "DFC")).toBe(1); // neighbour of MCD
    expect(fitGrade(p, "DC")).toBe(0);
  });
  it("goal: only declared counts", () => {
    expect(fitGrade(p, "POR")).toBe(0);
    expect(fitGrade({ main: "POR", also: [] }, "DFC")).toBe(0);
    expect(fitGrade({ main: "DFC", also: ["POR"] }, "POR")).toBe(2);
  });
  it("only a line known: 1 in that line, 0 elsewhere; nothing known: null", () => {
    expect(fitGrade({ main: null, also: [], line: "DEF" }, "LD")).toBe(1);
    expect(fitGrade({ main: null, also: [], line: "DEF" }, "MC")).toBe(0);
    expect(fitGrade({ main: null, also: [], line: null }, "MC")).toBeNull();
  });
});
