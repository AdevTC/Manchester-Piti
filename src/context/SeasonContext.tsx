import React, { createContext, useContext, useMemo, useState } from "react";
import { collection, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { seasonSchema, dropNullFields } from "../lib/schemas";
import { useFirestoreCollection } from "../lib/useFirestoreCollection";

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

/** Module-level stable mapper: validates with Zod (Phase 1) and discards invalid docs. */
function mapSeason(id: string, data: unknown): Season | null {
  const r = seasonSchema.safeParse({ id, ...dropNullFields(data as Record<string, unknown>) });
  if (!r.success) {
    console.error(`[schema] doc inválido en seasons/${id}:`, r.error.issues);
    return null;
  }
  return { id: r.data.id, name: r.data.name, captainPlayerId: r.data.captainPlayerId || undefined };
}

export const SeasonProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const seasonsQuery = useMemo(() => query(collection(db, "seasons"), orderBy("name", "asc")), []);

  const { data, isPending } = useFirestoreCollection(SEASONS_KEY, seasonsQuery, mapSeason);
  const seasons = useMemo(() => data ?? [], [data]);
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
