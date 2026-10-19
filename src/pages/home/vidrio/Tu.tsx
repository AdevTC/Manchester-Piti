// Tú: what is his in the Piti, without looking for it (only for a jugador). What he has to do (the convocatoria
// still open, his turno, the caja, the poll), what is his (the porra, the next medal, his card) and his notices.
// Every action is an existing write or a door into the vestuario: nothing new is stored from here.
import { Link } from "@tanstack/react-router";
import type { ClubMatch } from "../../../lib/clubData";
import { capital } from "../../../lib/derived/words";
import { fixtureLine } from "../hoyModel";
import { Ico } from "./icons";
import { RsvpSeg } from "./Ornaments";
import type { TuData } from "./useTu";

export interface TuProps {
  t: TuData;
  jornadaOf: (id: string) => number | null;
  now: number;
  /** The porra's line (how it goes, or how it ended). */
  porraLine: string;
  variant: "full" | "sum" | "min";
  onOpen?: () => void;
  region?: (n: 1 | 2 | 3 | 4) => string;
}

function convoTitle(m: ClubMatch, j: number | null) {
  return `Convocatoria del ${j ? `J${j}` : `partido contra ${m.rival ?? "el rival"}`}`;
}

function ToDo({ t, jornadaOf, now, short }: { t: TuData; jornadaOf: TuProps["jornadaOf"]; now: number; short: boolean }) {
  return (
    <ul className="vi-rows">
      {t.rsvp && (
        <li className="vi-row--wrap">
          <span className="vi-ic" aria-hidden="true">
            <Ico id="cal" />
          </span>
          <div className="vi-t">
            <b>{convoTitle(t.rsvp.match, jornadaOf(t.rsvp.match.id))}</b>
            <span>{fixtureLine(t.rsvp.match, now)}.</span>
          </div>
          <RsvpSeg value={t.rsvp.value} onPick={t.rsvp.pick} busy={t.rsvp.busy} label={`¿Vas? ${convoTitle(t.rsvp.match, jornadaOf(t.rsvp.match.id))}`} />
          {t.rsvp.error && (
            <p className="vi-err" role="alert">
              {t.rsvp.error}
            </p>
          )}
        </li>
      )}
      {t.turno && (
        <li>
          <span className="vi-ic" aria-hidden="true">
            <Ico id="shirt" />
          </span>
          <div className="vi-t">
            <b>{t.turno.mine ? capital(t.turno.text.replace(/^Te toca: /, "")) : "Turnos de la jornada"}</b>
            <span>{t.turno.mine ? "Te toca a ti esta semana." : t.turno.text}</span>
          </div>
          <Link className="vd-link" to="/vestuario" aria-label="Los turnos, en el vestuario">
            Turnos
          </Link>
        </li>
      )}
      {!short && t.caja && (
        <li>
          <span className="vi-ic" aria-hidden="true">
            <Ico id="euro" />
          </span>
          <div className="vi-t">
            <b>{t.caja.owes ? "La caja te espera" : "La caja, al día"}</b>
            <span>{t.caja.text}</span>
          </div>
          <Link className="vd-link" to="/vestuario" aria-label="La caja, en el vestuario">
            La caja
          </Link>
        </li>
      )}
      {!short && t.poll && (
        <li>
          <span className="vi-ic" aria-hidden="true">
            <Ico id="chart" />
          </span>
          <div className="vi-t">
            <b>{t.poll.title}</b>
            <span>{t.poll.sub}</span>
          </div>
          <Link className="vd-link" to="/vestuario" aria-label={`Votar «${t.poll.title}», en el vestuario`}>
            {t.poll.voted ? "Verla" : "Votar"}
          </Link>
        </li>
      )}
      {!t.rsvp && !t.turno && !t.caja && !t.poll && (
        <li>
          <span className="vi-ic" aria-hidden="true">
            <Ico id="check" />
          </span>
          <div className="vi-t">
            <b>Nada pendiente</b>
            <span>Cuando haya convocatoria, turno o encuesta, sale aquí.</span>
          </div>
        </li>
      )}
    </ul>
  );
}

