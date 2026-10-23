// /vestuario/caja · «La caja» (CL- boards part-vestuario vx.g.caja): his saldo («Debes 5,00 €» / «Pago avisado» /
// «Al día» / «Sin ficha todavía») with «Ya la he pagado» while he owes (and its undo while no captain has answered),
// the bote with the cuota and «Cómo pagar», his movements (a void one crossed out, «Anulado») and the team's
// balances, who owes first. Read-only otherwise: the captains keep it in the sala de control (/admin/caja).
import { useMemo, useState } from "react";
import type { BalancePlayer } from "../../../lib/derived/caja";
import { cajaOpen } from "../../../lib/derived/cajaMember";
import { unclaimPayment } from "../../match/partido/vestuarioWrites";
import { Go, I } from "../../club/cb/ui";
import { claimPayment } from "../writes";
import type { VxCtx } from "./ctx";
import { CAJA_CLAIM_CONCEPT, CAJA_CLAIMED_LINE, CAJA_CLOSED_LINE, cajaMe, cajaMovRows, cajaPot, cajaTeam } from "./cajaModel";

const errText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

export function CajaBlock({ c }: { c: VxCtx }) {
  const { caja, claim } = c.summary;
  const { movs, settings } = caja;
  const pid = c.playerId;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const squad: BalancePlayer[] = useMemo(() => c.squad.map((p) => ({ id: p.id, name: p.name, number: p.num && Number.isFinite(Number(p.num)) ? Number(p.num) : null })), [c.squad]);
  const team = useMemo(() => cajaTeam(movs, squad, c.nameOf, pid), [movs, squad, c.nameOf, pid]);
  const mine = useMemo(() => cajaMovRows(movs, pid), [movs, pid]);
  const me = cajaMe(movs, pid, !!claim);
  const pot = cajaPot(movs, settings);
  const open = cajaOpen(settings, movs);

  const adminLink = c.admin && (
    <Go className="vd-link" href="/admin/caja">
      {open ? "Llevar la caja en la sala de control" : "Abrir la caja en la sala de control"}
    </Go>
  );

  if (!open) {
    let line;
    if (caja.loading)
      line = (
        <p className="cb-small" aria-busy="true">
          Contando la caja…
        </p>
      );
    else if (caja.error)
      line = (
        <p className="cb-small" role="alert">
          No se pudo leer la caja. Prueba a recargar dentro de un rato.
        </p>
      );
    else line = <p className="cb-small">{CAJA_CLOSED_LINE}</p>;
    return (
      <div className="cb-caja">
        {line}
        {adminLink}
      </div>
    );
  }

  const pay = () => {
    if (!c.me || !me.canClaim || busy) return;
    setBusy(true);
    setError("");
    claimPayment(c.me, { seasonId: c.seasonId, concept: CAJA_CLAIM_CONCEPT, amount: me.owed }).then(
      () => {
        setBusy(false);
        c.say("Avisado: el capitán lo apunta en la caja.");
      },
      (e: unknown) => {
        setBusy(false);
        setError(errText(e, "No se ha podido avisar del pago. Inténtalo otra vez."));
      },
    );
  };
  const unpay = () => {
    if (!claim || busy) return;
    setBusy(true);
    setError("");
    unclaimPayment(claim.id).then(
      () => {
        setBusy(false);
        c.say("Aviso deshecho.");
      },
      () => {
        setBusy(false);
        setError("No se ha podido deshacer el aviso. Puede que un capitán ya lo haya apuntado.");
      },
    );
  };

  return (
    <div className="cb-caja">
      {/* (open but a listener failed: the numbers may be short, so it says so instead of passing for empty) */}
      {caja.error && (
        <p className="cb-small" role="alert">
          No se pudo leer toda la caja: puede que falten movimientos. Prueba a recargar dentro de un rato.
        </p>
      )}
      <div className={`cb-caja__me ${me.cls}`.trim()}>
        <span className="vd-label">Tu saldo</span>
        <b>{me.state}</b>
        <span>{me.line}</span>
        {me.canClaim && (
          <button type="button" className="vd-glass vd-press vd-btn vd-btn--pri vd-btn--sm" disabled={busy || !c.me} aria-busy={busy || undefined} onClick={pay}>
            {busy ? "Avisando…" : "Ya la he pagado"}
          </button>
        )}
        {me.claimed && (
          <>
            <p className="cb-ok" role="status">
              <I n="check" />
              {CAJA_CLAIMED_LINE}
            </p>
            {claim && (
              <div className="cb-row-acts">
                <button type="button" className="vd-link" disabled={busy} onClick={unpay}>
                  Deshacer el aviso
                </button>
              </div>
            )}
          </>
        )}
        {error && (
          <p className="cb-small" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="cb-caja__pot">
        <p className="vd-count">
          <b>{pot.bote}</b>
          <span>en el bote</span>
        </p>
        {pot.cuota && <p className="cb-small">{pot.cuota}</p>}
        <p className="cb-small" style={{ whiteSpace: "pre-line" }}>
          <b>Cómo pagar.</b> {pot.pay}
        </p>
      </div>
      <div className="cb-caja__movs">
        <h4>Tus movimientos</h4>
        {mine.length ? (
          <ul aria-label="Tus movimientos">
            {mine.map((m) => (
              <li key={m.id}>
                {m.void ? (
                  <span>
                    <s>{m.t}</s> · Anulado
                  </span>
                ) : (
                  <span>{m.t}</span>
                )}
                <b>{m.void ? <s>{m.a}</s> : m.a}</b>
                <span>{m.d}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="cb-small">{pid ? "Aún no tienes movimientos en la caja." : "Cuando tu ficha esté vinculada verás aquí tu saldo y tus movimientos."}</p>
        )}
      </div>
      <div className="cb-caja__team">
        <h4>Saldos del equipo</h4>
        <p className="cb-small">{team.line}</p>
        {team.rows.length ? (
          <ul aria-label="Saldos del equipo">
            {team.rows.map((r) => (
              <li key={r.id}>
                <span>
                  {r.name}
                  {r.you && " · tú"}
                </span>
                <b>{r.word}</b>
              </li>
            ))}
          </ul>
        ) : (
          <p className="cb-small">Esta temporada no tiene plantilla todavía.</p>
        )}
      </div>
      {adminLink}
    </div>
  );
}
