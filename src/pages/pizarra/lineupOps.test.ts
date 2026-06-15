import { describe, it, expect } from "vitest";
import { seedLineup, placeIntoSlot, sendToBench, swapPlayers, fillLineup, locationOf, XI } from "./lineupOps";

const ids = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];

describe("seedLineup", () => {
  it("places the first XI and benches the rest", () => {
    const l = seedLineup("2-3-1", ids);
    expect(l.slots.filter((s) => s.playerId).length).toBe(XI);
    expect(l.bench).toEqual(ids.slice(XI));
  });
});

describe("placeIntoSlot", () => {
  it("swaps with the occupant when placing into a taken slot", () => {
    const l = seedLineup("2-3-1", ids);
    const benchId = l.bench[0];
    const occupant = l.slots[0].playerId as string;
    const next = placeIntoSlot(l, benchId, 0);
    expect(next.slots[0].playerId).toBe(benchId);
    expect(next.bench).toContain(occupant);
    expect(next.bench).not.toContain(benchId);
  });
});

describe("sendToBench", () => {
  it("empties the slot and benches the player", () => {
    const l = seedLineup("2-3-1", ids);
    const id = l.slots[2].playerId as string;
    const next = sendToBench(l, id);
    expect(next.slots[2].playerId).toBeNull();
    expect(next.bench).toContain(id);
  });
});

describe("swapPlayers", () => {
  it("swaps two on-pitch players' slots", () => {
    const l = seedLineup("2-3-1", ids);
    const a = l.slots[0].playerId as string;
    const b = l.slots[1].playerId as string;
    const next = swapPlayers(l, a, b);
    expect(next.slots[0].playerId).toBe(b);
    expect(next.slots[1].playerId).toBe(a);
  });
});

describe("fillLineup", () => {
  it("keeps pinned slots and fills the rest", () => {
    const pinned = new Map<number, string>([[0, "a"]]);
    const { slots, bench } = fillLineup("2-3-1", pinned, ["b", "c", "d", "e", "f", "g", "h"], () => undefined);
    expect(slots[0].playerId).toBe("a");
    expect(slots.filter((s) => s.playerId).length).toBe(XI);
    expect(bench).toContain("h");
  });
  it("matches zone before falling back to order", () => {
    const zoneOf = (id: string) => (id === "z" ? ("DEL" as const) : undefined);
    const { slots } = fillLineup("2-3-1", new Map(), ["x", "z"], zoneOf);
    const del = slots.find((s) => s.zone === "DEL");
    expect(del?.playerId).toBe("z");
  });
});

describe("locationOf", () => {
  it("finds slot and bench locations", () => {
    const l = seedLineup("2-3-1", ids);
    expect(locationOf(l, l.slots[0].playerId as string)).toEqual({ type: "slot", index: 0 });
    expect(locationOf(l, l.bench[0])).toEqual({ type: "bench" });
    expect(locationOf(l, "zzz")).toBeNull();
  });
});
