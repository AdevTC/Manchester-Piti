import { ALL_SEASONS_LABEL, useSetSeason } from "../lib/useSetSeason";
import { useSeason } from "../context/SeasonContext";
export function SeasonSelector() {
  const { seasons, selectedSeasonId, loadingSeasons } = useSeason();
  const setSeason = useSetSeason();
  // While the seasons arrive the selector keeps its place (disabled), so the page doesn't jump when it appears.
  if (!seasons.length && !loadingSeasons) return null;
  return (
    <label className="club-season-filter">
      <span>Temporada</span>
      <select
        aria-label="Seleccionar temporada"
        value={loadingSeasons ? "all" : selectedSeasonId}
        disabled={loadingSeasons}
        onChange={(e) => setSeason(e.target.value)}
      >
        <option value="all">{ALL_SEASONS_LABEL}</option>
        {[...seasons].reverse().map((s) => (
          <option value={s.id} key={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </label>
  );
}
