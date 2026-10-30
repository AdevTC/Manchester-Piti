import { describe, expect, it } from "vitest";
import type { ClubMatch } from "./clubData";
import { byPosition, chartPositions } from "./chartPositions";

const game = (id: string, ledger: Record<string, unknown>) => ({ id, ledger }) as unknown as ClubMatch;

describe("chart positions", () => {
  it("weights each position by its minutes across the sample and keeps the main one", () => {
    const pos = chartPositions([game("a", { k: { positionsPlayed: { POR: 50 } }, c: { positionsPlayed: { DFC: 30, LI: 10 } } }), game("b", { c: { positionsPlayed: { DFC: 10 } } })]);
    expect(pos.get("k")).toMatchObject({ x: 50, y: 93, main: "POR", minutes: 50 });
    const c = pos.get("c")!;
    expect(c.main).toBe("DFC");
    expect(c.minutes).toBe(50);
    expect(c.x).toBeCloseTo((50 * 40 + 14 * 10) / 50);
    expect(c.y).toBeCloseTo((76 * 40 + 70 * 10) / 50);
  });
  it("skips players without position minutes and orders a sheet from the goalkeeper", () => {
    const pos = chartPositions([game("a", { dc: { positionsPlayed: { DC: 20 } }, gk: { positionsPlayed: { POR: 20 } }, none: { positionsPlayed: {} } })]);
    expect(pos.has("none")).toBe(false);
    const numbers: Record<string, number> = { dc: 9, gk: 1, none: 4 };
    expect(["dc", "none", "gk"].sort(byPosition(pos, id => numbers[id]))).toEqual(["gk", "dc", "none"]);
  });
});
