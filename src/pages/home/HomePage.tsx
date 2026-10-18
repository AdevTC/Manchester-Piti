// Inicio, «La luz del partido»: CDM Palomeras under the real light, with the match day told phase by phase
// (lib/derived/matchday) for each kind of visitor. The server renders it from the public data bundle (the CSS
// sky, the headline, the scoreboard, the season); the member layer («Tu partido», the «tú» on the pitch, the
// role-specific words) appears client side once the viewer is known (useHydrated + useViewer), as a lazy chunk.
import { lazy, Suspense, useState, useSyncExternalStore, type CSSProperties } from "react";
import { useSeason } from "../../context/SeasonContext";
import { useAuth } from "../../context/AuthContext";
import { useTeam } from "../../context/TeamContext";
import { dateMillis, nameFor, nextFixture, playerForSeason, playerName, useClubData, type ClubMatch } from "../../lib/clubData";
import { useClubContent } from "../../lib/clubContent";
import { useMatchClock } from "../../hooks/useMatchClock";
import { useDocumentTheme } from "../../hooks/useDocumentTheme";
import { useViewer } from "../../hooks/useViewer";
import { ThemeToggle } from "../../components/ThemeToggle";
import { CelesteBackdrop, CelesteDock, CelesteFooter, CelesteHeader } from "../../components/celeste/Chrome";
import { useMatchMoment } from "../../components/celeste/isla/useMatchMoment";
import { useReducedMotion } from "../../components/celeste/isla/media";
import { lightingOf, mix, SPONSORS, type PalomerasState } from "../../components/palomeras3d";
import { clubMedals, leaders, playerLines, seasonPulse, upcomingBirthdays, type SquadMember } from "../../lib/home";
import { currentSeasonId, mvpWinners } from "../../lib/vestuario";
import { useStandings } from "../../lib/useStandings";
import { useMatchWeather } from "../../lib/weather";
import { useSyncStatus } from "../../lib/syncStatus";
import { syncChip } from "../../lib/derived/syncChip";
import { matchdayOf, viewerRoleOf } from "../../lib/derived/matchday";
import { lightOf, sunPosition } from "../../lib/derived/sun";
import { frontRowOf } from "../../lib/derived/frontRow";
import { campoSeven } from "../../lib/derived/campoSeven";
import { mvpVoteOpen } from "../../lib/derived/memberWindows";
import { absenceOn, madridDate, matchDay } from "../../lib/derived/absences";
import { jornadaOf } from "../../lib/derived/jornada";
import { formatDate } from "../../lib/clubData";
import { lineupSeven, parseMatchLineup } from "../../lib/matchLineup";
import { useAbsences, useAvailability, useMatchRatings, useMatchReactions, useMatchScorers, useMvpResults, useMyMvpVote } from "../vestuario/live";
import { useMe } from "../vestuario/writes";
import { InicioHero, type HeroPlay } from "./InicioHero";
import { BoardsStrip, EnElClub, FanInvite, LoQueViene, PhaseBlock, playRow, Temporada, YoSkeleton } from "./InicioSections";
import { PrimeraFila } from "../../components/celeste/primeraFila/PrimeraFila";
import { PonteLaCamiseta } from "./PonteLaCamiseta";
import {
  boardFace,
  boardMessage,
  compactTable,
  figuresOf,
  floodlightsOf,
  heroCopy,
  isLive,
  niceName,
  matchViewAt,
  projectStandings,
  scrubbable,
  scrubToMs,
  snapsOf,
  trackFraction,
  type CopyCtx,
  type HeroCopy,
} from "./inicioModel";
import type { ScrubMark } from "./SunScrub";
import { madridTime } from "../../lib/derived/madrid";
import "../../styles/celeste/page.css";
import "../../styles/inicio.css";

const TuPartido = lazy(() => import("./TuPartido").then((m) => ({ default: m.TuPartido })));

const subscribeNothing = () => () => {};
/** False on the server and while the browser takes over, true after (member data never renders on the server). */
const useHydrated = (): boolean => useSyncExternalStore(subscribeNothing, () => true, () => false);

