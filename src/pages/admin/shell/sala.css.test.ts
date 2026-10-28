import { describe, expect, it } from "vitest";

// B-SH-17: no text of the sala's frame and shared pieces under 11.5 px (legibility in the sun), and nothing of the
// maqueta (the strip, the board's interpolation reset) in the app's CSS. Read from disk as posicionesCss.test does
// (vitest empties `?raw` CSS; the app's tsconfig has no Node types).
type Fs = { readFileSync: (path: string, encoding: "utf8") => string };
const fsModule = "node:fs";
const { readFileSync } = (await import(/* @vite-ignore */ fsModule)) as Fs;
const css = readFileSync("src/pages/admin/shell/sala.css", "utf8"); // vitest runs from the repo root
// (admin.css is generated and pinned by its own test: its one small mark, the tabs' ✓ / !, is raised in admin-app.css)
const admin = readFileSync("src/styles/admin-app.css", "utf8");
const generated = readFileSync("src/styles/admin.css", "utf8");

describe("sala.css", () => {
  it("every font-size is 11.5 px or more", () => {
    const sizes = [...css.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => Number(m[1]));
    expect(sizes.length).toBeGreaterThan(20);
    expect(sizes.filter((s) => s < 11.5)).toEqual([]);
  });
  it("…and so is today's admin CSS, until it goes", () => {
    const tiny = [...admin.matchAll(/font(?:-size)?:\s*(?:[\d]+\s+)?([\d.]+)px/g)].map((m) => Number(m[1])).filter((s) => s < 11.5);
    expect(tiny).toEqual([]);
    const small = [...generated.matchAll(/([^{}]+)\{[^}]*font(?:-size)?:\s*(?:\d+\s+)?([\d.]+)px/g)].filter((m) => Number(m[2]) < 11.5).map((m) => m[1].trim());
    for (const sel of small) expect(admin, sel).toContain(`${sel}{font-size:11.5px}`);
  });
  it("no maqueta pieces", () => {
    expect(css).not.toMatch(/sc-strip|sc-interp|--sc-strip-h/);
  });
});
