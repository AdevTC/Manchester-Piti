import { describe, expect, it } from "vitest";
import { officialFor, officialRefOf } from "./officialBoard";

// The rule the pizarra, the match page and the Sala de control share: a match's official is the newest
// published for it, else the newest for the whole season. Raw docs are read as the pizarra reads them.

describe("officialRefOf", () => {
  it("reads a raw lineups doc: official flag, alcance and a Timestamp or number update", () => {
    expect(officialRefOf({ id: "a", seasonId: "t1", isOfficial: true, matchId: "m8", updatedAt: { toMillis: () => 42 } })).toEqual({ id: "a", isOfficial: true, matchId: "m8", updatedAt: 42 });
    expect(officialRefOf({ id: "b", seasonId: "t1", isOfficial: "yes", matchId: "", updatedAt: 7 })).toEqual({ id: "b", isOfficial: false, matchId: null, updatedAt: 7 });
    expect(officialRefOf({ id: "c", seasonId: "t1" })).toEqual({ id: "c", isOfficial: false, matchId: null, updatedAt: null });
  });
});

describe("officialFor over raw refs", () => {
  const refs = [
    officialRefOf({ id: "season", seasonId: "t1", isOfficial: true, matchId: null, updatedAt: 1 }),
    officialRefOf({ id: "j8-old", seasonId: "t1", isOfficial: true, matchId: "m8", updatedAt: 2 }),
    officialRefOf({ id: "j8", seasonId: "t1", isOfficial: true, matchId: "m8", updatedAt: 3 }),
    officialRefOf({ id: "draft", seasonId: "t1", isOfficial: false, matchId: "m9", updatedAt: 9 }),
  ];
  it("the match's newest official, else the season's", () => {
    expect(officialFor(refs, "m8")?.id).toBe("j8");
    expect(officialFor(refs, "m9")?.id).toBe("season");
    expect(officialFor(refs.slice(1), "m9")).toBeNull();
  });
});
