// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { INTRO3D_KEY, INTRO_KEY, intro3dWanted, introKind, introSeen, markIntroSeen, setIntro3dWanted, type IntroArgs } from "./intro";

// The opening, once per browser session: the 3D intro where the device can and «3D» is on, else the 2D
// crane; none with reduced motion, on a link straight to the charla, or later in the session.

const a = (o: Partial<IntroArgs> = {}): IntroArgs => ({ rm: false, seen: false, v3: true, why3d: () => null, start: "board", ...o });

afterEach(() => {
  localStorage.removeItem(INTRO3D_KEY);
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("the opening", () => {
  it("the 2D crane by default: the 3D presentation is opt-in (no three.js just to open the page)", () => {
    const why3d = vi.fn(() => null);
    expect(introKind(a({ why3d }))).toBe("2d");
    expect(why3d).not.toHaveBeenCalled();
    // asked for on this device («Ver la presentación en 3D»)
    setIntro3dWanted(true);
    expect(intro3dWanted()).toBe(true);
    expect(introKind(a())).toBe("3d");
    setIntro3dWanted(false);
    expect(localStorage.getItem(INTRO3D_KEY)).toBeNull();
    expect(introKind(a())).toBe("2d");
  });

  it("asked for: 3D where the device can and «3D» is on; else the 2D crane", () => {
    const o = { optIn: true };
    expect(introKind(a(o))).toBe("3d");
    expect(introKind(a({ ...o, v3: false }))).toBe("2d");
    expect(introKind(a({ ...o, why3d: () => "webdriver" }))).toBe("2d");
    expect(introKind(a({ ...o, why3d: () => "no-webgl2" }))).toBe("2d");
    // the jugadas own the stadium for their replay: the 2D crane there
    expect(introKind(a({ ...o, start: "jugadas" }))).toBe("2d");
    // asked for or not, never with reduced motion, nor again in the session
    expect(introKind(a({ ...o, rm: true }))).toBe("none");
    expect(introKind(a({ ...o, seen: true }))).toBe("none");
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
