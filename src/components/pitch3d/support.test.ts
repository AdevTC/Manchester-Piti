import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { supported, unsupportedReason } from "./support";

// The guard that keeps the 3D off automation, reduced-motion/data, low-memory and WebGL2-less
// devices. Everything it reads is stubbed: navigator hints, matchMedia and the canvas context.

const HINTS = ["webdriver", "deviceMemory", "connection"] as const;
function setHint(name: (typeof HINTS)[number], value: unknown) {
  Object.defineProperty(navigator, name, { value, configurable: true });
}
let queries: Record<string, boolean> = {};
const loseContext = vi.fn();
let webgl2 = true;

beforeEach(() => {
  queries = {};
  webgl2 = true;
  loseContext.mockClear();
  setHint("webdriver", false);
  setHint("deviceMemory", 8);
  setHint("connection", { saveData: false });
  window.matchMedia = ((q: string) => ({ matches: queries[q] ?? false, media: q })) as unknown as typeof window.matchMedia;
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(((type: string) =>
    type === "webgl2" && webgl2 ? { getExtension: () => ({ loseContext }) } : null) as unknown as HTMLCanvasElement["getContext"]);
});
afterEach(() => {
  vi.restoreAllMocks();
  for (const h of HINTS) Reflect.deleteProperty(navigator, h);
  Reflect.deleteProperty(window, "matchMedia");
});

describe("supported()", () => {
  it("lets a capable device in, and gives the probe context back", () => {
    expect(unsupportedReason()).toBeNull();
    expect(supported()).toBe(true);
    expect(loseContext).toHaveBeenCalled();
  });

  it("never starts under automation (navigator.webdriver)", () => {
    setHint("webdriver", true);
    expect(unsupportedReason()).toBe("webdriver");
    expect(supported()).toBe(false);
  });

  it("checks automation before touching WebGL", () => {
    setHint("webdriver", true);
    const probe = vi.mocked(HTMLCanvasElement.prototype.getContext);
    probe.mockClear();
    supported();
    expect(probe).not.toHaveBeenCalled();
  });

  it("respects prefers-reduced-motion", () => {
    queries["(prefers-reduced-motion: reduce)"] = true;
    expect(unsupportedReason()).toBe("reduced-motion");
  });

  it("respects Save-Data and prefers-reduced-data", () => {
    setHint("connection", { saveData: true });
    expect(unsupportedReason()).toBe("save-data");
    setHint("connection", { saveData: false });
    queries["(prefers-reduced-data: reduce)"] = true;
    expect(unsupportedReason()).toBe("save-data");
  });

  it("stays off below 3 GB of device memory, on when the browser does not say", () => {
    setHint("deviceMemory", 2);
    expect(unsupportedReason()).toBe("low-memory");
    setHint("deviceMemory", 3);
    expect(unsupportedReason()).toBeNull();
    setHint("deviceMemory", undefined);
    expect(unsupportedReason()).toBeNull();
  });

  it("needs WebGL2", () => {
    webgl2 = false;
    expect(unsupportedReason()).toBe("no-webgl2");
  });

  it("treats a throwing probe as no WebGL2", () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(supported()).toBe(false);
  });

  it("works without matchMedia or the network hints", () => {
    Reflect.deleteProperty(window, "matchMedia");
    setHint("connection", undefined);
    expect(supported()).toBe(true);
  });
});
