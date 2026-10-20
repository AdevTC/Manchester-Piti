// The other ornaments beside the lens: la convocatoria (members, before the match: who comes, «¿Vas hoy?»
// for a jugador), la previa (fans: where, which kit, the light), the MVP vote (members, while it is open; no
// running tally, ever) and «Lo que viene» (the next jornadas, when there is no match to tell).
import { useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { dateMillis, type ClubMatch } from "../../../lib/clubData";
import { mapsUrl, kitLabel, venueInfo, venueMapsUrl } from "../../../lib/derived/venue";
import { useClubContent } from "../../../lib/clubContent";
import { madridTime } from "../../../lib/derived/madrid";
import { sunTimes } from "../../../lib/derived/sun";
import type { MatchWeather } from "../../../lib/weather";
import { andList } from "../inicioModel";
import { endSentence } from "../../../lib/derived/words";
import { fixtureLine, newDateWords, postponedOf, turnoutLine, venueName } from "../hoyModel";
import { AddToCalendar } from "../../../components/celeste/AddToCalendar";
import { useVenuePlace } from "../../partidos/vidrio/venuePlace";
import { matchEvent } from "../../../lib/home";
import { capital } from "../../../lib/derived/words";
import { Ico } from "./icons";
import { Shirt } from "./Siete";
import { useShirtStills } from "../../../components/jersey3d/useShirtStills";

type Answer = "yes" | "maybe" | "no";
const ANSWERS: { id: Answer; label: string }[] = [
  { id: "yes", label: "Voy" },
  { id: "maybe", label: "Duda" },
  { id: "no", label: "No voy" },
];

/** «Voy · Duda · No voy»: a glass segmented control (pressed buttons, not tabs). */
export function RsvpSeg({ value, onPick, label, busy }: { value: Answer | null; onPick: (a: Answer) => void; label: string; busy?: boolean }) {
  const at = value ? ANSWERS.findIndex((a) => a.id === value) : 0;
  return (
    <div className={`vd-glass vd-seg vi-rsvp${value ? "" : " vi-nobead"}`} role="group" aria-label={label} aria-busy={busy || undefined} style={{ "--n": 3, "--i": at } as CSSProperties}>
      <span className="vd-shelf__bead" aria-hidden="true" />
      {ANSWERS.map((a) => (
        <button key={a.id} type="button" className="vd-seg__b" aria-pressed={value === a.id} onClick={() => onPick(a.id)}>
          {value === a.id && <Ico id="check" />}
          {a.label}
        </button>
      ))}
    </div>
  );
}

export interface ConvoOrnProps {
  counts: { yes: number; maybe: number; no: number; none: number };
  /** «Vienen Jordi, Alcides y Evans.» */
  who: string[];
  /** The jugador's own answer and the control (null for a socio). */
  mine: { value: Answer | null; onPick: (a: Answer) => void; error: string; busy: boolean } | null;
  when: string;
  /** «Hoy anota Jorge en la mesa.» (who keeps la mesa: matches/{id}.mesa), «Hoy anotas tú en la mesa.». */
  mesa?: string | null;
  className?: string;
}

export function ConvoOrn({ counts, who, mine, when, mesa, className }: ConvoOrnProps) {
  return (
    <section className={`vd-glass vd-glass--clear vd-orn vi-orn vi-convo${className ? ` ${className}` : ""}`} aria-label="La convocatoria">
      <div className="vd-orn__head">
        <h2>La convocatoria</h2>
        <span>Se mueve sola</span>
      </div>
      <div className="vi-counts" aria-live="polite">
        <p className="vd-count">
          <b>{counts.yes}</b>
          <span>vienen</span>
        </p>
        <p className="vd-count">
          <b>{counts.maybe}</b>
          <span>en duda</span>
        </p>
        <p className="vd-count">
          <b>{counts.no}</b>
          <span>no vienen</span>
        </p>
        <p className="vd-count">
          <b>{counts.none}</b>
          <span>sin responder</span>
        </p>
      </div>
      <p className="vi-orn-p">{who.length ? endSentence(`${who.length === 1 ? "Viene" : "Vienen"} ${andList(who)}`) : "Todavía no ha respondido nadie."}</p>
      {mine && (
        <div className="vi-mine">
          <p className="vi-orn-p">
            <b>¿Vas {when}?</b>
          </p>
          <RsvpSeg value={mine.value} onPick={mine.onPick} label={`¿Vas ${when}?`} busy={mine.busy} />
          {mine.error && (
            <p className="vi-err" role="alert">
              {mine.error}
            </p>
          )}
        </div>
      )}
      {mesa && <p className="vi-orn-p vi-orn-foot">{mesa}</p>}
    </section>
  );
}

export function PreviaOrn({ match, jornada, weather, hourly, homeVenue, className }: { match: ClubMatch; jornada: number | null; weather: MatchWeather | null; /** «14° al pitido, 11° al final; sin lluvia». */ hourly?: string | null; /** El club's «campo» (clubContent.venue). */ homeVenue?: string; className?: string }) {
  // (at home the club's own words for its ground win — «CDM Palomeras, campo 2», El club's «campo» —; where it
  // is, from the geocoder, as Partidos' previa says it)
  const home = match.home !== false;
  const venue = (home && venueName(homeVenue ?? "")) || venueName(match.venue ?? "") || (home ? "CDM Palomeras" : `Campo de ${match.rival ?? "el rival"}`);
  const place = useVenuePlace(venueName(match.venue ?? "") || (home ? "CDM Palomeras" : null));
  // The ground's address and how to get there are the captains' (El club · Los campos, clubContent.venues):
  // a ground without its entry says only where it is when the map knows it.
  const info = venueInfo(match.venue || venue, useClubContent().venues);
  const detail = info ? [info.address, info.transit].filter((x): x is string => !!x?.trim()).map((x) => endSentence(x)).join(" ") : "";
  const where = home ? detail || (place?.district ? `En ${place.district}.` : "") : `En casa de ${match.rival ?? "el rival"}${place?.district ? `, en ${place.district}` : ""}.${detail ? ` ${detail}` : ""}`;
  return (
    <section className={`vd-glass vd-glass--clear vd-orn vi-orn vi-previa${className ? ` ${className}` : ""}`} aria-label="La previa">
      <div className="vd-orn__head">
        <h2>La previa</h2>
        <span>{jornada ? `Jornada ${jornada}` : "El partido"}</span>
      </div>
      <ul className="vi-previa__list">
        <li>
          <Ico id="pin" />
          <div>
            <a href={info ? venueMapsUrl(info) : mapsUrl(venue)} target="_blank" rel="noreferrer">
              {venue}
              <span className="vd-vh"> (abre el mapa en otra pestaña)</span>
            </a>
            {where && <span>{where}</span>}
          </div>
        </li>
        <li>
          <Ico id="shirt" />
          <div>
            {kitLabel(match, "Primera equipación").replace(/^1ª/, "Primera").replace(/^2ª/, "Segunda")}
            <span>{match.kit === "away" ? "La segunda, la de fuera." : "Celeste con cuello marino."}</span>
          </div>
        </li>
        <li>
          <Ico id="sunset" />
          <div>
            {hourly ? capital(hourly) : weather ? `${weather.temp}°, ${weather.label.toLocaleLowerCase("es")}` : "La luz del día"}
            <span>{sunsetLine(match)}</span>
          </div>
        </li>
      </ul>
      <div className="vi-orn-foot">
        <Link className="vd-link" to="/matches/$matchId" params={{ matchId: match.id }}>
          Toda la previa del partido
        </Link>
      </div>
    </section>
  );
}

function sunsetLine(m: ClubMatch): string {
  const ko = dateMillis(m.date);
  if (!Number.isFinite(ko)) return "Hora por confirmar.";
  const sunset = sunTimes(ko).sunset;
  const half = ko + ((m.duration ?? 50) / 2) * 60_000;
  return sunset <= ko ? "Todo el partido con focos." : sunset <= half ? `El sol se pone a las ${madridTime(sunset)}: la segunda parte, con focos.` : `El sol se pone a las ${madridTime(sunset)}.`;
}

export interface MvpOrnProps {
  candidates: { id: string; name: string; num: string }[];
  mine: string | null;
  /** «el martes» (the head) and «el martes a las 21:00» (the line under the vote). */
  closes: string;
  closesAt: string;
  /** How many have voted, and of how many who can (turnout only: never who leads while it is open). */
  turnout: { total: number; eligible: number | null } | null;
  onVote: (id: string) => Promise<void>;
  className?: string;
}

export function MvpOrn({ candidates, mine, closes, closesAt, turnout, onVote, className }: MvpOrnProps) {
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState("");
  const chosen = sent ?? mine;
  const vote = async (id: string) => {
    setSent(id);
    setError("");
    try {
      await onVote(id);
    } catch {
      setSent(null);
      setError("No se ha guardado tu voto. Inténtalo otra vez.");
    }
  };
  const name = candidates.find((c) => c.id === chosen)?.name;
  return (
    <section className={`vd-glass vd-glass--clear vd-orn vi-orn vi-mvp${className ? ` ${className}` : ""}`} aria-label="Vota al MVP">
      <div className="vd-orn__head">
        <h2>Vota al MVP</h2>
        <span>Cierra {closes}</span>
      </div>
      <div className="vi-mvp__grid" role="group" aria-label="Los que jugaron">
        {candidates.map((c) => (
          <button key={c.id} type="button" aria-pressed={chosen === c.id} onClick={() => void vote(c.id)}>
            <Shirt num={c.num} size={22} />
            {c.name}
          </button>
        ))}
      </div>
      <p className="vi-orn-p vi-orn-foot" aria-live="polite">
        {name ? `${endSentence(`Votas a ${name}`)} Puedes cambiarlo hasta ${closesAt}.` : `Elige a uno. Los resultados, ${closesAt}.`} {turnoutLine(turnout)}
      </p>
      {error && (
        <p className="vi-err" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

export interface MvpWinnerOrnProps {
  /** The winners (a tie shares it), in capitals as on the shirt. */
  winners: { id: string; name: string; num: string }[];
  /** The winner's votes and everyone's (null while unknown). */
  votes: number | null;
  total: number | null;
  /** «de la J1», «del estreno». */
  of: string;
  /** What a single winner did that night («Un gol y un pase de gol.», hoyModel.winnerDeeds). */
  deeds?: string | null;
  matchId: string;
  /** The night's kit and the page's theme: the winner wears the same real shirt as on the pitch. */
  kit?: "home" | "away";
  theme?: "dark" | "light";
  className?: string;
}

/** The MVP once the vote has closed: the shirt and the name in gold (gold is only for our goal and the MVP), what
 *  he did that night and his share of the votes. Never the others' counts (no tally, user decision). */
export function MvpWinnerOrn({ winners, votes, total, of, deeds, matchId, kit = "home", theme = "dark", className }: MvpWinnerOrnProps) {
  const reqs = winners.map((w) => ({ kit, theme, name: "", num: w.num || " ", yaw: 0 }));
  const still = useShirtStills(reqs, { offMainThread: true });
  const shared = winners.length > 1;
  const voteWords = votes === null ? null : total ? `${votes} de ${total} votos` : `${votes} ${votes === 1 ? "voto" : "votos"}`;
  return (
    <section className={`vd-glass vd-glass--clear vd-orn vi-orn vi-winner${className ? ` ${className}` : ""}`} aria-label={`MVP ${of}`}>
      <div className="vd-orn__head">
        <h2>MVP {of}</h2>
        <span>{shared ? "Compartido" : "Votación cerrada"}</span>
      </div>
      {shared ? (
        <>
          <ul className="vi-winner__list vi-winner__list--shared">
            {winners.map((w) => (
              <li key={w.id}>
                <Shirt num={w.num} still={still(reqs[winners.indexOf(w)])} size={44} />
                <Link className="vi-winner__name" to="/jugadores/$playerId" params={{ playerId: w.id }}>
                  {w.name}
                </Link>
              </li>
            ))}
          </ul>
          {voteWords && <p className="vi-orn-p vi-winner__votes">{voteWords} cada uno</p>}
        </>
      ) : (
        winners[0] && (
          <div className="vi-winner__hero">
            <Shirt num={winners[0].num} still={still(reqs[0])} size={72} />
            <div className="vi-winner__who">
              <Link className="vi-winner__name" to="/jugadores/$playerId" params={{ playerId: winners[0].id }}>
                {winners[0].name}
              </Link>
              {deeds && <p className="vi-winner__deeds">{deeds}</p>}
              {voteWords && (
                <p className="vi-winner__share">
                  {total ? <span className="vi-winner__bar" style={{ "--p": `${Math.round((100 * (votes ?? 0)) / total)}%` } as CSSProperties} aria-hidden="true" /> : null}
                  <span className="vi-winner__count">{voteWords}</span>
                </p>
              )}
            </div>
          </div>
        )
      )}
      <div className="vi-orn-foot">
        <Link className="vd-link" to="/matches/$matchId" params={{ matchId }}>
          Leer el acta
        </Link>
      </div>
    </section>
  );
}

/** A postponed match: its new date (and «Al calendario» with it) or that the date comes, and why. */
export function FechaOrn({ match, jornada, className }: { match: ClubMatch; jornada: number | null; className?: string }) {
  const { reason, to } = postponedOf(match);
  const word = match.status === "cancelled" ? "Suspendido" : "Aplazado";
  return (
    <section className={`vd-glass vd-glass--clear vd-orn vi-orn vi-fecha${className ? ` ${className}` : ""}`} aria-label="La nueva fecha">
      <div className="vd-orn__head">
        <h2>La nueva fecha</h2>
        <span>{jornada ? `J${jornada}, ${word.toLocaleLowerCase("es")}` : word}</span>
      </div>
      {to !== null ? (
        <p className="vi-fecha__when">
          <b>{capital(newDateWords(to).replace(/^el /, ""))}</b>
          <span>{match.home === false ? `En casa de ${match.rival ?? "el rival"}` : venueName(match.venue ?? "") || "En Palomeras"}</span>
        </p>
      ) : (
        <p className="vi-fecha__when">
          <b>Sin fecha todavía</b>
          <span>Saldrá aquí y en los avisos en cuanto la pongan.</span>
        </p>
      )}
      {reason && <p className="vi-orn-p">{endSentence(capital(reason))}</p>}
      <div className="vi-orn-foot">
        {to !== null ? (
          <AddToCalendar className="vd-glass vd-btn vd-btn--sm vd-press" iconName="cal" label="Al calendario" event={matchEvent({ ...match, date: to }, typeof location === "undefined" ? "" : location.origin)} />
        ) : (
          <Link className="vd-link" to="/partidos">
            Todo el calendario
          </Link>
        )}
      </div>
    </section>
  );
}

export function VieneOrn({ upcoming, jornadaOf, now, className }: { upcoming: readonly ClubMatch[]; jornadaOf: (id: string) => number | null; now: number; className?: string }) {
  return (
    <section className={`vd-glass vd-glass--clear vd-orn vi-orn vi-viene${className ? ` ${className}` : ""}`} aria-label="Lo que viene">
      <div className="vd-orn__head">
        <h2>Lo que viene</h2>
        <span>{upcoming.length ? `${upcoming.length === 1 ? "1 partido" : `${upcoming.length} partidos`}` : "Sin fechas"}</span>
      </div>
      {upcoming.length ? (
        <ul className="vi-rows vi-rows--tight">
          {upcoming.slice(0, 3).map((m) => {
            const j = jornadaOf(m.id);
            return (
              <li key={m.id}>
                <span className="vi-ic vi-ic--j" aria-hidden="true">
                  {j ? `J${j}` : "·"}
                </span>
                <div className="vi-t">
                  <Link to="/matches/$matchId" params={{ matchId: m.id }}>
                    {m.home === false ? `En casa de ${m.rival ?? "rival"}` : `Contra ${m.rival ?? "rival por anunciar"}`}
                  </Link>
                  <span>{fixtureLine(m, now)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="vi-orn-p">El calendario llega pronto: cada partido saldrá aquí con su hora y su campo.</p>
      )}
      <div className="vi-orn-foot">
        <Link className="vd-link" to="/partidos">
          Todo el calendario
        </Link>
      </div>
    </section>
  );
}

