import { PorraHistory } from "../../components/celeste/PorraHistory";
import { PersonalMatchSummary } from "../../components/celeste/PersonalMatchSummary";
// The tabs of the match page. Public data comes from the acta (events, ledger); the Vestuario tab
// reads and writes the team's private bits (convocatoria, porra, MVP) only for members.
import { Fragment, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { EVENT_LABELS, dateMillis, isCompleted, playerForSeason, nameFor, type ClubMatch } from "../../lib/clubData";
import { useSeason } from "../../context/SeasonContext";
import { useTeam } from "../../context/TeamContext";
import { useAuth } from "../../context/AuthContext";
import { useDocumentTheme } from "../../hooks/useDocumentTheme";
import { useClock } from "../../hooks/useClock";
import { ShirtBack } from "../../components/celeste/ShirtBack";
import { Icon } from "../../components/celeste/icons";
import { PredictionResult } from "../../components/celeste/PredictionForm";
import { predictionOpen, predictionsRevealed, scorePrediction } from "../../../functions/src/predictions";
import { MatchBadges } from "../../components/celeste/MatchBadges";
import { Jersey3D } from "../../components/jersey3d/Jersey3D";
import { useShirtStills } from "../../components/jersey3d/useShirtStills";
import { chapters, keyNumbers, matchSnapshot, playerLine, pulse, stintRows } from "../../lib/ficha";
import { dateParts, eventMinute, exchangeMinute, scoreOf } from "../../lib/partidos";
import { useAbsences, useAvailability, useMatchPredictions, useMeetingNote, useMvpResults, useMvpResultsSync, useMvpReveal, useMyPrediction } from "../vestuario/live";
import { absentBadge, madridDate, matchDay } from "../../lib/derived/absences";
import "../../styles/aus-badge.css";
import { mvpAnnouncement, mvpRace, plural, voteLeft } from "../../lib/vestuario";
import { useMe } from "../vestuario/writes";
import { rsvpSummary } from "../../lib/rsvp";
import type { PlayerDoc } from "../../lib/schemas";
import { fmtMinutes, wholeMinutes } from "../../lib/derived/minutes";
import { nameSegments, type NameSegment } from "../../lib/derived/names";
import { PlayerLink } from "../../components/celeste/PlayerLink";
import { guestOf, isGuestId } from "../../lib/derived/guests";
import { Who } from "./Who";
import "./guests.css";
import { campoSeven, campoSevenNote } from "./campoSeven";
import { campoLayout, SOURCE_TEXT } from "./campoPositions";
import { systemMark, systemText } from "../../lib/derived/system";
import { POSITIONS } from "../../lib/positions";
import { playedLinesOf, playedSummary } from "../../lib/playedSummary";
import type { BoardView } from "../pizarra/useMatchBoard";
import type { RivalSeven } from "../pizarra/v2/rival";
import { RivalLine, RivalSection } from "./RivalDossier";
import { rivalDossier } from "../../lib/derived/rival";
import { RsvpSwitch } from "../vestuario/shared/RsvpSwitch";
import { PorraCard } from "../vestuario/shared/PorraCard";
import { MvpBallot } from "../vestuario/shared/MvpBallot";

type NameOf = (id: string) => string;
const OURS = new Set(["goal", "goal_penalty", "goal_freekick", "opponent_own_goal"]);

function useNumOf(players: PlayerDoc[], seasonId?: string) {
  const { seasons } = useSeason();
  return (id: string) => {
    const p = players.find((x) => x.id === id);
    if (!p) return "";
    const n = playerForSeason(p, seasonId ?? "all", seasons).number;
    return n != null ? String(n) : "";
  };
}

/** A crónica line with each player it names as a quiet link to his page. */
function Named({ segments, seasonId }: { segments: NameSegment[]; seasonId?: string }) {
  return (
    <>
      {segments.map((s, i) =>
        s.id ? (
          <Who key={i} id={s.id} seasonId={seasonId}>
            {s.text}
          </Who>
        ) : (
          s.text
        ),
      )}
    </>
  );
}

/** «ERIK», «ERIK y PABLO»…, each a link to his page in the match's season. */
function NameList({ ids, seasonId, nameOf }: { ids: readonly string[]; seasonId?: string; nameOf?: NameOf }) {
  return (
    <>
      {ids.map((id, i) => (
        <Fragment key={id}>
          {i === 0 ? "" : i === ids.length - 1 ? " y " : ", "}
          {isGuestId(id) ? (nameOf?.(id) ?? "Invitado") : <PlayerLink id={id} seasonId={seasonId} variant="quiet" />}
        </Fragment>
      ))}
    </>
  );
}

export function CronicaTab({ match, matches, players, nameOf }: { match: ClubMatch; matches: ClubMatch[]; players: PlayerDoc[]; nameOf: NameOf }) {
  const numOf = useNumOf(players, match.seasonId);
  const rival = match.rival ?? "Rival";
  const story = chapters(match.events, nameOf, rival, scoreOf(match));
  // «El rival»: this match is one of the meetings now (rivalDossier counts finished ones); a match that
  // names no rival has no dossier
  const dossier = useMemo(() => rivalDossier(matches, match.rival), [matches, match.rival]);
  return (
    <>
      <div>
        {match.rival && <RivalLine match={match} dossier={dossier} />}
        {match.report && (
          <section className="fc-sec fc-reveal" aria-labelledby="fc-rep">
            <span className="hm-kick">Así lo vivimos</span>
            <h2 className="hm-h2" id="fc-rep">
              La crónica
            </h2>
            <p className="fc-report">{match.report}</p>
          </section>
        )}
        {match.photoUrl && <img className="fc-photo" src={match.photoUrl} alt={`Manchester Piti contra ${rival}`} />}
        {story.length > 1 ? (
          story.map((c, i) => {
            // each name is linked once: in the sentence, or in the title when the sentence doesn't say it
            const people = (c.people ?? []).map((id) => ({ id, name: nameOf(id) }));
            const text = nameSegments(c.text, people);
            const inText = new Set(text.map((x) => x.id));
            const title = nameSegments(c.title, people.filter((x) => !inText.has(x.id)));
            return (
              <article key={i} className={`fc-ch ${c.side}`}>
                {c.minute != null && (
                  <span className="min" aria-hidden="true">
                    {c.minute}′
                  </span>
                )}
                <div className="tx">
                  <span className="hm-kick" style={{ margin: 0 }}>
                    {c.minute != null ? `Minuto ${c.minute}` : "Pitido final"}
                  </span>
                  <h3>
                    <Named segments={title} seasonId={match.seasonId} />
                  </h3>
                  <p>
                    <Named segments={text} seasonId={match.seasonId} />
                  </p>
                </div>
                {c.side !== "end" && (
                  <div className="sb">
                    {c.playerId ? (
                      <ShirtBack name={(guestOf(match, c.playerId)?.name ?? nameOf(c.playerId)).toUpperCase()} num={isGuestId(c.playerId) ? "INV" : numOf(c.playerId)} />
                    ) : (
                      <span className="ball">
                        <Icon name="ball" size={34} />
                      </span>
                    )}
                  </div>
                )}
              </article>
            );
          })
        ) : (
          <p className="fc-note">{match.version === 2 ? "No se registraron goles ni jugadas destacadas en el acta." : "Este partido pertenece al archivo anterior: su acta no tiene minuto a minuto."}</p>
        )}
      </div>
      <div>
        {match.gallery && match.gallery.length > 0 && (
          <section className="fc-sec fc-reveal" aria-labelledby="fc-gal">
            <span className="hm-kick">Fotos del partido</span>
            <h2 className="hm-h2" id="fc-gal">
              La galería
            </h2>
            <div className="fc-gal">
              {match.gallery.map((url, i) => (
                <img key={url} src={url} alt={`Foto ${i + 1} del partido`} loading="lazy" />
              ))}
            </div>
          </section>
        )}
        {match.rival && <RivalSection match={match} dossier={dossier} />}
      </div>
    </>
  );
}

/** `plan`: the pizarra's notes on the rival (RivalPanel, this match's official board) — members only: the
 *  match page reads that board only for them and passes nothing to a fan. */
export function PreviaTab({ match, matches, plan = null }: { match: ClubMatch; matches: ClubMatch[]; plan?: RivalSeven | null }) {
  const theme = useDocumentTheme();
  // «El rival»: the meetings so far (this one is still to be played: rivalDossier counts finished ones)
  const dossier = useMemo(() => rivalDossier(matches, match.rival), [matches, match.rival]);
  const d = dateParts(match.date);
  const kit = match.kit === "away" ? "away" : "home";
  return (
    <div className="fc-two">
      <section className="fc-sec fc-reveal" aria-labelledby="fc-kit">
        <span className="hm-kick">La equipación del partido · gírala</span>
        <h2 className="hm-h2" id="fc-kit">
          Se juega con la {kit === "away" ? "2ª" : "1ª"}
        </h2>
        <div className="fc-kit">
          <Jersey3D kit={kit} theme={theme} name="PITI" num="" label={`La ${kit === "away" ? "2ª" : "1ª"} equipación del Manchester Piti en 3D. Arrástrala para girarla.`} />
          <span>{match.home === false ? `${match.rival ?? "El rival"} juega en casa` : "Jugamos en casa"}</span>
        </div>
      </section>
      <div>
        <section className="fc-sec fc-reveal" aria-labelledby="fc-plan">
          <span className="hm-kick">El día del partido</span>
          <h2 className="hm-h2" id="fc-plan">
            El plan
          </h2>
          <ol className="fc-plan">
            <li>
              <b>—</b>
              <span>
                Quedada
                <small>La hora la ve el equipo en la pestaña Vestuario</small>
              </span>
            </li>
            <li>
              <b>{d.time}</b>
              <span>
                Pitido inicial
                <small>{match.duration ? `${match.duration} minutos` : "Fútbol 7"}</small>
              </span>
            </li>
            <li>
              <b>Final</b>
              <span>
                Se abre el voto del MVP
                <small>48 horas, en esta misma página</small>
              </span>
            </li>
          </ol>
        </section>
        {match.rival && <RivalSection match={match} dossier={dossier} plan={plan} />}
      </div>
    </div>
  );
}

export function DirectoTab({ match, nameOf, live = true }: { match: ClubMatch; nameOf: NameOf; live?: boolean }) {
  const rival = match.rival ?? "Rival";
  const feed = [...(match.events ?? [])].filter((e) => typeof e.minute === "number" && e.type !== "match_played").sort((a, b) => (b.minute ?? 0) - (a.minute ?? 0));
  return (
    <>

    <section className="fc-sec" aria-labelledby="fc-live">
      <span className="hm-kick">{live ? "Desde el acta · se actualiza solo" : "Registro provisional · pendiente de revisión del administrador"}</span>
      <h2 className="hm-h2" id="fc-live">
        Lo que va pasando
      </h2>
      {feed.length ? (
        <ol className="fc-feed" aria-live="polite">
          {feed.map((e) => {
            const us = OURS.has(e.type) || e.type === "chance" || e.type === "corner";
            const whoId = e.type.startsWith("opponent_") ? undefined : e.type === "substitution" && e.inPlayerId ? e.inPlayerId : e.playerId;
            const who = e.type.startsWith("opponent_") ? rival : whoId ? nameOf(whoId) : "Manchester Piti";
            return (
              <li key={e.id} className={us ? "us" : ""}>
                <b>{eventMinute(e) ?? e.minute}′</b>
                <span className="ic">{/yellow|red/.test(e.type) ? <i className="fc-yc" style={e.type !== "yellow_card" ? { background: "#ff5a4f" } : undefined} /> : <Icon name={/goal/.test(e.type) ? "ball" : e.type === "substitution" ? "swap" : e.type === "assist" ? "boot" : "flag"} size={15} />}</span>
                <span>
                  <strong>{whoId ? <Who id={whoId} seasonId={match.seasonId}>{who}</Who> : who}</strong>
                  <small>
                    {EVENT_LABELS[e.type] ?? e.type}
                    {e.assistPlayerId && <> · <Icon name="boot" size={13} /> asistencia de <Who id={e.assistPlayerId} seasonId={match.seasonId}>{nameOf(e.assistPlayerId)}</Who></>}
                    {e.type === "substitution" && e.playerId ? <> · sale <Who id={e.playerId} seasonId={match.seasonId}>{nameOf(e.playerId)}</Who></> : ""}
                  </small>
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="fc-note">Aún no hay nada en el acta. Cada gol, tarjeta o cambio aparece aquí en cuanto se apunta.</p>
      )}
    </section>
    </>
  );
}

/**
 * El siete. `official` (members only: the pizarra's official for this match, useBoardView) goes on the
 * pitch before the acta, with its «Siete oficial de la pizarra» badge and a note when the convocatoria has
 * another seven, at its slots' positions and with its system (`board`); fans (and every match once played
 * or live) see the convocatoria's titulares. After the acta each one stands where he played
 * (campoPositions); live, and without position data, the orientative 1-3-2-1.
 */
export function CampoTab({ match, players, nameOf, live, official = null, board = null }: { match: ClubMatch; players: PlayerDoc[]; nameOf: NameOf; live: boolean; official?: readonly string[] | null; board?: Pick<BoardView, "system" | "codes"> | null }) {
  const numOf = useNumOf(players, match.seasonId);
  const [sel, setSel] = useState<string | null>(null);
  const done = isCompleted(match);
  const seven = campoSeven(match, done || live ? null : official);
  const starters = seven.field;
  const note = campoSevenNote(seven.differs, nameOf);
  const now = useClock(1000);
  const snapshot = matchSnapshot(match, now);
  const ledger = done ? match.ledger : snapshot.players;
  const field = live ? snapshot.field : starters;
  const bench = live ? [...starters, ...(match.bench ?? [])].filter((id) => !field.includes(id)) : seven.bench;
  // where they stand: the acta's positions once played; before it, the official board's (members)
  const preActa = !done && !live;
  const officialBoard = preActa && seven.official ? board : null;
  // (before the acta, only over the official board's own drawing: never over the orientative 1-3-2-1)
  const system = done ? match.system : officialBoard ? officialBoard.system : null;
  const layout = campoLayout({ field, ledger: done ? match.ledger : null, system, codes: officialBoard?.codes ?? null });
  const systemChip = systemText(system);
  const placed = layout.source !== "orientative";
  const subDots = layout.dots.filter((d) => d.sub);
  const pick = sel ?? starters[0];
  const line = pick ? playerLine(pick, ledger, match.events) : null;
  const pickPlayed = done && pick ? playedLinesOf(match.ledger?.[pick]?.positionsPlayed) : [];
  const rows = done || live ? stintRows(ledger, match.events, match.duration ?? 50) : [];
  if (!starters.length)
    return (
      <section className="fc-sec">
        <h2 className="hm-h2">El siete</h2>
        <p className="fc-note">{match.version === 2 ? "La convocatoria se publica con el acta." : "Este partido pertenece al archivo anterior: no se registró la convocatoria."}</p>
      </section>
    );
  return (
    <div className="fc-two">
      <section className="fc-sec" aria-labelledby="fc-xi">
        <span className="hm-kick">{live ? "En el campo ahora · toca a un jugador" : "Los siete titulares · toca a uno"}</span>
        <h2 className="hm-h2" id="fc-xi">
          {done ? "Quién hizo qué" : live ? "El campo, ahora" : "El siete"}
        </h2>
        {(seven.official || systemChip || placed) && (
          <p className="fc-official">
            {seven.official && (
              <span className="fc-official-badge">
                <Icon name="shirt" size={14} />
                Siete oficial de la pizarra
              </span>
            )}
            {systemChip && (
              <span className="fc-sys">
                <small>Sistema</small> {systemChip}
              </span>
            )}
            {placed && !seven.official && <span className="fc-src">{SOURCE_TEXT[layout.source]}</span>}
            {note && <span className="fc-official-note">{note}</span>}
          </p>
        )}
        <div className="fc-pitch">
          <span className="l mid" />
          <span className="l circ" />
          <span className="l bx1" />
          <span className="l bx2" />
          {placed && systemMark(system) && (
            <span className="fc-pitch-sys" aria-hidden="true">
              {systemMark(system)}
            </span>
          )}
          {layout.dots.map((d) => {
            const stats = playerLine(d.id, ledger, match.events);
            const entry = d.sub ? match.ledger?.[d.id]?.exchanges?.find((x) => x.direction === "in") : undefined;
            // (the position he played — or, before the acta, his slot on the board — never where the dot was nudged to)
            const pos = d.code ? POSITIONS[d.code].name.toLocaleLowerCase("es") : "";
            const where = !d.code ? "" : preActa ? `, en la pizarra: ${pos}` : `, ${d.sub ? `entró${entry ? ` en el ${exchangeMinute(match.events, d.id, entry)}′` : ""} y jugó` : "jugó"} de ${pos}${d.estimated ? " (estimado por su preferida)" : ""}`;
            // a guest: his name and «Inv.» where the dorsal goes, with the dashed ring (guests.css)
            const guest = guestOf(match, d.id);
            const isGuest = isGuestId(d.id);
            return (
              <button key={d.id} type="button" className={`fc-pl${d.sub ? " sub" : ""}${isGuest ? " guest" : ""}`} style={{ left: `${d.x}%`, top: `${d.y}%` }} aria-pressed={pick === d.id} onClick={() => setSel(d.id)} aria-label={`${nameOf(d.id)}, ${isGuest ? "invitado" : `dorsal ${numOf(d.id)}`}${where}, ${stats.goals} goles, ${stats.assists} asistencias, ${stats.yellowCards} amarillas, ${stats.redCards} rojas`}>
                <span className="fc-number">{isGuest ? "Inv." : numOf(d.id)}</span>
                <b>{isGuest ? (guest?.name ?? "Invitado") : nameOf(d.id)}</b>
                <MatchBadges {...stats} />
              </button>
            );
          })}
        </div>
        {bench.length > 0 && (
          <div className="fc-dugout">
            <span className="hm-kick">{live ? "Fuera del campo · banquillo y expulsados" : "Suplentes · también cuentan"}</span>
            <ul className="fc-bench">
              {bench.map((id) => {
                const p = ledger?.[id];
                const stats = playerLine(id, ledger, match.events);
                const entry = p?.exchanges?.find((x) => x.direction === "in");
                return <li key={id} className={[p?.played ? "in" : "", isGuestId(id) ? "guest" : ""].filter(Boolean).join(" ") || undefined}>
                  <button type="button" onClick={() => setSel(id)} aria-pressed={pick === id}>
                    <b>{isGuestId(id) ? "Inv." : numOf(id)}</b>
                    <span className="fc-bench-name">{nameOf(id)}<small>{p?.dismissed ? "Expulsado · " : ""}{p ? `${fmtMinutes(p.minutes)}${entry ? ` · entró ${exchangeMinute(match.events, id, entry)}′` : p.played ? "" : done ? " · no jugó" : " · sin entrar"}` : "Minutos sin registrar"}</small></span>
                    <MatchBadges {...stats} />
                  </button>
                </li>;
              })}
            </ul>
          </div>
        )}
        {line && pick && (
          <dl className="fc-pinfo">
            <span className="nm">
              {isGuestId(pick) ? "Inv." : numOf(pick)} · <Who id={pick} seasonId={match.seasonId}>{nameOf(pick)}</Who>
            </span>
            {pickPlayed.length > 0 && (
              <span className="pos">
                Jugó de {playedSummary({ lines: pickPlayed })}
                {match.ledger?.[pick]?.positionsEstimated === true ? " · estimado por su preferida" : ""}
              </span>
            )}
            <div>
              <dt>min</dt>
              <dd>{ledger?.[pick] ? wholeMinutes(line.minutes) : "–"}</dd>
            </div>
            <div>
              <dt>goles</dt>
              <dd>{line.goals}</dd>
            </div>
            <div>
              <dt><Icon name="boot" size={13} /> asist.</dt>
              <dd>{line.assists}</dd>
            </div>
            <div>
              <dt>tarjetas</dt>
              <dd>{line.cards}</dd>
            </div>
          </dl>
        )}
        <p className="fc-note">
          {placed ? "" : "Posiciones orientativas. "}
          {live ? "Los cambios y las expulsiones actualizan el campo. Minutos provisionales hasta publicar el acta." : preActa && placed ? "Cada uno, en su casilla de la pizarra." : "Minutos calculados desde el siete inicial y cada entrada y salida."}
          {subDots.length > 0 && " Con anillo, quien entró desde el banquillo y jugó en otra posición."}
        </p>
      </section>
      {rows.length > 0 && (
        <section className="fc-sec fc-reveal" aria-labelledby="fc-st">
          <span className="hm-kick">Quién estuvo en el campo y cuándo</span>
          <h2 className="hm-h2" id="fc-st">
            Los minutos de cada uno
          </h2>
          <div className="fc-stints">
            <div className="hd" aria-hidden="true">
              <span />
              <span>
                <i>0′</i>
                <i>{Math.round((match.duration ?? 50) / 2)}′</i>
                <i>{match.duration ?? 50}′</i>
              </span>
              <span />
            </div>
            {rows.map((r, i) => (
              <div className="r" key={r.id}>
                <span className="nm">
                  {isGuestId(r.id) ? "Inv." : numOf(r.id)} · <Who id={r.id} seasonId={match.seasonId}>{nameOf(r.id)}</Who>
                </span>
                <span className="tr" role="img" aria-label={`${nameOf(r.id)}: ${wholeMinutes(r.minutes)} minutos`}>
                  {r.spans.map((s, k) => (
                    <i key={k} style={{ left: `${s.left}%`, width: `${s.width}%`, animationDelay: `${(i * 0.06).toFixed(2)}s` }} />
                  ))}
                  {r.goals.map((g, k) => (
                    <b key={k} style={{ left: `${g}%` }} />
                  ))}
                </span>
                <span className="m">{fmtMinutes(r.minutes)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function PulsoTab({ match, live, minute, pending = false }: { match: ClubMatch; live: boolean; minute: number | null; pending?: boolean }) {
  const duration = match.duration ?? 50;
  const started = live || isCompleted(match) || pending;
  const bars = pulse(match.events, duration, live ? (minute ?? 0) : started ? duration : 0);
  const k = keyNumbers(match.events);
  const { gf, ga } = scoreOf(match);
  return (
    <section className="fc-sec" aria-labelledby="fc-pu">
      <span className="hm-kick">Minuto a minuto, desde el acta</span>
      <h2 className="hm-h2" id="fc-pu">
        {started ? "El pulso del partido" : "Se llena durante el partido"}
      </h2>
      <div className="fc-mom" role="img" aria-label={`Pulso del partido minuto a minuto: arriba el Piti, abajo ${match.rival ?? "el rival"}`}>
        {bars.map((b, i) => (
          <span key={b.minute} className={`c${b.played ? "" : " off"}`}>
            <span className="u" style={{ height: `${Math.round(b.us * 0.88)}px`, animationDelay: `${(i * 0.012).toFixed(3)}s` }} />
            <span className="t" style={{ height: `${Math.round(b.them * 0.88)}px`, animationDelay: `${(i * 0.012).toFixed(3)}s` }} />
          </span>
        ))}
      </div>
      <div className="fc-axis" aria-hidden="true">
        <span>0′</span>
        <span>{Math.round(duration / 2)}′</span>
        <span>{duration}′</span>
      </div>
      <dl className="fc-kpis">
        <div>
          <dt>marcador</dt>
          <dd>{started ? `${gf}–${ga}` : "–"}</dd>
        </div>
        <div>
          <dt>penaltis parados</dt>
          <dd>{started ? k.saves : "–"}</dd>
        </div>
        <div>
          <dt>palos</dt>
          <dd>{started ? k.woodwork : "–"}</dd>
        </div>
        <div>
          <dt>tarjetas</dt>
          <dd>{started ? k.cards : "–"}</dd>
        </div>
      </dl>
      <dl className="fc-attacks" aria-label="Ocasiones y córners registrados">
        <div><dd>{started ? k.chances : "–"}</dd><dt>Ocasiones</dt><dd>{started ? k.opponentChances : "–"}</dd></div>
        <div><dd>{started ? k.corners : "–"}</dd><dt>Córners</dt><dd>{started ? k.opponentCorners : "–"}</dd></div>
      </dl>
      <p className="fc-note">Piti a la izquierda · {match.rival ?? "rival"} a la derecha. Solo se cuentan las ocasiones y los córners registrados; un cero puede significar que aún no se han apuntado.</p>
      <p className="fc-note">Cada barra es un minuto: arriba el Piti, abajo {match.rival ?? "el rival"}. Es un indicador de actividad a partir de goles, ocasiones, córners, palos, penaltis y tarjetas; no mide la posesión{live ? " y se actualiza durante el partido" : ""}.</p>
    </section>
  );
}

export function VestuarioTab({ match, matches = [match], players, phase }: { match: ClubMatch; matches?: ClubMatch[]; players: PlayerDoc[]; phase: string }) {
  const { member } = useTeam();
  const { user } = useAuth();
  const me = useMe();
  // (the server's clock; it also ticks the moment the MVP vote closes, so the race turns into the reveal then)
  const now = useClock(30_000, match.voteClosesAt ? [match.voteClosesAt] : []);
  const theme = useDocumentTheme();
  const numOf = useNumOf(players, match.seasonId);
  const nameOf = (id: string) => nameFor(players.find((p) => p.id === id), match.seasonId);
  const uid = member ? user?.uid : undefined;
  const kickedOff = phase !== "scheduled" && phase !== "unscheduled";
  const availability = useAvailability(member && !kickedOff ? match.id : undefined);
  // (the team's absences, while the convocatoria shows: «Ausente · hasta 19 oct» on those «No puedo»)
  const absences = useAbsences(madridDate(now), !!member && !kickedOff);
  const note = useMeetingNote(member ? match.id : undefined);
  const myPrediction = useMyPrediction(match.id, uid);
  const predictions = useMatchPredictions(match.id, !!member && predictionsRevealed(match));
  const mvp = useMvpResults().get(match.id);
  const done = isCompleted(match);
  const { gf, ga } = scoreOf(match);

  // The MVP: the live race while the vote is open (counts only, never who voted whom), the winners once closed.
  const race = mvpRace(match.voteClosesAt, mvp, now);
  const open = race.state === "open";
  const heads = open ? race.leaders : race.winners;
  const headVotes = heads.length ? (mvp?.counts[heads[0]] ?? 0) : 0;
  const reveal = useMvpReveal({ id: match.id, open, winner: done && race.winners.length > 0, closesAt: match.voteClosesAt, now });
  const { stale: mvpStale } = useMvpResultsSync();
  const leader = heads.length === 1 ? heads[0] : undefined;
  const leaderShot = leader ? [{ kit: "home" as const, theme, name: nameOf(leader).toUpperCase(), num: numOf(leader) }] : [];
  const still = useShirtStills(leaderShot, { offMainThread: true });
  const leaderStill = leaderShot[0] && still(leaderShot[0]);
  const closesIn = match.voteClosesAt ? voteLeft(match.voteClosesAt, now) : "";

  if (!member || !me)
    return (
      <section className="fc-sec">
        <span className="hm-kick">Solo para el equipo</span>
        <h2 className="hm-h2">El vestuario</h2>
        {/* (not from a tally that may be out of date: offline, or it lost the server) */}
        {done && match.voteClosesAt != null && heads.length > 0 && !mvpStale && (
          <p className="fc-note">
            {open ? (
              <>
                La carrera del MVP: <NameList ids={heads} seasonId={match.seasonId} /> {heads.length > 1 ? "van empatados" : "va primero"} con {plural(headVotes, "voto", "votos")}. Cierra en {closesIn}.
              </>
            ) : (
              <>
                {heads.length > 1 ? "MVP compartido" : "MVP"}: <NameList ids={heads} seasonId={match.seasonId} /> con {headVotes} de {plural(race.total, "voto", "votos")}.
              </>
            )}
          </p>
        )}
        <div className="fc-lock">
          <Icon name="padlock" size={18} />
          <span>
            Convocatoria, quedada, porra y voto del MVP son del vestuario. <Link to="/vestuario">Entrar al vestuario</Link>
          </span>
        </div>
      </section>
    );

  const mine = availability.data.find((a) => a.uid === me.uid)?.response;
  // («Sin responder» counts too: the convocados who haven't said anything yet)
  const counts = rsvpSummary(availability.data, [...(match.starters ?? []), ...(match.bench ?? [])]);
  const total = counts.yes + counts.maybe + counts.no + counts.sin;
  const day = matchDay(dateMillis(match.date));
  const away = availability.data.flatMap((a) => {
    const badge = absentBadge(a, absences.data, day);
    return badge ? [{ a, badge }] : [];
  });
  const exact = predictions.data.filter((p) => p.goalsFor === gf && p.goalsAgainst === ga).length;
  const dist = new Map<string, number>();
  for (const p of predictions.data) dist.set(`${p.goalsFor}–${p.goalsAgainst}`, (dist.get(`${p.goalsFor}–${p.goalsAgainst}`) ?? 0) + 1);
  const top = [...dist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topMax = Math.max(1, ...top.map(([, n]) => n));
  const porraTable = predictions.data.map((p) => ({ ...p, points: scorePrediction(p, { goalsFor: gf, goalsAgainst: ga }, match.events ?? []).total })).sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, "es"));

  return (
    <div className="fc-two">
      {done && <PersonalMatchSummary match={match} matches={matches} playerId={me.playerId} uid={me.uid} />}
      {done && match.seasonId && <PorraHistory matches={matches} seasonId={match.seasonId} uid={me.uid}/>}
      {!kickedOff && (
        <>
          <section className="fc-sec" aria-labelledby="fc-rs">
            <span className="hm-kick">Convocatoria</span>
            <h2 className="hm-h2" id="fc-rs">
              ¿Vas?
            </h2>
            {/* (the shared member controls: the same answer, porra and vote — and writes — as the vestuario) */}
            <RsvpSwitch match={match} now={now} answer={mine} />
            {note.data && (
              <div className="pt-chips" style={{ justifyContent: "flex-start" }}>
                <span className="pt-chip">{note.data}</span>
              </div>
            )}
            {total > 0 && (
              <div className="fc-conv">
                <div className="bar" aria-hidden="true">
                  <i style={{ width: `${(counts.yes / total) * 100}%`, background: "#6CABDD" }} />
                  <i style={{ width: `${(counts.maybe / total) * 100}%`, background: "#FFC659" }} />
                  <i style={{ width: `${(counts.no / total) * 100}%`, background: "var(--muted)" }} />
                </div>
                <small>{counts.txt}</small>
              </div>
            )}
            {away.length > 0 && (
              <ul className="aus-away" aria-label="Ausentes">
                {away.map(({ a, badge }) => (
                  <li key={a.uid}>
                    <span className="nm">{a.playerId ? nameOf(a.playerId) : a.name}</span>
                    <span className="aus-badge">
                      <Icon name="cal" size={13} stroke={2.2} />
                      {badge}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
      <section className="fc-sec" aria-labelledby="fc-po">
        <span className="hm-kick">Tu porra · {predictionOpen(match) ? "hasta el pitido inicial" : "cerrada"}</span>
        <h2 className="hm-h2" id="fc-po">{predictionOpen(match) ? "¿Cómo acaba?" : "Tu pronóstico"}</h2>
        {predictionOpen(match) ? <PorraCard match={match} players={players} uid={me.uid} /> : myPrediction.data && predictionsRevealed(match) ? <PredictionResult prediction={myPrediction.data} match={match} players={players} provisional={!done} /> : <p className="fc-note">{myPrediction.data ? "La porra no está disponible para este partido. No se asignan puntos mientras esté aplazado o cancelado." : "No guardaste una porra para este partido."}</p>}
      </section>
      {predictionsRevealed(match) && porraTable.length > 0 && <section className="fc-sec" aria-labelledby="fc-points">
        <span className="hm-kick">{done ? "Puntos de la jornada" : "Clasificación provisional"}</span><h2 className="hm-h2" id="fc-points">La porra del equipo</h2>
        <ol className="pr-ranking">{porraTable.map((p) => <li key={p.uid} className={p.uid === me.uid ? "mine" : undefined}><span>{p.name}{p.uid === me.uid ? " · tú" : ""}<small>{p.goalsFor}–{p.goalsAgainst}</small></span><strong>{p.points} <small>pts</small></strong></li>)}</ol>
        {!done && <p className="fc-note">Según las jugadas anotadas hasta ahora. El acta publicada confirma los puntos.</p>}
      </section>}
      {done && (
        <>
          {match.voteClosesAt != null && (
            <section className="fc-sec" aria-labelledby="fc-mvp">
              <article className={`fc-mvp${reveal ? " won" : ""}`}>
                <div className="sh">{leaderStill ? <img src={leaderStill} alt="" /> : leader ? <ShirtBack name={nameOf(leader).toUpperCase()} num={numOf(leader)} /> : <ShirtBack name="MVP" num="?" />}</div>
                <div>
                  <span className="hm-kick" style={{ margin: 0 }}>
                    {open ? `La carrera del MVP · Cierra en ${closesIn}` : `${race.winners.length > 1 ? "MVP compartido" : "MVP"} · votación cerrada`}
                  </span>
                  <h2 className="hm-h2" id="fc-mvp">
                    {heads.length ? <NameList ids={heads} seasonId={match.seasonId} /> : open ? "Sin votos todavía" : "Sin MVP"}
                  </h2>
                  <p>
                    {open
                      ? race.total
                        ? `${plural(race.total, "voto", "votos")} del equipo${heads.length > 1 ? " · empate en cabeza" : ""}.`
                        : "Nadie ha votado aún."
                      : heads.length
                        ? `${headVotes} de ${plural(race.total, "voto", "votos")}${heads.length > 1 ? " · lo comparten" : ""}.`
                        : "No hubo votos en este partido."}
                  </p>
                </div>
              </article>
              <p className="sr-only" aria-live="polite">
                {mvpAnnouncement(race, heads.map(nameOf))}
              </p>
              {mvpStale && <p className="fc-note">Sin conexión: puede faltar algún voto en el recuento.</p>}
              {race.rows.length > 0 && (
                <ol className={`fc-votes fc-race${open ? " open" : ""}`} aria-label={open ? "La carrera del MVP" : "El podio del MVP"}>
                  {race.rows.map((r) => (
                    <li key={r.playerId}>
                      <span>
                        <span className="rk">{r.rank}.º</span>
                        {r.shared && <span className="sr-only">, empatado, </span>} <PlayerLink id={r.playerId} seasonId={match.seasonId} variant="quiet" />
                      </span>
                      <span className="bar" aria-hidden="true">
                        <i style={{ width: `${(r.votes / race.rows[0].votes) * 100}%` }} />
                      </span>
                      <b>
                        {r.votes}
                        <span className="sr-only"> {r.votes === 1 ? "voto" : "votos"}</span>
                      </b>
                    </li>
                  ))}
                </ol>
              )}
              <MvpBallot match={match} now={now} uid={uid} counts={mvp?.counts} nameOf={nameOf} />
            </section>
          )}
          <section className="fc-sec" aria-labelledby="fc-pr">
            <span className="hm-kick">La porra de la jornada</span>
            <h2 className="hm-h2" id="fc-pr">
              {predictions.data.length ? `${exact} de ${predictions.data.length} clavaron el ${gf}–${ga}` : "Nadie hizo porra"}
            </h2>
            {top.length > 0 && (
              <ul className="fc-votes">
                {top.map(([res, n]) => (
                  <li key={res}>
                    <span>{res}</span>
                    <span className="bar">
                      <i style={{ width: `${(n / topMax) * 100}%`, background: res === `${gf}–${ga}` ? "#FFC659" : "var(--accent)" }} />
                    </span>
                    <b>{n}</b>
                  </li>
                ))}
              </ul>
            )}
            {myPrediction.data && (
              <p className="fc-note">
                Tú dijiste {myPrediction.data.goalsFor}–{myPrediction.data.goalsAgainst}.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
