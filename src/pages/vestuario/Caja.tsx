// «La caja» in the vestuario: the team's money as a shared ledger, for members only (the user decided
// that everyone sees everything). Your balance big («Debes 12,50 €» / «Al día · +3,00 €»), the jar, the
// cuota and «Cómo pagar», everyone's balance (who owes first, each with an icon and a word, never colour
// alone) and your own movements, folded (a void one stays, crossed out, «Anulado»). Read-only: the
// captains write in the Sala de control (/admin/caja). The sums are derived/caja's, the same listener and
// the same numbers as the admin's. A fan never mounts the reader: `Caja` renders nothing for him.
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { playerForSeason } from "../../lib/clubData";
import type { PlayerDoc } from "../../lib/schemas";
import { nameFor } from "../../lib/derived/names";
import { balanceOf, balanceRows, balanceState, dayLabel, fmtEuros, jarBalance, KIND_LABEL, type BalancePlayer, type BalanceState } from "../../lib/derived/caja";
import { cajaOpen, cuotaLine, howToPayText, myBalanceText, myMovs, rowAmount, signedAmount, STATE_WORD } from "../../lib/derived/cajaMember";
import { Icon, type IconName } from "../../components/celeste/icons";
import { PlayerLink } from "../../components/celeste/PlayerLink";
import { useCaja } from "./live";
import "../../styles/vestuario-caja.css";

const STATE_ICON: Record<BalanceState, IconName> = { debe: "minus", "al-dia": "check", "a-favor": "plus" };
const CLOSED_LINE = "La caja aún no está abierta: la abre un capitán en la sala de control.";

export interface CajaProps {
  /** Inside the vestuario (useViewer().member): only a member reads the caja. */
  member: boolean;
  admin: boolean;
  seasonId: string;
  /** The member's own player (null when his ficha is not linked yet). */
  playerId: string | null | undefined;
  players: readonly PlayerDoc[];
}

export function Caja(props: CajaProps) {
  if (!props.member || !props.seasonId) return null;
  return <CajaBlock {...props} />;
}

function CajaBlock({ admin, seasonId, playerId, players }: CajaProps) {
  const caja = useCaja(seasonId, true);
  const squad: BalancePlayer[] = useMemo(
    () =>
      players
        .filter((p) => (p.seasons ?? []).includes(seasonId))
        .map((p) => ({ id: p.id, name: nameFor(p, seasonId), number: playerForSeason(p, seasonId, []).number ?? null })),
    [players, seasonId],
  );
  const nameOf = useMemo(() => {
    const byId = new Map(players.map((p) => [p.id, p]));
    return (id: string) => nameFor(byId.get(id), seasonId);
  }, [players, seasonId]);
  const { movs, settings } = caja;
  const rows = useMemo(() => balanceRows(movs, squad, nameOf), [movs, squad, nameOf]);
  const mine = useMemo(() => myMovs(movs, playerId), [movs, playerId]);
  const open = cajaOpen(settings, movs);
  const adminLink = admin && (
    <Link className="cj-admin" to="/admin/caja">
      {open ? "Llevar la caja en la sala de control" : "Abrir la caja en la sala de control"}
      <Icon name="arrow" size={16} stroke={2.2} />
    </Link>
  );

  let body;
  if (caja.loading && !open) {
    body = (
      <p className="vx-sub" aria-busy="true">
        Contando la caja…
      </p>
    );
  } else if (caja.error && !open) {
    body = (
      <p className="vx-error" role="alert">
        No se pudo leer la caja. Prueba a recargar dentro de un rato.
      </p>
    );
  } else if (!open) {
    body = <p className="vx-empty-line cj-closed">{CLOSED_LINE}</p>;
  } else {
    const me = playerId ? balanceOf(movs, playerId) : null;
    const pay = howToPayText(settings);
    const cuota = cuotaLine(settings);
    const debtors = rows.filter((r) => r.state === "debe").length;
    body = (
      <div className="cj-cols">
        <div className="cj-side">
          <div className="cj-top">
            <div className={`cj-me${me !== null ? ` ${balanceState(me)}` : ""}`}>
              <span className="k">Tu saldo</span>
              {me !== null ? (
                <p className="big">
                  <Icon name={STATE_ICON[balanceState(me)]} size={26} stroke={2.6} />
                  <span>{myBalanceText(me)}</span>
                </p>
              ) : (
                <p className="cj-note">Cuando tu ficha esté vinculada verás aquí tu saldo.</p>
              )}
            </div>
            <div className="cj-jar">
              <span className="k">En el bote</span>
              <b>{fmtEuros(jarBalance(movs))}</b>
              {cuota && <small>{cuota}</small>}
            </div>
            <div className="cj-pay">
              <span className="k">Cómo pagar</span>
              <p>{pay || "Pregunta a un capitán cómo pagar."}</p>
            </div>
          </div>
          {playerId &&
            (mine.length ? (
              <details className="cj-mine">
                <summary>
                  <span>Tus movimientos · {mine.length}</span>
                  <Icon name="down" size={18} stroke={2.2} />
                </summary>
                <ul className="cj-movs" aria-label="Tus movimientos">
                  {mine.map((m) => (
                    <li key={m.id} className={`cj-mov ${m.kind}${m.void ? " void" : ""}`}>
                      <span className="d">{dayLabel(m.date)}</span>
                      <span className="w">
                        {m.void ? <s>{m.concept || KIND_LABEL[m.kind]}</s> : <b>{m.concept || KIND_LABEL[m.kind]}</b>}
                        <small>{KIND_LABEL[m.kind]}</small>
                      </span>
                      <span className="amt">
                        {m.void ? (
                          <>
                            <s>{signedAmount(m)}</s>
                            <span className="anul">
                              <Icon name="x" size={12} stroke={2.6} />
                              Anulado
                            </span>
                          </>
                        ) : (
                          signedAmount(m)
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : (
              <p className="cj-note">Aún no tienes movimientos en la caja.</p>
            ))}
        </div>
        <div className="cj-all">
          <h3 className="cj-h3" id="cj-all-h">
            Saldos del equipo
          </h3>
          <p className="cj-note">{debtors ? `${debtors === 1 ? "1 debe" : `${debtors} deben`} · primero quien debe` : "Nadie debe nada"}</p>
          {rows.length ? (
            <ul className="cj-rows" aria-labelledby="cj-all-h">
              {rows.map((r) => (
                <li key={r.id} className={`cj-row ${r.state}${r.id === playerId ? " you" : ""}`}>
                  <span className="n" aria-hidden="true">
                    {r.number ?? "·"}
                  </span>
                  <span className="nm">
                    <PlayerLink id={r.id} seasonId={seasonId} variant="quiet" className="cj-nm-l">
                      {r.name}
                    </PlayerLink>
                    {r.id === playerId && <small> · tú</small>}
                  </span>
                  <span className="st">
                    <Icon name={STATE_ICON[r.state]} size={14} stroke={2.6} />
                    {STATE_WORD[r.state]}
                  </span>
                  <span className="amt">{rowAmount(r.balance)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="cj-note">Esta temporada no tiene plantilla todavía.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <section className="vx-caja" id="vx-caja" aria-labelledby="vx-caja-h">
      <span className="vx-kick">El equipo · el dinero</span>
      <h2 className="vx-h2" id="vx-caja-h">
        La caja
      </h2>
      {body}
      {adminLink}
    </section>
  );
}
