// The cascade contract between the legacy shell (club.css, in the entry) and the Celeste pages
// (vestuario.css, which the error/404 screens now pull into the entry too, so its load order is no longer
// "after club.css"). club.css's app-wide element defaults must carry no class weight — :where(.club-app)
// — so that `.vx a`, `.vx :focus-visible` and the rest win whatever order the stylesheets load in.
import { describe, expect, it } from "vitest";

// Read from disk: vitest runs with `css: false`. node:fs comes in through a typed dynamic import (the
// app's tsconfig has no Node types).
type Fs = { readFileSync: (path: string, encoding: "utf8") => string };
const fsModule = "node:fs";
const { readFileSync } = (await import(/* @vite-ignore */ fsModule)) as Fs;
const club = readFileSync("src/styles/club.css", "utf8"); // vitest runs from the repo root
const vestuario = readFileSync("src/styles/vestuario.css", "utf8");

/** Every selector (comma-split) of the stylesheet, comments stripped. */
const selectors = (css: string) =>
  [...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{/g)]
    .map((m) => m[1].trim())
    .filter((s) => !s.startsWith("@") && !/^(from|to|\d+%)/.test(s))
    .flatMap((s) => s.split(",").map((x) => x.trim()));

describe("club.css ↔ Celeste cascade", () => {
  it("is loaded as source", () => {
    expect(club).toContain(".club-app");
    expect(vestuario).toContain(".vx a{");
  });

  it("no `.club-app <element|pseudo>` rule with class weight: they all sit under :where(.club-app)", () => {
    const weighted = selectors(club).filter((s) => /^\.club-app\s+(?:[a-z*]|:)/.test(s));
    expect(weighted).toEqual([]);
    // the ones that used to collide with .vx a and .vx :focus-visible
    expect(club).toMatch(/:where\(\.club-app\) a \{/);
    expect(club).toMatch(/:where\(\.club-app\) :focus-visible \{/);
  });
});
