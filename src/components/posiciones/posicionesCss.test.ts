// The theme contract of src/styles/posiciones.css, checked on the source (jsdom runs without CSS):
// hosts set the public --pos-* tokens on ANY ancestor, so the stylesheet must only READ them (each with a
// fallback) into private --_pos-* aliases and never declare one itself — a declaration on .pos-map would
// shadow the host's value inherited from a wrapper, [data-theme] or :root.
import { describe, expect, it } from "vitest";

// Read from disk: vitest runs with `css: false`, which empties even `?raw` CSS imports. The app's
// tsconfig has no Node types, so node:fs comes in through a typed dynamic import.
type Fs = { readFileSync: (path: string, encoding: "utf8") => string };
const fsModule = "node:fs";
const { readFileSync } = (await import(/* @vite-ignore */ fsModule)) as Fs;
const css = readFileSync("src/styles/posiciones.css", "utf8"); // vitest runs from the repo root

const declared = (re: RegExp) => [...css.matchAll(re)].map((m) => m[1]);

describe("posiciones.css theme contract", () => {
  it("is loaded as source", () => {
    expect(css).toContain(".pos-map");
  });

  it("never declares a public --pos-* token", () => {
    expect(declared(/(--pos-[\w-]+)\s*:/g)).toEqual([]);
  });

  it("reads every public token with a fallback, into a private alias", () => {
    const reads = [...css.matchAll(/var\((--pos-[\w-]+)(\s*,)?/g)];
    expect(reads.length).toBeGreaterThan(10);
    for (const r of reads) expect(r[2], `${r[1]} needs a fallback`).toBeTruthy();
    for (const line of css.split("\n").filter((l) => /var\(--pos-/.test(l))) expect(line).toMatch(/^\s*--_pos-[\w-]+\s*:/);
  });

  it("defines every private alias it reads without a fallback (--_pos-shift comes inline from the component)", () => {
    const defined = new Set(declared(/(--_pos-[\w-]+)\s*:/g));
    const used = new Set([...css.matchAll(/var\((--_pos-[\w-]+)\)/g)].map((m) => m[1]));
    expect(used.size).toBeGreaterThan(5);
    for (const u of used) expect(defined, u).toContain(u);
  });

  it("keeps the forced-colors ring only for keyboard focus", () => {
    expect(css).toMatch(/button\.pos-spot:focus-visible\s*\{[^}]*outline:\s*2px solid transparent/);
  });
});
