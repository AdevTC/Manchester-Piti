import { describe, expect, it } from "vitest";
import { effectiveAnalysis, mirrorsLegacy, storedAnalysis, withAnalysis } from "../../functions/src/analysisPlaceLogic";
import { canonical, planMove } from "../../functions/src/analysisMoveLogic";
import type { NarratedAnalysis } from "../../functions/src/narrated/types";

const analysis = (revision: number, ids: string[] = ["o1"]) =>
  ({ version: 2, revision, profile: { periodMinutes: [25, 25] }, observations: ids.map((id, order) => ({ id, kind: "pass", team: "us", order, facts: {} })), coverage: [] }) as unknown as NarratedAnalysis;

describe("el análisis narrado en su sitio (matchAnalysis/{id})", () => {
  it("storedAnalysis lee el documento de su sitio, y nada si no lleva un análisis", () => {
    const a = analysis(2);
    expect(storedAnalysis({ analysis: a })).toBe(a);
    expect(storedAnalysis(undefined)).toBeUndefined();
    expect(storedAnalysis({ analysis: { revision: 3 } })).toBeUndefined();
  });

  it("durante el traslado vale el de revisión más alta; empatados, el de su sitio; solo uno, ese", () => {
    const placed = analysis(3);
    const legacy = analysis(3, ["o2"]);
    expect(effectiveAnalysis(placed, legacy)).toBe(placed);
    // (una función de antes del traslado escribió el campo viejo después de la copia)
    const later = analysis(4);
    expect(effectiveAnalysis(placed, later)).toBe(later);
    expect(effectiveAnalysis(undefined, legacy)).toBe(legacy);
    expect(effectiveAnalysis(placed, undefined)).toBe(placed);
    expect(effectiveAnalysis(undefined, { revision: 9 })).toBeUndefined();
  });

  it("withAnalysis devuelve el mismo partido si no cambia nada, y el análisis de su sitio si no lo lleva", () => {
    const a = analysis(1);
    const match = { id: "m1", rival: "Atleti", analysis: a };
    expect(withAnalysis(match, undefined)).toBe(match);
    expect(withAnalysis(match, a)).toBe(match);
    const bare = { id: "m2", rival: "Betis" };
    const merged = withAnalysis(bare as { id: string; rival: string; analysis?: unknown }, a);
    expect(merged).toEqual({ id: "m2", rival: "Betis", analysis: a });
    expect(bare).not.toHaveProperty("analysis");
  });

  it("el partido conserva una copia solo mientras aún tiene el campo viejo", () => {
    expect(mirrorsLegacy({ analysis: analysis(1) })).toBe(true);
    expect(mirrorsLegacy({ rival: "x" } as { analysis?: unknown })).toBe(false);
    expect(mirrorsLegacy(undefined)).toBe(false);
  });
});

describe("el traslado (functions/scripts/migrate-analysis.mjs)", () => {
  it("paso 1: copia donde falta o es más antiguo; nunca pisa uno más nuevo; un campo raro no se copia", () => {
    expect(planMove("copiar", analysis(2), undefined)).toBe("copiar");
    expect(planMove("copiar", analysis(2), { analysis: analysis(1) })).toBe("copiar");
    expect(planMove("copiar", analysis(2), { analysis: analysis(2) })).toBe("nada");
    expect(planMove("copiar", analysis(2), { analysis: analysis(3) })).toBe("nada");
    expect(planMove("copiar", undefined, undefined)).toBe("nada");
    expect(planMove("copiar", { revision: 1 }, undefined)).toBe("nada");
  });

  it("paso 2: quita el campo solo si su sitio ya lo tiene igual o más nuevo", () => {
    expect(planMove("quitar", analysis(2), { analysis: analysis(2) })).toBe("quitar");
    expect(planMove("quitar", analysis(2), { analysis: analysis(5) })).toBe("quitar");
    expect(planMove("quitar", analysis(2), undefined)).toBe("falta copiar");
    expect(planMove("quitar", analysis(3), { analysis: analysis(2) })).toBe("falta copiar");
    // (misma revisión, otro contenido: no es la misma copia)
    expect(planMove("quitar", analysis(2, ["o1", "o2"]), { analysis: analysis(2) })).toBe("falta copiar");
    expect(planMove("quitar", undefined, { analysis: analysis(2) })).toBe("nada");
  });

  it("canonical compara sin importar el orden de las claves", () => {
    expect(canonical({ b: 1, a: [{ d: 2, c: 3 }] })).toBe(canonical({ a: [{ c: 3, d: 2 }], b: 1 }));
    expect(canonical({ a: 1 })).not.toBe(canonical({ a: 2 }));
  });
});
