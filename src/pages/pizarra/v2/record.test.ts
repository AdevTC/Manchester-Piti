import { describe, expect, it } from "vitest";
import { cromo, demoSquad, lineupOf, squadOf } from "./testkit";
import { lineOf, type PosCode } from "../../../lib/positions";
import type { CalMatch } from "./boards";
import { lastPlayed, plannedVsPlayed, pvpTxt, recordTxt, recordWith, sevenFromStarters } from "./record";

// Bloque 4 · A6 — lo planeado frente a lo jugado, pure.

const sq = demoSquad();
const SEVEN = ["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "adrian"];
const m = (id: string, j: number, gf: number | null, ga: number | null, starters: string[], played = true): CalMatch => ({
  id,
  j,
  rival: "R" + j,
  dateMs: j * 1000,
  played,
  gf,
  ga,
  home: null,
  venue: "",
  conv: { starters, bench: [] },
});
const swap = (out: string[], inn: string[]) => SEVEN.filter((x) => !out.includes(x)).concat(inn);

describe("con este siete", () => {
  const cal = [
    m("m1", 1, 3, 1, SEVEN),
    m("m2", 2, 1, 1, swap(["adrian"], ["kevin"])),
    m("m3", 3, 0, 2, swap(["adrian", "tello"], ["kevin", "erik"])),
    m("m4", 4, 5, 0, swap(["adrian", "tello", "almachi"], ["kevin", "erik", "fer"])),
    m("m5", 5, null, null, SEVEN, false),
  ];

  it("counts the played matches started by at least five of the seven", () => {
    const r = recordWith(lineupOf(SEVEN, "2-3-1", sq), cal);
    expect(r).toEqual({ n: 3, v: 1, e: 1, d: 1, gf: 4, gc: 4 });
    expect(recordTxt(r)).toBe("Con este siete: 1V 1E 1D · 4 GF 4 GC");
  });

  it("says nothing with fewer than five in the seven, or no match in common", () => {
    expect(recordWith(lineupOf(SEVEN.slice(0, 4), "2-3-1", sq), cal).n).toBe(0);
    expect(recordTxt(recordWith(lineupOf(["fer", "brawan", "andia", "kevin", "erik", "illescas", "tello"], "2-3-1", sq), cal))).toBeNull();
  });

  it("the planned seven against the one that started its match", () => {
    const L = lineupOf(SEVEN, "2-3-1", sq);
    const p = plannedVsPlayed(L, cal[2]);
    expect(p).toEqual({ same: 5, out: ["tello", "adrian"], inn: ["kevin", "erik"] });
    expect(pvpTxt(p!, (x) => x.toUpperCase())).toBe("Jugaron 5 de los 7 planeados · no salieron TELLO, ADRIAN · salieron KEVIN, ERIK");
    expect(plannedVsPlayed(L, cal[4])).toBeNull();
    expect(plannedVsPlayed(L, null)).toBeNull();
  });
});

describe("copiar el siete del último partido", () => {
  it("the last played match with its seven", () => {
    expect(lastPlayed([m("a", 1, 1, 0, SEVEN), m("b", 3, 0, 0, SEVEN), m("c", 4, null, null, SEVEN, false), m("d", 2, 2, 2, SEVEN)])?.id).toBe("b");
    expect(lastPlayed([m("x", 1, 1, 0, [])])).toBeNull();
  });

  it("places the starters by position: the keeper in goal, each one in his line, the rest where there is room", () => {
    const L = lineupOf([], "2-3-1", sq);
    // listed in any order
    const s = sevenFromStarters("2-3-1", ["adrian", "huberoski", "illescas", "evans", "almachi", "tello", "eguzquiza"], sq, L);
    expect(s[0]).toBe("evans");
    expect([s[1], s[2]].sort()).toEqual(["illescas", "tello"]);
    expect(s[6]).toBe("adrian");
    expect(new Set(s).size).toBe(7);
    // an unknown id is left out; two forwards for one DC: the second goes to a free slot
    const t = sevenFromStarters("2-3-1", ["ghost", "evans", "adrian", "erik"], sq, L);
    expect(t.filter(Boolean)).toHaveLength(3);
    expect(t[0]).toBe("evans");
    expect(t).not.toContain("ghost");
  });

  it("with exact positions, each starter goes where he fits best (in place before adaptado), the keeper in goal", () => {
    const x = (id: string, num: number, main: PosCode, also: PosCode[] = []) => cromo(id, num, lineOf(main), { ps: { main, also, line: lineOf(main) } });
    const xs = squadOf([x("gk", 1, "POR"), x("d1", 2, "DFC"), x("d2", 3, "LI"), x("mi", 4, "MI"), x("md", 6, "MD"), x("mco", 5, "MCO", ["MC"]), x("dc", 9, "DC")]);
    const L = lineupOf([], "2-3-1", xs);
    // by line the first midfielder listed would take MI: md, mco, mi in that order
    const s = sevenFromStarters("2-3-1", ["dc", "md", "mco", "mi", "d2", "gk", "d1"], xs, L);
    // 2-3-1: POR · DFC DFC · MI MC MD · DC
    expect(s).toEqual(["gk", expect.any(String), expect.any(String), "mi", "mco", "md", "dc"]);
    expect([s[1], s[2]].sort()).toEqual(["d1", "d2"]);
    // a «Jugar de» on the board counts: mi said to play MD swaps sides with md
    const J = { ...L, playerPositions: { mi: "MD" as const, md: "MI" as const } };
    expect(sevenFromStarters("2-3-1", ["dc", "md", "mco", "mi", "d2", "gk", "d1"], xs, J).slice(3, 6)).toEqual(["md", "mco", "mi"]);
  });
});
