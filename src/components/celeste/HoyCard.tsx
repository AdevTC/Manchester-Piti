// «Hoy»: on match day, everything about today's match in one card, for members (spec §1). The home mounts
// it above its hero (client-side only: pages/home/HomeHoy.tsx) and the vestuario in place of its cartel's
// next-match lines. The model is pure (lib/derived/hoy.ts); every piece here is the shared one: the
// convocatoria switch, the MVP ballot, the countdown, the weather chip, the scoreboard's bits, the Campo's
// «siete» and the venue's links. Members-only reads (availability, the quedada, the official board, the
// porra) are opened only for a member, and only in the phase that shows them.
//
// Layout: one column on a phone and in the vestuario's cartel (the two .hoy-col groups are display:contents
// there, each piece keeping its place by `order`); on the home's wide screens (`variant="wide"`) the same
// groups become two columns. In the vestuario, whose own MVP block sits further down the page, the card
// sends the member there instead of a second ballot for the same vote (`mvpBlock`).
import { useId } from "react";
import { Link } from "@tanstack/react-router";
import { dateMillis, nameFor, type ClubMatch } from "../../lib/clubData";
import type { PlayerDoc } from "../../lib/schemas";
import { useViewer } from "../../hooks/useViewer";
import { hoyModel, type HoyModel } from "../../lib/derived/hoy";
import { whistleAt } from "../../lib/derived/island";
import { AWAITING_ACTA, PENDING_WHISTLE, toBePlayed } from "../../lib/derived/kickoff";
import { jornadaOf } from "../../lib/derived/jornada";
import { mvpCandidates } from "../../lib/derived/memberWindows";
import { eventLine, livePlay, scoreboardOf } from "../../lib/derived/scoreboard";
import { KIT_LABEL, kitLabel, mapsUrl } from "../../lib/derived/venue";
import { dateParts } from "../../lib/partidos";
import { predictionsRevealed, scorePrediction } from "../../../functions/src/predictions";
import { useAbsences, useAvailability, useMeetingNote, useMvpResults, useMyMvpVote, useMyPrediction } from "../../pages/vestuario/live";
import { absenceOn, madridDate, matchDay } from "../../lib/derived/absences";
import { useMe } from "../../pages/vestuario/writes";
import { useBoardView, useMatchBoard } from "../../pages/pizarra/useMatchBoard";
import { RsvpSwitch } from "../../pages/vestuario/shared/RsvpSwitch";
import { MvpBallot } from "../../pages/vestuario/shared/MvpBallot";
import { Countdown } from "./Countdown";
import { WeatherChip } from "./WeatherChip";
import { MatchClockDisplay } from "./MatchClockControl";
import { Icon } from "./icons";
import { RotaIcon } from "./Turnos";
import { useMatchTurns } from "../../lib/useRotaTurns";
// (the countdown's flip tiles and the scoreboard's pieces: the live island loads this sheet on every page too)
import "../../styles/partidos.css";
import "./hoy.css";

interface Props {
  /** The club's matches (useClubData). */
  matches: readonly ClubMatch[];
  players: readonly PlayerDoc[];
  /** The server's clock (the host's useClock / useMatchClock). */
  now: number;
  /** The convocatoria switch's id (the vestuario's «Primeros pasos» jumps to #vx-rsvp). */
  rsvpId?: string;
  /** The host's placement. */
  className?: string;
  /** "wide": the home — from 900 px of page the card spans the content and lays its parts in two columns.
   *  Default: the one compact column (the vestuario's cartel, next to the shirt). */
  variant?: "wide";
  /** The host's own MVP block (the vestuario: its id, and the match it is about). When it is about this
   *  match, the card links down to it («Vota al MVP ↓») instead of showing a second ballot. */
  mvpBlock?: { id: string; matchId: string | undefined };
}

