// El encaje: the exact code of each slot, how well a player fits it, and the best seven a squad can put
// on each system (an exact assignment, the keeper's slot only to a declared keeper).
import { describe, expect, it } from "vitest";
import { systemDef } from "../../../lib/formations";
import type { FitGrade, PosCode, ResolvedPositions } from "../../../lib/positions";
import { lineOf, POSITIONS } from "../../../lib/positions";
import { adapted, assign, bestEncaje, boardInPlace, encajeBySystem, encajeCandidates, faltaTxt, fitAt, hasFitData, homeName, inPlace, logicGrade, out, slotCode } from "./encaje";
import { fits, natural } from "./model";
import { slotZone, SYSTEMS } from "./geometry";
import { cromo, lineupOf, squadOf } from "./testkit";

const ps = (main: PosCode | null, ...also: PosCode[]): ResolvedPositions => ({ main, also, line: main ? lineOf(main) : null });
const withPs = (id: string, num: number, main: PosCode | null, ...also: PosCode[]) => cromo(id, num, main ? lineOf(main) : undefined, { ps: ps(main, ...also) });

describe("slotCode", () => {
  it("a fixed system reads its catalogue codes, slot 0 is the keeper", () => {
    const L = lineupOf([], "2-3-1");
    expect(L.slots.map((_, i) => slotCode(L, i))).toEqual(["POR", "DFC", "DFC", "MI", "MC", "MD", "DC"]);
    const T = lineupOf([], "2-1-3");
    expect(T.slots.map((_, i) => slotCode(T, i))).toEqual(["POR", "DFC", "DFC", "MCD", "EI", "DC", "ED"]);
  });

  it("free mode: the nearest catalogue position; slot 0 stays POR; an off-pitch slot still gets a code", () => {
    const base = lineupOf([], "2-3-1");
    const slots = base.slots.map((s, i) => (i === 3 ? { ...s, x: 88, y: 68 } : i === 0 ? { ...s, x: 50, y: 48 } : i === 5 ? { ...s, x: -20, y: 130 } : s));
    const L = { ...base, freeMode: true, slots };
    expect(slotCode(L, 3)).toBe("LD");
    expect(slotCode(L, 0)).toBe("POR");
    expect(slotCode(L, 5)).toBe("LI");
    // an outfield slot dragged onto our goal is never the keeper's
    const g = { ...L, slots: L.slots.map((s, i) => (i === 1 ? { ...s, x: 50, y: 95 } : s)) };
    expect(slotCode(g, 1)).toBe("LIB");
  });

  it("free mode: the nearest code on the board's own line for the slot (its depth band), so code and line agree", () => {
    const base = lineupOf([], "2-3-1");
    // x 14, v 60 is the MED band: the nearest overall is LI, the nearest midfielder MI
    const wide = { ...base, freeMode: true, slots: base.slots.map((s, i) => (i === 3 ? { ...s, x: 14, y: 60 } : s)) };
    expect(slotCode(wide, 3)).toBe("MI");
    // the centre at v 65 is the DEF band: the nearest overall is MCD, the nearest defender DFC
    const centre = { ...base, freeMode: true, slots: base.slots.map((s, i) => (i === 3 ? { ...s, x: 50, y: 65 } : s)) };
    expect(slotCode(centre, 3)).toBe("DFC");
    expect(lineOf(slotCode(centre, 3))).toBe("DEF");
  });
});

