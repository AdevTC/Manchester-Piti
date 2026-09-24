import { lazy, Suspense, useMemo, useState } from "react";
import { Link, getRouteApi } from "@tanstack/react-router";
import { Download, ArrowRight } from "lucide-react";
import { useClubData, playerName, playerForSeason } from "../lib/clubData";
import {
  analysePlayer,
  chronological,
  competitionRanks,
  medalFor,
  metrics,
  metricValue,
  teamAnalysis,
  type PlayerMetric,
  type PlayerAnalysis,
} from "../lib/clubAnalytics";
import { useSeason } from "../context/SeasonContext";
import { SeasonSelector } from "../components/SeasonSelector";
import { DataState } from "../components/club/ClubUI";
import {
  MatchGoalsChart,
  RankingBars,
} from "../components/club/AnalyticsCharts";
import { OpponentBadge } from "../components/club/OpponentBadge";
import type { ExploreSection } from "./stats/StatsExplorer";
const Explorer = lazy(() =>
  import("./stats/StatsExplorer").then((m) => ({ default: m.StatsExplorer })),
);
const route = getRouteApi("/stats");
const views = {
  summary: "Resumen",
  players: "Jugadores",
  minutes: "Minutos",
  rivals: "Rivales",
  compare: "Comparar",
  explore: "Explorar",
} as const;
const displayValue = (p: PlayerAnalysis, key: PlayerMetric) =>
  metricValue(p, key) ?? "—";
