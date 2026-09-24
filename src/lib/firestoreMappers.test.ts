import { describe, expect, it } from "vitest";
import { mapMatch, mapPlayer, mapSeason } from "./firestoreMappers";

describe("archived seasons", () => {
  it("drops archived matches and players, keeps the rest", () => {
    expect(mapMatch("m1", { seasonId: "s1", rival: "Rival", archived: true })).toBeNull();
    expect(mapMatch("m2", { seasonId: "s2", rival: "Rival" })?.id).toBe("m2");
    expect(mapPlayer("p1", { firstName: "Ana", number: 3, archived: true })).toBeNull();
    expect(mapPlayer("p2", { firstName: "Ana", number: 3 })?.id).toBe("p2");
  });
  it("keeps archived seasons for Admin, flagged", () => {
    expect(mapSeason("s1", { name: "Archivo", archived: true })).toMatchObject({ id: "s1", archived: true });
  });
});
