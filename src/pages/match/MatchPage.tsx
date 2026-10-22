import { AnalysisPanels } from "../../components/celeste/AnalysisPanels";
import { downloadMatchPoster } from "./lazy";
import { useAuth } from "../../context/AuthContext";
import { useTeam } from "../../context/TeamContext";
import { useViewer } from "../../hooks/useViewer";
import { useNoIndex } from "../../hooks/useNoIndex";
import { useBoardView, useMatchBoard } from "../pizarra/useMatchBoard";
import { useMatchRatings, useMatchReactions, useMatchScorers } from "../vestuario/live";
import { useMe } from "../vestuario/writes";
import { reactionsOpen } from "../../lib/derived/trasElPartido";
// Ficha de partido («Vidrio», V-Vivo «La página del partido» and V-Integracion): where «Abrir el partido» lands.
// On the light field of the moment: «Volver», the glass scoreboard (the countdown before, the score and the
// minute while it is played, the result after) that the floating score morphs into and that keeps the float
// away while it is on screen, «Sacar el marcador» and «Compartir»; then the glass tabs Directo · Alineación ·
// Números · Pulso · Vestuario (the URL keeps ?tab=), the play-by-play as a two-sided feed with «Ver todo el
// partido» and «Ahora en el campo» beside it. Pure logic in lib/ficha.ts, lib/partidos.ts and lib/derived.
import { useCallback, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { isCompleted, matchPhase, nameFor, useClubData, dateMillis, type ClubMatch } from "../../lib/clubData";
import { useMatchClock } from "../../hooks/useMatchClock";
import { ThemeToggle } from "../../components/ThemeToggle";
import { CelesteDock, CelesteFooter, CelesteHeader } from "../../components/celeste/Chrome";
import { Icon } from "../../components/celeste/icons";
import { AddToCalendar } from "../../components/celeste/AddToCalendar";
import { useGoalCelebration } from "../../components/celeste/useGoalCelebration";
import { SyncChip } from "../../components/celeste/SyncChip";
import { useSyncChip } from "../../hooks/useSyncChip";
import { WeatherChip } from "../../components/celeste/WeatherChip";
import { ClubDataError, StatePanel, StateStage } from "../../components/celeste/StatePanel";
import { BackLink } from "../../components/celeste/BackLink";
import { LIVE_MORPH, Lens, PipWindow, openScorePip, useDesktop, useGoalMoment, useLiveDock, type GoalClasses, type ScorePip } from "../../components/vidrio";
import { pipBottom } from "../../components/vidrio/live/liveModel";
import { PageSky } from "../../components/paginas/PageSky";
import { PgIcon } from "../../components/paginas/Tags";
import { countdownParts, matchEvent } from "../../lib/home";
import { dateParts, eventMinute, OURS, resultOf, scoreOf, shownMinute } from "../../lib/partidos";
import { settled } from "../../lib/eventMeta";
import { KIT_LABEL, kitLabel, mapsUrl, siteOrigin, venueName } from "../../lib/derived/venue";
import { scoreboardOf } from "../../lib/derived/scoreboard";
import { jornadaOf } from "../../lib/derived/jornada";
import { kickoffHint } from "../../lib/derived/vidrio/hints";
import { RESULT_WORD, resultLetter, resultTitle } from "../../lib/derived/result";
import { shareClubPage } from "../../lib/share";
import { AWAITING_ACTA, kickoffState, PENDING_WHISTLE, toBePlayed, type KickoffState } from "../../lib/derived/kickoff";
import { madridDate } from "../../lib/derived/madrid";
import { niceName } from "../../lib/derived/words";
import { mesaLine, mesaOf } from "../../lib/derived/mesa";
import { parseMatchLineup } from "../../lib/matchLineup";
import { CampoTab, CronicaTab, PreviaTab, PulsoTab, VestuarioTab } from "./Tabs";
import { currentHalf } from "./directoModel";
import { Who } from "./Who";
import { MesaKey } from "./LiveBoard";
import { LiveSide, ShirtDefs } from "./LivePanes";
import { Feed } from "./vidrio/Feed";
import { Campo } from "./vidrio/Campo";
import { withGuestNames } from "../../lib/derived/guests";
import { matchTabAt, matchTabIndex } from "../../lib/matchTabs";
import { tabForKey } from "../../lib/tabKeys";
import "../../styles/celeste/page.css";
import "../../styles/partidos.css";
import "../../styles/ficha.css";
import "./live.css";
import "../../styles/vidrio/tokens.css";
import "../../styles/vidrio/glass.css";
import "../../styles/vidrio/components.css";
import "../../styles/vidrio/reading.css";
import "../../styles/vidrio-paginas.css";
import "../../styles/match-vidrio.css";

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
  for (const e of settled(m.events)) if (OURS.has(e.type) && e.type !== "opponent_own_goal" && e.playerId) count.set(e.playerId, (count.get(e.playerId) ?? 0) + 1);
  const [top] = [...count.entries()].sort((a, b) => b[1] - a[1]);
  const r = resultLetter(gf, ga);
  if (top && top[1] >= 2) return `${top[1] >= 3 ? "Hat-trick" : "Doblete"} de ${nameOf(top[0])} y ${RESULT_WORD[r]} ${gf}–${ga}`;
  return `${resultTitle(r)} ${gf}–${ga} ante ${rival}`;
}

