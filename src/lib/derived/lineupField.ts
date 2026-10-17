// The match's lineup on a pitch, now (matches/{id}.lineup through its events): who stands in which slot,
// at which code and spot (the pizarra's frame: x 0 → 100 left → right, y 0 = their goal → 100 = ours),
// and who keeps goal (whoever holds the POR slot). The one drawing la mesa (Antes, En juego) and the
// match page's Campo share; each maps the spots onto its own card. Pure.
import { lineupNow, type LineupEvent, type MatchLineup } from "../matchLineup";
import type { PosCode } from "../positions";

export interface LineupSpot {
  id: string;
  code: PosCode;
  x: number;
  y: number;
  keeper: boolean;
}

export interface LineupField {
  /** Who is on the pitch now, slot order (the keeper's slot first; a red empties its slot). */
  spots: LineupSpot[];
  /** Who holds the POR slot now (null when it is empty: the keeper was sent off). */
  keeper: string | null;
}

/** The lineup with its substitutions and reds applied (lineupNow), each one at his slot's code and spot. */
export function lineupField(lineup: Pick<MatchLineup, "slots">, events: readonly LineupEvent[]): LineupField {
  const now = lineupNow(lineup, events);
  const keeper = now.find((s) => s.code === "POR")?.playerId ?? null;
  return {
    spots: now.map((s) => ({ id: s.playerId, code: s.code, x: s.x, y: s.y, keeper: s.playerId === keeper })),
    keeper,
  };
}
