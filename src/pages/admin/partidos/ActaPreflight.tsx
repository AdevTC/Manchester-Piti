import { goalRows, setAssist, type MatchSheet } from '../acta/sheetModel';
import type { ActaReview } from '../data/adminLogic';

export function ActaPreflight({ sheet, review, update, nameOf, onReview }: { sheet: MatchSheet; review: ActaReview; update:(f:(s:MatchSheet)=>MatchSheet)=>void; nameOf:(id:string)=>string; onReview:()=>void }) {
  const pending = goalRows(sheet).filter(g=>!g.open && g.kind!=='og' && !g.assist && g.assistReviewed!==true);
  const problems = review.items.filter(i=>i.tone==='warn');
  return <section className="calm acta-preflight" aria-label="Revisión antes de publicar"><h3>Antes de publicar <em>{review.cuadra ? 'Lista para publicar' : 'Hay datos pendientes'}</em></h3>
    <p className="hint">Comprueba goleadores, asistencias, cambios y minutos. Los errores bloquean la publicación; las asistencias antiguas sin confirmar se señalan para revisar.</p>
    {problems.length > 0 && <ul>{problems.map((p,i)=><li key={`${p.key}-${i}`}><b className="warn">! {p.title}</b><p>{p.detail}</p></li>)}</ul>}
    {review.ledgerErrors.length > 1 && <details><summary>Ver todos los problemas de eventos ({review.ledgerErrors.length})</summary><ul>{review.ledgerErrors.map((error,i)=><li key={i}>{error}</li>)}</ul></details>}
    {problems.length > 0 && <button type="button" className="btn line" onClick={onReview}>Corregir en el acta</button>}
    {pending.length > 0 ? <div className="preflight-assists"><h4>Asistencias por confirmar · {pending.length}</h4>{pending.map(g=><label key={g.id}><span>Gol {g.n} · {nameOf(g.scorer!)} · {g.minute ?? '?'}′{g.assistReviewed===false ? ' · pendiente' : ' · dato antiguo sin confirmar'}</span><select className="inp" aria-label={`Confirmar asistencia del gol ${g.n}`} value="" onChange={e=>{if(e.target.value) update(s=>setAssist(s,g.id,e.target.value==='none' ? null : e.target.value));}}><option value="">Elegir asistente o confirmar sin asistencia</option><option value="none">Confirmar sin asistencia</option>{[...sheet.starters,...sheet.bench].filter(id=>id!==g.scorer).map(id=><option key={id} value={id}>{nameOf(id)}</option>)}</select></label>)}</div> : <p className="okk">✓ Asistencias revisadas</p>}
    {!problems.length && <p className="okk">✓ Marcador, goleadores, convocatoria y secuencia de cambios coherentes</p>}
  </section>;
}
