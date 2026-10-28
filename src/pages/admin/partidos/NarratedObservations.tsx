import { useEffect, useRef, useState } from 'react';
import type { Observation, NarratedAnalysis } from '../../../../functions/src/narrated/types';
import { observationSchema } from '../../../../functions/src/narrated/schema';
import { ObservationFields } from './ObservationFields';
import { newId } from '../acta/sheetModel';
import { LazyDetails } from './LazyDetails';

const LABELS: Record<Observation['kind'], string> = { context: 'Contexto', lineup: 'Alineación', substitution: 'Cambio', control: 'Control del balón', pass: 'Pase', reception: 'Recepción', dribble: 'Regate', carry: 'Conducción', duel: 'Duelo', tackle: 'Entrada', interception: 'Intercepción', clearance: 'Despeje', shot: 'Remate', goal: 'Gol', block: 'Bloqueo', save: 'Parada', keeper: 'Acción del portero', distribution: 'Distribución', pressure: 'Presión', loss: 'Pérdida', recovery: 'Recuperación', attack: 'Ataque', restart: 'Reinicio', discipline: 'Disciplina', tactical: 'Acción táctica', run: 'Desmarque', judgement: 'Valoración', measurement: 'Medición', gap: 'Tramo sin información', aggregate: 'Resumen de acciones' };
const STATE = { valid: 'Confirmada', pending: 'Pendiente', void: 'Anulada' };
/** Rich facts remain editable after import; nothing here writes until the acta is saved. */
export function NarratedObservations({ observations, nameOf, onSave, onAdd, onRemove, onReorder, roster = [], sources = [], changes, issues, onResolveIssue, onEditingChange }: {
  observations: Observation[]; nameOf: (id: string) => string; onSave: (o: Observation) => void;
  onAdd?: (o: Observation) => void; onRemove?: (id: string) => void; roster?: { id: string; name: string }[];
  onReorder?: (observations: Observation[]) => void;
  sources?: { id: string; quote: string }[];
  changes?: { kind: 'added' | 'updated' | 'unchanged'; before?: Observation; after: Observation }[];
  onEditingChange?: (editing: boolean) => void;
  issues?: NarratedAnalysis['issues']; onResolveIssue?: (id: string, resolution: string) => void;
}) {
  const [player, setPlayer] = useState(''); const [limit, setLimit] = useState(30);
  // (r12 board ACTA-16: also by kind and by state — Todas · Dudas · Anuladas)
  const [kind, setKind] = useState(''); const [state, setState] = useState<'' | 'pending' | 'void'>('');
  const [editing, setEditing] = useState<Observation | null>(null); const [facts, setFacts] = useState(''); const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const baseline = useRef('');
  const form = useRef<HTMLDivElement>(null);
  const editedId = editing?.id;
  useEffect(() => { if (editedId) { form.current?.focus(); form.current?.scrollIntoView?.({ block: 'start' }); } }, [editedId]);
  useEffect(() => { onEditingChange?.(!!editing); }, [editing, onEditingChange]);
  const [answers, setAnswers] = useState<Record<string,string>>({});
  const involved = (o: Observation) => [o.actorId, o.receiverId, o.intendedReceiverId, o.facts.inPlayerId, o.facts.assistPlayerId].filter((p): p is string => typeof p === 'string');
  const list = observations.filter(o => (!player || involved(o).includes(player)) && (!kind || o.kind === kind) && (!state || o.validity === state));
  const kinds = [...new Set(observations.map(o => o.kind))].sort((a, b) => LABELS[a].localeCompare(LABELS[b], 'es'));
  const pendingN = observations.filter(o => o.validity === 'pending').length;
  const players = [...new Set(observations.flatMap(involved))];
  const save = () => { if (!editing) return; try { if (!creating && JSON.stringify(observations.find(o => o.id === editing.id)) !== baseline.current) throw new Error('Este detalle ha cambiado mientras lo editabas. Conservamos tu texto: cópialo si lo necesitas y vuelve a abrir el detalle actualizado antes de guardar.'); const next = observationSchema.parse(JSON.parse(facts)); if (next.id !== editing.id) throw new Error('Conserva el identificador de la observación al corregirla.'); if (creating && onAdd) onAdd(next); else onSave(next); setEditing(null); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'Revisa los datos.'); } };
  let formValue: Observation | null = null;
  try { const parsed = JSON.parse(facts); if (parsed && typeof parsed.facts === 'object' && parsed.facts !== null && typeof parsed.kind === 'string') formValue = parsed; } catch { /* The advanced textarea remains usable while its JSON is incomplete. */ }
  const begin = (o: Observation, isNew = false) => { baseline.current = JSON.stringify(o); setCreating(isNew); setEditing(o); setFacts(JSON.stringify(o, null, 2)); setError(''); };
  const ordered = [...observations].sort((a, b) => a.order - b.order);
  const exact = ordered.filter(o => o.time?.precision === 'exact');
  const inconsistentOrder = exact.some((o, i) => i > 0 && o.time!.from < exact[i - 1].time!.from);
  return <section className="ae-observations" aria-label="Observaciones detalladas"><h4>{observations.length} observaciones del análisis</h4>
    <p>Los detalles amplían el acta. Un detalle pendiente no cambia los goles, tarjetas ni minutos ya confirmados en el acta. Las citas de origen son privadas y se conservan en el historial.</p>
    {onAdd && <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={() => begin({ id: newId(), kind: 'pass', team: 'us', order: Math.min(100000, Math.max(0, ...observations.map(o => o.order)) + 1), validity: 'valid', facts: { outcome: 'complete' } }, true)}>Añadir detalle</button>}
    {onReorder && inconsistentOrder && <div className="ae-message"><p>Hay hechos con segundo exacto cuyo orden contradice su hora. Puedes ordenarlos; los detalles sin hora exacta conservarán su posición.</p><button className="vd-btn vd-glass vd-press vd-btn--sm" type="button" disabled={!!editing} onClick={() => { const timed = [...exact].sort((a, b) => a.time!.from - b.time!.from); let i = 0; try { onReorder(ordered.map(o => o.time?.precision === 'exact' ? { ...timed[i++], order: o.order } : o)); } catch (e) { setError((e as Error).message); } }}>Ordenar hechos con tiempo</button></div>}
    {!!issues?.length && <LazyDetails><summary>Dudas guardadas · {issues.filter(q => !q.resolved?.trim()).length} pendientes</summary><p>Resolver una duda no modifica los hechos: revisa después las observaciones afectadas y confirma su estado.</p>{issues.map(q => <div className="ae-question" key={q.id}><b>{q.message}</b>{q.resolved ? <p>{q.resolved}</p> : onResolveIssue && <><label>Resolución {q.id}<textarea maxLength={400} value={answers[q.id] ?? ''} onChange={e => setAnswers(v => ({ ...v, [q.id]: e.target.value }))} /></label><button className="vd-btn vd-glass vd-press vd-btn--sm" type="button" disabled={!answers[q.id]?.trim()} onClick={() => onResolveIssue(q.id, answers[q.id].trim())}>Resolver duda</button></>}</div>)}</LazyDetails>}
    <div className="sac-filters"><label>Jugador en las observaciones<select value={player} onChange={e => { setPlayer(e.target.value); setLimit(30); }}><option value="">Todos</option>{players.map(id => <option key={id} value={id}>{nameOf(id)}</option>)}</select></label><label>Tipo<select value={kind} onChange={e => { setKind(e.target.value); setLimit(30); }}><option value="">Todos los tipos</option>{kinds.map(k => <option key={k} value={k}>{LABELS[k]}</option>)}</select></label><div className="sac-fieldrow"><p className="sac-lbl" id="ae-obs-state">Estado</p><div className="vd-seg vd-glass sac-seg sac-seg--3" role="group" aria-labelledby="ae-obs-state">{([['', 'Todas'], ['pending', 'Dudas'], ['void', 'Anuladas']] as const).map(([v, t]) => <button key={t} type="button" className="vd-seg__b" aria-pressed={state === v} onClick={() => { setState(v); setLimit(30); }}>{t}</button>)}</div><p className="sc-small">{pendingN === 1 ? '1 duda pendiente' : `${pendingN} dudas pendientes`}</p></div></div>
    <ol className="ae-review-events">{list.slice(0,limit).map(o => { const change = changes?.find(c => c.after.id === o.id); const evidence = [...new Set(Object.values(o.provenance ?? {}).map(p => p.sourceId).filter(Boolean))].flatMap(id => sources.filter(s => s.id === id)); return <li key={o.id}>
      <div className="ae-review-event-head"><b>{LABELS[o.kind]}</b><span className="ae-change">{STATE[o.validity ?? 'valid']}</span>{change && <span>{change.kind === 'added' ? 'Nueva' : change.kind === 'updated' ? 'Corregida' : 'Sin cambios'}</span>}<button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={() => begin(o)}>Editar detalle</button>{onRemove && <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-label={`Borrar detalle ${o.id}`} onClick={() => { try { onRemove(o.id); setError(''); } catch (e) { setError((e as Error).message); } }}>Borrar</button>}</div>
      <p>{o.team === 'opponent' ? 'Rival' : o.actorId ? nameOf(o.actorId) : 'Manchester Piti · autor sin identificar'}{o.receiverId ? ` → ${nameOf(o.receiverId)}` : ''} · {o.time ? `${Math.floor(o.time.from / 60)}:${String(Math.floor(o.time.from % 60)).padStart(2,'0')}${o.time.precision === 'exact' ? '' : ' · tiempo aproximado o intervalo'}` : 'Sin tiempo confirmado'}{o.quantity && o.quantity > 1 ? ` · ${o.quantity} acciones` : ''}</p>
      {change?.before && change.kind === 'updated' && <LazyDetails><summary>Comparar corrección</summary><div className="ae-review-diff"><div><b>Antes</b><pre>{JSON.stringify(change.before.facts,null,2)}</pre></div><div><b>Ahora</b><pre>{JSON.stringify(o.facts,null,2)}</pre></div></div></LazyDetails>}
      <LazyDetails><summary>Ver hechos y procedencia</summary><pre>{JSON.stringify({ facts: o.facts, provenance: o.provenance, controlBefore: o.controlBefore, controlAfter: o.controlAfter }, null, 2)}</pre>{evidence.map(s => <blockquote key={s.id}>{s.quote}</blockquote>)}</LazyDetails>
    </li>; })}</ol>
    {list.length > limit && <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={() => setLimit(n => n + 30)}>Ver 30 observaciones más</button>}
    {editing && <div ref={form} tabIndex={-1} className="ae-form" role="group" aria-label="Editar observación"><h4>{creating ? 'Nuevo detalle' : LABELS[editing.kind]}</h4><p>Al guardar un gol, cambio o tarjeta también se actualiza su acción vinculada en el acta. No escribas citas de la narración en los hechos públicos.</p>
      {formValue && <ObservationFields value={formValue} onChange={o => { setFacts(JSON.stringify(o, null, 2)); setEditing(o); }} players={roster.length ? roster : players.map(id => ({ id, name: nameOf(id) }))} labels={LABELS} />}
      <label>Estado del detalle<select value={editing.validity ?? 'valid'} onChange={e => { const validity = e.target.value as Observation['validity']; setEditing({ ...editing, validity }); try { setFacts(JSON.stringify({ ...JSON.parse(facts), validity },null,2)); } catch { setError('Corrige el JSON antes de cambiar el estado.'); } }}><option value="valid">Confirmado</option><option value="pending">Pendiente de aclarar</option><option value="void">Anulado</option></select></label>
      <details><summary>Todos los campos · edición avanzada</summary><label>Observación completa (JSON)<textarea value={facts} rows={8} onChange={e => setFacts(e.target.value)} spellCheck={false} /></label></details>
      {error && <p role="alert" className="ae-message">{error}</p>}<div className="ae-buttons"><button type="button" className="vd-btn vd-glass vd-press vd-btn--sm vd-btn--pri" onClick={save}>Guardar detalle</button><button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={() => setEditing(null)}>Cancelar</button></div>
    </div>}
    {!editing && error && <p role="alert" className="ae-message">{error}</p>}
  </section>;
}
