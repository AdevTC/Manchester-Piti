// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { enterFullscreen, leaveFullscreen, presJugadaTxt, presKey, presLed } from "./presenta";

// Bloque 5 · modo presentación: its keys, its LED and the browser's full screen where there is one.

describe("the keys", () => {
  it("P opens and closes it, Esc closes it, the tool keys wait while it is on; typing and Ctrl / ⌘ / Alt never", () => {
    expect(presKey({ key: "p" }, false, false)).toBe("toggle");
    expect(presKey({ key: "P" }, true, false)).toBe("toggle");
    expect(presKey({ key: "Escape" }, true, false)).toBe("exit");
    expect(presKey({ key: "Escape" }, false, false)).toBeNull();
    expect(presKey({ key: "3" }, true, false)).toBe("hold");
    expect(presKey({ key: "3" }, false, false)).toBeNull();
    expect(presKey({ key: "p" }, false, true)).toBeNull();
    expect(presKey({ key: "p", ctrlKey: true }, false, false)).toBeNull();
    expect(presKey({ key: "p", metaKey: true }, false, false)).toBeNull();
    expect(presKey({ key: "p", altKey: true }, false, false)).toBeNull();
    expect(presKey({ key: "P", shiftKey: true }, false, false)).toBeNull();
  });
});

describe("what it says", () => {
  it("the LED: the club, the match (else the board), the system, the química and the chant, in capitals", () => {
    expect(presLed({ match: "J8 · MAD SKY", board: "Mi siete", sys: "2-3-1", qv: 87, free: false })).toEqual(["MANCHESTER PITI", "J8 · MAD SKY", "SISTEMA 2-3-1", "QUÍMICA 87", "VAMOS PITI"]);
    expect(presLed({ match: null, board: "Mi siete", sys: "2-3-1", qv: 40, free: true })[1]).toBe("MI SIETE");
    expect(presLed({ match: null, board: "Mi siete", sys: "2-3-1", qv: 40, free: true })[2]).toBe("SISTEMA LIBRE");
  });
  it("the jugada's transport: the paso, of how many, and its title", () => {
    expect(presJugadaTxt(1, 4, "Desmarque")).toBe("Paso 2 de 4 · Desmarque");
    expect(presJugadaTxt(0, 2, "")).toBe("Paso 1 de 2");
  });
});

describe("the browser's full screen", () => {
  it("is asked for where there is one; a refusal or its absence just fills the window", async () => {
    const req = vi.fn(async () => undefined);
    expect(await enterFullscreen({ requestFullscreen: req })).toBe(true);
    expect(req).toHaveBeenCalledWith({ navigationUI: "hide" });
    expect(await enterFullscreen({ requestFullscreen: async () => Promise.reject(new Error("no")) })).toBe(false);
    expect(await enterFullscreen({})).toBe(false);
    expect(await enterFullscreen(null)).toBe(false);
  });
  it("is left only when it is on", async () => {
    const exit = vi.fn(async () => undefined);
    await leaveFullscreen({ fullscreenElement: null, exitFullscreen: exit });
    expect(exit).not.toHaveBeenCalled();
    await leaveFullscreen({ fullscreenElement: document.body, exitFullscreen: exit });
    expect(exit).toHaveBeenCalledTimes(1);
    await expect(leaveFullscreen({ fullscreenElement: document.body, exitFullscreen: async () => Promise.reject(new Error("x")) })).resolves.toBeUndefined();
  });
});