/** «Faltan 2 h 14 min», «Faltan 3 días». */
function leftWords(at: number, now: number): string {
  const { d, h, m } = countdownParts(at, now);
  if (d > 0) return `Faltan ${d} ${d === 1 ? "día" : "días"}`;
  if (h > 0) return `Faltan ${h} h ${m} min`;
  return m > 0 ? `Faltan ${m} min` : "Ya casi";
}

interface BoardProps {
  match: ClubMatch;
  now: number;
  rival: string;
  initials: string;
  gf: number;
  ga: number;
  usSide: string;
  rivalSide: string;
  state: "live" | "halftime" | "pending" | "done" | "whistle" | "unplayed" | "upcoming" | "off";
  minute: number | null;
  goal: GoalClasses;
  goalSide: "us" | "them" | null;
  children?: ReactNode;
}

/** The glass scoreboard (board .vv-board / .vv-pboard). While the match is played it is the page's live lens:
 *  the floating score steps aside while it is on screen, and «Abrir el partido» lands on it (morph(LIVE_MORPH)). */
function Marcador({ match, now, rival, initials, gf, ga, usSide, rivalSide, state, minute, goal, goalSide, children }: BoardProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  useLiveDock(ref, "lens");
  const scored = state === "live" || state === "halftime" || state === "pending" || state === "done";
  const at = dateMillis(match.date);
  const half = currentHalf(match, now);
  const label = state === "done" ? `Final: Manchester Piti ${gf}, ${rival} ${ga}` : state === "live" || state === "halftime" ? `En directo contra ${rival}` : state === "pending" ? `Marcador provisional contra ${rival}` : state === "whistle" ? `${PENDING_WHISTLE} contra ${rival}` : state === "unplayed" ? `${AWAITING_ACTA} contra ${rival}` : `Previa contra ${rival}`;
  return (
    <div ref={ref} className={`mp-boardwrap ${goal.root}`}>
      <Lens as="article" className={`mp-board${goal.rim ? " vd-rim-gold" : ""}`} morphName={scored && state !== "done" ? LIVE_MORPH : undefined} goal={`${goal.lens} ${goal.glint}`} aria-label={label}>
        <div className="vd-team mp-team">
          <img className="vd-team__crest" src="/crest-128.webp" alt="" />
          <div>
            <b>
              <span className="mp-long">Manchester </span>Piti
            </b>
            <span>{usSide}</span>
          </div>
        </div>
        <div className="mp-board__mid">
          {scored ? (
            <div className="vd-scoreline vd-score mp-scoreline" role="status" aria-label={`Resultado: ${gf} a ${ga}`}>
              <span className={`vd-digit${goalSide === "us" ? ` ${goal.digit}` : ""}`}>{gf}</span>
              <span className="vd-scoreline__sep" aria-hidden="true" />
              <span className={`vd-digit${goalSide === "them" ? ` ${goal.digit}` : ""}`}>{ga}</span>
            </div>
          ) : (
            <span className="vd-score mp-time">{Number.isFinite(at) ? dateParts(match.date).time : "—"}</span>
          )}
        </div>
        <div className="mp-board__under">
          <p className="vd-status mp-status">
            {state === "live" && (
              <>
                <span className="vd-live">En directo</span>
                <b className="vd-clock">{minute ?? 0}′</b>
                <span>{half === 2 ? "de la segunda parte" : "de la primera parte"}</span>
              </>
            )}
            {state === "halftime" && <span>Descanso, {gf}–{ga} en la primera parte</span>}
            {state === "pending" && <span>Final. El acta, en unos minutos</span>}
            {state === "done" && <span>Final</span>}
            {state === "whistle" && <span>{PENDING_WHISTLE}</span>}
            {state === "unplayed" && <span>{AWAITING_ACTA}</span>}
            {state === "upcoming" && Number.isFinite(at) && <span>{`${kickoffHint(at, now)}. ${leftWords(at, now)}`}</span>}
            {state === "off" && <span>{matchPhase(match, now) === "cancelled" ? "Cancelado" : "Aplazado"}</span>}
          </p>
          {children}
        </div>
        <div className="vd-team mp-team mp-team--r">
          {match.rivalLogoUrl ? <img className="vd-team__crest" src={match.rivalLogoUrl} alt="" /> : <span className="vd-team__crest vd-team__crest--rival" aria-hidden="true">{initials}</span>}
          <div>
            <b>{rival}</b>
            <span>{rivalSide}</span>
          </div>
        </div>
      </Lens>
    </div>
  );
}

