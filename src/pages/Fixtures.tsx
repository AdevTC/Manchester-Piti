import { useState } from "react";
import { useClubData, matchPhase, dateMillis } from "../lib/clubData";
import { useClock } from "../hooks/useClock";
import { useSeason } from "../context/SeasonContext";
import { SeasonSelector } from "../components/SeasonSelector";
import { FixtureCard, DataState } from "../components/club/ClubUI";
export function FixturesPage() {
  const { matches, loading, error } = useClubData();
  const now = useClock();
  const { selectedSeasonId } = useSeason();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const items = matches
    .filter(
      (m) =>
        (selectedSeasonId === "all" || selectedSeasonId === m.seasonId) &&
        (!search || m.rival?.toLowerCase().includes(search.toLowerCase())) &&
        (filter === "all" ||
          (filter === "next"
            ? ["scheduled", "playing", "postponed"].includes(matchPhase(m, now))
            : matchPhase(m, now) === "finished")),
    )
    .sort((a, b) =>
      filter === "next"
        ? dateMillis(a.date) - dateMillis(b.date)
        : dateMillis(b.date) - dateMillis(a.date),
    );
  return (
    <div className="club-page">
      <header className="club-page-head">
        <span className="club-kicker">EL CALENDARIO DEL EQUIPO</span>
        <h1>Partidos</h1>
        <p>Calendario, resultados y actas de cada encuentro.</p>
      </header>
      <SeasonSelector />
      <div className="club-toolbar">
        <div className="club-segments">
          {[
            ["all", "Todos"],
            ["next", "Próximos"],
            ["results", "Resultados"],
          ].map(([id, label]) => (
            <button
              key={id}
              className={filter === id ? "active" : ""}
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          aria-label="Buscar rival"
          placeholder="Buscar rival…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <DataState loading={loading} error={error} />
      <div className="club-grid-2">
        {items.map((m) => (
          <FixtureCard key={m.id} match={m} />
        ))}
      </div>
      {!loading && !error && !items.length && (
        <div className="club-empty">
          <h2>No hay encuentros en esta selección.</h2>
          <p>Prueba con otra temporada o consulta todos los partidos.</p>
        </div>
      )}
    </div>
  );
}
