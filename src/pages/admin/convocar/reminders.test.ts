import { describe, expect, it } from "vitest";
import { remindersOn } from "./reminders";

describe("«Recordatorios automáticos»", () => {
  it("are on unless a captain turned them off", () => {
    expect(remindersOn(undefined)).toBe(true);
    expect(remindersOn({})).toBe(true);
    expect(remindersOn({ auto: true })).toBe(true);
    expect(remindersOn({ auto: "no" })).toBe(true);
    expect(remindersOn({ auto: false })).toBe(false);
  });
});