describe("fitAt", () => {
  const sq = squadOf([
    withPs("pref", 1, "MC"),
    withPs("tamb", 2, "MI", "MC"),
    withPs("adap", 3, "MD"),
    withPs("fuera", 4, "DC"),
    cromo("nada", 5, undefined),
    cromo("linea", 6, "MED"),
    withPs("gk", 7, "POR"),
  ]);
  const L = lineupOf([], "2-3-1", sq);

  it("preferida 3 · también 2 · adaptado 1 · fuera 0 · sin datos null (MC is slot 4)", () => {
    expect(fitAt(L, sq, "pref", 4)).toBe(3);
    expect(fitAt(L, sq, "tamb", 4)).toBe(2);
    expect(fitAt(L, sq, "adap", 4)).toBe(1);
    expect(fitAt(L, sq, "fuera", 4)).toBe(0);
    expect(fitAt(L, sq, "nada", 4)).toBeNull();
    expect(fitAt(L, sq, "nobody", 4)).toBeNull();
  });

  it("without resolved positions it reads the line (pos)", () => {
    expect(fitAt(L, sq, "linea", 4)).toBe(1);
    expect(fitAt(L, sq, "linea", 1)).toBe(0);
  });

  it("the goal only takes a declared keeper", () => {
    expect(fitAt(L, sq, "gk", 0)).toBe(3);
    expect(fitAt(L, sq, "pref", 0)).toBe(0);
    expect(fitAt(L, sq, "gk", 4)).toBe(0);
  });

  it("a keeper known only by his line is in his place in goal, and fuera anywhere else", () => {
    const s = squadOf([cromo("lgk", 1, "POR"), cromo("ldef", 2, "DEF")]);
    const G = lineupOf([], "2-3-1", s);
    expect(fitAt(G, s, "lgk", 0)).toBe(2);
    expect(fitAt(G, s, "lgk", 1)).toBe(0);
    expect(fitAt(G, s, "ldef", 0)).toBe(0);
  });

  it("a per-board «Jugar de» (a zone) counts as también on its line and fuera elsewhere", () => {
    const O = { ...L, playerPositions: { fuera: "MED" as const, pref: "POR" as const } };
    expect(fitAt(O, sq, "fuera", 4)).toBe(2);
    expect(fitAt(O, sq, "fuera", 1)).toBe(0);
    expect(fitAt(O, sq, "pref", 0)).toBe(2);
    expect(fitAt(O, sq, "pref", 4)).toBe(0);
  });
});

