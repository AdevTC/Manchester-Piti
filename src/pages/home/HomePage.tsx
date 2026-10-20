// Inicio, «Vidrio»: four places on the light field of Palomeras — Hoy (the lens with the match, el siete on a
// glass pitch, the plays, the headline), Temporada (the table in focus, the form, the scorers, every jornada
// with its light), Club (what happens off the pitch, «Ponte la del Piti», the calendar) and Tú (only for a
// jugador: what waits on him). A glass shelf moves between them (#temporada in the URL); 1440 shows one stage
// per place, 1920 a cockpit with the three zones always in sight, phone and tablet the lens on top and the
// chosen place below. The server paints Hoy from the public data bundle; whatever is a member's appears once
// the viewer is known (useHydrated + useViewer). The live overlay is the live system's: the lens only declares
// itself (useLiveDock), «Sacar el marcador» opens the kit's score window.
import { lazy, Suspense, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useSeason } from "../../context/SeasonContext";
import { nameFor, nextFixture, playerForSeason, useClubData, type ClubMatch } from "../../lib/clubData";
import { useClubContent } from "../../lib/clubContent";
import { useMatchClock } from "../../hooks/useMatchClock";
import { useDocumentTheme } from "../../hooks/useDocumentTheme";
import { useViewer } from "../../hooks/useViewer";
import { ThemeToggle } from "../../components/ThemeToggle";
import { CelesteDock, CelesteFooter, CelesteHeader } from "../../components/celeste/Chrome";
import { AddToCalendar } from "../../components/celeste/AddToCalendar";
import { PipWindow, Shelf, VidrioSky, openScorePip, region, shelfPanelId, shelfTabId, skyAt, swap, travel, useGoalMoment, useGrow, useLightPointer, useLiveDock, useMedia, useReducedMotion, type ScorePip } from "../../components/vidrio";
import { clubMedals, matchEvent, playerLines, seasonPulse, upcomingBirthdays, type SquadMember } from "../../lib/home";
import { currentSeasonId } from "../../lib/vestuario";
import { useStandings } from "../../lib/useStandings";
import { useMatchWeather, useMatchWeatherHourly } from "../../lib/weather";
import { matchdayOf, viewerRoleOf } from "../../lib/derived/matchday";
import { campoSeven } from "../../lib/derived/campoSeven";
import { mvpVoteOpen } from "../../lib/derived/memberWindows";
import { absenceOn, madridDate, matchDay } from "../../lib/derived/absences";
import { jornadaOf as jornadaOfMatch } from "../../lib/derived/jornada";
import { formatDate } from "../../lib/clubData";
import { lineupSeven, parseMatchLineup } from "../../lib/matchLineup";
import { eventMetaOf, rivalCode, settled } from "../../lib/eventMeta";
import { mapsUrl } from "../../lib/derived/venue";
import { pushState, savedTopics, toggleTopic } from "../../lib/push";
import { capital, endSentence } from "../../lib/derived/words";
import { viewerKind } from "../../lib/derived/vidrio/viewer";
import { placeHints } from "../../lib/derived/vidrio/hints";
import { seasonStrip } from "../../lib/derived/vidrio/strip";
import { projectTable } from "../../lib/derived/vidrio/table";
import { seasonLeaders } from "../../lib/derived/vidrio/leaders";
import { playsLog, type PlaysLog } from "../../lib/derived/vidrio/plays";
import { usePolls, usePollVotes, useAbsences, useMatchScorers, useMvpResults } from "../vestuario/live";
import { pollTally } from "../../lib/derived/polls";
import { albumLine, albumOf } from "../../lib/derived/album";
import { mesaLine, mesaOf } from "../../lib/derived/mesa";
import { LINE_NAMES, POSITIONS, resolvePositions } from "../../lib/positions";
import { mvpWinners } from "../../lib/vestuario";
import { eventSeconds } from "../../../functions/src/matchAnalysis";
import { madridTime } from "../../lib/derived/madrid";
import { useMe, voteMvp, votePoll } from "../vestuario/writes";
import { andList, isLive, matchViewAt, niceName, weekday } from "./inicioModel";
import {
  PLACE_LABEL,
  benchLineOf,
  formaOf,
  hasScore,
  hoyCopy,
  isAhead,
  isOver,
  lensFace,
  meLineOf,
  ornamentsOf,
  placeFromHash,
  placesFor,
  porraSub,
  hourlyWords,
  postponedOf,
  ribbonItemsOf,
  shortHint,
  sieteOf,
  sunRibbonOf,
  tuTitleOf,
  weatherLineOf,
  winnerDeeds,
  type HoyCopy,
  type PlaceId,
} from "./hoyModel";
import { HoyLens } from "./vidrio/HoyLens";
import { HoyHead } from "./vidrio/HoyHead";
import { SieteOrn } from "./vidrio/Siete";
import { PlaysGrow, PlaysOrn } from "./vidrio/Plays";
import { ConvoOrn, FechaOrn, MvpOrn, MvpWinnerOrn, PreviaOrn, VieneOrn } from "./vidrio/Ornaments";
import { Temporada, TemporadaGrows, type TableRowV, type TemporadaData } from "./vidrio/Temporada";
import { Club, type ClubData } from "./vidrio/Club";
import { Tu } from "./vidrio/Tu";
import { useTu } from "./vidrio/useTu";
import { Ico } from "./vidrio/icons";
import "../../styles/vidrio/reading.css";
import "../../styles/inicio.css";

const subscribeNothing = () => () => {};
/** False on the server and while the browser takes over, true after (member data never renders on the server). */
const useHydrated = (): boolean => useSyncExternalStore(subscribeNothing, () => true, () => false);

const subscribeHash = (on: () => void) => {
  window.addEventListener("hashchange", on);
  return () => window.removeEventListener("hashchange", on);
};
/** The place's hash: the URL's when it names a place, else the last one that did (a hash that is no place,
 *  like the skip link's «#contenido», keeps the place you were in). Empty on the server: it never reaches it,
 *  so the server always paints Hoy. */
