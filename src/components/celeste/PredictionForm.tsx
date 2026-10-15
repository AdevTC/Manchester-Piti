import { useId, useState } from "react";
import { predictionOpen, scorePrediction, type GoalPick, type Prediction } from "../../../functions/src/predictions";
import { nameFor, type ClubMatch } from "../../lib/clubData";
import type { PlayerDoc } from "../../lib/schemas";
import { apiError } from "../../lib/clubApi";
import { useMyPrediction } from "../../pages/vestuario/live";
import { predictScore, useMe } from "../../pages/vestuario/writes";
import { Icon } from "./icons";
import "./prediction.css";

export function PredictionInfo() {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <div className="pr-info">
    <button type="button" className="pr-info-btn" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}><span aria-hidden="true">ⓘ</span> Cómo se puntúa</button>
    {open && <div id={id} className="pr-rules">
      <h3>Los puntos de la porra</h3>
      <dl><div><dt>Marcador exacto</dt><dd>3 pts</dd></div><div><dt>Solo victoria, empate o derrota</dt><dd>1 pt</dd></div><div><dt>Cada gol del goleador elegido</dt><dd>+2 pts</dd></div><div><dt>Cada asistencia del jugador elegido</dt><dd>+1 pt</dd></div><div><dt>Goleador y asistente en la misma jugada</dt><dd>+3 pts</dd></div><div><dt>Goleador + «Sin asistencia», acertados</dt><dd>+3 pts</dd></div><div><dt>Cada gol acertado a partir del segundo</dt><dd>+2 pts</dd></div></dl>
      <p>El marcador da 3 o 1 punto; no se suman entre sí. Los demás puntos sí se suman. Clavar goleador y asistente da 6 puntos; clavar goleador sin asistencia, 5.</p>
      <p>Un pronóstico por cada gol del Piti. El orden no importa. Puedes repetir jugador, pero necesita marcar o asistir tantas veces. Cada gol real cuenta una vez en cada categoría. Goleador y asistente también puntúan por separado aunque no coincidan en la misma jugada.</p>
      <p>«No pronostico asistencia» no da puntos de asistencia ni de jugada. «Sin asistencia» es una apuesta explícita. Los autogoles cuentan para el marcador, pero no para estos aciertos.</p>
      <p>Editable hasta que se inicie el partido, aunque se retrase. Los puntos en directo son provisionales; el acta publicada y sus correcciones actualizan la clasificación. Las porras antiguas conservan sus puntos de marcador.</p>
    </div>}
  </div>;
}

