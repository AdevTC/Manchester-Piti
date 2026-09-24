import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Trophy } from "lucide-react";
import { useClubData, playerName, playerForSeason } from "../lib/clubData";
import { useSeason } from "../context/SeasonContext";
import { SeasonSelector } from "../components/SeasonSelector";
import { Jersey } from "../components/Jersey";
import { DataState } from "../components/club/ClubUI";
import {
  ageOn,
  analysePlayer,
  chronological,
  competitionRanks,
  medalFor,
  type PlayerAnalysis,
} from "../lib/clubAnalytics";
function GoalSparkline({ values }: { values: number[] }) {
  const top = Math.max(1, ...values);
  const points = values.map((v, i) => [
    4 + (i * 92) / Math.max(1, values.length - 1),
    30 - (v * 26) / top,
  ]);
  return (
    <svg
      viewBox="0 0 100 34"
      className="squad-sparkline"
      role="img"
      aria-label={
        "Goles en los últimos " +
        values.length +
        " partidos: " +
        values.join(", ")
      }
    >
      <line x1="3" x2="97" y1="30" y2="30" stroke="currentColor" opacity=".2" />
      <polyline
        points={points.map((p) => p.join(",")).join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      {points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.8" fill="currentColor" />
      ))}
    </svg>
  );
}
function PlayerCard({
  p,
  rank,
  today,
}: {
  p: PlayerAnalysis;
  rank?: number;
  today: Date;
}) {
  const medal = medalFor(rank, p.goals);
  const age = ageOn(p.birthDate, today);
  const recorded = (n: number) => (p.tracked ? n : "—");
  const name = p.firstName || playerName(p);
  return (
    <article className={"squad-dossier" + (medal ? " medal-" + medal : "")}>
      <header className="squad-dossier-head">
        <div className="squad-status-row">
          <span>
            {p.active === false
              ? "HISTÓRICO"
              : p.injured
                ? "LESIONADO"
                : "ACTIVO"}
          </span>
          {medal && (
            <b>
              <Trophy size={12} />
              {rank === 1 ? "PICHICHI" : rank + ".º GOLEADOR"}
            </b>
          )}
        </div>
        <span className="squad-ghost-number" aria-hidden="true">
          {p.number ?? "—"}
        </span>
        <small>
          {p.naturalPosition || "JUGADOR"}
          <b>N.º {String(p.number ?? "—").padStart(2, "0")}</b>
        </small>
        <Link
          to="/jugadores/$playerId"
          params={{ playerId: p.id }}
          className="squad-name"
        >
          <h2>{name}</h2>
        </Link>
        <div className="squad-name-detail">
          <span>{p.lastName || "Manchester Piti"}</span>
          {p.shirtName && <span className="squad-alias">{p.shirtName}</span>}
        </div>
      </header>
      <div className="squad-bio-row">
        <div className="squad-shirt">
          {p.photoUrl ? (
            <img src={p.photoUrl} alt={name} loading="lazy" />
          ) : (
            <Jersey name={playerName(p)} number={p.number ?? 0} size="sm" />
          )}
        </div>
        <dl>
          {[
            [age, "Edad", "años"],
            [p.height, "Altura", "cm"],
            [p.weight, "Peso", "kg"],
          ].map(([v, l, u]) => (
            <div key={String(l)}>
              <dt>{l}</dt>
              <dd>
                {v || "—"}
                {v ? <small>{u}</small> : null}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="squad-feature-stat">
        <div>
          <span>{medal ? "GOLES EN EL PERÍODO" : "GOLES + ASISTENCIAS"}</span>
          <small>Goles · últimos {Math.min(6, p.series.length)} partidos</small>
        </div>
        <GoalSparkline values={p.series.slice(-6).map((g) => g.goals)} />
        <strong>{medal ? p.goals : p.ga}</strong>
      </div>
      <dl className="squad-stat-grid">
        {[
          ["Partidos", p.matchesPlayed],
          ["Goles", p.goals],
          ["Asistencias", p.assists],
          ["Minutos", p.tracked ? p.minutes + "′" : "—"],
          ["Titular", recorded(p.starts)],
          ["Suplente inicial", recorded(p.bench)],
          ["Entradas", recorded(p.subIn)],
          ["Salidas", recorded(p.subOut)],
          ["Amarillas", p.yellowCards],
          ["Expulsiones", p.redCards],
          ["Tiros al palo", p.woodwork],
          ["No convocado", recorded(p.notCalled)],
        ].map(([l, v]) => (
          <div key={l}>
            <dt>{l}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <details className="squad-extra">
        <summary>
          Desglose de goles y penaltis <span>+</span>
        </summary>
        <dl className="squad-stat-grid">
          {[
            ["Goles de falta", p.goalFreekick],
            ["Goles de penalti", p.goalPenalty],
            ["Penaltis parados", p.penaltySaved],
            ["Penaltis fallados", p.penaltyMissed],
            ["Penaltis cometidos", recorded(p.penaltyCommitted)],
            ["Penaltis recibidos", recorded(p.penaltyReceived)],
            ["Doble amarilla", p.doubleYellows],
            ["Autogoles", p.ownGoals],
          ].map(([l, v]) => (
            <div key={l}>
              <dt>{l}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </details>
      <footer>
        <span>
          {p.seasons?.length ?? 0} temporadas{" "}
          <small>
            {p.tracked
              ? p.tracked + " actas con minutos"
              : "Minutos sin registrar"}
          </small>
        </span>
        <Link to="/jugadores/$playerId" params={{ playerId: p.id }}>
          Ver ficha <ArrowUpRight size={16} />
        </Link>
      </footer>
    </article>
  );
}
export function SquadPage() {
  const { players, matches, loading, error } = useClubData();
  const { selectedSeasonId, seasons } = useSeason();
  const [search, setSearch] = useState("");
  const [historic, setHistoric] = useState(false);
  const [sort, setSort] = useState("number");
  const [today] = useState(() => new Date());
  const rows = useMemo(() => {
    const games = chronological(
      matches.filter(
        (m) => selectedSeasonId === "all" || m.seasonId === selectedSeasonId,
      ),
    );
    return players
      .filter(
        (p) =>
          selectedSeasonId === "all" || p.seasons?.includes(selectedSeasonId),
      )
      .map((p) =>
        analysePlayer(playerForSeason(p, selectedSeasonId, seasons), games),
      );
  }, [players, matches, selectedSeasonId, seasons]);
  const ranks = competitionRanks(rows, (p) => p.goals);
  const filtered = rows
    .filter(
      (p) =>
        (historic || p.active !== false) &&
        [p.firstName, p.lastName, p.shirtName, p.number]
          .join(" ")
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
    )
    .sort((a, b) =>
      sort === "name"
        ? (a.firstName || playerName(a)).localeCompare(
            b.firstName || playerName(b),
          )
        : sort === "goals"
          ? b.goals - a.goals || (a.number ?? 999) - (b.number ?? 999)
          : sort === "minutes"
            ? b.minutes - a.minutes || b.matchesPlayed - a.matchesPlayed
            : (a.number ?? 999) - (b.number ?? 999),
    );
  return (
    <div className="club-page">
      <header className="club-page-head">
        <span className="club-kicker">MANCHESTER PITI</span>
        <h1>Plantilla</h1>
        <p>Jugadores, trayectoria y rendimiento por temporada.</p>
      </header>
      <SeasonSelector />
      <div className="club-toolbar squad-toolbar">
        <div className="club-segments">
          <button
            className={!historic ? "active" : ""}
            aria-pressed={!historic}
            onClick={() => setHistoric(false)}
          >
            Activos
          </button>
          <button
            className={historic ? "active" : ""}
            aria-pressed={historic}
            onClick={() => setHistoric(true)}
          >
            Todos los jugadores
          </button>
        </div>
        <div className="club-actions">
          <label className="squad-sort">
            Ordenar
            <select
              aria-label="Ordenar jugadores"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="number">Dorsal</option>
              <option value="goals">Goles</option>
              <option value="minutes">Minutos</option>
              <option value="name">Nombre</option>
            </select>
          </label>
          <input
            aria-label="Buscar jugador"
            placeholder="Nombre, alias o dorsal…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="squad-legend">
        <span>
          <i className="gold" />
          1.º
        </span>
        <span>
          <i className="silver" />
          2.º
        </span>
        <span>
          <i className="bronze" />
          3.º goleador
        </span>
        <small>
          Los empates comparten puesto y saltan el siguiente. «—» significa sin
          datos.
        </small>
      </div>
      <DataState loading={loading} error={error} />
      <div className="squad-dossier-grid">
        {filtered.map((p) => (
          <PlayerCard key={p.id} p={p} rank={ranks.get(p.id)} today={today} />
        ))}
      </div>
      {!loading && !error && !filtered.length && (
        <div className="club-empty">No hay jugadores para esta selección.</div>
      )}
    </div>
  );
}
