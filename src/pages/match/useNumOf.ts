import { useSeason } from "../../context/SeasonContext";
import { playerForSeason } from "../../lib/clubData";
import type { PlayerDoc } from "../../lib/schemas";

/** A player's dorsal in the match's season ("" when he has none). */
export function useNumOf(players: PlayerDoc[], seasonId?: string) {
  const { seasons } = useSeason();
  return (id: string) => {
    const p = players.find((x) => x.id === id);
    if (!p) return "";
    const n = playerForSeason(p, seasonId ?? "all", seasons).number;
    return n != null ? String(n) : "";
  };
}
