// /vestuario/turnos · «Turnos» (CL- boards part-vestuario vx.g.turnos): the jobs of the next match, each with its icon
// and who does it («Tú, Kevin» and «Te toca» when it is his), then how they are handed out. Once the match is played,
// his own turn can be marked done (markTurnDone; the backend checks it is his). Without a rota, the app's words.
import { useState } from "react";
import { jobApplies, rotaMatch, turnDone } from "../../../lib/derived/rota";
import { useRota } from "../../../lib/useRotaTurns";
import { apiError } from "../../../lib/clubApi";
import { Go, I } from "../../club/cb/ui";
import { useSeasonRotaTurns } from "../live";
import { markTurnDone } from "../writes";
import type { VxCtx } from "./ctx";
import { turnPlayed, turnRows } from "./turnosModel";

const FOOT = "Los turnos los reparten los capitanes. ¿No puedes? Cámbialo con alguien y díselo al capitán.";

export function TurnosBlock({ c }: { c: VxCtx }) {
  const m = c.next;
  const off = !m || m.status === "cancelled" || m.status === "postponed";
  const rota = useRota(m?.seasonId ?? c.seasonId, !!c.uid);
  const mine = c.summary.myTurn;
  const canMark = !!m && !!mine && turnPlayed(m, c.now);
  const docs = useSeasonRotaTurns(m?.seasonId, canMark);
  const [sent, setSent] = useState<{ id: string; done: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const pins = m ? docs.data.find((d) => d.id === m.id)?.doc : undefined;
  const done = sent && m && sent.id === m.id ? sent.done : turnDone(pins, c.uid);

  if (!m) return <p className="cb-small">Sin partido a la vista: los turnos salen con el próximo.</p>;
  if (off) return <p className="cb-small">Sin turnos ni caja hasta que se juegue.</p>;
  if (rota.loading)
    return (
      <p className="cb-small" aria-busy="true">
        Cargando los turnos…
      </p>
    );
  if (rota.error && !c.summary.turns.length)
    return (
      <p className="cb-small" role="alert">
        No se han podido cargar los turnos. Prueba a recargar la página.
      </p>
    );
  if (!rota.data?.jobs.length)
    return (
      <>
        <p className="cb-small">Aún no hay turnos esta temporada.</p>
        {c.admin && (
          <div className="cb-row-acts">
            <Go className="vd-link" href="/admin/turnos">
              Crear los turnos
            </Go>
          </div>
        )}
      </>
    );

  const rows = turnRows(c.summary.turns, c.playerId, c.nameOf);
  // (jobs for this match but no turns yet: the season's turns are still loading)
  const rm = rotaMatch(m);
  const waiting = !rows.length && rota.data.jobs.some((j) => jobApplies(j, rm));
  if (waiting)
    return (
      <p className="cb-small" aria-busy="true">
        Cargando los turnos…
      </p>
    );
  const toggle = () => {
    if (!c.me || busy) return;
    const next = !done;
    setBusy(true);
    markTurnDone(c.me, m.id, next).then(
      (r) => {
        setBusy(false);
        setSent({ id: m.id, done: r });
        c.say(r ? "Turno hecho." : "Turno sin hacer.");
      },
      (e: unknown) => {
        setBusy(false);
        c.say(apiError(e));
      },
    );
  };

  return (
    <>
      {rows.length ? (
        <ul className="cb-turns">
          {rows.map((t) => (
            <li key={t.key} className={t.cls || undefined}>
              <span className="cb-turns__i" aria-hidden="true">
                <I n={t.icon} className={null} />
              </span>
              <div>
                <b>{t.job}</b>
                <span>{t.who}</span>
              </div>
              {t.mine && <span className="cb-turns__me">Te toca</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="cb-small">Este partido no tiene turnos.</p>
      )}
      {canMark && (
        <div className="cb-row-acts">
          <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm" aria-pressed={done} disabled={busy || !c.me} aria-busy={busy || undefined} onClick={toggle}>
            <I n="check" />
            {done ? "Hecho" : "Marcar como hecho"}
          </button>
        </div>
      )}
      <p className="cb-small">{FOOT}</p>
    </>
  );
}
