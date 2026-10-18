import { TechnicalStatsPanel } from "../../components/celeste/TechnicalStats";
import { downloadMatchPoster } from "./lazy";
import { useAuth } from "../../context/AuthContext";
import { useTeam } from "../../context/TeamContext";
import { useViewer } from "../../hooks/useViewer";
import { useNoIndex } from "../../hooks/useNoIndex";
import { useBoardView, useMatchBoard } from "../pizarra/useMatchBoard";
import { useMatchRatings, useMatchReactions, useMatchScorers } from "../vestuario/live";
import { useMe } from "../vestuario/writes";
import { reactionsOpen } from "../../lib/derived/trasElPartido";
import { MatchClockDisplay } from "../../components/celeste/MatchClockControl";
// Ficha de partido (Celeste): the stadium board on top (final score, live score with ¡GOL!, or the
// countdown), then tabs — Crónica/Previa/Directo · Campo · Pulso · Vestuario. From the Design canvas
// page "Partidos · elegida"; pure logic in lib/ficha.ts and lib/partidos.ts.
import { useState, type KeyboardEvent, type ReactNode } from "react";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { isCompleted, matchPhase, nameFor, useClubData, dateMillis, type ClubMatch } from "../../lib/clubData";
import { useMatchClock } from "../../hooks/useMatchClock";
import { ThemeToggle } from "../../components/ThemeToggle";
import { CelesteBackdrop, CelesteDock, CelesteFooter, CelesteHeader } from "../../components/celeste/Chrome";
import { Icon } from "../../components/celeste/icons";
import { AddToCalendar } from "../../components/celeste/AddToCalendar";
import { Flip } from "../../components/celeste/Flip";
import { GoalBurst } from "../../components/celeste/GoalBurst";
import { useGoalCelebration } from "../../components/celeste/useGoalCelebration";
import { SyncChip } from "../../components/celeste/SyncChip";
import { useSyncChip } from "../../hooks/useSyncChip";
import { WeatherChip } from "../../components/celeste/WeatherChip";
import { BackLink } from "../../components/celeste/BackLink";
import { ClubDataError, StatePanel, StateStage } from "../../components/celeste/StatePanel";
import { Countdown } from "../../components/celeste/Countdown";
import { matchEvent } from "../../lib/home";
import { dateParts, eventMinute, lastEvent, resultOf, scoreOf } from "../../lib/partidos";
import { KIT_LABEL, kitLabel, mapsUrl, siteOrigin } from "../../lib/derived/venue";
import { boardLastLine, goalBurstWho, livePlay, scoreboardOf } from "../../lib/derived/scoreboard";
import { jornadaOf } from "../../lib/derived/jornada";
import { RESULT_WORD, resultLetter, resultTitle } from "../../lib/derived/result";
import { shareClubPage } from "../../lib/share";
import { AWAITING_ACTA, kickoffState, PENDING_WHISTLE, toBePlayed, type KickoffState } from "../../lib/derived/kickoff";
import { CampoTab, CronicaTab, DirectoTab, PreviaTab, PulsoTab, VestuarioTab } from "./Tabs";
import { Who } from "./Who";
import { LiveCard, MesaKey } from "./LiveBoard";
import { LiveSide, ShirtDefs } from "./LivePanes";
import { withGuestNames } from "../../lib/derived/guests";
import { MATCH_TABS, matchTabAt, matchTabIndex } from "../../lib/matchTabs";
import { tabForKey } from "../../lib/tabKeys";
import { hasAnalysisActions } from "../../lib/technicalAnalysis";
import "../../styles/celeste/page.css";
import "../../styles/partidos.css";
import "../../styles/ficha.css";
import "./live.css";

const GOAL = /^goal/;
const route = getRouteApi("/matches/$matchId");

