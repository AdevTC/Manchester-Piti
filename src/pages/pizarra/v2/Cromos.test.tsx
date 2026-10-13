// The pitch cromo draws the fit mark from its card: «✓» también, «~» adaptado, the «!» badge fuera, and
// nothing for his preferida or when nothing exact is known.
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { FitGrade } from "../../../lib/positions";
import { PitchCromo } from "./Cromos";
import type { CardView } from "./view";

const card = (fit: FitGrade | null): CardView => ({
  id: "x",
  i: 1,
  x: 50,
  y: 50,
  fx: 50,
  fy: 50,
  mx: "50",
  my: "50",
  sc: "1",
  z: 500,
  rd: "0s",
  cls: fit === 0 ? "oop" : "",
  rt: "70",
  num: 4,
  name: "X",
  zoneTxt: fit === 0 ? "DC›DFC" : "DFC",
  oop: fit === 0,
  fit,
  gal: [],
  tag: "",
  q: [true, false, false],
  spin: false,
  reel: [],
  sel: false,
  me: false,
  tgt: false,
  best: false,
  tg: "",
  aria: "X",
});
const draw = (fit: FitGrade | null, mini = false) =>
  render(<PitchCromo c={card(fit)} showGal={false} mini={mini} hov={false} focusable onTap={() => {}} />).container;
const marks = (el: HTMLElement) => [...el.querySelectorAll(".pzp-fit, .cc-oop")].map((m) => [m.textContent, m.getAttribute("aria-label")]);

describe("the fit mark on the pitch cromo", () => {
  it("one mark per grade, its glyph and its words", () => {
    expect(marks(draw(3))).toEqual([]);
    expect(marks(draw(2))).toEqual([["✓", "también juega aquí"]]);
    expect(marks(draw(1))).toEqual([["~", "adaptado"]]);
    expect(marks(draw(0))).toEqual([["!", "fuera de su posición"]]);
    expect(marks(draw(null))).toEqual([]);
  });

  it("prints the slot's code", () => {
    expect(draw(2).querySelector(".cc-top i")?.textContent).toBe("DFC");
  });

  it("as a disc only the «!» stays", () => {
    expect(marks(draw(2, true))).toEqual([]);
    expect(marks(draw(0, true))).toEqual([["!", "fuera de su posición"]]);
  });
});
