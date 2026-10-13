import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { apiError, setMatchScorers } from "../../../lib/clubApi";
import { useMatchScorers } from "../../vestuario/live";
import { useAdmin } from "../shell/context";

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
    <h3>Anotadores del partido</h3><p>Los administradores ya tienen acceso. Autoriza a miembros del vestuario para controlar las partes y anotar jugadas desde la ficha del partido. No podrán publicar actas ni acceder al resto de administración.</p>
    <div className="mc-actions">{(people ?? []).filter(p => !p.removed && !["admin", "superadmin"].includes(p.role)).map(p => <button key={p.uid} type="button" aria-pressed={selected.includes(p.uid)} disabled={busy || loading || error} onClick={() => void toggle(p.uid)}>{selected.includes(p.uid) ? "✓ " : "+ "}{p.nickname || p.displayName || p.email}</button>)}</div>
    <Link to="/matches/$matchId" params={{ matchId }}>Abrir la mesa en la ficha del partido</Link>
    {(message || error) && <p role="alert">{message || "No se pudieron cargar los permisos de anotación."}</p>}
  </section>;
}
