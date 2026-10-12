import { beforeEach, describe, expect, it } from "vitest";
import { dataToLineupDoc, extractLineup, lineupToData, type LineupMeta } from "../lineupDoc";
import { seedLineup } from "../lineupOps";
import { getTotalDroppedDocs, resetDroppedDocStats } from "../../../lib/docTelemetry";
import { editSig } from "./ops";
import { parseCondPlan, parseShapeOff, parseStyle, tacticaToData } from "./tacticaData";
import type { CondRule } from "../../../lib/tacticaSchemas";

// Bloque 4 · the board's tactical fields through the store: written always (so clearing clears), read
// leniently (a bad field repaired to nothing, a bad rule dropped alone), and part of the lineup's undo.

const meta: LineupMeta = { ownerUid: "u", ownerNickname: "piti", seasonId: "s", name: "Mi siete", isOfficial: false, matchId: null };
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Record<string, unknown>;
const offs = Array.from({ length: 7 }, (_, i) => ({ du: i ? -2 : 0, dv: i ? 6 : 0 }));
const rule: CondRule = { id: "r1", when: "ganando", by: 2, from: 30, key: "mentality", value: "Defensiva", sub: { out: "a", in: "b" } };

beforeEach(() => resetDroppedDocStats());

describe("tactical fields in the lineup document", () => {
  it("round-trips sin balón, the conditional plan and the style, with nothing undefined", () => {
    const L = { ...seedLineup("2-3-1", ["a", "b"]), shapeOff: { formation: "3-2-1" as const, offs }, condPlan: [rule], style: "presion" as const };
    const data = lineupToData(L, meta);
    expect(JSON.stringify(data)).not.toContain("undefined");
    const back = extractLineup(dataToLineupDoc("x", json(data)));
    expect(back.shapeOff).toEqual(L.shapeOff);
    expect(back.condPlan).toEqual([rule]);
    expect(back.style).toBe("presion");
  });

  it("writes them always: a board without them writes null, [] and «» (the autosave clears what was there)", () => {
    expect(tacticaToData(seedLineup("2-3-1", []))).toEqual({ shapeOff: null, condPlan: [], style: "" });
  });

  it("boards from before Bloque 4 load with none", () => {
    const old = json(lineupToData(seedLineup("2-3-1", ["a"]), meta));
    delete old.shapeOff;
    delete old.condPlan;
    delete old.style;
    const d = dataToLineupDoc("x", old);
    expect(d.shapeOff).toBeNull();
    expect(d.condPlan).toEqual([]);
    expect(d.style).toBeNull();
    expect(getTotalDroppedDocs()).toBe(0);
  });

  it("repairs a bad field to nothing and drops a bad rule alone (and says so)", () => {
    expect(parseShapeOff({ formation: "4-4-2", offs }, "x")).toBeNull();
    expect(parseShapeOff({ formation: "3-2-1", offs: offs.slice(0, 3) }, "x")).toBeNull();
    // offsets past the cap are brought to it
    expect(parseShapeOff({ formation: "3-2-1", offs: offs.map(() => ({ du: 99, dv: -99 })) }, "x")?.offs[1]).toEqual({ du: 40, dv: -40 });
    const rs = parseCondPlan([rule, { ...rule, id: "r2", value: "Loquísima" }, { ...rule, id: "r3", when: "empate", by: 2 }, { ...rule, id: "r4", by: 0 }, { ...rule, id: "r5", sub: { out: "a", in: "a" } }, { ...rule, id: "r6" }], "x");
    expect(rs.map((r) => r.id)).toEqual(["r1", "r6"]);
    expect(parseCondPlan("si ganamos", "x")).toEqual([]);
    expect(parseStyle("tikitaka", "x")).toBeNull();
    expect(parseStyle("", "x")).toBeNull();
    expect(parseStyle("bloque", "x")).toBe("bloque");
    expect(getTotalDroppedDocs()).toBeGreaterThanOrEqual(7);
  });

  it("keeps at most three rules, once per id", () => {
    const rs = parseCondPlan([rule, rule, { ...rule, id: "r2" }, { ...rule, id: "r3" }, { ...rule, id: "r4" }], "x");
    expect(rs.map((r) => r.id)).toEqual(["r1", "r2", "r3"]);
  });

  it("is part of the lineup's undo (editSig), and survives the store's round trip unchanged", () => {
    const L = seedLineup("2-3-1", ["a"]);
    const withRule = { ...L, condPlan: [rule] };
    expect(editSig(withRule)).not.toBe(editSig(L));
    expect(editSig({ ...L, style: "posesion" })).not.toBe(editSig(L));
    expect(editSig({ ...L, shapeOff: { formation: "2-3-1", offs } })).not.toBe(editSig(L));
    const back = extractLineup(dataToLineupDoc("x", json(lineupToData(withRule, meta))));
    expect(editSig({ ...back, bench: withRule.bench, pinned: withRule.pinned })).toBe(editSig(withRule));
    // none and its stored «nothing» read the same
    const bare = extractLineup(dataToLineupDoc("x", json(lineupToData(L, meta))));
    expect(editSig(bare)).toBe(editSig(L));
  });
});
