// The theme contract of src/styles/posiciones.css, checked on the source (jsdom runs without CSS):
// hosts set the public --pos-* tokens on ANY ancestor, so the stylesheet must only READ them (each with a
// fallback) into private --_pos-* aliases and never declare one itself — a declaration on .pos-map would
// shadow the host's value inherited from a wrapper, [data-theme] or :root.
import { describe, expect, it } from "vitest";
import { INLINE_VARS } from "./mapaNav";

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

  it("defines every private alias it reads without a fallback, except the ones the component sets inline (geometry, per-spot)", () => {
    const defined = new Set([...declared(/(--_pos-[\w-]+)\s*:/g), ...INLINE_VARS]);
    const used = new Set([...css.matchAll(/var\((--_pos-[\w-]+)\)/g)].map((m) => m[1]));
    expect(used.size).toBeGreaterThan(5);
    for (const u of used) expect(defined, u).toContain(u);
  });

  it("draws badges, pills, rings and disc sizes from the inline geometry, not literals", () => {
    for (const v of ["--_pos-badge", "--_pos-badge-top", "--_pos-badge-side", "--_pos-pill-h", "--_pos-pill-w", "--_pos-pill-into", "--_pos-pill-beside", "--_pos-pill-low", "--_pos-ring", "--_pos-disc-min", "--_pos-disc-ref", "--_pos-disc-floor"])
      expect(css, v).toContain(`var(${v})`);
    expect(css).not.toMatch(/\.pos-mark,\s*\.pos-diff\s*\{[^}]*0\.85rem/);
  });

  it("size s: a ≥ 28 px dot, a ≥ 10 px code, no «PREF» tag reaching the next spot", () => {
    expect(css).toMatch(/\.pos-map--s\s*\{[^}]*--_pos-dot:\s*max\(1\.75rem,\s*28px\)/);
    expect(css).toMatch(/\.pos-map--s\s*\{[^}]*--_pos-code-size:\s*max\(0\.65rem,\s*10px\)/);
    expect(css).toMatch(/\.pos-map--s \.pos-tag\s*\{\s*display:\s*none/);
  });

  it("wraps the legend onto centred lines on a narrow map (no «·» separators, no unbreakable line) and the summary too", () => {
    // the body of the top-level rule whose selector is exactly `sel`
    const rule = (sel: string) => {
      const at = css.replace(/\r\n/g, "\n").indexOf(`\n${sel} {`);
      return at < 0 ? "" : css.replace(/\r\n/g, "\n").slice(at).split("}")[0];
    };
    const legend = rule(".pos-legend");
    expect(legend).toMatch(/flex-wrap:\s*wrap/);
    expect(legend).toMatch(/justify-content:\s*center/);
    expect(legend).toMatch(/row-gap:/);
    expect(legend).toMatch(/max-width:\s*100%/);
    expect(rule(".pos-legend-item")).not.toMatch(/white-space:\s*nowrap/);
    expect(css).not.toMatch(/\.pos-legend-item\s*\+\s*\.pos-legend-item::before/);
    expect(rule(".pos-summary")).toMatch(/overflow-wrap:\s*anywhere/);
  });

  it("keeps the forced-colors ring only for keyboard focus", () => {
    expect(css).toMatch(/button\.pos-spot:focus-visible\s*\{[^}]*outline:\s*2px solid transparent/);
  });
});

// D4: a host that sets nothing gets the .vx palette (and its day theme), not off-palette colours.
describe("posiciones.css defaults: the .vx palette", () => {
  const vestuario = readFileSync("src/styles/vestuario.css", "utf8").replace(/\r\n/g, "\n");
  const block = (sel: string) => {
    const at = vestuario.indexOf(`\n${sel}{`);
    return at < 0 ? "" : vestuario.slice(at + sel.length + 2).split("}")[0];
  };
  const night = block(".vx");
  const day = block('[data-theme="light"] .vx');
  const tokenIn = (b: string, name: string) => new RegExp(`(?:^|[;\\s])${name}:([^;]+);`).exec(b)?.[1]?.trim().toLowerCase();
  const fallbackOf = (alias: string) => new RegExp(`^\\s*--_pos-${alias}:\\s*var\\(--pos-${alias},\\s*(.+);\\s*$`, "m").exec(css)?.[1] ?? "";

  it("reads the palette blocks", () => {
    expect(tokenIn(night, "--sky")).toBe("#6cabdd");
    expect(tokenIn(night, "--gold")).toBe("#ffc659");
    expect(tokenIn(day, "--gold")).toBe("#9a6b00");
  });

  it.each([
    ["also", "--sky"],
    ["played", "--sky"],
    ["pref", "--gold"],
    ["ink", "--ink"],
    ["dim", "--muted"],
    ["bg", "--bg"],
    ["focus", "--ink"],
    ["pref-ink", "--pill-on-ink"],
    ["played-ink", "--thumb-ink"],
    ["pitch", "--sky"],
    ["line", "--ink"],
  ])("--pos-%s defaults to var(%s)", (alias, token) => {
    expect(fallbackOf(alias)).toContain(`var(${token},`);
  });

  it("every palette read names a .vx token and falls back to its night value", () => {
    const reads = [...css.matchAll(/var\((--(?!pos-)[a-z][\w-]*),\s*(#[0-9a-fA-F]{3,8})\)/g)];
    expect(reads.length).toBeGreaterThan(8);
    for (const [, name, hex] of reads) expect(tokenIn(night, name), name).toBe(hex.toLowerCase());
  });

  it("no off-palette sky or yellow left", () => {
    for (const hex of ["#6cc4ff", "#ffd23f", "#14213d", "#9fb2cc", "#0b1730"]) expect(css.toLowerCase()).not.toContain(hex);
  });
});
