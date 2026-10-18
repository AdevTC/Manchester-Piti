import { afterEach, describe, expect, it, vi } from "vitest";
import { nearestCorner, nextCorner, nextSize, parsePipPrefs, PIP_DEFAULT, PIP_KEY, readPipPrefs, shownSize, sizeLabel, writePipPrefs } from "./pip";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("the desktop picture-in-picture", () => {
  it("a drop snaps to the corner of the quarter its centre is in", () => {
    expect(nearestCorner(100, 100, 1440, 900)).toBe("tl");
    expect(nearestCorner(1300, 120, 1440, 900)).toBe("tr");
    expect(nearestCorner(200, 800, 1440, 900)).toBe("bl");
    expect(nearestCorner(1300, 800, 1440, 900)).toBe("br");
    // the exact middle goes down and right
    expect(nearestCorner(720, 450, 1440, 900)).toBe("br");
  });

  it("the corner button goes round clockwise; the size button cycles bug → normal → grande → bug", () => {
    expect([nextCorner("br"), nextCorner("bl"), nextCorner("tl"), nextCorner("tr")]).toEqual(["bl", "tl", "tr", "br"]);
    expect([nextSize("auto"), nextSize("normal"), nextSize("grande")]).toEqual(["normal", "grande", "auto"]);
    expect(sizeLabel("auto")).toBe("Fijar en normal");
    expect(sizeLabel("grande")).toBe("Volver al marcador pequeño");
  });

  it("at rest it is the bug, and it unfolds to normal for a play; a pinned size stays", () => {
    expect(shownSize("auto", false)).toBe("bug");
    expect(shownSize("auto", true)).toBe("normal");
    expect(shownSize("grande", false)).toBe("grande");
    expect(shownSize("normal", true)).toBe("normal");
  });

  it("corner and size are kept in localStorage; anything broken or blocked falls back", () => {
    expect(readPipPrefs()).toEqual(PIP_DEFAULT);
    writePipPrefs({ corner: "tl", size: "grande" });
    expect(readPipPrefs()).toEqual({ corner: "tl", size: "grande" });
    expect(parsePipPrefs("{nope")).toEqual(PIP_DEFAULT);
    expect(parsePipPrefs(JSON.stringify({ corner: "middle", size: "normal" }))).toEqual({ corner: "br", size: "normal" });
    localStorage.setItem(PIP_KEY, "null");
    expect(readPipPrefs()).toEqual(PIP_DEFAULT);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readPipPrefs()).toEqual(PIP_DEFAULT);
    expect(() => writePipPrefs({ corner: "bl", size: "auto" })).not.toThrow();
  });
});
