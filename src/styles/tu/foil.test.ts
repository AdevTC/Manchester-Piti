// The carta's shine (tu.css, tc-foil) moves with transform on its own strip instead of animating background-position
// (which repainted the card on every frame): the same tiles in the same place at every moment. The old shine, on the
// card's own box (width W): tiles 260% wide (2.6 W), background-position 130% → -60% (ease, 0–55 %, then held), so
// the tile in place started at (1 - 2.6) W × 1.3 = -2.08 W and ended at (1 - 2.6) W × -0.6 = 0.96 W.
import { describe, expect, it } from "vitest";

type Fs = { readFileSync: (path: string, encoding: "utf8") => string };
const fsModule = "node:fs";
const { readFileSync } = (await import(/* @vite-ignore */ fsModule)) as Fs;
const css = readFileSync("src/styles/tu/tu.css", "utf8"); // vitest runs from the repo root

const rule = css.match(/\.tup \.tc-face--front::after\{([^}]*)\}/)?.[1] ?? "";
// (one line, greedy to its last brace: the last step keeps its own)
const keyframes = css.match(/@keyframes tc-foil\{(.*)\}/)?.[1] ?? "";
/** A `calc(var(--w)*k)` length, in card widths. */
const inW = (s: string | undefined) => Number(s?.match(/^calc\(var\(--w\)\*([-\d.]+)\)$/)?.[1] ?? NaN);

const left = inW(rule.match(/(?:^|;)left:([^;]+)/)?.[1]);
const width = inW(rule.match(/(?:^|;)width:([^;]+)/)?.[1]);
const W = String.raw`calc\(var\(--w\)\*[-\d.]+\)`;
const bg = rule.match(new RegExp(String.raw`linear-gradient\((.*)\) (${W}) 0\/(${W}) 100%;`));
const tileAt = inW(bg?.[2]);
const tile = inW(bg?.[3]);
const steps = [...keyframes.matchAll(new RegExp(String.raw`([\d.,%]+)\{transform:translateX\((${W})\)\}`, "g"))].map((m) => ({ at: m[1], x: inW(m[2]) }));

describe("the carta's shine", () => {
  it("keeps the old gradient, tiles 2.6 cards wide, the same 7 s ease forever", () => {
    expect(bg?.[1]).toBe("115deg,transparent 30%,rgba(255,255,255,.16) 44%,rgba(159,208,242,.14) 50%,transparent 62%");
    expect(tile).toBe(2.6);
    expect(rule).toContain("animation:tc-foil 7s var(--vd-ease) infinite");
    expect(rule).toContain("pointer-events:none");
  });

  it("moves its tiles the way background-position 130% → -60% moved them", () => {
    expect(steps.map((s) => s.at)).toEqual(["0%", "55%,100%"]);
    // where a tile starts on the card, at each step: the strip's left + the tile's offset in it + the move
    const placed = steps.map((s) => left + tileAt + s.x);
    const old = [1.3, -0.6].map((p) => (1 - 2.6) * p);
    placed.forEach((x, i) => expect(x).toBeCloseTo(old[i], 10));
    // still (reduced motion, no animation): background-position 0 → a tile starting at the card's left edge
    expect(left + tileAt).toBeCloseTo(0, 10);
  });

  it("covers the whole card at every point of the way", () => {
    for (const { x } of steps) {
      // (with room to spare: an edge of the strip on the card's edge could leave a hairline where the shine shows)
      expect(left + x).toBeLessThan(-0.02);
      expect(left + width + x).toBeGreaterThan(1.02);
    }
    // (the move is a straight line between the two steps: the ends are the extremes)
    expect(steps).toHaveLength(2);
  });

  it("stays still with reduced motion", () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion:reduce\)\{[^@]*\.tup \.tc-face--front::after[^{]*\{animation:none!important\}/);
  });
});
