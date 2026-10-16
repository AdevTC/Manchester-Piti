import { MatchClockDisplay } from "../../components/celeste/MatchClockControl";
import { Link } from "@tanstack/react-router";
import { AddToCalendar } from "../../components/celeste/AddToCalendar";
import { Icon } from "../../components/celeste/icons";
import { ShirtBack } from "../../components/celeste/ShirtBack";
import { dateMillis } from "../../lib/clubData";
import { opponentInitials } from "../../lib/clubAnalytics";
import { countdownParts, matchEvent, type Moment, type Narrative, type Pulse } from "../../lib/home";
import { kickoffLabel } from "../../lib/vestuario";
import { scoreOf } from "../../lib/partidos";
import { AWAITING_ACTA, kickoffState, PENDING_WHISTLE } from "../../lib/derived/kickoff";
import { resultLetter, resultTitle } from "../../lib/derived/result";
import { kitLabel, siteOrigin } from "../../lib/derived/venue";

interface Props {
  story: Narrative;
  pulse: Pulse;
  now: number;
  moment: Moment | null;
  /** Photo of the real kit for the player of the moment (back only, loads at once). */
  momentStill?: string;
}

/** The home is match day: the next (or live) game on the left, the one player of the moment on the right. */
export function MatchHero({ story, pulse, now, moment, momentStill }: Props) {
  // The server render has no location; the browser fills in the absolute links once it takes over.
  const origin = siteOrigin();
  // A result's story must never headline a different (future) fixture. Each hero state
  // describes exactly the match whose teams, score and clock are shown below it.
  const m = pulse.live ?? pulse.next ?? pulse.awaiting ?? pulse.last;
  const lastResult = !pulse.live && !pulse.next && !pulse.awaiting && !!pulse.last;
  const awaiting = !pulse.live && !pulse.next && !!pulse.awaiting;
  // The date has come and nobody has started the clock: no frozen 00:00, the wait has its own words.
  const pending = !pulse.live && !!pulse.next && kickoffState(pulse.next, now) === "pending_whistle";
  const cd = pulse.next && !pulse.live && !pending ? countdownParts(dateMillis(pulse.next.date), now) : null;
  const rival = m?.rival;
  const score = m ? scoreOf(m) : { gf: 0, ga: 0 };
  const heading = pulse.live ? "Partido en directo" : pulse.next ? "Próximo partido" : awaiting ? AWAITING_ACTA : lastResult ? resultTitle(resultLetter(score.gf, score.ga)) : "Próximo partido por confirmar";
  const description = pulse.live ? "El marcador y las jugadas se actualizan desde el acta." : pulse.next ? (pending ? "El directo comenzará cuando el anotador marque el inicio." : "") : awaiting ? "Esperamos la confirmación del resultado y las jugadas." : lastResult ? story.em : "Publicaremos aquí el rival, el horario y el campo en cuanto estén confirmados.";
  return (
    <section className="hm-match" aria-labelledby="hm-title">
      <div className="in">
        <div className="match">
          <span className={`hm-chip-live${pulse.live ? " on" : ""}`}>
            <i />
            {pulse.live ? "En directo" : pulse.next ? "Próximo encuentro" : awaiting ? "Último partido" : lastResult ? "Último resultado" : "Calendario"}
          </span>
          <h1 id="hm-title">{heading}</h1>
          {description && <p className="em">{description}</p>}
          {m && <div className="vs">
            <div className="team">
              <span className="cr">
                <img src="/crest-256.webp" alt="" width={108} height={108} />
              </span>
              <b>MANCHESTER PITI</b>
              <small>{m.home === false ? "Visitante" : "Local"}</small>
            </div>
            {pulse.live || lastResult ? (
              <span className="score" role="status" aria-label={`${lastResult ? "Resultado" : "Marcador"}: ${score.gf} a ${score.ga}`}>
                {score.gf}–{score.ga}
              </span>
            ) : (
              <span className="x" aria-hidden="true">
                vs
              </span>
            )}
            <div className="team">
              <span className={`cr${m?.rivalLogoUrl ? "" : " q"}`}>
                {m?.rivalLogoUrl ? <img src={m.rivalLogoUrl} alt="" /> : rival ? (m?.rivalInitials ?? opponentInitials(rival)) : "?"}
              </span>
              <b>{rival ?? "Por confirmar"}</b>
              <small>{m.competition || "Liga"}</small>
            </div>
          </div>}
          {m && <div className="when">
                <b>{pulse.live ? (m.clock ? <MatchClockDisplay match={m} /> : "En juego ahora") : pending ? PENDING_WHISTLE : kickoffLabel(m.date)}</b>
                <span>{[m.venue, kitLabel(m)].filter(Boolean).join(" · ") || "Campo por confirmar"}</span>
          </div>}
          {cd && (
            <div className="cd" role="timer" aria-label={`Faltan ${cd.d} días, ${cd.h} horas y ${cd.m} minutos`}>
              <div>
                <b>{cd.d}</b>
                <span>días</span>
              </div>
              <div>
                <b>{cd.h}</b>
                <span>horas</span>
              </div>
              <div>
                <b>{cd.m}</b>
                <span>min</span>
              </div>
            </div>
          )}
          {!pulse.live && !pulse.next && m && <p className="hm-calendar-note">Próximo partido por confirmar. La cuenta atrás aparecerá cuando haya fecha.</p>}
          <div className="acts">
            {pulse.live ? (
              <Link className="hm-btn" to="/matches/$matchId" params={{ matchId: pulse.live.id }}>
                Seguir en directo <Icon name="arrow" size={16} stroke={2.2} />
              </Link>
            ) : (
              pulse.next && (
                <>
                  {/* (no tab: an upcoming match's page opens on its previa) */}
                  <Link className="hm-btn" to="/matches/$matchId" params={{ matchId: pulse.next.id }}>
                    Ver la previa <Icon name="arrow" size={16} stroke={2.2} />
                  </Link>
                  <AddToCalendar className="hm-mini" label="Añadir este partido" event={matchEvent(pulse.next, origin)} />
                </>
              )
            )}
            {!pulse.live && !pulse.next && m && <Link className="hm-btn" to="/matches/$matchId" params={{ matchId: m.id }}>{lastResult ? "Ver crónica y acta" : "Ver el partido"} <Icon name="arrow" size={16} stroke={2.2} /></Link>}
            {!m && <Link className="hm-btn" to="/partidos">Ver el calendario <Icon name="arrow" size={16} stroke={2.2} /></Link>}
            <AddToCalendar className="hm-mini" iconName="cal" label="Suscribirme al calendario" feed={`${origin}/calendario.ics`} />
          </div>
        </div>
        {moment && (
          <article className="moment hm-card" aria-labelledby="hm-moment">
            <div className="pic">{momentStill ? <img src={momentStill} alt="" draggable={false} /> : <ShirtBack name={moment.line.name.toUpperCase()} num={moment.line.num} />}</div>
            <div className="txt">
              <span className="k">Jugador del momento · {moment.kick}</span>
              <h2 id="hm-moment">{moment.line.name}</h2>
              <p>{moment.text}</p>
              <Link className="hm-link" to="/jugadores/$playerId" params={{ playerId: moment.line.id }}>
                Ver su ficha <Icon name="arrow" size={15} stroke={2.2} />
              </Link>
            </div>
          </article>
        )}
      </div>
    </section>
  );
}
