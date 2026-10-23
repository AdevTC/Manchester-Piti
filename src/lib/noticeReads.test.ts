// The bandeja's read state (lib/noticeReads): what is unread, and how the map stays small.
import { describe, expect, it, vi } from "vitest";

vi.mock("../firebase", () => ({ db: {} }));
vi.mock("../pages/vestuario/live", () => ({ useLiveDoc: () => ({ data: {}, loading: false, error: false }) }));
const { isUnreadWith, MAX_READS, nextReads } = await import("./noticeReads");

const SEEN = 1_000;
const old = { id: "old", at: 500 };
const fresh = { id: "fresh", at: 1_500 };

describe("isUnreadWith", () => {
  it("without a word in the map, newer than the last look", () => {
    expect(isUnreadWith(fresh, SEEN, {})).toBe(true);
    expect(isUnreadWith(old, SEEN, {})).toBe(false);
    expect(isUnreadWith(old, null, {})).toBe(true);
  });
  it("the map's word first: read, or unread again even when older than the look", () => {
    expect(isUnreadWith(fresh, SEEN, { fresh: true })).toBe(false);
    expect(isUnreadWith(old, SEEN, { old: false })).toBe(true);
  });
});

describe("nextReads", () => {
  it("keeps only what the look doesn't already say", () => {
    expect(nextReads({}, { fresh: true, old: true }, [fresh, old], SEEN)).toEqual({ fresh: true });
    expect(nextReads({}, { old: false, fresh: false }, [fresh, old], SEEN)).toEqual({ old: false });
  });
  it("drops the ids the list no longer has", () => {
    expect(nextReads({ gone: true }, { fresh: true }, [fresh, old], SEEN)).toEqual({ fresh: true });
  });
  it("marking unread a notice read before puts it back to unread", () => {
    expect(nextReads({ fresh: true }, { fresh: false }, [fresh], SEEN)).toEqual({});
  });
  it("never more than the rules' cap, the newest kept", () => {
    const list = Array.from({ length: 250 }, (_, i) => ({ id: `n${i}`, at: 10_000 - i }));
    const out = nextReads({}, Object.fromEntries(list.map((n) => [n.id, true])), list, SEEN);
    expect(Object.keys(out)).toHaveLength(MAX_READS);
    expect(out.n0).toBe(true);
    expect(out.n249).toBeUndefined();
  });
  it("with the list not known yet, the changes are kept as they are (capped)", () => {
    expect(nextReads({ a: true }, { b: false }, null, SEEN)).toEqual({ a: true, b: false });
  });
});
