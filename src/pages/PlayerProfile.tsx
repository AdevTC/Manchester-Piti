import { getRouteApi, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Share2 } from "lucide-react";
import { shareClubPage } from "../lib/share";
import {
  useClubData,
  playerName,
  playerForSeason,
  isCompleted,
  formatDate,
} from "../lib/clubData";
import { useSeason } from "../context/SeasonContext";
import { SeasonSelector } from "../components/SeasonSelector";
import { computeStats } from "../lib/playerStats";
import { Jersey } from "../components/Jersey";
import { DataState } from "../components/club/ClubUI";
export function PlayerProfile() {
  const { playerId } = getRouteApi("/jugadores/$playerId").useParams();
  const { players, matches, loading, error } = useClubData();
  const { selectedSeasonId, seasons } = useSeason();
  const [notice, setNotice] = useState("");
  const rawPlayer = players.find((p) => p.id === playerId);
  const p = rawPlayer
    ? playerForSeason(rawPlayer, selectedSeasonId, seasons)
    : undefined;
  if (loading || error)
    return (
      <div className="club-page">
        <DataState loading={loading} error={error} />
      </div>
    );
  if (!p)
    return (
      <div className="club-empty">
        <h1>Jugador no encontrado</h1>
        <Link to="/plantilla">Ver plantilla</Link>
      </div>
    );
  const games = matches.filter(
    (m) =>
      isCompleted(m) &&
      (selectedSeasonId === "all" || m.seasonId === selectedSeasonId),
  );
  const s = computeStats(p.id, games);
  const tracked = games.filter((m) => m.ledger?.[p.id]);
  const participation = tracked.map((m) => m.ledger![p.id]);
  const minutes = participation.reduce((n, x) => n + x.minutes, 0);
  const appearances = games.filter((m) =>
    m.ledger?.[p.id]
      ? m.ledger[p.id].played
      : m.events?.some((e) => e.playerId === p.id || e.assistPlayerId === p.id),
  );
  const recorded = (value: number) => (tracked.length ? value : "—");
  const stats = [
    [s.matchesPlayed, "Partidos"],
    [s.goals, "Goles"],
    [s.assists, "Asistencias"],
    [tracked.length ? minutes + "′" : "—", "Minutos registrados"],
    [recorded(participation.filter((x) => x.started).length), "Titular"],
    [
      recorded(participation.filter((x) => x.benched).length),
      "Suplente inicial",
    ],
    [recorded(participation.filter((x) => x.notCalled).length), "No convocado"],
    [recorded(participation.reduce((n, x) => n + x.subIn, 0)), "Entradas"],
    [recorded(participation.reduce((n, x) => n + x.subOut, 0)), "Salidas"],
    [s.yellowCards, "Amarillas"],
    [s.redCards, "Expulsiones"],
    [s.penaltySaved, "Penaltis parados"],
    [s.goalPenalty, "Goles de penalti"],
    [s.goalFreekick, "Goles de falta"],
    [
      recorded(participation.reduce((n, x) => n + x.penaltyCommitted, 0)),
      "Penaltis cometidos",
    ],
    [
      recorded(participation.reduce((n, x) => n + x.penaltyReceived, 0)),
      "Penaltis recibidos",
    ],
  ];
  return (
    <div className="club-page">
      <Link className="club-text-link" to="/plantilla">
        ← Nuestra plantilla
      </Link>
      <header className="club-player-hero">
        <div className="club-player-portrait">
          <span>{String(p.number ?? 0).padStart(2, "0")}</span>
          {p.photoUrl ? (
            <img src={p.photoUrl} alt={playerName(p)} />
          ) : (
            <Jersey name={playerName(p)} number={p.number ?? 0} size="lg" />
          )}
        </div>
        <div>
          <span className="club-kicker">
            {p.naturalPosition || "MANCHESTER PITI"} ·{" "}
            {p.active === false ? "HISTÓRICO" : "PLANTILLA"}
          </span>
          <h1>{playerName(p)}</h1>
          <p>{[p.firstName, p.lastName].filter(Boolean).join(" ")}</p>
          {p.bio && <p className="club-long-copy">{p.bio}</p>}
          {p.quote && <blockquote>“{p.quote}”</blockquote>}
          <span className="club-muted">
            {p.seasons?.length ?? 0} temporadas en el club
          </span>
          <div className="club-actions">
            <button
              className="club-button secondary"
              onClick={async () => {
                try {
                  await shareClubPage(
                    "jugador",
                    p.id,
                    playerName(p) + " · Manchester Piti",
                  );
                  setNotice(
                    typeof navigator.share === "function"
                      ? ""
                      : "Enlace copiado.",
                  );
                } catch {
                  setNotice("No se ha compartido el enlace.");
                }
              }}
            >
              <Share2 size={16} />
              Compartir perfil
            </button>
          </div>
          {notice && <p role="status">{notice}</p>}
        </div>
      </header>
      <SeasonSelector />
      <div className="club-stat-grid">
        {stats.map(([v, l]) => (
          <div key={l}>
            <b>{v}</b>
            <span>{l}</span>
          </div>
        ))}
      </div>
      <p className="club-muted">
        Los minutos, titularidades y cambios se calculan solo en actas
        completas. Los partidos históricos sin esos datos no se estiman.
      </p>
      <section className="club-panel">
        <h2>Temporada a temporada</h2>
        <div className="club-table-scroll">
          <table className="club-table">
            <thead>
              <tr>
                <th>Temporada</th>
                <th>Partidos</th>
                <th>Goles</th>
                <th>Asistencias</th>
              </tr>
            </thead>
            <tbody>
              {seasons
                .filter((se) => p.seasons?.includes(se.id))
                .map((se) => {
                  const ss = computeStats(
                    p.id,
                    matches.filter(
                      (m) => m.seasonId === se.id && isCompleted(m),
                    ),
                  );
                  return (
                    <tr key={se.id}>
                      <td>{se.name}</td>
                      <td>{ss.matchesPlayed}</td>
                      <td>{ss.goals}</td>
                      <td>{ss.assists}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>
      <section className="club-panel">
        <h2>Sus últimos encuentros</h2>
        <div className="club-admin-list">
          {appearances.slice(0, 10).map((m) => (
            <Link key={m.id} to="/matches/$matchId" params={{ matchId: m.id }}>
              <span>
                <b>vs {m.rival}</b>
                <small>{formatDate(m.date)}</small>
              </span>
              <b>
                {m.goalsFor}–{m.goalsAgainst}
              </b>
              <span>{m.ledger?.[p.id]?.minutes ?? "—"}′ →</span>
            </Link>
          ))}
        </div>
      </section>
      {tracked.length > 0 && (
        <section className="club-panel">
          <h2>Relevos y minutos</h2>
          <div className="club-timeline">
            {tracked.flatMap((m) =>
              m.ledger![p.id].exchanges.map((e, i) => (
                <article key={m.id + i}>
                  <b>{e.minute}′</b>
                  <div>
                    <h3>
                      {e.direction === "in" ? "Entró por" : "Salió por"}{" "}
                      {playerName(players.find((x) => x.id === e.with))}
                    </h3>
                    <p>
                      vs {m.rival} · {formatDate(m.date)}
                    </p>
                  </div>
                </article>
              )),
            )}
          </div>
        </section>
      )}
    </div>
  );
}
export default PlayerProfile;
