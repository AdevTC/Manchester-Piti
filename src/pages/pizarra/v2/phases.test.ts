import { describe, expect, it } from "vitest";
import type { Lineup } from "../formations";
import { demoSquad, lineupOf } from "./testkit";
import { slotPos } from "./geometry";
import {
  blockMetres,
  charlaShape,
  clearShapeOff,
  conPositions,
  defaultShapeOff,
  fasePositions,
  phaseArrows,
  phaseAt,
  phaseView,
  RUN_MAX,
  runners,
  runnerTxt,
  setOffFormation,
  shapeOffTxt,
  shiftOffBlock,
  sinPositions,
  transPositions,
  widenOff,
} from "./phases";

// Bloque 4 · A1 (con / sin balón / transición) and A4 (the «Fases» scrubber), pure.

const sq = demoSquad();
const SEVEN = ["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "adrian"];
const L7 = (t: Partial<Lineup["tactics"]> = {}): Lineup => {
  const L = lineupOf(SEVEN, "2-3-1", sq);
  return { ...L, tactics: { ...L.tactics, ...t } };
};
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const outV = (ps: { v: number }[]) => mean(ps.slice(1).map((p) => p.v));
const spread = (ps: { u: number }[]) => mean(ps.slice(1).map((p) => Math.abs(p.u - 50)));

describe("con balón · sin balón · transición", () => {
  it("without a shape of its own, sin balón is the same system a step back and a touch narrower", () => {
    const L = L7();
    const off = defaultShapeOff(L);
    expect(off.formation).toBe("2-3-1");
    expect(off.offs).toHaveLength(7);
    expect(off.offs[0]).toEqual({ du: 0, dv: 0 });
    const con = conPositions(L);
    const sin = sinPositions(L);
    expect(outV(sin)).toBeGreaterThan(outV(con));
    expect(spread(sin)).toBeLessThan(spread(con));
    // the keeper stays in goal
    expect(sin[0]).toEqual(con[0]);
  });

  it("another system without the ball: each slot goes to that system's spot", () => {
    const L = setOffFormation(L7(), "3-2-1");
    expect(L.shapeOff?.formation).toBe("3-2-1");
    const sin = sinPositions(L);
    const ref = slotPos({ ...L, formation: "3-2-1" }, 3);
    expect(sin[3].u).toBeCloseTo(ref.u + (L.shapeOff?.offs[3].du ?? 0), 5);
    // choosing the same one again changes nothing
    expect(setOffFormation(L, "3-2-1")).toBe(L);
  });

  it("transición is halfway between both", () => {
    const L = L7();
    const a = conPositions(L);
    const b = sinPositions(L);
    transPositions(L).forEach((p, i) => {
      expect(p.u).toBeCloseTo((a[i].u + b[i].u) / 2, 0);
      expect(p.v).toBeCloseTo((a[i].v + b[i].v) / 2, 0);
    });
  });

  it("the block steps back / up and opens / closes, within its caps", () => {
    const L = shiftOffBlock(L7(), 1);
    expect(L.shapeOff?.offs[1].dv).toBe(10);
    expect(blockMetres(L.shapeOff!)).toBe(6);
    expect(shapeOffTxt(L)).toBe("2-3-1 · el bloque baja 6 m");
    let up = L;
    for (let k = 0; k < 20; k++) up = shiftOffBlock(up, -1);
    expect(up.shapeOff?.offs[1].dv).toBe(-40);
    expect(shiftOffBlock(up, -1)).toBe(up);
    const wide = widenOff(L7(), 1);
    expect(spread(sinPositions(wide))).toBeGreaterThan(spread(sinPositions(L7())));
    expect(clearShapeOff(wide).shapeOff).toBeNull();
    expect(clearShapeOff(L7())).toEqual(L7());
  });

  it("warns who runs more than 35 between both shapes (in metres), the longest first", () => {
    const L = L7();
    expect(runners(L)).toEqual([]);
    // without the ball the 9 drops to the back line: too far
    const offs = defaultShapeOff(L).offs.map((o, i) => (i === 6 ? { du: 0, dv: 40 } : o));
    const far = { ...L, shapeOff: { formation: "2-3-1" as const, offs } };
    const rs = runners(far);
    expect(rs.map((r) => r.id)).toEqual(["adrian"]);
    expect(rs[0].d).toBeGreaterThan(RUN_MAX);
    expect(runnerTxt("ADRIAN", rs[0])).toMatch(/^ADRIAN corre demasiado entre fases \(\d+ m\)$/);
    expect(charlaShape(far, (id) => id.toUpperCase())?.d).toMatch(/Ojo: ADRIAN corre demasiado/);
  });

  it("la charla only shows a shape the board has", () => {
    expect(charlaShape(L7(), (x) => x)).toBeNull();
    expect(charlaShape(setOffFormation(L7(), "3-1-2"), (x) => x)?.t).toBe("Sin balón · 3-1-2");
  });
});

describe("las fases", () => {
  it("El plan leaves everyone where the plan puts them", () => {
    const L = L7();
    expect(fasePositions(L, "plan")).toEqual(conPositions(L));
    expect(phaseAt(L, "con", "plan")).toBeNull();
  });

  it("Presión pushes the team up as much as the presión asks", () => {
    const alta = outV(fasePositions(L7({ press: "Alta" }), "presion"));
    const rep = outV(fasePositions(L7({ press: "Repliegue" }), "presion"));
    expect(alta).toBeLessThan(rep);
    expect(alta).toBeLessThan(outV(conPositions(L7({ press: "Alta" }))));
  });

  it("Bloque bajo drops and closes the team; Progresión takes it up; Salida opens the centrales", () => {
    const L = L7();
    const con = conPositions(L);
    const bl = fasePositions(L, "bloque");
    expect(outV(bl)).toBeGreaterThan(outV(con));
    expect(spread(bl)).toBeLessThan(spread(con));
    expect(outV(fasePositions(L, "progresion"))).toBeLessThan(outV(con));
    const sal = fasePositions(L, "salida");
    expect(Math.abs(sal[1].u - 50)).toBeGreaterThan(Math.abs(con[1].u - 50));
    // the foco por bandas opens the attack more than por dentro
    expect(spread(fasePositions(L7({ attackFocus: "Bandas" }), "progresion"))).toBeGreaterThan(spread(fasePositions(L7({ attackFocus: "Centro" }), "progresion")));
  });

  it("is deterministic and stays on the pitch", () => {
    const L = L7({ press: "Alta", defLine: "Alta", mentality: "Ofensiva" });
    expect(fasePositions(L, "presion")).toEqual(fasePositions(L, "presion"));
    for (const f of ["salida", "progresion", "bloque", "presion"] as const)
      fasePositions(L, f).forEach((p) => {
        expect(p.u).toBeGreaterThanOrEqual(5);
        expect(p.u).toBeLessThanOrEqual(95);
        expect(p.v).toBeGreaterThanOrEqual(5);
        expect(p.v).toBeLessThanOrEqual(97);
      });
  });

  it("the pitch shows a phase through a view (never stored) and draws an arrow for each one who moves", () => {
    const L = L7();
    const at = phaseAt(L, "con", "bloque");
    expect(at).not.toBeNull();
    const V = phaseView(L, at);
    expect(slotPos(V, 2)).toEqual(at![2]);
    // the view's own plan positions are still the board's
    expect(conPositions(V)).toEqual(conPositions(L));
    expect(phaseView(V, null).phaseAt).toBeUndefined();
    const arrows = phaseArrows(L, at!, "tv");
    expect(arrows.length).toBeGreaterThan(3);
    arrows.forEach((a) => expect(a.d).toMatch(/^M[\d.]+ [\d.]+Q/));
    expect(phaseArrows(L, at!, "tv", true)[0].c).toBe("sky");
    // sin balón / transición win over the scrubber
    expect(phaseAt(L, "sin", "presion")).toEqual(sinPositions(L));
    expect(phaseAt(L, "trans", "plan")).toEqual(transPositions(L));
  });
});
