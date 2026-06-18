import { useEffect } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useSeason } from "../context/SeasonContext";

/**
 * Bridges the `season` URL param -> SeasonContext. The URL is the source of
 * truth (both selectors navigate to set it); this component adopts the URL's
 * season into context and normalizes an unknown season to "all". One idempotent
 * effect with full deps — safe under React StrictMode's double-invoked effects
 * (no mount-count/which-changed ref, which a deep-link race would defeat).
 * SeasonProvider is above the router, so this lives inside the router instead.
 */
export const SeasonUrlSync = (): null => {
  const navigate = useNavigate();
  const urlSeason = useSearch({ strict: false, select: (s) => (s as { season?: string }).season });
  const { selectedSeasonId, seasons, loadingSeasons, setSelectedSeasonId } = useSeason();

  useEffect(() => {
    // No season in the URL: seed it from the current selection so the page is
    // shareable (keep the URL clean for the "all" default).
    if (urlSeason === undefined) {
      if (selectedSeasonId !== "all") {
        navigate({ to: ".", search: (prev) => ({ ...prev, season: selectedSeasonId }), replace: true });
      }
      return;
    }
    // Wait until seasons are loaded before validating an explicit URL season.
    if (loadingSeasons) return;
    const known = urlSeason === "all" || seasons.some((s) => s.id === urlSeason);
    if (!known) {
      // Unknown season in the URL -> fall back to "all".
      if (selectedSeasonId !== "all") setSelectedSeasonId("all");
      navigate({ to: ".", search: (prev) => ({ ...prev, season: "all" }), replace: true });
      return;
    }
    // Adopt the URL's season (deep-link, back/forward, selector navigation).
    if (urlSeason !== selectedSeasonId) setSelectedSeasonId(urlSeason);
  }, [urlSeason, selectedSeasonId, seasons, loadingSeasons, navigate, setSelectedSeasonId]);

  return null;
};
