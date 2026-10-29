import { describe, expect, it } from "vitest";
import { emptyParticipation, type MatchEvent, type Participation } from "../../../functions/src/matchEngine";
import type { PosCode } from "../../../functions/src/positions";
import { fixedPositions } from "../../../functions/src/rating/fixed";
import type { RatingMatch } from "../../../functions/src/rating/types";

// The «puesto fijo» (docs/medias.md): each player's position in a match is where he started, or where a substitute
// first came on; it sets his whole rating type.

const row = (positionsPlayed: Partial<Record<PosCode, number>>): Participation => ({ ...emptyParticipation(), played: true, minutes: Object.values(positionsPlayed).reduce((s, x) => s + x, 0), positionsPlayed });
let n = 0;
const match = (starters: string[], ledger: Record<string, Participation>, events: MatchEvent[] = [], extra: Partial<RatingMatch> = {}): RatingMatch => ({ id: `f${++n}`, status: "finished", duration: 50, starters, events, ledger, ...extra });
const ev = (type: MatchEvent["type"], minute: number, playerId: string, inPlayerId?: string): MatchEvent => ({ id: `e${++n}`, type, minute, playerId, ...(inPlayerId ? { inPlayerId } : {}) });
const SEVEN: [string, PosCode][] = [["k", "POR"], ["d1", "DFC"], ["d2", "DFC"], ["mi", "MI"], ["mc", "MC"], ["md", "MD"], ["dc", "DC"]];
const lineup = (slots: [string, PosCode][] = SEVEN) => ({ system: "2-3-1", slots: slots.map(([playerId, code]) => ({ playerId, code, x: 50, y: 50 })) });

describe("the fixed position", () => {
  it("is the lineup's, whatever minutes the acta gives each position", () => {
    const ledger = Object.fromEntries(SEVEN.map(([id]) => [id, row({ MC: 50 })]));
    const m = match(SEVEN.map(([id]) => id), ledger, [], { lineup: lineup() });
    expect(Object.fromEntries(fixedPositions(m))).toEqual(Object.fromEntries(SEVEN));
    // a lineup that is not seven different players with valid codes is no lineup
    expect(fixedPositions(match(["a"], { a: row({ DC: 50 }) }, [], { lineup: lineup(SEVEN.slice(0, 6)) })).get("a")).toBe("DC");
    expect(fixedPositions(match(["a"], { a: row({ DC: 50 }) }, [], { lineup: lineup([...SEVEN.slice(0, 6), ["k", "DC"]]) })).get("a")).toBe("DC");
    // nor one whose seven are not the acta's starters (the acta changed them): the acta's minutes decide
    const changed = match(["k", "d1", "d2", "mi", "mc", "md", "x"], { ...ledger, x: row({ DC: 50 }) }, [], { lineup: lineup() });
    expect(fixedPositions(changed).get("x")).toBe("DC");
    expect(fixedPositions(changed).get("k")).toBe("MC");
  });
  it("without a lineup, the start that makes the acta's changes reproduce its minutes by position", () => {
    // a is longer at DC, but he started at MC: they swapped at 20′
    const m = match(["a", "b"], { a: row({ MC: 20, DC: 30 }), b: row({ DC: 20, MC: 30 }) }, [ev("position_swap", 20, "a", "b")]);
    expect(Object.fromEntries(fixedPositions(m))).toEqual({ a: "MC", b: "DC" });
  });
  it("a substitute's is where he first came on: whoever goes off leaves him his place; a later swap does not move it", () => {
    const m = match(["a", "b"], { a: row({ DC: 25 }), b: row({ MC: 40, DC: 10 }), c: row({ DC: 15, MC: 10 }) }, [ev("substitution", 25, "a", "c"), ev("position_swap", 40, "c", "b")]);
    expect(Object.fromEntries(fixedPositions(m))).toEqual({ a: "DC", b: "MC", c: "DC" });
  });
  it("one who comes on for a player sent off takes the place the red left empty", () => {
    const m = match(["a", "b"], { a: row({ DFC: 20 }), b: row({ MC: 50 }), c: row({ DFC: 20 }) }, [ev("red_card", 20, "a"), ev("substitution", 30, "a", "c")]);
    expect(Object.fromEntries(fixedPositions(m))).toEqual({ a: "DFC", b: "MC", c: "DFC" });
  });
  it("a starter the acta gives no position (a guest: the stored ledger holds members only) leaves only him unplaced, and whoever comes on for him", () => {
    const m = match(["a", "guest:g1"], { a: row({ DC: 50 }), c: row({ MC: 20 }) }, [ev("substitution", 30, "guest:g1", "c")]);
    expect(Object.fromEntries(fixedPositions(m))).toEqual({ a: "DC" });
  });
  it("when the acta cannot tell where they started (a swap right at half-time, no lineup), their minutes in each position decide", () => {
    const m = match(["a", "b", "c"], { a: row({ MC: 25, DFC: 25 }), b: row({ DFC: 25, MC: 25 }), c: row({ DC: 50 }) }, [ev("position_swap", 25, "a", "b")]);
    expect(Object.fromEntries(fixedPositions(m))).toEqual({ c: "DC" });
    // with the lineup it is told
    const told = { ...m, id: "told", lineup: lineup([["a", "MC"], ["b", "DFC"], ["c", "DC"], ["d", "POR"], ["e", "MI"], ["f", "MD"], ["g", "DFC"]]), starters: ["a", "b", "c", "d", "e", "f", "g"] };
    expect(Object.fromEntries(fixedPositions(told))).toMatchObject({ a: "MC", b: "DFC", c: "DC" });
  });
});
