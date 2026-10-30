import { NarratedObservations } from './NarratedObservations';
import type { Observation } from '../../../../functions/src/narrated/types';
import { useState } from "react";
import { eventMinute, EVENT_LABELS, type MatchEvent } from "../../../../functions/src/matchEngine";
import { OUTCOME_LABELS } from "../../../../functions/src/matchAnalysis";
import type { NarrationChange, previewNarration } from "../../../lib/narration";
/** What the review says of a player (the acta session's info gives it). */
export interface PlayerInfo {
  name: string;
  number: number | null;
}

const FIELD_LABELS: Record<string, string> = { type: "Acción", minute: "Minuto", elapsedSeconds: "Segundo de juego", timingUnknown: "Sin minuto conocido", period: "Parte", playerId: "Autor", receiverId: "Receptor", assistPlayerId: "Asistente", assistReviewed: "Asistencia revisada", inPlayerId: "Entra", team: "Equipo", opponentPlayer: "Jugador rival", outcome: "Resultado", keyPass: "Pase clave", delivery: "Envío", bodyPart: "Contacto", zone: "Zona", x: "Posición X", y: "Posición Y", endX: "Destino X", endY: "Destino Y", possessionSeconds: "Segundos de posesión", note: "Nota", source: "Origen", sourceRef: "Fragmento o referencia" };
const WORDS: Record<string, string> = { us: "Manchester Piti", opponent: "Rival", short: "Corto", long: "Largo", cross: "Centro", through: "Al espacio", throw: "Con la mano", right: "Derecha", left: "Izquierda", center: "Centro", head: "Cabeza", hand: "Mano", other: "Otro", live: "En directo", manual: "Manual", narration: "Narración" };
const PERSON_FIELDS = new Set(["playerId", "receiverId", "assistPlayerId", "inPlayerId"]);

