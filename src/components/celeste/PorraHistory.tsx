import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { isCompleted, formatDate, type ClubMatch } from '../../lib/clubData';
import { monthOf, porraHistory } from '../../lib/postMatch';
import { jornadaNumbers } from '../../lib/derived/jornada';
import { usePorraHistory } from '../../pages/vestuario/live';
import './post-match.css';

export function PorraHistory({ matches, seasonId, uid }: { matches: readonly ClubMatch[]; seasonId: string; uid: string }) {
  const [open,setOpen] = useState(false);
  return <details className="ph-history" open={open} onToggle={e=>setOpen(e.currentTarget.open)}><summary>Historial de la porra · evolución y clasificación mensual</summary>{open && <History key={seasonId} matches={matches.filter(m=>m.seasonId===seasonId)} uid={uid}/>}</details>;
}
function History({matches,uid}:{matches:readonly ClubMatch[];uid:string}) {
  const [month,setMonth] = useState('');
  const games = matches.filter(isCompleted);
  const source = usePorraHistory(games.map(m=>m.id),!!uid);
  const history = porraHistory(games,source.data,uid,month);
  const months = [...new Set(games.map(m=>monthOf(m.date)))].sort().reverse();
  const jornadas = jornadaNumbers(matches);
  const monthLabel = (m:string) => m==='sin-fecha' ? 'Sin fecha' : new Intl.DateTimeFormat('es-ES',{month:'long',year:'numeric',timeZone:'Europe/Madrid'}).format(new Date(`${m}-15T12:00:00Z`));
  const maximum = Math.max(1,history.total);
  const dots = history.timeline.map((t,i)=>({x:20+(i+1)*560/Math.max(1,history.timeline.length),y:135-t.total/maximum*110,t}));
  const path = ['20,135',...dots.map(p=>`${p.x},${p.y}`)].join(' ');
  return <><header><div><span className="hm-kick">Solo partidos finalizados · puntos recalculados del acta</span><h2>Tu recorrido en la porra</h2></div><label>Periodo <select value={month} onChange={e=>setMonth(e.target.value)} aria-label="Periodo de la porra"><option value="">Toda la temporada</option>{months.map(m=><option key={m} value={m}>{monthLabel(m)}</option>)}</select></label></header>
    {source.loading ? <p role="status">Cargando las porras de la temporada…</p> : source.error ? <p role="alert">No se ha podido cargar todo el historial. No mostramos una clasificación incompleta; vuelve a abrir este apartado cuando recuperes la conexión.</p> : !games.length ? <p>El historial aparecerá al publicarse la primera acta de esta temporada.</p> : <>
      <div className="ph-grid"><div><h3>{history.total} puntos {month ? 'este mes' : 'esta temporada'}</h3><svg className="ph-chart" viewBox="0 0 600 160" role="img" aria-label={`Evolución acumulada: ${history.total} puntos. Datos por jornada en la tabla siguiente.`}><line x1="20" y1="135" x2="580" y2="135"/><polyline points={path} fill="none" stroke="currentColor" strokeWidth="3"/>{dots.map(p=><g key={p.t.match.id}><circle cx={p.x} cy={p.y} r="4" fill="currentColor"/><title>J{jornadas.get(p.t.match.id) ?? '—'} · {p.t.match.rival}: {p.t.total} acumulados</title></g>)}</svg>
      {history.best ? <p className="ph-best"><b>Tu mejor pronóstico: {history.best.breakdown.total} puntos</b><br/>{history.best.match.rival} · {formatDate(history.best.match.date)} · apostaste {history.best.prediction.goalsFor}–{history.best.prediction.goalsAgainst}.</p> : <p>Aún no tienes porras puntuadas en este periodo.</p>}</div>
      <div><h3>{month ? 'Clasificación mensual' : 'Clasificación de temporada'}</h3><div className="ph-scroll"><table><caption>Puntos · marcadores exactos · participaciones</caption><thead><tr><th scope="col">Socio</th><th scope="col">Pts</th><th scope="col">Exactos</th><th scope="col">PJ</th></tr></thead><tbody>{history.rows.map((r,i)=><tr key={r.uid} aria-current={r.uid===uid ? 'true' : undefined}><th scope="row">{i+1}. {r.name}{r.uid===uid ? ' · Tú' : ''}</th><td>{r.points}</td><td>{r.exact}</td><td>{r.played}</td></tr>)}</tbody></table></div>{!history.rows.length && <p>Nadie participó en este periodo.</p>}</div></div>
      <div className="ph-scroll"><table><caption>Tu evolución por jornada · «Sin apuesta» suma 0 al acumulado</caption><thead><tr><th>Partido</th><th>Tu marcador</th><th>Real</th><th>Puntos</th><th>Acumulado</th></tr></thead><tbody>{history.timeline.map(t=><tr key={t.match.id}><th scope="row"><Link to="/partidos/$matchId" params={{matchId:t.match.id}} search={{tab:'vestuario'}}>J{jornadas.get(t.match.id) ?? '—'} · {t.match.rival}</Link></th><td>{t.mine ? `${t.mine.prediction.goalsFor}–${t.mine.prediction.goalsAgainst}` : 'Sin apuesta'}</td><td>{t.match.goalsFor}–{t.match.goalsAgainst}</td><td>{t.mine?.breakdown.total ?? '—'}</td><td>{t.total}</td></tr>)}</tbody></table></div>
      <p>Desempates: más marcadores exactos, menos participaciones y nombre. Cada mes cuenta los partidos por su fecha en Madrid. Puedes abrir un partido para consultar el desglose de puntos.</p>
    </>}
  </>;
}
