import { useEffect, useState } from 'react';
import type { Observation, NarratedAnalysis } from '../../../../functions/src/narrated/types';
import { observationSchema } from '../../../../functions/src/narrated/schema';

const LABELS: Record<Observation['kind'], string> = { context: 'Contexto', lineup: 'Alineación', substitution: 'Cambio', control: 'Control del balón', pass: 'Pase', reception: 'Recepción', dribble: 'Regate', carry: 'Conducción', duel: 'Duelo', tackle: 'Entrada', interception: 'Intercepción', clearance: 'Despeje', shot: 'Remate', goal: 'Gol', block: 'Bloqueo', save: 'Parada', keeper: 'Acción del portero', distribution: 'Distribución', pressure: 'Presión', loss: 'Pérdida', recovery: 'Recuperación', attack: 'Ataque', restart: 'Reinicio', discipline: 'Disciplina', tactical: 'Acción táctica', run: 'Desmarque', judgement: 'Valoración', measurement: 'Medición', gap: 'Tramo sin información', aggregate: 'Resumen de acciones' };
const STATE = { valid: 'Confirmada', pending: 'Pendiente', void: 'Anulada' };
/** Rich facts remain editable after import; nothing here writes until the acta is saved. */
export function NarratedObservations({ observations, nameOf, onSave, sources = [], changes, issues, onResolveIssue, onEditingChange }: {
  observations: Observation[]; nameOf: (id: string) => string; onSave: (o: Observation) => void;
  sources?: { id: string; quote: string }[];
  changes?: { kind: 'added' | 'updated' | 'unchanged'; before?: Observation; after: Observation }[];
  onEditingChange?: (editing: boolean) => void;
  issues?: NarratedAnalysis['issues']; onResolveIssue?: (id: string, resolution: string) => void;
}) {
  const [player, setPlayer] = useState(''); const [limit, setLimit] = useState(30);
  const [editing, setEditing] = useState<Observation | null>(null); const [facts, setFacts] = useState(''); const [error, setError] = useState('');
  useEffect(() => { onEditingChange?.(!!editing); }, [editing, onEditingChange]);
  const [answers, setAnswers] = useState<Record<string,string>>({});
  const list = observations.filter(o => !player || o.actorId === player || o.receiverId === player);
  const players = [...new Set(observations.flatMap(o => [o.actorId,o.receiverId]).filter((p): p is string => !!p))];
  const save = () => { if (!editing) return; try { const next = observationSchema.parse(JSON.parse(facts)); if (next.id !== editing.id) throw new Error('Conserva el identificador de la observación al corregirla.'); onSave(next); setEditing(null); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'Revisa los datos.'); } };
  return <section className="ae-observations" aria-label="Observaciones detalladas"><h4>{observations.length} observaciones del análisis</h4>
    <p>Los detalles amplían el acta. Una acción pendiente o anulada conserva su rastro y no aporta una cifra confirmada. Las citas de origen son privadas.</p>
    {!!issues?.length && <details><summary>Dudas guardadas · {issues.filter(q => !q.resolved?.trim()).length} pendientes</summary><p>Resolver una duda no modifica los hechos: revisa después las observaciones afectadas y confirma su estado.</p>{issues.map(q => <div className="ae-question" key={q.id}><b>{q.message}</b>{q.resolved ? <p>{q.resolved}</p> : onResolveIssue && <><label>Resolución {q.id}<textarea maxLength={400} value={answers[q.id] ?? ''} onChange={e => setAnswers(v => ({ ...v, [q.id]: e.target.value }))} /></label><button className="btn line" type="button" disabled={!answers[q.id]?.trim()} onClick={() => onResolveIssue(q.id, answers[q.id].trim())}>Resolver duda</button></>}</div>)}</details>}
    <label>Jugador en las observaciones<select value={player} onChange={e => { setPlayer(e.target.value); setLimit(30); }}><option value="">Todos</option>{players.map(id => <option key={id} value={id}>{nameOf(id)}</option>)}</select></label>
    <ol className="ae-review-events">{list.slice(0,limit).map(o => { const change = changes?.find(c => c.after.id === o.id); const evidence = [...new Set(Object.values(o.provenance ?? {}).map(p => p.sourceId).filter(Boolean))].flatMap(id => sources.filter(s => s.id === id)); return <li key={o.id}>
      <div className="ae-review-event-head"><b>{LABELS[o.kind]}</b><span className="ae-change">{STATE[o.validity ?? 'valid']}</span>{change && <span>{change.kind === 'added' ? 'Nueva' : change.kind === 'updated' ? 'Corregida' : 'Sin cambios'}</span>}<button type="button" className="btn line sm" onClick={() => { setEditing(o); setFacts(JSON.stringify(o,null,2)); setError(''); }}>Editar detalle</button></div>
      <p>{o.team === 'opponent' ? 'Rival' : o.actorId ? nameOf(o.actorId) : 'Manchester Piti · autor sin identificar'}{o.receiverId ? ` → ${nameOf(o.receiverId)}` : ''} · {o.time ? `${Math.floor(o.time.from / 60)}:${String(Math.floor(o.time.from % 60)).padStart(2,'0')}${o.time.precision === 'exact' ? '' : ' · tiempo aproximado o intervalo'}` : 'Sin tiempo confirmado'}{o.quantity && o.quantity > 1 ? ` · ${o.quantity} acciones` : ''}</p>
      {change?.before && change.kind === 'updated' && <details><summary>Comparar corrección</summary><div className="ae-review-diff"><div><b>Antes</b><pre>{JSON.stringify(change.before.facts,null,2)}</pre></div><div><b>Ahora</b><pre>{JSON.stringify(o.facts,null,2)}</pre></div></div></details>}
      <details><summary>Ver hechos y procedencia</summary><pre>{JSON.stringify({ facts: o.facts, provenance: o.provenance, controlBefore: o.controlBefore, controlAfter: o.controlAfter }, null, 2)}</pre>{evidence.map(s => <blockquote key={s.id}>{s.quote}</blockquote>)}</details>
    </li>; })}</ol>
    {list.length > limit && <button type="button" className="btn line" onClick={() => setLimit(n => n + 30)}>Ver 30 observaciones más</button>}
    {editing && <div className="ae-form" role="group" aria-label="Editar observación"><h4>{LABELS[editing.kind]}</h4><p>Conserva su identificador al corregir. No escribas citas de la narración en los hechos públicos.</p>
      <label>Estado del detalle<select value={editing.validity ?? 'valid'} onChange={e => { const validity = e.target.value as Observation['validity']; setEditing({ ...editing, validity }); try { setFacts(JSON.stringify({ ...JSON.parse(facts), validity },null,2)); } catch { setError('Corrige el JSON antes de cambiar el estado.'); } }}><option value="valid">Confirmado</option><option value="pending">Pendiente de aclarar</option><option value="void">Anulado</option></select></label>
      <label>Observación completa (JSON)<textarea value={facts} rows={8} onChange={e => setFacts(e.target.value)} spellCheck={false} /></label>
      {error && <p role="alert" className="ae-message">{error}</p>}<div className="ae-buttons"><button type="button" className="btn sky" onClick={save}>Guardar detalle</button><button type="button" className="btn line" onClick={() => setEditing(null)}>Cancelar</button></div>
    </div>}
  </section>;
}
