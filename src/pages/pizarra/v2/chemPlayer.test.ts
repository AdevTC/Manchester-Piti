import { describe, expect, it } from "vitest";
import { demoSquad, lineupOf, squadOf } from "./testkit";
import { chemOf } from "./quimica";
import { place } from "./ops";
import { allDiamonds, diamondMarks, diamondsAria, dropPreview, playerDiamonds, TEAM_MAX, teamDiamonds } from "./chemPlayer";

// Bloque 4 · A5 — la química por jugador, pure.

const SEVEN = ["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "adrian"];

describe("los diamantes de cada cromo", () => {
  it("one for his natural zone; strong links add up to two more", () => {
    // EVANS–ILLESCAS: more than half the team's minutes together and two assists = a «++» link
    const sq = squadOf(demoSquad().list, [
      ["evans", "illescas", { tog: 6, min: 300, ast: 2 }],
      ["evans", "tello", { tog: 6, min: 300, ast: 2 }],
    ]);
    const L = lineupOf(SEVEN, "2-3-1", sq);
    const ch = chemOf(L, sq);
    expect(playerDiamonds(L, sq, ch, 0)).toBe(3);
    expect(playerDiamonds(L, sq, ch, 1)).toBe(2);
    // natural but with weak links only: one
    expect(playerDiamonds(L, sq, ch, 4)).toBe(1);
    expect(teamDiamonds(L, sq)).toBeLessThanOrEqual(TEAM_MAX);
  });

  it("out of position: at most one; an empty slot: none", () => {
    const sq = squadOf(demoSquad().list, [["adrian", "illescas", { tog: 6, min: 300, ast: 2 }]]);
    const L = lineupOf(["evans", "adrian", "tello", "huberoski", "eguzquiza", "almachi", null], "2-3-1", sq);
    const ds = allDiamonds(L, sq);
    expect(ds[1]).toBeLessThanOrEqual(1);
    expect(ds[6]).toBe(0);
  });

  it("the three marks and their words", () => {
    expect(diamondMarks(2)).toEqual([true, true, false]);
    expect(diamondsAria(0)).toBe("química 0 de 3");
  });
});

describe("«+2 química aquí»", () => {
  it("says what a drop would do to the team's diamonds", () => {
    const sq = demoSquad();
    const L = lineupOf(["evans", "adrian", "tello", "huberoski", "eguzquiza", "almachi", "illescas"], "2-3-1", sq);
    // ILLESCAS (a defender up front) back to defence for ADRIAN (a forward at the back): both natural again
    const fix = place(L, "illescas", 1);
    const p = dropPreview(L, fix, sq, "illescas");
    expect(p.delta).toBeGreaterThan(0);
    expect(p.txt).toBe("+" + p.delta + " química aquí");
    expect(p.mine).toBeGreaterThanOrEqual(1);
    const back = dropPreview(fix, L, sq, "illescas");
    expect(back.txt).toBe("−" + p.delta + " química aquí");
    expect(dropPreview(L, L, sq, "illescas").txt).toBe("= química aquí");
  });
});