/** The tabs in the boards' order (Directo · Alineación · Números · Pulso, and the vestuario's) over the URL's
 *  ids (MATCH_TABS: cronica, campo, pulso, vestuario, estadisticas). */
const ORDER = [0, 1, 4, 2, 3] as const;

export function MatchPage() {
  const { matchId } = route.useParams();
  // The tab lives in the URL (?tab=campo…): a push or a shared link opens it, and each tab change is
  // a history entry, so back and forward step through the tabs. No tab (or an unknown one) = the first.
  const search = route.useSearch();
  const active = matchTabIndex(search.tab);
  const navigate = useNavigate();
  const setTab = (i: number) => {
    if (i !== active) void navigate({ to: ".", search: (prev) => ({ ...prev, tab: matchTabAt(i) }), resetScroll: false });
  };
  // The ARIA tabs pattern: ←/→ wrap, Inicio/Fin to the ends; the key selects the tab (it is the URL's
  // tab) and the focus goes with it (roving tabindex: only the selected tab is in the Tab order).
  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const n = tabForKey<number>(e.key, active, ORDER);
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
  const canScore = member && ((!!user && scorers.data.includes(user.uid)) || profile?.role === "admin" || profile?.role === "superadmin");
  const [notice, setNotice] = useState("");
  const [pip, setPip] = useState<ScorePip | null>(null);
  const desktop = useDesktop();
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
  // (the feed and the pitch name them as a sentence does, «Adrián T.C.», as the boards)
  const niceOf = (id: string) => niceName(nameOf(id));
  const playing = !!match && matchPhase(match, now) === "playing";
  const goalShow = useGoalCelebration(playing ? match : undefined, now);
  // the goal moment on the scoreboard and the light field (gold for ours, a cold flash for theirs)
  const moment = useGoalMoment(goalShow.goal ? { key: goalShow.goal.id, side: goalShow.goal.ours ? "us" : "them" } : null);
  // «Reconectando…» / «Sin conexión · marcador de hace N min» on the board while it is live or waiting
  const syncChip = useSyncChip(playing, now);
  // «Partido no encontrado» comes with a 200 from the SPA shell: not for the index
  useNoIndex(!loading && !error && !match);
  const closePip = useCallback(() => {
    setPip((p) => {
      p?.close();
      return null;
    });
  }, []);

  const chrome = (children: ReactNode) => (
    <div className={`vx vd-pg hm pt mp${playing ? " vd-pg--live" : ""}`} aria-busy={loading}>
      <PageSky now={now} live={playing} moment={moment} />
      <CelesteHeader active="partidos" sub="Partido" actions={<ThemeToggle />} />
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
      <section className="mp-head" aria-label="Cargando el partido" style={{ minHeight: "100svh" }}>
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
  const minute = live ? shownMinute(match, now) : null;
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
  // Live, or played with its acta still to come: the feed and the pitch beside it
  const cardMode = live || (pending && !unplayed);
  const mesaOpen = !!canScore && !done && !["cancelled", "postponed"].includes(phase);
  const state: BoardProps["state"] = live ? (kick === "halftime" ? "halftime" : "live") : done ? "done" : unplayed ? "unplayed" : pending ? "pending" : whistle ? "whistle" : upcoming ? "upcoming" : "off";
  // «En directo, jornada 7 de liga en el Campo de pruebas»
  const where = [jornada ? `Jornada ${jornada}${match.competition ? ` de ${match.competition.toLocaleLowerCase("es")}` : ""}` : match.competition, venueName(match.venue ?? "")].filter(Boolean).join(" · ");
  const firstTab = done ? "Crónica" : live ? "Directo" : pending ? "Acta pendiente" : "Previa";
  const LABELS: Record<number, string> = { 0: firstTab, 1: "Alineación", 2: "Pulso", 3: "Vestuario", 4: "Números" };
  // (on a phone five tabs leave some 70 px each: «Acta pendiente» shows as «Pendiente», its name stays whole)
  const SHORT: Record<number, string | undefined> = { 0: firstTab === "Acta pendiente" ? "Pendiente" : undefined };
  // «Números» reads the narrated actions (passes, shots, tackles…): without any, a short line.
  // before the whistle, on its day: the seven the pizarra published stands beside the previa
  const lineup = parseMatchLineup((match as ClubMatch & { lineup?: unknown }).lineup);
  const today = Number.isFinite(dateMillis(match.date)) && madridDate(dateMillis(match.date)) === madridDate(now);
  const preSeven = upcoming && today && !!lineup;
  // who keeps la mesa (public, backend-written): «Lo anota Jorge desde la mesa»
  const mesa = mesaOf(match);
  const scoredGoals = (done || pending) && (goalsOf(true).length > 0 || goalsOf(false).length > 0);

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
  const onPip = () => {
    if (pip) return closePip();
    void openScorePip({ width: 420, height: 236, title: "Manchester Piti, marcador" }).then(setPip);
  };

  return chrome(
    <>
      <section className="mp-head" aria-labelledby="fc-t">
        <div className="mp-top vd-reg-1">
          {/* (back to where you came from inside the site; a deep link names the section, «Partidos») */}
          <BackLink className="fc-back vd-btn vd-btn--sm vd-glass vd-press mp-back" to="/partidos" label="Partidos" />

          <div className="mp-top__acts">
            {live && desktop && (
              <button type="button" className="vd-btn vd-btn--sm vd-glass vd-press" aria-pressed={!!pip} onClick={onPip}>
                <PgIcon id="pip" />
                {pip ? "Volver a la página" : "Sacar el marcador"}
              </button>
            )}
            <button type="button" className="vd-btn vd-btn--sm vd-glass vd-press" onClick={() => void share()}>
              <PgIcon id="share" />
              Compartir
            </button>
          </div>
        </div>
        <h1 className={live || pending ? "vd-vh" : "mp-h1"} id="fc-t">
          {headline(match, phase, kick, nameOf)}
        </h1>
        <Marcador match={match} now={now} rival={rival} initials={ini} gf={gf} ga={ga} usSide={usSide} rivalSide={rivalSide} state={state} minute={minute} goal={moment} goalSide={goalShow.goal ? (goalShow.goal.ours ? "us" : "them") : null}>
          {(live || whistle) && (
            <div className="pt-sync">
              <SyncChip chip={syncChip} variant="board" announce />
            </div>
          )}
          {scoredGoals && (
            <div className="fc-goals">
              <ul>
                {goalsOf(true).map((g) => (
                  <li key={g.id}>
                    <b>{g.min}</b>{" "}
                    {g.pid ? (
                      <Who id={g.pid} seasonId={match.seasonId}>
                        {g.who}
                      </Who>
                    ) : (
                      g.who
                    )}
                  </li>
                ))}
              </ul>
              <ul className="r">
                {goalsOf(false).map((g) => (
                  <li key={g.id}>
                    <b>{g.min}</b>{" "}
                    {g.pid ? (
                      <Who id={g.pid} seasonId={match.seasonId}>
                        {g.who}
                      </Who>
                    ) : (
                      g.who
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Marcador>
        <p className="mp-chips">
          <span>
            {d.longCap} · {d.time}
          </span>
          {where && <span>{where}</span>}
          {mesa && (live || upcoming || whistle) && <span>{mesaLine(match)}</span>}
          <span>
            <Icon name="shirt" size={14} /> {kit}
          </span>
          {upcoming && <WeatherChip match={match} now={now} />}
          {r && <span className={`mp-res mp-res--${r}`}>{r === "G" ? "Victoria" : r === "P" ? "Derrota" : "Empate"}</span>}
        </p>
        <div className="mp-acts">
          {/* (before kick-off too: the scorer calls the roll, sends the seven and blows the whistle from la mesa) */}
          {mesaOpen && <MesaKey matchId={match.id} wide className={cardMode ? "" : "pre"} />}
          {upcoming && phase === "scheduled" && <AddToCalendar className="hm-btn" label="Añadir al calendario" event={matchEvent(match, siteOrigin())} />}
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
      </section>

      <div className="mp-tabs vd-reg-2">
        <div className="vd-glass vd-seg mp-seg" role="tablist" aria-label="Secciones del partido" onKeyDown={onTabKey} style={{ "--n": ORDER.length, "--i": ORDER.indexOf(active as (typeof ORDER)[number]) } as CSSProperties}>
          <span className="vd-shelf__bead" aria-hidden="true" />
          {ORDER.map((i) => (
            <button key={i} type="button" role="tab" className="vd-seg__b" id={`fc-tab-${i}`} aria-selected={active === i} aria-controls={`fc-pane-${i}`} tabIndex={active === i ? 0 : -1} onClick={() => setTab(i)} aria-label={SHORT[i] ? LABELS[i] : undefined}>
              {SHORT[i] ? (
                <>
                  <span className="mp-tab-l">{LABELS[i]}</span>
                  <span className="mp-tab-s">{SHORT[i]}</span>
                </>
              ) : (
                LABELS[i]
              )}
            </button>
          ))}
        </div>
      </div>
      <div className={`fc-pane mp-pane vd-reg-3${(active === 0 && done) || active === 4 ? " wide" : ""}`} role="tabpanel" id={`fc-pane-${active}`} aria-labelledby={`fc-tab-${active}`} tabIndex={0} key={active}>
        <ShirtDefs />
        {active === 0 &&
          (done ? (
            <CronicaTab match={match} matches={matches} players={players} nameOf={nameOf} after={published ? { reactions: reactions.data, ratings: ratings.data, me: member ? me : null, error: reactions.error || ratings.error } : undefined} />
          ) : cardMode ? (
            <div className="mp-main">
              <div className="mp-col">
                <Feed match={match} nameOf={niceOf} live={live} freshId={goalShow.goal?.id ?? null} />
              </div>
              <div className="mp-side">
                <Campo match={match} players={players} nameOf={niceOf} live={live} started now={now} />
              </div>
            </div>
          ) : (
            <div className={preSeven ? "mp-main" : undefined}>
              <div className="mp-col">
                {preSeven && <p className="mp-pre">Aún no ha empezado. El siete ya está publicado{mesa ? ` y la mesa la lleva ${mesa.name}` : ""}.</p>}
                <PreviaTab match={match} matches={matches} plan={rivalPlan} />
              </div>
              {preSeven && (
                <div className="mp-side">
                  <Campo match={match} players={players} nameOf={niceOf} live={false} started={false} />
                </div>
              )}
            </div>
          ))}
        {active === 1 && <CampoTab match={match} players={players} nameOf={nameOf} live={live} official={cardMode ? null : (officialBoard?.seven ?? null)} board={cardMode ? null : officialBoard} freshScorer={goalShow.goal?.ours ? (match.events?.find((e) => e.id === goalShow.goal?.id)?.playerId ?? null) : null} />}
        {active === 2 && <PulsoTab match={match} players={players} nameOf={nameOf} live={live} pending={pending} />}
        {active === 4 && (
          <>
            {cardMode && <LiveSide match={match} players={players} nameOf={nameOf} now={now} />}
            <AnalysisPanels matches={[match]} people={players.map(p => ({ id: p.id, name: nameOf(p.id), number: p.number }))} seasonId={match.seasonId} matchId={match.id} search={search} onSearchChange={patch => void navigate({ to: ".", search: previous => ({ ...previous, ...patch }), replace: !!patch.q, resetScroll: false })}/>
          </>
        )}
        {active === 3 && <VestuarioTab match={match} matches={matches} players={players} phase={phase} ratings={ratings.data} ratingsError={ratings.error} />}
      </div>
      {pip && live && (
        <PipWindow pip={pip} title={`Manchester Piti contra ${rival}`} onClose={closePip} bottom={pipBottom("/matches/")}>
          <span className="vd-score">
            {gf}–{ga}
          </span>
          <p>
            <b>{rival}</b>
            {minute !== null && <span className="vd-clock">{minute}′</span>} {kick === "halftime" ? "descanso" : ""}
          </p>
        </PipWindow>
      )}
    </>,
  );
}

export default MatchPage;
