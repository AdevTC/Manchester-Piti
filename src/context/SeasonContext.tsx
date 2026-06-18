import React, { createContext, useContext, useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { parseDocs, seasonSchema } from "../lib/schemas";

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

export const SeasonProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonIdState] = useState<string>(() => {
    return localStorage.getItem("selected_season_id") || "all";
  });
  const [loadingSeasons, setLoadingSeasons] = useState(true);

  const setSelectedSeasonId = (id: string) => {
    setSelectedSeasonIdState(id);
    localStorage.setItem("selected_season_id", id);
  };

  useEffect(() => {
    const seasonsRef = collection(db, "seasons");
    const q = query(seasonsRef, orderBy("name", "asc"));

    // Realtime sync for seasons list
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const validated = parseDocs(seasonSchema, snapshot.docs, "seasons");
      const loadedSeasons: Season[] = validated.map((s) => ({
        id: s.id,
        name: s.name,
        captainPlayerId: s.captainPlayerId || undefined,
      }));
      setSeasons(loadedSeasons);
      
      // If there are seasons and we don't have "all" or a valid season, default to "all"
      // or if we have a saved season that no longer exists, default to "all"
      if (selectedSeasonId !== "all" && !loadedSeasons.some(s => s.id === selectedSeasonId)) {
        setSelectedSeasonIdState("all");
      }
      
      setLoadingSeasons(false);
    }, (error) => {
      console.error("Error fetching seasons:", error);
      setLoadingSeasons(false);
    });

    return () => unsubscribe();
  }, []);

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
