// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { fakeBoard, fakeLineup, fakeWorld, makeTestStore } from "../../store/testkit";
import type { CondRuleR14 } from "../../../data/condPlan";
import type { PzMatch } from "../../store/types";
import { planLive, planResumen, planRuleShort, planRuleText, ruleLive, vizOf } from "./planView";

const NAMES: Record<string, string> = { alcides: "ALCIDES", kevin: "KEVIN" };
const name = (id: string) => NAMES[id] ?? id;

const lose35: CondRuleR14 = { id: "r1", when: "perdiendo", by: 1, from: 35, key: "mentality", value: "Ofensiva", sub: { out: "alcides", in: "kevin" } };
const tie: CondRuleR14 = { id: "r2", when: "empate", by: 0, from: 0, key: "press", value: "=", ver: "planb" };

function board() {
  const L = fakeLineup("3-2-1", ["evans", "fer", "erik", "jordi", "adrian", "eguzquiza", "alcides"]);
  L.takers = { penalties: ["alcides"], freekicks: ["adrian"], corners: [] };
  L.style = "presion";
  L.plan = { claves: ["Presión alta los diez primeros minutos", "Que no gire su 7"], viz: [], notes: "Calentar 20 min", parado: null };
  L.rival = { formation: "2-3-1", players: [{}, {}, {}, { num: 7, note: "El mejor: no le dejes girar" }, {}, {}, {}] };
  L.condPlan = [lose35, tie];
  return fakeBoard({ lineup: L });
}

describe("planRuleText", () => {
  it("says the rule as the prototype does, «empate» read as «empatando»", () => {
    expect(planRuleText(lose35, name)).toBe("Si vamos perdiendo por 1 desde el 35′ → más arriba + entra KEVIN por ALCIDES");
    expect(planRuleText(tie, name)).toBe("Si vamos empatando desde el principio → Plan B");
    expect(planRuleText({ ...tie, ver: undefined }, name)).toBe("Si vamos empatando desde el principio → sin cambiar nada");
  });
  it("a consigna outside the prototype's list still reads in words", () => {
    expect(planRuleText({ id: "x", when: "ganando", by: 2, from: 30, key: "press", value: "Media" }, name)).toBe("Si vamos ganando por 2 desde el 30′ → presión media");
  });
  it("the short one for a chip", () => {
    expect(planRuleShort(lose35)).toBe("Si perdemos desde el 35′ → más arriba");
    expect(planRuleShort(tie)).toBe("Si empatamos desde el principio → Plan B");
  });
});

describe("ruleLive", () => {
  it("on when the score and the minute hold", () => {
    expect(ruleLive(lose35, { minute: 36, gf: 1, ga: 2 })).toEqual({ on: true, t: "Toca el plan: vamos perdiendo (Piti 1–2) desde el 35′." });
    expect(ruleLive(lose35, { minute: 20, gf: 1, ga: 2 }).on).toBe(false);
    expect(ruleLive(lose35, { minute: 40, gf: 2, ga: 1 })).toEqual({ on: false, t: "Ahora no toca: ganamos 2–1 en el 40′." });
  });
});

describe("planLive", () => {
  it("the first rule that holds, with the live override", () => {
    const { P } = makeTestStore({ world: fakeWorld({ boards: [board()] }) });
    const l = planLive(P, { minute: 38, gf: 0, ga: 1 });
    expect(l?.rule.id).toBe("r1");
    expect(l?.text).toContain("entra KEVIN por ALCIDES");
    expect(planLive(P, { minute: 10, gf: 1, ga: 1 })?.rule.id).toBe("r2");
    expect(planLive(P, { minute: 10, gf: 2, ga: 1 })).toBeNull();
  });
  it("null when the match isn't being played", () => {
    const { P } = makeTestStore({ world: fakeWorld({ boards: [board()] }) });
    expect(planLive(P)).toBeNull();
    expect(planLive(P, null)).toBeNull();
  });
  it("reads la mesa's clock and score while live", () => {
    const at = Date.UTC(2026, 10, 8, 17, 0);
    const now = at + 38 * 60_000;
    const j3: PzMatch = {
      id: "j3", j: 3, rival: "Red Demons", home: true, at, played: false, gf: null, ga: null, venue: "", phase: "juego",
      cal: { id: "j3", j: 3, rival: "Red Demons", dateMs: at, played: false, gf: null, ga: null, home: true, venue: "", events: [{ id: "e1", type: "opponent_goal", minute: 14 } as never] },
    };
    const { P } = makeTestStore({ world: fakeWorld({ now, matches: [j3], boards: [board()] }) });
    const l = planLive(P);
    expect(l?.rule.id).toBe("r1");
    expect(l?.live).toBe("Toca el plan: vamos perdiendo (Piti 0–1) desde el 35′.");
  });
});

describe("planResumen", () => {
  it("the plan of a glance", () => {
    const { P } = makeTestStore({ world: fakeWorld({ boards: [board()] }) });
    const r = planResumen(P);
    expect(r).not.toBeNull();
    expect(r?.rival).toBe("Red Demons");
    expect(r?.match).toMatch(/^J3 · dom 8 nov · \d\d:\d\d · en casa$/);
    expect(r?.danger).toBe("Su 7 (MI): El mejor: no le dejes girar");
    expect(r?.claves).toEqual([
      { t: "Presión alta los diez primeros minutos", icon: "spark" },
      { t: "Que no gire su 7", icon: "eye" },
    ]);
    expect(r?.juego).toBe("Presión alta · sin balón, 3-2-1");
    expect(r?.parado).toBe("Córners: — · Faltas: ADRIÁN T.C. · Penaltis: ALCIDES");
    expect(r?.sipasa).toHaveLength(2);
    expect(r?.notas).toBe("Calentar 20 min");
  });
  it("an empty board says nothing is set; no board → null", () => {
    const { P } = makeTestStore();
    const r = planResumen(P);
    expect(r?.claves).toEqual([]);
    expect(r?.danger).toBe("");
    expect(r?.juego).toBe("Sin estilo · sin balón, 3-2-1");
    expect(planResumen(P, "nope")).toBeNull();
  });
  it("a stored viz beats the guess", () => {
    const L = fakeLineup();
    L.plan = { claves: ["Presión"], viz: [{ icon: "shield", zona: "medio" }], notes: "", parado: null };
    expect(vizOf(L, 0)).toEqual({ icon: "shield", zona: "medio" });
  });
});
