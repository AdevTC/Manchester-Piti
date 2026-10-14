import { describe, expect, it } from "vitest";
import { systemMark, systemText } from "./system";

describe("systemText / systemMark", () => {
  it("«2-3-1 · Clásico», «Libre · sin sistema fijo», nothing without a known system", () => {
    expect(systemText("2-3-1")).toBe("2-3-1 · Clásico");
    expect(systemText("1-3-1-1")).toBe("1-3-1-1 · Escalera");
    expect(systemText("libre")).toBe("Libre · sin sistema fijo");
    expect(systemText(null)).toBeNull();
    expect(systemText(undefined)).toBeNull();
    expect(systemText("5-5")).toBeNull();
  });
  it("the short mark: «3-2-1», «Libre», nothing without a known system", () => {
    expect(systemMark("3-2-1")).toBe("3-2-1");
    expect(systemMark("libre")).toBe("Libre");
    expect(systemMark(null)).toBeNull();
    expect(systemMark("5-5")).toBeNull();
  });
});