describe("bestEncaje", () => {
  const sq = squadOf([
    withPs("k1", 1, "POR"),
    withPs("k2", 13, "POR"),
    withPs("ld", 2, "LD"),
    withPs("dfc", 4, "DFC"),
    withPs("mc1", 8, "MC"),
    withPs("mc2", 6, "MC", "MCD"),
    withPs("dc", 9, "DC"),
    withPs("ed", 7, "ED"),
  ]);
  const ALL = sq.list.map((c) => c.id);

  it("2-3-1: four in their place, the second central and both interiores missing", () => {
    const e = bestEncaje("2-3-1", ALL, sq);
    expect(e.inPlace).toBe(4);
    expect(e.missing).toEqual(["DFC", "MI", "MD"]);
    expect(e.grades).toEqual([3, 3, 1, 1, 3, 1, 3]);
    expect(e.ids[0]).toMatch(/^k[12]$/);
    expect(e.ids[1]).toBe("dfc");
    expect(e.ids[6]).toBe("dc");
  });

  it("2-1-3: the pivote and the extremo derecho are in place, only the central and the EI miss", () => {
    const e = bestEncaje("2-1-3", ALL, sq);
    expect(e.inPlace).toBe(5);
    expect(e.missing).toEqual(["DFC", "EI"]);
    expect(e.ids[3]).toBe("mc2");
    expect(e.ids[6]).toBe("ed");
  });

  it("empty slots are missing, deduped in slot order", () => {
    const e = bestEncaje("2-3-1", ["k1", "mc1", "mc2", "dc"], sq);
    expect(e.inPlace).toBe(3);
    // (mc2 also plays pivote, a neighbour of the central: adaptado at DFC as much as at an interior)
    expect(e.ids.filter((id) => id === null)).toHaveLength(3);
    expect(e.grades.filter((x) => x === 1)).toHaveLength(1);
    expect(e.missing).toEqual(["DFC", "MI", "MD"]);
  });

  it("the keeper's slot never goes to an outfield player when a keeper exists", () => {
    // gk is a central who also keeps goal (DFC 3, POR 2); a no-data player fits anywhere as 1.
    // Σgrade alone would put gk at DFC and the unknown in goal; the keeper's slot forbids it.
    const s = squadOf([withPs("gk", 1, "DFC", "POR"), cromo("x", 2, undefined)]);
    const e = bestEncaje("2-3-1", ["x", "gk"], s);
    expect(e.ids[0]).toBe("gk");
    expect(e.grades[0]).toBe(2);
  });

  it("no data at all: grades null, nobody in place and nothing «missing» (unknown is not missing)", () => {
    const s = squadOf(Array.from({ length: 9 }, (_, i) => cromo("p" + i, i + 1, undefined)));
    const e = bestEncaje("2-3-1", s.list.map((c) => c.id), s);
    expect(e.grades).toEqual([null, null, null, null, null, null, null]);
    expect(e.ids.every(Boolean)).toBe(true);
    expect(e.inPlace).toBe(0);
    expect(e.missing).toEqual([]);
  });

  it("ignores unknown and repeated ids", () => {
    const e = bestEncaje("2-3-1", ["k1", "k1", "ghost"], sq);
    expect(e.ids).toEqual(["k1", null, null, null, null, null, null]);
    expect(e.inPlace).toBe(1);
  });

  it("a player known only by his line: on his line no grade (as his cromo), off it fuera", () => {
    // a declared keeper and six midfielders known only as «Medio»: 2-3-1 puts three of them on the
    // interiores/mediocentro (unknown, never «missing») and three off their line (fuera)
    const s = squadOf([withPs("k", 1, "POR"), ...Array.from({ length: 6 }, (_, i) => cromo("m" + i, i + 2, "MED"))]);
    const e = bestEncaje("2-3-1", s.list.map((c) => c.id), s);
    expect(e.grades).toEqual([3, 0, 0, null, null, null, 0]);
    expect(e.inPlace).toBe(1);
    expect(e.missing).toEqual(["DFC", "DC"]);
  });

  it("a keeper known only by his line takes the goal (no grade, as his cromo)", () => {
    const s = squadOf([cromo("x", 1, undefined), withPs("d", 2, "DFC"), cromo("lk", 3, "POR")]);
    const e = bestEncaje("2-3-1", ["x", "d", "lk"], s);
    expect(e.ids[0]).toBe("lk");
    expect(e.grades[0]).toBeNull();
    expect(e.missing).not.toContain("POR");
  });

  it("puts as many in their place as any assignment can (brute force on small random squads)", () => {
    let seed = 11;
    const rnd = (n: number) => {
      seed = (seed * 48271) % 2147483647;
      return Math.floor((seed / 2147483647) * n);
    };
    const LINES = ["POR", "DEF", "MED", "DEL"] as const;
    const CODES = Object.keys(POSITIONS) as PosCode[];
    for (let t = 0; t < 60; t++) {
      const n = 1 + rnd(8);
      const list = Array.from({ length: n }, (_, k) => {
        const kind = rnd(4);
        if (kind === 0) return cromo("p" + k, k + 1, undefined);
        if (kind === 1) return cromo("p" + k, k + 1, LINES[rnd(4)]);
        const main = rnd(5) ? CODES[rnd(CODES.length)] : null;
        const also = [...new Set(Array.from({ length: rnd(3) }, () => CODES[rnd(CODES.length)]))].filter((c) => c !== main);
        return withPs("p" + k, k + 1, main, ...also);
      });
      const s = squadOf(list);
      const ids = list.map((c) => c.id);
      for (const sys of SYSTEMS) {
        const codes = systemDef(sys).spots.map((x) => x[0]);
        // in place = an exact preferida/también there (a line alone never is)
        const ok = (id: string, code: PosCode) => {
          const p = s.byId.get(id)?.ps;
          return !!p && (p.main === code || p.also.includes(code));
        };
        const best = (r: number, used: Set<string>): number => {
          if (r === codes.length) return 0;
          let m = best(r + 1, used); // nobody in place here
          for (const id of ids)
            if (!used.has(id) && ok(id, codes[r])) {
              used.add(id);
              m = Math.max(m, 1 + best(r + 1, used));
              used.delete(id);
            }
          return m;
        };
        expect(bestEncaje(sys, ids, s).inPlace, sys + " #" + t).toBe(best(0, new Set()));
      }
    }
  });
});

describe("assign (the Hungarian algorithm)", () => {
  const perms = (n: number): number[][] =>
    n === 0 ? [[]] : perms(n - 1).flatMap((p) => Array.from({ length: n }, (_, k) => [...p.slice(0, k), n - 1, ...p.slice(k)]));
  const total = (cost: number[][], to: number[]) => to.reduce((s, c, r) => s + cost[r][c], 0);

  it("a known matrix", () => {
    const cost = [
      [4, 1, 3],
      [2, 0, 5],
      [3, 2, 2],
    ];
    expect(assign(cost)).toEqual([1, 0, 2]);
  });

  it("matches brute force on many small matrices (a permutation of minimum cost)", () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 75 + 74) % 65537) % 26) - 12;
    for (let n = 1; n <= 6; n++)
      for (let t = 0; t < 25; t++) {
        const cost = Array.from({ length: n }, () => Array.from({ length: n }, rnd));
        const to = assign(cost);
        expect([...to].sort()).toEqual(Array.from({ length: n }, (_, k) => k));
        expect(total(cost, to)).toBe(Math.min(...perms(n).map((p) => total(cost, p))));
      }
  });
});

