import { AnalysisPanels } from "../../components/celeste/AnalysisPanels";
import { ScopePicker } from "../../components/celeste/AnalysisScope";
import { inScope, scopeSeasons, type AnalysisSearch, type StatsScopeSearch } from "../../lib/analysisSearch";
// Estadísticas: its navigation precedes the Pichichi race (Resumen only), so focused views open on
// their content. The selected season and tied leaders stay visible in the shared introduction.
// From the Design canvas "Estadísticas · elegida"; pure logic in lib/clubAnalytics.ts + lib/statsView.ts.
import { useMemo } from "react";
import { Link, useLocation, useNavigate, useSearch } from "@tanstack/react-router";
import { statsViewAt, statsViewPath } from "../../lib/interimScreens";
import type { StatsSearch } from "../../router";
import { ALL_SEASONS_LABEL } from "../../lib/useSetSeason";
import { nextFixture, playerForSeason, nameFor, useClubData, formatDate } from "../../lib/clubData";
import { mvpOfFrom, votesClosedAt } from "../../lib/derived/mvpOf";
import { analysePlayer, chronological, rankedLeaders, type PlayerAnalysis } from "../../lib/clubAnalytics";
import { tickerLines } from "../../lib/statsView";
import { jornadaNumbers } from "../../lib/derived/jornada";
import { mvpWins } from "../../lib/vestuario";
import { useMvpResults } from "../vestuario/live";
import { useSeason } from "../../context/SeasonContext";
import { useClock } from "../../hooks/useClock";
import { ThemeToggle } from "../../components/ThemeToggle";
import { CelesteDock, CelesteFooter, CelesteHeader } from "../../components/celeste/Chrome";
import { RaceBoard, Ticker } from "./Race";
import { Comparar, Jugadores, Minutos, Resumen, Rivales } from "./Panes";
import { Explorar, type ExploreSection } from "./Explorar";
import { Posiciones } from "./Posiciones";
import { NewBadge } from "../../components/NewBadge";
import { PageSky } from "../../components/paginas/PageSky";
import { useNightGoal } from "../../components/paginas/nightGoal";
import { Ahora } from "./Ahora";
import { currentSeasonId } from "../../lib/vestuario";
import { useStandings } from "../../lib/useStandings";
import { seasonStrip } from "../../lib/derived/vidrio/strip";
import { seasonLeaders } from "../../lib/derived/vidrio/leaders";
import { formLetters, numerosLede } from "../../lib/derived/vidrio/numerosLive";
import { niceName } from "../../lib/derived/words";
import "../../styles/celeste/page.css";
import "../../styles/celeste/data.css";
import "../../styles/partidos.css";
import "../../styles/stats.css";
import "../../styles/vidrio/tokens.css";
import "../../styles/vidrio/glass.css";
import "../../styles/vidrio/components.css";
import "../../styles/vidrio/reading.css";
import "../../styles/vidrio-paginas.css";
import "../../styles/stats-vidrio.css";

const VIEWS = {
  summary: "Resumen",
  players: "Jugadores",
  game: "Análisis del juego",
  minutes: "Minutos",
  positions: "Posiciones",
  rivals: "Rivales",
  compare: "Comparar",
  explore: "Explorar",
} as const;
type View = keyof typeof VIEWS;
const nameOf = (p: PlayerAnalysis) => nameFor(p);

