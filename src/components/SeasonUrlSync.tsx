import React, { useEffect, useRef } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useSeason } from "../context/SeasonContext";

/**
 * Bridges the `season` URL search param <-> SeasonContext. Lives inside the
 * router (SeasonProvider is above the router and can't use router hooks).
 * Two single-source effects avoid echo loops:
 *  - URL -> context: adopt deep-links and browser back/forward (ignores an
 *    absent param so a clean URL doesn't clobber the localStorage selection).
 *  - context -> URL: mirror selector clicks AND SeasonContext's reset-to-"all".
 *    On first mount it defers to an explicit URL season (deep-link beats
 *    localStorage); otherwise it seeds the URL from the stored selection.
 */
export const SeasonUrlSync: React.FC = () => {
  const navigate = useNavigate();
  const urlSeason = useSearch({ strict: false, select: (s) => (s as { season?: string }).season });
  const { selectedSeasonId, setSelectedSeasonId } = useSeason();
  const mountedRef = useRef(false);

  useEffect(() => {
    if (urlSeason !== undefined && urlSeason !== selectedSeasonId) {
      setSelectedSeasonId(urlSeason);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run only when the URL's season changes (single-source sync)
  }, [urlSeason]);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      if (urlSeason !== undefined) return; // deep-link present: let the URL->context effect adopt it
      if (selectedSeasonId === "all") return; // keep a clean URL for the default
    }
    if (selectedSeasonId !== urlSeason) {
      navigate({ to: ".", search: (prev) => ({ ...prev, season: selectedSeasonId }), replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run only when the context selection changes (single-source sync)
  }, [selectedSeasonId]);

  return null;
};
