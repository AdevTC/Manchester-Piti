import { afterEach, describe, expect, it, vi } from "vitest";
import { INTRO_KEY, introKind, introSeen, markIntroSeen, type IntroArgs } from "./intro";

// The opening, once per browser session: the 3D intro where the device can and «3D» is on, else the 2D
// crane; none with reduced motion, on a link straight to the charla, or later in the session.

const a = (o: Partial<IntroArgs> = {}): IntroArgs => ({ rm: false, seen: false, v3: true, why3d: () => null, start: "board", ...o });

afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("the opening", () => {
  it("3D where the device can and «3D» is on; else the 2D crane", () => {
    expect(introKind(a())).toBe("3d");
    expect(introKind(a({ v3: false }))).toBe("2d");
    expect(introKind(a({ why3d: () => "webdriver" }))).toBe("2d");
    expect(introKind(a({ why3d: () => "no-webgl2" }))).toBe("2d");
    // the jugadas own the stadium for their replay: the 2D crane there
    expect(introKind(a({ start: "jugadas" }))).toBe("2d");
  });

  it("none with reduced motion, a second time in the session, or straight into the charla", () => {
    expect(introKind(a({ rm: true }))).toBe("none");
    expect(introKind(a({ seen: true }))).toBe("none");
    expect(introKind(a({ start: "charla" }))).toBe("none");
  });

  it("only asks the device about the 3D when it matters", () => {
    const why3d = vi.fn(() => null);
    introKind(a({ rm: true, why3d }));
    introKind(a({ seen: true, why3d }));
    introKind(a({ v3: false, why3d }));
    introKind(a({ start: "jugadas", why3d }));
    expect(why3d).not.toHaveBeenCalled();
  });

  it("remembers it played for the session (and survives a storage that throws)", () => {
    expect(introSeen()).toBe(false);
    markIntroSeen();
    expect(sessionStorage.getItem(INTRO_KEY)).toBe("1");
    expect(introSeen()).toBe(true);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    expect(introSeen()).toBe(false);
    expect(() => markIntroSeen()).not.toThrow();
  });
});