describe("encajeCandidates", () => {
  it("the pitch and the bench, without bajas or who said he won't come", () => {
    const sq = squadOf([
      cromo("a", 1, "POR"),
      cromo("b", 2, "DEF", { baja: "Lesionado" }),
      cromo("c", 3, "MED", { cv: "no" }),
      cromo("d", 4, "MED", { cv: "duda" }),
      cromo("e", 5, "DEL"),
      cromo("f", 6, "DEL"),
    ]);
    const L = { ...lineupOf(["a", "b", null, "d"], "2-3-1"), bench: ["e", "c", "ghost"] };
    expect(encajeCandidates(L, sq)).toEqual(["a", "d", "e"]);
  });
});

describe("the Sistema panel's words", () => {
  it("hasFitData: only an exact position counts (a line alone, or nothing, is no data)", () => {
    const sq = squadOf([withPs("a", 1, "MC"), withPs("b", 2, null, "LD"), cromo("l", 3, "DEF"), cromo("n", 4, undefined)]);
    expect(hasFitData(["a", "l"], sq)).toBe(true);
    expect(hasFitData(["b"], sq)).toBe(true);
    expect(hasFitData(["l", "n", "ghost"], sq)).toBe(false);
    expect(hasFitData([], sq)).toBe(false);
  });

  it("hasFitData: a keeper's POR alone is not data (every old «Portero» parses to it)", () => {
    const sq = squadOf([withPs("k", 1, "POR"), withPs("lp", 2, null), cromo("l", 3, "DEF"), withPs("kd", 4, "POR", "DFC")]);
    expect(hasFitData(["k", "lp", "l"], sq)).toBe(false);
    expect(hasFitData(["k", "kd"], sq)).toBe(true);
  });

  it("faltaTxt: Spanish names, «un» for all, «y» before the last, Falta / Faltan", () => {
    expect(faltaTxt([])).toBe("");
    expect(faltaTxt(["ED"])).toBe("Falta: un extremo derecho");
    expect(faltaTxt(["MCD", "ED"])).toBe("Faltan: un pivote y un extremo derecho");
    expect(faltaTxt(["POR", "DFC", "DFC", "MI"])).toBe("Faltan: un portero, un central y un interior izquierdo");
  });

  it("boardInPlace: the board's own seven, by fitAt (grade ≥ 2, «Jugar de» included); empty slots don't count", () => {
    const sq = squadOf([withPs("k", 1, "POR"), withPs("d", 4, "DFC"), withPs("m", 8, "MC"), withPs("x", 9, "DC"), cromo("n", 5, undefined)]);
    // 2-3-1: POR k ✓ · DFC d ✓ · DFC x (fuera) · MI n (no data) · MC m ✓ · MD empty · DC empty
    const L = lineupOf(["k", "d", "x", "n", "m", null, null], "2-3-1", sq);
    expect(boardInPlace(L, sq)).toBe(3);
    expect(boardInPlace({ ...L, playerPositions: { x: "DEF" as const } }, sq)).toBe(4);
    expect(boardInPlace(lineupOf([], "2-3-1", sq), sq)).toBe(0);
  });

  it("encajeBySystem: every system of the catalogue, each its best seven", () => {
    const sq = squadOf([withPs("k", 1, "POR"), withPs("d", 4, "DFC"), withPs("m", 8, "MC")]);
    const m = encajeBySystem(["k", "d", "m"], sq);
    expect(Object.keys(m)).toEqual(SYSTEMS);
    expect(m["2-3-1"]).toEqual(bestEncaje("2-3-1", ["k", "d", "m"], sq));
  });
});