export function PredictionForm({ match, players, uid }: { match: ClubMatch; players: PlayerDoc[]; uid: string }) {
  const saved = useMyPrediction(match.id, uid);
  const me = useMe();
  const [draft, setDraft] = useState<(Prediction & { matchId: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [announce, setAnnounce] = useState("");
  const value = draft?.matchId === match.id ? draft : saved.data ?? { goalsFor: 0, goalsAgainst: 0, goals: [] };
  const goals = Array.from({ length: value.goalsFor }, (_, i) => value.goals?.[i] ?? { playerId: "" });
  const candidates = players.filter((p) => p.active !== false && !!match.seasonId && p.seasons?.includes(match.seasonId)).sort((a, b) => nameFor(a, match.seasonId).localeCompare(nameFor(b, match.seasonId), "es"));
  const available = new Set(candidates.map((p) => p.id));
  const valid = goals.every((g) => available.has(g.playerId) && (!g.assistPlayerId || (available.has(g.assistPlayerId) && g.assistPlayerId !== g.playerId)));
  const changed = !saved.data || value.goalsFor !== saved.data.goalsFor || value.goalsAgainst !== saved.data.goalsAgainst || goals.length !== (saved.data.goals?.length ?? 0) || goals.some((g, i) => g.playerId !== saved.data?.goals?.[i]?.playerId || g.assistPlayerId !== saved.data?.goals?.[i]?.assistPlayerId);
  const open = predictionOpen(match);
  const set = (patch: Partial<Prediction>) => { setError(""); setAnnounce(""); setDraft({ ...value, goals, ...patch, matchId: match.id }); };
  const setGoal = (i: number, goal: GoalPick) => set({ goals: goals.map((g, at) => at === i ? goal : g) });
  const save = async () => {
    if (!me || !open || !valid || busy || saved.loading || saved.error) return;
    setBusy(true); setError("");
    try { await predictScore(me, match.id, value.goalsFor, value.goalsAgainst, goals); setDraft(null); setAnnounce(`Porra guardada: ${value.goalsFor} a ${value.goalsAgainst}.`); }
    catch (e) { setError(apiError(e)); }
    finally { setBusy(false); }
  };
  return <div className="pr-form">
    <PredictionInfo />
    <p className="sr-only" aria-live="polite">{announce}</p>
    <fieldset disabled={!open || busy || saved.loading || saved.error}>
      <legend className="sr-only">Tu pronóstico</legend>
      <div className="pr-score" role="group" aria-label={`Tu porra: Piti contra ${match.rival || "Rival"}`}>
        {([['Piti', 'goalsFor', 'del Piti'], [match.rival || 'Rival', 'goalsAgainst', 'del rival']] as const).map(([label, key, who]) => <div key={key}>
          <span className="pr-team">{label}</span><output aria-live="off">{value[key]}</output>
          <div className="pr-steps"><button type="button" aria-label={`Un gol menos ${who}`} disabled={value[key] === 0} onClick={() => set({ [key]: value[key] - 1, ...(key === 'goalsFor' ? { goals: goals.slice(0, -1) } : {}) })}>−</button><button type="button" aria-label={`Un gol más ${who}`} disabled={value[key] === 30} onClick={() => set({ [key]: value[key] + 1 })}>+</button></div>
        </div>)}
        <span className="pr-dash" aria-hidden="true">–</span>
      </div>
      {!!goals.length && <p className="pr-hint">Elige quién marca cada gol del Piti. La asistencia es opcional.</p>}
      <div className="pr-goals">{goals.map((g, i) => <div className="pr-goal" key={i}>
        <span className="pr-goal-no"><Icon name="ball" size={16} /> Gol {i + 1}</span>
        <label>Goleador<select aria-label={`Goleador del gol ${i + 1}`} value={g.playerId} onChange={(e) => setGoal(i, { playerId: e.target.value, ...(g.assistPlayerId === e.target.value ? {} : g.assistPlayerId !== undefined ? { assistPlayerId: g.assistPlayerId } : {}) })}>
          <option value="">Elegir jugador</option>{g.playerId && !available.has(g.playerId) && <option value={g.playerId} disabled>{nameFor(players.find((p) => p.id === g.playerId), match.seasonId)} · no disponible</option>}{candidates.map((p) => <option key={p.id} value={p.id}>{nameFor(p, match.seasonId)}</option>)}
        </select></label>
        <label><span><Icon name="boot" size={14} /> Asistencia</span><select aria-label={`Asistencia del gol ${i + 1}`} value={g.assistPlayerId === null ? 'none' : g.assistPlayerId ?? ''} onChange={(e) => setGoal(i, { playerId: g.playerId, ...(e.target.value ? { assistPlayerId: e.target.value === 'none' ? null : e.target.value } : {}) })}>
          <option value="">No pronostico asistencia</option><option value="none">Sin asistencia</option>{g.assistPlayerId && !available.has(g.assistPlayerId) && <option value={g.assistPlayerId} disabled>No disponible</option>}{candidates.filter((p) => p.id !== g.playerId).map((p) => <option key={p.id} value={p.id}>{nameFor(p, match.seasonId)}</option>)}
        </select></label>
      </div>)}</div>
      {open && <button type="button" className="vx-btn pr-save" disabled={!me || !valid || !changed} onClick={save}>{busy ? "Guardando…" : saved.data && !changed ? "Porra guardada" : saved.data ? "Cambiar mi porra" : "Guardar mi porra"}</button>}
    </fieldset>
    <p className="pr-hint">{!open ? "Porra cerrada. El pronóstico ya no se puede editar." : saved.loading ? "Cargando tu porra…" : goals.length && !valid ? "Completa los goleadores para guardar." : "Puedes cambiarla hasta el pitido inicial. Solo tú la ves antes del inicio."}</p>
    {(error || saved.error) && <p role="alert" className="fc-error">{error || "No se ha podido cargar tu porra. Recarga antes de editarla."}</p>}
  </div>;
}

export function PredictionResult({ prediction, match, players, provisional = false }: { prediction: Prediction; match: ClubMatch; players: PlayerDoc[]; provisional?: boolean }) {
  const points = scorePrediction(prediction, { goalsFor: match.goalsFor ?? 0, goalsAgainst: match.goalsAgainst ?? 0 }, match.events ?? []);
  return <div className="pr-result">
    <div className="pr-total"><span>{provisional ? "Puntos provisionales" : "Tus puntos del partido"}<small>Pronosticaste {prediction.goalsFor}–{prediction.goalsAgainst}</small></span><strong>{points.total}<small> pts</small></strong></div>
    <dl className="pr-breakdown">{[["Marcador", points.score], [`Goleadores · ${points.scorers} aciertos`, points.scorerPoints], [`Asistentes · ${points.assists} aciertos`, points.assistPoints], [`Jugadas clavadas · ${points.actions}`, points.actionPoints], ["Extra por varios goles", points.multiplePoints]].map(([label, pts]) => <div key={label}><dt>{label}</dt><dd>+{pts}</dd></div>)}</dl>
    {!!prediction.goals?.length && <ul className="pr-picks">{prediction.goals.map((g, i) => <li key={i}><Icon name="ball" size={14} /> {nameFor(players.find((p) => p.id === g.playerId), match.seasonId)}<small><Icon name="boot" size={14} /> {g.assistPlayerId === null ? "Sin asistencia" : g.assistPlayerId ? nameFor(players.find((p) => p.id === g.assistPlayerId), match.seasonId) : "Sin pronóstico de asistencia"}</small></li>)}</ul>}
    <PredictionInfo />
  </div>;
}
