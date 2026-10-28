import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// B-SH-17: no text of the sala's frame and shared pieces under 11.5 px (legibility in the sun), and nothing of the
// rejected recipe or the maqueta (the strip, the board's interpolation reset) in the app's CSS.
const css = readFileSync(fileURLToPath(new URL("./sala.css", import.meta.url)), "utf8");

describe("sala.css", () => {
  it("every font-size is 11.5 px or more", () => {
    const sizes = [...css.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => Number(m[1]));
    expect(sizes.length).toBeGreaterThan(20);
    expect(sizes.filter((s) => s < 11.5)).toEqual([]);
  });
  it("no maqueta pieces", () => {
    expect(css).not.toMatch(/sc-strip|sc-interp|--sc-strip-h/);
  });
});
