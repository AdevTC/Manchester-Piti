// /club/gente · La gente (CL- boards, part-gente): the next birthday of the squad (30 days, Inicio's rule) with his
// printed shirt and the next six, «¿Juegas en el Piti?» for the afición, the club's calendar, who backs us (once),
// the classified ads, Instagram and the vestuario's questions.
import { useState } from "react";
import { googleSubscribeUrl, webcalUrl } from "../../../lib/calendarLinks";
import { mailto } from "../../../lib/club";
import { socialLabel, type SocialLink } from "../../../lib/social";
import { SocialIcon } from "../../../components/vidrio/SocialIcon";
import { Go, I } from "./ui";

export interface GenteBday {
  id: string;
  name: string;
  full: string;
  when: string;
  age: string;
  src: string | undefined;
  label: string;
}
export interface GenteProps {
  fan: boolean;
  member: boolean;
  cap: boolean;
  /** The birthday within 30 days (its headline, line and shirt), null without one. */
  bday: { id: string; t: string; d: string; shirt: string | undefined; shirtAlt: string; next2: { t: string; shirt: string | undefined } | null } | null;
  list: GenteBday[];
  sponsors: { name: string; url: string; ini: string }[];
  email: string;
  /** The club's profiles (Instagram, YouTube). */
  social: readonly SocialLink[];
  faq: { q: string; a: string }[];
  /** The calendar feed (https). */
  feed: string;
  congrats: () => void;
  door: () => void;
  invite: () => void;
  say: (t: string) => void;
}

function Calendar({ id, feed, say }: { id: string; feed: string; say: (t: string) => void }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(feed);
      setCopied(true);
      say("Enlace copiado: /calendario.ics");
    } catch {
      say("No se ha podido copiar el enlace.");
    }
  };
  return (
    <section
      className="cb-cal"
      aria-labelledby={id}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <h2 id={id} className="cb-h2">
        El calendario del club
      </h2>
      <p>Cada partido entra solo en tu calendario, con hora y campo.</p>
      <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm" onClick={() => setOpen(!open)} aria-expanded={open}>
        <I n="cal" />
        Suscribirme al calendario
      </button>
      {open && (
        <ul className="cb-cal__menu">
          <li>
            <a href={googleSubscribeUrl(feed)} target="_blank" rel="noopener noreferrer">
              <b>Google Calendar</b>
              <span>Se actualiza solo (cada pocas horas)</span>
            </a>
          </li>
          <li>
            <a href={webcalUrl(feed)}>
              <b>iPhone o Mac</b>
              <span>Suscripción en Calendario</span>
            </a>
          </li>
          <li>
            <button type="button" onClick={() => void copy()}>
              <b>{copied ? "Enlace copiado" : "Copiar enlace"}</b>
              <span>Para cualquier otra app de calendario</span>
            </button>
          </li>
        </ul>
      )}
    </section>
  );
}

const ADS = [
  { k: "Se busca rival", t: "Un amistoso", d: "¿Buscáis rival? Nos vemos en el campo." },
  { k: "Se busca jugador", t: "Un lugar en el equipo", d: "Si quieres jugar con nosotros, nos encantará conocerte." },
  { k: "Se buscan mecenas", t: "Juega de nuestro lado", d: "Colabora con el equipo y acompáñanos durante la temporada." },
] as const;

