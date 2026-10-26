import { describe, expect, it } from "vitest";
import { draftItems, placeName, previewPitch, swappedPlaces } from "./recolocar";
import type { MesaPlayer } from "./types";

const p = (id: string, more: Partial<MesaPlayer> = {}): MesaPlayer => ({
  id, name: id, number: "", guest: false, keeper: false, minutes: 10, pending: 0, played: true, offAt: null, sentOff: false, vacancy: null, pos: null, stints: [], spot: null,
  stickers: { goals: 0, assists: 0, yellow: false, red: false, injured: false },
  ...more,
});

describe("recolocar", () => {
  const field = [p("ev", { keeper: true, pos: "POR", spot: { x: 50, y: 93 } }), p("jo", { pos: "DFC", spot: { x: 50, y: 76 } }), p("al", { pos: "DC", spot: { x: 50, y: 14 } })];
  const bench = [p("fe", { played: false, minutes: 0 })];

  it("la ola: primero los cambios, luego las recolocaciones en el orden hecho", () => {
    expect(draftItems({ subs: [{ outId: "jo", inId: "fe" }], swaps: [["fe", "al"], ["ev", "al"]] })).toEqual([
      { type: "substitution", playerId: "jo", inPlayerId: "fe" },
      { type: "position_swap", playerId: "fe", inPlayerId: "al" },
      { type: "position_swap", playerId: "ev", inPlayerId: "al" },
    ]);
  });

  it("el que entra ocupa el sitio del que sale, que se va al banquillo", () => {
    const v = previewPitch(field, bench, { subs: [{ outId: "jo", inId: "fe" }], swaps: [] }, 18);
    expect(v.field.map((x) => x.id)).toEqual(["ev", "fe", "al"]);
    expect(v.field[1]).toMatchObject({ pos: "DFC", spot: { x: 50, y: 76 }, keeper: false });
    expect(v.bench).toEqual([expect.objectContaining({ id: "jo", offAt: 18, spot: null, pos: null })]);
  });

  it("una recolocación intercambia sitio, posición y guantes, sin mover a nadie de la lista", () => {
    const v = previewPitch(field, bench, { subs: [{ outId: "jo", inId: "fe" }], swaps: [["fe", "al"], ["ev", "al"]] }, 18);
    expect(v.field.map((x) => [x.id, x.pos, x.keeper])).toEqual([["ev", "DFC", false], ["fe", "DC", false], ["al", "POR", true]]);
  });

  it("el hueco de una roja: el que entra se pone en él", () => {
    const sent = p("da", { sentOff: true, vacancy: { spot: { x: 30, y: 74 }, code: "LI" } });
    const v = previewPitch(field, [...bench, sent], { subs: [{ outId: "da", inId: "fe" }], swaps: [] }, 20);
    expect(v.field.at(-1)).toMatchObject({ id: "fe", pos: "LI", spot: { x: 30, y: 74 } });
    expect(v.bench).toEqual([expect.objectContaining({ id: "da", vacancy: null })]);
  });

  it("sin borrador, el campo tal cual; las posiciones del descanso tras las recolocaciones", () => {
    expect(previewPitch(field, bench, null, 1).field).toEqual(field);
    const places = swappedPlaces(new Map([["a", "DC"], ["b", "MC"], ["c", null]]), [["a", "b"], ["b", "c"], ["a", "zz"]]);
    expect([...places]).toEqual([["a", "MC"], ["b", null], ["c", "DC"]]);
    expect(placeName("LI")).toBe("lateral izquierdo");
    expect(placeName(null)).toBe("");
  });
});
