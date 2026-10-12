// The pure parts of Bloque 2: the keyboard's nudges and the words for where things are, the toolbar's
// roving index, the announcer's joining, and the caches the board reads every render.
import { describe, expect, it } from "vitest";
import { moveStroke, nudgeOf, nudgePoint, placeOf, strokeMid, toPlace, NUDGE, NUDGE_BIG } from "./drag";
import { rove } from "./handView";
import { joinLive } from "./view";
import { calledOf } from "./bench";
import { chem, chemOf } from "./quimica";
import { demoSquad, lineupOf } from "./testkit";
import type { CalMatch } from "./boards";

describe("the keyboard's nudges", () => {
  it("an arrow is a fine step, Shift a big one; other keys are not nudges", () => {
    expect(nudgeOf("ArrowUp", false)).toEqual([0, -NUDGE]);
    expect(nudgeOf("ArrowRight", true)).toEqual([NUDGE_BIG, 0]);
    expect(nudgeOf("Enter", false)).toBeNull();
  });
  it("a point stays on the pitch", () => {
    expect(nudgePoint({ x: 99, y: 1 }, 10, -10)).toEqual({ x: 100, y: 0 });
  });
  it("a stroke moves whole, as far as it can, and not at all against the edge", () => {
    const s = [{ id: "a", points: [{ x: 10, y: 10 }, { x: 95, y: 50 }] }, { id: "b", points: [{ x: 0, y: 0 }] }];
    expect(moveStroke(s, "a", 10, 0)[0].points).toEqual([{ x: 15, y: 10 }, { x: 100, y: 50 }]);
    expect(moveStroke(s, "a", 0, -20)[0].points).toEqual([{ x: 10, y: 0 }, { x: 95, y: 40 }]);
    expect(moveStroke(s, "b", -5, -5)).toBe(s);
    expect(moveStroke(s, "zz", 5, 5)).toBe(s);
    expect(strokeMid(s[0].points)).toEqual({ x: 52.5, y: 30 });
  });
  it("says where a point is", () => {
    expect(placeOf({ x: 50, y: 50 })).toBe("el centro del campo");
    expect(toPlace({ x: 50, y: 50 })).toBe("al centro del campo");
    expect(toPlace({ x: 10, y: 10 })).toBe("al área rival, banda izquierda");
    expect(toPlace({ x: 90, y: 95 })).toBe("a nuestra área, banda derecha");
    expect(toPlace({ x: 50, y: 70 })).toBe("a nuestro campo");
  });
});

describe("the toolbar's roving index", () => {
  it("wraps with the arrows, Home / End go to the ends", () => {
    expect(rove("ArrowRight", 3, 4)).toBe(0);
    expect(rove("ArrowLeft", 0, 4)).toBe(3);
    expect(rove("Home", 2, 4)).toBe(0);
    expect(rove("End", 0, 4)).toBe(3);
    expect(rove("a", 0, 4)).toBeNull();
    expect(rove("ArrowRight", 0, 0)).toBeNull();
  });
});

describe("the announcer", () => {
  it("joins what one action says in several places, once", () => {
    expect(joinLive("", "Capitán: TELLO")).toBe("Capitán: TELLO");
    expect(joinLive("Capitán: TELLO", "Capitán: TELLO")).toBe("Capitán: TELLO");
    expect(joinLive("TELLO a DFC", "ERIK entra por TELLO")).toBe("TELLO a DFC. ERIK entra por TELLO");
    // the note a toast prefixes is not said twice
    expect(joinLive("X deja la capitanía", "X deja la capitanía · Y a DFC")).toBe("X deja la capitanía · Y a DFC");
  });
});

describe("what the board reads every render, worked out once", () => {
  it("the química of the same lineup and squad is the same object", () => {
    const sq = demoSquad();
    const L = lineupOf(["evans", "illescas"], "2-3-1", sq);
    expect(chemOf(L, sq)).toBe(chemOf(L, sq));
    expect(chemOf(L, sq)).toEqual(chem(L, sq));
    expect(chemOf({ ...L }, sq)).not.toBe(chemOf(L, sq));
  });
  it("the convocatoria's called set is the same for the same match", () => {
    const m = { id: "m", conv: { starters: ["a"], bench: ["b"] } } as unknown as CalMatch;
    expect(calledOf(m)).toBe(calledOf(m));
    expect([...(calledOf(m) ?? [])]).toEqual(["a", "b"]);
    expect(calledOf(null)).toBeNull();
    expect(calledOf({ id: "n", conv: { starters: [], bench: [] } } as unknown as CalMatch)).toBeNull();
  });
});
