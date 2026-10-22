import { describe, expect, it } from "vitest";
import { lineupOf, onFieldAt, onPitch, playK, pulseOf, scoreAt, stintsAt, type LedgerRow, type Slot } from "./partido";

const row = (st: [number, number][], ex: [number, string, 0 | 1][] = []): LedgerRow => ({ min: st.reduce((t, [a, b]) => t + b - a, 0), st, ex, g: 0, a: 0, sv: 0, pos: null });
const LINEUP: Slot[] = [
  { id: "a", code: "POR", x: 50, y: 95 },
  { id: "b", code: "DC", x: 50, y: 22 },
];

describe("partido: a match minute by minute", () => {
  it("names the boards' kinds for la mesa's types, ours and theirs", () => {
    expect(playK("goal_penalty")).toBe("gol");
    expect(playK("opponent_own_goal")).toBe("gol");
    expect(playK("own_goal")).toBe("rival");
    expect(playK("double_yellow")).toBe("roja");
    expect(playK("substitution")).toBe("cambio");
    expect(playK("pass")).toBe("otro");
  });

  it("an entering player takes the spot of the one he swapped with, and comes back in another one later", () => {
    const ledger = {
      a: row([[0, 50]]),
      b: row([[0, 10], [30, 50]], [[10, "c", 0], [30, "c", 1]]),
      c: row([[10, 30]], [[10, "b", 1], [30, "b", 0]]),
    };
    const on = onPitch(LINEUP, ledger, 50);
    expect(on[0]).toEqual(["a", "b"]);
    expect(on[10]).toEqual(["a", "c"]);
    expect(on[29]).toEqual(["a", "c"]);
    expect(on[30]).toEqual(["a", "b"]);
    expect(on[50]).toEqual(["a", "b"]);
  });

  it("clips stints to the moviola's minute and counts the minutes by then", () => {
    const r = row([[0, 14], [18, 32], [35, 49]]);
    expect(stintsAt(r, 20)).toEqual({ st: [[0, 14], [18, 20]], min: 16 });
    expect(stintsAt(r, 0)).toEqual({ st: [[0, 0]], min: 0 });
    expect(onFieldAt(r, 14, 50)).toBe(false);
    expect(onFieldAt(r, 13, 50)).toBe(true);
    expect(onFieldAt(r, 50, 50)).toBe(false);
  });

  it("weighs the plays into the momentum: ours above, theirs below, smoothed over the neighbours", () => {
    const p = pulseOf([{ m: 5, k: "gol" }, { m: 30, k: "rival" }], 50);
    expect(p).toHaveLength(51);
    expect(p[5]).toBe(9);
    expect(p[6]).toBeGreaterThan(0);
    expect(p[30]).toBe(-9);
    expect(p[17]).toBe(0);
  });

  it("scores by the minute", () => {
    expect(scoreAt([{ m: 2, k: "rival" }, { m: 43, k: "gol" }], 40)).toEqual({ us: 0, them: 1 });
    expect(scoreAt([{ m: 2, k: "rival" }, { m: 43, k: "gol" }], 50)).toEqual({ us: 1, them: 1 });
  });

  it("puts the starters on a 3-2-1 when the pizarra never sent the seven", () => {
    const l = lineupOf({ starters: ["p1", "p2", "p3", "p4", "p5", "p6", "p7"] });
    expect(l.map((s) => s.code)).toEqual(["POR", "LI", "DFC", "LD", "MC", "MC", "DC"]);
    expect(l[6]).toMatchObject({ id: "p7", x: 50, y: 22 });
  });
});
