// Estadísticas (Celeste · "elegida"): the analyst's room with the stadium board on top — the Pichichi
// race and the ticker — then six tabs (Resumen, Jugadores, Minutos, Rivales, Comparar, Explorar).
// From the Design canvas "Estadísticas · elegida"; pure logic in lib/clubAnalytics.ts + lib/statsView.ts.
import { useMemo } from "react";
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router";
import { playerForSeason, playerName, useClubData } from "../../lib/clubData";
import { analysePlayer, chronological, type PlayerAnalysis } from "../../lib/clubAnalytics";
import { tickerLines } from "../../lib/statsView";
import { mvpWins } from "../../lib/vestuario";
import { useMvpResults } from "../vestuario/live";
import { useSeason } from "../../context/SeasonContext";
import { useClock } from "../../hooks/useClock";
import { ThemeToggle } from "../../components/ThemeToggle";
import { CelesteBackdrop, CelesteDock, CelesteFooter, CelesteHeader } from "../../components/celeste/Chrome";
import { Icon } from "../../components/celeste/icons";
import { RaceBoard, Ticker } from "./Race";
import { Comparar, Jugadores, Minutos, Resumen, Rivales } from "./Panes";
import { Explorar, type ExploreSection } from "./Explorar";
import "../../styles/home.css";
import "../../styles/partidos.css";
import "../../styles/stats.css";

const route = getRouteApi("/stats");
const VIEWS = {
  summary: "Resumen",
  players: "Jugadores",
  minutes: "Minutos",
  rivals: "Rivales",
  compare: "Comparar",
  explore: "Explorar",
} as const;
type View = keyof typeof VIEWS;
const nameOf = (p: PlayerAnalysis) => playerName(p);

