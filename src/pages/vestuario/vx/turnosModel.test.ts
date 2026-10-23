import { describe, expect, it } from "vitest";
import type { Turn } from "../../../lib/derived/rota";
import { turnPlayed, turnRows } from "./turnosModel";

const turn = (id: string, name: string, icon: Turn["job"]["icon"], playerId: string | null, p: Partial<Turn> = {}): Turn => ({
  job: { id, name, icon, awayOnly: false, order: [] },
  playerId,
  computed: playerId,
  pinned: false,
  swappedFrom: null,
  skipped: [],
  frozen: false,
  ...p,
});

describe("turnRows", () => {
  it("names each job's glyph and says «Tú» on his", () => {
    const rows = turnRows(
      [turn("l", "Lavar la equipación", "shirt", "jordi"), turn("b", "Los balones", "ball", "kevin"), turn("m", "La mesa", "key", null)],
      "kevin",
      (id) => id[0].toUpperCase() + id.slice(1),
    );
    expect(rows.map((r) => [r.icon, r.who, r.mine, r.cls])).toEqual([
      ["wash", "Jordi", false, ""],
      ["ball", "Tú, Kevin", true, "is-me"],
      ["mesa", "Nadie disponible", false, ""],
    ]);
  });
  it("says a captain's swap", () => {
    const [r] = turnRows([turn("c", "Coche", "car", "erik", { pinned: true, swappedFrom: "kevin" })], null, (id) => id);
    expect(r.icon).toBe("away");
    expect(r.who).toBe("erik · cambio del capitán (le tocaba a kevin)");
  });
});

describe("turnPlayed", () => {
  it("is played once finished or kicked off, never when called off", () => {
    expect(turnPlayed({ status: "finished", date: "2026-10-18T19:00" }, 0)).toBe(true);
    expect(turnPlayed({ status: "scheduled", date: "2099-01-01T10:00" }, Date.now())).toBe(false);
    expect(turnPlayed({ status: "postponed", date: "2000-01-01T10:00" }, Date.now())).toBe(false);
    expect(turnPlayed(undefined, Date.now())).toBe(false);
  });
});
