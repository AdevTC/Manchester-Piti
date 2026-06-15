import React from "react";
import { useSeason } from "../context/SeasonContext";

// Shared season switcher for the Plantilla page (both Expedientes and Pizarra
// modes). Single source of truth via SeasonContext; persistence is handled
// there. Brand segmented control: active = solid sky.
export const SeasonSelector: React.FC = () => {
  const { seasons, selectedSeasonId, setSelectedSeasonId } = useSeason();
  if (seasons.length === 0) return null;

  return (
    <div className="mp-season" role="group" aria-label="Temporada">
      <span className="mp-season-label">Temporada</span>
      <div className="mp-season-opts">
        <button
          type="button"
          className="mp-season-btn"
          aria-pressed={selectedSeasonId === "all"}
          onClick={() => setSelectedSeasonId("all")}
        >
          Histórico Total
        </button>
        {seasons.map((s) => (
          <button
            key={s.id}
            type="button"
            className="mp-season-btn"
            aria-pressed={selectedSeasonId === s.id}
            onClick={() => setSelectedSeasonId(s.id)}
          >
            {s.name}
          </button>
        ))}
      </div>
    </div>
  );
};
