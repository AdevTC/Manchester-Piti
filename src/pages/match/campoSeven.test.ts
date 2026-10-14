import { describe, expect, it } from "vitest";
import { campoSeven, campoSevenNote } from "./campoSeven";

// The Campo before the acta (M6): fans see the convocatoria's titulares; members with the pizarra's
// official see that seven, badged, and a note when the convocatoria has another one.
const S = ["a", "b", "c", "d", "e", "f", "g"];
const nm = (id: string) => id.toUpperCase();

describe("campoSeven", () => {
  it("without an official (fans, or none published): the convocatoria, as ever", () => {
    expect(campoSeven({ starters: S, bench: ["h"] }, null)).toEqual({ field: S, bench: ["h"], official: false, differs: null });
    expect(campoSeven({}, [])).toEqual({ field: [], bench: [], official: false, differs: null });
  });
  it("the official agrees with the convocatoria: its seven, badged, no note", () => {
    const r = campoSeven({ starters: [...S].reverse(), bench: ["h"] }, S);
    expect(r).toEqual({ field: S, bench: ["h"], official: true, differs: null });
    expect(campoSevenNote(r.differs, nm)).toBeNull();
  });
  it("another seven: the official's on the pitch, the convocatoria's other titular on the bench, and a note", () => {
    const r = campoSeven({ starters: [...S.slice(0, 6), "h"], bench: ["i"] }, S);
    expect(r.field).toEqual(S);
    expect(r.bench).toEqual(["h", "i"]);
    expect(r.differs).toEqual({ conv: ["h"], board: ["g"], none: false });
    expect(campoSevenNote(r.differs, nm)).toBe("La convocatoria tiene otro siete: con H en lugar de G.");
  });
  it("a convocatoria with fewer titulares, or none yet", () => {
    expect(campoSevenNote(campoSeven({ starters: S.slice(0, 5) }, S).differs, nm)).toBe("La convocatoria tiene otro siete: le faltan F y G.");
    expect(campoSevenNote(campoSeven({ starters: [] }, S).differs, nm)).toBe("La convocatoria aún no tiene siete: este es el de la pizarra.");
  });
});