let placeHash = "";
const readPlaceHash = () => {
  const h = window.location.hash;
  if (!h || /^#(hoy|temporada|club|t[uú]|t%C3%BA)$/i.test(h)) placeHash = h;
  return placeHash;
};
const useHash = (): string => useSyncExternalStore(subscribeHash, readPlaceHash, () => "");

/** While a grown window is open the floating score keeps away (it would sit on the window's header): the
 *  page says «the match is shown here» for as long as it is open. */
function FloatAway() {
  const ref = useRef<HTMLSpanElement | null>(null);
  useLiveDock(ref, "lens");
  return <span ref={ref} className="vi-floataway" aria-hidden="true" />;
}

/** «Compartir el cartel»: the Partidos cartel in its sheet, loaded when asked for. */
const CartelShare = lazy(() => import("./vidrio/CartelShare"));
/** «14 de enero». */
const DAY_MONTH = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", day: "numeric", month: "long" });

const WAITING: HoyCopy ={ h1: "Manchester Piti", lede: "" };
const NO_DATA: HoyCopy = { h1: "No llega el partido", lede: "Puede ser tu conexión o la nuestra. Mientras, esta es la luz de ahora en Palomeras." };
const NOTHING: never[] = [];
const EMPTY_LOG: PlaysLog = { rows: [], count: 0, counts: { gol: 0, tarjeta: 0, cambio: 0, ocasion: 0, parada: 0, otro: 0 }, halves: [] };

export function HomePage() {
  const { matches, players, loading, error } = useClubData();
  const { seasons } = useSeason();
  const content = useClubContent();
  const now = useMatchClock(matches);
  const theme = useDocumentTheme();
  const viewer = useViewer();
  const hydrated = useHydrated();
  const member = hydrated && viewer.member;
  const me = useMe();
  const reduced = useReducedMotion();
  const cockpit = useMedia("(min-width: 1760px)");
  const stageRef = useRef<HTMLDivElement | null>(null);
  useLightPointer(stageRef);

  // ── the season, the squad, the names
  const seasonId = currentSeasonId(nextFixture(matches, now), matches, seasons);
  const season = seasons.find((s) => s.id === seasonId);
  const seasonName = season?.name ?? "La temporada";
  const { standings } = useStandings(seasonId);
  const squad: SquadMember[] = useMemo(
    () =>
      players
        .filter((p) => p.seasons?.includes(seasonId))
        .map((raw) => {
          const p = playerForSeason(raw, seasonId, seasons);
          return { id: p.id, name: nameFor(p, seasonId), num: p.number != null ? String(p.number) : "", birthDate: p.birthDate };
        })
        .sort((a, b) => Number(a.num || 999) - Number(b.num || 999) || a.name.localeCompare(b.name, "es")),
    [players, seasonId, seasons],
  );
  const pulse = seasonPulse(matches, seasonId, now);
  const lines = playerLines(squad, pulse.played);
  const nameOf = (id: string) => lines.find((l) => l.id === id)?.name ?? nameFor(players.find((p) => p.id === id), seasonId);
  /** The same name as a sentence reads it («Adrián T.C.», not the shirt's capitals). */
  const niceOf = (id: string) => niceName(nameOf(id));
  const numOf = (id: string) => lines.find((l) => l.id === id)?.num ?? "";
  const jornadaOf = (id: string) => jornadaOfMatch(matches, id);

  // ── the day, the match and who is looking
  const day = matchdayOf(matches, seasonId, now);
  const m = day.match;
  const phase = day.phase;
  const weather = useMatchWeather(m ?? undefined, now);
  // the forecast by the hour (kick-off −1 h … +2 h, within the week): the sun ribbon, la previa and the line
  const hourly = useMatchWeatherHourly(m && isAhead(phase) ? m : undefined, now);
  const lineup = m ? parseMatchLineup((m as ClubMatch & { lineup?: unknown }).lineup) : null;
  const seven = lineup ? lineupSeven(lineup) : m ? campoSeven(m, null).field : [];
  const uid = member ? me?.uid : undefined;
  const scorers = useMatchScorers(member ? m?.id : undefined);
  const absences = useAbsences(madridDate(now), member);
  const kickoff = day.kickoff ?? NaN;
  const absence = member ? absenceOn(absences.data, { uid, playerId: viewer.playerId }, Number.isFinite(kickoff) ? matchDay(kickoff) : madridDate(now)) : null;
  const role = viewerRoleOf(m, { member, playerId: member ? viewer.playerId : null }, { scorer: !!uid && scorers.data.includes(uid), absentToday: !!absence, seven });
  const mine = member && viewer.playerId ? squad.find((s) => s.id === viewer.playerId) : undefined;
  const playerDoc = mine ? players.find((p) => p.id === mine.id) : undefined;
  const kind = viewerKind(member ? viewer : null, playerDoc ? { id: playerDoc.id, archived: (playerDoc as { archived?: boolean }).archived } : null);
  const fan = kind === "aficion";

  // ── the place (#temporada in the URL; the server always paints Hoy)
  const places = placesFor(kind);
  const hash = useHash();
  const place: PlaceId = placeFromHash(hash, places);
  const focus: PlaceId = place;
  const plays = useGrow("vi-grow-plays");
  const tabla = useGrow("vi-grow-tabla");
  const goles = useGrow("vi-grow-goles");
  const go = (to: PlaceId) => {
    // (a grown window goes back to its place first: a new place never opens with one grown)
    if (plays.open) plays.close();
    if (tabla.open) tabla.close();
    if (goles.open) goles.close();
    if (to === place) return;
    const from = places.indexOf(place);
    swap(travel(from, places.indexOf(to)), () => {
      const url = to === "hoy" ? window.location.pathname + window.location.search : `#${to}`;
      window.history.replaceState(window.history.state, "", url);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
  };

  // ── Hoy: the lens, the words, the ornaments
  const view = matchViewAt(day, now, null);
  const face = lensFace(day, now);
  const live = isLive(phase);
  const items = m && hasScore(phase) ? ribbonItemsOf(m, niceOf, live ? (view.seconds ?? 0) + 1 : Infinity) : NOTHING;
  const sun = isAhead(phase) && Number.isFinite(kickoff) ? sunRibbonOf(kickoff, now, m?.duration ?? 50) : null;
  const hourlyText = hourly && Number.isFinite(kickoff) ? hourlyWords(hourly.hours, kickoff, m?.duration ?? 50) : null;
  const sunHours = sun && hourly ? hourly.hours.map((h) => ({ left: ((h.at + 1_800_000 - (kickoff - 7_200_000)) / 14_400_000) * 100, temp: Math.round(h.temp), rain: h.rain !== null && h.rain >= 40 ? h.rain : null })).filter((h) => h.left > 3 && h.left < 97) : null;
  const lastGoal = live ? [...view.events].reverse().find((e) => eventMetaOf(e).goal) : undefined;
  // (the goal moment plays only for a goal that arrives while the page is open: the one already there when the
  // matches load — or when a refresh lands mid-match — keeps just its gold rim)
  const goalKey = lastGoal?.id ?? null;
  const [arrivalGoal, setArrivalGoal] = useState<string | null | undefined>(undefined);
  if (arrivalGoal === undefined && !loading) setArrivalGoal(goalKey);
  // «Repetir el gol» (the lens's score): the same moment again, for the same goal
  const [replay, setReplay] = useState<{ id: string; n: number } | null>(null);
  const replays = replay && replay.id === goalKey ? replay.n : 0;
  const freshGoal = arrivalGoal !== undefined && goalKey !== null && (goalKey !== arrivalGoal || replays > 0);
  const goalSide = lastGoal && eventMetaOf(lastGoal).goal === "for" ? "us" : "them";
  const goal = useGoalMoment(lastGoal ? { key: replays ? `${lastGoal.id}#${replays}` : lastGoal.id, side: goalSide } : null, { reduced: reduced || !freshGoal, ready: !loading });
  // the lens's status line during the moment: «¡Gol de Adrián T.C.!», then «Adrián T.C., minuto 21» for a while
  // (when this page saw it arrive, on the match's clock: the name stays a few seconds after the moment)
  const freshKey = freshGoal ? `${goalKey}#${replays}` : null;
  const [freshSeen, setFreshSeen] = useState<{ key: string; at: number } | null>(null);
  if (freshKey && freshSeen?.key !== freshKey) setFreshSeen({ key: freshKey, at: now });
  const afterGoal = !!freshKey && freshSeen?.key === freshKey && now - freshSeen.at < 16_000;
  const estreno = !!m && (pulse.played.length === 0 || pulse.played[0]?.id === m.id);
  // the MVP: the vote while it is open (turnout only, never who leads), its winner once it has closed
  const voteOpen = !!m && mvpVoteOpen(m, now);
  const mvpResults = useMvpResults();
  const mvpResult = m ? mvpResults.get(m.id) : undefined;
  const winnerIds = m && !voteOpen && isOver(phase) ? mvpWinners(m, mvpResult, now) : [];
  const winnerVotes = winnerIds.length && mvpResult?.counts ? (mvpResult.counts[winnerIds[0]] ?? null) : null;
  const winner = winnerIds.length ? { names: winnerIds.map((id) => niceOf(id)), votes: winnerVotes } : null;
  const eligible = mvpResult?.eligible ?? null;
  const copy: HoyCopy = error
    ? NO_DATA
    : loading
      ? WAITING
      : hoyCopy({ day, view, now, member, role, nameOf: niceOf, sevenPublished: seven.length > 0, weather, seasonName, squadSize: squad.length, mvp: null, estreno, winner });
  const orns = ornamentsOf(phase, kind, seven.length > 0, voteOpen, winner !== null);
  const spots = m && orns.left === "siete" ? sieteOf({ match: m, phase, events: view.events, seven, nameOf, numOf, captainId: (m as ClubMatch & { captainId?: string }).captainId ?? season?.captainPlayerId ?? null, me: member ? viewer.playerId : null }) : [];
  const sieteTitle = isOver(phase) ? "Acabaron en el campo" : live ? "En el campo" : phase === "antes" || phase === "pitido" ? (m && Number.isFinite(kickoff) && new Date(kickoff).getUTCHours() >= 16 ? "El siete de esta noche" : "El siete de hoy") : "El siete";
  const log = m ? playsLog(m, niceOf) : EMPTY_LOG;
  // (while live: how long ago the last play was, on the match's own clock; «Minuto N» when the clock can't say)
  const lastPlay = live ? settled(view.events).filter((e) => typeof e.elapsedSeconds === "number" || typeof e.minute === "number").sort((a, b) => eventSeconds(b) - eventSeconds(a))[0] : undefined;
  const agoMin = lastPlay && phase !== "descanso" && view.seconds !== null && view.seconds !== undefined ? Math.floor((view.seconds - eventSeconds(lastPlay)) / 60) : null;
  const playsSub = live
    ? agoMin !== null && agoMin >= 0 && agoMin < 60
      ? agoMin < 1
        ? "Hace nada"
        : `Hace ${agoMin} min`
      : log.rows[0]
        ? `Minuto ${log.rows[0].minuteText.replace("′", "")}`
        : "En directo"
    : `${log.count === 1 ? "1 jugada" : `${log.count} jugadas`}`;
  const goalWho = !lastGoal ? "" : goalSide === "them" ? (m?.rival?.trim() ?? "el rival") : lastGoal.type === "opponent_own_goal" ? `En propia de ${m?.rival?.trim() ?? "el rival"}` : lastGoal.playerId ? niceOf(lastGoal.playerId) : "El Piti";
  const goalStatus = !lastGoal
    ? null
    : goal.active && goalSide === "us"
      ? `¡Gol de ${goalWho}!`
      : goal.active
        ? `Gol de ${goalWho}`
        : afterGoal
          ? `${goalWho}, minuto ${Math.max(1, Math.ceil(eventSeconds(lastGoal) / 60))}`
          : null;
  const playsAllSub = live ? `${log.count} jugadas hasta el minuto ${day.minute ?? 1}. Se añaden solas.` : `${log.count} jugadas. ${phase === "final" ? "El acta llega en unos minutos." : "El acta ya está publicada."}`;
  const upcoming = pulse.upcoming.filter((x) => x.id !== m?.id).slice(0, 3);

  // ── Tú, the porra and the convocatoria's answers (members only, client side)
  const tu = useTu({ enabled: kind === "jugador", member, me, admin: viewer.admin, playerId: member ? viewer.playerId : null, day, matches, players, seasonId, seasons, now });
  const myGoals: { gf: number; ga: number }[] = [];
  const myAssists: { gf: number; ga: number }[] = [];
  if (m && viewer.playerId && kind === "jugador") {
    let gf = 0;
    let ga = 0;
    for (const e of settled(view.events)) {
      const g = eventMetaOf(e).goal;
      if (g === "for") gf++;
      else if (g === "against") ga++;
      if (g === "for" && e.playerId === viewer.playerId && e.type !== "opponent_own_goal") myGoals.push({ gf, ga });
      if (g === "for" && e.assistPlayerId === viewer.playerId) myAssists.push({ gf, ga });
    }
  }
  const myName = mine ? niceName(mine.name) : (me?.name ? capital(me.name) : "");
  const meLine = member
    ? meLineOf({
        phase,
        kind,
        name: myName || "Tú",
        role,
        code: lineup && viewer.playerId ? (lineup.slots.find((s) => s.playerId === viewer.playerId)?.code ?? null) : null,
        porra: tu.porra,
        gf: view.gf,
        ga: view.ga,
        goals: myGoals,
        assists: myAssists,
        minutes: m && viewer.playerId ? (m.ledger?.[viewer.playerId]?.played ? (m.ledger[viewer.playerId].minutes ?? null) : null) : null,
        voteClosesAt: voteOpen && typeof m?.voteClosesAt === "number" && !tu.mvpVote ? m.voteClosesAt : null,
      })
    : null;
  const wx = weatherLineOf(day, weather, hourlyText);
  const answers = tu.answers;
  const called = m ? [...(m.starters ?? []), ...(m.bench ?? [])] : [];
  const counts = {
    yes: answers.filter((a) => a.response === "yes").length,
    maybe: answers.filter((a) => a.response === "maybe").length,
    no: answers.filter((a) => a.response === "no").length,
    none: Math.max(0, (called.length || squad.length) - answers.length),
  };
  const comers = answers.filter((a) => a.response === "yes").map((a) => (a.playerId ? niceOf(a.playerId) : a.name));
  const porraLine = porraSub(tu.porra, view.gf, view.ga, phase);
  // (while live, «Debut» fills with the minutes he is playing tonight)
  const inSevenNow = !!viewer.playerId && seven.includes(viewer.playerId);
  const tuLogro = live && inSevenNow && tu.logro?.label.includes("«Debut»") && m ? { label: tu.logro.label, text: "Se desbloquea al pitido final si juegas.", pct: Math.min(99, Math.round((((view.seconds ?? 0) / 60) / (m.duration ?? 50)) * 100)) } : tu.logro;
  // his album: a cromo per teammate he has played with this season (derived/album)
  const album = kind === "jugador" && viewer.playerId ? albumOf(viewer.playerId, matches, squad.map((s) => s.id), seasonId) : null;
  const albumView = album ? { owned: album.owned.length, total: album.total, line: albumLine(album, m && (isAhead(phase) || live) ? seven : []), latest: album.owned.slice(0, 3).map((c) => ({ id: c.id, num: numOf(c.id), name: niceOf(c.id) })), unknown: Math.min(2, album.total - album.owned.length) } : null;
  const tuView = { ...tu, logro: tuLogro, album: albumView };

  // ── «Sacar el marcador» and «Avisarme…» (client only)
  const [pip, setPip] = useState<ScorePip | null>(null);
  const takeOut = async () => {
    if (pip) {
      pip.close();
      setPip(null);
      return;
    }
    setPip(await openScorePip({ title: `Manchester Piti contra ${m?.rival ?? "el rival"}` }));
  };
  const pushTopic = isAhead(phase) ? "start" : "goals";
  // (the device's push state and topics are the browser's: read once the page is the browser's)
  const [topicsSet, setTopicsLocal] = useState<string[] | null>(null);
  const topics = topicsSet ?? (hydrated ? savedTopics() : []);
  const push = hydrated ? pushState() : "unsupported";
  const alerts = push === "ready" && topics.includes(pushTopic);
  const [alertErr, setAlertErr] = useState("");
  // (where this device can't take notices the button stays and says why: the same words as the bell's sheet)
  const [pushHelp, setPushHelp] = useState(false);
  const toggleAlerts = () => {
    setAlertErr("");
    if (push !== "ready") {
      setPushHelp((v) => !v);
      return;
    }
    toggleTopic(pushTopic, !alerts).then(
      (t) => setTopicsLocal(t),
      () => setAlertErr("No se han podido activar los avisos en este navegador."),
    );
  };
  const pushWhy =
    push === "ios-install"
      ? "En iPhone y iPad, añade primero la web a tu pantalla de inicio (Compartir › Añadir a pantalla de inicio) y ábrela desde ahí."
      : push === "denied"
        ? "Los avisos están bloqueados en este navegador. Puedes permitirlos en los ajustes del sitio."
        : "Este navegador no admite avisos.";
  const [cartelOpen, setCartelOpen] = useState(false);

  const actions: ReactNode[] = [];
  if (m) {
    // the anotador opens la mesa from here, before anything else
    if (role === "anotador" && (isAhead(phase) || live))
      actions.push(
        <Link key="mesa" className="vd-glass vd-btn vd-btn--pri vd-press" to="/matches/$matchId/mesa" params={{ matchId: m.id }}>
          <Ico id="whistle" />
          Abrir la mesa
        </Link>,
      );
    const pri = role === "anotador" && (isAhead(phase) || live) ? "" : " vd-btn--pri";
    if (isAhead(phase)) {
      actions.push(
        <a key="map" className={`vd-glass vd-btn${pri} vd-press`} href={mapsUrl(m.venue?.trim() || (m.home === false ? `${m.rival ?? ""}` : "CDM Palomeras"))} target="_blank" rel="noreferrer">
          <Ico id="pin" />
          Cómo llegar
          <span className="vd-vh"> (abre el mapa en otra pestaña)</span>
        </a>,
        <AddToCalendar key="cal" className="vd-glass vd-btn vd-press" iconName="cal" label="Al calendario" event={matchEvent(m, typeof location === "undefined" ? "" : location.origin)} />,
      );
    } else if (live || phase === "final" || phase === "pendiente") {
      actions.push(
        <Link key="open" className={`vd-glass vd-btn${pri} vd-press`} to="/matches/$matchId" params={{ matchId: m.id }} viewTransition={!reduced}>
          Abrir el partido
        </Link>,
      );
      if (live && hydrated)
        actions.push(
          <button key="pip" type="button" className="vd-glass vd-btn vd-press vi-pipbtn" aria-pressed={!!pip} onClick={() => void takeOut()}>
            <Ico id="pip" />
            {pip ? "Marcador fuera" : "Sacar el marcador"}
          </button>,
        );
    } else if (phase === "acta" || phase === "despues") {
      actions.push(
        <Link key="acta" className="vd-glass vd-btn vd-btn--pri vd-press" to="/matches/$matchId" params={{ matchId: m.id }}>
          Leer el acta
        </Link>,
        <button key="cartel" type="button" className="vd-glass vd-btn vd-press" aria-haspopup="dialog" aria-expanded={cartelOpen} onClick={() => setCartelOpen(true)}>
          <Ico id="share" />
          Compartir el cartel
        </button>,
      );
    } else if (phase === "aplazado") {
      actions.push(
        <Link key="cal" className="vd-glass vd-btn vd-btn--pri vd-press" to="/partidos">
          Ver el calendario
        </Link>,
      );
    }
    if ((isAhead(phase) || live) && hydrated)
      actions.push(
        <button key="alerts" type="button" className="vd-glass vd-btn vd-press vi-togg" aria-pressed={push === "ready" ? alerts : undefined} aria-expanded={push === "ready" ? undefined : pushHelp} onClick={toggleAlerts}>
          <Ico id={alerts ? "check" : "bell"} />
          {isAhead(phase) ? (alerts ? "Te avisamos del pitido" : "Avisarme del pitido") : alerts ? "Te avisamos de los goles" : "Avisarme de los goles"}
        </button>,
      );
    if (pushHelp && push !== "ready")
      actions.push(
        <p key="why" className="vi-pushwhy" role="status">
          {pushWhy}
        </p>,
      );
  } else {
    actions.push(
      <Link key="plantilla" className="vd-glass vd-btn vd-btn--pri vd-press" to="/plantilla">
        Conoce la plantilla
      </Link>,
      <Link key="partidos" className="vd-glass vd-btn vd-press" to="/partidos">
        Partidos
      </Link>,
    );
  }

  // ── Temporada
  const strip = useMemo(() => seasonStrip(matches, seasonId, now), [matches, seasonId, now]);
  const leaders = useMemo(() => seasonLeaders(matches, seasonId, squad, now), [matches, seasonId, squad, now]);
  const rowsNow = standings?.rows ?? [];
  const liveScore = live && m ? { rival: m.rival ?? "", gf: view.gf, ga: view.ga } : null;
  const proj = liveScore && rowsNow.length ? projectTable(rowsNow, liveScore) : null;
  const toV = (r: { team: string; pj: number; g: number; e: number; p: number; gf: number; gc: number; pts: number; isUs: boolean; form?: readonly ("G" | "E" | "P")[] }, move = 0): TableRowV => ({ team: r.team, pj: r.pj, g: r.g, e: r.e, p: r.p, dg: r.gf - r.gc, pts: r.pts, isUs: r.isUs, move, form: r.form });
  const usNow = rowsNow.findIndex((r) => r.isUs);
  const total = strip.counts.total;
  const jNow = strip.todayIndex !== null ? strip.segments[strip.todayIndex]?.jornada : (day.jornada ?? null);
  const played = strip.counts.played;
  // the postponed jornadas, with their new date when it is set («la J9 se juega el 14 de enero»)
  const postponedTo: Record<string, number | null> = {};
  const postponedWords: string[] = [];
  const undatedJs: string[] = [];
  for (const s of strip.segments) {
    if (s.state !== "aplazado") continue;
    const to = postponedOf(matches.find((x) => x.id === s.id)).to;
    postponedTo[s.id] = to;
    if (to !== null) postponedWords.push(`la ${s.jornada ? `J${s.jornada}` : "aplazada"} se juega el ${DAY_MONTH.format(to)}`);
    else undatedJs.push(s.jornada ? `J${s.jornada}` : "otra");
  }
  if (undatedJs.length) postponedWords.unshift(undatedJs.length === 1 ? `la ${undatedJs[0]} está aplazada` : `las ${andList(undatedJs)} están aplazadas`);
  const temporadaData: TemporadaData = {
    sub: total
      ? live
        ? `Jornada ${jNow ?? played + 1} de ${total}. Todo se mueve con cada gol hasta el acta.`
        : isAhead(phase) && jNow
          ? `Jornada ${jNow} de ${total}. ${played ? `${usNow >= 0 ? `${usNow + 1}º` : ""} antes del pitido.`.trim() : "Empieza: todo a cero hasta el pitido."}`
          : `${seasonName}, ${played === 1 ? "tras la primera jornada" : played ? `tras ${played} jornadas` : "por empezar"}.`
      : `${seasonName}. El calendario sale pronto.`,
    subShort: total ? `Jornada ${jNow ?? Math.max(1, played)} de ${total}` : seasonName,
    rows: rowsNow.map((r) => toV(r)),
    projected: proj ? proj.rows.map((r) => toV(r, r.move)) : null,
    note: isOver(phase) ? "con el acta" : played ? `tras la jornada ${standings?.jornada ?? played}` : "todos a cero",
    forma: formaOf(strip.segments),
    formaNote: strip.segments.some((s) => s.state === "directo") ? "la G es provisional" : played ? "últimos seis" : "por estrenar",
    goals: leaders.goals,
    assists: leaders.assists,
    segments: strip.segments,
    legend: total ? `${jNow ? `Jornada ${jNow} de ${total}${live ? ", en juego" : phase === "antes" ? ": hoy" : ""}` : `${total} jornadas`}. ${strip.counts.upcoming ? `Quedan ${strip.counts.upcoming}` : "No queda ninguna"}${postponedWords.length ? `; ${andList(postponedWords)}` : ""}.` : "",
    postponed: postponedTo,
    hasTable: rowsNow.length > 0,
  };
  const [asi, setAsi] = useState(true);

  // ── Club
  const polls = usePolls(member);
  const openPoll = member ? polls.data.find((p) => p.closedAt === null && now < p.closesAt) : undefined;
  // its tally (members read the votes) and a vote in place for a one-answer poll
  const pollVotesLive = usePollVotes(openPoll?.id);
  const pollTallied = openPoll ? pollTally(openPoll, pollVotesLive.data) : null;
  const pollRows = pollTallied?.rows ?? [];
  const pollVoters = pollTallied?.voters ?? 0;
  const [pollSent, setPollSent] = useState<{ poll: string; id: string } | null>(null);
  const [pollErr, setPollErr] = useState("");
  const pollMine = openPoll ? (pollSent && pollSent.poll === openPoll.id ? [pollSent.id] : (pollVotesLive.data.find((v) => v.uid === uid)?.optionIds ?? [])) : [];
  const votePollNow = (id: string) => {
    if (!me || !openPoll) return;
    setPollSent({ poll: openPoll.id, id });
    setPollErr("");
    votePoll(me, openPoll, [id]).catch(() => {
      setPollSent(null);
      setPollErr("No se ha guardado tu voto. Inténtalo otra vez.");
    });
  };
  const birthday = upcomingBirthdays(squad, now, 1).find((b) => b.days <= 30);
  const medals = clubMedals(pulse, lines, nameOf, (d) => formatDate(d));
  const latestMedal = medals.filter((x) => x.earned).at(-1);
  const clubData: ClubData = {
    birthday: birthday
      ? (() => {
          const at = now + birthday.days * 86_400_000;
          const pos = resolvePositions(players.find((p) => p.id === birthday.id) ?? {});
          const posWord = pos.main ? POSITIONS[pos.main].name : pos.line ? LINE_NAMES[pos.line].short : "";
          return { id: birthday.id, name: niceName(birthday.name), num: birthday.num, pos: posWord.toLocaleLowerCase("es"), when: birthday.days === 0 ? "hoy" : birthday.days === 1 ? "mañana" : `el ${weekday(at)} ${Number(madridDate(at).slice(8))}` };
        })()
      : null,
    vitrina: latestMedal ? { title: `La vitrina: ${latestMedal.kicker.toLocaleLowerCase("es")}`, sub: `${latestMedal.title}, ${latestMedal.detail}.` } : { title: "La vitrina, por estrenar", sub: "El primer trofeo se gana esta temporada." },
    dorsales: squad.filter((s) => s.num).map((s) => ({ id: s.id, num: s.num, name: niceName(s.name) })),
    squadSize: squad.length,
    poll: openPoll
      ? {
          title: openPoll.question,
          sub: pollVoters ? `Encuesta de socios: ${pollRows.map((r) => `${r.label} ${r.count}`).join(", ")}.` : "Encuesta de socios, sin votos todavía.",
          multi: openPoll.multi,
          options: pollRows.map((r) => ({ id: r.id, label: r.label, count: r.count })),
          mine: pollMine,
          onVote: me && !openPoll.multi ? (id: string) => votePollNow(id) : null,
          error: pollErr,
        }
      : null,
    sponsors: content.sponsors,
  };
  const shirt = kind === "jugador" && mine ? { name: mine.name.toLocaleUpperCase("es").slice(0, 12), num: mine.num } : { name: "", num: "" };
  const kit = m?.kit === "away" ? "away" : "home";

  // ── the shelf
  const usProj = proj?.position ?? null;
  const hints = placeHints({
    day,
    now,
    // (before the first jornada the table is all zeros: the hint says the season starts instead)
    table: rowsNow.length && (played > 0 || liveScore) ? { position: liveScore ? usProj : usNow >= 0 ? usNow + 1 : null, points: liveScore ? (proj?.points ?? null) : usNow >= 0 ? rowsNow[usNow].pts : null, projected: !!liveScore } : null,
    season: { played, total, jornada: jNow },
    mvp: winner?.names ?? null,
    birthdays: birthday ? [{ name: niceName(birthday.name), days: birthday.days, label: birthday.label }] : [],
    squadSize: squad.length,
    pending: kind === "jugador" ? tu.pending : null,
  });
  const hintOf = (id: PlaceId) => (id === "tu" ? (hints.tu ?? "") : hints[id]);
  const shelfPlaces = places.map((id) => ({ id, label: PLACE_LABEL[id], hint: hintOf(id), short: shortHint(id, hintOf(id)), badge: id === "tu" && tu.pending ? tu.pending : undefined }));

  // ── the light
  const light = skyAt(view.at, live || phase === "final");
  const skyLight = theme === "light" ? "dia" : light.light;

  // ── pieces
  const reg = (n: 1 | 2 | 3 | 4) => region(n);
  const noReg = () => "";
  const lens = (
    <HoyLens
      className="vi-stage__lens"
      face={face}
      rival={m ? (m.rival?.trim() ?? "Rival") : null}
      rivalCode={m ? rivalCode(m.rival ?? "", m.rivalShort ?? m.rivalInitials) : ""}
      home={m?.home !== false}
      items={items}
      duration={m?.duration ?? 50}
      nowMinute={live ? (view.seconds ?? 0) / 60 : undefined}
      sun={sun}
      sunHours={sunHours}
      goal={goal}
      rollSide={lastGoal && eventMetaOf(lastGoal).goal === "against" ? "them" : "us"}
      goalStatus={goalStatus}
      onReplay={live && lastGoal && !reduced ? () => setReplay({ id: lastGoal.id, n: replays + 1 }) : undefined}
    />
  );
  const convoWhen = phase === "semana" && Number.isFinite(kickoff) ? `el ${weekday(kickoff)}` : "hoy";
  const leftOrn =
    orns.left === "siete" && m && spots.length ? (
      <SieteOrn title={sieteTitle} system={lineup?.system ?? "3-2-1"} spots={spots} bench={benchLineOf(m, phase, view.events, niceOf, lineup ? { at: lineup.setAt, now } : false)} kit={kit} theme={theme} className="vi-orn--l" />
    ) : orns.left === "viene" && upcoming.length ? (
      <VieneOrn upcoming={upcoming} jornadaOf={jornadaOf} now={now} className="vi-orn--l" />
    ) : null;
  const rightOrn =
    orns.right === "plays" && m ? (
      <PlaysOrn title={isOver(phase) && !member ? "La noche, jugada a jugada" : "Jugada a jugada"} sub={playsSub} log={log} grow={plays} matchId={m.id} note={live ? mesaLine(m) : null} className="vi-orn--r" />
    ) : orns.right === "convo" && m ? (
      <ConvoOrn
        counts={counts}
        who={comers}
        when={convoWhen}
        mine={kind === "jugador" && tu.rsvp && tu.rsvp.match.id === m.id ? { value: tu.rsvp.value, onPick: tu.rsvp.pick, error: tu.rsvp.error, busy: tu.rsvp.busy } : null}
        mesa={role === "anotador" ? `${convoWhen === "hoy" ? "Hoy" : capital(convoWhen)} anotas tú en la mesa.` : mesaOf(m) ? `${convoWhen === "hoy" ? "Hoy" : capital(convoWhen)} anota ${mesaOf(m)?.name} en la mesa.` : null}
        className="vi-orn--r"
      />
    ) : orns.right === "previa" && m ? (
      <PreviaOrn match={m} jornada={day.jornada} weather={weather} hourly={hourlyText?.previa ?? null} homeVenue={content.venue} className="vi-orn--r" />
    ) : orns.right === "mvp" && m ? (
      <MvpOrn
        candidates={Object.entries(m.ledger ?? {})
          .filter(([id, v]) => v.played && !id.startsWith("guest:"))
          .map(([id]) => ({ id, name: nameOf(id).toLocaleUpperCase("es"), num: numOf(id) }))}
        mine={tu.mvpVote}
        closes={typeof m.voteClosesAt === "number" ? `el ${weekday(m.voteClosesAt)}` : "pronto"}
        closesAt={typeof m.voteClosesAt === "number" ? `el ${weekday(m.voteClosesAt)} a las ${madridTime(m.voteClosesAt)}` : "que cierre la votación"}
        turnout={mvpResult ? { total: mvpResult.total, eligible } : null}
        onVote={(pid) => (me ? voteMvp(me, m.id, pid) : Promise.reject(new Error("sin sesión")))}
        className="vi-orn--r"
      />
    ) : orns.right === "fecha" && m ? (
      <FechaOrn match={m} jornada={day.jornada} className="vi-orn--r" />
    ) : orns.right === "winner" && m ? (
      <MvpWinnerOrn
        winners={winnerIds.map((id) => ({ id, name: nameOf(id).toLocaleUpperCase("es"), num: numOf(id) }))}
        votes={winnerVotes}
        total={mvpResult?.total ?? null}
        of={estreno ? "del estreno" : day.jornada ? `de la J${day.jornada}` : "del partido"}
        deeds={winnerIds.length === 1 ? winnerDeeds(spots.find((s) => s.id === winnerIds[0])?.tags ?? []) : null}
        matchId={m.id}
        className="vi-orn--r"
      />
    ) : orns.right === "viene" && upcoming.length ? (
      <VieneOrn upcoming={upcoming} jornadaOf={jornadaOf} now={now} className="vi-orn--r" />
    ) : null;
  const head = (
    <HoyHead
      h1={copy.h1}
      lede={copy.lede}
      actions={actions}
      me={meLine ? { initial: (myName || me?.name || "T").charAt(0).toLocaleUpperCase("es"), line: meLine } : null}
      weather={wx}
      onPitch={seven.length ? endSentence(andList(seven.map((id) => niceOf(id)))) : null}
      nameClass={goal.name || undefined}
      className={meLine && meLine.length > 90 ? "vi-head--long" : undefined}
    />
  );
  const hoyPanel = (
    <>
      {leftOrn && <div className={`vi-slot vi-slot--l ${cockpit ? "" : reg(2)}`}>{leftOrn}</div>}
      {rightOrn && <div className={`vi-slot vi-slot--r ${cockpit ? "" : reg(3)}`}>{rightOrn}</div>}
      <div className={`vi-slot vi-slot--head ${cockpit ? "" : reg(1)}`}>{head}</div>
      {alertErr && (
        <p className="vi-err vi-slot--err" role="alert">
          {alertErr}
        </p>
      )}
      {m && <PlaysGrow log={log} grow={plays} sub={playsAllSub} />}
    </>
  );
  // (in the cockpit a zone's «Ver todo» focuses the zone instead: the zone itself grows)
  const zoneTabla = cockpit && focus !== "temporada" ? { ...tabla, grow: () => go("temporada") } : tabla;
  const zoneGoles = cockpit && focus !== "temporada" ? { ...goles, grow: () => go("temporada") } : goles;
  const temporadaPanel = (opts: { compact?: boolean; wide?: boolean; regions: boolean }) => <Temporada d={temporadaData} now={now} tabla={zoneTabla} goles={zoneGoles} compact={opts.compact} wide={opts.wide} region={opts.regions ? reg : noReg} asi={asi} onAsi={setAsi} />;
  const tuTitle = tuTitleOf(myName || "Tú", phase, meLine);
  const placeHead = (title: string, sub: string) => (
    <header className={`vi-ph ${reg(1)}`}>
      <h2 className="vd-h2">{title}</h2>
      <p>{sub}</p>
    </header>
  );

  // the 1920 cockpit: the zones, always on screen; the shelf focuses one
  const zoneHead = (title: string, sub: string, id: PlaceId) => (
    <div className="vi-zhead">
      <div>
        <h2>{title}</h2>
        <p>{sub}</p>
      </div>
      {focus === id ? (
        <button type="button" className="vd-glass vd-btn vd-btn--sm vd-press" onClick={() => go("hoy")}>
          <Ico id="collapse" />
          Cerrar
        </button>
      ) : id === "temporada" ? null : (
        // (the boards: Temporada opens from its own «Ver la tabla entera» and the shelf, no «Abrir» of its own)
        <button type="button" className="vd-glass vd-btn vd-btn--sm vd-press" onClick={() => go(id)} aria-label={`Abrir ${title.toLocaleLowerCase("es")}`}>
          <Ico id="expand" />
          Abrir
        </button>
      )}
    </div>
  );

  const busy = loading;
  const panelId = shelfPanelId("inicio", place);
  return (
    <div className={`vx vi vi--${place}${cockpit ? " vi--cockpit" : ""}${plays.open || tabla.open || goles.open ? " vi--grown" : ""}${plays.open ? " vi--grown-plays" : ""}`} data-phase={phase} aria-busy={busy}>
      <VidrioSky light={skyLight} floodlit={light.floodlit} reduced={reduced} gold={goal.sky.gold} cold={goal.sky.cold} weather={weather ? (weather.rain && weather.rain >= 50 ? "lluvia" : (weather.cloud ?? 0) >= 60 ? "nubes" : "despejado") : undefined} />
      <CelesteHeader active="inicio" sub="Manchester Piti" actions={<ThemeToggle />} />
      {(plays.open || tabla.open || goles.open) && <FloatAway />}
      <div className="vi-stage" ref={stageRef} id="contenido" tabIndex={-1}>
        {lens}
        <div className="vi-stage__shelf">
          <Shelf places={shelfPlaces} value={place} onChange={(id) => go(id as PlaceId)} label="Sitios de Inicio" idBase="inicio" />
        </div>
        <main id={panelId} role="tabpanel" aria-labelledby={shelfTabId("inicio", place)} className={`vi-panel vi-panel--${place}`}>
          {cockpit ? (
            <>
              <div className={`vi-zone vi-zone--l${focus === "temporada" ? " vi-zone--wide" : focus === "hoy" ? "" : " vd-stepback"}`}>
                <section className="vd-glass vd-window vi-window" aria-label="La temporada">
                  {zoneHead("La temporada", temporadaData.subShort, "temporada")}
                  <div className="vi-zbody">{temporadaPanel({ compact: focus !== "temporada", wide: focus === "temporada", regions: false })}</div>
                </section>
              </div>
              <div className={`vi-centre${focus === "hoy" ? "" : " vi-centre--compact"}${plays.open ? " vi-centre--grown" : ""}`}>{hoyPanel}</div>
              <div className={`vi-zone vi-zone--r${focus === "club" || focus === "tu" ? " vi-zone--wide" : focus === "hoy" ? "" : " vd-stepback"}`}>
                <section className={`vd-glass vd-window vi-window${focus === "club" ? " is-max" : focus === "tu" ? " is-min" : ""}`} aria-label="El club">
                  {zoneHead("El club", "Esta semana", "club")}
                  <div className="vi-zbody">
                    <Club d={clubData} fan={fan} shirt={shirt} kit={kit} variant={focus === "club" ? "full" : focus === "tu" ? "min" : "sum"} onOpen={() => go("club")} />
                  </div>
                </section>
                {kind === "jugador" && (
                  <section className={`vd-glass vd-window vi-window${focus === "tu" ? " is-max" : focus === "club" ? " is-min" : ""}`} aria-label="Tú">
                    {zoneHead("Tú", hints.tu ?? "", "tu")}
                    <div className="vi-zbody">
                      <Tu t={tuView} jornadaOf={jornadaOf} now={now} porraLine={porraLine} variant={focus === "tu" ? "full" : focus === "club" ? "min" : "sum"} onOpen={() => go("tu")} />
                    </div>
                  </section>
                )}
              </div>
              <TemporadaGrows d={temporadaData} tabla={tabla} goles={goles} asi={asi} onAsi={setAsi} />
            </>
          ) : place === "hoy" ? (
            hoyPanel
          ) : place === "temporada" ? (
            <div className="vi-place">
              {placeHead("La temporada", temporadaData.sub)}
              {temporadaPanel({ regions: true })}
              <TemporadaGrows d={temporadaData} tabla={tabla} goles={goles} asi={asi} onAsi={setAsi} />
            </div>
          ) : place === "club" ? (
            <div className="vi-place">
              {placeHead("El club", "Lo que pasa fuera del campo esta semana.")}
              <Club d={clubData} fan={fan} shirt={shirt} kit={kit} variant="full" region={reg} />
            </div>
          ) : (
            <div className="vi-place">
              {placeHead(tuTitle, "Lo tuyo en el Piti, sin buscarlo.")}
              <Tu t={tuView} jornadaOf={jornadaOf} now={now} porraLine={porraLine} variant="full" region={reg} />
            </div>
          )}
        </main>
      </div>
      {cartelOpen && m && (
        <Suspense fallback={null}>
          <CartelShare
            match={m}
            segment={strip.segments.find((s) => s.id === m.id) ?? null}
            ctx={{ jornada: day.jornada, seasonName, nameOf: niceOf, now, mvp: winner?.names.length === 1 ? winner.names[0] : null }}
            onClose={() => setCartelOpen(false)}
          />
        </Suspense>
      )}
      <CelesteFooter />
      <CelesteDock active="inicio" />
      <PipWindow pip={pip} title={`Manchester Piti contra ${m?.rival ?? "el rival"}`} onClose={() => setPip(null)}>
        <img className="vd-drop__crest" src="/crest-128.webp" alt="" />
        <span className="vd-score" role="img" aria-label={face.label}>
          {face.mode === "score" ? `${face.gf}–${face.ga}` : face.big}
        </span>
        <p>
          <b>{m?.rival ?? ""}</b>
          {face.status.clock ? `Minuto ${face.status.clock}, ${face.status.text.replace(/^de la /, "")}` : face.status.text}
        </p>
      </PipWindow>
    </div>
  );
}