function exportCsv(rows: PlayerAnalysis[]) {
  const quote = (value: unknown) =>
    '"' +
    String(value ?? "")
      .replace(/^[=+@-]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  const keys = Object.keys(metrics) as PlayerMetric[];
  const lines = [
    ["Jugador", ...keys.map((k) => metrics[k])],
    ...rows.map((p) => [playerName(p), ...keys.map((k) => metricValue(p, k))]),
  ];
  const url = URL.createObjectURL(
    new Blob(
      ["\uFEFF" + lines.map((line) => line.map(quote).join(";")).join("\r\n")],
      { type: "text/csv;charset=utf-8" },
    ),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "manchester-piti-estadisticas.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function ClubStats() {
  const { matches, players, loading, error } = useClubData();
  const { selectedSeasonId, seasons } = useSeason();
  const search = route.useSearch(),
    navigate = route.useNavigate();
  const view =
      search.view ?? (search.tab === "compare" ? "compare" : "summary"),
    section = search.section ?? "individual";
  const setView = (next: keyof typeof views) =>
    void navigate({
      search: (prev) => ({
        ...prev,
        view: next,
        tab: next === "compare" ? "compare" : "general",
      }),
      resetScroll: false,
    });
  const setSection = (next: ExploreSection) =>
    void navigate({
      search: (prev) => ({ ...prev, view: "explore", section: next }),
      resetScroll: false,
    });
  const [metric, setMetric] = useState<PlayerMetric>("goals");
  const [query, setQuery] = useState("");
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const games = useMemo(
    () =>
      chronological(
        matches.filter(
          (m) => selectedSeasonId === "all" || m.seasonId === selectedSeasonId,
        ),
      ),
    [matches, selectedSeasonId],
  );
  const rows = useMemo(
    () =>
      players
        .filter(
          (p) =>
            selectedSeasonId === "all" || p.seasons?.includes(selectedSeasonId),
        )
        .map((p) =>
          analysePlayer(playerForSeason(p, selectedSeasonId, seasons), games),
        ),
    [players, games, selectedSeasonId, seasons],
  );
  const total = teamAnalysis(games),
    tracked = games.filter(
      (m) => m.ledger && Object.keys(m.ledger).length,
    ).length;
  const sorted = [...rows].sort(
    (a, b) =>
      (metricValue(b, metric) ?? -1) - (metricValue(a, metric) ?? -1) ||
      playerName(a).localeCompare(playerName(b)),
  );
  const filtered = sorted.filter((p) =>
    [p.firstName, p.lastName, p.shirtName, p.number]
      .join(" ")
      .toLowerCase()
      .includes(query.toLowerCase().trim()),
  );
  const ranks = competitionRanks(rows, (p) => p.goals);
  const metricRanks = competitionRanks(
    rows,
    (p) => metricValue(p, metric) ?? -1,
  );
  const minuteRows = [...rows].sort(
    (a, b) =>
      (b.tracked ? b.minutes : -1) - (a.tracked ? a.minutes : -1) ||
      playerName(a).localeCompare(playerName(b)),
  );
  const lp = rows.find((p) => p.id === left) ?? rows[0];
  const rp =
    rows.find((p) => p.id === right && p.id !== lp?.id) ??
    rows.find((p) => p.id !== lp?.id);
  const duos: Record<string, number> = {};
  games.forEach((m) =>
    (m.events ?? []).forEach((e) => {
      if (
        ["goal", "goal_penalty", "goal_freekick"].includes(e.type) &&
        e.playerId &&
        e.assistPlayerId
      ) {
        const k = e.assistPlayerId + "|" + e.playerId;
        duos[k] = (duos[k] ?? 0) + 1;
      }
    }),
  );
  const rivalKey = (name: string) =>
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  const rivalGroups = new Map<string, typeof games>();
  games.forEach((m) => {
    const key = rivalKey(m.rival || "Rival");
    rivalGroups.set(key, [...(rivalGroups.get(key) ?? []), m]);
  });
  const rivals = [...rivalGroups.values()]
    .map((g) => ({
      name: g[0].rival || "Rival",
      logo: g.find((m) => m.rivalLogoUrl)?.rivalLogoUrl,
      initials: g.find((m) => m.rivalInitials)?.rivalInitials,
      ...teamAnalysis(g),
    }))
    .sort((a, b) => b.played - a.played || a.name.localeCompare(b.name));
  return (
    <div className="club-page analytics-page">
      <header className="club-page-head">
        <span className="club-kicker">MANCHESTER PITI</span>
        <h1>Estadísticas</h1>
        <p>
          {selectedSeasonId === "all"
            ? "Historial completo"
            : seasons.find((s) => s.id === selectedSeasonId)?.name}
          . Datos de partidos finalizados.
        </p>
      </header>
      <div className="analytics-context">
        <SeasonSelector />
        <span>
          {games.length} partidos · {rows.length} jugadores · {tracked} actas
          con minutos
        </span>
      </div>
      <nav
        className="analytics-main-nav"
        aria-label="Secciones de estadísticas"
      >
        {Object.entries(views).map(([key, label]) => (
          <button
            key={key}
            aria-pressed={view === key}
            className={view === key ? "active" : ""}
            onClick={() => setView(key as keyof typeof views)}
          >
            {label}
          </button>
        ))}
      </nav>
      <DataState loading={loading} error={error} />
      {!loading &&
        !error &&
        (!games.length ? (
          <div className="club-empty">
            Todavía no hay partidos finalizados en este período. Los datos
            aparecerán al publicar las actas.
          </div>
        ) : (
          <>
            {view === "summary" && (
              <>
                <div className="club-stat-grid analytics-summary">
                  {[
                    [total.played, "Partidos"],
                    [total.wins, "Victorias"],
                    [total.draws, "Empates"],
                    [total.losses, "Derrotas"],
                    [total.gf, "Goles a favor"],
                    [total.ga, "Goles en contra"],
                    [(total.gf / total.played).toFixed(1), "Goles por partido"],
                    [
                      Math.round((total.wins / total.played) * 100) + "%",
                      "Victorias",
                    ],
                  ].map(([v, l]) => (
                    <div key={l}>
                      <b>{v}</b>
                      <span>{l}</span>
                    </div>
                  ))}
                </div>
                <section className="club-panel">
                  <div className="club-toolbar">
                    <div>
                      <span className="club-kicker">RESULTADOS RECIENTES</span>
                      <h2>Rendimiento del equipo</h2>
                    </div>
                    <span className="analytics-note">
                      Pulsa una columna para abrir el partido
                    </span>
                  </div>
                  <MatchGoalsChart games={games} />
                </section>
                <section className="club-panel">
                  <span className="club-kicker">ASISTENTE → GOLEADOR</span>
                  <h2>Conexiones de gol</h2>
                  <p>
                    Las parejas con más goles registrados. Cada pase cuenta en
                    una sola dirección.
                  </p>
                  <div className="analytics-duos">
                    {Object.entries(duos)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 5)
                      .map(([key, count]) => {
                        const [a, b] = key.split("|");
                        return (
                          <div key={key}>
                            <Link
                              to="/jugadores/$playerId"
                              params={{ playerId: a }}
                            >
                              {playerName(rows.find((p) => p.id === a))}
                            </Link>
                            <ArrowRight size={15} />
                            <Link
                              to="/jugadores/$playerId"
                              params={{ playerId: b }}
                            >
                              {playerName(rows.find((p) => p.id === b))}
                            </Link>
                            <strong>
                              {count}
                              <small>goles</small>
                            </strong>
                          </div>
                        );
                      })}
                  </div>
                  {!Object.keys(duos).length && (
                    <p className="analytics-empty">
                      Aún no hay asistencias vinculadas a goles en este período.
                    </p>
                  )}
                </section>
              </>
            )}
            {view === "players" && (
              <section className="club-panel">
                <div className="club-toolbar">
                  <div>
                    <h2>Datos de jugadores</h2>
                    <p className="analytics-note">
                      Elige cualquier métrica para ordenar. «—» indica que el
                      dato no está registrado.
                    </p>
                  </div>
                  <button
                    className="club-button secondary"
                    onClick={() => exportCsv(filtered)}
                  >
                    <Download size={16} />
                    Exportar CSV
                  </button>
                </div>
                <div className="club-toolbar">
                  <label>
                    Métrica
                    <select
                      aria-label="Ordenar estadísticas"
                      value={metric}
                      onChange={(e) =>
                        setMetric(e.target.value as PlayerMetric)
                      }
                    >
                      {Object.entries(metrics).map(([k, l]) => (
                        <option key={k} value={k}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>
                  <input
                    aria-label="Buscar en estadísticas"
                    placeholder="Buscar jugador…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <div className="club-table-scroll">
                  <table className="club-table analytics-player-table">
                    <thead>
                      <tr>
                        <th>Puesto / jugador</th>
                        <th className="analytics-selected-metric">
                          {metrics[metric]}
                        </th>
                        {(
                          [
                            "matchesPlayed",
                            "goals",
                            "assists",
                            "minutes",
                            "yellowCards",
                            "redCards",
                          ] as PlayerMetric[]
                        )
                          .filter((k) => k !== metric)
                          .map((k) => (
                            <th key={k}>{metrics[k]}</th>
                          ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((p) => (
                        <tr
                          key={p.id}
                          className={
                            "medal-" + medalFor(ranks.get(p.id), p.goals)
                          }
                        >
                          <td>
                            <span className="analytics-rank">
                              {metricValue(p, metric)! > 0
                                ? metricRanks.get(p.id)
                                : "—"}
                            </span>
                            <Link
                              to="/jugadores/$playerId"
                              params={{ playerId: p.id }}
                            >
                              {playerName(p)}
                            </Link>
                            {medalFor(ranks.get(p.id), p.goals) && (
                              <i
                                className="analytics-medal-dot"
                                title={ranks.get(p.id) + ".º goleador"}
                              />
                            )}
                          </td>
                          <td className="analytics-selected-metric">
                            <strong>{displayValue(p, metric)}</strong>
                          </td>
                          {(
                            [
                              "matchesPlayed",
                              "goals",
                              "assists",
                              "minutes",
                              "yellowCards",
                              "redCards",
                            ] as PlayerMetric[]
                          )
                            .filter((k) => k !== metric)
                            .map((k) => (
                              <td key={k}>{displayValue(p, k)}</td>
                            ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!filtered.length && (
                  <p className="analytics-empty">
                    Ningún jugador coincide con la búsqueda.
                  </p>
                )}
              </section>
            )}
            {view === "minutes" && (
              <>
                <section className="club-panel">
                  <span className="club-kicker">PARTICIPACIÓN</span>
                  <h2>Minutos y convocatorias</h2>
                  <p>
                    Calculados con el siete inicial y los cambios del acta. Hay{" "}
                    {tracked} de {games.length} partidos con seguimiento de
                    minutos; el historial anterior no se estima.
                  </p>
                  <div className="club-table-scroll">
                    <table className="club-table">
                      <thead>
                        <tr>
                          {[
                            "Jugador",
                            "Minutos",
                            "Titular",
                            "Suplente inicial",
                            "Entradas",
                            "Salidas",
                            "No convocado",
                            "Actas",
                          ].map((t) => (
                            <th key={t}>{t}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {minuteRows.map((p) => (
                          <tr key={p.id}>
                            <td>
                              <Link
                                to="/jugadores/$playerId"
                                params={{ playerId: p.id }}
                              >
                                {playerName(p)}
                              </Link>
                            </td>
                            {(
                              [
                                "minutes",
                                "starts",
                                "bench",
                                "subIn",
                                "subOut",
                                "notCalled",
                              ] as PlayerMetric[]
                            ).map((k) => (
                              <td key={k}>{displayValue(p, k)}</td>
                            ))}
                            <td>{p.tracked}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
                <section className="club-panel">
                  <h2>Distribución de minutos</h2>
                  <RankingBars
                    rows={minuteRows}
                    value={(p) => p.minutes}
                    unit="min"
                  />
                </section>
              </>
            )}
            {view === "rivals" && (
              <section className="club-panel">
                <h2>Historial por rival</h2>
                <p>Balance de enfrentamientos en el período seleccionado.</p>
                <div className="club-table-scroll">
                  <table className="club-table analytics-rival-table">
                    <thead>
                      <tr>
                        {[
                          "Rival",
                          "PJ",
                          "Victorias",
                          "Empates",
                          "Derrotas",
                          "Goles a favor",
                          "En contra",
                          "Balance",
                        ].map((t) => (
                          <th key={t}>{t}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rivals.map((r) => (
                        <tr key={r.name}>
                          <td>
                            <div>
                              <OpponentBadge
                                name={r.name}
                                logo={r.logo}
                                initials={r.initials}
                                size={36}
                              />
                              <b>{r.name}</b>
                            </div>
                          </td>
                          <td>{r.played}</td>
                          <td>{r.wins}</td>
                          <td>{r.draws}</td>
                          <td>{r.losses}</td>
                          <td>{r.gf}</td>
                          <td>{r.ga}</td>
                          <td>
                            <div
                              className="analytics-balance"
                              aria-label={
                                r.wins +
                                " victorias, " +
                                r.draws +
                                " empates, " +
                                r.losses +
                                " derrotas"
                              }
                            >
                              <i
                                style={{
                                  width: (r.wins / r.played) * 100 + "%",
                                }}
                              />
                              <i
                                style={{
                                  width: (r.draws / r.played) * 100 + "%",
                                }}
                              />
                              <i
                                style={{
                                  width: (r.losses / r.played) * 100 + "%",
                                }}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="analytics-note">
                  Balance: verde = victorias · gris = empates · rojo = derrotas.
                </p>
              </section>
            )}
            {view === "compare" && (
              <section className="club-panel">
                <h2>Comparar jugadores</h2>
                <p>
                  Totales del período seleccionado. Las barras muestran la
                  proporción entre los dos jugadores.
                </p>
                {lp && rp ? (
                  <>
                    <div className="analytics-compare-picks">
                      <label>
                        Primer jugador
                        <select
                          aria-label="Primer jugador"
                          value={lp.id}
                          onChange={(e) => setLeft(e.target.value)}
                        >
                          {rows.map((p) => (
                            <option key={p.id} value={p.id}>
                              {playerName(p)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <span>VS</span>
                      <label>
                        Segundo jugador
                        <select
                          aria-label="Segundo jugador"
                          value={rp.id}
                          onChange={(e) => setRight(e.target.value)}
                        >
                          {rows
                            .filter((p) => p.id !== lp.id)
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {playerName(p)}
                              </option>
                            ))}
                        </select>
                      </label>
                    </div>
                    <div className="analytics-compare-names">
                      <Link
                        to="/jugadores/$playerId"
                        params={{ playerId: lp.id }}
                      >
                        {playerName(lp)} ↗
                      </Link>
                      <Link
                        to="/jugadores/$playerId"
                        params={{ playerId: rp.id }}
                      >
                        {playerName(rp)} ↗
                      </Link>
                    </div>
                    <div className="analytics-comparison">
                      {Object.entries(metrics).map(([k, label]) => {
                        const a = metricValue(lp, k as PlayerMetric),
                          b = metricValue(rp, k as PlayerMetric),
                          sum = (a ?? 0) + (b ?? 0);
                        return (
                          <div key={k}>
                            <strong>{a ?? "—"}</strong>
                            <div>
                              <span>{label}</span>
                              <div className="analytics-compare-bar">
                                {a !== null && b !== null && sum > 0 && (
                                  <>
                                    <i
                                      style={{ width: (a / sum) * 100 + "%" }}
                                    />
                                    <i
                                      style={{ width: (b / sum) * 100 + "%" }}
                                    />
                                  </>
                                )}
                              </div>
                            </div>
                            <strong>{b ?? "—"}</strong>
                          </div>
                        );
                      })}
                    </div>
                    <p className="analytics-note">
                      Los minutos y convocatorias solo incluyen actas completas.
                      Un guion indica falta de datos.
                    </p>
                  </>
                ) : (
                  <p className="analytics-empty">
                    Se necesitan al menos dos jugadores en este período.
                  </p>
                )}
              </section>
            )}
            {view === "explore" && (
              <Suspense
                fallback={
                  <div className="club-empty">Cargando explorador…</div>
                }
              >
                <Explorer
                  rows={rows}
                  games={games}
                  section={section}
                  onSection={setSection}
                />
              </Suspense>
            )}
          </>
        ))}
    </div>
  );
}
