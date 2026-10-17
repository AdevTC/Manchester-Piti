import { describe, expect, it } from "vitest";
import type { MatchEvent } from "../../../functions/src/matchEngine";
import type { LineupSlot } from "../../lib/matchLineup";
import { lineupSpots, mesaPlayers, pizarraHref, plannedSubsOf } from "./model";

// La mesa with the match's lineup: the pitch is the lineup now (a queued sub moves the shirt at once),
// the keeper whoever holds the POR slot; its links to the pizarra; the planned subs as the listener reads them.
const slots: LineupSlot[] = [
  { playerId: "a", code: "POR", x: 50, y: 95 },
  { playerId: "b", code: "DFC", x: 30, y: 74 },
  { playerId: "c", code: "DFC", x: 70, y: 74 },
  { playerId: "d", code: "MI", x: 17, y: 49 },
  { playerId: "e", code: "MC", x: 50, y: 50 },
  { playerId: "f", code: "MD", x: 83, y: 49 },
  { playerId: "g", code: "DC", x: 50, y: 22 },
];
const seven = slots.map((s) => s.playerId);
const info = (id: string) => ({ name: id.toUpperCase(), number: "", guest: false });
const ev = (id: string, type: MatchEvent["type"], at: number, more: Partial<MatchEvent> = {}): MatchEvent => ({ id, type, elapsedSeconds: at, period: 1, ...more });

describe("la alineación del partido en la mesa", () => {
  it("draws each one at his slot and the keeper is the POR slot's", () => {
    const { field } = mesaPlayers(seven, ["x"], [], 0, info, null, {}, { slots });
    expect(field[0]).toMatchObject({ id: "a", keeper: true, spot: { x: 50, y: 95 } });
    // (the front line is stretched up to the mesa's top, 22 → 14; the keeper stays at his spot)
    expect(field.find((p) => p.id === "g")?.spot).toEqual({ x: 50, y: 14 });
    expect(field.filter((p) => p.keeper)).toHaveLength(1);
  });

  it("a substitution (queued ones included) puts who comes on in the slot of who goes off", () => {
    const events = [ev("live-1", "substitution", 600, { playerId: "a", inPlayerId: "x", queued: true })];
    const { field, bench } = mesaPlayers(seven, ["x"], events, 700, info, null, {}, { slots });
    expect(field.find((p) => p.id === "x")).toMatchObject({ keeper: true, spot: { x: 50, y: 95 } });
    expect(bench.map((p) => p.id)).toEqual(["a"]);
  });

  it("lineupSpots falls back to the 2-3-1 for anyone the lineup doesn't place", () => {
    const { spots, keeper } = lineupSpots(["a", "zz"], ["a"], [], { slots });
    expect(keeper).toBe("a");
    expect(spots.get("zz")).toBeDefined();
  });

  it("links to the pizarra «desde la mesa», on the official board when known", () => {
    expect(pizarraHref("m7")).toBe("/pizarra?desde=mesa&partido=m7");
    expect(pizarraHref("m7", "b1")).toBe("/pizarra?desde=mesa&partido=m7&tablero=b1");
  });

  it("reads the board's planned subs, dropping malformed ones", () => {
    expect(plannedSubsOf([{ out: "a", in: "x", min: 20 }, { out: "b" }, null, "x", { out: "c", in: "y" }])).toEqual([{ out: "a", in: "x", min: 20 }, { out: "c", in: "y" }]);
    expect(plannedSubsOf(undefined)).toEqual([]);
  });
});
