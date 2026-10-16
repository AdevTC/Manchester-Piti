import React, { createContext, useContext, useMemo, useState } from "react";
import { useFirestoreCollection } from "../lib/useFirestoreCollection";
import { mapSeason } from "../lib/firestoreMappers";
import { SEASONS_KEY, seasonQuery } from "../lib/publicData";

export interface Season {
  id: string;
  name: string;
  /** Player id designated as captain for this season (set in Admin). */
  captainPlayerId?: string;
}

/** What pages see. They change the season with `useSetSeason()` (it navigates), never by writing here. */
interface SeasonContextType {
  seasons: Season[];
  selectedSeasonId: string; // "all" or season ID
  loadingSeasons: boolean;
}

/** The context also carries the writer, reachable only through `useAdoptSeason` (SeasonUrlSync). */
interface SeasonContextValue extends SeasonContextType {
  adoptSeasonId: (id: string) => void;
}

const SeasonContext = createContext<SeasonContextValue | undefined>(undefined);

export const SeasonProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Shared canonical mapper (full validated doc); derive the Season view here so
  // every ["seasons"] consumer reads the identical cached shape.
  const { data, isPending } = useFirestoreCollection(SEASONS_KEY, seasonQuery, mapSeason);
  const seasons = useMemo<Season[]>(
    // Archived seasons stay in Firestore but are hidden from the whole app (Admin reads them directly).
    () => (data ?? []).filter((s) => !s.archived).map((s) => ({ id: s.id, name: s.name, captainPlayerId: s.captainPlayerId || undefined })),
    [data],
  );
  const loadingSeasons = isPending;

  const [selectedSeasonIdRaw, setSelectedSeasonIdRaw] = useState<string>(() => {
    // Server render: no saved choice there (the client mounts with its own).
    if (typeof window === "undefined") return "all";
    try {
      return window.localStorage.getItem("selected_season_id") || "all";
    } catch {
      return "all";
    }
  });

  const adoptSeasonId = (id: string) => {
    setSelectedSeasonIdRaw(id);
    localStorage.setItem("selected_season_id", id);
  };

  // Reset-to-"all": if seasons are loaded and the saved season no longer exists,
  // derive "all" in render. This is a pure computation — no effect, no setState.
  // In-memory only (no localStorage write), matching the original callback behavior.
  const selectedSeasonId =
    !isPending && selectedSeasonIdRaw !== "all" && !seasons.some((s) => s.id === selectedSeasonIdRaw)
      ? "all"
      : selectedSeasonIdRaw;

  return (
    <SeasonContext.Provider value={{ seasons, selectedSeasonId, adoptSeasonId, loadingSeasons }}>
      {children}
    </SeasonContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useSeason = (): SeasonContextType => {
  const context = useContext(SeasonContext);
  if (context === undefined) {
    throw new Error("useSeason must be used within a SeasonProvider");
  }
  return context;
};

/**
 * Writes the season into the context. ONLY SeasonUrlSync may call this: the URL is the source of
 * truth, and any other writer is reverted by the sync on the next render (the /partidos bug).
 * Pages change the season with `useSetSeason()`.
 */
// eslint-disable-next-line react-refresh/only-export-components -- a hook next to its context, like useSeason
export const useAdoptSeason = (): ((id: string) => void) => {
  const context = useContext(SeasonContext);
  if (context === undefined) {
    throw new Error("useAdoptSeason must be used within a SeasonProvider");
  }
  return context.adoptSeasonId;
};

/** Whether the seasons are still arriving (false outside the provider, e.g. in isolated tests). */
// eslint-disable-next-line react-refresh/only-export-components -- a hook next to its context, like useSeason
export const useSeasonsLoading = () => useContext(SeasonContext)?.loadingSeasons ?? false;
