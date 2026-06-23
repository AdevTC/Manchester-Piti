import React, { createContext, useContext, useMemo, useState } from "react";
import { collection, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { useFirestoreCollection } from "../lib/useFirestoreCollection";
import { mapSeason } from "../lib/firestoreMappers";

export interface Season {
  id: string;
  name: string;
  /** Player id designated as captain for this season (set in Admin). */
  captainPlayerId?: string;
}

interface SeasonContextType {
  seasons: Season[];
  selectedSeasonId: string; // "all" or season ID
  setSelectedSeasonId: (id: string) => void;
  loadingSeasons: boolean;
}

const SeasonContext = createContext<SeasonContextType | undefined>(undefined);

const SEASONS_KEY = ["seasons"] as const;

export const SeasonProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const seasonsQuery = useMemo(() => query(collection(db, "seasons"), orderBy("name", "asc")), []);

  // Shared canonical mapper (full validated doc); derive the Season view here so
  // every ["seasons"] consumer reads the identical cached shape.
  const { data, isPending } = useFirestoreCollection(SEASONS_KEY, seasonsQuery, mapSeason);
  const seasons = useMemo<Season[]>(
    () => (data ?? []).map((s) => ({ id: s.id, name: s.name, captainPlayerId: s.captainPlayerId || undefined })),
    [data],
  );
  const loadingSeasons = isPending;

  const [selectedSeasonIdRaw, setSelectedSeasonIdRaw] = useState<string>(() => {
    return localStorage.getItem("selected_season_id") || "all";
  });

  const setSelectedSeasonId = (id: string) => {
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
    <SeasonContext.Provider value={{ seasons, selectedSeasonId, setSelectedSeasonId, loadingSeasons }}>
      {children}
    </SeasonContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useSeason = () => {
  const context = useContext(SeasonContext);
  if (context === undefined) {
    throw new Error("useSeason must be used within a SeasonProvider");
  }
  return context;
};