const WAITING: HeroCopy = { kick: "", h1: "Manchester Piti", sub: "", live: false };
const NO_DATA: HeroCopy = { kick: "Sin datos del partido", h1: "No llega el partido", sub: "Puede ser tu conexión o la nuestra. Mientras, esta es la luz de ahora en Palomeras.", live: false };
const MATCH_PHASES = new Set(["pitido", "directo1", "descanso", "directo2", "final"]);

export function HomePage() {
  const { matches, players, loading, error } = useClubData();
  const { seasons } = useSeason();
  const content = useClubContent();
  const now = useMatchClock(matches);
  const theme = useDocumentTheme();
  const viewer = useViewer();
  const hydrated = useHydrated();
  const member = hydrated && viewer.member;
  const { user } = useAuth();
  const { ready } = useTeam();
  const me = useMe();
  const sync = useSyncStatus();
  const reduced = useReducedMotion();
  const [scrub, setScrub] = useState<number | null>(null);

  const seasonId = currentSeasonId(nextFixture(matches, now), matches, seasons);
  const seasonName = seasons.find((s) => s.id === seasonId)?.name ?? "La temporada";
  const { standings } = useStandings(seasonId);

  const squad: SquadMember[] = players
    .filter((p) => p.seasons?.includes(seasonId))
    .map((raw) => {
      const p = playerForSeason(raw, seasonId, seasons);
      return { id: p.id, name: playerName(p), num: p.number != null ? String(p.number) : "", birthDate: p.birthDate };
    })
    .sort((a, b) => Number(a.num || 999) - Number(b.num || 999) || a.name.localeCompare(b.name, "es"));
  const pulse = seasonPulse(matches, seasonId, now);
  const lines = playerLines(squad, pulse.played);
  const nameOf = (id: string) => lines.find((l) => l.id === id)?.name ?? nameFor(players.find((p) => p.id === id), seasonId);
  /** The same name as a sentence reads it («Adrián T.C.», not the shirt's capitals). */
  const niceOf = (id: string) => niceName(nameOf(id));
  const numOf = (id: string) => lines.find((l) => l.id === id)?.num ?? "";

  // ── the day, the match and who is looking
  const day = matchdayOf(matches, seasonId, now);
  const m = day.match;
  const weather = useMatchWeather(m ?? undefined, now);
  const lineup = m ? parseMatchLineup((m as ClubMatch & { lineup?: unknown }).lineup) : null;
  const seven = lineup ? lineupSeven(lineup) : m ? campoSeven(m, null).field : [];
  const uid = member ? me?.uid : undefined;
  const scorers = useMatchScorers(member ? m?.id : undefined);
  const absences = useAbsences(madridDate(now), member);
  const kickoff = day.kickoff ?? NaN;
  const absence = member ? absenceOn(absences.data, { uid, playerId: viewer.playerId }, Number.isFinite(kickoff) ? matchDay(kickoff) : madridDate(now)) : null;
  const role = viewerRoleOf(m, { member, playerId: member ? viewer.playerId : null }, { scorer: !!uid && scorers.data.includes(uid), absentToday: !!absence, seven });

  // ── «Arrastra el sol»
  const canScrub = !!m && scrubbable(day, now);
  const view = matchViewAt(day, now, canScrub ? scrub : null);
  const marks: ScrubMark[] = [];
  if (m && canScrub) {
    const s = snapsOf(m);
    marks.push({ key: "pitido", label: `Pitido ${madridTime(dateMillis(m.date))}`, at: s.pitido }, { key: "descanso", label: "Descanso", at: s.descanso }, { key: "final", label: "Final", at: s.final });
  }
  const shownMarks = marks.filter((x) => trackFraction(x.at) > 0 && trackFraction(x.at) < 1);

  // ── the MVP, the moments
  const mvpResults = useMvpResults();
  const mvpId = m && day.phase === "despues" ? (mvpWinners(m, mvpResults.get(m.id), now)[0] ?? null) : null;
  const watched = m && MATCH_PHASES.has(day.phase) ? m : undefined;
  const moment = useMatchMoment(watched, now, { celebrate: sync.fresh && sync.online });
  const goalScorer = moment?.kind === "gol" ? (m?.events?.find((e) => e.id === moment.id)?.playerId ?? null) : null;
  const stale = !!syncChip(sync, Date.now(), isLive(day.phase)) && isLive(day.phase);

  // ── the words
  const estreno = !!m && (pulse.played.length === 0 || pulse.played[0]?.id === m.id);
  const mvpGoals = mvpId && m ? (m.ledger?.[mvpId]?.goals ?? 0) : 0;
  const ctx: CopyCtx = {
    day,
    view,
    now,
    member,
    role,
    nameOf: niceOf,
    sevenPublished: seven.length > 0,
    weather,
    seasonName,
    squadSize: squad.length,
    mvp: mvpId ? { id: mvpId, name: niceOf(mvpId), goals: mvpGoals } : null,
    estreno,
  };
  const copy = error ? NO_DATA : loading ? WAITING : heroCopy(ctx);
  const face = boardFace(day, view, now);
  const message = error ? { text: "Sin datos del partido: reintentando", kind: "navy" as const } : loading ? null : boardMessage(ctx);
  const sponsorNames = content.sponsors.length ? content.sponsors.map((s) => s.name) : [...SPONSORS];
  const state: PalomerasState = {
    at: view.at,
    weather: weather ? { sky: weather.sky, cloud: weather.cloud, rain: weather.rain } : null,
    floodlights: floodlightsOf(day, view),
    ...(message ? { board: message.text, boardKind: message.kind } : {}),
    sponsors: sponsorNames,
    figures: loading || error ? [] : figuresOf({ day, view, seven, nameOf, numOf, me: member ? viewer.playerId : null, goalBy: goalScorer, mvpId }),
    away: !!m && m.home === false && day.phase !== "semana" && day.phase !== "pretemporada",
  };
  const heroPlays: HeroPlay[] =
    m && (isLive(view.phase) || view.phase === "final") ? view.events.slice(-3).reverse().map((e) => playRow(m, e, niceOf)) : [];
  const playsTitle = view.phase === "final" ? "Así acabó" : view.phase === "descanso" ? `Al descanso, ${view.gf}–${view.ga}` : `Hasta el ${view.minute ?? 0}′, ${view.gf}–${view.ga}`;
  const what =
    view.phase === "antes"
      ? `faltan ${Math.max(0, Math.round((kickoff - view.at) / 60_000))} min`
      : view.phase === "pitido"
        ? "pendiente del pitido"
        : view.phase === "descanso"
          ? `descanso, ${view.gf}–${view.ga}`
          : isLive(view.phase)
            ? `minuto ${view.minute ?? 0}, ${view.gf}–${view.ga}`
            : `final, ${view.gf}–${view.ga}`;

  // ── below the hero
  // «La primera fila»: the fans' row on the server and until the viewer is known; a member's answers after
  const avail = useAvailability(member ? m?.id : undefined);
  const myAnswer = (uid && avail.data.find((a) => a.uid === uid)?.response) || null;
  const myVote = useMyMvpVote(member && day.phase === "acta" ? m?.id : undefined, uid).data;
  const matchDayStr = Number.isFinite(kickoff) ? matchDay(kickoff) : madridDate(now);
  const absentIds = member ? squad.filter((s) => absenceOn(absences.data, { playerId: s.id }, matchDayStr)).map((s) => s.id) : [];
  const row = frontRowOf({
    match: m,
    phase: day.phase,
    squad: squad.map((s) => ({ id: s.id, name: s.name, dorsal: s.num, position: null })),
    seven,
    answers: member ? avail.data.map((a) => ({ playerId: a.playerId, response: a.response })) : null,
    absentIds,
    viewerPlayerId: member ? viewer.playerId : null,
    scorerIds: role === "anotador" && viewer.playerId ? [viewer.playerId] : [],
    mvpVoteOpen: !!m && mvpVoteOpen(m, now),
    now,
    history: matches,
    mvpResults,
  });
  const after = day.phase === "acta" || day.phase === "despues";
  const reactions = useMatchReactions(m && after ? m.id : undefined);
  const ratings = useMatchRatings(m && day.phase === "despues" ? m.id : undefined);
  const liveScore = isLive(view.phase) && m ? { rival: m.rival ?? "", gf: view.gf, ga: view.ga } : null;
  const table = standings ? compactTable(projectStandings(standings.rows, liveScore), 4) : [];
  const usRow = table.find((r) => r.us);
  const tableTitle = liveScore ? "Si acaba así" : standings?.jornada ? `Tras la jornada ${standings.jornada}` : "Clasificación";
  const tableNote = usRow ? `Piti ${usRow.pos}º con ${usRow.pts} pts` : (standings?.competition ?? "");
  const seasonNote = liveScore ? "Si acaba así: la tabla con el marcador de ahora; goles y asistencias suben con el acta." : pulse.played.length ? "Se mueve sola con cada acta publicada." : "Arranca con la primera jornada.";
  const upcoming = pulse.upcoming.filter((x) => x.id !== m?.id || day.phase === "semana").filter((x) => !isLive(day.phase) || x.id !== m?.id).slice(0, 3);
  const jornada = (id: string) => jornadaOf(matches, id);

  const { sky } = lightingOf(view.at, state.weather);
  const rootVars = { "--s-rim": mix("#33416a", sky.sun, Math.max(sky.golden, sky.sunI * 0.5)), "--s-spill": mix(sky.hor, "#6CABDD", sky.night * 0.6) } as CSSProperties;

  const yo = member ? (
    <Suspense fallback={<YoSkeleton />}>
      <TuPartido day={day} view={view} role={role} now={now} matches={matches} players={players} playerId={viewer.playerId} captain={viewer.admin} seven={seven} absentUntil={absence?.to ?? null} />
    </Suspense>
  ) : hydrated && user && !ready ? (
    <YoSkeleton />
  ) : (
    <FanInvite />
  );

  return (
    <div className={`vx ei${loading ? " wait" : ""}`} aria-busy={loading} style={rootVars}>
      <CelesteBackdrop />
      <CelesteHeader active="inicio" sub="Inicio" actions={<ThemeToggle />} />
      <InicioHero
        copy={copy}
        face={face}
        countdownTo={!view.scrubbed && view.phase === "antes" && !loading ? (day.kickoff ?? null) : null}
        state={state}
        plate={sponsorNames[0]}
        plays={heroPlays}
        playsTitle={playsTitle}
        scrub={
          canScrub && m && !loading && !error
            ? {
                at: view.at,
                scrubbing: scrub !== null,
                marks: shownMarks,
                what,
                toMs: (minutes) => scrubToMs(dateMillis(m.date), minutes),
                onScrub: (ms) => setScrub(ms),
                onNow: () => setScrub(null),
              }
            : null
        }
        moment={scrub === null ? moment : null}
        goalScorer={goalScorer}
        mvpId={mvpId}
        reduced={reduced}
        stale={stale}
      />
      <BoardsStrip sponsors={sponsorNames} message={message} />
      {copy.sub && <p className="ei-subm">{copy.sub}</p>}
      {!error && (
        <PrimeraFila
          row={row}
          day={day}
          viewer={role}
          light={lightOf(sunPosition(view.at).elevation)}
          me={member ? me : null}
          myAnswer={myAnswer}
          myVote={myVote}
          now={now}
          status={!hydrated || loading ? "loading" : !sync.online ? "offline" : avail.error ? "error" : "ok"}
          staleSince={stale ? sync.staleAt : null}
          reduced={reduced}
        />
      )}
      <main className="ei-main" id="contenido">
        {yo}
        {!error && (
          <PhaseBlock
            day={day}
            view={view}
            now={now}
            member={member}
            weather={weather}
            nameOf={niceOf}
            squadSize={squad.length}
            reactions={reactions.data}
            ratings={ratings.data}
            mvp={mvpId ? { name: niceOf(mvpId) } : null}
          />
        )}
        <Temporada form={pulse.form} table={table} tableTitle={tableTitle} tableNote={tableNote} scorers={leaders(lines, "goals", 3)} assisters={leaders(lines, "assists", 3)} note={seasonNote} />
        <LoQueViene upcoming={upcoming} now={now} jornadaOf={jornada} />
        <EnElClub birthdays={upcomingBirthdays(squad, now, 2)} medals={clubMedals(pulse, lines, nameOf, (d) => formatDate(d))} sponsors={content.sponsors} squadSize={squad.length} />
      </main>
      <PonteLaCamiseta theme={theme} />
      <CelesteFooter />
      <CelesteDock active="inicio" />
    </div>
  );
}
