import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { pressureAt, ribbonModel, type RibbonItem } from "./momentum";
import { MomentumRibbon } from "./MomentumRibbon";

// a 50-minute match at minute 23: our goals at 6′ and 21′, theirs at 11′, a yellow at 15′, the post at 18′
const ITEMS: RibbonItem[] = [
  { id: "g1", x: 12, side: "us", goal: true, h: 26, kind: "gol", label: "Minuto 6, gol de Alcides" },
  { id: "g2", x: 22, side: "them", goal: true, h: 26, kind: "gol", label: "Minuto 11, gol de Orduña fc" },
  { id: "c1", x: 30, side: "us", goal: false, h: 18, kind: "tarjeta", label: "Minuto 15, amarilla a Eguzquiza" },
  { id: "p1", x: 36, side: "us", goal: false, h: 16, kind: "palo", label: "Minuto 18, al palo" },
  { id: "g3", x: 42, side: "us", goal: true, h: 26, kind: "gol", label: "Minuto 21, gol de Adrián T.C." },
  { id: "o1", x: 44, side: "us", goal: false, h: 12, kind: "ocasion" },
  { id: "late", x: 80, side: "us", goal: true, h: 26, kind: "gol" },
];

describe("ribbonModel", () => {
  it("presses where the plays are, and only up to now", () => {
    expect(pressureAt(ITEMS, "us", 42, 46)).toBeGreaterThan(pressureAt(ITEMS, "us", 60, 46));
    expect(pressureAt(ITEMS, "them", 22, 46)).toBeGreaterThan(pressureAt(ITEMS, "them", 40, 46));
    expect(pressureAt(ITEMS, "us", 80, 46)).toBeCloseTo(0.12, 2);
  });

  it("marks goals, cards and posts (not small chances), gold on our latest goal, the now line", () => {
    const m = ribbonModel(ITEMS, 50, 23);
    expect(m.marks.map((k) => [k.id, k.icon, k.gold])).toEqual([
      ["g1", "ball", false],
      ["g2", "ball", false],
      ["c1", "card", false],
      ["p1", "post", false],
      ["g3", "ball", true],
    ]);
    expect(m.marks.find((k) => k.id === "g2")?.top).toBe(76);
    expect(m.now).toBe(46);
    expect(m.peak).toMatch(/^M194 37 /);
    expect(m.labels.map((l) => l.text)).toEqual(["0′", "Descanso", "50′"]);
  });

  it("after the final whistle: every play, no now line; goldId null switches the gold off", () => {
    const m = ribbonModel(ITEMS, 50, undefined, null);
    expect(m.now).toBeNull();
    expect(m.marks).toHaveLength(6);
    expect(m.marks.some((k) => k.gold)).toBe(false);
    expect(m.peak).toBeNull();
  });
});

describe("MomentumRibbon", () => {
  it("one named group, each mark an image with its words", () => {
    render(<MomentumRibbon items={ITEMS} duration={50} now={23} />);
    const group = screen.getByRole("group", { name: /minuto a minuto/ });
    expect(within(group).getAllByRole("img").map((i) => i.getAttribute("aria-label"))).toEqual([
      "Minuto 6, gol de Alcides",
      "Minuto 11, gol de Orduña fc",
      "Minuto 15, amarilla a Eguzquiza",
      "Minuto 18, al palo",
      "Minuto 21, gol de Adrián T.C.",
    ]);
  });
});
