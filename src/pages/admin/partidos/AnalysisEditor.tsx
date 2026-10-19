import { useEffect, useMemo, useRef, useState } from "react";
import { ACTION_LABELS, OUTCOME_LABELS, actionProblem, isAnalysisAction, type Outcome } from "../../../../functions/src/matchAnalysis";
import { EVENT_LABELS, type MatchEvent, type MatchSheet } from "../../../../functions/src/matchEngine";
import { eventSchema } from "../../../../functions/src/eventSchema";
import { correctNarrationEvent, correctNarrationObservation, narrationContext, previewNarration, resolveNarrationQuestion } from "../../../lib/narration";
import { newId, removeEvent, upsertEvent } from "../acta/sheetModel";
import type { PlayerInfo } from "./TabActa";
import { NarratedObservations } from './NarratedObservations';
import type { Observation } from '../../../../functions/src/narrated/types';
import { analysisProblem } from '../../../../functions/src/narrated/schema';
import { NarrationReview } from "./NarrationReview";
import "./analysis-editor.css";

export function AnalysisEditor({ matchId, sheet, update, info }: { matchId: string; sheet: MatchSheet; update: (fn: (s: MatchSheet) => MatchSheet) => void; info: (id: string) => PlayerInfo }) {
  const [text, setText] = useState("");
  const [context, setContext] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<ReturnType<typeof previewNarration> | null>(null);
  const [event, setEvent] = useState<MatchEvent | null>(null);
  const [importEditing, setImportEditing] = useState(false);
  const eventForm = useRef<HTMLDivElement>(null);
  const editEventId = event?.id;
  useEffect(() => { if (editEventId) { eventForm.current?.focus(); eventForm.current?.scrollIntoView?.({ block: "nearest" }); } }, [editEventId]);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(0);
  const roster = [...sheet.starters, ...sheet.bench].map(id => ({ id, ...info(id) }));
  const list = useMemo(() => sheet.events.filter(e => isAnalysisAction(e.type)).filter(e => !filter || e.type === filter), [sheet.events, filter]);
  const set = (patch: Partial<MatchEvent>) => setEvent(e => e ? { ...e, ...patch } : e);
  const changeType = (type: MatchEvent["type"]) => setEvent(e => e ? {
    ...e, type, outcome: isAnalysisAction(type) ? "unknown" : undefined,
    team: type.startsWith("opponent_") ? "opponent" : isAnalysisAction(type) ? e.team : "us",
    ...(type.startsWith("opponent_") ? { playerId: undefined } : {}),
    receiverId: undefined, keyPass: undefined, assistPlayerId: undefined, assistReviewed: undefined,
    inPlayerId: undefined, possessionSeconds: undefined,
  } : e);
  const trySave = () => {
    if (!event) return;
    const parsed = eventSchema.safeParse(Object.fromEntries(Object.entries(event).filter(([,v]) => v !== undefined && v !== "")));
    const why = parsed.success ? actionProblem(parsed.data) : parsed.error.issues.map(i => i.message).join(" ");
    if (why || !parsed.success) { setMessage(why ?? "Revisa la jugada."); return; }
    if (parsed.data.minute == null && !parsed.data.timingUnknown) { setMessage("Indica el minuto o marca que no se conoce."); return; }
    if (importEditing) {
      try { const corrected = correctNarrationEvent(text, parsed.data); const next = previewNarration(corrected, matchId, sheet); setText(corrected); setPreview(next); setEvent(null); setImportEditing(false); setMessage("Acción corregida en la importación. El acta aún no ha cambiado."); }
      catch (e) { setMessage((e as Error).message); }
      return;
    }
    update(s => upsertEvent(s, parsed.data)); setEvent(null); setMessage("Acción incorporada al borrador. Publica el acta para actualizar las estadísticas.");
  };
  const importPreview = () => { try { setPreview(previewNarration(text, matchId, sheet)); setMessage(""); } catch (e) { setPreview(null); setMessage((e as Error).message); } };
  const apply = () => {
    if (event) { setMessage("Guarda o cancela la acción que estás editando antes de incorporar la importación."); return; }
    try { const fresh = previewNarration(text, matchId, sheet); if (fresh.errors.length) { setPreview(fresh); return; } if (preview?.baseFingerprint !== fresh.baseFingerprint) { setPreview(fresh); setMessage("El borrador ha cambiado durante la revisión. Comprueba la comparación actualizada antes de incorporarla."); return; } update(() => fresh.sheet); setPreview(null); setText(""); setMessage("Análisis incorporado al borrador. Revisa y publica el acta para actualizar la web."); }
    catch (e) { setMessage((e as Error).message); }
  };
  const resolve = (index: number, resolution: string) => { try { const corrected = resolveNarrationQuestion(text, index, resolution); setPreview(previewNarration(corrected, matchId, sheet)); setText(corrected); setMessage("Resolución guardada en la revisión. Comprueba las acciones antes de incorporarlas."); } catch (e) { setMessage((e as Error).message); } };
  const editObservation = (observation: Observation) => { const corrected = correctNarrationObservation(text, observation); const next = previewNarration(corrected, matchId, sheet); setText(corrected); setPreview(next); setMessage('Detalle corregido en la importación. El acta aún no ha cambiado.'); };
  const saveObservation = (observation: Observation) => { if (!sheet.analysis) return; const analysis = { ...sheet.analysis, observations: sheet.analysis.observations.map(o => o.id === observation.id ? observation : o) }; const problem = analysisProblem(analysis, sheet.events, [...sheet.starters,...sheet.bench,...sheet.notCalled], sheet.durationSeconds ?? sheet.duration * 60); if (problem) throw new Error(problem); update(s => ({ ...s, analysis })); setMessage('Detalle corregido en el borrador. Publica el acta para actualizar Números.'); };
  const copy = async () => { const value = narrationContext(matchId, sheet, roster); setContext(value); try { await navigator.clipboard.writeText(value); setMessage("Prompt y contexto copiados. Entrega tu narración en el chat del asistente y trae aquí el JSON para revisarlo."); } catch { setMessage("Puedes seleccionar y copiar el contexto que aparece debajo."); } };
  const players = (value: string | undefined, setter: (id: string | undefined) => void, label: string) => <label>{label}<select value={value ?? ""} onChange={e => setter(e.target.value || undefined)}><option value="">Sin identificar</option>{roster.map(p => <option value={p.id} key={p.id}>{p.number ?? "—"} · {p.name}</option>)}</select></label>;
  return <section className="analysis-editor" aria-label="Análisis detallado del acta">
    <div className="ae-heading"><div><span>Después del partido</span><h3>El partido, acción a acción</h3></div><button type="button" className="btn sky" onClick={() => { setImportEditing(false); setEvent({ id: newId(), type: "pass", team: "us", outcome: "complete", source: "manual" }); }}>Añadir acción</button></div>
    <p>Pases, remates, defensa y balón parado. Cada acción alimenta las tablas y gráficas del partido, la temporada y los jugadores.</p>
    <label>Cobertura del análisis<select value={sheet.analysisCoverage ?? "partial"} onChange={e => update(s => ({ ...s, analysisCoverage: e.target.value as "partial" | "complete" }))}><option value="partial">Parcial · solo acciones registradas</option><option value="complete">Completa · se ha revisado todo el partido</option></select></label>
    <label>Duración real de juego (segundos, sin descanso)<input type="number" min="1" max="9000" value={sheet.durationSeconds ?? sheet.duration * 60} onChange={e => { const n = Number(e.target.value); if (n > 0 && n <= 9000) update(s => ({ ...s, durationSeconds: n, duration: Math.ceil(n / 60) })); }} /></label>
    <label>Notas de cobertura<textarea value={sheet.analysisNotes ?? ""} maxLength={2000} onChange={e => update(s => ({ ...s, analysisNotes: e.target.value }))} placeholder="Ej.: faltan las acciones de los primeros cinco minutos." /></label>
    <details><summary>Importar análisis de una narración</summary><p>Entrega el audio o dicta el partido en tu chat con el asistente. Este prompt incluye plantilla, acta, perfil y catálogo de estadísticas. Aquí revisas e importas el resultado; las acciones anteriores se conservan.</p><button type="button" className="btn line" onClick={() => void copy()}>Copiar prompt y contexto</button>{context && <label>Contexto del partido (solo lectura)<textarea readOnly value={context} rows={6} onFocus={e => e.target.select()} /></label>}<label>Archivo de acciones<input type="file" accept=".json,application/json" onChange={e => { const f = e.target.files?.[0]; if (!f) return; if (f.size > 900_000) { setMessage("Archivo demasiado grande."); return; } void f.text().then(v => { setText(v); setPreview(null); }); }} /></label><label>Análisis estructurado<textarea value={text} onChange={e => { setText(e.target.value); setPreview(null); }} placeholder="Pega aquí el análisis JSON generado en el chat" /></label><button type="button" className="btn sky" onClick={importPreview} disabled={!text.trim()}>Revisar importación</button>
      {preview && <NarrationReview preview={preview} info={info} onEdit={e => { setImportEditing(true); setEvent({ ...e }); }} onResolve={resolve} onEditObservation={editObservation} onApply={apply} editing={!!event} />}
    </details>
    {!!sheet.analysis?.observations.length && <NarratedObservations observations={sheet.analysis.observations} nameOf={id => info(id).name} onSave={saveObservation} sources={sheet.narrationSources} issues={sheet.analysis.issues} onResolveIssue={(id,resolution) => update(s => ({ ...s, analysis: s.analysis ? { ...s.analysis, issues: s.analysis.issues?.map(q => q.id === id ? { ...q, resolved: resolution } : q) } : undefined }))} />}
    {event && <div ref={eventForm} tabIndex={-1} className="ae-form" role="group" aria-label="Editar acción detallada">
      {importEditing && <p><b>Corrigiendo la importación.</b> Guardar aquí conserva el cambio para su revisión; todavía no modifica el acta.</p>}
      <label>Acción<select value={event.type} onChange={e => changeType(e.target.value as MatchEvent["type"])}>{Object.entries(importEditing ? EVENT_LABELS : ACTION_LABELS).map(([k,l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      <label>Equipo<select value={event.team ?? "us"} onChange={e => set({ team: e.target.value as "us" | "opponent", playerId: undefined, receiverId: undefined })}><option value="us">Manchester Piti</option><option value="opponent">Rival</option></select></label>
      <label>Minuto<input type="number" min="0" max="150" disabled={event.timingUnknown} value={event.minute ?? ""} onChange={e => set({ minute: e.target.value === "" ? undefined : Number(e.target.value), elapsedSeconds: undefined })} /></label>
      <label>Segundo del minuto<input type="number" min="0" max="59" disabled={event.timingUnknown || event.minute == null} value={event.elapsedSeconds != null ? event.elapsedSeconds % 60 : ""} onChange={e => set({ elapsedSeconds: e.target.value === "" ? undefined : (event.minute ?? 0) * 60 + Number(e.target.value) })} /></label>
      <label><input type="checkbox" checked={!!event.timingUnknown} onChange={e => set({ timingUnknown: e.target.checked, ...(e.target.checked ? { minute: undefined, elapsedSeconds: undefined } : {}) })} />No se conoce el minuto</label>
      {event.team !== "opponent" ? <>{players(event.playerId, id => set({ playerId: id }), "Autor")}{["pass", "cross", "throw_in", "goal_kick", "kickoff"].includes(event.type) && players(event.receiverId, id => set({ receiverId: id }), "Receptor")}</> : <label>Jugador rival (opcional)<input value={event.opponentPlayer ?? ""} onChange={e => set({ opponentPlayer: e.target.value })} /></label>}
      {["goal", "goal_penalty", "goal_freekick"].includes(event.type) && <>{players(event.assistPlayerId, id => set({ assistPlayerId: id, assistReviewed: true }), "Asistente")}<label><input type="checkbox" checked={!!event.assistReviewed} onChange={e => set({ assistReviewed: e.target.checked })} />Asistencia revisada (sin asistente si no se elige jugador)</label></>}
      {event.type === "substitution" && players(event.inPlayerId, id => set({ inPlayerId: id }), "Jugador que entra")}
      <label>Resultado<select value={event.outcome ?? "unknown"} onChange={e => set({ outcome: e.target.value as Outcome, ...(e.target.value === "incomplete" ? { receiverId: undefined, keyPass: false } : {}) })}>{Object.entries(OUTCOME_LABELS).map(([k,l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      <label>Tipo de envío<select value={event.delivery ?? ""} onChange={e => set({ delivery: e.target.value as MatchEvent["delivery"] || undefined })}><option value="">Sin precisar</option><option value="short">Corto</option><option value="long">Largo</option><option value="cross">Centro</option><option value="through">Al espacio</option><option value="throw">Con la mano</option></select></label>
      <label>Contacto<select value={event.bodyPart ?? ""} onChange={e => set({ bodyPart: e.target.value as MatchEvent["bodyPart"] || undefined })}><option value="">Sin precisar</option><option value="left">Pie izquierdo</option><option value="right">Pie derecho</option><option value="head">Cabeza</option><option value="hand">Mano</option><option value="other">Otro</option></select></label>
      <label>Zona<select value={event.zone ?? ""} onChange={e => set({ zone: e.target.value as MatchEvent["zone"] || undefined })}><option value="">Sin precisar</option><option value="left">Izquierda</option><option value="center">Centro</option><option value="right">Derecha</option></select></label>
      <label><input type="checkbox" checked={!!event.keyPass} onChange={e => set({ keyPass: e.target.checked })} />Pase clave · acaba en remate</label>
      {event.type === "possession" && <label>Segundos de posesión<input type="number" min="1" max="9000" value={event.possessionSeconds ?? ""} onChange={e => set({ possessionSeconds: Number(e.target.value) })} /></label>}
      <details><summary>Coordenadas conocidas (0–100)</summary><p>Solo si se conoce la posición. Ataque hacia arriba; no se deducen del dorsal.</p>{(["x", "y", "endX", "endY"] as const).map(k => <label key={k}>{k}<input type="number" min="0" max="100" value={event[k] ?? ""} onChange={e => set({ [k]: e.target.value === "" ? undefined : Number(e.target.value) })} /></label>)}</details>
      <label>Nota de la acción<textarea value={event.note ?? ""} maxLength={300} onChange={e => set({ note: e.target.value })} /></label>
      <label>Fragmento o referencia de origen<input value={event.sourceRef ?? ""} maxLength={160} onChange={e => set({ sourceRef: e.target.value || undefined })} /></label>
      <div className="ae-buttons"><button type="button" className="btn sky" onClick={trySave}>Guardar acción</button><button type="button" className="btn line" onClick={() => setEvent(null)}>Cancelar</button></div>
    </div>}
    <label>Filtrar acciones<select value={filter} onChange={e => { setFilter(e.target.value); setPage(0); }}><option value="">Todas ({sheet.events.filter(e => isAnalysisAction(e.type)).length})</option>{Object.entries(ACTION_LABELS).map(([k,l]) => <option key={k} value={k}>{l}</option>)}</select></label>
    <ol className="ae-events">{list.slice(page * 30, page * 30 + 30).map(e => <li key={e.id}><button type="button" onClick={() => { setImportEditing(false); setEvent({ ...e }); }}><b>{e.minute == null ? "—" : `${e.minute}′${e.elapsedSeconds != null ? String(e.elapsedSeconds % 60).padStart(2,"0") : ""}`}</b><span>{EVENT_LABELS[e.type]} · {e.team === "opponent" ? "Rival" : e.playerId ? info(e.playerId).name : "Equipo"}{e.receiverId ? ` → ${info(e.receiverId).name}` : ""}<small>{e.outcome ? OUTCOME_LABELS[e.outcome] : ""}{e.keyPass ? " · pase clave" : ""}{e.timingUnknown ? " · sin minuto" : ""}</small></span></button><button type="button" aria-label={`Quitar ${EVENT_LABELS[e.type]} ${e.minute ?? "sin minuto"}`} onClick={() => update(s => removeEvent(s, e.id))}>Quitar</button></li>)}</ol>
    {list.length > 30 && <div className="ae-buttons"><button type="button" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</button><span>{page + 1} / {Math.ceil(list.length / 30)}</span><button type="button" disabled={(page + 1) * 30 >= list.length} onClick={() => setPage(p => p + 1)}>Siguiente</button></div>}
    {message && <p role="status" className="ae-message">{message}</p>}
  </section>;
}
