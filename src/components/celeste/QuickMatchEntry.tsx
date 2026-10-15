import { allowedAtBreak } from '../../../functions/src/liveRules';
import { shownOffset, eventMinute } from '../../lib/partidos';
import { useRef, useState } from 'react';
import type { ClubMatch, MatchEvent } from '../../lib/clubData';
import { liveSides } from '../../pages/admin/live/liveModel';
import { apiError, liveEvent } from '../../lib/clubApi';
import { clockReading } from '../../../functions/src/matchClock';
import { useClock } from '../../hooks/useClock';
import './quick-match.css';

const ACTIONS = [
  ['goal','Gol del Piti'],['chance','Ocasión del Piti'],['corner','Córner del Piti'],
  ['yellow_card','Amarilla'],['substitution','Cambio'],['opponent_goal','Gol rival'],
  ['opponent_chance','Ocasión rival'],['opponent_corner','Córner rival'],
  ['woodwork','Al palo'],['penalty_saved','Penalti parado'],['red_card','Roja'],['double_yellow','Segunda amarilla'],
] as const;
type Action = typeof ACTIONS[number][0];
type Payload = NonNullable<Parameters<typeof liveEvent>[0]>;
type Attempt = { payload: Payload; label: string; id?: string; undo?: boolean };

/** Shared by public touchline mode and admin. Each retry retains its original request ID. */
export function QuickMatchEntry({match,nameOf}:{match:ClubMatch;nameOf:(id:string)=>string}) {
  const now = useClock(1000);
  const reading = clockReading(match.clock,now);
  const offset = shownOffset(match);
  const currentMinute = Math.floor(reading.elapsedSeconds/60);
  const {field,bench} = liveSides(match.starters,match.bench,match.events);
  const [action,setAction] = useState<Action|null>(null);
  const [out,setOut] = useState<string|null>(null);
  const [manual,setManual] = useState('');
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
  const [failed,setFailed] = useState<Attempt|null>(null);
  const [ownId,setOwnId] = useState<string|null>(null);
  const lock = useRef(false);
  const canAct = (a:Action) => reading.playing || (reading.phase==='halftime' && allowedAtBreak(a));
  const reset = () => {setAction(null);setOut(null);setManual('');};
  const run = async (attempt:Attempt) => {
    if(lock.current) return;
    lock.current=true;setBusy(true);setMessage('');setFailed(null);
    try {
      await liveEvent(attempt.payload);
      setOwnId(attempt.undo ? null : attempt.id ?? null);
      setMessage(attempt.label);reset();
    } catch(e) {setFailed(attempt);setMessage(apiError(e));}
    finally {lock.current=false;setBusy(false);}
  };
  const add = (type:Action,playerId?:string,inPlayerId?:string) => {
    if(!canAct(type) || failed) return;
    const minute = manual === '' ? currentMinute : Number(manual) - offset;
    if(!Number.isInteger(minute) || minute<0 || minute>currentMinute) {setMessage(`El minuto debe estar entre ${offset} y el minuto actual.`);return;}
    const requestId = crypto.randomUUID();
    const event = {type,minute,...(playerId ? {playerId} : {}),...(inPlayerId ? {inPlayerId} : {}),...(type==='goal' ? {assistReviewed:false} : {})};
    void run({payload:{action:'add',matchId:match.id,requestId,clockRevision:match.clock?.revision,manualTime:manual!=='',event},id:`live-${requestId}`,label:`Jugada guardada: ${ACTIONS.find(a=>a[0]===type)?.[1]}${playerId ? ` · ${nameOf(playerId)}` : ''}.${type==='goal' ? ' Asistencia pendiente de revisar en el acta.' : ''}`});
  };
  const chooseAction = (a:Action) => {setMessage('');setOut(null);if(a.startsWith('opponent_')) add(a);else setAction(a);};
  const options = action==='substitution' && out ? bench : action && /card|yellow/.test(action) ? [...field,...bench] : field;
  const selectPlayer = (id?:string) => {
    if(!action) return;
    if(action==='substitution' && !out) {setOut(id ?? null);return;}
    add(action,action==='substitution' ? out! : id,action==='substitution' ? id : undefined);
  };
  const undoable = ownId && (match.events ?? []).some(e=>e.id===ownId);
  const lastEvent:MatchEvent|undefined = match.events?.find(e=>e.id===ownId);
  return <section className="qm-entry" aria-label="Modo banquillo rápido">
    <p className="qm-help">Acción y jugador: se guarda al tocar el nombre. Los eventos del rival se guardan a un toque.</p>
    <fieldset disabled={busy || !!failed}><legend className="sr-only">Anotar una jugada</legend>
      {!action && <div className="qm-actions">{ACTIONS.map(([a,label])=><button type="button" key={a} disabled={!canAct(a)} aria-pressed={action===a} className={a==='goal' ? 'qm-goal' : ''} onClick={()=>chooseAction(a)}>{label}</button>)}</div>}
      {action && <div className="qm-picker"><h3>{ACTIONS.find(a=>a[0]===action)?.[1]} · {action==='substitution' ? out ? `Entra por ${nameOf(out)}` : '¿Quién sale?' : '¿Quién?'}</h3><div className="qm-players">
        {(action==='chance' || action==='corner') && <button type="button" disabled={!canAct(action)} onClick={()=>selectPlayer()}>Equipo · sin identificar</button>}
        {options.map(id=><button type="button" key={id} disabled={!canAct(action) || (!!out && !field.includes(out))} onClick={()=>selectPlayer(id)}>{nameOf(id)}</button>)}
      </div>{out && !field.includes(out) && <p role="status">Otro anotador ya cambió a ese jugador. Vuelve a elegir quién sale.</p>}<button type="button" className="qm-cancel" onClick={reset}>Cancelar selección</button></div>}
      <details className="qm-time"><summary>Corregir minuto · {currentMinute+offset}′ ahora</summary><label>Minuto de la jugada <input inputMode="numeric" type="number" min={offset} max={currentMinute+offset} value={manual} placeholder="Automático" onChange={e=>setManual(e.target.value)}/></label><p>Vacío: usa el reloj compartido y conserva los segundos.</p></details>
    </fieldset>
    {busy && <p role="status">Guardando jugada…</p>}
    {message && <p role={failed ? 'alert' : 'status'} className="qm-message">{message}</p>}
    {failed && <div className="qm-retry"><button type="button" disabled={busy} onClick={()=>void run(failed)}>Reintentar la misma jugada</button><button type="button" disabled={busy} onClick={()=>{setFailed(null);setMessage('Revisa las jugadas sincronizadas antes de volver a anotarla.');reset();}}>Revisar antes de continuar</button></div>}
    {undoable && <button type="button" className="qm-cancel" disabled={busy || !!failed} onClick={()=>void run({payload:{action:'undo',matchId:match.id,eventId:ownId!},undo:true,label:'Tu última jugada se ha deshecho.'})}>Deshacer mi última jugada · {lastEvent ? eventMinute(lastEvent) : '?'}′</button>}
    <p className="qm-help">Las tarjetas y los cambios se pueden anotar en el descanso. Los goles rápidos necesitan revisar su asistencia antes de publicar.</p>
  </section>;
}
