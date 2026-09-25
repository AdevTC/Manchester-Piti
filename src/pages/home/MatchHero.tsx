import { Link } from "@tanstack/react-router";
import { AddToCalendar } from "../../components/celeste/AddToCalendar";
import { Icon } from "../../components/celeste/icons";
import { ShirtBack } from "../../components/celeste/ShirtBack";
import { dateMillis } from "../../lib/clubData";
import { opponentInitials } from "../../lib/clubAnalytics";
import { countdownParts, matchEvent, type Moment, type Narrative, type Pulse } from "../../lib/home";
import { kickoffLabel } from "../../lib/vestuario";

/** A score like 5–3 never breaks across lines (word joiners around the dash). */
const keepScore = (s: string) => s.replace(/(\d)–(\d)/g, "$1⁠–⁠$2");

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
  const m = pulse.live ?? pulse.next;
  const cd = pulse.next && !pulse.live ? countdownParts(dateMillis(pulse.next.date), now) : null;
  const rival = m?.rival;
  return (
    <section className="hm-match" aria-labelledby="hm-title">
      <div className="in">
        <div className="match">
          <span className={`hm-chip-live${pulse.live ? " on" : ""}`}>
            <i />
            {story.kick}
          </span>
          <h1 id="hm-title">{keepScore(story.head)}</h1>
          <p className="em">{story.em}</p>
          <div className="vs">
            <div className="team">
              <span className="cr">
                <img src="/crest-256.webp" alt="" width={108} height={108} />
              </span>
              <b>MANCHESTER PITI</b>
              <small>{m ? (m.home === false ? "Visitante" : "Local") : "Local"}</small>
            </div>
            {pulse.live ? (
              <span className="score" aria-label={`Marcador: ${pulse.live.goalsFor ?? 0} a ${pulse.live.goalsAgainst ?? 0}`}>
                {pulse.live.goalsFor ?? 0}–{pulse.live.goalsAgainst ?? 0}
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
              <small>{m ? m.competition || "Liga" : "Rival de la jornada 1"}</small>
            </div>
          </div>
          <div className="when">
            {m ? (
              <>
                <b>{pulse.live ? "En juego ahora" : kickoffLabel(m.date)}</b>
                <span>{[m.venue, m.kit ? (m.kit === "home" ? "1ª equipación" : "2ª equipación") : null].filter(Boolean).join(" · ") || "Campo por confirmar"}</span>
              </>
            ) : (
              <>
                <b>Fecha por confirmar</b>
                <span>En cuanto se publique el calendario, la cuenta atrás arranca sola.</span>
              </>
            )}
          </div>
          {!pulse.live && (
            <div className={`cd${cd ? "" : " ph"}`} role="timer" aria-label={cd ? `Faltan ${cd.d} días, ${cd.h} horas y ${cd.m} minutos` : "Cuenta atrás: empieza cuando haya fecha"}>
              <div>
                <b>{cd ? cd.d : "—"}</b>
                <span>días</span>
              </div>
              <div>
                <b>{cd ? cd.h : "—"}</b>
                <span>horas</span>
              </div>
              <div>
                <b>{cd ? cd.m : "—"}</b>
                <span>min</span>
              </div>
            </div>
          )}
          <div className="acts">
            {pulse.live ? (
              <Link className="hm-btn" to="/matches/$matchId" params={{ matchId: pulse.live.id }}>
                Seguir en directo <Icon name="arrow" size={16} stroke={2.2} />
              </Link>
            ) : (
              pulse.next && <AddToCalendar className="hm-mini sky" label="Añadir este partido" event={matchEvent(pulse.next, location.origin)} />
            )}
            <AddToCalendar className="hm-mini" iconName="cal" label="Suscribirme al calendario" feed={`${location.origin}/calendario.ics`} />
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