/** The headline of the page, by moment. */
function headline(m: ClubMatch, phase: string, kick: KickoffState, nameOf: (id: string) => string) {
  const rival = m.rival ?? "el rival";
  if (phase === "playing") return `Se juega contra ${rival}`;
  // Nobody started the clock and its window is over: nothing says it was played.
  if (kick === "awaiting_result") return `${AWAITING_ACTA} ante ${rival}`;
  if (phase === "awaiting_result") return `Terminado ante ${rival} · acta pendiente`;
  if (!isCompleted(m)) return m.home === false ? `Toca ${rival}, a domicilio` : `Toca ${rival}, en casa`;
  const { gf, ga } = scoreOf(m);
  const count = new Map<string, number>();
  for (const e of m.events ?? []) if (GOAL.test(e.type) && e.playerId) count.set(e.playerId, (count.get(e.playerId) ?? 0) + 1);
  const [top] = [...count.entries()].sort((a, b) => b[1] - a[1]);
  const r = resultLetter(gf, ga);
  if (top && top[1] >= 2) return `${top[1] >= 3 ? "Hat-trick" : "Doblete"} de ${nameOf(top[0])} y ${RESULT_WORD[r]} ${gf}–${ga}`;
  return `${resultTitle(r)} ${gf}–${ga} ante ${rival}`;
}

