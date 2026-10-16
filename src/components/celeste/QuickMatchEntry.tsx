import { allowedAtBreak } from '../../../functions/src/liveRules';
import { shownOffset, eventMinute } from '../../lib/partidos';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClubMatch } from '../../lib/clubData';
import { liveSides } from '../../pages/admin/live/liveModel';
import { apiError, liveEvent } from '../../lib/clubApi';
import { clockReading } from '../../../functions/src/matchClock';
import { useClock } from '../../hooks/useClock';
import { useAuth } from '../../context/AuthContext';
import { useSyncStatus } from '../../lib/syncStatus';
import {
  QUICK_ACTIONS, QUICK_STORAGE_EVENT, createQuickAttempt, quickConfirmed, quickRetryPayload, quickRetryProblem,
  quickStorageKey, readQuickRecord, writeQuickRecord,
  type QuickAction, type QuickAttempt, type QuickRecord, type QuickSelection,
} from '../../lib/quickMatchRecovery';
import './quick-match.css';

type Props = { match: ClubMatch; nameOf: (id: string) => string };

/** A new instance on account/match changes cannot show or send the previous account's draft. */
export function QuickMatchEntry(props: Props) {
  const { user } = useAuth();
  if (!user) return <p className="qm-help">Inicia sesión para anotar jugadas.</p>;
  return <QuickEntry key={`${user.uid}:${props.match.id}`} {...props} storageKey={quickStorageKey(user.uid, props.match.id)} />;
}

