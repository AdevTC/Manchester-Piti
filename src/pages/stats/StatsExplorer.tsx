import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Trophy, Flag, TrendingUp, BarChart3 } from "lucide-react";
import { playerName, formatDate, type ClubMatch } from "../../lib/clubData";
import {
  competitionRanks,
  individualRecords,
  teamRecords,
  milestones,
  milestoneSteps,
  teamAnalysis,
  type PlayerAnalysis,
  type RecordEntry,
  type Streak,
} from "../../lib/clubAnalytics";
import {
  EvolutionChart,
  RankingBars,
} from "../../components/club/AnalyticsCharts";
export type ExploreSection = "individual" | "streaks" | "team" | "evolution";
function MatchLink({ match }: { match: ClubMatch }) {
  return (
    <Link to="/matches/$matchId" params={{ matchId: match.id }}>
      {match.goalsFor}–{match.goalsAgainst} vs {match.rival}
      <small>{formatDate(match.date)}</small>
    </Link>
  );
}
function RecordCard({
  title,
  unit,
  entries,
  rows,
  lower = false,
}: {
  title: string;
  unit: string;
  entries: RecordEntry[];
  rows: PlayerAnalysis[];
  lower?: boolean;
}) {
  const best = entries[0]?.value,
    holders = entries.filter((e) => e.value === best),
    ranks = competitionRanks(entries, (e) => (lower ? -e.value : e.value));
  const names = Object.fromEntries(rows.map((p) => [p.id, playerName(p)]));
  return (
    <article className="analytics-record-card">
      <span className="club-kicker">{title}</span>
      {best !== undefined ? (
        <>
          <div className="analytics-record-value">
            {best}
            <small>{unit}</small>
          </div>
          <div className="analytics-record-holders">
            {holders.map((e) => (
              <div key={e.id}>
                {e.playerId && (
                  <Link
                    to="/jugadores/$playerId"
                    params={{ playerId: e.playerId }}
                  >
                    <strong>{names[e.playerId]}</strong>
                  </Link>
                )}
                <MatchLink match={e.match} />
              </div>
            ))}
          </div>
          <details>
            <summary>
              Clasificación completa <span>{entries.length}</span>
            </summary>
            <ol>
              {entries.map((e) => (
                <li key={e.id}>
                  <b>{ranks.get(e.id)}</b>
                  <div>
                    {e.playerId && <strong>{names[e.playerId]}</strong>}
                    <MatchLink match={e.match} />
                  </div>
                  <b>{e.value}</b>
                </li>
              ))}
            </ol>
          </details>
        </>
      ) : (
        <p className="analytics-empty">Sin registros en este período.</p>
      )}
    </article>
  );
}
function StreakCard({
  title,
  data,
}: {
  title: string;
  data: { best: Streak; current: Streak; runs: Streak[] };
}) {
  return (
    <article className="analytics-record-card">
      <span className="club-kicker">{title}</span>
      <div className="analytics-record-value">
        {data.best.count}
        <small>partidos seguidos</small>
      </div>
      <p className="analytics-note">
        Racha actual: <b>{data.current.count}</b>
      </p>
      {data.best.from && data.best.to && (
        <p>
          {formatDate(data.best.from.date)} — {formatDate(data.best.to.date)}
        </p>
      )}
      {data.runs.length > 0 && (
        <details>
          <summary>
            Ver todas las rachas<span>{data.runs.length}</span>
          </summary>
          <ol>
            {data.runs.map((s, i) => (
              <li key={s.from!.id}>
                <b>{i + 1}</b>
                <div>
                  <MatchLink match={s.from!} />
                  {s.to!.id !== s.from!.id && <MatchLink match={s.to!} />}
                </div>
                <b>{s.count}</b>
              </li>
            ))}
          </ol>
        </details>
      )}
    </article>
  );
}
export function StatsExplorer({
  rows,
  games,
  section,
  onSection,
}: {
  rows: PlayerAnalysis[];
  games: ClubMatch[];
  section: ExploreSection;
  onSection: (section: ExploreSection) => void;
}) {
  const [streakMetric, setStreakMetric] = useState<
    | "goalStreak"
    | "assistStreak"
    | "contributionStreak"
    | "appearanceStreak"
    | "cleanStreak"
  >("goalStreak");
  const [milestoneMetric, setMilestoneMetric] = useState("all");
  const [visibleMilestones, setVisibleMilestones] = useState(12);
  const [leaderMetric, setLeaderMetric] = useState<
    "goals" | "assists" | "ga" | "matchesPlayed" | "minutes"
  >("goals");
  const team = teamAnalysis(games);
  const marks = milestones(rows).filter(
    (m) => milestoneMetric === "all" || m.metric === milestoneMetric,
  );
  const orderedStreaks = [...rows]
    .filter((p) => p[streakMetric].best.count > 0)
    .sort(
      (a, b) =>
        b[streakMetric].best.count - a[streakMetric].best.count ||
        playerName(a).localeCompare(playerName(b)),
    );
  const streakRanks = competitionRanks(
      orderedStreaks,
      (p) => p[streakMetric].best.count,
    ),
    longest = orderedStreaks[0]?.[streakMetric].best.count || 1;
  const fastest = rows
    .flatMap((p) =>
      p.series.flatMap((g) =>
        (g.match.events ?? [])
          .filter(
            (e) =>
              e.playerId === p.id &&
              ["goal", "goal_penalty", "goal_freekick"].includes(e.type) &&
              typeof e.minute === "number",
          )
          .map((e) => ({
            id: p.id + ":" + g.match.id + ":" + e.id,
            playerId: p.id,
            match: g.match,
            value: e.minute!,
          })),
      ),
    )
    .sort((a, b) => a.value - b.value);
  return (
    <div className="analytics-explorer">
      <nav
        className="analytics-explore-nav"
        aria-label="Secciones del explorador"
      >
        {(
          [
            ["individual", "Récords individuales", Trophy],
            ["streaks", "Rachas e hitos", Flag],
            ["team", "Récords del equipo", TrendingUp],
            ["evolution", "Evolución y rankings", BarChart3],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            className={section === id ? "active" : ""}
            aria-pressed={section === id}
            onClick={() => onSection(id)}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </nav>
      {section === "individual" && (
        <>
          <header className="analytics-section-head">
            <div>
              <span className="club-kicker">MEJORES ACTUACIONES</span>
              <h2>Récords individuales</h2>
            </div>
            <p>
              Todos los empates aparecen como récord compartido. Abre cada
              tarjeta para consultar el resto de actuaciones.
            </p>
          </header>
          <div className="analytics-record-grid">
            <RecordCard
              title="Más goles en un partido"
              unit="goles"
              entries={individualRecords(rows, "goals")}
              rows={rows}
            />
            <RecordCard
              title="Más asistencias en un partido"
              unit="asistencias"
              entries={individualRecords(rows, "assists")}
              rows={rows}
            />
            <RecordCard
              title="Mayor participación en goles"
              unit="goles + asistencias"
              entries={individualRecords(rows, "ga")}
              rows={rows}
            />
            <RecordCard
              title="Gol más temprano"
              unit="minuto"
              entries={fastest}
              rows={rows}
              lower
            />
          </div>
          <div className="analytics-record-grid">
            {(
              [
                ["braces", "Dobletes o más", "partidos con 2+ goles"],
                ["hatTricks", "Hat-tricks", "partidos con 3+ goles"],
                [
                  "multiAssists",
                  "Asistencias múltiples",
                  "partidos con 2+ asistencias",
                ],
              ] as const
            ).map(([key, title, unit]) => (
              <section className="club-panel" key={key}>
                <h3>{title}</h3>
                <p>{unit}</p>
                <RankingBars
                  rows={rows}
                  value={(p) => p[key]}
                  unit="partidos"
                />
              </section>
            ))}
          </div>
        </>
      )}
      {section === "streaks" && (
        <>
          <section className="club-panel">
            <div className="club-toolbar">
              <div>
                <span className="club-kicker">REGULARIDAD</span>
                <h2>Ranking de rachas</h2>
              </div>
              <label>
                Tipo de racha
                <select
                  aria-label="Tipo de racha"
                  value={streakMetric}
                  onChange={(e) =>
                    setStreakMetric(e.target.value as typeof streakMetric)
                  }
                >
                  {Object.entries({
                    goalStreak: "Marcando",
                    assistStreak: "Asistiendo",
                    contributionStreak: "Marcando o asistiendo",
                    appearanceStreak: "Participando",
                    cleanStreak: "Jugando sin tarjetas",
                  }).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="analytics-note">
              Partidos consecutivos del equipo dentro del período seleccionado.
              Un partido sin la acción registrada corta la racha; las
              participaciones antiguas dependen de los eventos anotados.
            </p>
            <div className="club-table-scroll">
              <table className="club-table analytics-streak-table">
                <thead>
                  <tr>
                    <th>Puesto / jugador</th>
                    <th>Mejor racha</th>
                    <th>Actual</th>
                    <th>Inicio — final del récord</th>
                  </tr>
                </thead>
                <tbody>
                  {orderedStreaks.map((p) => {
                    const s = p[streakMetric];
                    return (
                      <tr key={p.id}>
                        <td>
                          <span className="analytics-rank">
                            {streakRanks.get(p.id)}
                          </span>
                          <Link
                            to="/jugadores/$playerId"
                            params={{ playerId: p.id }}
                          >
                            {playerName(p)}
                          </Link>
                        </td>
                        <td>
                          <b>{s.best.count}</b>
                          <span className="analytics-bar-track">
                            <i
                              style={{
                                width: (s.best.count / longest) * 100 + "%",
                              }}
                            />
                          </span>
                        </td>
                        <td>
                          <span
                            className={
                              s.current.count ? "analytics-live-streak" : ""
                            }
                          >
                            {s.current.count}
                          </span>
                        </td>
                        <td>
                          {s.best.from && s.best.to && (
                            <>
                              <Link
                                to="/matches/$matchId"
                                params={{ matchId: s.best.from.id }}
                              >
                                {formatDate(s.best.from.date)}
                              </Link>
                              <span> — </span>
                              <Link
                                to="/matches/$matchId"
                                params={{ matchId: s.best.to.id }}
                              >
                                {formatDate(s.best.to.date)}
                              </Link>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!orderedStreaks.length && (
              <p className="analytics-empty">
                Sin rachas registradas para esta métrica.
              </p>
            )}
          </section>
          <section className="club-panel">
            <div className="club-toolbar">
              <div>
                <span className="club-kicker">FECHAS SEÑALADAS</span>
                <h2>Hitos alcanzados</h2>
              </div>
              <label>
                Mostrar
                <select
                  value={milestoneMetric}
                  onChange={(e) => {
                    setMilestoneMetric(e.target.value);
                    setVisibleMilestones(12);
                  }}
                  aria-label="Filtrar hitos"
                >
                  <option value="all">Todos</option>
                  <option value="goals">Goles</option>
                  <option value="assists">Asistencias</option>
                  <option value="matchesPlayed">Partidos</option>
                </select>
              </label>
            </div>
            <div className="analytics-milestones">
              {marks.slice(0, visibleMilestones).map((m) => (
                <article key={m.id}>
                  <div className="analytics-milestone-number">
                    {m.value}
                    <small>
                      {m.metric === "goals"
                        ? "GOLES"
                        : m.metric === "assists"
                          ? "ASIST."
                          : "PARTIDOS"}
                    </small>
                  </div>
                  <div>
                    <Link
                      to="/jugadores/$playerId"
                      params={{ playerId: m.playerId }}
                    >
                      <strong>
                        {playerName(rows.find((p) => p.id === m.playerId))}
                      </strong>
                    </Link>
                    <p>{formatDate(m.match.date)}</p>
                  </div>
                  <Link
                    className="club-text-link"
                    to="/matches/$matchId"
                    params={{ matchId: m.match.id }}
                  >
                    vs {m.match.rival} ↗
                  </Link>
                </article>
              ))}
            </div>
            {!marks.length && (
              <p className="analytics-empty">Sin hitos para este período.</p>
            )}
            {marks.length > visibleMilestones && (
              <button
                className="club-button secondary"
                onClick={() => setVisibleMilestones((n) => n + 12)}
              >
                Mostrar más hitos
              </button>
            )}
            <p className="analytics-note">
              Se marca el partido en el que se alcanza o supera cada umbral,
              contando desde el inicio del período elegido.
            </p>
          </section>
          <section className="club-panel">
            <h2>Próximos hitos de gol</h2>
            <div className="analytics-next-milestones">
              {[...rows]
                .filter((p) => p.matchesPlayed > 0)
                .sort((a, b) => b.goals - a.goals)
                .map((p) => {
                  const next = milestoneSteps.find((n) => n > p.goals);
                  return next ? (
                    <div key={p.id}>
                      <Link
                        to="/jugadores/$playerId"
                        params={{ playerId: p.id }}
                      >
                        {playerName(p)}
                      </Link>
                      <strong>
                        {p.goals} / {next}
                      </strong>
                      <span className="analytics-bar-track">
                        <i style={{ width: (p.goals / next) * 100 + "%" }} />
                      </span>
                      <small>Le faltan {next - p.goals} goles</small>
                    </div>
                  ) : null;
                })}
            </div>
          </section>
        </>
      )}
      {section === "team" && (
        <>
          <header className="analytics-section-head">
            <div>
              <span className="club-kicker">MANCHESTER PITI</span>
              <h2>Récords del equipo</h2>
            </div>
            <p>
              Resultados y series del período seleccionado. Cada registro enlaza
              con el acta correspondiente.
            </p>
          </header>
          <div className="analytics-record-grid">
            <RecordCard
              title="Mayor margen de victoria"
              unit="goles de diferencia"
              entries={teamRecords(games, "win")}
              rows={rows}
            />
            <RecordCard
              title="Más goles a favor"
              unit="goles en un partido"
              entries={teamRecords(games, "scored")}
              rows={rows}
            />
            <RecordCard
              title="Partido con más goles"
              unit="goles entre ambos equipos"
              entries={teamRecords(games, "total")}
              rows={rows}
            />
            <RecordCard
              title="Más goles encajados"
              unit="goles en un partido"
              entries={teamRecords(games, "conceded")}
              rows={rows}
            />
          </div>
          <div className="analytics-record-grid">
            <StreakCard title="Victorias consecutivas" data={team.winStreak} />
            <StreakCard
              title="Partidos sin perder"
              data={team.unbeatenStreak}
            />
            <StreakCard title="Partidos marcando" data={team.scoringStreak} />
            <StreakCard title="Portería a cero" data={team.cleanStreak} />
          </div>
        </>
      )}
      {section === "evolution" && (
        <>
          <EvolutionChart
            key={games.map((g) => g.id).join("|")}
            rows={rows}
            games={games}
          />
          <section className="club-panel">
            <div className="club-toolbar">
              <div>
                <span className="club-kicker">CLASIFICACIÓN VISUAL</span>
                <h2>Ranking de jugadores</h2>
              </div>
              <label>
                Ordenar por
                <select
                  aria-label="Métrica del ranking visual"
                  value={leaderMetric}
                  onChange={(e) =>
                    setLeaderMetric(e.target.value as typeof leaderMetric)
                  }
                >
                  {Object.entries({
                    goals: "Goles",
                    assists: "Asistencias",
                    ga: "Goles + asistencias",
                    matchesPlayed: "Partidos",
                    minutes: "Minutos registrados",
                  }).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <RankingBars
              rows={rows}
              value={(p) => p[leaderMetric]}
              unit={
                leaderMetric === "minutes"
                  ? "min"
                  : leaderMetric === "matchesPlayed"
                    ? "PJ"
                    : leaderMetric === "ga"
                      ? "G+A"
                      : leaderMetric === "assists"
                        ? "A"
                        : "G"
              }
              medals={leaderMetric === "goals"}
            />
            <p className="analytics-note">
              Empates con clasificación compartida: 1, 2, 2, 4. No se asignan
              medallas a valores cero.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
