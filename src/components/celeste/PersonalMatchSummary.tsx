import { Link } from '@tanstack/react-router';
import { EVENT_LABELS, formatDate, type ClubMatch } from '../../lib/clubData';
import { personalMatchSummary } from '../../lib/postMatch';
import { fmtMinutes } from '../../lib/derived/minutes';
import { useMyPrediction } from '../../pages/vestuario/live';
import { scorePrediction } from '../../../functions/src/predictions';
import './post-match.css';

export function PersonalMatchSummary({ match, matches, playerId, uid }: { match: ClubMatch; matches: readonly ClubMatch[]; playerId?: string | null; uid: string }) {
  const prediction = useMyPrediction(match.id, uid);
  const s = playerId ? personalMatchSummary(match,matches,playerId) : null;
  const points = prediction.data ? scorePrediction(prediction.data,{goalsFor:match.goalsFor ?? 0,goalsAgainst:match.goalsAgainst ?? 0},match.events) : null;
  return <section className="pm-summary" aria-label="Tu resumen del partido">
    <header><div><span className="hm-kick">Balance del partido · {formatDate(match.date)}</span><h2>Tu partido, en una mirada</h2><p>Piti {match.goalsFor}–{match.goalsAgainst} {match.rival} · {s?.role ?? 'Vincula tu ficha para ver tus minutos y acciones'}</p></div><Link to="/matches/$matchId" params={{matchId:match.id}} search={{tab:'vestuario'}} className="hm-ghostbtn">Ver partido →</Link></header>
    <div className="pm-numbers">{s && <><div><b>{fmtMinutes(s.minutes)}</b><span>Minutos</span></div><div><b>{s.stats.goals}</b><span>Goles</span></div><div><b>{s.stats.assists}</b><span>Asistencias</span></div></>}<div><b>{prediction.loading ? '…' : points?.total ?? '—'}</b><span>Puntos de porra</span></div></div>
    {prediction.error && <p role="status">No se ha podido cargar tu porra.</p>}
    {!prediction.loading && !prediction.error && !points && <p>No participaste en la porra de este partido.</p>}
    {points && <p>Porra: {points.score} por resultado · {points.scorerPoints} por goleadores · {points.assistPoints} por asistentes · {points.actionPoints + points.multiplePoints} de bonus.</p>}
    {s && <><div className="pm-evolution"><b>{s.delta == null ? 'Evolución de temporada' : `${s.delta > 0 ? '+' : s.delta < 0 ? '−' : ''}${fmtMinutes(Math.abs(s.delta))} respecto a tu anterior partido`}</b><span>Hasta este partido: {s.seasonStats.matchesPlayed} jugados · {fmtMinutes(s.seasonMinutes)} registrados · {s.seasonStats.goals} goles · {s.seasonStats.assists} asistencias.</span>{s.unknownMinutes > 0 && <small>Faltan minutos de {s.unknownMinutes} actas antiguas; no se han estimado.</small>}</div>
    {s.highlights.length > 0 ? <ul className="pm-highlights" aria-label="Tus acciones destacadas">{s.highlights.map(e=><li key={e.id}><b>{e.minute == null ? '—' : `${e.minute}′`}</b><span>{e.assistPlayerId===playerId ? 'Asistencia de gol' : EVENT_LABELS[e.type]}</span></li>)}</ul> : <p>Sin goles, asistencias, tarjetas, palos ni penaltis parados registrados a tu nombre.</p>}</>}
  </section>;
}
