import { describe, expect, it } from "vitest";
import { displacementMap, roundedRectSdf } from "./refraction";
import { bokehDiscs, seeded, skyAt, skyLightOf } from "./sky";

describe("the light field", () => {
  it("maps the site's light keys onto the boards' lights", () => {
    expect(skyLightOf("noche")).toBe("flood");
    expect(skyLightOf("noche", false)).toBe("late");
    expect(skyLightOf("ocaso", true)).toBe("flood");
    expect(skyLightOf("ocaso")).toBe("golden");
    expect(skyLightOf("dorada")).toBe("golden");
    expect(skyLightOf("tarde")).toBe("noon");
    expect(skyLightOf("dia")).toBe("noon");
    expect(skyLightOf("noon")).toBe("noon");
  });

  it("reads the real sun over Palomeras", () => {
    // 19 Oct 2026, 22:00 in Madrid: night, floodlights on
    expect(skyAt(Date.UTC(2026, 9, 19, 20, 0))).toEqual({ light: "noche", floodlit: true });
    // the same day at 14:00: day
    expect(skyAt(Date.UTC(2026, 9, 19, 12, 0)).light).toBe("dia");
  });

  it("the same bokeh every time, at most 40 discs, banks at night", () => {
    const a = bokehDiscs("flood", 1440, 900);
    expect(a).toEqual(bokehDiscs("flood", 1440, 900));
    expect(a.length).toBeLessThanOrEqual(40);
    expect(a.filter((d) => d.y < 100).length).toBeGreaterThanOrEqual(20);
    for (const l of ["golden", "late", "noon", "day"] as const) expect(bokehDiscs(l, 390, 844).length).toBeGreaterThan(0);
    const r = seeded(3);
    expect(r()).toBeGreaterThanOrEqual(0);
  });
});

describe("refraction map", () => {
  it("the rounded rectangle's distance: negative inside, zero on the edge", () => {
    expect(roundedRectSdf(100, 50, 200, 100, 20)).toBe(-50);
    expect(roundedRectSdf(0, 50, 200, 100, 20)).toBeCloseTo(0);
  });

  it("flat in the middle, bent at the rim (pushing inwards)", () => {
    const m = displacementMap(200, 100, 20, 22);
    const px = (x: number, y: number) => {
      const k = (y * m.width + x) * 4;
      return [m.data[k], m.data[k + 1]];
    };
    expect(px(100, 50)).toEqual([128, 128]);
    const [r] = px(0, 50);
    expect(r).toBeGreaterThan(200);
    const [r2] = px(199, 50);
    expect(r2).toBeLessThan(60);
  });
});
