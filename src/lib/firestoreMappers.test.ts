import { describe, expect, it } from "vitest";
import { mapMatch, mapRawMatch, mapPlayer, mapRawPlayer, mapSeason } from "./firestoreMappers";

describe("archived seasons", () => {
  it("drops archived matches and players, keeps the rest", () => {
    expect(mapMatch("m1", { seasonId: "s1", rival: "Rival", archived: true })).toBeNull();
    expect(mapMatch("m2", { seasonId: "s2", rival: "Rival" })?.id).toBe("m2");
    expect(mapPlayer("p1", { firstName: "Ana", number: 3, archived: true })).toBeNull();
    expect(mapRawPlayer("p1", { firstName: "Ana", number: 3, archived: true })).toMatchObject({ id: "p1", firstName: "Ana", archived: true });
    expect(mapPlayer("p2", { firstName: "Ana", number: 3 })?.id).toBe("p2");
  });
  it("keeps archived seasons for Admin, flagged", () => {
    expect(mapSeason("s1", { name: "Archivo", archived: true })).toMatchObject({ id: "s1", archived: true });
  });
  it("keeps archives only in the admin mapper, including individual archive during a season restore", () => {
    const data = { seasonId: "s1", rival: "Rival", archived: true, individuallyArchived: true, events: [{ id: "goal", type: "goal", minute: 4 }] };
    expect(mapRawMatch("m", data)).toEqual({ id: "m", ...data });
    expect(mapMatch("m", data)).toBeNull();
    expect(mapMatch("m", { ...data, archived: false })).toBeNull();
    expect(mapMatch("m", { ...data, archived: false, individuallyArchived: false })?.id).toBe("m");
    expect(mapMatch("m", { ...data, archived: false, individuallyArchived: false, deleting: true })).toBeNull();
  });
});
