import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { apiError, resolvePlayerClaim } from "../../lib/clubApi";
import type { Claim } from "./live";
import { Icon } from "../../components/celeste/icons";

interface Props {
  hasNext: boolean;
  claims: Claim[];
  linked: number;
  squad: number;
  fichaName: (claim: Claim) => string;
}
/** "Modo capitán": what an admin can unblock for the team, right on their cartel. */
export function CaptainStrip({ hasNext, claims, linked, squad, fichaName }: Props) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const pendingTasks = (hasNext ? 0 : 1) + (claims.length ? 1 : 0);
  const coverage = squad > 0 && linked < squad;
  if (!pendingTasks && !coverage) return null;
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
  return (
    <section className="vx-cap" aria-labelledby="vx-cap-title">
      <div className="vx-cap-head">
        <h2 id="vx-cap-title">
          Modo capitán
          {pendingTasks > 0 && (
            <i>
              {pendingTasks}
              <span className="vx-sr"> {pendingTasks === 1 ? "tarea pendiente" : "tareas pendientes"}</span>
            </i>
          )}
        </h2>
        <Link to="/admin" search={{ tab: "matches" }}>
          Administración ↗
        </Link>
      </div>
      <div className="vx-cap-grid">
        {!hasNext && (
          <div className="vx-captask">
            <b>Publica el próximo partido</b>
            <p>Desbloquea convocatoria, porra y carteles del equipo.</p>
            <div className="vx-row">
              <Link className="vx-mini-btn" to="/admin" search={{ tab: "matches" }}>
                <Icon name="plus" size={14} stroke={2.4} />
                Programar
              </Link>
            </div>
          </div>
        )}
        {claims.length > 0 && (
          <div className="vx-captask wide">
            <b>
              {claims.length} {claims.length === 1 ? "ficha por aprobar" : "fichas por aprobar"}
            </b>
            <ul>
              {claims.slice(0, 3).map((c) => (
                <li key={c.uid} className="vx-claimrow">
                  <span>
                    <b>{c.nickname || c.email}</b> → {fichaName(c)}
                  </span>
                  <button type="button" className="vx-mini-btn sky" disabled={busy === c.uid} onClick={() => void decide(c.uid, true)}>
                    Aprobar<span className="vx-sr"> la ficha de {c.nickname || c.email}</span>
                  </button>
                  <button type="button" className="vx-mini-btn x" disabled={busy === c.uid} onClick={() => void decide(c.uid, false)} aria-label={`Rechazar la ficha de ${c.nickname || c.email}`}>
                    <Icon name="x" size={14} stroke={2.2} />
                  </button>
                </li>
              ))}
            </ul>
            {claims.length > 3 && (
              <Link className="vx-cap-more" to="/admin" search={{ tab: "matches" }}>
                Ver las {claims.length}
              </Link>
            )}
            {error && (
              <p className="vx-error" role="alert">
                {error}
              </p>
            )}
          </div>
        )}
        {coverage && (
          <div className="vx-captask">
            <b>
              {linked} de {squad} con ficha
            </b>
            <p>Recuérdale al equipo que reclame la suya desde el vestuario.</p>
            <div className="vx-pbar sky" role="progressbar" aria-label="Plantilla con ficha vinculada" aria-valuemin={0} aria-valuemax={squad} aria-valuenow={linked}>
              <i style={{ width: `${Math.round((linked / squad) * 100)}%` }} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
