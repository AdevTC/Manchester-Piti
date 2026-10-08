import { describe, expect, it } from "vitest";
import { convocatoriaNotice } from "../../functions/src/pushLogic";

const NOW = Date.UTC(2026, 10, 2, 9, 0);
const base = { rival: "MAD SKY", status: "scheduled", date: Date.UTC(2026, 10, 8, 11), seasonId: "t1" };

describe("«Ya está la convocatoria»", () => {
  it("goes when a match to be played is first published with its titulares", () => {
    expect(convocatoriaNotice("m8", { ...base, starters: [] }, { ...base, starters: ["a", "b"] }, 8, NOW)).toEqual({
      topic: "lineup",
      title: "Ya está la convocatoria de la J8",
      body: "MAD SKY · Domingo, 8 nov, 12:00. Mira si te toca en la web.",
      tag: "conv-m8",
      url: "/matches/m8",
    });
    // a brand-new match published already with its convocatoria
    expect(convocatoriaNotice("m8", undefined, { ...base, starters: ["a"] }, null, NOW)?.title).toBe("Ya está la convocatoria");
  });
  it("not for corrections, matches without titulares, played, cancelled or archived ones", () => {
    expect(convocatoriaNotice("m8", { ...base, starters: ["a"] }, { ...base, starters: ["a", "b"] }, 8, NOW)).toBeNull();
    expect(convocatoriaNotice("m8", { ...base }, { ...base, starters: [] }, 8, NOW)).toBeNull();
    expect(convocatoriaNotice("m8", { ...base }, { ...base, starters: ["a"], date: NOW - 1 }, 8, NOW)).toBeNull();
    expect(convocatoriaNotice("m8", { ...base }, { ...base, starters: ["a"], status: "cancelled" }, 8, NOW)).toBeNull();
    expect(convocatoriaNotice("m8", { ...base }, { ...base, starters: ["a"], archived: true }, 8, NOW)).toBeNull();
    expect(convocatoriaNotice("m8", { ...base }, undefined, 8, NOW)).toBeNull();
  });
});
