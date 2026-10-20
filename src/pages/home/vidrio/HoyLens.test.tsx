import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { goalClasses, type RibbonItem } from "../../../components/vidrio";
import type { LensFace } from "../hoyModel";
import { HoyLens } from "./HoyLens";

// our goals at 6′ and 21′, theirs at 11′ (a 50-minute match)
const ITEMS: RibbonItem[] = [
  { id: "g1", x: 12, side: "us", goal: true, h: 26, kind: "gol" },
  { id: "g2", x: 22, side: "them", goal: true, h: 26, kind: "gol" },
  { id: "g3", x: 42, side: "us", goal: true, h: 26, kind: "gol" },
];
const FACE: LensFace = { mode: "score", gf: 2, ga: 1, big: "", under: "", status: { live: false, clock: null, text: "Final." }, ribbon: "momentum", label: "Manchester Piti 2, Orduña fc 1" };

const lens = (nowMinute?: number) =>
  render(<HoyLens face={FACE} rival="Orduña fc" rivalCode="OR" home items={ITEMS} duration={50} nowMinute={nowMinute} sun={null} goal={goalClasses("idle", null)} />);

describe("HoyLens ribbon", () => {
  it("is gold on our latest goal while the match is live", () => {
    const { container } = lens(23);
    expect(container.querySelectorAll(".vd-ribbon__mark--gold")).toHaveLength(1);
  });

  it("has no gold once the match is over (the boards: gold is the goal of the moment)", () => {
    const { container } = lens(undefined);
    expect(container.querySelectorAll(".vd-ribbon__mark--gold")).toHaveLength(0);
    expect(container.querySelector(".vd-peak")).toBeNull();
  });
});

describe("HoyLens word", () => {
  /** jsdom lays nothing out: the word and its column get these widths. */
  function widths(word: number, column: number) {
    const offset = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");
    const client = Object.getOwnPropertyDescriptor(Element.prototype, "clientWidth");
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, get: function (this: HTMLElement) { return this.classList.contains("vi-word__t") ? word : 0; } });
    Object.defineProperty(Element.prototype, "clientWidth", { configurable: true, get: function (this: Element) { return this.classList.contains("vi-word") ? column : 0; } });
    return () => {
      if (offset) Object.defineProperty(HTMLElement.prototype, "offsetWidth", offset);
      if (client) Object.defineProperty(Element.prototype, "clientWidth", client);
    };
  }
  const said = (big: string): LensFace => ({ mode: "word", gf: 0, ga: 0, big, under: "", status: { live: false, clock: null, text: "" }, ribbon: null, label: `${big}.` });
  const word = (big: string) => render(<HoyLens face={said(big)} rival="Orduña fc" rivalCode="OR" home items={[]} duration={50} sun={null} goal={goalClasses("idle", null)} />);

  it("a word wider than its column (a phone's «Pretemporada») is set smaller to fit it, its words whole for the reader", () => {
    const restore = widths(213, 170);
    try {
      const { container, getByRole } = word("Pretemporada");
      const t = container.querySelector<HTMLElement>(".vi-word__t");
      expect(Number(t?.style.getPropertyValue("--fit"))).toBeCloseTo(170 / 213, 3);
      expect(getByRole("img", { name: "Pretemporada." })).toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it("a word that fits keeps its size", () => {
    const restore = widths(140, 170);
    try {
      const { container } = word("Aplazado");
      expect(container.querySelector<HTMLElement>(".vi-word__t")?.style.getPropertyValue("--fit")).toBe("1");
    } finally {
      restore();
    }
  });
});