/** «J8 · Hoy · 12:00» / «J8 · En directo» / «J8 · Vota al MVP». */
function kicker(model: HoyModel, jornada: number | null, time: string): string {
  const j = jornada ? `J${jornada} · ` : "";
  const { phase, published, voteOpen } = model;
  if (phase === "scheduled") return `${j}Hoy · ${time}`;
  if (phase === "pending_whistle") return `${j}Hoy · ${PENDING_WHISTLE.toLowerCase()}`;
  if (phase === "live") return `${j}En directo`;
  if (phase === "halftime") return `${j}Descanso`;
  if (published) return `${j}${voteOpen ? "Final · vota al MVP" : "Final"}`;
  return `${j}Final · acta pendiente`;
}

export function HoyCard({ matches, players, now, rsvpId, className, variant, mvpBlock }: Props) {
  const viewer = useViewer();
  const me = useMe();
  const uid = viewer.member ? me?.uid : undefined;
  // (first without the board: which match, and which phase, decide what is read at all)
  const first = hoyModel(matches, viewer, now);
  const match = first?.match;
  const before = first?.stage === "before";
  const after = first?.stage === "after";
  const boardId = useMatchBoard(match?.seasonId, match?.id, !!match && toBePlayed(match, now), viewer.member && before);
  const board = useBoardView(before ? boardId : null);
  // (the whole stage before kick-off, not only while the convocatoria takes answers: waiting for the
  // whistle, a «Voy» given by hand over an absence still says he plays)
  const availability = useAvailability(before ? match?.id : undefined);
  const note = useMeetingNote(before ? match?.id : undefined);
  const mvp = useMvpResults().get(match?.id ?? "");
  const prediction = useMyPrediction(after ? match?.id : undefined, uid);
  // (the host's MVP block is about this match: the card points there, and says whether he has voted)
  const toBlock = after && !!mvpBlock && !!match && mvpBlock.matchId === match.id;
  const myVote = useMyMvpVote(toBlock ? match?.id : undefined, uid);
  // (the member's absences, before kick-off only: «Hoy no juegas: estás ausente»)
  const absences = useAbsences(madridDate(now), viewer.member && before);
  // (Turnos del equipo: whose turn it is in this match — members only, not while it is live)
  const rota = useMatchTurns(match, matches, viewer.member && !!first && first.stage !== "live");
  const titleId = useId();
  if (!first || !match) return null;

  const player = players.find((p) => p.id === viewer.playerId) ?? null;
  const answer = availability.data.find((a) => a.uid === uid)?.response;
  // away on the match's day, unless he has said «Voy» or «Duda» by hand over the absence
  const away = before && !!absenceOn(absences.data, { uid, playerId: viewer.playerId }, matchDay(dateMillis(match.date)));
  const absentToday = away && answer !== "yes" && answer !== "maybe";
  const nameOf = (id: string) => nameFor(players.find((p) => p.id === id), match.seasonId);
  const model = hoyModel(matches, viewer, now, { board, player, absentToday, turns: { list: rota.turns, nameOf } }) ?? first;
  const switchId = rsvpId ?? `${titleId}-rsvp`;
  const turnsChip = model.turns && (
    <p className={`tn-line${model.turns.mine ? " mine" : ""}`}>
      <RotaIcon icon={model.turns.icon} />
      <span>{model.turns.text}</span>
    </p>
  );
  const d = dateParts(match.date);
  const sb = scoreboardOf(match);
  const kit = kitLabel(match, KIT_LABEL.home);
  const jornada = jornadaOf(matches, match.id);
  // (a clock nobody started, past its window: nothing says it was played — no 0–0)
  const unplayed = model.phase === "awaiting_result" && !model.published && whistleAt(match) === null;
  // (the shared ballot when there is someone to vote; it takes only this member's vote — and not when the
  // host's own MVP block, on the same page, already has it)
  const ballot = !toBlock && model.voteOpen && !!uid && mvpCandidates(match.ledger, mvp?.counts, nameOf).length > 0;
  const blockLink = toBlock && model.voteOpen && mvpBlock ? mvpBlock.id : null;
  // (two columns on the wide card: always before kick-off, after it when the ballot sits beside the score)
  const two = model.stage === "before" || (model.stage === "after" && ballot);
  const classes = ["hoy", variant === "wide" && "hoy-wide", two && "hoy-two", className].filter(Boolean).join(" ");

  return (
    <section className={classes} aria-labelledby={titleId} data-stage={model.stage}>
      <span className="hm-kick hoy-kick">
        {model.stage === "live" && <i className="pt-dot" aria-hidden="true" />}
        {unplayed ? `${jornada ? `J${jornada} · ` : ""}${AWAITING_ACTA}` : kicker(model, jornada, d.time)}
      </span>
      {model.stage === "before" ? (
        <h2 className="hoy-t" id={titleId}>
          Manchester Piti <span className="hoy-vs">vs</span> {sb.rival}
        </h2>
      ) : (
        <h2 className="hoy-t hoy-score" id={titleId}>
          <span className="hm-sr">{unplayed ? `Manchester Piti contra ${sb.rival}` : `Manchester Piti ${sb.gf}, ${sb.rival} ${sb.ga}`}</span>
          <span aria-hidden="true">
            Piti{" "}
            {unplayed ? (
              <span className="hoy-vs">vs</span>
            ) : (
              <b>
                {sb.gf}–{sb.ga}
              </b>
            )}{" "}
            {sb.rival}
          </span>
        </h2>
      )}

      {model.stage === "before" && (
        <>
          <div className="hoy-col hoy-main">
            {model.starter && (
              <p className="hoy-starter">
                <Icon name="shirt" size={16} stroke={2.2} />
                {model.starter}
              </p>
            )}
            {turnsChip}
            {model.absent && (
              <div className="hoy-absent">
                <p>
                  <Icon name="cal" size={16} stroke={2.2} />
                  <b>Hoy no juegas: estás ausente</b>
                </p>
                {model.rsvpOpen && (
                  <button type="button" className="hoy-absent-go" onClick={() => toTarget(switchId, '[tabindex="0"]')}>
                    Cambiar mi respuesta
                  </button>
                )}
              </div>
            )}
            {model.rsvpOpen && <RsvpSwitch match={match} now={now} answer={answer} id={switchId} className="hoy-rsvp" />}
            <dl className="hoy-facts">
              <div>
                <dt>Saque</dt>
                <dd>
                  {d.time} · {match.venue || "Campo por confirmar"}
                </dd>
              </div>
              {note.data && (
                <div>
                  <dt>Quedada</dt>
                  <dd>{note.data}</dd>
                </div>
              )}
            </dl>
            <div className="hoy-seven">
              <span className="hm-kick">{model.seven.official ? "Siete oficial de la pizarra" : "Titulares de la convocatoria"}</span>
              {model.seven.field.length ? (
                <ol>
                  {model.seven.field.map((id) => (
                    <li key={id} className={id === viewer.playerId ? "me" : undefined}>
                      {nameOf(id)}
                      {id === viewer.playerId && <small> · tú</small>}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="hoy-note">El siete sale aquí en cuanto el capitán lo publique.</p>
              )}
            </div>
          </div>
          <div className="hoy-col hoy-side">
            {model.phase === "pending_whistle" ? (
              <p className="hoy-wait" role="status">
                <b>{d.time}</b> {PENDING_WHISTLE}
              </p>
            ) : (
              <Countdown target={dateMillis(match.date)} />
            )}
            <dl className="hoy-facts hoy-kit">
              <div>
                <dt>Equipación</dt>
                <dd>{kit}</dd>
              </div>
            </dl>
            <div className="pt-chips hoy-chips">
              <WeatherChip match={match} now={now} />
            </div>
            <div className="hoy-acts">
              <Link className="hm-btn" to="/matches/$matchId" params={{ matchId: match.id }}>
                Ver la previa <Icon name="arrow" size={16} stroke={2.2} />
              </Link>
              {match.venue && (
                <a className="hm-ghostbtn" href={mapsUrl(match.venue)} target="_blank" rel="noreferrer">
                  Cómo llegar <Icon name="arrow" size={16} stroke={2.2} />
                  <span className="hm-sr"> (se abre en otra pestaña)</span>
                </a>
              )}
            </div>
          </div>
        </>
      )}

      {model.stage === "live" && <Live match={match} now={now} halftime={model.phase === "halftime"} nameOf={nameOf} />}

      {model.stage === "after" && (
        <>
          <div className="hoy-col hoy-main">
            {turnsChip}
            {prediction.data && predictionsRevealed(match) && (
              <p className="hoy-porra">
                <Icon name="ball" size={16} />
                <span>
                  Tu porra: {prediction.data.goalsFor}–{prediction.data.goalsAgainst} ·{" "}
                  <b>
                    {scorePrediction(prediction.data, { goalsFor: sb.gf, goalsAgainst: sb.ga }, match.events ?? []).total} pts
                  </b>
                  {model.published ? "" : " provisionales"}
                </span>
              </p>
            )}
            <div className="hoy-acts">
              {blockLink ? (
                // (the vestuario: its own MVP block, further down the page, has the race and the ballot)
                <a
                  className={myVote.data ? "hm-ghostbtn" : "hm-btn"}
                  href={`#${blockLink}`}
                  onClick={(e) => {
                    e.preventDefault();
                    toTarget(blockLink);
                  }}
                >
                  {myVote.data ? "Ya has votado · ver la carrera" : "Vota al MVP"} <span aria-hidden="true">↓</span>
                </a>
              ) : model.voteOpen && !ballot ? (
                // (no ballot here — nobody to vote yet in the ledger: the match page's Vestuario tab has the vote)
                <Link className="hm-btn" to="/matches/$matchId" params={{ matchId: match.id }} search={{ tab: "vestuario" }}>
                  Vota al MVP <Icon name="arrow" size={16} stroke={2.2} />
                </Link>
              ) : (
                <Link className="hm-ghostbtn" to="/matches/$matchId" params={{ matchId: match.id }} search={model.voteOpen ? { tab: "vestuario" } : {}}>
                  {model.voteOpen ? "La carrera del MVP" : "Ver el partido"} <Icon name="arrow" size={16} stroke={2.2} />
                </Link>
              )}
            </div>
          </div>
          {ballot && (
            <div className="hoy-col hoy-side">
              <MvpBallot match={match} now={now} uid={uid} counts={mvp?.counts} nameOf={nameOf} total={mvp?.total ?? 0} className="hoy-ballot" />
            </div>
          )}
        </>
      )}
    </section>
  );
}

/**
 * To a part of the page (no slide under reduced motion), the focus with it: «Cambiar mi respuesta» to the
 * convocatoria switch (`focus`: its current answer), «Vota al MVP ↓» to the vestuario's MVP block (the
 * block itself, tabIndex -1).
 */
function toTarget(id: string, focus?: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const smooth = !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView?.({ behavior: smooth ? "smooth" : "auto", block: focus ? "center" : "start" });
  (focus ? el.querySelector<HTMLElement>(focus) : el)?.focus({ preventScroll: true });
}

/** «37′» on screen, «minuto 37» for a screen reader (the prime alone reads as a stray mark); before the
 *  clock runs (no minute yet) it reads 0. */
function Minute({ m: given }: { m: number | null }) {
  const m = given ?? 0;
  return (
    <>
      <span aria-hidden="true">{m}′</span>
      <span className="hm-sr">minuto {m}</span>
    </>
  );
}

/** Live: the minute (the shared clock when there is one), the bar, the last event and the way to the match. */
function Live({ match, now, halftime, nameOf }: { match: ClubMatch; now: number; halftime: boolean; nameOf: (id: string) => string }) {
  const play = livePlay(match, now, nameOf);
  return (
    <>
      <p className="hoy-minute">
        {halftime ? (
          <b>Descanso</b>
        ) : match.clock ? (
          <MatchClockDisplay match={match} />
        ) : (
          <b>
            <Minute m={play.minute} />
          </b>
        )}
      </p>
      <div className="pt-prog hoy-prog" aria-hidden="true">
        <i style={{ width: `${play.progress}%` }} />
      </div>
      <p className="hoy-last" aria-live="polite">
        {play.last ? (
          <>
            <b>
              <Minute m={play.last.minute} />
            </b>{" "}
            {eventLine(play.last)}
          </>
        ) : (
          "Arranca el partido"
        )}
      </p>
      <div className="hoy-acts">
        <Link className="hm-btn" to="/matches/$matchId" params={{ matchId: match.id }}>
          Seguir el partido <Icon name="arrow" size={16} stroke={2.2} />
        </Link>
      </div>
    </>
  );
}
