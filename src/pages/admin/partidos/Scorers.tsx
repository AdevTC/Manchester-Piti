import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { apiError, setMatchScorers } from "../../../lib/clubApi";
import { useMatchScorers } from "../../vestuario/live";
import { useAdmin } from "../shell/context";
// (the panel borrows the clock card's look; the clock itself is la mesa's now)
import "../../../components/celeste/match-clock.css";

export function Scorers({ matchId }: { matchId: string }) {
  const { people } = useAdmin();
  const { data: selected, loading, error } = useMatchScorers(matchId);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const toggle = async (uid: string) => {
    setBusy(true); setMessage("");
    try { await setMatchScorers({ matchId, uids: selected.includes(uid) ? selected.filter(id => id !== uid) : [...selected, uid] }); }
    catch (e) { setMessage(apiError(e)); }
    finally { setBusy(false); }
  };
  return <section className="match-clock" aria-label="Anotadores designados">
    <h3>Anotadores del partido</h3><p>Los administradores ya tienen acceso. Autoriza a miembros del vestuario para controlar las partes y anotar jugadas en la mesa del partido. No podrán publicar actas ni acceder al resto de administración.</p>
    <div className="mc-actions">{(people ?? []).filter(p => !p.removed && !["admin", "superadmin"].includes(p.role)).map(p => <button key={p.uid} type="button" aria-pressed={selected.includes(p.uid)} disabled={busy || loading || error} onClick={() => void toggle(p.uid)}>{selected.includes(p.uid) ? "✓ " : "+ "}{p.nickname || p.displayName || p.email}</button>)}</div>
    <Link to="/matches/$matchId/mesa" params={{ matchId }}>Abrir la mesa</Link>
    {(message || error) && <p role="alert">{message || "No se pudieron cargar los permisos de anotación."}</p>}
  </section>;
}
