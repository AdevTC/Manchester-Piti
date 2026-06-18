import React from "react";
import { useNavigate } from "@tanstack/react-router";
import { useSeason } from "../context/SeasonContext";

// Shared season switcher for the Plantilla page (both Expedientes and Pizarra
// modes). The URL `season` param is the source of truth (SeasonUrlSync bridges
// it into SeasonContext); selecting navigates to set it. Brand segmented
// control: active = solid sky.
export const SeasonSelector: React.FC = () => {
  const navigate = useNavigate();
  const { seasons, selectedSeasonId } = useSeason();
  if (seasons.length === 0) return null;

  return (
    <div className="mp-season" role="group" aria-label="Temporada">
      <span className="mp-season-label">Temporada</span>
      <div className="mp-season-opts">
        <button
          type="button"
          className="mp-season-btn"
          aria-pressed={selectedSeasonId === "all"}
          onClick={() => navigate({ to: ".", search: (prev) => ({ ...prev, season: "all" }) })}
        >
          Histórico Total
        </button>
        {seasons.map((s) => (
          <button
            key={s.id}
            type="button"
            className="mp-season-btn"
            aria-pressed={selectedSeasonId === s.id}
            onClick={() => navigate({ to: ".", search: (prev) => ({ ...prev, season: s.id }) })}
          >
            {s.name}
          </button>
        ))}
      </div>
    </div>
  );
};
