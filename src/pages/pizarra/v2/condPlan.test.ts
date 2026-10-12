import { describe, expect, it } from "vitest";
import type { Lineup } from "../formations";
import { demoSquad, lineupOf } from "./testkit";
import { addRule, applyRule, COND_MAX, holds, liveSuggestion, newRule, patchRule, removeRule, ruleTxt } from "./condPlan";
import type { CondRule } from "../../../lib/tacticaSchemas";

// Bloque 4 · A2 — el plan condicional, pure.

const sq = demoSquad();
const SEVEN = ["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "adrian"];
const L7 = (): Lineup => lineupOf(SEVEN, "2-3-1", sq);
const nm = (id: string) => id.toUpperCase();
const R = (p: Partial<CondRule> = {}): CondRule => ({ ...newRule("r1"), ...p });

describe("the rules", () => {
  it("up to three, each one removable", () => {
    let L = L7();
    for (let k = 1; k <= 4; k++) L = addRule(L, "r" + k);
    expect(L.condPlan?.map((r) => r.id)).toEqual(["r1", "r2", "r3"]);
    expect(COND_MAX).toBe(3);
    L = removeRule(L, "r2");
    expect(L.condPlan?.map((r) => r.id)).toEqual(["r1", "r3"]);
    expect(removeRule(L, "nope")).toBe(L);
  });

  it("stay valid as they are edited", () => {
    let L = addRule(L7(), "r1");
    L = patchRule(L, "r1", { when: "empate" });
    expect(L.condPlan?.[0]).toMatchObject({ when: "empate", by: 0 });
    L = patchRule(L, "r1", { by: 3 });
    expect(L.condPlan?.[0].by).toBe(0);
    L = patchRule(L, "r1", { when: "perdiendo" });
    expect(L.condPlan?.[0].by).toBe(1);
    L = patchRule(L, "r1", { by: 9, from: 200 });
    expect(L.condPlan?.[0]).toMatchObject({ by: 5, from: 149 });
    // a new consigna starts at its first value; a value from another consigna is refused
    L = patchRule(L, "r1", { key: "press" });
    expect(L.condPlan?.[0]).toMatchObject({ key: "press", value: "Repliegue" });
    expect(patchRule(L, "r1", { value: "Defensiva" })).toBe(L);
    L = patchRule(L, "r1", { sub: { out: "adrian", in: "kevin" } });
    expect(L.condPlan?.[0].sub).toEqual({ out: "adrian", in: "kevin" });
    L = patchRule(L, "r1", { sub: { out: "adrian", in: "adrian" } });
    expect(L.condPlan?.[0].sub).toBeUndefined();
    L = patchRule(L, "r1", { sub: { out: "adrian", in: "kevin" } });
    expect(patchRule(L, "r1", { sub: null }).condPlan?.[0].sub).toBeUndefined();
  });

  it("read as one line", () => {
    expect(ruleTxt(R({ when: "ganando", by: 2, from: 30, sub: { out: "tello", in: "kevin" } }), nm)).toBe("Si vamos ganando por 2 o más desde el 30′ → mentalidad defensiva + entra KEVIN por TELLO");
    expect(ruleTxt(R({ when: "empate", by: 0, from: 0, key: "press", value: "Alta" }), nm)).toBe("Si vamos empatando → presión alta");
    expect(ruleTxt(R({ when: "perdiendo", by: 1, from: 40, key: "defLine", value: "Alta" }), nm)).toBe("Si vamos perdiendo por 1 desde el 40′ → línea alta");
  });
});

describe("in the live match", () => {
  it("a condition holds from its minute with its score", () => {
    const r = R({ when: "ganando", by: 2, from: 30 });
    expect(holds(r, 29, 3, 0)).toBe(false);
    expect(holds(r, 30, 3, 1)).toBe(true);
    expect(holds(r, 40, 2, 1)).toBe(false);
    expect(holds(R({ when: "perdiendo", by: 1, from: 0 }), 5, 0, 1)).toBe(true);
    expect(holds(R({ when: "empate", by: 0, from: 10 }), 12, 1, 1)).toBe(true);
    expect(holds(R({ when: "empate", by: 0, from: 10 }), 12, 2, 1)).toBe(false);
  });

  it("suggests the first rule that holds and is still to do; applying it changes the consigna and plans the cambio now", () => {
    const L = { ...L7(), condPlan: [R({ id: "a", when: "perdiendo", by: 1, from: 0, key: "press", value: "Alta" }), R({ id: "b", when: "ganando", by: 1, from: 30, sub: { out: "adrian", in: "kevin" } })] };
    const live = { minute: 35, gf: 2, ga: 1, field: SEVEN };
    const s = liveSuggestion(L, live, nm);
    expect(s?.rule.id).toBe("b");
    expect(s?.subOk).toBe(true);
    expect(s?.txt).toBe("Toca el plan: vamos ganando por 1 desde el 30′ → mentalidad defensiva + entra KEVIN por ADRIAN");
    const next = applyRule(L, s!.rule, live.minute, s!.subOk, () => "s1");
    expect(next.tactics.mentality).toBe("Defensiva");
    expect(next.subs).toEqual([{ id: "s1", min: 35, out: "adrian", in: "kevin" }]);
    // done: nothing more to suggest
    expect(liveSuggestion(next, live, nm)).toBeNull();
    // too early: nothing
    expect(liveSuggestion(L, { ...live, minute: 20 }, nm)).toBeNull();
  });

  it("a cambio whose player already left is not offered (the consigna still is)", () => {
    const L = { ...L7(), condPlan: [R({ id: "b", when: "ganando", by: 1, from: 0, sub: { out: "adrian", in: "kevin" } })] };
    const s = liveSuggestion(L, { minute: 10, gf: 1, ga: 0, field: SEVEN.filter((x) => x !== "adrian") }, nm);
    expect(s?.subOk).toBe(false);
    const next = applyRule(L, s!.rule, 10, s!.subOk, () => "s1");
    expect(next.subs ?? []).toEqual([]);
  });
});
