// Convocar's «Turnos» panel: this match's turns (lib/derived/rota turnsFor, the same the web and the «Te
// toca…» notice read), and the captain's overrides — «Cambiar» before the match, «Lo hizo otro» after it
// (both rotaTurns/{matchId}[jobId] = { playerId, swappedFrom }), «Volver al turno» to drop one. An override
// changes only this match: the rota goes on as computed.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import type { ClubMatch } from "../../../lib/clubData";
import type { Turn } from "../../../lib/derived/rota";
import { useMatchTurns } from "../../../lib/useRotaTurns";
import { RotaIcon } from "../../../components/celeste/Turnos";
import { useTurnosWrites } from "../data/useTurnos";
import { useAdmin } from "../shell/context";
import { AdIcon } from "../ui/icons";
import { useToast } from "../ui/toastContext";
import "../turnos/turnos.css";

export function TurnosPanel({ match, roster, nameOf }: { match: ClubMatch; roster: readonly { id: string; name: string }[]; nameOf: (id: string) => string }) {
  const data = useAdmin();
  const published = data.published.find((m) => m.id === match.id) ?? match;
  const { turns, rota, loading } = useMatchTurns(published, data.published, true);
  const played = published.status === "finished";
  if (loading) return null;
  return (
    <section className="calm tu-panel" aria-labelledby={`tu-p-${match.id}`}>
      <h3 id={`tu-p-${match.id}`}>Turnos</h3>
      {!rota?.jobs.length ? (
        <p className="hint">
          Aún no hay turnos esta temporada. <Link to="/admin/turnos">Crear los turnos</Link>
        </p>
      ) : !turns.length ? (
        <p className="hint">Ningún turno en este partido (el coche, solo fuera de casa).</p>
      ) : (
        <ul className="tu-turns">
          {turns.map((t) => (
            <TurnRow key={t.job.id} matchId={match.id} turn={t} played={played} roster={roster} nameOf={nameOf} />
          ))}
        </ul>
      )}
    </section>
  );
}

function TurnRow({ matchId, turn: t, played, roster, nameOf }: { matchId: string; turn: Turn; played: boolean; roster: readonly { id: string; name: string }[]; nameOf: (id: string) => string }) {
  const writes = useTurnosWrites();
  const toast = useToast();
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const label = t.job.name;
  const run = async (f: () => Promise<void>, ok: string) => {
    setBusy(true);
    try {
      await f();
      setPick("");
      toast.show({ tag: "TURNOS", message: ok });
    } catch (e) {
      toast.show({ tag: "TURNOS", message: `No se ha podido cambiar: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setBusy(false);
    }
  };
  const swap = () => pick && void run(() => writes.pin(matchId, t.job.id, pick, t.computed), `${label}: ${nameOf(pick)}`);
  return (
    <li className="tu-turn">
      <RotaIcon icon={t.job.icon} size={18} />
      <span className="job">{label}</span>
      <span className="who">{t.playerId ? `${played ? "Lo hizo" : "Le toca a"} ${nameOf(t.playerId)}` : "Nadie disponible"}</span>
      {t.pinned && t.swappedFrom && <span className="note">Cambio del capitán · le tocaba a {nameOf(t.swappedFrom)}</span>}
      {!t.pinned && t.skipped.length > 0 && <span className="note">Se salta a {t.skipped.map(nameOf).join(", ")} (no puede o está ausente)</span>}
      <div className="ctl">
        <label className="sr" htmlFor={`tu-${matchId}-${t.job.id}`}>
          {played ? `Quién lo hizo: ${label}` : `Quién lo hace: ${label}`}
        </label>
        <select id={`tu-${matchId}-${t.job.id}`} className="inp" value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="">{played ? "Lo hizo…" : "Cambiar por…"}</option>
          {roster
            .filter((p) => p.id !== t.playerId)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </select>
        <button type="button" className="btn sm line" onClick={swap} disabled={!pick || busy}>
          <AdIcon name="swap" size={15} />
          {played ? "Lo hizo otro" : "Cambiar"}
        </button>
        {t.pinned && (
          <button type="button" className="btn sm line" disabled={busy} onClick={() => void run(() => writes.unpin(matchId, t.job.id), `${label}: vuelve al turno`)}>
            <AdIcon name="undo" size={15} />
            Volver al turno
          </button>
        )}
      </div>
    </li>
  );
}
