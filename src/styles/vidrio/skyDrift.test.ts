// The light field's drift (sky.css) runs in small steps instead of every frame: the same path as the old
// `46s ease-in-out` (translate3d(-1.2%,0,0) scale(1.02) → translate3d(1.2%,-.8%,0) scale(1.04)), so the screen is
// redrawn ~8 times a second instead of at the display's rate.
import { describe, expect, it } from "vitest";

type Fs = { readFileSync: (path: string, encoding: "utf8") => string };
const fsModule = "node:fs";
const { readFileSync } = (await import(/* @vite-ignore */ fsModule)) as Fs;
const css = readFileSync("src/styles/vidrio/sky.css", "utf8"); // vitest runs from the repo root

/** CSS ease-in-out (cubic-bezier(.42,0,.58,1)) at x. */
function easeInOut(x: number): number {
  const b = (p1: number, p2: number, t: number) => 3 * (1 - t) * (1 - t) * t * p1 + 3 * (1 - t) * t * t * p2 + t * t * t;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 50; i++) {
    const m = (lo + hi) / 2;
    if (b(0.42, 0.58, m) < x) lo = m;
    else hi = m;
  }
  return b(0, 1, (lo + hi) / 2);
}

const frames = [...(css.match(/@keyframes vd-drift\{(.*)\}\}/)?.[1] ?? "").matchAll(/([\d.]+)%\{transform:translate3d\(([-\d.]+)%,([-\d.]+)%,0\) scale\(([\d.]+)\)/g)].map((m) => ({
  at: Number(m[1]) / 100,
  x: Number(m[2]),
  y: Number(m[3]),
  s: Number(m[4]),
}));

describe("the sky's drift", () => {
  it("runs in steps, 46 s each way", () => {
    expect(css).toMatch(/\.vd-sky--drift \.vd-sky__drift\{animation:vd-drift 46s steps\(16,end\) infinite alternate\}/);
  });

  it("keeps the old ease-in-out path from the first point to the last", () => {
    expect(frames).toHaveLength(25);
    expect(frames[0]).toEqual({ at: 0, x: -1.2, y: 0, s: 1.02 });
    expect(frames.at(-1)).toEqual({ at: 1, x: 1.2, y: -0.8, s: 1.04 });
    for (const f of frames) {
      const e = easeInOut(f.at);
      expect(f.x).toBeCloseTo(-1.2 + 2.4 * e, 3);
      expect(f.y).toBeCloseTo(-0.8 * e, 3);
      expect(f.s).toBeCloseTo(1.02 + 0.02 * e, 4);
    }
  });

  it("still pauses off screen and stops under reduced motion", () => {
    expect(css).toContain(".vd-sky--drift .vd-sky__drift[data-vd-off]{animation-play-state:paused}");
    expect(css).toMatch(/prefers-reduced-motion:reduce\)\{\.vd-sky__drift\{animation:none!important\}/);
  });
});
