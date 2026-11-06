// Hoy's carril overrides the kit's .sc-carril (sala.css): the production build loads hoy.css BEFORE sala.css, so a
// one-class `.hy-carril{…}` lost there (six 59 px columns on the phone, «Convocatoria» over «Datos», «Sin mandar»
// over the date) while dev looked right. Every rule on the carril itself must outweigh `.sc-carril`.
import { describe, expect, it } from "vitest";

// Read from disk: vitest runs with `css: false`. node:fs through a typed dynamic import (no Node types in the app).
type Fs = { readFileSync: (path: string, encoding: "utf8") => string };
const fsModule = "node:fs";
const { readFileSync } = (await import(/* @vite-ignore */ fsModule)) as Fs;
const hoy = readFileSync("src/pages/admin/areas/hoy-partidos/hoy.css", "utf8"); // vitest runs from the repo root

const selectors = (css: string) =>
  [...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{/g)]
    .map((m) => m[1].trim())
    .filter((s) => !s.startsWith("@"))
    .flatMap((s) => s.split(",").map((x) => x.trim()));

describe("hoy.css ↔ sala.css cascade", () => {
  it("the carril's own rules carry .sc-carril.hy-carril, whatever order the stylesheets load in", () => {
    const own = selectors(hoy).filter((s) => /\.hy-carril(?=$|:|\{)/.test(s));
    expect(own.length).toBeGreaterThan(4);
    expect(own.filter((s) => !s.startsWith(".sc-carril.hy-carril"))).toEqual([]);
  });
});
