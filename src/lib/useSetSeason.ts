import { useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";

/** The label every season selector shows for «no season filter». */
export const ALL_SEASONS_LABEL = "Todo el historial";

/**
 * The only way for a page to change the season. The URL is the source of truth
 * (SeasonUrlSync adopts `?season` into SeasonContext), so picking a season
 * navigates; writing the context directly would be reverted by the sync on the
 * next render.
 */
export function useSetSeason(): (id: string) => void {
  const navigate = useNavigate();
  return useCallback(
    (id: string) => void navigate({ to: ".", search: (prev) => ({ ...prev, season: id }) }),
    [navigate],
  );
}
