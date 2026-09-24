import { useNavigate } from "@tanstack/react-router";
import { useSeason } from "../context/SeasonContext";
export function SeasonSelector() {
  const { seasons, selectedSeasonId } = useSeason();
  const navigate = useNavigate();
  if (!seasons.length) return null;
  return (
    <label className="club-season-filter">
      <span>Temporada</span>
      <select
        aria-label="Seleccionar temporada"
        value={selectedSeasonId}
        onChange={(e) =>
          void navigate({
            to: ".",
            search: (prev) => ({ ...prev, season: e.target.value }),
          })
        }
      >
        <option value="all">Todo el historial</option>
        {[...seasons].reverse().map((s) => (
          <option value={s.id} key={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </label>
  );
}
