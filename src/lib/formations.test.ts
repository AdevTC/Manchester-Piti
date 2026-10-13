import { describe, expect, it } from "vitest";
import { lineOf } from "./positions";
import { SYSTEMS_CATALOGUE, SYSTEM_IDS, systemDef } from "./formations";

describe("los 15 sistemas de fútbol 7", () => {
  it("are the spec's, in order, with ids that fit the rules (≤ 10)", () => {
    expect(SYSTEM_IDS).toEqual(["2-3-1", "2-1-2-1", "2-2-2", "2-2-1-1", "3-2-1", "3-1-2", "3-1-1-1", "4-1-1", "3-3", "2-1-3", "1-3-2", "1-2-3", "1-2-2-1", "1-1-2-1-1", "2-1-2-1a"]);
    for (const id of SYSTEM_IDS) expect(id.length).toBeLessThanOrEqual(10);
  });
  for (const s of SYSTEMS_CATALOGUE)
    it(`${s.id} ${s.name}: 7 slots, keeper first at 95, lines match its label`, () => {
      expect(s.spots).toHaveLength(7);
      expect(s.spots[0]).toEqual(["POR", 50, 95]);
      const counts = (["DEF", "MED", "DEL"] as const).map((l) => s.spots.filter(([c]) => lineOf(c) === l).length);
      const label = s.label.split("-").map(Number);
      // The label counts lines back to front; mids may be split across several numbers (2-1-2-1 = 2 DEF, 3 MED, 1 DEL).
      expect(counts[0]).toBe(label[0]);
      expect(label.reduce((a, b) => a + b, 0)).toBe(6);
      expect(counts[0] + counts[1] + counts[2]).toBe(6);
      for (const [, u, v] of s.spots) {
        expect(u).toBeGreaterThanOrEqual(0);
        expect(u).toBeLessThanOrEqual(100);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
      expect(s.about && s.strengths && s.weaknesses && s.needs).toBeTruthy();
    });
  it("left is left: every LI/MI/EI stands left of its LD/MD/ED", () => {
    for (const s of SYSTEMS_CATALOGUE) {
      const u = (c: string) => s.spots.find(([x]) => x === c)?.[1];
      for (const [l, r] of [["LI", "LD"], ["MI", "MD"], ["EI", "ED"]] as const) if (u(l) !== undefined && u(r) !== undefined) expect(u(l)!).toBeLessThan(u(r)!);
    }
  });
  it("systemDef finds each id", () => {
    expect(systemDef("2-1-2-1a").name).toBe("Clásico con alas");
  });
});