function Mine({ t, porraLine }: { t: TuData; porraLine: string }) {
  return (
    <ul className="vi-rows">
      <li>
        <span className="vi-ic" aria-hidden="true">
          <Ico id="ball" />
        </span>
        <div className="vi-t">
          <b>{t.porra ? `Tu porra: ${t.porra.gf}–${t.porra.ga}` : "Tu porra, sin poner"}</b>
          <span>{porraLine}</span>
        </div>
        <Link className="vd-link" to="/vestuario" aria-label="La porra, en el vestuario">
          Porra
        </Link>
      </li>
      {t.logro && (
        <li className="vi-row--wrap">
          <span className="vi-ic" aria-hidden="true">
            <Ico id="trophy" />
          </span>
          <div className="vi-t">
            <b>{t.logro.label}</b>
            <span>{t.logro.text}</span>
          </div>
          <span className="vi-bar" role="img" aria-label={`${t.logro.pct} % del logro`}>
            <i style={{ width: `${t.logro.pct}%` }} />
          </span>
        </li>
      )}
      <li>
        <span className="vi-ic" aria-hidden="true">
          <Ico id="shield" />
        </span>
        <div className="vi-t">
          <b>Tu carta</b>
          <span>Tu dorsal, tu media y lo que llevas esta temporada.</span>
        </div>
        <Link className="vd-link" to="/profile" aria-label="Tu carta, en tu perfil">
          Verla
        </Link>
      </li>
    </ul>
  );
}

function Notices({ t }: { t: TuData }) {
  return (
    <ul className="vi-rows">
      {t.notices.map((n) => (
        <li key={n.id}>
          <span className="vi-ic" aria-hidden="true">
            <Ico id="bell" />
          </span>
          <div className="vi-t">
            <b>{n.title}</b>
            <span>{n.when}</span>
          </div>
        </li>
      ))}
      {!t.notices.length && (
        <li>
          <span className="vi-ic" aria-hidden="true">
            <Ico id="bell" />
          </span>
          <div className="vi-t">
            <b>Sin avisos nuevos</b>
            <span>Los avisos del equipo y los tuyos salen aquí y en la campana.</span>
          </div>
        </li>
      )}
      <li>
        <div className="vi-t">
          <b>¿Vas a faltar?</b>
          <span>Avísalo antes del jueves y el capitán lo ve en la pizarra.</span>
        </div>
        <Link className="vd-link" to="/vestuario" aria-label="Avisar de una ausencia, en el vestuario">
          Avisar
        </Link>
      </li>
    </ul>
  );
}

export function Tu({ t, jornadaOf, now, porraLine, variant, onOpen, region = () => "" }: TuProps) {
  if (variant === "min") {
    const j = t.rsvp ? jornadaOf(t.rsvp.match.id) : null;
    const first = t.rsvp ? `${j ? `J${j}` : (t.rsvp.match.rival ?? "Convocatoria")}: ${t.rsvp.value ? "respondida" : "sin responder"}.` : "";
    return (
      <p className="vi-zmin">
        <span>
          {first && <b>{first}</b>} {t.turno?.mine ? t.turno.text + "." : t.pending ? `${t.pending === 1 ? "1 cosa pendiente" : `${t.pending} cosas pendientes`}.` : "Todo al día."}
        </span>
      </p>
    );
  }
  if (variant === "sum") {
    const more = [t.caja?.owes ? 1 : 0, t.poll && !t.poll.voted ? 1 : 0].reduce((a, b) => a + b, 0);
    return (
      <div className="vi-tu vi-tu--sum">
        <div>
          <h3 className="vi-sub">Lo que te toca</h3>
          <ToDo t={t} jornadaOf={jornadaOf} now={now} short />
        </div>
        <div className="vd-more">
          <span>
            {more ? <b>Y {more === 1 ? "1 cosa más" : `${more} cosas más`}</b> : <b>Lo tuyo</b>}, tu porra y {t.unread ? (t.unread === 1 ? "1 aviso" : `${t.unread} avisos`) : t.notices.length === 0 ? "tus avisos" : t.notices.length === 1 ? "1 aviso" : `${t.notices.length} avisos`}
          </span>
          <button type="button" className="vd-more__btn" onClick={onOpen}>
            Todo lo tuyo
            <Ico id="expand" />
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="vi-tu">
      <div className={region(2)}>
        <h3 className="vi-sub">Lo que te toca</h3>
        <ToDo t={t} jornadaOf={jornadaOf} now={now} short={false} />
      </div>
      <div className={region(3)}>
        <h3 className="vi-sub">Lo tuyo</h3>
        <Mine t={t} porraLine={porraLine} />
      </div>
      <div className={region(4)}>
        <h3 className="vi-sub">
          Avisos <span>{t.unread ? (t.unread === 1 ? "1 nuevo" : `${t.unread} nuevos`) : t.notices.length ? `${t.notices.length === 1 ? "el último" : `los ${t.notices.length} últimos`}` : ""}</span>
        </h3>
        <Notices t={t} />
      </div>
    </div>
  );
}