export function NarrationReview({ preview, info, onEdit, onResolve, onEditObservation, onApply, editing = false }: {
  preview: ReturnType<typeof previewNarration>; info: (id: string) => PlayerInfo;
  onEditObservation?: (observation: Observation) => void;
  onEdit: (event: MatchEvent) => void; onResolve: (index: number, resolution: string) => void; onApply: (allowIncidents?: boolean) => void; editing?: boolean;
}) {
  const [observationEditing, setObservationEditing] = useState(false);
  const [filter, setFilter] = useState("changes");
  const [player, setPlayer] = useState("");
  const [limit, setLimit] = useState(30);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const ids = [...new Set(preview.changes.flatMap(c => [c.after.playerId, c.after.receiverId, c.after.assistPlayerId, c.after.inPlayerId, c.before?.playerId, c.before?.receiverId, c.before?.assistPlayerId, c.before?.inPlayerId]).filter((id): id is string => !!id))];
  const matchesPlayer = (c: NarrationChange) => !player || [c.after, c.before].some(e => e && [e.playerId, e.receiverId, e.assistPlayerId, e.inPlayerId].includes(player));
  const changes = preview.changes.filter(c => matchesPlayer(c) && (filter === "all" || filter === "changes" ? filter === "all" || c.kind !== "unchanged" : c.kind === filter));
  const describe = (key: string, value: unknown) => value === undefined || value === "" ? "Sin indicar" : PERSON_FIELDS.has(key) ? info(String(value)).name : typeof value === "boolean" ? value ? "Sí" : "No" : key === "type" ? EVENT_LABELS[value as MatchEvent["type"]] : key === "outcome" ? OUTCOME_LABELS[value as keyof typeof OUTCOME_LABELS] : WORDS[String(value)] ?? String(value);
  const unresolved = preview.questions.filter(q => !q.resolution?.trim());
  return <section className="ae-review" aria-label="Revisión de la importación">
    <div className="ae-review-summary" role="status"><b>{preview.added} nuevas</b><b>{preview.updated} correcciones</b><span>{preview.unchanged} sin cambios</span><span>{preview.unknownTime} sin minuto conocido</span></div>
    <p>Compara cada corrección con el borrador actual. Las acciones que no aparecen en este archivo se conservan.</p>
    {preview.questions.length > 0 && <section className="ae-review-questions" aria-label="Dudas de la narración"><h4>{unresolved.length} dudas pendientes</h4><p>Corrige las acciones afectadas y explica la solución. Guardar una resolución no modifica una jugada automáticamente.</p>{preview.questions.map(q => <div key={q.index} className="ae-question">
      <b>{q.playerIds.length ? q.playerIds.map(id => info(id).name).join(" · ") : "Sin jugador identificado"}</b><p>{q.question}</p>{q.sourceRef && <blockquote>{q.sourceRef}</blockquote>}
      <div className="ae-buttons">{q.eventIds.map(id => { const e = preview.changes.find(c => c.after.id === id)?.after; return e ? <button className="vd-btn vd-glass vd-press vd-btn--sm" type="button" key={id} disabled={editing} onClick={() => onEdit(e)}>Revisar {EVENT_LABELS[e.type]} · {eventMinute(e) == null ? "sin minuto" : `${eventMinute(e)}′`}</button> : <span key={id}>Acción no incluida: {id}</span>; })}</div>
      {q.resolution?.trim() ? <p><b>Resuelta:</b> {q.resolution}</p> : <><label>Resolución de la duda {q.index + 1}<textarea maxLength={400} value={answers[q.index] ?? ""} onChange={e => setAnswers(a => ({ ...a, [q.index]: e.target.value }))} placeholder="Ej.: el receptor fue el dorsal 9; ya he corregido la jugada." /></label><button className="vd-btn vd-glass vd-press vd-btn--sm" type="button" disabled={!answers[q.index]?.trim()} onClick={() => onResolve(q.index, answers[q.index])}>Guardar resolución</button></>}
    </div>)}</section>}
    {preview.validationErrors.length > 0 && <div role="alert"><h4>Revisa la secuencia del acta</h4><ul>{preview.validationErrors.map((e, i) => <li key={i}>{e}</li>)}</ul></div>}
    <div className="ae-review-filters"><label>Mostrar<select value={filter} onChange={e => { setFilter(e.target.value); setLimit(30); }}><option value="changes">Nuevas y correcciones</option><option value="added">Solo nuevas</option><option value="updated">Solo correcciones</option><option value="all">Todas, incluidas sin cambios</option></select></label><label>Jugador de la importación<select value={player} onChange={e => { setPlayer(e.target.value); setLimit(30); }}><option value="">Todos</option>{ids.map(id => <option key={id} value={id}>{info(id).name}</option>)}</select></label></div>
    <ol className="ae-review-events">{changes.slice(0, limit).map(c => <li key={c.after.id}>
      <div className="ae-review-event-head"><span className={`ae-change ${c.kind}`}>{c.kind === "added" ? "Nueva" : c.kind === "updated" ? "Corrección" : "Sin cambios"}</span><b>{eventMinute(c.after) == null ? "Sin minuto" : `${eventMinute(c.after)}′`} · {EVENT_LABELS[c.after.type]}</b><button className="vd-btn vd-glass vd-press vd-btn--sm" type="button" disabled={editing} onClick={() => onEdit(c.after)}>Corregir acción</button></div>
      <p>{c.after.team === "opponent" || c.after.type.startsWith("opponent_") ? "Rival" : c.after.playerId ? info(c.after.playerId).name : "Autor sin identificar"}{c.after.receiverId ? ` → ${info(c.after.receiverId).name}` : ""}{c.after.outcome ? ` · ${OUTCOME_LABELS[c.after.outcome]}` : ""}</p>
      {c.after.sourceRef ? <blockquote><small>Fragmento o referencia de origen</small>{c.after.sourceRef}</blockquote> : <p className="ae-review-muted">Sin fragmento de origen aportado.</p>}
      {c.kind === "updated" && <dl className="ae-review-diff">{c.fields.map(f => <div key={f.key}><dt>{FIELD_LABELS[f.key] ?? f.key}</dt><dd><span><small>Antes</small>{describe(f.key, f.before)}</span><span><small>Ahora</small>{describe(f.key, f.after)}</span></dd></div>)}</dl>}
      {c.after.note && <p>{c.after.note}</p>}
    </li>)}</ol>
    {!changes.length && <p>No hay acciones que coincidan con estos filtros.</p>}
    {changes.length > limit && <button className="vd-btn vd-glass vd-press vd-btn--sm" type="button" onClick={() => setLimit(n => n + 30)}>Ver 30 acciones más ({changes.length - limit} pendientes)</button>}
    {!!preview.observationChanges.length && onEditObservation && <NarratedObservations observations={preview.observationChanges.map(c => c.after)} changes={preview.observationChanges} sources={preview.sources} nameOf={id => info(id).name} onSave={onEditObservation} onEditingChange={setObservationEditing} />}
    {preview.format === 'piti-actions/v2' && unresolved.length > 0 && <p>Las dudas de detalles quedan guardadas como pendientes; los hechos independientes pueden incorporarse.</p>}
    <p>{preview.canImportWithIncidents ? "Puedes conservar esta secuencia incompleta en el borrador y corregir los cambios después. Los minutos serán provisionales y no podrás publicar el acta hasta resolver las incidencias." : preview.errors.length ? "Resuelve las dudas y los errores antes de incorporar el análisis." : "La secuencia es válida. Reimportar los mismos ids no duplica jugadas."}</p>
    {(editing || observationEditing) && <p role="status">Guarda o cancela la acción que estás editando antes de incorporar la importación.</p>}
    <button type="button" className="vd-btn vd-glass vd-press vd-btn--pri" disabled={preview.errors.length > 0 || editing || observationEditing} onClick={() => onApply()}>Incorporar al acta</button>
    {preview.canImportWithIncidents && <button type="button" className="vd-btn vd-glass vd-press" disabled={editing || observationEditing} onClick={() => onApply(true)}>Incorporar al borrador con incidencias</button>}
  </section>;
}
