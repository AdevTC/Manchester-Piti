import { describe, expect, it } from "vitest";
import { tabForKey } from "./tabKeys";

describe("tabForKey", () => {
  const ids = [0, 1, 2, 3, 4];
  it("←/→ dan la vuelta", () => {
    expect(tabForKey("ArrowRight", 0, ids)).toBe(1);
    expect(tabForKey("ArrowRight", 4, ids)).toBe(0);
    expect(tabForKey("ArrowLeft", 0, ids)).toBe(4);
    expect(tabForKey("ArrowLeft", 3, ids)).toBe(2);
  });
  it("Inicio/Fin a los extremos", () => {
    expect(tabForKey("Home", 3, ids)).toBe(0);
    expect(tabForKey("End", 1, ids)).toBe(4);
  });
  it("otras teclas o ninguna pestaña: null", () => {
    expect(tabForKey("Enter", 2, ids)).toBeNull();
    expect(tabForKey("ArrowDown", 2, ids)).toBeNull();
    expect(tabForKey("ArrowRight", 0, [])).toBeNull();
  });
});
