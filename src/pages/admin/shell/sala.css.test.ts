import { describe, expect, it } from "vitest";

// B-SH-17: no text of the sala's frame and shared pieces under 11.5 px (legibility in the sun), and nothing of the
// maqueta (the strip, the board's interpolation reset) in the app's CSS. Read from disk as posicionesCss.test does
// (vitest empties `?raw` CSS; the app's tsconfig has no Node types).
type Fs = { readFileSync: (path: string, encoding: "utf8") => string };
const fsModule = "node:fs";
const { readFileSync } = (await import(/* @vite-ignore */ fsModule)) as Fs;
const css = readFileSync("src/pages/admin/shell/sala.css", "utf8"); // vitest runs from the repo root
const layout = readFileSync("src/pages/admin/shell/AdminLayout.tsx", "utf8");

describe("sala.css", () => {
  it("every font-size is 11.5 px or more", () => {
    const sizes = [...css.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => Number(m[1]));
    expect(sizes.length).toBeGreaterThan(20);
    expect(sizes.filter((s) => s < 11.5)).toEqual([]);
  });
  it("the sala is Vidrio alone: no admin v2 CSS, no `.adm` root, none of its variables", () => {
    expect(layout).not.toMatch(/styles\/admin(-app)?\.css/);
    expect(layout).not.toMatch(/\badm\b/);
    expect(css).not.toMatch(/\.adm\b/);
    // (the v2 frame's own variables: whatever still reads one gets a Vidrio token instead)
    expect(css).not.toMatch(/var\(--(red|amber|panel2?|pline|deep|shirt|led|glass|wall|wall-line|railbar|pegdot|sheet|pop|scrim|stick)[,)]/);
  });
  it("no maqueta pieces", () => {
    expect(css).not.toMatch(/sc-strip|sc-interp|--sc-strip-h/);
  });
});
