import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import { apiError, resolvePlayerClaim } from "../../lib/clubApi";
import { playerName, useClubData } from "../../lib/clubData";
import { usePendingClaims } from "../vestuario/live";

/** Admin review of account ↔ player claims, plus the accounts already linked. */
export function PlayerClaims({ pendingOnly = false }: { pendingOnly?: boolean }) {
  const pending = usePendingClaims(true);
  const { players } = useClubData();
  const [linked, setLinked] = useState<{ uid: string; nickname: string; playerId: string }[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (pendingOnly) return;
    return onSnapshot(
      query(collection(db, "users"), where("playerId", "!=", "")),
      (s) => setLinked(s.docs.map((d) => ({ uid: d.id, nickname: d.get("nickname") ?? "", playerId: d.get("playerId") }))),
      () => setLinked([]),
    );
  }, [pendingOnly]);
  const decide = async (uid: string, approve: boolean) => {
    setBusy(uid);
    setError("");
    try {
      await resolvePlayerClaim({ uid, approve });
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy("");
    }
  };
  const name = (id: string) => playerName(players.find((p) => p.id === id));
  if (pendingOnly && !pending.data.length) return null;
  return (
    <section className="club-panel" aria-labelledby="claims-title">
      <span className="club-kicker">VESTUARIO</span>
      <h2 id="claims-title">Fichas de jugador</h2>
      <p className="club-muted">Cada miembro reclama su ficha desde el vestuario. Al aprobarla, su cartel muestra su nombre, su dorsal y sus números.</p>
      {error && (
        <p className="club-error" role="alert">
          {error}
        </p>
      )}
      {pending.data.length === 0 ? (
        <p className="club-muted">No hay solicitudes pendientes.</p>
      ) : (
        <ul className="club-response-list" aria-label="Solicitudes pendientes">
          {pending.data.map((c) => (
            <li key={c.uid}>
              <span>
                <b>{c.nickname || c.email}</b> pide la ficha de <b>{name(c.playerId) || c.playerName}</b>
                <small> · {c.email}</small>
              </span>
              <span className="club-actions">
                <button className="club-button" disabled={busy === c.uid} onClick={() => void decide(c.uid, true)}>
                  Aprobar
                </button>
                <button className="club-button secondary" disabled={busy === c.uid} onClick={() => void decide(c.uid, false)}>
                  Rechazar
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {linked.length > 0 && (
        <details>
          <summary>Cuentas vinculadas ({linked.length})</summary>
          <ul className="club-response-list">
            {linked.map((l) => (
              <li key={l.uid}>
                <span>
                  <b>{l.nickname}</b> → {name(l.playerId)}
                </span>
                <button className="club-text-link" disabled={busy === l.uid} onClick={() => void decide(l.uid, false)}>
                  Desvincular
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
