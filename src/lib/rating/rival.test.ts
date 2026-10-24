import { describe, expect, it } from "vitest";
import type { ClubMatch } from "../clubData";
import type { Standings } from "../standings";
import { RIVAL_MAX } from "./constants";
import { rivalFactor } from "./rival";

const US = "MANCHESTER PITI";
const table = (rows: [string, number, number][], o: Partial<Standings> = {}): Standings => ({
  id: "s",
  competition: "Liga",
  jornada: null,
  updatedAt: 0,
  updatedBy: "",
  rows: rows.map(([team, pj, pts]) => ({ team, pj, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts, isUs: team === US })),
  ...o,
});
let n = 0;
const game = (rival: string, o: Partial<ClubMatch> = {}): ClubMatch => ({ id: `m${++n}`, seasonId: "s", rival, competition: "Liga", status: "finished", date: n, duration: 50, goalsFor: 0, goalsAgainst: 0, events: [], ...o });

// three rivals after six jornadas: 3, 1,5 and 0 points a match (and us, never a rival)
const LEAGUE = table([["ORDUÑA F.C.", 6, 18], ["Rayo Bilbao", 6, 9], ["CD Débiles", 6, 0], [US, 6, 9]]);

describe("the rival's strength from the current table", () => {
  it("a strong rival makes the match count more, a weak one less, a mid-table one not at all", () => {
    const strong = game("Orduña fc"), mid = game("Rayo Bilbao"), weak = game("Débiles");
    const f = rivalFactor([LEAGUE], [strong, mid, weak]);
    // ppg pulled with two matches at the league's 1,5: 2,625 / 1,5 / 0,375 → z/2 ≈ ±0,61
    expect(f(strong)).toBeCloseTo(1 + RIVAL_MAX * (1.125 / Math.sqrt(0.84375) / 2), 6);
    expect(f(mid)).toBe(1);
    expect(f(strong) - 1).toBeCloseTo(1 - f(weak), 10);
  });
  it("never more than ±15 %", () => {
    const six = table([["Líder", 6, 18], ["Bravo", 6, 0], ["C", 6, 0], ["D", 6, 0], ["E", 6, 0], ["F", 6, 0], [US, 6, 9]]);
    const top = game("Líder"), bottom = game("Bravo");
    const f = rivalFactor([six], [top, bottom]);
    expect(f(top)).toBeCloseTo(1 + RIVAL_MAX, 10);
    expect(f(bottom)).toBeGreaterThanOrEqual(1 - RIVAL_MAX);
  });
  it("names as the league writes them; a name that fits two rows adjusts nothing", () => {
    const two = table([["Atlético Bilbao", 6, 18], ["Bilbao Athletic", 6, 0], ["Otro", 6, 9], [US, 6, 9]]);
    const vague = game("Bilbao"), exact = game("ATLETICO BILBAO"), unnamed = game("");
    const f = rivalFactor([two], [vague, exact, unnamed]);
    expect(f(vague)).toBe(1);
    expect(f(exact)).toBeGreaterThan(1);
    expect(f(unnamed)).toBe(1);
  });
  it("a table more than two jornadas behind adjusts nothing; a friendly is not a jornada", () => {
    const behind = { ...LEAGUE, jornada: 2 };
    const league = [game("Orduña"), game("Rayo Bilbao"), game("Débiles"), game("Orduña")];
    expect(rivalFactor([behind], [...league, game("Débiles")])(league[0])).toBe(1);
    expect(rivalFactor([behind], [...league, game("Débiles", { competition: "Amistoso" })])(league[0])).toBeGreaterThan(1);
  });
  it("another season's table, or one with fewer than two rivals, adjusts nothing", () => {
    const m = game("Orduña");
    expect(rivalFactor([{ ...LEAGUE, id: "otra" }], [m])(m)).toBe(1);
    expect(rivalFactor([table([["ORDUÑA F.C.", 6, 18], [US, 6, 9]])], [m])(m)).toBe(1);
  });
});
