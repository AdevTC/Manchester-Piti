import { describe, expect, it } from "vitest";
import { porraCountChanges } from "../../functions/src/porraCountLogic";

describe("porraCountChanges", () => {
  it("recounts when a porra is created or deleted, never for an edit", () => {
    expect(porraCountChanges(false, true)).toBe(true);
    expect(porraCountChanges(true, false)).toBe(true);
    expect(porraCountChanges(true, true)).toBe(false);
    expect(porraCountChanges(false, false)).toBe(false);
  });
});
