import { describe, expect, it, vi } from "vitest";
import { Lru } from "./lru";

describe("the lens cache's LRU", () => {
  it("drops the least recently used past its size, and a read counts as a use", () => {
    const gone = vi.fn();
    const lru = new Lru<string>(2, () => true, gone);
    lru.set("a", "A");
    lru.set("b", "B");
    expect(lru.get("a")).toBe("A");
    lru.set("c", "C");
    expect(lru.keys()).toEqual(["a", "c"]);
    expect(gone).toHaveBeenCalledWith("B", "b");
    expect(lru.get("b")).toBeUndefined();
  });

  it("keeps an entry still in use and drops the next oldest instead", () => {
    const gone = vi.fn();
    const lru = new Lru<string>(2, (v) => v !== "A", gone);
    lru.set("a", "A");
    lru.set("b", "B");
    lru.set("c", "C");
    expect(lru.keys()).toEqual(["a", "c"]);
    expect(gone).toHaveBeenCalledTimes(1);
    expect(gone).toHaveBeenCalledWith("B", "b");
  });

  it("never drops the entry just written, even when every other one is in use", () => {
    const lru = new Lru<string>(1, (v) => v === "C");
    lru.set("a", "A");
    lru.set("b", "B");
    expect(lru.keys()).toEqual(["a", "b"]);
    lru.set("c", "C");
    expect(lru.size).toBe(3);
  });

  it("rewriting a key moves it to the newest place without growing", () => {
    const lru = new Lru<number>(3);
    lru.set("a", 1);
    lru.set("b", 2);
    lru.set("a", 3);
    expect(lru.keys()).toEqual(["b", "a"]);
    expect(lru.get("a")).toBe(3);
  });
});