export function MatchPage() {
  const { matchId } = route.useParams();
  // The tab lives in the URL (?tab=campo…): a push or a shared link opens it, and each tab change is
  // a history entry, so back and forward step through the tabs. No tab (or an unknown one) = the first.
  const active = matchTabIndex(route.useSearch().tab);
  const navigate = useNavigate();
  const setTab = (i: number) => {
    if (i !== active) void navigate({ to: ".", search: (prev) => ({ ...prev, tab: matchTabAt(i) }), resetScroll: false });
  };
  // The ARIA tabs pattern: ←/→ wrap, Inicio/Fin to the ends; the key selects the tab (it is the URL's
  // tab) and the focus goes with it (roving tabindex: only the selected tab is in the Tab order).
  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const n = tabForKey(e.key, active, MATCH_TABS.map((_, i) => i));
    if (n === null) return;
    e.preventDefault();
    setTab(n);
    document.getElementById(`fc-tab-${n}`)?.focus();
  };
  const { matches, players, loading, error } = useClubData();
  const now = useMatchClock(matches);
  const { user, profile } = useAuth();
  const { member } = useTeam();
  const scorers = useMatchScorers(member ? matchId : undefined);
  const me = useMe();
  const canScore = member && (!!user && scorers.data.includes(user.uid) || profile?.role === "admin" || profile?.role === "superadmin");
  const [notice, setNotice] = useState("");
  const match = matches.find((m) => m.id === matchId);
  // Tras el partido: the reactions and the notas, public, one listener each while the page is open and the
  // acta is published (fans read them too; only a member writes).
  const published = !!match && reactionsOpen(match);
  const reactions = useMatchReactions(published ? matchId : undefined);
  const ratings = useMatchRatings(published ? matchId : undefined);
  // The shortcuts only some can follow: admins to the Sala de control, members to the pizarra's official
  // board for this match — its own, or the season's while it is still to be played (team-only reads: a
  // fan reads nothing).
  const viewer = useViewer();
  const toPlay = !!match && toBePlayed(match, now);
  const board = useMatchBoard(match?.seasonId, match?.id, toPlay, viewer.member);
  // One «siete» (M6): before the acta the Campo shows that official's seven to members, at its slots'
  // positions and with its system (its doc, read only while the Campo or the previa is open and the match
  // is still to be played — its own official first, the season's only while it has none: useMatchBoard).
  const officialBoard = useBoardView(toPlay && active <= 1 ? board : null);
  // The previa's «El rival»: the RivalPanel's notes of the board drawn for this very match (a season's
  // board isn't about this rival), members only (a fan has no board: nothing is read).
  const rivalPlan = viewer.member && match && officialBoard?.matchId === match.id ? officialBoard.rival : null;
  // (the match's own season: a per-season shirt name reads the same here as on the home)
  // (a guest of the acta: «Rafa (invitado)»)
  const nameOf = withGuestNames(match, (id: string) => nameFor(players.find((p) => p.id === id), match?.seasonId));
  const goalShow = useGoalCelebration(match && matchPhase(match, now) === "playing" ? match : undefined, now);
  // «Reconectando…» / «Sin conexión · marcador de hace N min» on the board while it is live or waiting
  const syncChip = useSyncChip(!!match && matchPhase(match, now) === "playing", now);
  // «Partido no encontrado» comes with a 200 from the SPA shell: not for the index
  useNoIndex(!loading && !error && !match);

  const chrome = (children: ReactNode) => (
    <div className="vx hm pt" aria-busy={loading}>
      <CelesteBackdrop />
      <CelesteHeader
        active="partidos"
        sub="Partido"
        actions={<ThemeToggle />}
      />
      {children}
      <CelesteFooter />
      <CelesteDock active="partidos" />
    </div>
  );

  // The data did not arrive: an error, never «no encontrado» (the match may well exist).
  if (error && !match)
    return chrome(
      <StateStage>
        <ClubDataError heading="h1" />
      </StateStage>,
    );
  if (loading)
    return chrome(
      <section className="pt-hero" aria-label="Cargando el partido" style={{ minHeight: "100svh" }}>
        <p className="sr-only" role="status">
          Cargando el partido…
        </p>
      </section>,
    );
  if (!match)
    return chrome(
      <StateStage ghost="404">
        <StatePanel
          kind="notfound"
          heading="h1"
          title="Partido no encontrado"
          body="Este partido no está en el calendario: o se borró, o el enlace tiene el marcador mal apuntado."
          action={
            <>
              <Link className="sp-btn" to="/partidos">
                Ver los partidos
              </Link>
              <Link className="sp-btn ghost" to="/">
                Ir al inicio
              </Link>
            </>
          }
        />
      </StateStage>,
    );

  const phase = matchPhase(match, now);
  const kick = kickoffState(match, now);
  const live = phase === "playing";
  const done = isCompleted(match);
  const pending = phase === "awaiting_result";
  // The date has come (or gone) and the clock never started: no countdown, no provisional score.
  const whistle = kick === "pending_whistle";
  const unplayed = kick === "awaiting_result";
  const upcoming = phase === "scheduled" || phase === "unscheduled";
  const { rival, initials: ini, gf, ga, usSide, rivalSide } = scoreboardOf(match);
  const d = dateParts(match.date);
  const play = live ? livePlay(match, now, nameOf) : null;
  const minute = play ? play.minute : null;
  const last = play ? play.last : null;
  const line = play ? boardLastLine(play) : null;
  const jornada = jornadaOf(matches, match.id);
  const kit = kitLabel(match, KIT_LABEL.home);
  const r = done ? resultOf(match) : undefined;
  const goalsOf = (ours: boolean) =>
    (match.events ?? [])
      .filter((e) => (ours ? ["goal", "goal_penalty", "goal_freekick", "opponent_own_goal"] : ["opponent_goal", "own_goal"]).includes(e.type))
      .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0))
      .map((e) => {
        const shown = eventMinute(e);
        // (ours — the scorer, or ours who put it in his own net — is a link to his page)
        const pid = e.type === "opponent_goal" || e.type === "opponent_own_goal" ? undefined : e.playerId;
        return { id: e.id, min: shown != null ? `${shown}′` : "", pid, who: e.type === "opponent_goal" ? rival : e.type === "opponent_own_goal" ? "autogol" : e.playerId ? nameOf(e.playerId) : "" };
      });
  // Live, or played with its acta still to come: the lit card (LiveBoard), the title, chips and buttons beside
  // it on a desktop, and the side column next to Directo · Campo · Pulso.
  const cardMode = live || (pending && !unplayed);
  const mesaOpen = !!canScore && !done && !["cancelled", "postponed"].includes(phase);
  const lastAt = last ? match.events?.find((e) => e.id === last.id) : undefined;
  const freshGoal = goalShow.goal ? match.events?.find((e) => e.id === goalShow.goal?.id) : undefined;
  // «En directo, jornada 7 de liga en el Campo de pruebas»
  const kickLine = [live ? "En directo" : "Acta pendiente", jornada ? `jornada ${jornada}${match.competition ? ` de ${match.competition.toLocaleLowerCase("es")}` : ""}` : match.competition?.toLocaleLowerCase("es")].filter(Boolean).join(", ") + (match.venue ? ` en ${match.venue}` : "");
  const firstTab = done ? "Crónica" : live ? "Directo" : pending ? "Acta pendiente" : "Previa";
  // «Estadísticas» reads the narrated actions (passes, shots, tackles…): without any, a short line.
  const analysed = hasAnalysisActions([match]);

  const share = async () => {
    try {
      await shareClubPage("partido", match.id, `Manchester Piti vs ${rival}`);
      setNotice(typeof navigator !== "undefined" && typeof navigator.share === "function" ? "" : "Enlace copiado.");
    } catch {
      setNotice("No se ha compartido el enlace.");
    }
  };
  const poster = async (format: "square" | "story") => {
    try {
      await downloadMatchPoster(match, format);
      setNotice("Cartel descargado.");
    } catch {
      setNotice("No se pudo generar el cartel.");
    }
  };

  return chrome(
    <>
      <section className="pt-hero fc-hero" aria-labelledby="fc-t">
        <div className="pt-beams" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className={`pt-hero-in${cardMode ? " ml-hero" : ""}`}>
          <div className="pt-rise">
            <BackLink className="fc-back" to="/partidos" label="Partidos" />
            {cardMode ? (
              <p className="ml-kick" style={{ margin: 0 }}>
                {live && <i aria-hidden="true" />}
                {kickLine}
              </p>
            ) : (
              <div className="pt-tags">
                <span className="hm-kick" style={{ margin: 0 }}>
                  {[match.competition, jornada && `Jornada ${jornada}`].filter(Boolean).join(" · ")}
                </span>
              </div>
            )}
            <h1 className="fc-h1" id="fc-t">
              {headline(match, phase, kick, nameOf)}
            </h1>
          </div>
          {cardMode ? (
            <LiveCard match={match} rival={rival} initials={ini} gf={gf} ga={ga} minute={minute} last={pending ? lastEvent(match.events, nameOf, rival) : last} lastAt={lastAt} jornada={jornada ? `Jornada ${jornada}` : ""} goal={goalShow.goal} mesa={mesaOpen} pending={!live}>
              {live && (
                <div className="pt-sync">
                  <SyncChip chip={syncChip} variant="board" announce />
                </div>
              )}
              {live && <GoalBurst burst={goalShow.burst} who={goalBurstWho(last)} />}
            </LiveCard>
          ) : (
          <article className={`pt-board pt-rise${live ? " live" : ""}`} style={{ animationDelay: ".15s" }} aria-label={done ? `Final: Manchester Piti ${gf}, ${rival} ${ga}` : live ? `En directo contra ${rival}` : whistle ? `${PENDING_WHISTLE} contra ${rival}` : unplayed ? `${AWAITING_ACTA} contra ${rival}` : `Previa contra ${rival}`}>
            <div className="pt-btop">
              <span>
                {d.long.charAt(0).toUpperCase() + d.long.slice(1)} · {d.time}
              </span>
              {live ? (
                <span className="pt-live">
                  <span className="pt-dot" />
                  {match.clock ? <MatchClockDisplay match={match} /> : <>EN DIRECTO · {minute}′</>}
                </span>
              ) : (
                <b>{done ? "FINAL" : phase === "cancelled" ? "CANCELADO" : phase === "postponed" ? "APLAZADO" : unplayed ? AWAITING_ACTA.toUpperCase() : pending ? "MARCADOR PROVISIONAL · ACTA PENDIENTE" : dateMillis(match.date) - now < 7 * 86_400_000 ? "ESTA SEMANA" : "PRÓXIMO"}</b>
              )}
            </div>
            <div className="pt-teams">
              <div className="pt-team">
                <img src="/crest-128.webp" alt="" />
                <b>MANCHESTER PITI</b>
                <small>{usSide}</small>
              </div>
              {done || live || (pending && !unplayed) ? (
                <div className="pt-score" role="status" aria-label={`Resultado: ${gf} a ${ga}`}>
                  <Flip value={gf} still={!goalShow.flip} />
                  <i>–</i>
                  <Flip value={ga} still={!goalShow.flip} />
                </div>
              ) : (
                <span className="pt-vs">vs</span>
              )}
              <div className="pt-team">
                {match.rivalLogoUrl ? <img src={match.rivalLogoUrl} alt="" /> : <span className="ini">{ini}</span>}
                <b>{rival}</b>
                <small>{rivalSide}</small>
              </div>
            </div>
            {(done || live || pending) && (goalsOf(true).length > 0 || goalsOf(false).length > 0) && (
              <div className="fc-goals">
                <ul>
                  {goalsOf(true).map((g) => (
                    <li key={g.id}>
                      <b>{g.min}</b> {g.pid ? <Who id={g.pid} seasonId={match.seasonId}>{g.who}</Who> : g.who}
                    </li>
                  ))}
                </ul>
                <ul className="r">
                  {goalsOf(false).map((g) => (
                    <li key={g.id}>
                      <b>{g.min}</b> {g.pid ? <Who id={g.pid} seasonId={match.seasonId}>{g.who}</Who> : g.who}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(live || whistle) && (
              <div className="pt-sync">
                <SyncChip chip={syncChip} variant="board" announce />
              </div>
            )}
            {live && (
              <>
                <div className="pt-prog" aria-hidden="true">
                  <i style={{ width: `${play?.progress ?? 0}%` }} />
                </div>
                <div className="pt-last" aria-live="polite">
                  <b>{line?.at}</b>
                  <span>{line?.text}</span>
                </div>
                <GoalBurst burst={goalShow.burst} who={goalBurstWho(last)} />
              </>
            )}
            {upcoming && Number.isFinite(dateMillis(match.date)) && phase === "scheduled" && !whistle && <Countdown target={dateMillis(match.date)} />}
            {whistle && (
              <div className="pt-last" role="status">
                <b>{d.time}</b>
                <span>{PENDING_WHISTLE}</span>
              </div>
            )}
            <div className="pt-chips">
              <span className="pt-chip">
                <Icon name="shirt" size={14} /> {kit}
              </span>
              {match.venue && <span className="pt-chip">{match.venue}</span>}
              {upcoming && <WeatherChip match={match} now={now} />}
              {r && <span className={`pt-res ${r}`}>{r}</span>}
            </div>
          </article>
          )}
          <div className={cardMode ? "ml-acts" : undefined}>
            {cardMode && (
              <div className="ml-chips">
                <span className="ml-chip0">
                  {d.longCap} · {d.time}
                </span>
                <span className="ml-chip0">
                  <Icon name="shirt" size={14} /> {kit}
                </span>
              </div>
            )}
            <div className="fc-acts">
              {/* (before kick-off too: the scorer calls the roll, sends the seven and blows the whistle from la mesa) */}
              {mesaOpen && <MesaKey matchId={match.id} wide className={cardMode ? "" : "pre"} />}
              {upcoming && phase === "scheduled" && <AddToCalendar className="hm-btn" label="Añadir al calendario" event={matchEvent(match, siteOrigin())} />}
              {/* (right after the main action: the row scrolls sideways on a phone, these must not hide at its end) */}
              {viewer.member && board && match.seasonId && (
                <Link className="hm-ghostbtn" to="/pizarra" search={{ tablero: board, season: match.seasonId }}>
                  La pizarra de este partido <Icon name="arrow" size={16} stroke={2.2} />
                </Link>
              )}
              {/* (an admin's way in, by moment: being played → la mesa, «Abrir la mesa» above; played → its
                   acta; before → its workspace) */}
              {viewer.admin &&
                !live &&
                (done || pending || unplayed ? (
                  <Link className="hm-ghostbtn" to="/admin/partidos/$matchId" params={{ matchId: match.id }} search={{ tab: "acta" }}>
                    Editar acta <Icon name="arrow" size={16} stroke={2.2} />
                  </Link>
                ) : (
                  <Link className="hm-ghostbtn" to="/admin/partidos/$matchId" params={{ matchId: match.id }}>
                    Abrir en la Sala de control <Icon name="arrow" size={16} stroke={2.2} />
                  </Link>
                ))}
              {upcoming && match.venue && (
                <a className="hm-ghostbtn" href={mapsUrl(match.venue)} target="_blank" rel="noreferrer">
                  Cómo llegar <Icon name="arrow" size={16} stroke={2.2} />
                </a>
              )}
              <button type="button" className="hm-ghostbtn" onClick={() => void share()}>
                <Icon name="share" size={16} /> Compartir
              </button>
              <button type="button" className="hm-ghostbtn" onClick={() => void poster("square")}>
                Cartel cuadrado
              </button>
              <button type="button" className="hm-ghostbtn" onClick={() => void poster("story")}>
                Historia vertical
              </button>
            </div>
            {notice && (
              <p className="fc-status" role="status">
                {notice}
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="fc-tabs" role="tablist" aria-label="Secciones del partido" onKeyDown={onTabKey}>
        <span className="ind" style={{ transform: `translateX(${active * 100}%)` }} aria-hidden="true" />
        {[firstTab, "Campo", "Pulso", "Vestuario", "Estadísticas"].map((label, i) => (
          <button key={label} type="button" role="tab" id={`fc-tab-${i}`} aria-selected={active === i} aria-controls={`fc-pane-${i}`} tabIndex={active === i ? 0 : -1} onClick={() => setTab(i)}>
            {label}
          </button>
        ))}
      </div>
      <div className={`fc-pane${(active === 0 && done) || (active === 4 && analysed) ? " wide" : ""}`} role="tabpanel" id={`fc-pane-${active}`} aria-labelledby={`fc-tab-${active}`} tabIndex={0} key={active}>
        {cardMode && active <= 2 ? (
          <div className="ml-body">
            <ShirtDefs />
            <div>
              {active === 0 && <DirectoTab match={match} nameOf={nameOf} live={live} freshId={goalShow.goal?.id ?? null} />}
              {active === 1 && <CampoTab match={match} players={players} nameOf={nameOf} live={live} official={null} board={null} freshScorer={goalShow.goal?.ours ? (freshGoal?.playerId ?? null) : null} />}
              {active === 2 && <PulsoTab match={match} players={players} nameOf={nameOf} live={live} pending={pending} />}
            </div>
            <LiveSide match={match} players={players} nameOf={nameOf} now={now} />
          </div>
        ) : null}
        {!(cardMode && active <= 2) && active === 0 && (done ? <CronicaTab match={match} matches={matches} players={players} nameOf={nameOf} after={published ? { reactions: reactions.data, ratings: ratings.data, me: member ? me : null, error: reactions.error || ratings.error } : undefined} /> : live || pending ? <DirectoTab match={match} nameOf={nameOf} live={live} /> : <PreviaTab match={match} matches={matches} plan={rivalPlan} />)}
        {!cardMode && active === 1 && <CampoTab match={match} players={players} nameOf={nameOf} live={live} official={officialBoard?.seven ?? null} board={officialBoard} />}
        {!cardMode && active === 2 && <PulsoTab match={match} players={players} nameOf={nameOf} live={live} pending={pending} />}
        {active === 4 &&
          (analysed ? (
            <TechnicalStatsPanel matches={[match]} people={players.map((p) => ({ id: p.id, name: nameOf(p.id), number: p.number }))} seasonId={match.seasonId} />
          ) : (
            <StatePanel kind="empty" compact title="Sin análisis de este partido" body="Nadie ha narrado sus jugadas: pases, remates, entradas… Cuando el acta las apunte, el juego en detalle saldrá aquí." />
          ))}
        {active === 3 && <VestuarioTab match={match} matches={matches} players={players} phase={phase} ratings={ratings.data} ratingsError={ratings.error} />}
      </div>
    </>,
  );
}

export default MatchPage;
