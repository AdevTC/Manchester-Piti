import { useMemo } from "react";
import type { PosCode } from "../../lib/positions";
import type { PlayerPositions } from "../../lib/positionStats";

/** The history map's `played` record from a player's lines (stable while the lines are). */
export function usePlayed(pos: PlayerPositions): Partial<Record<PosCode, number>> {
  return useMemo(() => Object.fromEntries(pos.lines.map((l) => [l.code, l.minutes])), [pos.lines]);
}
