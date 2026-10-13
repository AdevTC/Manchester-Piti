import { describe, expect, it } from "vitest";
import { FAM0, famCodeCount, famCount, famLine, famOf, familiarity, famSlot, famTxt } from "./familiarity";
import { moveOptions } from "./moveTo";
import { suggestSeven } from "./pack";
import { cromo, demoSquad, lineupOf, squadOf } from "./testkit";
import type { Lineup } from "../formations";
import type { Cromo } from "./model";
import { lineOf, type PosCode } from "../../../lib/positions";

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

describe("familiaridad por posición exacta", () => {
  // 2-3-1: POR · DFC DFC · MI MC MD · DC
  const x = (id: string, num: number, main: PosCode, also: PosCode[] = []): Cromo => cromo(id, num, lineOf(main), { ps: { main, also, line: lineOf(main) } });
  const xs = squadOf([x("gk", 1, "POR"), x("d1", 2, "DFC"), x("d2", 3, "DFC"), x("mi", 4, "MI"), x("mc", 5, "MC"), x("md", 6, "MD"), x("dc", 9, "DC"), x("x", 12, "MD"), x("k", 13, "POR"), cromo("kev", 14, "DEL")]);
  const SEVEN = ["gk", "d1", "d2", "mi", "mc", "md", "dc"];
  const BOARD = lineupOf(SEVEN, "2-3-1", xs);
  const offX = (matchId: string, ids: (string | null)[]) => ({ ...lineupOf(ids, "2-3-1", xs), matchId });
  // x at MI (slot 3) in `n` played officials
  const xAtMi = (n: number) => familiarity(Array.from({ length: n }, (_, k) => offX("p" + k, ["gk", "d1", "d2", "x", "mc", "md", "dc"])), played);

  it("counts each one's exact position (the stored board's code), and still his line", () => {
    const t = familiarity([offX("p1", ["gk", "d1", "d2", "x", "mc", "md", "dc"]), offX("p2", ["gk", "d1", "d2", "x", "mc", "md", "dc"]), offX("p3", ["gk", "d1", "d2", "mi", "mc", "x", "dc"])], played);
    expect(famCodeCount(t, "x", "MI")).toBe(2);
    expect(famCodeCount(t, "x", "MD")).toBe(1);
    expect(famCodeCount(t, "x", "MC")).toBe(0);
    expect(famCodeCount(t, "gk", "POR")).toBe(3);
    expect(famCount(t, "x", "MED")).toBe(3);
  });

  it("«++» from 5 and «+» from 2 at that position; «!» only never there and fuera; nothing for adaptado or in place", () => {
    const t5 = xAtMi(5);
    expect(famSlot(t5, BOARD, xs, "x", 3)).toEqual({ mark: "++", txt: "se lo sabe: 5 partidos de interior izquierdo en el oficial" });
    const t2 = xAtMi(2);
    expect(famSlot(t2, BOARD, xs, "x", 3)).toEqual({ mark: "+", txt: "ya ha jugado de interior izquierdo (2 partidos en el oficial)" });
    // MC: never there, but adaptado (his line) — no «+» from the line's count, no «!»
    expect(famSlot(t5, BOARD, xs, "x", 4)).toEqual({ mark: null, txt: "" });
    // MD: his preferida, never there: nothing to say
    expect(famSlot(t5, BOARD, xs, "x", 5)).toEqual({ mark: null, txt: "" });
    // DC: never there and fuera
    expect(famSlot(t5, BOARD, xs, "x", 6)).toEqual({ mark: "!", txt: "nunca ha jugado de punta en el oficial" });
    expect(famSlot(FAM0, BOARD, xs, "x", 6)).toEqual({ mark: null, txt: "" });
  });

  it("free-mode boards count the position where he stood (the nearest of his line)", () => {
    // DC's slot pulled out to the right wing: an extremo derecho
    const wing = (L: Lineup): Lineup => ({ ...L, freeMode: true, slots: L.slots.map((s, i) => (i === 6 ? { ...s, x: 84, y: 22 } : s)) });
    const t = familiarity([{ ...wing(offX("p1", SEVEN)), matchId: "p1" }, { ...wing(offX("p2", SEVEN)), matchId: "p2" }], played);
    expect(famCodeCount(t, "dc", "ED")).toBe(2);
    expect(famCodeCount(t, "dc", "DC")).toBe(0);
    expect(famSlot(t, wing(BOARD), xs, "dc", 6)).toEqual({ mark: "+", txt: "ya ha jugado de extremo derecho (2 partidos en el oficial)" });
    // on a 2-3-1 his slot is his preferida punta: never there by code, but in place
    expect(famSlot(t, BOARD, xs, "dc", 6)).toEqual({ mark: null, txt: "" });
  });

  it("who has no exact outfield position keeps the line's count and marks", () => {
    const t = familiarity([offX("p1", ["gk", "d1", "d2", "kev", "mc", "md", "dc"]), offX("p2", ["gk", "d1", "d2", "mi", "kev", "md", "dc"]), offX("p3", ["k", "gk", "d2", "mi", "mc", "md", "dc"]), offX("p4", ["k", "d1", "gk", "mi", "mc", "md", "dc"])], played);
    // a line alone: two at MED (MI and MC) give «+» at MD
    expect(famSlot(t, BOARD, xs, "kev", 5)).toEqual({ mark: "+", txt: famTxt(t, "kev", "MED", "DEL") });
    expect(famSlot(t, BOARD, xs, "kev", 1)).toEqual({ mark: "!", txt: "nunca ha jugado de defensa en el oficial" });
    // a keeper's POR alone (what every old «Portero» parses to): his line too — two at DEF, «+» on any defensa
    expect(famSlot(t, BOARD, xs, "gk", 1)).toEqual({ mark: "+", txt: "ya ha jugado de defensa (2 partidos en el oficial)" });
  });

  it("«Mover a…» says the exact position's familiarity", () => {
    const o = moveOptions(lineupOf(["gk", "d1", "d2", "mi", "mc", "x", "dc"], "2-3-1", xs), xs, "x", xAtMi(2));
    expect(o[3]).toMatchObject({ fam: "+" });
    expect(o[3].aria).toBe("Cambiar a X con MI, MI · interior izquierdo, adaptado; ya ha jugado de interior izquierdo (2 partidos en el oficial)");
    expect(o[4]).toMatchObject({ fam: null });
    expect(o[6]).toMatchObject({ fam: "!" });
  });

  it("«Mover a…» names each puesto and how well he fits it (the code with its name, never by the sign alone)", () => {
    const L = lineupOf(["gk", "d1", "d2", "mi", "mc", "x", "dc"], "2-3-1", xs);
    const o = moveOptions(L, xs, "x", FAM0);
    expect(o.map((q) => q.lab)).toEqual(["POR", "DFC", "DFC", "MI", "MC", "MD", "DC"]);
    expect(o.map((q) => q.pos)).toEqual([
      "Portero · fuera de su sitio",
      "Central · fuera de su sitio",
      "Central · fuera de su sitio",
      "Interior izquierdo · adaptado",
      "Mediocentro · adaptado",
      "Interior derecho · en su sitio",
      "Punta · fuera de su sitio",
    ]);
    expect(o[5]).toMatchObject({ here: true, aria: "MD · interior derecho: X ya está aquí" });
    expect(o[4].aria).toBe("Cambiar a X con MC, MC · mediocentro, adaptado");
    const holes = moveOptions({ ...L, slots: L.slots.map((s, i) => (i === 3 ? { ...s, playerId: null } : s)) }, xs, "x", FAM0);
    expect(holes[3].aria).toBe("Mover a X al hueco MI · interior izquierdo, adaptado");
    // who is known only by his line keeps the old row
    expect(moveOptions(L, xs, "kev", FAM0)[3]).toEqual({ i: 3, lab: "MI", sub: "Con MI: se cambian", here: false, fam: null, aria: "Cambiar a KEV con MI, MI" });
  });

  it("free mode: «Mover a…» prints the slot's exact code, not its line", () => {
    const base = lineupOf(["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "adrian"], "2-3-1", sq);
    const F = { ...base, freeMode: true, slots: base.slots.map((s, i) => (i === 3 ? { ...s, x: 50, y: 50 } : s)) };
    const o = moveOptions(F, sq, "tello", FAM0);
    expect(o[3].lab).toBe("MC");
    expect(o[3].aria).toBe("Cambiar a TELLO con HUBEROSKI, MC");
  });

  it("«En el oficial» by exact position for who has one («MI 2 · MC 1 · MD 1»), by line otherwise", () => {
    const t = familiarity([offX("p1", ["gk", "d1", "d2", "x", "mc", "md", "dc"]), offX("p2", ["gk", "d1", "d2", "x", "mc", "md", "dc"]), offX("p3", ["gk", "d1", "d2", "mi", "mc", "x", "dc"]), offX("p4", ["gk", "d1", "d2", "mi", "x", "md", "dc"])], played);
    // two at MI, one at MC and one at MD: most first, then the catalogue's order
    expect(famLine(t, "x", true)).toBe("MI 2 · MC 1 · MD 1");
    expect(famLine(t, "x")).toBe("MED 4");
    expect(famLine(t, "gk", false)).toBe("POR 4");
    expect(famLine(t, "kev", true)).toBe("");
  });

  it("«Sugerir siete» with exact positions: of two adaptados, who has played that very position goes first", () => {
    // MI: two adaptados, a (MCO, 3 points better in form) has played MC in the official, b (MCD) has played MI (+5)
    const s = squadOf([x("gk", 1, "POR"), x("d1", 2, "DFC"), x("d2", 3, "DFC"), { ...x("mc", 5, "MC"), rt: 90 }, x("md", 6, "MD"), x("dc", 9, "DC"), { ...x("a", 10, "MCO"), rt: 80 }, { ...x("b", 11, "MCD"), rt: 77 }]);
    const L = lineupOf([null, null, null, null, null, null, null], "2-3-1", s);
    const byCode = (id: string, z: string, code?: PosCode) => (code ? ((id === "b" && code === "MI") || (id === "a" && code === "MC") ? 3 : 0) : (id === "a" || id === "b") && z === "MED" ? 3 : 0);
    expect(suggestSeven(L, s, [], null, byCode).slots[3].playerId).toBe("b");
    // by the line alone both have played there: the form decides
    const byZone = (id: string, z: string) => ((id === "a" || id === "b") && z === "MED" ? 3 : 0);
    expect(suggestSeven(L, s, [], null, byZone).slots[3].playerId).toBe("a");
  });
});
