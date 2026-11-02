// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { CARTEL_GAP, cartelLayout, spreadCromos } from "./cartel";
import { demoSquad, lineupOf } from "./testkit";
import { chemOf } from "./quimica";
import { goFree } from "./ops";
import { FORMATION_NAMES } from "../formations";

const sq = demoSquad();
const SEVEN = ["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "adrian"];

beforeEach(() => localStorage.clear());

describe("the cartel in free mode", () => {
  it("two cromos on the same spot are nudged apart; a system's spots never move", () => {
    // every system's own spots (as the cartel lays them out) are already apart: nothing moves
    for (const f of FORMATION_NAMES) {
      const Lf = lineupOf(SEVEN, f, sq);
      const pts = cartelLayout(Lf, sq, chemOf(Lf, sq), "J8", "T1").cromos.map((c) => [c.x, c.y] as [number, number]);
      expect(spreadCromos(pts)).toEqual(pts);
    }
    const free = goFree(lineupOf(SEVEN, "2-3-1", sq));
    // MC and DC dragged onto the same spot
    const mc = free.slots[4];
    const stacked = { ...free, slots: free.slots.map((s, i) => (i === 6 ? { ...s, x: mc.x, y: mc.y } : s)) };
    const c = cartelLayout(stacked, sq, chemOf(stacked, sq), "J8", "T1").cromos;
    const a = c.find((x) => x.id === "huberoski")!;
    const b = c.find((x) => x.id === "adrian")!;
    expect(Math.abs(a.x - b.x) >= CARTEL_GAP.x - 0.2 || Math.abs(a.y - b.y) >= CARTEL_GAP.y - 0.2).toBe(true);
    // every pair is apart, inside the pitch
    c.forEach((p, i) =>
      c.slice(i + 1).forEach((q) => expect(Math.abs(p.x - q.x) >= CARTEL_GAP.x - 0.2 || Math.abs(p.y - q.y) >= CARTEL_GAP.y - 0.2).toBe(true)),
    );
    c.forEach((p) => {
      expect(p.x).toBeGreaterThanOrEqual(7);
      expect(p.x).toBeLessThanOrEqual(93);
    });
  });

  it("spreadCromos keeps the order and leaves apart ones alone", () => {
    expect(spreadCromos([[10, 10], [80, 80]])).toEqual([[10, 10], [80, 80]]);
    const out = spreadCromos([[50, 50], [50, 50]]);
    expect(Math.abs(out[0][0] - out[1][0])).toBeGreaterThanOrEqual(CARTEL_GAP.x - 0.2);
  });
});
