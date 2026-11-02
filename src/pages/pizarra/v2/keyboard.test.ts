// The pure parts of Bloque 2 that the new pizarra still uses: the announcer's joining and the caches read every render.
import { describe, expect, it } from "vitest";
import { joinLive } from "./view";
import { chem, chemOf } from "./quimica";
import { demoSquad, lineupOf } from "./testkit";

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
});
