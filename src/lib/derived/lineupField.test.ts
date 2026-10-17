import { describe, expect, it } from "vitest";
import { lineupField } from "./lineupField";
import type { LineupSlot } from "../matchLineup";

const slots: LineupSlot[] = [
  { playerId: "gk", code: "POR", x: 50, y: 95 },
  { playerId: "d1", code: "DFC", x: 30, y: 74 },
  { playerId: "d2", code: "DFC", x: 70, y: 74 },
  { playerId: "m1", code: "MI", x: 17, y: 49 },
  { playerId: "m2", code: "MC", x: 50, y: 50 },
  { playerId: "m3", code: "MD", x: 83, y: 49 },
  { playerId: "st", code: "DC", x: 50, y: 22 },
];

describe("lineupField", () => {
  it("draws the seven at their slots with the POR slot's keeper", () => {
    const f = lineupField({ slots }, []);
    expect(f.keeper).toBe("gk");
    expect(f.spots).toHaveLength(7);
    expect(f.spots[0]).toEqual({ id: "gk", code: "POR", x: 50, y: 95, keeper: true });
    expect(f.spots.filter((s) => s.keeper)).toHaveLength(1);
  });

  it("puts who comes on in the slot of who goes off (the keeper's too) and empties a red's", () => {
    const f = lineupField({ slots }, [
      { type: "substitution", playerId: "gk", inPlayerId: "b1", elapsedSeconds: 300, period: 1 },
      { type: "red_card", playerId: "st", elapsedSeconds: 400, period: 1 },
    ]);
    expect(f.keeper).toBe("b1");
    expect(f.spots.find((s) => s.id === "b1")).toMatchObject({ code: "POR", x: 50, y: 95, keeper: true });
    expect(f.spots.map((s) => s.id)).not.toContain("st");
    expect(f.spots).toHaveLength(6);
  });

  it("has no keeper once the keeper is sent off", () => {
    expect(lineupField({ slots }, [{ type: "red_card", playerId: "gk", minute: 10 }]).keeper).toBeNull();
  });
});
