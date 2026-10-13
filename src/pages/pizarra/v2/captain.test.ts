import { describe, expect, it } from "vitest";
import { applyCaptain, armbands, nextCaptain, rowTxt, whyTxt } from "./captain";
import type { CalMatch } from "./boards";
import { boardDoc, demoSquad, lineupOf, squadOf } from "./testkit";

// El capitán rotativo: los brazaletes salen de los oficiales de partidos jugados; le toca al del siete que
// menos lo ha llevado (luego al que hace más que no lo lleva, luego al de mejor forma).

const sq = demoSquad();
const SEVEN = ["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "adrian"];
const m = (id: string, j: number, played: boolean): CalMatch => ({ id, j, rival: "R" + j, dateMs: j * 1000, played, gf: played ? 1 : null, ga: played ? 0 : null, home: true, venue: "" });
const cal = [m("m1", 1, true), m("m2", 2, true), m("m3", 3, true), m("m4", 4, false)];
const off = (id: string, matchId: string | null, captainId: string | undefined, updatedAt = 1) =>
  boardDoc(id, { ...lineupOf(SEVEN), roles: captainId ? { captainId } : {} }, { isOfficial: true, matchId, updatedAt });

describe("the brazaletes worn", () => {
  it("one per played match: its newest official's captain; unplayed, season-wide or captainless count none", () => {
    const docs = [
      off("o1", "m1", "adrian"),
      off("o2a", "m2", "evans", 1),
      off("o2b", "m2", "huberoski", 5),
      off("o3", "m3", undefined),
      off("o4", "m4", "tello"),
      off("os", null, "illescas"),
      { ...off("x", "m3", "almachi"), isOfficial: false },
    ];
    expect(armbands(docs, cal)).toEqual([
      { id: "adrian", j: 1, matchId: "m1" },
      { id: "huberoski", j: 2, matchId: "m2" },
    ]);
  });
});

describe("who wears it next", () => {
  it("the fewest brazaletes, then the longest without one, then the best form", () => {
    const bands = [
      { id: "adrian", j: 1, matchId: "m1" },
      { id: "huberoski", j: 2, matchId: "m2" },
      { id: "evans", j: 3, matchId: "m3" },
      { id: "illescas", j: 4, matchId: "m4" },
      { id: "tello", j: 5, matchId: "m5" },
      { id: "eguzquiza", j: 6, matchId: "m6" },
    ];
    const p = nextCaptain(lineupOf(SEVEN), sq, bands);
    // almachi (74) is the only one of the seven who never wore it
    expect(p.id).toBe("almachi");
    expect(p.rows.map((r) => r.id)).toEqual(["almachi", "adrian", "huberoski", "evans", "illescas", "tello", "eguzquiza"]);
    expect(whyTxt(p, (id) => id)).toBe("Del siete, nunca ha llevado el brazalete.");
    // everyone once: the one who wore it longest ago
    const p2 = nextCaptain(lineupOf(SEVEN), sq, [...bands, { id: "almachi", j: 7, matchId: "m7" }]);
    expect(p2.id).toBe("adrian");
    expect(rowTxt(p2.rows[0])).toBe("1 brazalete (J1)");
    expect(whyTxt(p2, (id) => id)).toBe("Es quien menos lo ha llevado de tu siete: 1 brazalete (J1).");
  });

  it("no brazaletes known: the best form; bajas and «no va» never; an empty board: nobody", () => {
    const p = nextCaptain(lineupOf(SEVEN), sq, []);
    expect(p.id).toBe("adrian");
    expect(p.known).toBe(0);
    expect(whyTxt(p, (id) => id.toUpperCase())).toBe("Aún no hay capitanes en los oficiales de partidos jugados: empieza por ADRIAN, el de mejor forma.");
    const sq2 = squadOf(sq.list.map((c) => (c.id === "adrian" ? { ...c, cv: "no" as const } : c.id === "huberoski" ? { ...c, baja: "Lesionado" as const } : c)));
    expect(nextCaptain(lineupOf(SEVEN), sq2, []).rows.map((r) => r.id)).not.toContain("adrian");
    expect(nextCaptain(lineupOf(SEVEN), sq2, []).rows.map((r) => r.id)).not.toContain("huberoski");
    const none = nextCaptain(lineupOf([]), sq, []);
    expect(none.id).toBeNull();
    expect(whyTxt(none, (id) => id)).toBe("Pon a tu siete en el campo y te digo a quién le toca el brazalete.");
  });

  it("applied with one tap: the brazalete moves (the vice, if it was him, steps down)", () => {
    const L = { ...lineupOf(SEVEN), roles: { captainId: "adrian", viceId: "almachi" } };
    const next = applyCaptain(L, "almachi");
    expect(next.roles).toEqual({ captainId: "almachi" });
    expect(applyCaptain(next, "almachi")).toBe(next);
    expect(nextCaptain(next, sq, []).already).toBe(false);
    expect(nextCaptain({ ...next, roles: { captainId: "adrian" } }, sq, []).already).toBe(true);
  });
});
