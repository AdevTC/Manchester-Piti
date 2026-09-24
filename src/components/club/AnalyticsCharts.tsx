import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { playerName, formatDate, type ClubMatch } from "../../lib/clubData";
import {
  competitionRanks,
  medalFor,
  type PlayerAnalysis,
} from "../../lib/clubAnalytics";

export function RankingBars({
  rows,
  value,
  unit,
  medals = false,
}: {
  rows: PlayerAnalysis[];
  value: (p: PlayerAnalysis) => number;
  unit: string;
  medals?: boolean;
}) {
  const sorted = [...rows]
    .filter((p) => value(p) > 0)
    .sort(
      (a, b) =>
        value(b) - value(a) || playerName(a).localeCompare(playerName(b)),
    );
  if (!sorted.length)
    return (
      <p className="analytics-empty">Sin registros para esta selección.</p>
    );
  const ranks = competitionRanks(sorted, value),
    max = value(sorted[0]) || 1;
  return (
    <ol className="analytics-bars">
      {sorted.map((p) => (
        <li
          key={p.id}
          className={
            medals ? "medal-" + medalFor(ranks.get(p.id), value(p)) : ""
          }
        >
          <span className="analytics-rank">{ranks.get(p.id)}</span>
          <div>
            <Link to="/jugadores/$playerId" params={{ playerId: p.id }}>
              {playerName(p)}
            </Link>
            <span className="analytics-bar-track">
              <i style={{ width: (value(p) / max) * 100 + "%" }} />
            </span>
          </div>
          <b>
            {value(p)}
            <small>{unit}</small>
          </b>
        </li>
      ))}
    </ol>
  );
}
export function MatchGoalsChart({ games }: { games: ClubMatch[] }) {
  const recent = games.slice(-12),
    max = Math.max(
      1,
      ...recent.flatMap((g) => [g.goalsFor ?? 0, g.goalsAgainst ?? 0]),
    );
  return (
    <div className="analytics-form-chart">
      <div className="analytics-chart-legend">
        <span>
          <i className="for" />
          Goles a favor
        </span>
        <span>
          <i className="against" />
          Goles en contra
        </span>
        <small>Últimos {recent.length} partidos</small>
      </div>
      <div className="analytics-game-bars">
        {recent.map((m) => (
          <Link
            key={m.id}
            to="/matches/$matchId"
            params={{ matchId: m.id }}
            title={
              formatDate(m.date) +
              " · " +
              m.rival +
              " · " +
              m.goalsFor +
              "–" +
              m.goalsAgainst
            }
            aria-label={m.rival + ": " + m.goalsFor + " a " + m.goalsAgainst}
          >
            <div className="analytics-game-columns">
              <i style={{ height: ((m.goalsFor ?? 0) / max) * 100 + "%" }}>
                <b>{m.goalsFor}</b>
              </i>
              <i style={{ height: ((m.goalsAgainst ?? 0) / max) * 100 + "%" }}>
                <b>{m.goalsAgainst}</b>
              </i>
            </div>
            <span>{formatDate(m.date).split(" ").slice(0, 2).join(" ")}</span>
            <small>
              {m.goalsFor! > m.goalsAgainst!
                ? "V"
                : m.goalsFor === m.goalsAgainst
                  ? "E"
                  : "D"}
            </small>
          </Link>
        ))}
      </div>
    </div>
  );
}
const colors = [
  "#6cabdd",
  "#f1bb48",
  "#ce89ec",
  "#6fd1ad",
  "#ff8c79",
  "#a1b5fd",
];
type EvolutionMetric = "goals" | "assists" | "ga" | "matchesPlayed" | "minutes";
export function EvolutionChart({
  rows,
  games,
}: {
  rows: PlayerAnalysis[];
  games: ClubMatch[];
}) {
  const [metric, setMetric] = useState<EvolutionMetric>("goals");
  const [chosen, setChosen] = useState<string[] | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const candidates = [...rows]
    .filter((p) => metric !== "minutes" || p.tracked)
    .sort(
      (a, b) =>
        b[metric] - a[metric] || playerName(a).localeCompare(playerName(b)),
    );
  const selected = (chosen ?? candidates.slice(0, 4).map((p) => p.id)).filter(
    (id) => candidates.some((p) => p.id === id),
  );
  const lines = candidates
    .filter((p) => selected.includes(p.id))
    .map((p, index) => {
      let total = 0;
      return {
        p,
        color: colors[index % colors.length],
        values: p.series.map((g) => {
          total += g[metric] ?? 0;
          return total;
        }),
      };
    });
  const max = Math.max(1, ...lines.flatMap((l) => l.values)),
    top = Math.ceil(max / 4) * 4;
  const x = (index: number) =>
    52 + (index * 654) / Math.max(1, games.length - 1);
  const y = (value: number) => 248 - (value / top) * 214;
  const index = Math.min(
    Math.max(0, cursor ?? games.length - 1),
    Math.max(0, games.length - 1),
  );
  const current = games[index];
  const labels: Record<EvolutionMetric, string> = {
    goals: "Goles",
    assists: "Asistencias",
    ga: "Goles + asistencias",
    matchesPlayed: "Partidos",
    minutes: "Minutos registrados",
  };
  const toggle = (id: string) =>
    setChosen(
      selected.includes(id)
        ? selected.filter((v) => v !== id)
        : [...selected, id].slice(-6),
    );
  return (
    <section className="club-panel analytics-evolution">
      <div className="club-toolbar">
        <div>
          <span className="club-kicker">EVOLUCIÓN ACUMULADA</span>
          <h2>La clasificación, partido a partido</h2>
        </div>
        <label>
          Métrica
          <select
            aria-label="Métrica de la gráfica"
            value={metric}
            onChange={(e) => {
              setMetric(e.target.value as EvolutionMetric);
              setChosen(null);
              setCursor(null);
            }}
          >
            {Object.entries(labels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p>
        Selecciona hasta seis jugadores. Mueve el cursor o utiliza el selector
        de partido para consultar los acumulados de una fecha.
      </p>
      <div
        className="analytics-player-picks"
        role="group"
        aria-label="Jugadores de la gráfica"
      >
        {candidates.map((p) => (
          <label
            key={p.id}
            className={selected.includes(p.id) ? "selected" : ""}
          >
            <input
              type="checkbox"
              checked={selected.includes(p.id)}
              onChange={() => toggle(p.id)}
            />
            <i
              style={{
                background:
                  lines.find((l) => l.p.id === p.id)?.color ??
                  "var(--mp-muted)",
              }}
            />
            {playerName(p)}
          </label>
        ))}
      </div>
      {games.length && lines.length ? (
        <>
          <svg
            className="analytics-line-chart"
            viewBox="0 0 740 294"
            role="img"
            aria-label={
              "Evolución de " +
              labels[metric] +
              ". Los valores del partido seleccionado aparecen debajo."
            }
            onPointerMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const scaled = ((e.clientX - r.left) / r.width) * 740;
              setCursor(
                Math.round(
                  ((scaled - 52) / 654) * Math.max(1, games.length - 1),
                ),
              );
            }}
          >
            {[0, 1, 2, 3, 4].map((t) => (
              <g key={t}>
                <line
                  x1="52"
                  x2="706"
                  y1={y((t * top) / 4)}
                  y2={y((t * top) / 4)}
                  className="analytics-grid-line"
                />
                <text x="39" y={y((t * top) / 4) + 4} textAnchor="end">
                  {(t * top) / 4}
                </text>
              </g>
            ))}
            {[
              ...new Set([
                0,
                Math.floor((games.length - 1) / 2),
                games.length - 1,
              ]),
            ].map((i) => (
              <text
                key={i}
                x={x(i)}
                y="278"
                textAnchor={
                  i === 0 ? "start" : i === games.length - 1 ? "end" : "middle"
                }
              >
                {formatDate(games[i].date)}
              </text>
            ))}
            <line
              x1={x(index)}
              x2={x(index)}
              y1="28"
              y2="248"
              stroke="var(--mp-muted)"
              strokeDasharray="4 5"
            />
            {lines.map((l) => (
              <g key={l.p.id}>
                <polyline
                  points={l.values.map((v, i) => x(i) + "," + y(v)).join(" ")}
                  fill="none"
                  stroke={l.color}
                  strokeWidth="2.8"
                  strokeLinejoin="round"
                />
                <circle
                  cx={x(index)}
                  cy={y(l.values[index] ?? 0)}
                  r="5"
                  fill={l.color}
                  stroke="var(--club-surface)"
                  strokeWidth="2"
                />
              </g>
            ))}
          </svg>
          <label className="analytics-scrubber">
            Partido {index + 1} de {games.length}
            <input
              type="range"
              min="0"
              max={games.length - 1}
              value={index}
              onChange={(e) => setCursor(Number(e.target.value))}
              aria-label="Partido consultado en la gráfica"
            />
          </label>
          {current && (
            <div className="analytics-cursor-detail">
              <Link to="/matches/$matchId" params={{ matchId: current.id }}>
                <b>{formatDate(current.date)}</b> Piti {current.goalsFor}–
                {current.goalsAgainst} {current.rival} ↗
              </Link>
              <div>
                {lines.map((l) => (
                  <span key={l.p.id}>
                    <i style={{ background: l.color }} />
                    {playerName(l.p)}
                    <b>{l.values[index]}</b>
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="analytics-empty">
          {!games.length
            ? "No hay partidos finalizados."
            : "Selecciona jugadores con datos para mostrar la gráfica."}
        </p>
      )}
      {metric === "minutes" && (
        <p className="analytics-note">
          Solo se acumulan minutos de actas completas. El historial sin minutos
          no se estima.
        </p>
      )}
    </section>
  );
}
