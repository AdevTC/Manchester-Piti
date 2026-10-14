import { describe, expect, it } from "vitest";
import { NEW_DAYS, NEW_FEATURES, isFeatureNew, isNew } from "./isNew";

const DAY = 86_400_000;
const RELEASE = "2026-10-06";
const day = (n: number) => Date.parse(RELEASE) + n * DAY;

describe("isNew: a feature is «nuevo» for 21 days after its release", () => {
  it("day 0, day 20: still new", () => {
    expect(isNew(RELEASE, day(0))).toBe(true);
    expect(isNew(RELEASE, day(20))).toBe(true);
    expect(isNew(RELEASE, day(20) + DAY - 1)).toBe(true);
  });
  it("day 21, day 22: the badge is gone", () => {
    expect(NEW_DAYS).toBe(21);
    expect(isNew(RELEASE, day(21))).toBe(false);
    expect(isNew(RELEASE, day(22))).toBe(false);
  });
  it("an unreadable date never shows it", () => {
    expect(isNew("pronto", day(0))).toBe(false);
  });
  it("by feature name, with a fixed now", () => {
    expect(isFeatureNew("posicionesStats", Date.parse("2026-11-03"))).toBe(true);
    expect(isFeatureNew("posicionesStats", Date.parse("2026-11-04"))).toBe(false);
  });
  it("every release date in the map is a real ISO date", () => {
    for (const d of Object.values(NEW_FEATURES)) expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const d of Object.values(NEW_FEATURES)) expect(Number.isNaN(Date.parse(d))).toBe(false);
  });
});
