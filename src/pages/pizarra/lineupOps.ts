// Pure board operations — the single source of truth for placement logic.
// No React. Unit-tested in lineupOps.test.ts.
import { applyFormation, emptySlots, type FormationName, type Lineup, type SlotState, type Zone } from "./formations";
import { defaultTactics } from "./tactics";

export const XI = 7;

export type Location = { type: "slot"; index: number } | { type: "bench" } | null;

export function locationOf(lineup: Lineup, id: string): Location {
  const slotIndex = lineup.slots.findIndex((s) => s.playerId === id);
  if (slotIndex >= 0) return { type: "slot", index: slotIndex };
  if (lineup.bench.includes(id)) return { type: "bench" };
  return null;
}

/** Seed a lineup from an ordered id list: first XI to the slots, rest to bench. */
export function seedLineup(formation: FormationName, playerIds: string[]): Lineup {
  const slots = emptySlots(formation);
  playerIds.slice(0, XI).forEach((id, i) => {
    slots[i].playerId = id;
  });
  return {
    formation,
    freeMode: false,
    slots,
    bench: playerIds.slice(XI),
    roles: {},
    tactics: defaultTactics(),
    playerPositions: {},
    pinned: [],
  };
}

// Move `id` into slot `index`. If the slot is taken, the displaced player goes
// to `id`'s previous location (a clean swap); a bench arrival just frees a seat.
export function placeIntoSlot(lineup: Lineup, id: string, index: number): Lineup {
  const from = locationOf(lineup, id);
  const slots = lineup.slots.map((s) => ({ ...s }));
  let bench = [...lineup.bench];
  const displaced = slots[index].playerId;
  if (from?.type === "slot") {
    slots[from.index].playerId = displaced;
  } else {
    bench = bench.filter((b) => b !== id);
    if (displaced) bench.push(displaced);
  }
  slots[index].playerId = id;
  return { ...lineup, slots, bench };
}

export function sendToBench(lineup: Lineup, id: string): Lineup {
  const from = locationOf(lineup, id);
  if (from?.type !== "slot") return lineup;
  const slots = lineup.slots.map((s) => ({ ...s }));
  slots[from.index].playerId = null;
  const bench = lineup.bench.includes(id) ? lineup.bench : [...lineup.bench, id];
  return { ...lineup, slots, bench };
}

export function swapPlayers(lineup: Lineup, a: string, b: string): Lineup {
  const la = locationOf(lineup, a);
  const lb = locationOf(lineup, b);
  if (!la || !lb) return lineup;
  const slots = lineup.slots.map((s) => ({ ...s }));
  let bench = [...lineup.bench];
  const setAt = (loc: Location, id: string) => {
    if (loc?.type === "slot") slots[loc.index].playerId = id;
  };
  setAt(la, b);
  setAt(lb, a);
  if (la?.type === "bench" || lb?.type === "bench") {
    bench = bench.map((x) => (x === a ? b : x === b ? a : x));
  }
  return { ...lineup, slots, bench };
}

/** Fill a formation: keep pinned slots, then place from `pool` by zone match,
 *  then fill remaining slots in order. Returns slots + leftover bench. Shared
 *  by Auto-XI (pool ordered by squad) and Suggest-by-form (pool ordered by form). */
export function fillLineup(
  formation: FormationName,
  pinnedInSlot: Map<number, string>,
  pool: string[],
  zoneOf: (id: string) => Zone | undefined,
): { slots: SlotState[]; bench: string[] } {
  const slots = emptySlots(formation);
  pinnedInSlot.forEach((id, i) => {
    slots[i].playerId = id;
  });
  const rest = [...pool];
  slots.forEach((s) => {
    if (s.playerId) return;
    const idx = rest.findIndex((id) => zoneOf(id) === s.zone);
    if (idx >= 0) s.playerId = rest.splice(idx, 1)[0];
  });
  slots.forEach((s) => {
    if (!s.playerId && rest.length) s.playerId = rest.shift() as string;
  });
  return { slots, bench: rest };
}

/** Reset free-mode positions back to the formation's slot coordinates. */
export function resetPositions(lineup: Lineup): Lineup {
  return { ...lineup, freeMode: false, slots: applyFormation(lineup.slots, lineup.formation) };
}

/** Snap a percentage coordinate to a grid step (e.g. 5%). */
export function snapToGrid(v: number, step = 5): number {
  return Math.round(v / step) * step;
}