export function StatsPage() {
  const { matches, players, loading, error } = useClubData();
  const { seasons, selectedSeasonId, loadingSeasons } = useSeason();
  const search = route.useSearch();
  const navigate = useNavigate();
  const now = useClock(60_000);
  const results = useMvpResults();
  const view: View = search.view ?? (search.tab === "compare" ? "compare" : "summary");
  const section: ExploreSection = search.section ?? "individual";
  const setView = (next: View) => void navigate({ to: ".", search: (prev) => ({ ...prev, view: next, tab: next === "compare" ? "compare" : "general" }), resetScroll: false });
  const setSection = (next: ExploreSection) => void navigate({ to: ".", search: (prev) => ({ ...prev, view: "explore", section: next }), resetScroll: false });
  const setSeason = (season: string) => void navigate({ to: ".", search: (prev) => ({ ...prev, season }) });

  const games = useMemo(() => chronological(matches.filter((m) => selectedSeasonId === "all" || m.seasonId === selectedSeasonId)), [matches, selectedSeasonId]);
  const rows = useMemo(
    () => players.filter((p) => selectedSeasonId === "all" || p.seasons?.includes(selectedSeasonId)).map((p) => analysePlayer(playerForSeason(p, selectedSeasonId, seasons), games)),
    [players, games, selectedSeasonId, seasons],
  );
  const mvps = useMemo(() => new Map(rows.map((p) => [p.id, mvpWins(p.id, games, results, now)]).filter(([, n]) => (n as number) > 0) as [string, number][]), [rows, games, results, now]);
  const lines = useMemo(() => tickerLines(rows, games), [rows, games]);
  const top = (value: (p: PlayerAnalysis) => number) => [...rows].sort((a, b) => value(b) - value(a) || nameOf(a).localeCompare(nameOf(b))).find((p) => value(p) > 0);
  const leaders = [
    { label: "Pichichi", p: top((p) => p.goals), v: (p: PlayerAnalysis) => p.goals },
    { label: "Asistente", p: top((p) => p.assists), v: (p: PlayerAnalysis) => p.assists },
    { label: "Más MVP", p: top((p) => mvps.get(p.id) ?? 0), v: (p: PlayerAnalysis) => mvps.get(p.id) ?? 0 },
  ].filter((l) => l.p);
  const tracked = games.filter((m) => m.ledger && Object.keys(m.ledger).length).length;
  const periodName = selectedSeasonId === "all" ? "Todo el historial" : (seasons.find((s) => s.id === selectedSeasonId)?.name ?? "Temporada");
  const ready = !loading && !error;
  const empty = ready && !games.length;

  return (
    <div className="vx hm st" aria-busy={loading}>
      <CelesteBackdrop />
      <CelesteHeader
        active="stats"
        sub="Estadísticas"
        actions={
          <>
            <ThemeToggle />
            <Link className="hm-cta-top" to="/vestuario">
              <Icon name="padlock" size={16} stroke={2.2} />
              <span className="t">Vestuario</span>
              <span className="hm-sr">Entrar al vestuario</span>
            </Link>
          </>
        }
      />
      <section className="st-hero" aria-labelledby="st-t">
        <div className="pt-beams" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className="st-stars" aria-hidden="true" />
        <div className="st-hero-in">
          <div className="st-intro pt-rise">
            <span className="hm-kick" style={{ margin: 0 }}>
              MANCHESTER PITI · {periodName}
            </span>
            <h1 className="st-h1" id="st-t">
              Estadísticas
            </h1>
            <p className="st-lead">{empty ? "La temporada aún no ha echado a rodar: en cuanto se publique la primera acta, aquí se mueve todo." : `${periodName}. Datos de partidos finalizados, al minuto.`}</p>
            <div className="st-ctx">
              {(seasons.length > 0 || loadingSeasons) && (
                <label className="st-field">
                  <span className="st-mono">Temporada</span>
                  <select aria-label="Seleccionar temporada" value={loadingSeasons ? "all" : selectedSeasonId} disabled={loadingSeasons} onChange={(e) => setSeason(e.target.value)}>
                    <option value="all">Todo el historial</option>
                    {[...seasons].reverse().map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <p className="st-count">
                <b>{games.length}</b> {games.length === 1 ? "partido" : "partidos"} · <b>{rows.length}</b> jugadores · <b>{tracked}</b> actas con minutos
              </p>
            </div>
            {leaders.length > 0 && (
              <ul className="st-leaders" aria-label="Líderes del período">
                {leaders.map((l, i) => (
                  <li key={l.label} style={{ animationDelay: `${0.3 + i * 0.08}s` }}>
                    <small>{l.label}</small>
                    <b>{l.v(l.p!)}</b>
                    <Link to="/jugadores/$playerId" params={{ playerId: l.p!.id }}>
                      {nameOf(l.p!)}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="st-board pt-rise" style={{ animationDelay: ".12s" }}>
            <div className="st-sweep" aria-hidden="true" />
            {ready && games.length > 0 ? (
              <>
                <RaceBoard rows={rows} nameOf={nameOf} />
                <Ticker lines={lines} />
              </>
            ) : (
              <div className="st-race st-race-pre">
                <span className="st-new">nuevo</span>
                <h2 className="st-led">La carrera del Pichichi</h2>
                <p className="st-mono">{loading ? "Encendiendo el marcador…" : "Arranca con la primera jornada: cada gol moverá la tabla en directo."}</p>
                <ol className="st-rrows pre" aria-hidden="true">
                  {[1, 2, 3, 4].map((n) => (
                    <li key={n} className="st-rrow">
                      <span className="rk">{n}</span>
                      <span className="sh">·</span>
                      <span className="mid">
                        <span className="nm">— — —</span>
                        <span className="tr">
                          <i style={{ width: "0%" }} />
                        </span>
                      </span>
                      <span className="vl">0</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </div>
      </section>

      <nav className="st-tabs" aria-label="Secciones de estadísticas">
        <div className="st-tabs-in">
          {(Object.entries(VIEWS) as [View, string][]).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={view === k} onClick={() => setView(k)}>
              {l}
            </button>
          ))}
        </div>
      </nav>

      <main className="st-main">
        {loading && (
          <p className="st-state" role="status">
            Preparando el terreno de juego…
          </p>
        )}
        {error && (
          <div className="st-state" role="alert">
            <p>No hemos podido cargar los datos del club.</p>
            <button type="button" className="hm-ghostbtn" onClick={() => window.location.reload()}>
              Reintentar
            </button>
          </div>
        )}
        {empty && (
          <div className="st-state">
            <p>Todavía no hay partidos finalizados en este período. Los datos aparecerán al publicar las actas.</p>
            {selectedSeasonId !== "all" && (
              <button type="button" className="hm-ghostbtn" onClick={() => setSeason("all")}>
                Ver todo el historial
              </button>
            )}
          </div>
        )}
        {ready && games.length > 0 && (
          <div key={view} className="st-pane">
            {view === "summary" && <Resumen games={games} rows={rows} nameOf={nameOf} mvps={mvps} />}
            {view === "players" && <Jugadores rows={rows} nameOf={nameOf} />}
            {view === "minutes" && <Minutos rows={rows} games={games} nameOf={nameOf} />}
            {view === "rivals" && <Rivales games={games} rows={rows} />}
            {view === "compare" && <Comparar rows={rows} nameOf={nameOf} games={games.length} />}
            {view === "explore" && <Explorar rows={rows} games={games} section={section} onSection={setSection} nameOf={nameOf} />}
          </div>
        )}
      </main>
      <CelesteFooter />
      <CelesteDock active="stats" />
    </div>
  );
}

export default StatsPage;
