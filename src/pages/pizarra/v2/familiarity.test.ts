import { describe, expect, it } from "vitest";
import { FAM0, famCount, famLine, famOf, familiarity, famTxt } from "./familiarity";
import { moveOptions } from "./moveTo";
import { suggestSeven } from "./pack";
import { cromo, demoSquad, lineupOf, squadOf } from "./testkit";

const sq = demoSquad();
// 2-3-1: POR · DFC DFC · MI MC MD · DC
const off = (matchId: string | null, ids: (string | null)[], formation: "2-3-1" | "3-2-1" = "2-3-1") => ({ ...lineupOf(ids, formation, sq), matchId });
const played = (mid: string) => mid.startsWith("p");

describe("familiaridad por posición", () => {
  it("counts each player's zone in the officials of matches already played, once per match", () => {
    const t = familiarity(
      [
        off("p1", ["evans", "illescas", "tello", "kevin", "huberoski", "eguzquiza", "adrian"]),
        off("p2", ["evans", "illescas", "kevin", "tello", "huberoski", "eguzquiza", "adrian"]),
        // the same match twice (an old official): counted once
        off("p2", ["evans", "kevin", "illescas", "tello", "huberoski", "eguzquiza", "adrian"]),
        // still to be played, and the season's official: not counted
        off("f3", ["fer", "illescas", "tello", "kevin", "huberoski", "eguzquiza", "adrian"]),
        off(null, ["fer", "illescas", "tello", "kevin", "huberoski", "eguzquiza", "adrian"]),
      ],
      played,
    );
    expect(t.games).toBe(2);
    expect(famCount(t, "evans", "POR")).toBe(2);
    expect(famCount(t, "fer", "POR")).toBe(0);
    expect(famCount(t, "tello", "DEF")).toBe(1);
    expect(famCount(t, "tello", "MED")).toBe(1);
    expect(famCount(t, "kevin", "MED")).toBe(1);
    expect(famCount(t, "kevin", "DEF")).toBe(1);
    expect(famLine(t, "tello")).toBe("DEF 1 · MED 1");
    expect(famLine(t, "fer")).toBe("");
  });

  it("free mode: the zone is where he stood", () => {
    const L = off("p1", ["evans", "illescas", "tello", "kevin", "huberoski", "eguzquiza", "adrian"]);
    const free = { ...L, freeMode: true, slots: L.slots.map((s, i) => (i === 6 ? { ...s, y: 70 } : s)) };
    const t = familiarity([free], played);
    expect(famCount(t, "adrian", "DEF")).toBe(1);
    expect(famCount(t, "adrian", "DEL")).toBe(0);
  });

  it("«++» from 5, «+» from 2, «!» never there and not natural; nothing without a played official", () => {
    const seven = ["evans", "illescas", "tello", "kevin", "huberoski", "eguzquiza", "adrian"];
    const t = familiarity(
      ["p1", "p2", "p3", "p4", "p5"].map((m, k) => off(m, k < 2 ? seven : ["evans", "illescas", "tello", "almachi", "huberoski", "eguzquiza", "adrian"])),
      played,
    );
    expect(famOf(t, "huberoski", "MED", "MED")).toBe("++");
    expect(famOf(t, "kevin", "MED", "DEL")).toBe("+");
    expect(famOf(t, "kevin", "DEF", "DEL")).toBe("!");
    // natural there, or position unknown: never «!»
    expect(famOf(t, "fer", "POR", "POR")).toBeNull();
    expect(famOf(t, "fer", "DEF", undefined)).toBeNull();
    expect(famOf(FAM0, "kevin", "DEF", "DEL")).toBeNull();
    expect(famTxt(t, "huberoski", "MED", "MED")).toBe("se lo sabe: 5 partidos de medio en el oficial");
    expect(famTxt(t, "kevin", "MED", "DEL")).toBe("ya ha jugado de medio (2 partidos en el oficial)");
    expect(famTxt(t, "kevin", "DEF", "DEL")).toBe("nunca ha jugado de defensa en el oficial");
    expect(famTxt(t, "fer", "POR", "POR")).toBe("");
  });

  it("«Sugerir siete»: out of his natural zone, whoever has already played there goes first", () => {
    // three DEF slots in 3-2-1 and only two defenders: the third goes to a midfielder (or a forward)
    const s = squadOf([
      cromo("gk", 1, "POR", { rt: 80 }),
      cromo("d1", 2, "DEF", { rt: 80 }),
      cromo("d2", 3, "DEF", { rt: 80 }),
      cromo("m1", 4, "MED", { rt: 90, recentMin: 100 }),
      cromo("m2", 5, "MED", { rt: 70 }),
      cromo("m3", 6, "MED", { rt: 60 }),
      cromo("f1", 7, "DEL", { rt: 80 }),
      cromo("f2", 8, "DEL", { rt: 50 }),
    ]);
    const L = lineupOf([null, null, null, null, null, null, null], "3-2-1", s);
    const plain = suggestSeven(L, s);
    // (without familiarity: the best in form of those left fills the gap)
    const defOf = (x: typeof L) => x.slots.slice(1, 4).map((q) => q.playerId);
    expect(defOf(plain)).toContain("m3");
    const fam = (id: string, z: string) => (id === "f2" && z === "DEF" ? 3 : 0);
    const withFam = suggestSeven(L, s, [], null, fam);
    expect(defOf(withFam)).toContain("f2");
    expect(defOf(withFam)).not.toContain("m3");
  });
});

describe("«Mover a…»", () => {
  it("the seven's puestos: who is in each (the move swaps them), the one he is in, and how well he knows it", () => {
    const L = lineupOf(["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "adrian"], "2-3-1", sq);
    const t = familiarity([off("p1", ["evans", "illescas", "illescas", "tello", "eguzquiza", "almachi", "adrian"]), off("p2", ["evans", "illescas", "kevin", "tello", "eguzquiza", "almachi", "adrian"])], played);
    const o = moveOptions(L, sq, "tello", t);
    expect(o.map((x) => x.lab)).toEqual(["POR", "DFC", "DFC", "MI", "MC", "MD", "DC"]);
    expect(o[2]).toMatchObject({ here: true, sub: "Aquí está", fam: null, aria: "DFC: TELLO ya está aquí" });
    expect(o[3]).toMatchObject({ here: false, sub: "Con HUBEROSKI: se cambian", fam: "+" });
    expect(o[3].aria).toBe("Cambiar a TELLO con HUBEROSKI, MI; ya ha jugado de medio (2 partidos en el oficial)");
    expect(o[6]).toMatchObject({ fam: "!" });
    expect(o[6].aria).toMatch(/nunca ha jugado de delantero en el oficial$/);
    const holes = moveOptions({ ...L, slots: L.slots.map((s, i) => (i === 5 ? { ...s, playerId: null } : s)) }, sq, "tello", FAM0);
    expect(holes[5]).toMatchObject({ sub: "Hueco libre", aria: "Mover a TELLO al hueco MD" });
  });
});
