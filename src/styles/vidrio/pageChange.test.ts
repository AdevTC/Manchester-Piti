// A change of page moves the whole page (chrome.css, vd-page / vd-page-out) with the regions' fade and slide
// (transitions.css) but without their 4 px blur: blurring a screen-sized snapshot on every frame was the change's
// largest GPU cost on a phone. The regions keep theirs.
import { describe, expect, it } from "vitest";

type Fs = { readFileSync: (path: string, encoding: "utf8") => string };
const fsModule = "node:fs";
const { readFileSync } = (await import(/* @vite-ignore */ fsModule)) as Fs;
const chrome = readFileSync("src/styles/vidrio/chrome.css", "utf8"); // vitest runs from the repo root
const transitions = readFileSync("src/styles/vidrio/transitions.css", "utf8");

const keyframes = (name: string) => transitions.match(new RegExp(`@keyframes ${name}\\{(.*)\\}\\r?\\n`))?.[1] ?? "";
const pageAnimations = [...chrome.matchAll(/::view-transition-(?:old\(vd-page-out\)|new\(vd-page\))\{animation(?:-name)?:([\w-]+)/g)].map((m) => m[1]);

describe("the page change's animations", () => {
  it("are the page's own six: out left/right/down, in right/left/up", () => {
    expect(pageAnimations.sort()).toEqual(["vd-x-page-in-l", "vd-x-page-in-r", "vd-x-page-in-u", "vd-x-page-out-d", "vd-x-page-out-l", "vd-x-page-out-r"]);
  });

  it("fade and slide as the regions do, without the blur", () => {
    for (const name of pageAnimations) {
      const page = keyframes(name);
      const region = keyframes(name.replace("vd-x-page-", "vd-x-"));
      expect(page, name).not.toBe("");
      expect(page, name).not.toContain("filter");
      expect(region, name).toContain("filter:blur(4px)");
      expect(page, name).toBe(region.replace(";filter:blur(4px)", ""));
    }
  });
});
