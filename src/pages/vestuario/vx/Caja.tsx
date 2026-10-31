// /vestuario/caja · «La caja» (the canvas prototype's SalaCaja.dc.html): the title is his status («Debes 12,50 €»,
// «Pago avisado», «Al día · 3,00 € a favor», «Estás al día»; «La caja del equipo» without a ficha), his saldo card with
// «Ya la he pagado» while he owes (and «Deshacer el aviso» while no captain has answered), his movements newest first
// (a void one crossed out, «Anulado») with what was charged and paid, the bote with the cuota and «Cómo pagar», and
// the team's balances, who owes first. Read-only otherwise: the captains keep it in the sala de control (/admin/caja).
import { useMemo, useState } from "react";
import "../../../styles/vestuario/caja.css";
import type { BalancePlayer } from "../../../lib/derived/caja";
import { cajaOpen } from "../../../lib/derived/cajaMember";
import { unclaimPayment } from "../../match/partido/vestuarioWrites";
import { Go } from "../../club/cb/ui";
import { claimPayment } from "../writes";
import type { VxCtx } from "./ctx";
import { CAJA_CLAIM_CONCEPT, CAJA_CLAIMED_LINE, cajaHead, cajaMe, cajaMovRows, cajaMovSums, cajaPot, cajaTeam } from "./cajaModel";
import { Ic, PShirt, RoomHead } from "./kit";

const errText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);
const UNCLAIM_FAILED = "No se ha podido deshacer el aviso. Puede que un capitán ya lo haya apuntado.";