function QuickEntry({ match, nameOf, storageKey }: Props & { storageKey: string }) {
  const now = useClock(1000);
  const sync = useSyncStatus();
  const reading = clockReading(match.clock, now);
  const offset = shownOffset(match);
  const currentMinute = Math.floor(reading.elapsedSeconds / 60);
  const { field, bench } = liveSides(match.starters, match.bench, match.events);
  const [source] = useState(() => crypto.randomUUID());
  const [initial] = useState(() => readQuickRecord(storageKey));
  const [record, setRecord] = useState<QuickRecord>(() => initial.record ?? { version: 1, updatedAt: Date.now(), selection: null, attempt: null, ownId: null });
  const recordRef = useRef(record);
  const [ownId, setOwnId] = useState(record.ownId);
  const ownOperation = useRef(record.attempt?.operationId ?? null);
  const [recoverSelection, setRecoverSelection] = useState(!!initial.record?.selection);
  const [storageAvailable, setStorageAvailable] = useState(initial.available);
  const [busy, setBusy] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState(initial.expired ? 'El borrador local caducó tras 24 horas. Revisa el acta antes de volver a anotar esa jugada.' : '');
  const [error, setError] = useState(false);
  const lock = useRef<string | null>(null);
  const selection = record.selection;
  const action = selection?.action ?? null;
  const out = selection?.out ?? null;
  const manual = selection?.manual ?? '';
  const pending = record.attempt && record.attempt.status !== 'confirmed' ? record.attempt : null;

  const persist = useCallback((next: QuickRecord) => {
    const value = { ...next, updatedAt: Date.now() };
    recordRef.current = value;
    setRecord(value);
    setStorageAvailable(writeQuickRecord(storageKey, value, source));
  }, [storageKey, source]);
  const confirm = useCallback((attempt: QuickAttempt) => {
    if (recordRef.current.attempt?.operationId !== attempt.operationId || recordRef.current.attempt.status === 'confirmed') return;
    const payload = attempt.payload;
    persist({ ...recordRef.current, selection: null, ownId: payload.action === 'add' ? `live-${payload.requestId}` : null, attempt: { ...attempt, status: 'confirmed' } });
    if (ownOperation.current === attempt.operationId) setOwnId(payload.action === 'add' ? `live-${payload.requestId}` : null);
    setMessage(attempt.label);
    setError(false);
    setRecoverSelection(false);
    if (lock.current === attempt.operationId) { lock.current = null; setBusy(false); }
  }, [persist]);

  // A snapshot can prove success even when the callable's answer was lost. Never replay automatically.
  useEffect(() => {
    if (record.attempt && record.attempt.status !== 'confirmed' && quickConfirmed(record.attempt, match, sync.fresh)) confirm(record.attempt);
  }, [record.attempt, match, sync.fresh, confirm]);

  // A second tab or the desktop/mobile instance shares the receipt, including its original request ID.
  useEffect(() => {
    const update = (event: Event) => {
      if (event instanceof StorageEvent && event.key !== storageKey) return;
      if (event instanceof CustomEvent && (event.detail?.key !== storageKey || event.detail?.source === source)) return;
      const next = readQuickRecord(storageKey);
      if (!next.record) return;
      recordRef.current = next.record;
      setRecord(next.record);
      setRecoverSelection(!!next.record.selection);
      setReviewed(false);
      if (lock.current && (next.record.attempt?.operationId !== lock.current || next.record.attempt.status === 'confirmed')) { lock.current = null; setBusy(false); }
      if (next.record.attempt?.status === 'confirmed') { setMessage(next.record.attempt.label); setError(false); }
      if (next.record.attempt?.status === 'confirmed' && ownOperation.current === next.record.attempt.operationId) setOwnId(next.record.ownId);
    };
    window.addEventListener('storage', update);
    window.addEventListener(QUICK_STORAGE_EVENT, update);
    return () => { window.removeEventListener('storage', update); window.removeEventListener(QUICK_STORAGE_EVENT, update); };
  }, [storageKey, source]);

  const canAct = (a: QuickAction) => match.status !== 'finished' && match.status !== 'cancelled' && match.status !== 'postponed' && !match.liveEndedAt && (reading.playing || (reading.phase === 'halftime' && allowedAtBreak(a)));
  const changeSelection = (patch: Partial<QuickSelection>) => {
    const previous = recordRef.current.selection;
    persist({ ...recordRef.current, selection: { action: null, out: null, manual: '', minute: currentMinute, clockRevision: match.clock?.revision, ...previous, ...patch } });
  };
  const reset = () => { persist({ ...recordRef.current, selection: null }); setRecoverSelection(false); };
  const run = async (attempt: QuickAttempt, retry = false) => {
    if (lock.current) return;
    const operation = { ...attempt, payload: retry ? quickRetryPayload(attempt) : attempt.payload, status: 'sent' as const };
    lock.current = operation.operationId;
    ownOperation.current = operation.operationId;
    setBusy(true); setMessage(''); setError(false); setReviewed(false); setCopied(false); setRecoverSelection(false);
    // Persist before dispatch: closing this tab cannot turn a retry into a different event.
    persist({ ...recordRef.current, selection: null, attempt: operation });
    try {
      if (!sync.online) throw new Error('Sin conexión. La jugada queda pendiente; podrás enviarla cuando vuelvas a estar conectado.');
      await liveEvent(operation.payload);
      // «Enviada» remains until the shared snapshot confirms the event (or the targeted undo).
    } catch (e) {
      const stored = readQuickRecord(storageKey).record;
      if (stored && (stored.attempt?.operationId !== operation.operationId || stored.attempt.status === 'confirmed')) return;
      if (recordRef.current.attempt?.operationId === operation.operationId && recordRef.current.attempt.status !== 'confirmed') {
        persist({ ...recordRef.current, attempt: { ...operation, status: 'pending' } });
        setError(true); setMessage(apiError(e));
      }
    } finally {
      if (lock.current === operation.operationId) { lock.current = null; setBusy(false); }
    }
  };
  const add = (type: QuickAction, playerId?: string, inPlayerId?: string) => {
    if (!canAct(type) || pending || recoverSelection) return;
    if (selection && selection.clockRevision !== match.clock?.revision) { setError(true); setMessage('La parte ha cambiado. Cancela esta selección y comprueba la jugada antes de anotarla.'); return; }
    const minute = manual === '' ? currentMinute : Number(manual) - offset;
    if (!Number.isInteger(minute) || minute < 0 || minute > currentMinute || minute > 150) { setError(true); setMessage(`El minuto debe estar entre ${offset} y el minuto actual.`); return; }
    const requestId = crypto.randomUUID();
    const event = { type, minute, ...(playerId ? { playerId } : {}), ...(inPlayerId ? { inPlayerId } : {}), ...(type === 'goal' ? { assistReviewed: false } : {}) };
    void run(createQuickAttempt({ action: 'add', matchId: match.id, requestId, clockRevision: match.clock?.revision, manualTime: manual !== '', event }, `Jugada guardada: ${QUICK_ACTIONS.find(a => a[0] === type)?.[1]}${playerId ? ` · ${nameOf(playerId)}` : ''}.${type === 'goal' ? ' Asistencia pendiente de revisar en el acta.' : ''}`));
  };
  const chooseAction = (a: QuickAction) => {
    setMessage(''); setError(false);
    if (a.startsWith('opponent_')) add(a);
    else changeSelection({ action: a, out: null, minute: currentMinute, clockRevision: match.clock?.revision, ...(selection && selection.clockRevision !== match.clock?.revision ? { manual: '' } : {}) });
  };
  const options = action === 'substitution' && out ? bench : action && /card|yellow/.test(action) ? [...field, ...bench] : field;
  const selectPlayer = (id?: string) => {
    if (!action) return;
    if (action === 'substitution' && !out) { changeSelection({ out: id ?? null }); return; }
    add(action, action === 'substitution' ? out! : id, action === 'substitution' ? id : undefined);
  };
  const lastEvent = match.events?.find(e => e.id === ownId);
  let retryProblem = pending ? quickRetryProblem(pending, match, now) : null;
  if (!retryProblem && pending?.payload.action === 'add' && pending.payload.event.type === 'substitution') {
    if (!field.includes(pending.payload.event.playerId ?? '') || !bench.includes(pending.payload.event.inPlayerId ?? '')) retryProblem = 'Otro anotador ha cambiado a los jugadores de este cambio. Revisa el acta antes de incorporarlo.';
  }
  const phaseChanged = selection && selection.clockRevision !== match.clock?.revision;
  const pendingEvent = pending?.payload.action === 'add' ? pending.payload.event : null;
  const pendingLine = pendingEvent ? `${QUICK_ACTIONS.find(a => a[0] === pendingEvent.type)?.[1]}${pendingEvent.playerId ? ` · ${nameOf(pendingEvent.playerId)}` : ''}${pendingEvent.inPlayerId ? ` → ${nameOf(pendingEvent.inPlayerId)}` : ''} · ${pendingEvent.minute + offset}′` : 'Deshacer tu última jugada';
  const reviewText = pending ? `${pendingLine}\nPartido: ${match.id}\nReferencia: ${pending.payload.action === 'add' ? `live-${pending.payload.requestId}` : pending.payload.eventId}\n${pending.payload.action === 'add' ? `Minuto transcurrido: ${pending.payload.event.minute}. Precisión al recuperar: un minuto.` : 'Revisar si esta jugada ya se ha eliminado.'}` : '';
  const discard = () => {
    persist({ ...recordRef.current, selection: null, attempt: null });
    setRecoverSelection(false); setReviewed(false); setError(false);
    setMessage('Borrador local descartado. Las jugadas guardadas en el acta no se han modificado.');
  };

  return <section className="qm-entry" aria-label="Modo banquillo rápido">
    <p className="qm-help">Acción y jugador: se guarda al tocar el nombre. Los eventos del rival se guardan a un toque.</p>
    {!storageAvailable && <p className="qm-storage" role="status">Este navegador no permite guardar el borrador. Mantén esta pestaña abierta hasta confirmar la jugada.</p>}
    {!sync.online && <p className="qm-storage" role="status">Sin conexión. Puedes preparar una jugada; tendrás que confirmar su envío cuando vuelva la conexión.</p>}
    {recoverSelection && selection && !pending && <div className="qm-recovery">
      <h3>Selección pendiente de recuperar</h3>
      <p>{selection.action ? QUICK_ACTIONS.find(a => a[0] === selection.action)?.[1] : 'Minuto manual'}{selection.out ? ` · sale ${nameOf(selection.out)}` : ''} · {selection.manual || selection.minute + offset}′</p>
      <p>{phaseChanged ? 'La parte ha cambiado. Revisa esta selección en el acta; no se enviará desde aquí.' : 'No se ha enviado. Recupera la selección y comprueba el jugador y el minuto antes de guardarla.'}</p>
      <div className="qm-retry"><button type="button" disabled={!!phaseChanged || (selection.action ? !canAct(selection.action) : false)} onClick={() => { changeSelection({ manual: selection.manual || String(selection.minute + offset) }); setRecoverSelection(false); }}>Recuperar selección</button><button type="button" onClick={discard}>Descartar selección</button></div>
    </div>}
    <fieldset disabled={busy || !!pending || recoverSelection}><legend className="sr-only">Anotar una jugada</legend>
      {!action && <div className="qm-actions">{QUICK_ACTIONS.map(([a, label]) => <button type="button" key={a} disabled={!canAct(a)} aria-pressed={action === a} className={a === 'goal' ? 'qm-goal' : ''} onClick={() => chooseAction(a)}>{label}</button>)}</div>}
      {action && <div className="qm-picker"><h3>{QUICK_ACTIONS.find(a => a[0] === action)?.[1]} · {action === 'substitution' ? out ? `Entra por ${nameOf(out)}` : '¿Quién sale?' : '¿Quién?'}</h3><div className="qm-players">
        {(action === 'chance' || action === 'corner') && <button type="button" disabled={!canAct(action)} onClick={() => selectPlayer()}>Equipo · sin identificar</button>}
        {options.map(id => <button type="button" key={id} disabled={!canAct(action) || !!phaseChanged || (!!out && !field.includes(out))} onClick={() => selectPlayer(id)}>{nameOf(id)}</button>)}
      </div>{phaseChanged && !recoverSelection && <p role="status">La parte ha cambiado. Cancela esta selección y revisa la jugada antes de anotarla.</p>}{out && !field.includes(out) && <p role="status">Otro anotador ya cambió a ese jugador. Vuelve a elegir quién sale.</p>}<button type="button" className="qm-cancel" onClick={reset}>Cancelar selección</button></div>}
      <details className="qm-time"><summary>Corregir minuto · {currentMinute + offset}′ ahora</summary><label>Minuto de la jugada <input inputMode="numeric" type="number" min={offset} max={currentMinute + offset} value={manual} placeholder="Automático" onChange={e => changeSelection({ manual: e.target.value })} /></label><p>Vacío: usa el reloj compartido y conserva los segundos.</p></details>
    </fieldset>
    {pending && <div className="qm-recovery" aria-label="Jugada pendiente">
      <h3 role="status">{pending.status === 'sent' ? busy ? 'Enviando jugada…' : 'Enviada · esperando confirmación' : 'Pendiente de envío'}</h3>
      <p>{pendingLine}</p>
      <p>Comprueba las jugadas sincronizadas. Reintentar conserva la identidad y el minuto original; no crea otra copia de esta jugada. Si el primer envío no llegó, la jugada recuperada tendrá precisión de minuto, sin los segundos originales.</p>
      {retryProblem && <p className="qm-message" role="status">{retryProblem}</p>}
      {!sync.fresh && <p>Esperando los datos actuales del partido para comprobar si ya se guardó.</p>}
      <div className="qm-retry"><button type="button" disabled={busy || !!retryProblem || !sync.online || !sync.fresh} onClick={() => void run(pending, true)}>Reintentar la misma jugada</button><a href={`/matches/${encodeURIComponent(match.id)}`}>Ver jugadas del partido</a></div>
      <details className="qm-time"><summary>Datos para revisar en el acta</summary><textarea aria-label="Borrador de la jugada para el acta" readOnly value={reviewText} rows={4} /><button type="button" className="qm-cancel" onClick={() => { void navigator.clipboard?.writeText(reviewText).then(() => setCopied(true)).catch(() => setCopied(false)); }}>{copied ? 'Borrador copiado' : 'Copiar borrador'}</button><p>Puedes seleccionar y copiar este texto si tu navegador no permite copiar con el botón.</p></details>
      {!busy && <><label className="qm-review"><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} />He revisado las jugadas del partido</label><button type="button" className="qm-cancel" disabled={!reviewed} onClick={discard}>Descartar borrador local</button></>}
    </div>}
    {record.attempt?.status === 'confirmed' && <p className="qm-confirmed" role="status">✓ Confirmada en el partido</p>}
    {message && <p role={error ? 'alert' : 'status'} className="qm-message">{message}</p>}
    {lastEvent && <button type="button" className="qm-cancel" disabled={busy || !!pending} onClick={() => void run(createQuickAttempt({ action: 'undo', matchId: match.id, eventId: lastEvent.id }, 'Tu última jugada se ha deshecho.'))}>Deshacer mi última jugada · {eventMinute(lastEvent) ?? '?'}′</button>}
    <p className="qm-help">Las tarjetas y los cambios se pueden anotar en el descanso. Los goles rápidos necesitan revisar su asistencia antes de publicar.</p>
  </section>;
}
