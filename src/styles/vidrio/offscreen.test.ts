// The long screens' blocks under the first screen (Tabla's side, the match's charts and El siete's bench and cameras,
// the places of Estadísticas) skip style, layout and paint while off the screen (content-visibility:auto), so a View
// Transition does not capture them whole. Each keeps the size it last had (contain-intrinsic-size:auto …), so coming
// back up never jumps, and none of them is a region or a morph of the choreography (it would be captured empty).
import { describe, expect, it } from "vitest";

type Fs = { readFileSync: (path: string, encoding: "utf8") => string };
const fsModule = "node:fs";
const { readFileSync } = (await import(/* @vite-ignore */ fsModule)) as Fs;
const files = ["src/styles/partidos-vidrio.css", "src/components/celeste/stats-charts.css", "src/pages/match/partido/siete-acta.css", "src/styles/palco/palco.css"]; // vitest runs from the repo root
const rules = files.flatMap((f) =>
  [...readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*content-visibility:auto[^{}]*)\}/g)].map((m) => ({ f, sel: m[1].trim(), body: m[2] })),
);

describe("the blocks off the first screen", () => {
  it("are there in each long screen", () => {
    expect(new Set(rules.map((r) => r.f)).size).toBe(files.length);
  });

  it("remember their last size", () => {
    for (const r of rules) expect(r.body, r.sel).toMatch(/contain-intrinsic-size:auto \d+px/);
  });

  it("are never a region or a morph of the choreography", () => {
    for (const r of rules) expect(r.sel, r.sel).not.toMatch(/vd-reg|vd-morph|pa-screen|pp-screen|nx-place\s*\{/);
  });
});