export function StatsPage() {
  const { matches, players, loading, error } = useClubData();
  const { seasons, selectedSeasonId, loadingSeasons } = useSeason();
  // (each view is a /numeros screen now, and Comparar is /plantilla/cara-a-cara: lib/interimScreens says which)
  const pathname = useLocation({ select: (l) => l.pathname });
  const search = useSearch({ strict: false }) as StatsSearch;
  const navigate = useNavigate();
  const now = useClock(15_000);
  const results = useMvpResults();
  const at = statsViewAt(pathname, search);
  const view: View = at.view;
  const section: ExploreSection = at.section ?? "individual";
  const own = (prev: Record<string, unknown>) => ({ ...prev });
  // (Comparar's pair goes with Comparar: any other view's URL is clean to share)
  const setView = (next: View) =>
    void navigate({
      to: statsViewPath(next),
      search: (prev: Record<string, unknown>) => {
        const rest = own(prev);
        delete rest.view;
        delete rest.section;
        delete rest.ranking;
        delete rest.ver;
        if (next !== "compare") {
          delete rest.a;
          delete rest.b;
        }
        return next === "minutes" ? { ...rest, ranking: "minutos", ver: "todo" } : rest;
      },
      resetScroll: false,
    });
  const setSection = (next: ExploreSection) => void navigate({ to: statsViewPath("explore", next), search: (prev: Record<string, unknown>) => own(prev), resetScroll: false });
  // Comparar's pair: replace, so trying player after player doesn't flood the history
  const setPair = (a: string, b: string | undefined) => void navigate({ to: ".", search: (prev) => ({ ...(own(prev) as typeof prev), a, b }), replace: true, resetScroll: false });
  const updateScope = (patch: StatsScopeSearch) => void navigate({ to: ".", search: (prev) => ({ ...(own(prev) as typeof prev), ...patch, ...(patch.seasons !== undefined ? { season: "all", matches: undefined } : {}), ...(patch.players?.length ? { team: "us" as const } : {}) }), resetScroll: false });
  const updateAnalysis = (patch: Partial<AnalysisSearch>) => void navigate({ to: ".", search: (prev) => ({ ...(own(prev) as typeof prev), ...patch }), replace: !!patch.q, resetScroll: false });
  const clearScope = () => void navigate({ to: ".", search: (prev) => ({ ...(own(prev) as typeof prev), season: "all", seasons: undefined, matches: undefined, players: undefined, team: undefined, period: undefined }), resetScroll: false });
  const pluralSeasons = search.seasons;
  const seasonIds = useMemo(() => scopeSeasons({ seasons: pluralSeasons }, selectedSeasonId), [pluralSeasons, selectedSeasonId]);
  const effectiveSeason = seasonIds.length === 1 ? seasonIds[0] : "all";
  const seasonGames = useMemo(() => chronological(matches.filter(m => inScope(m.seasonId, seasonIds))), [matches, seasonIds]);
  const games = useMemo(() => seasonGames.filter(m => inScope(m.id, search.matches)), [seasonGames, search.matches]);
  // (each match's jornada in its own season, «all seasons» included: the J of /partidos)
  const jornada = useMemo(() => jornadaNumbers(matches), [matches]);
  const periodPlayers = useMemo(() => players.filter(p => !seasonIds.length || p.seasons?.some(id => seasonIds.includes(id))), [players, seasonIds]);
  const rows = useMemo(
    () => periodPlayers.filter(p => inScope(p.id, search.players)).map(p => analysePlayer(playerForSeason(p, effectiveSeason, seasons), games)),
    [periodPlayers, games, effectiveSeason, seasons, search.players],
  );
  const mvps = useMemo(() => new Map(rows.map((p) => [p.id, mvpWins(p.id, games, results, now)]).filter(([, n]) => (n as number) > 0) as [string, number][]), [rows, games, results, now]);
  // the MVPs for the ratings by position: the one shared reader (derived/mvpOf), keyed on the results and
  // the last vote closed — not on the minute clock, so «Por posición» isn't re-rated every minute
  const votesAt = votesClosedAt(games, now);
  const mvpOf = useMemo(() => mvpOfFrom(results, games, votesAt), [results, games, votesAt]);
  const lines = useMemo(() => tickerLines(rows, games), [rows, games]);
  const leaders = [
    { label: "Pichichi", v: (p: PlayerAnalysis) => p.goals },
    { label: "Asistencias", v: (p: PlayerAnalysis) => p.assists },
    { label: "Más MVP", v: (p: PlayerAnalysis) => mvps.get(p.id) ?? 0 },
  ].map(l => ({ ...l, players: rankedLeaders([...rows].sort((a, b) => nameOf(a).localeCompare(nameOf(b), "es")), l.v, 1) })).filter(l => l.players.length > 0);
  const tracked = games.filter((m) => m.ledger && Object.keys(m.ledger).length).length;
  const periodName = !seasonIds.length ? ALL_SEASONS_LABEL : seasonIds.map(id => seasons.find(season => season.id === id)?.name ?? "Temporada no disponible").join(" + ");
  const ready = !loading && !error;
  // the season now (V-Integracion «Números»): the one being played, whatever period the tabs below read
  const nowSeason = currentSeasonId(nextFixture(matches, now), matches, seasons);
  const nowSeasonName = seasons.find((s) => s.id === nowSeason)?.name ?? "La temporada";
  const { standings } = useStandings(nowSeason || undefined);
  const strip = useMemo(() => seasonStrip(matches, nowSeason, now), [matches, nowSeason, now]);
  const liveSeg = strip.segments.find((s) => s.state === "directo") ?? null;
  const provSeg = liveSeg ?? strip.segments.find((s) => s.state === "pendiente" && s.provisional && s.score) ?? null;
  const liveScore = provSeg?.score ? { rival: provSeg.rival, gf: provSeg.score.gf, ga: provSeg.score.ga } : null;
  const squadNow = useMemo(
    () => players.filter((p) => p.seasons?.includes(nowSeason)).map((raw) => { const p = playerForSeason(raw, nowSeason, seasons); return { id: p.id, name: niceName(nameFor(p, nowSeason)), num: p.number != null ? String(p.number) : "" }; }),
    [players, nowSeason, seasons],
  );
  const leadersNow = useMemo(() => seasonLeaders(matches, nowSeason, squadNow, now), [matches, nowSeason, squadNow, now]);
  const form = formLetters(strip.segments);
  const playedNow = strip.segments.filter((s) => s.state === "jugado").length;
  const night = useNightGoal(liveSeg?.match, !!liveSeg);
  const empty = ready && !games.length;

  return (
    <div className={`vx vd-pg hm st${liveSeg ? " vd-pg--live" : ""}`} aria-busy={loading}>
      <PageSky now={now} live={!!liveSeg} moment={night.moment} />
      <CelesteHeader
        active="stats"
        sub="Estadísticas"
        actions={
          <>
            <ThemeToggle />
          </>
        }
      />
      <section className="st-hero vd-pg-head vd-reg-1" aria-labelledby="st-t">
        <h1 className="st-h1" id="st-t">
          Números
        </h1>
        <p className="vd-lede">{numerosLede(nowSeasonName, playedNow, !!liveScore)}</p>
      </section>
      {nowSeason && view !== "game" && <Ahora standings={standings} live={liveScore} leaders={leadersNow} form={form} />}

      <section className="st-period vd-reg-3" aria-label="El período de las pestañas">
        <h2 className="st-period__t">{periodName}</h2>
        <p className="st-period__l">{empty ? "La temporada aún no ha echado a rodar: en cuanto se publique la primera acta, aquí se mueve todo." : "Datos de partidos finalizados, al minuto."}</p>
        <div className="an-scopes" aria-label="Filtros del período">
          <ScopePicker label="Temporadas" options={[...seasons].reverse().map(season => ({ id: season.id, label: season.name }))} selected={seasonIds} disabled={loadingSeasons} onChange={seasons => updateScope({ seasons })}/>
          <ScopePicker label="Partidos" options={seasonGames.map(match => ({ id: match.id, label: `${formatDate(match.date)} · ${match.rival ?? "Rival"}` }))} selected={search.matches} onChange={matches => updateScope({ matches: matches.length ? matches : undefined })}/>
          <ScopePicker label="Jugadores" options={periodPlayers.map(player => ({ id: player.id, label: nameFor(player, effectiveSeason) }))} selected={search.players} onChange={players => updateScope({ players: players.length ? players : undefined })}/>
        </div>
        <div className="st-ctx">
          <p className="st-count">
            <b>{games.length}</b> {games.length === 1 ? "partido" : "partidos"} · <b>{rows.length}</b> {rows.length === 1 ? "jugador" : "jugadores"} · <b>{tracked}</b> {tracked === 1 ? "acta" : "actas"} con minutos
          </p>
          {(seasonIds.length > 0 || !!search.matches?.length || !!search.players?.length || search.team === "opponent" || search.period != null) && <button type="button" className="hm-ghostbtn" onClick={clearScope}>Quitar filtros</button>}
        </div>
        {!!search.players?.length && view !== "game" && <p className="st-period__l">Las tablas y los líderes muestran los jugadores seleccionados. Los resultados de equipo conservan todos los participantes del partido.</p>}
        {leaders.length > 0 && view !== "game" && (
          <ul className="st-leaders" aria-label="Líderes del período">
            {leaders.map((l, i) => (
              <li key={l.label} style={{ animationDelay: `${0.3 + i * 0.08}s` }}>
                <small>{l.label}</small>
                <b>{l.v(l.players[0].item)}</b>
                {l.players.length > 1 && <small>Liderato compartido</small>}
                {l.players.map(({ item }) => <Link key={item.id} to="/jugadores/$playerId" params={{ playerId: item.id }}>{nameOf(item)}</Link>)}
              </li>
            ))}
          </ul>
        )}
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
        {view === "summary" && (
          <div className="st-board pt-rise" style={{ animationDelay: ".12s" }}>
            <div className="st-sweep" aria-hidden="true" />
            {ready && games.length > 0 ? (
              <>
                <RaceBoard rows={rows} nameOf={nameOf} jornada={jornada} seasonId={effectiveSeason} />
                <Ticker lines={lines} />
              </>
            ) : (
              <div className="st-race st-race-pre">
                <NewBadge feature="statsCarreraPichichi" />
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
        )}
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
        {empty && view !== "game" && (
          <div className="st-state">
            <p>Todavía no hay partidos finalizados en este período. Los datos aparecerán al publicar las actas.</p>
            {(seasonIds.length > 0 || !!search.matches?.length) && (
              <button type="button" className="hm-ghostbtn" onClick={clearScope}>
                Ver todo el historial
              </button>
            )}
          </div>
        )}
        {ready && (games.length > 0 || view === "game") && (
          <div key={view} className="st-pane">
            {view === "game" && <AnalysisPanels matches={games} people={periodPlayers.map(p => ({ id: p.id, name: nameFor(p, effectiveSeason), number: p.number }))} seasonId={effectiveSeason} filters={{ seasonIds, matchIds: search.matches, playerIds: search.players }} search={search} onSearchChange={updateAnalysis}/>}
            {view === "summary" && <Resumen games={games} rows={rows} nameOf={nameOf} mvps={mvps} />}
            {view === "players" && <Jugadores rows={rows} nameOf={nameOf} />}
            {view === "minutes" && <Minutos rows={rows} games={games} nameOf={nameOf} jornada={jornada} />}
            {view === "positions" && <Posiciones games={games} rows={rows} nameOf={nameOf} mvpOf={mvpOf} />}
            {view === "rivals" && <Rivales games={games} rows={rows} />}
            {view === "compare" && <Comparar rows={rows} nameOf={nameOf} games={games.length} a={search.a} b={search.b} onPick={setPair} />}
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
