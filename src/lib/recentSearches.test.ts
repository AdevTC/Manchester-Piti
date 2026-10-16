import { afterEach, describe, expect, it, vi } from "vitest";
import { readRecent, RECENT_KEY, rememberSearch } from "./recentSearches";

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("recent searches", () => {
  it("keeps 5, newest first, a repeat moves up instead of doubling", () => {
    for (const q of ["uno", "dos", "tres", "cuatro", "cinco", "seis"]) rememberSearch(q);
    expect(readRecent()).toEqual(["seis", "cinco", "cuatro", "tres", "dos"]);
    rememberSearch("TRÉS");
    expect(readRecent()).toEqual(["TRÉS", "seis", "cinco", "cuatro", "dos"]);
  });
  it("ignores an empty query and garbage in storage", () => {
    rememberSearch("   ");
    expect(readRecent()).toEqual([]);
    window.localStorage.setItem(RECENT_KEY, "{no es json");
    expect(readRecent()).toEqual([]);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify({ a: 1 }));
    expect(readRecent()).toEqual([]);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(["rayo", 4, ""]));
    expect(readRecent()).toEqual(["rayo"]);
  });
  it("tolerates storage that throws (blocked, full, private mode)", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(readRecent()).toEqual([]);
    expect(rememberSearch("hugo")).toEqual(["hugo"]);
  });
  it("tolerates localStorage itself being unreachable", () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(readRecent()).toEqual([]);
    expect(rememberSearch("rayo")).toEqual(["rayo"]);
  });
});
