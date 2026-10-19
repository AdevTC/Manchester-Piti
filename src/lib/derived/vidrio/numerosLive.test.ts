import { describe, expect, it } from "vitest";
import { formLetters, numerosLede } from "./numerosLive";

type Seg = Parameters<typeof formLetters>[0][number];
const seg = (jornada: number, state: Seg["state"], letter: Seg["letter"] = null, score: Seg["score"] = null): Seg => ({ jornada, state, letter, score });

describe("formLetters", () => {
  it("tonight's letter is provisional and the jornadas still to come are empty", () => {
    expect(formLetters([seg(1, "directo", null, { gf: 2, ga: 1 }), seg(2, "proximo"), seg(3, "proximo"), seg(4, "proximo")], 4)).toEqual([
      { l: "G", tone: "prov", label: "J1: ganando, si acaba así" },
      { l: "J2", tone: "empty", label: "J2: por jugar" },
      { l: "J3", tone: "empty", label: "J3: por jugar" },
      { l: "J4", tone: "empty", label: "J4: por jugar" },
    ]);
  });
  it("later in the season, the last five up to the last played", () => {
    const list = [seg(1, "jugado", "G"), seg(2, "jugado", "P"), seg(3, "jugado", "E"), seg(4, "aplazado"), seg(5, "jugado", "G"), seg(6, "jugado", "G"), seg(7, "proximo")];
    expect(formLetters(list).map((f) => f.l)).toEqual(["P", "E", "A", "G", "G"]);
  });
});

describe("numerosLede", () => {
  it("says what moves and when it is official", () => {
    expect(numerosLede("Temporada 1", 0, true)).toBe("Temporada 1. Se mueven con cada gol: lo de borde discontinuo es «si acaba así» hasta que haya acta.");
    expect(numerosLede("Temporada 1", 0, false)).toBe("Temporada 1. Aún no se ha jugado ninguna jornada: todos a cero.");
    expect(numerosLede("Temporada 1", 1, false)).toBe("Temporada 1, después de la primera jornada. Oficial desde el acta.");
  });
});
