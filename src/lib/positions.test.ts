import { describe, expect, it } from "vitest";
import { LINE_NAMES, POS_CODES, POSITIONS, isPosCode, lineOf, parsePosition, positionLabel } from "./positions";

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
