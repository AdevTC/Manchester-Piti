import { describe, expect, it } from "vitest";
import { readyClock } from "../../../../functions/src/matchClock";
import type { ClubMatch } from "../../clubData";
import { longSeasonFixture } from "./fixtures";
import { matchSignature, signatureAngle, signatureEvents, signaturePoint, signatureRing } from "./signature";

const f = longSeasonFixture();
const byId = (id: string) => f.matches.find((m) => m.id === id)!;

describe("matchSignature", () => {
  it("live (J17 at 23′): drawn up to the minute, open lines, the rest as arcs, a needle", () => {
    const s = matchSignature(byId("j17"), f.now)!;
    expect(s).toMatchObject({ upto: 23, duration: 50, live: true, closed: false, viewBox: "-104 -104 208 208" });
    expect(s.rings).toHaveLength(7);
    expect(s.rings.every((r) => r.d.startsWith("M") && !r.d.endsWith("Z"))).toBe(true);
    expect(s.future).toHaveLength(3);
    expect(s.needle).not.toBeNull();
    expect(s.marks.map((m) => [m.minute, m.kind])).toEqual([
      [6, "gol"],
      [8, "parada"],
      [11, "rival"],
      [15, "tarjeta"],
      [18, "palo"],
      [20, "parada"],
      [21, "gol"],
    ]);
  });

  it("played (J8, 5–1): closed lines, every mark; the big size has the scale", () => {
    const s = matchSignature(byId("j8"), f.now)!;
    expect(s).toMatchObject({ upto: 50, live: false, closed: true, needle: null, future: [], ticks: null });
    expect(s.rings.every((r) => r.d.endsWith(" Z"))).toBe(true);
    expect(s.marks.map((m) => `${m.minute}${m.kind[0]}`)).toEqual(["11g", "18g", "26g", "26r", "33g", "33p", "40g"]);
    const big = matchSignature(byId("j8"), f.now, "b")!;
    expect(big.rings).toHaveLength(15);
    expect(big.ticks).toMatch(/^M/);
    expect(big.halfMarks).toHaveLength(2);
  });

  it("the poster size has lines only; the medium no marks", () => {
    expect(matchSignature(byId("j8"), f.now, "p")).toMatchObject({ marks: [], needle: null });
    expect(matchSignature(byId("j17"), f.now, "p")!.needle).toBeNull();
    expect(matchSignature(byId("j17"), f.now, "m")!.marks).toEqual([]);
  });

  it("a legacy acta (minutes typed) draws from its minutes", () => {
    const s = matchSignature(byId("j1"), f.now)!;
    expect(s.marks.map((m) => `${m.minute}${m.kind[0]}`)).toEqual(["15g", "26g", "26r", "37g"]);
  });

  it("nothing to draw: upcoming, postponed, cancelled or «pendiente»", () => {
    expect(matchSignature(byId("j18"), f.now)).toBeNull();
    expect(matchSignature(byId("j9"), f.now)).toBeNull();
    expect(matchSignature({ ...byId("j18"), status: "cancelled" }, f.now)).toBeNull();
    const pending: ClubMatch = { ...byId("j17"), clock: readyClock() };
    expect(matchSignature(pending, f.kickoff + 4 * 3_600_000)).toBeNull();
  });

  it("is deterministic", () => {
    expect(matchSignature(byId("j8"), f.now)).toEqual(matchSignature(byId("j8"), f.now));
    expect(matchSignature(byId("j8"), f.now)!.rings[0].d).not.toBe(matchSignature(byId("j10"), f.now)!.rings[0].d);
  });

  it("a play in added time sits at the end; a 60-minute match turns on its own clock", () => {
    const late: ClubMatch = { id: "x", duration: 50, events: [{ id: "g", type: "goal", playerId: "a", minute: 53 }] };
    expect(signatureEvents(late)).toEqual([{ id: "g", minute: 50, kind: "gol" }]);
    const s = signatureRing([{ id: "g", minute: 30, kind: "gol" }], 30, 60, "s");
    expect(s).toMatchObject({ live: true, duration: 60 });
    expect(s.marks[0].angle).toBeCloseTo(Math.PI / 2);
  });
});

describe("the face's geometry", () => {
  it("kick-off at the top, half-time at the bottom, clockwise", () => {
    expect(signatureAngle(0)).toBeCloseTo(-Math.PI / 2);
    expect(signatureAngle(25)).toBeCloseTo(Math.PI / 2);
    expect(signatureAngle(12.5)).toBeCloseTo(0);
    expect(signatureAngle(30, 60)).toBeCloseTo(Math.PI / 2);
  });

  it("label points in % of the box", () => {
    const p = signaturePoint(0);
    expect(p.x).toBeCloseTo(50);
    expect(p.y).toBeCloseTo(50 - 54.8);
    expect(signaturePoint(37.5).left).toBe(true);
    expect(signaturePoint(12.5).left).toBe(false);
  });
});
