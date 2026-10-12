import { afterEach, describe, expect, it, vi } from "vitest";
import { BENCH_VIEW_KEY, readBenchView, writeBenchView } from "./benchView";

describe("the bench view (lista | cromos), remembered on this device", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("defaults to the list and keeps what was chosen", () => {
    expect(readBenchView()).toBe("lista");
    writeBenchView("cromos");
    expect(localStorage.getItem(BENCH_VIEW_KEY)).toBe("cromos");
    expect(readBenchView()).toBe("cromos");
    localStorage.setItem(BENCH_VIEW_KEY, "something else");
    expect(readBenchView()).toBe("lista");
  });

  it("without storage (private window, blocked) it just uses the default", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readBenchView()).toBe("lista");
    expect(() => writeBenchView("cromos")).not.toThrow();
  });
});
