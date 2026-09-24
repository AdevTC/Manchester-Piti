import { Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  Camera,
  CalendarPlus,
  MapPin,
  ArrowRight,
} from "lucide-react";
import { useClock } from "../../hooks/useClock";
import {
  dateMillis,
  formatDate,
  matchPhase,
  type ClubMatch,
} from "../../lib/clubData";
import { Crest } from "../Crest";
import { OpponentBadge } from "./OpponentBadge";
export function PhotoSpace({
  url,
  label = "La próxima foto de equipo va aquí",
  className = "",
}: {
  url?: string;
  label?: string;
  className?: string;
}) {
  return (
    <div className={`club-photo ${className}`}>
      {url ? (
        <img src={url} alt={label} loading="lazy" />
      ) : (
        <>
          <div className="club-photo-pitch">
            <i />
            <i />
            <i />
          </div>
          <div className="club-photo-symbol">
            <Crest size={104} />
          </div>
          <span className="club-photo-caption">
            <Camera size={17} />
            {label}
          </span>
          <span className="club-photo-number" aria-hidden="true">
            07
          </span>
        </>
      )}
    </div>
  );
}
export function SectionTitle({
  title,
  text,
  to,
  action = "Ver todo",
}: {
  title: string;
  text?: string;
  to?: "/partidos" | "/plantilla" | "/stats" | "/club";
  action?: string;
}) {
  return (
    <div className="club-section-title">
      <div>
        <h2>{title}</h2>
        {text && <p>{text}</p>}
      </div>
      {to && (
        <Link to={to} className="club-text-link">
          {action}
          <ArrowUpRight size={17} />
        </Link>
      )}
    </div>
  );
}
const phases: Record<string, string> = {
  finished: "Finalizado",
  playing: "JUGANDO",
  scheduled: "Próximo partido",
  awaiting_result: "Pendiente de resultado",
  cancelled: "Cancelado",
  postponed: "Aplazado",
  unscheduled: "Por confirmar",
};
export function FixtureCard({
  match,
  featured = false,
}: {
  match: ClubMatch;
  featured?: boolean;
}) {
  const now = useClock();
  const phase = matchPhase(match, now);
  const seconds = Math.max(
    0,
    Math.floor((dateMillis(match.date) - now) / 1000),
  );
  const parts = [
    Math.floor(seconds / 86400),
    Math.floor(seconds / 3600) % 24,
    Math.floor(seconds / 60) % 60,
    seconds % 60,
  ];
  return (
    <article className={`club-fixture ${featured ? "featured" : ""}`}>
      <div className="club-fixture-top">
        <span>{match.competition || "Partido"}</span>
        <span className={`club-status ${phase}`}>
          {phase === "playing" && <i />}
          {phases[phase]}
        </span>
      </div>
      <div className="club-fixture-teams">
        <div>
          <Crest size={featured ? 60 : 38} />
          <strong>Manchester Piti</strong>
          <small>
            {match.home === undefined ? "" : match.home ? "Local" : "Visitante"}
          </small>
        </div>
        <b className="club-fixture-score">
          {phase === "finished"
            ? `${match.goalsFor} : ${match.goalsAgainst}`
            : "VS"}
        </b>
        <div>
          <OpponentBadge
            name={match.rival}
            logo={match.rivalLogoUrl}
            initials={match.rivalInitials}
            size={featured ? 60 : 44}
          />
          <strong>{match.rival || "Rival por confirmar"}</strong>
          <small>
            {match.home === undefined ? "" : match.home ? "Visitante" : "Local"}
          </small>
        </div>
      </div>
      <p className="club-fixture-date">
        {formatDate(match.date, true)} · Hora peninsular
      </p>
      {match.venue && (
        <p className="club-fixture-venue">
          <MapPin size={14} />
          {match.venue}
        </p>
      )}
      {featured && phase === "scheduled" && (
        <div
          className="club-countdown"
          aria-label="Tiempo hasta el próximo partido"
        >
          {parts.map((v, i) => (
            <div key={i}>
              <b>{String(v).padStart(2, "0")}</b>
              <span>{["Días", "Horas", "Min", "Seg"][i]}</span>
            </div>
          ))}
        </div>
      )}
      {featured && phase === "playing" && (
        <p className="club-live-message">
          El Piti está en el campo.
          <small>
            Franja de juego según el horario. Resultado pendiente de
            confirmación.
          </small>
        </p>
      )}
      <Link
        to="/matches/$matchId"
        params={{ matchId: match.id }}
        className="club-fixture-link"
      >
        {phase === "finished" ? "Así fue el partido" : "Ver el encuentro"}
        <ArrowRight size={17} />
      </Link>
    </article>
  );
}
export function CalendarDownload({ match }: { match: ClubMatch }) {
  const download = () => {
    const ms = dateMillis(match.date);
    if (!Number.isFinite(ms)) return;
    const fmt = (n: number) =>
      new Date(n)
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}/, "");
    const esc = (s: string) =>
      s
        .replace(/\\/g, "\\\\")
        .replace(/\r?\n/g, "\\n")
        .replace(/,/g, "\\,")
        .replace(/;/g, "\\;");
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Manchester Piti//Partidos//ES",
      "BEGIN:VEVENT",
      `UID:${match.id}@manchesterpiti`,
      `DTSTAMP:${fmt(Date.now())}`,
      `DTSTART:${fmt(ms)}`,
      `DTEND:${fmt(ms + 3600000)}`,
      `SUMMARY:${esc(`Manchester Piti vs ${match.rival}`)}`,
      `LOCATION:${esc(match.venue || "")}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const url = URL.createObjectURL(
      new Blob([ics], { type: "text/calendar;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "partido-piti.ics";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <button className="club-button secondary" onClick={download}>
      <CalendarPlus size={17} />
      Añadir al calendario
    </button>
  );
}
export function DataState({
  loading,
  error,
}: {
  loading: boolean;
  error?: unknown;
}) {
  if (error)
    return (
      <div className="club-empty" role="alert">
        No hemos podido cargar los datos del club.{" "}
        <button onClick={() => location.reload()}>Reintentar</button>
      </div>
    );
  return loading ? (
    <div className="club-loading" role="status">
      Preparando el terreno de juego…
    </div>
  ) : null;
}
