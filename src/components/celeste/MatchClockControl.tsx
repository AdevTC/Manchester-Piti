import { useRef, useState } from "react";
import { clockLabel, clockReading, timeText, type ClockAction } from "../../../functions/src/matchClock";
import type { ClubMatch } from "../../lib/clubData";
import { apiError, controlMatchClock } from "../../lib/clubApi";
import { useClock } from "../../hooks/useClock";
import "./match-clock.css";

export function MatchClockDisplay({ match }: { match: Pick<ClubMatch, "clock"> }) {
  const now = useClock(1000);
  const r = clockReading(match.clock, now);
  return <span>{clockLabel(match.clock)} · {timeText(r.elapsedSeconds)}{r.phase === "halftime" ? ` · descanso ${timeText(r.breakSeconds)}` : ""}</span>;
}
export function MatchClockControl({ match, onFinish }: { match: ClubMatch; onFinish?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState<ClockAction | null>(null);
  const [error, setError] = useState("");
  const sending = useRef(false);
  const phase = match.clock?.phase ?? "ready";
  const terminal = ["finished", "cancelled", "postponed"].includes(match.status ?? "");
  const actions: { action: ClockAction; label: string; confirm?: boolean }[] = terminal ? [] : phase === "ready" ? [{ action: "start", label: "Iniciar partido · 1ª parte" }] : phase === "first" ? [{ action: "halftime", label: "Terminar 1ª parte" }, { action: "reset", label: "Cancelar inicio y reiniciar", confirm: true }] : phase === "halftime" ? [{ action: "second", label: "Iniciar 2ª parte" }, { action: "resume_first", label: "Deshacer el descanso", confirm: true }] : phase === "second" ? [{ action: "finish", label: "Pitar el final", confirm: true }, { action: "undo_second", label: "Cancelar inicio de 2ª parte", confirm: true }] : [{ action: "reopen", label: "Reabrir partido", confirm: true }];
  const run = async (action: ClockAction) => {
    if (sending.current) return;
    sending.current = true; setBusy(true); setError("");
    try { await controlMatchClock({ matchId: match.id, action, revision: match.clock?.revision ?? 0 }); setAsk(null); if (action === "finish") onFinish?.(); }
    catch (e) { setError(apiError(e)); }
    finally { sending.current = false; setBusy(false); }
  };
  return <section className="match-clock" aria-label="Reloj compartido del partido">
    <div className="mc-heading"><span>Reloj compartido · 2 × 25 min orientativos</span><strong><MatchClockDisplay match={match} /></strong></div>
    <p>Todos los anotadores ven el mismo reloj. El descanso no suma minutos jugados.</p>
    <div className="mc-actions">{actions.map(a => <button type="button" key={a.action} disabled={busy} onClick={() => a.confirm ? setAsk(a.action) : void run(a.action)}>{a.label}</button>)}</div>
    {ask && <div className="mc-confirm" role="group" aria-label="Confirmar cambio del reloj"><p>{ask === "reset" ? "Volverá a cero para todos. Si ya hay jugadas, tendrás que deshacerlas primero." : "Este cambio afectará al reloj de todos los anotadores y visitantes."}</p><button type="button" disabled={busy} onClick={() => void run(ask)}>Confirmar</button><button type="button" disabled={busy} onClick={() => setAsk(null)}>Cancelar</button></div>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