export function Gente({ fan, member, cap, bday, list, sponsors, email, social, faq, feed, congrats, door, invite, say }: GenteProps) {
  const [open, setOpen] = useState(0);
  const mail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : "";
  return (
    <>
      <div className="cb-gtop">
        <section className={`cb-bday${bday ? "" : " is-none"}`} aria-labelledby="cb-bday-t">
          {bday ? (
            bday.shirt ? <img className="cb-bday__shirt" src={bday.shirt} alt={bday.shirtAlt} width={540} height={600} /> : <span className="cb-bday__shirt" role="img" aria-label={bday.shirtAlt} />
          ) : (
            <span className="cb-bday__i" aria-hidden="true">
              <svg aria-hidden="true" focusable="false">
                <use href="#vi-cake" />
              </svg>
            </span>
          )}
          <div className="cb-bday__txt">
            <p className="cb-bday__k">
              <I n="cake" />
              Cumpleaños, los próximos 30 días
            </p>
            <h2 id="cb-bday-t">{bday ? bday.t : "Ningún cumpleaños en los próximos 30 días"}</h2>
            <p>{bday ? bday.d : "Cuando se acerque uno, sale aquí y en Inicio a la vez."}</p>
            {bday?.next2 && (
              <p className="cb-bday__next">
                {bday.next2.shirt ? <img src={bday.next2.shirt} alt="" width={540} height={600} /> : <span className="cb-bday__ph" />}
                {bday.next2.t}
              </p>
            )}
            {list.length > 0 && (
              <ol className="cb-bdays" aria-label="Los próximos cumpleaños de la plantilla">
                {list.map((b, i) => (
                  <li key={b.id} className={i === 0 ? "is-next" : undefined} aria-label={b.label}>
                    {b.src ? <img src={b.src} alt="" width={540} height={600} loading="lazy" /> : <span className="cb-bdays__ph" />}
                    <span>
                      <b>{b.name}</b>
                      <span>{b.full}</span>
                    </span>
                    <span className="cb-bdays__w">
                      <b>{b.when}</b>
                      <span>{b.age}</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
            {bday && (
              <div className="cb-bday__acts">
                <Go className="vd-glass vd-press vd-btn vd-btn--sm" href={`/jugadores/${bday.id}`}>
                  Su ficha
                </Go>
                {member && (
                  <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm" onClick={congrats}>
                    Felicitarle en el tablón
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        {fan && (
          <section className="vd-glass vd-glass--clear vd-orn cb-invite" aria-labelledby="cb-inv-t">
            <div className="vd-orn__head">
              <h2 id="cb-inv-t">¿Juegas en el Piti?</h2>
              <span>Pide entrar</span>
            </div>
            <p>Dentro, el partido también es tuyo:</p>
            <ol>
              <li>Respondes a la convocatoria</li>
              <li>Ves tu sitio en el siete</li>
              <li>Votas al MVP y llevas tu carta</li>
            </ol>
            <div className="cb-row-acts">
              <button type="button" className="vd-glass vd-press vd-btn vd-btn--pri vd-btn--sm" onClick={door}>
                Pedir entrar
              </button>
              <button type="button" className="vd-link" onClick={invite}>
                Ya tengo invitación
              </button>
            </div>
          </section>
        )}
        {!fan && <Calendar id="cb-cal-t" feed={feed} say={say} />}
      </div>

      <div className="cb-gboard">
        {fan && <Calendar id="cb-cal2-t" feed={feed} say={say} />}
        <section className="cb-spons" aria-labelledby="cb-spons-t">
          <h2 id="cb-spons-t" className="cb-h2">
            Nos apoyan
          </h2>
          <ul className="cb-spons__l">
            {sponsors.map((s) => (
              <li key={s.name}>
                <span className="cb-spons__logo" aria-hidden="true">
                  {s.ini}
                </span>
                <b>{s.name}</b>
                {s.url && (
                  <a className="vd-link" href={s.url} target="_blank" rel="noopener noreferrer" aria-label={`${s.name} (se abre en otra pestaña)`}>
                    Su web
                  </a>
                )}
              </li>
            ))}
            <li className="cb-spons__rent">
              <span className="cb-spons__logo cb-spons__logo--free" aria-hidden="true">
                +
              </span>
              <div>
                <b>Este hueco se alquila</b>
                <span>Tu marca en la camiseta, en la web y en el campo.</span>
              </div>
              {mail ? (
                <a className="vd-link" href={mailto(mail, "Patrocinio")}>
                  Escríbenos
                </a>
              ) : (
                <span className="cb-small">Correo por publicar</span>
              )}
            </li>
          </ul>
        </section>
        <section className="cb-ads" aria-labelledby="cb-ads-t">
          <h2 id="cb-ads-t" className="cb-h2">
            Clasificados
          </h2>
          <ul className="cb-ads__l">
            {ADS.map((a) => (
              <li key={a.k}>
                <span className="cb-ads__k">{a.k}</span>
                <b>{a.t}</b>
                <span>{a.d}</span>
                {mail ? (
                  <a className="vd-link" href={mailto(mail, a.t)}>
                    Hablemos
                  </a>
                ) : (
                  <span className="cb-small">Pendiente</span>
                )}
              </li>
            ))}
          </ul>
          {(social.length > 0 || mail) && (
            <p className="cb-social">
              {social.map((l) => (
                <a key={l.key} className="vd-glass vd-press vd-btn vd-btn--sm" href={l.href} target="_blank" rel="noopener noreferrer" aria-label={socialLabel(l)}>
                  <SocialIcon name={l.key} className="cb-i" />
                  El Piti en {l.name}
                </a>
              ))}
              {mail && <span>{mail}</span>}
            </p>
          )}
          {!mail && <p className="cb-small">Contacto del club pendiente de publicar.</p>}
        </section>
        <section className="cb-faq" aria-labelledby="cb-faq-t">
          <h2 id="cb-faq-t" className="cb-h2">
            Preguntas de vestuario
          </h2>
          {faq.map((f, i) => {
            const on = open === i;
            return (
              <div key={f.q} className={`cb-faq__i${on ? " is-open" : ""}`}>
                <button type="button" className="cb-faq__q" aria-expanded={on} onClick={() => setOpen(on ? -1 : i)}>
                  <span>{f.q}</span>
                  <I n={on ? "collapse" : "expand"} />
                </button>
                {on && <p className="cb-faq__a">{f.a}</p>}
              </div>
            );
          })}
          {cap && (
            <Go className="vd-link" href="/admin/contenido?seccion=preguntas">
              Editar las preguntas y el contacto
            </Go>
          )}
        </section>
      </div>
    </>
  );
}