export function CajaBlock({ c }: { c: VxCtx }) {
  const { caja, claim } = c.summary;
  const { movs, settings } = caja;
  const pid = c.playerId;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const squad: BalancePlayer[] = useMemo(() => c.squad.map((p) => ({ id: p.id, name: p.name, number: p.num && Number.isFinite(Number(p.num)) ? Number(p.num) : null })), [c.squad]);
  const team = useMemo(() => cajaTeam(movs, squad, c.nameOf, pid), [movs, squad, c.nameOf, pid]);
  const mine = useMemo(() => cajaMovRows(movs, pid), [movs, pid]);
  const sums = useMemo(() => cajaMovSums(movs, pid), [movs, pid]);
  const me = cajaMe(movs, pid, !!claim);
  const pot = cajaPot(movs, settings);
  const open = cajaOpen(settings, movs);
  const socio = !pid;
  const head = cajaHead(me, { open, socio });

  const capAct = (pri: boolean) =>
    c.admin && (
      <Go className={`vd-glass vd-press nx-btn${pri ? " nx-btn--pri" : ""}`} href="/admin/caja">
        {!pri && <Ic name="flag" />}
        {open ? "Llevar la caja en la sala de control" : "Abrir la caja en la sala de control"}
      </Go>
    );

  const roomHead = (title: string, sub: string) => <RoomHead room="caja" icon="euro" warn={me.canClaim && open} kick="La caja · el dinero del equipo" title={title} sub={sub} acts={capAct(false) || undefined} />;

  if (!open) {
    if (caja.loading || caja.error)
      return (
        <section className="vcj" aria-labelledby="ve-room-h">
          {roomHead("La caja del equipo", "Solo la lees: la llevan los capitanes.")}
          {caja.loading ? (
            <p className="nx-meta" aria-busy="true">
              Contando la caja…
            </p>
          ) : (
            <p className="ve-err" role="alert">
              No se pudo leer la caja. Prueba a recargar dentro de un rato.
            </p>
          )}
        </section>
      );
    return (
      <section className="vcj" aria-labelledby="ve-room-h">
        {roomHead(head.title, head.sub)}
        <div className="ve-empty">
          <span className="ve-tile" aria-hidden="true">
            <Ic name="lock" />
          </span>
          <h2>Aquí irán el bote, la cuota y tu saldo</h2>
          <p>La abre un capitán en la sala de control. En cuanto esté abierta verás aquí lo que debes, el bote, la cuota y cómo pagar, y podrás avisar cuando pagues.</p>
          {c.admin && <div className="ve-acts">{capAct(true)}</div>}
        </div>
      </section>
    );
  }

  const pay = () => {
    if (!c.me || !me.canClaim || busy) return;
    setBusy(true);
    setError("");
    claimPayment(c.me, { seasonId: c.seasonId, concept: CAJA_CLAIM_CONCEPT, amount: me.owed }).then(
      (ref) => {
        setBusy(false);
        // «Deshacer» takes back exactly the claim just written (its id), while no captain has answered it
        c.say("Avisado: el capitán lo apunta en la caja.", () => {
          unclaimPayment(ref.id).then(
            () => c.say("Aviso deshecho."),
            () => setError(UNCLAIM_FAILED),
          );
        });
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
        setError(UNCLAIM_FAILED);
      },
    );
  };

  return (
    <section className="vcj" aria-labelledby="ve-room-h">
      {roomHead(head.title, head.sub)}
      {/* (open but a listener failed: the numbers may be short, so it says so instead of passing for empty) */}
      {caja.error && (
        <p className="ve-err" role="alert">
          No se pudo leer toda la caja: puede que falten movimientos. Prueba a recargar dentro de un rato.
        </p>
      )}
      <div className="ve-cols">
        <div className="ve-stack">
          <section className={`vd-glass vd-glass--deep ve-card vcj-me ${me.cls}`.trim()} aria-labelledby="vcj-me-h">
            <p className="ve-card__k" id="vcj-me-h">
              Tu saldo
            </p>
            <div className="vcj-me__amt">
              <span className="ve-big">{me.amt}</span>
              <span className={`ve-st ${me.stCls}`}>{me.state}</span>
            </div>
            <p className="vcj-me__line">{me.line}</p>
            {me.canClaim && (
              <div className="ve-acts">
                <button type="button" className="vd-glass vd-press nx-btn nx-btn--pri" disabled={busy || !c.me} aria-busy={busy || undefined} onClick={pay}>
                  <Ic name="check" />
                  {busy ? "Avisando…" : "Ya la he pagado"}
                </button>
                <span className="vcj-me__line">El capitán lo apunta y tu saldo se pone al día.</span>
              </div>
            )}
            {me.claimed && (
              <div className="vcj-claim" role="status">
                <b>Avisado.</b>
                <span>{CAJA_CLAIMED_LINE}</span>
                {claim && (
                  <button type="button" className="nx-lnk" style={{ minHeight: 44, justifySelf: "start" }} disabled={busy} onClick={unpay}>
                    Deshacer el aviso
                  </button>
                )}
              </div>
            )}
            {error && (
              <p className="ve-err" role="alert">
                {error}
              </p>
            )}
          </section>

          <section className="nx-sec" aria-labelledby="vcj-mov-h">
            <div className="nx-sec__head">
              <h2 className="nx-h3" id="vcj-mov-h">
                Tus movimientos
              </h2>
              <p className="nx-meta">El más nuevo arriba</p>
            </div>
            {mine.length ? (
              <>
                <ul className="ve-list vcj-mov" aria-label="Tus movimientos en la caja">
                  {mine.map((m) => (
                    <li key={m.id} className={`ve-row${m.void ? " is-void" : ""}`}>
                      <span className="ve-tile" aria-hidden="true">
                        <Ic name={m.plus ? "check" : "euro"} />
                      </span>
                      <span className="ve-row__t">
                        <b>{m.t}</b>
                        <span>
                          {m.d}
                          {m.void && " · Anulado"}
                        </span>
                      </span>
                      <span className={`ve-row__v${m.plus && !m.void ? " vcj-plus" : ""}`}>{m.a}</span>
                    </li>
                  ))}
                </ul>
                <p className="vcj-sum">
                  <span>Cargado: {sums.charged}</span>
                  <span>Pagado: {sums.paid}</span>
                </p>
              </>
            ) : (
              <p className="nx-meta">{pid ? "Aún no tienes movimientos en la caja." : "Cuando tu ficha esté vinculada verás aquí tu saldo y tus movimientos."}</p>
            )}
          </section>
        </div>

        <div className="ve-side ve-stack">
          <section className="ve-panel vcj-bote" aria-labelledby="vcj-bote-h">
            <h2 className="nx-h3" id="vcj-bote-h">
              El bote
            </h2>
            <div className="vcj-me__amt">
              <span className="ve-big">{pot.bote}</span>
              <span className="nx-meta">en el bote</span>
            </div>
            {pot.cuota && <p className="nx-meta">{pot.cuota}</p>}
            <div className="vcj-how">
              <b>Cómo pagar</b>
              <p>{pot.pay}</p>
            </div>
          </section>

          <section className="ve-panel" aria-labelledby="vcj-team-h">
            <div className="nx-sec__head" style={{ marginBottom: 4 }}>
              <h2 className="nx-h3" id="vcj-team-h">
                Saldos del equipo
              </h2>
              <p className="nx-meta">{team.line}</p>
            </div>
            {team.rows.length ? (
              <ul className="ve-list vcj-team" aria-label="Saldos del equipo">
                {team.rows.map((r) => (
                  <li key={r.id} className={`ve-row${r.you ? " is-me" : ""}`}>
                    <PShirt n={r.num} />
                    <span className="ve-row__t">
                      <b>
                        {r.name}
                        {r.you && <span className="ve-you">tú</span>}
                      </b>
                    </span>
                    <span className={`ve-row__v ${r.state === "debe" ? "vcj-warn" : r.state === "a-favor" ? "vcj-fav" : "nx-meta"}`}>{r.word}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="nx-meta">Esta temporada no tiene plantilla todavía.</p>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}
