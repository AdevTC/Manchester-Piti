import { describe, expect, it } from "vitest";
import { PITCH_RATIO, printView } from "./printSheet";
import { demoSquad, lineupOf, squadOf } from "./testkit";
import { newRival, setRivalNote, setRivalNum } from "./rival";

// La hoja del plan: el siete en su sitio (vista cenital), el banquillo (los convocados, sin bajas ni «no
// va»), las consignas, las tandas, los lanzadores y las notas del rival.

const sq = demoSquad();
const SEVEN = ["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "adrian"];

describe("the plan's sheet", () => {
  it("the seven on the pitch, the captain marked; the bench without bajas", () => {
    const L = { ...lineupOf(SEVEN, "2-3-1", sq), roles: { captainId: "adrian" } };
    const v = printView(L, sq, { name: "J8 · MAD SKY", match: "J8 · MAD SKY · sáb 8 nov", called: null });
    expect(v.title).toBe("J8 · MAD SKY");
    expect(v.sub).toBe("J8 · MAD SKY · sáb 8 nov · 2-3-1");
    expect(v.seven).toHaveLength(7);
    expect(v.empty).toBe(0);
    const gk = v.seven[0];
    expect(gk).toMatchObject({ name: "EVANS", num: 1, pos: "POR", cap: false });
    // our goal at the bottom of the sheet, the forward at the top
    expect(gk.y).toBeGreaterThan(80 * PITCH_RATIO);
    expect(v.seven.find((s) => s.name === "ADRIAN")).toMatchObject({ cap: true });
    expect(v.seven.find((s) => s.name === "ADRIAN")!.y).toBeLessThan(40 * PITCH_RATIO);
    // brawan (lesionado) and andia (sancionado) are not on the bench
    expect(v.bench).toEqual(["FER", "ERIK", "KEVIN"]);
  });

  it("free mode: each of the seven wears the slot's exact code, not its line", () => {
    const base = lineupOf(SEVEN, "2-3-1", sq);
    const F = { ...base, freeMode: true, slots: base.slots.map((s, i) => (i === 3 ? { ...s, x: 50, y: 50 } : s)) };
    const v = printView(F, sq, { name: "J8", match: "J8", called: null });
    expect(v.seven.find((s) => s.name === "HUBEROSKI")?.pos).toBe("MC");
  });

  it("only the convocados on the bench when the convocatoria is known; «no va» never", () => {
    const sq2 = squadOf(sq.list.map((c) => (c.id === "erik" ? { ...c, cv: "no" as const } : c)));
    const v = printView(lineupOf(SEVEN, "2-3-1", sq2), sq2, { name: "x", match: "", called: new Set([...SEVEN, "fer", "erik"]) });
    expect(v.bench).toEqual(["FER"]);
    expect(v.sub).toBe("2-3-1");
  });

  it("consignas, tandas, lanzadores and the rival's notes", () => {
    let riv = newRival("3-2-1");
    riv = setRivalNum(riv, 6, "9");
    riv = setRivalNote(riv, 6, "Rápido al espacio");
    const L = {
      ...lineupOf(SEVEN, "2-3-1", sq),
      subs: [
        { id: "s1", min: 25, out: "adrian", in: "kevin" },
        { id: "s2", min: 25, out: "almachi", in: "erik" },
      ],
      takers: { penalties: ["adrian", "huberoski"], freekicks: [], corners: ["eguzquiza"] },
      rival: riv,
    };
    const v = printView(L, sq, { name: "x", match: "", called: null });
    expect(v.consignas).toHaveLength(7);
    expect(v.consignas[0]).toEqual({ t: "Línea media", d: "Ni encima del portero ni a la espalda." });
    expect(v.tandas).toEqual(["25′ · KEVIN por ADRIAN, ERIK por ALMACHI"]);
    expect(v.takers).toEqual([
      { k: "Penaltis", v: "ADRIAN › HUBEROSKI" },
      { k: "Córners", v: "EGUZQUIZA" },
    ]);
    expect(v.rivalSys).toBe("3-2-1");
    expect(v.rival).toEqual([{ who: "El 9 (DC)", note: "Rápido al espacio" }]);
  });

  it("an unfinished seven says how many are missing; no rival, none", () => {
    const v = printView(lineupOf(["evans", "adrian"], "2-3-1", sq), sq, { name: "x", match: "", called: null });
    expect(v.seven).toHaveLength(2);
    expect(v.empty).toBe(5);
    expect(v.rivalSys).toBeNull();
    expect(v.rival).toEqual([]);
  });
});
