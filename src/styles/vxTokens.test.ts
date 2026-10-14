// The .vx layer and motion scale (vestuario.css): custom properties only, the same in both themes.
import { describe, expect, it } from "vitest";

// Read from disk: vitest runs with `css: false`. node:fs comes in through a typed dynamic import (the
// app's tsconfig has no Node types).
type Fs = { readFileSync: (path: string, encoding: "utf8") => string };
const fsModule = "node:fs";
const { readFileSync } = (await import(/* @vite-ignore */ fsModule)) as Fs;
const vestuario = readFileSync("src/styles/vestuario.css", "utf8").replace(/\r\n/g, "\n"); // vitest runs from the repo root

const block = (sel: string) => {
  const at = vestuario.indexOf(`\n${sel}{`);
  return at < 0 ? "" : vestuario.slice(at + sel.length + 2).split("}")[0];
};
const night = block(".vx");
const day = block('[data-theme="light"] .vx');

describe(".vx z-index and motion tokens", () => {
  const Z = { "--z-raise": 1, "--z-over": 2, "--z-chrome": 6, "--z-menu": 30, "--z-layer": 40, "--z-toast": 60 };
  const DUR = { "--dur-quick": ".15s", "--dur-base": ".3s", "--dur-slow": ".6s", "--dur-reveal": ".9s" };

  it("a rising z-index scale on .vx", () => {
    const values = Object.entries(Z).map(([name, z]) => {
      expect(night, name).toMatch(new RegExp(`${name}:${z};`));
      return z;
    });
    expect([...values].sort((a, b) => a - b)).toEqual(values);
  });

  it("a rising set of durations on .vx", () => {
    for (const [name, d] of Object.entries(DUR)) expect(night, name).toContain(`${name}:${d};`);
    const secs = Object.values(DUR).map(parseFloat);
    expect([...secs].sort((a, b) => a - b)).toEqual(secs);
  });

  it("the day theme doesn't redefine them", () => {
    expect(day).toContain("--ink:");
    expect(day).not.toMatch(/--(z|dur)-/);
  });
});
