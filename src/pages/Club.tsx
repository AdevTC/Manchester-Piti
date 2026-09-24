import { Mail, ArrowUpRight, MapPin } from "lucide-react";
import { useClubContent } from "../lib/clubContent";
import {
  useClubData,
  isCompleted,
  dateMillis,
  formatDate,
} from "../lib/clubData";
import { PhotoSpace, SectionTitle } from "../components/club/ClubUI";
import { Link } from "@tanstack/react-router";
export function ClubPage() {
  const c = useClubContent();
  const { matches } = useClubData();
  const oldest = matches
    .filter(isCompleted)
    .sort((a, b) => dateMillis(a.date) - dateMillis(b.date))[0];
  return (
    <div className="club-page">
      <header className="club-page-head">
        <span className="club-kicker">ESTO ES MANCHESTER PITI</span>
        <h1>El club</h1>
        <p>{c.intro}</p>
      </header>
      <PhotoSpace url={c.photoUrl} />
      <section className="club-section club-story">
        <h2>Manchester Piti</h2>
        <div>
          <p className="club-long-copy">{c.story}</p>
          {c.founded && <p>Desde {c.founded}</p>}
          {c.location && (
            <p>
              <MapPin size={16} />
              {c.location}
            </p>
          )}
        </div>
      </section>
      <section className="club-section">
        <SectionTitle title="Historia del equipo" />
        <div className="club-history">
          {c.milestones.map((h, i) => (
            <article key={i}>
              <b>{h.year}</b>
              <div>
                <h3>{h.title}</h3>
                <p>{h.text}</p>
              </div>
            </article>
          ))}
          {oldest && (
            <article>
              <b>{new Date(dateMillis(oldest.date)).getFullYear()}</b>
              <div>
                <h3>El primer partido de nuestro archivo</h3>
                <p>
                  {formatDate(oldest.date)} · Manchester Piti {oldest.goalsFor}–
                  {oldest.goalsAgainst} {oldest.rival}
                </p>
                <Link to="/matches/$matchId" params={{ matchId: oldest.id }}>
                  Ver partido →
                </Link>
              </div>
            </article>
          )}
          {!c.milestones.length && !oldest && (
            <p>La historia del equipo se actualizará aquí.</p>
          )}
        </div>
      </section>
      {c.gallery.length > 0 && (
        <section className="club-section">
          <SectionTitle title="Galería" />
          <div className="club-grid-3">
            {c.gallery.map((p, i) => (
              <figure key={i}>
                <img
                  className="club-gallery-image"
                  src={p.url}
                  alt={p.caption}
                  loading="lazy"
                />
                <figcaption>{p.caption}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}
      {c.venue && (
        <section className="club-panel">
          <h2>Nuestro campo</h2>
          <p>{c.venue}</p>
          <a
            className="club-text-link"
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.venue)}`}
            target="_blank"
            rel="noreferrer"
          >
            Cómo llegar <ArrowUpRight size={18} />
          </a>
        </section>
      )}
      <section className="club-section">
        <SectionTitle title="Contacto" />
        <div className="club-grid-3">
          {[
            ["Un amistoso", "¿Buscáis rival? Nos vemos en el campo."],
            [
              "Un lugar en el equipo",
              "Si quieres jugar con nosotros, nos encantará conocerte.",
            ],
            [
              "Juega de nuestro lado",
              "Colabora con el equipo y acompáñanos durante la temporada.",
            ],
          ].map(([title, text]) => (
            <article className="club-panel" key={title}>
              <h3>{title}</h3>
              <p>{text}</p>
              {c.email ? (
                <a
                  className="club-text-link"
                  href={`mailto:${c.email}?subject=${encodeURIComponent(title)}`}
                >
                  <Mail size={16} />
                  Hablemos
                </a>
              ) : (
                <span className="club-muted">
                  Contacto del club pendiente de publicar.
                </span>
              )}
            </article>
          ))}
        </div>
        {c.instagram && (
          <a
            className="club-button secondary"
            href={c.instagram}
            target="_blank"
            rel="noreferrer"
          >
            El Piti en Instagram <ArrowUpRight size={16} />
          </a>
        )}
      </section>
    </div>
  );
}
