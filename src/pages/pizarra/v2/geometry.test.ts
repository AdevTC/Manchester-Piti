import { describe, expect, it } from "vitest";
import { CAMS, depthScale, lineDepth, nearestLine, pitchArt, proj, slotLabel, slotPos, slotZone, unproj } from "./geometry";
import { lineupOf } from "./testkit";

describe("TV camera", () => {
  it("has the designed frame ratio (the CSS --fh)", () => {
    expect(CAMS.tv.Fh).toBe(1.19318);
  });

  it("unproj inverts proj across the pitch", () => {
    for (const [u, v] of [[50, 50], [10, 90], [95, 5], [30, 73]]) {
      const p = proj(CAMS.tv, u, v);
      const back = unproj(CAMS.tv, p.x, p.y);
      expect(back.u).toBeCloseTo(u, 6);
      expect(back.v).toBeCloseTo(v, 6);
    }
  });

  it("draws the far touchline narrower than the near one (perspective)", () => {
    const farW = proj(CAMS.tv, 100, 0).x - proj(CAMS.tv, 0, 0).x;
    const nearW = proj(CAMS.tv, 100, 100).x - proj(CAMS.tv, 0, 100).x;
    expect(farW).toBeLessThan(nearW);
    expect(nearW).toBeCloseTo(97, 0);
  });

  it("scales cromos by depth within 0.9–1.08", () => {
    expect(depthScale(CAMS.tv, CAMS.tv.sT)).toBeCloseTo(0.9);
    expect(depthScale(CAMS.tv, CAMS.tv.sB)).toBeCloseTo(1.08);
    expect(depthScale(CAMS.top, 1)).toBe(1);
  });

  it("builds the static pitch art once per camera", () => {
    const a = pitchArt("tv");
    expect(a.stripes).toHaveLength(12);
    expect(a.lines).toHaveLength(13);
    expect(pitchArt("tv")).toBe(a);
  });
});

describe("slots on the pitch", () => {
  it("places the system's spots, the goalkeeper never moved by the plan", () => {
    const L = lineupOf([]);
    expect(slotPos(L, 0)).toEqual({ u: 50, v: 92 });
    expect(slotPos(L, 6)).toEqual({ u: 50, v: 24 });
    expect(slotLabel(L, 3)).toBe("MI");
    expect(slotZone(L, 1)).toBe("DEF");
  });

  it("moves the block with the plan: línea alta pushes the defence up, amplitud widens", () => {
    const base = lineupOf([]);
    const alta = { ...base, tactics: { ...base.tactics, defLine: "Alta" } };
    expect(slotPos(alta, 1).v).toBe(73 - 9);
    expect(slotPos(alta, 4).v).toBeCloseTo(54 - 9 * 0.45);
    const amplia = { ...base, tactics: { ...base.tactics, width: "Amplia" } };
    expect(slotPos(amplia, 3).u).toBeCloseTo(50 + (17 - 50) * 1.13);
    expect(slotPos(amplia, 0)).toEqual(slotPos(base, 0));
  });

  it("free mode: each slot keeps its own spot and its zone comes from its depth", () => {
    const L = lineupOf([]);
    const free = { ...L, freeMode: true, slots: L.slots.map((s, i) => ({ ...s, x: 10 + i, y: i === 1 ? 70 : i === 2 ? 40 : 20 })) };
    expect(slotPos(free, 2)).toEqual({ u: 12, v: 40 });
    expect(slotZone(free, 1)).toBe("DEF");
    expect(slotZone(free, 2)).toBe("MED");
    expect(slotZone(free, 3)).toBe("DEL");
    expect(slotZone(free, 0)).toBe("POR");
    expect(slotLabel(free, 2)).toBe("MED");
  });

  it("snaps a dragged línea to the nearest value", () => {
    const L = lineupOf([]);
    expect(nearestLine(L, lineDepth(L, "Alta") + 1)).toBe("Alta");
    expect(nearestLine(L, lineDepth(L, "Baja") - 1)).toBe("Baja");
    expect(nearestLine(L, lineDepth(L, "Media"))).toBe("Media");
  });
});
