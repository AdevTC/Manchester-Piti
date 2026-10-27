import type { ClubMatch } from './clubData';
import { dateMillis, isCompleted } from '../../functions/src/matchEngine';
import { computeStats } from './playerStats';
import { minutesOf, totalMinutes, timedGames } from './derived/minutesOf';
import { scorePrediction, type Prediction } from '../../functions/src/predictions';
import { sortPorra, type PorraRow } from '../../functions/src/vestuarioLogic';
import { dateFormat } from './intlCache';

export function personalMatchSummary(match: ClubMatch, matches: readonly ClubMatch[], playerId: string) {
  const season = matches.filter(m => isCompleted(m) && m.seasonId === match.seasonId && dateMillis(m.date) <= dateMillis(match.date));
  const previous = season.filter(m => m.id !== match.id && computeStats(playerId, [m]).matchesPlayed > 0).sort((a,b) => dateMillis(b.date)-dateMillis(a.date))[0];
  const stats = computeStats(playerId, [match]);
  const minutes = minutesOf(match, playerId);
  const prior = previous ? minutesOf(previous, playerId) : null;
  const row = match.ledger?.[playerId];
  const highlights = (match.events ?? []).filter(e =>
    (e.playerId === playerId && ['goal','goal_penalty','goal_freekick','woodwork','penalty_saved','yellow_card','double_yellow','red_card'].includes(e.type)) ||
    (e.assistPlayerId === playerId && ['goal','goal_penalty','goal_freekick'].includes(e.type)),
  ).sort((a,b) => (a.minute ?? Infinity)-(b.minute ?? Infinity));
  return { stats, minutes, previous, delta: prior != null && minutes != null && stats.matchesPlayed ? minutes-prior : null,
    role: row?.started ? 'Titular' : row?.played ? 'Entró desde el banquillo' : row?.benched ? 'Suplente sin minutos' : row?.notCalled ? 'No convocado' : stats.matchesPlayed ? 'Participó' : 'Sin participación registrada',
    seasonStats: computeStats(playerId, season), seasonMinutes: timedGames(season, playerId) ? totalMinutes(season, playerId) : null,
    unknownMinutes: season.filter(m => minutesOf(m, playerId) == null).length, highlights };
}

export type HistoricalPrediction = Prediction & { matchId: string; uid: string; name: string };
export function monthOf(date: unknown) {
  const ms = dateMillis(date);
  if (!Number.isFinite(ms)) return 'sin-fecha';
  const p = dateFormat('en', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit' }).formatToParts(ms);
  return `${p.find(v=>v.type==='year')!.value}-${p.find(v=>v.type==='month')!.value}`;
}
export function porraHistory(matches: readonly ClubMatch[], predictions: readonly HistoricalPrediction[], uid: string, month = '') {
  const games = matches.filter(m => isCompleted(m) && (!month || monthOf(m.date) === month)).sort((a,b) => dateMillis(a.date)-dateMillis(b.date) || a.id.localeCompare(b.id));
  const byMatch = new Map(games.map(m => [m.id,m]));
  const rows = new Map<string, PorraRow>();
  const scored = predictions.flatMap(p => {
    const m = byMatch.get(p.matchId);
    if (!m) return [];
    const breakdown = scorePrediction(p, { goalsFor:m.goalsFor ?? 0, goalsAgainst:m.goalsAgainst ?? 0 }, m.events);
    const row = rows.get(p.uid) ?? { uid:p.uid, name:p.name, playerId:null, points:0, exact:0, hits:0, played:0 };
    row.points += breakdown.total; row.exact += Number(breakdown.score === 3); row.hits += Number(breakdown.score > 0); row.played++;
    rows.set(p.uid,row);
    return [{ match:m, prediction:p, breakdown }];
  });
  let total = 0;
  const timeline = games.map(match => {
    const mine = scored.find(s=>s.match.id===match.id && s.prediction.uid===uid);
    total += mine?.breakdown.total ?? 0;
    return { match, mine, total };
  });
  const best = scored.filter(s=>s.prediction.uid===uid).sort((a,b)=>b.breakdown.total-a.breakdown.total || dateMillis(b.match.date)-dateMillis(a.match.date))[0];
  return { timeline, best, rows:sortPorra([...rows.values()]), total };
}