describe("logicGrade", () => {
  const sq = squadOf([
    withPs("pref", 1, "MC"),
    withPs("tamb", 2, "MI", "MC"),
    withPs("adap", 3, "MD"),
    withPs("fuera", 4, "DC"),
    cromo("nada", 5, undefined),
    cromo("linea", 6, "MED"),
    withPs("gk", 7, "POR"),
    cromo("lgk", 8, "POR"),
  ]);
  const L = lineupOf([], "2-3-1", sq);

  it("exact data: fitAt's grade (MC is slot 4)", () => {
    expect(logicGrade(L, sq, "pref", 4)).toBe(3);
    expect(logicGrade(L, sq, "tamb", 4)).toBe(2);
    expect(logicGrade(L, sq, "adap", 4)).toBe(1);
    expect(logicGrade(L, sq, "fuera", 4)).toBe(0);
    expect(logicGrade(L, sq, "gk", 0)).toBe(3);
    expect(logicGrade(L, sq, "gk", 4)).toBe(0);
    expect(logicGrade(L, sq, "pref", 0)).toBe(0);
  });

  it("a line alone: 3 on his line, 0 off it; a POR line in goal is 3; no data is null", () => {
    expect(logicGrade(L, sq, "linea", 4)).toBe(3);
    expect(logicGrade(L, sq, "linea", 1)).toBe(0);
    expect(logicGrade(L, sq, "linea", 0)).toBe(0);
    expect(logicGrade(L, sq, "lgk", 0)).toBe(3);
    expect(logicGrade(L, sq, "lgk", 4)).toBe(0);
    expect(logicGrade(L, sq, "nada", 4)).toBeNull();
    expect(logicGrade(L, sq, "nobody", 4)).toBeNull();
  });

  it("a per-board «Jugar de» (a zone) is fitAt's: 2 on its line, 0 elsewhere", () => {
    const O = { ...L, playerPositions: { fuera: "MED" as const, linea: "DEF" as const, nada: "DEL" as const } };
    expect(logicGrade(O, sq, "fuera", 4)).toBe(2);
    expect(logicGrade(O, sq, "fuera", 6)).toBe(0);
    expect(logicGrade(O, sq, "linea", 1)).toBe(2);
    expect(logicGrade(O, sq, "linea", 4)).toBe(0);
    expect(logicGrade(O, sq, "nada", 6)).toBe(2);
  });

  it("inPlace / adapted / out (null is none of them)", () => {
    const gs: (FitGrade | null)[] = [3, 2, 1, 0, null];
    expect(gs.map(inPlace)).toEqual([true, true, false, false, false]);
    expect(gs.map(adapted)).toEqual([false, false, true, false, false]);
    expect(gs.map(out)).toEqual([false, false, false, true, false]);
  });

  it("line-only squads: inPlace is today's natural() and «not out» today's fits(), on every system, free mode and overrides", () => {
    const ls = squadOf([cromo("p", 1, "POR"), cromo("d", 2, "DEF"), cromo("m", 3, "MED"), cromo("f", 4, "DEL"), cromo("u", 5, undefined)]);
    const who = ls.list.map((c) => c.id);
    const free = (B: ReturnType<typeof lineupOf>) => ({ ...B, freeMode: true, slots: B.slots.map((s, i) => ({ ...s, x: (s.x + 37 * i) % 100, y: (s.y + 23 * i) % 100 })) });
    const boards = SYSTEMS.flatMap((k) => {
      const B = lineupOf([], k, ls);
      const O = { ...B, playerPositions: { d: "MED" as const, u: "DEL" as const, p: "DEF" as const } };
      return [B, O, free(B), free(O)];
    });
    let n = 0;
    for (const B of boards)
      for (let i = 0; i < B.slots.length; i++)
        for (const id of who) {
          const g = logicGrade(B, ls, id, i);
          expect(inPlace(g), id + "@" + i).toBe(natural(B, ls, id, slotZone(B, i)));
          expect(!out(g), id + "@" + i).toBe(fits(B, ls, id, slotZone(B, i)));
          expect(adapted(g)).toBe(false);
          n++;
        }
    expect(n).toBeGreaterThan(400);
  });
});

describe("homeName", () => {
  it("his preferida, else his first también, else a «Jugar de» line or his line, lower-cased (null without data)", () => {
    const sq = squadOf([withPs("pref", 1, "DC"), withPs("tamb", 2, null, "MI"), cromo("linea", 3, "DEF"), cromo("nada", 4, undefined)]);
    const L = lineupOf([], "2-3-1", sq);
    expect(homeName(L, sq, "pref")).toBe("punta");
    expect(homeName(L, sq, "tamb")).toBe("interior izquierdo");
    expect(homeName(L, sq, "linea")).toBe("defensa");
    expect(homeName(L, sq, "nada")).toBeNull();
    expect(homeName({ ...L, playerPositions: { pref: "MED" } }, sq, "pref")).toBe("centrocampista");
  });
});
