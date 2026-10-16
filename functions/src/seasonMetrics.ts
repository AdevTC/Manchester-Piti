import { createHash } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from './common.js';
import { archivedMatch } from './matchAccess.js';
import { isCompleted } from './matchEngine.js';
import { predictionPoints, sortPorra, type PorraRow } from './vestuarioLogic.js';
import { scorePrediction } from './predictions.js';
import { isGuestId } from './guests.js';

export const playerStatsId = (seasonId: string, playerId: string) => createHash('sha256').update(`${seasonId}/${playerId}`).digest('hex');

/** A vote committed immediately before an archive may have its tally trigger delayed. Restore the
 * preserved votes together with the match so the first public snapshot has the current count. */
export async function prepareMvpTallies(tx: FirebaseFirestore.Transaction, matches: readonly FirebaseFirestore.DocumentSnapshot[]) {
  // Historical imports may contain only an aggregate, without source votes or a player ledger.
  // Such an aggregate is preserved: there is no reliable evidence from which to rebuild it.
  const verifiable = matches.filter(match => {
    const ledger = match.get('ledger');
    return ledger && typeof ledger === 'object' && !Array.isArray(ledger) && Object.keys(ledger).length > 0;
  });
  const votes = await Promise.all(verifiable.map(match => tx.get(match.ref.collection('votes'))));
  const tallies = verifiable.map((match, i) => {
    const ledger = (match.get('ledger') ?? {}) as Record<string, { played?: boolean }>;
    const counts: Record<string, number> = {};
    let total = 0;
    for (const vote of votes[i].docs) {
      const id = vote.get('playerId') as string;
      if (!ledger[id]?.played) continue;
      counts[id] = (counts[id] ?? 0) + 1;
      total++;
    }
    return { id: match.id, counts, total };
  });
  return { writes: tallies.length, write() { for (const { id, ...tally } of tallies) tx.set(db.doc(`mvpResults/${id}`), tally); } };
}
type MatchOverride = ReadonlyMap<string, FirebaseFirestore.DocumentData | null>;
/** Read phase only. Call write() after ALL reads in the surrounding transaction. Overrides describe
 * the match/season state that the transaction is about to commit, never an eventual background fix. */
export async function prepareSeasonMetrics(tx: FirebaseFirestore.Transaction, seasonId: string, overrides: MatchOverride = new Map(), seasonArchived?: boolean) {
  const season = await tx.get(db.doc(`seasons/${seasonId}`));
  const matches = await tx.get(db.collection('matches').where('seasonId', '==', seasonId));
  const active = !(seasonArchived ?? season.get('archived') === true);
  const finished = matches.docs.map(m => ({ id: m.id, data: overrides.has(m.id) ? overrides.get(m.id) : m.data() }))
    .filter((m): m is { id: string; data: FirebaseFirestore.DocumentData } => !!m.data && active && !archivedMatch(m.data) && isCompleted(m.data));
  const predictions = await Promise.all(finished.map(m => tx.get(db.collection(`matchPrivate/${m.id}/predictions`))));
  const oldStats = await tx.get(db.collection('playerSeasonStats').where('seasonId', '==', seasonId));
  const totals = new Map<string, Record<string, number>>();
  const rows = new Map<string, PorraRow>();
  for (const [i, match] of finished.entries()) {
    for (const [playerId, raw] of Object.entries(match.data.ledger ?? {})) {
      if (!raw || typeof raw !== 'object' || isGuestId(playerId)) continue;
      const total = totals.get(playerId) ?? {};
      const row = raw as Record<string, unknown>;
      for (const [key, value] of Object.entries(row)) if (typeof value === 'number' && Number.isFinite(value)) total[key] = (total[key] ?? 0) + value;
      for (const key of ['started', 'benched', 'notCalled', 'played', 'dismissed']) total[key] = (total[key] ?? 0) + (row[key] ? 1 : 0);
      totals.set(playerId, total);
    }
    const result = { goalsFor: match.data.goalsFor ?? 0, goalsAgainst: match.data.goalsAgainst ?? 0 };
    for (const p of predictions[i].docs) {
      const row = rows.get(p.id) ?? { uid: p.id, name: p.get('name') ?? 'Miembro', playerId: p.get('playerId') ?? null, points: 0, exact: 0, hits: 0, played: 0 };
      const prediction = { goalsFor: p.get('goalsFor'), goalsAgainst: p.get('goalsAgainst'), goals: p.get('goals') };
      const pts = predictionPoints(prediction, result);
      row.points += scorePrediction(prediction, result, match.data.events ?? []).total;
      row.exact += pts === 3 ? 1 : 0; row.hits += pts > 0 ? 1 : 0; row.played++;
      row.name = p.get('name') ?? row.name; row.playerId = p.get('playerId') ?? row.playerId;
      rows.set(p.id, row);
    }
  }
  const remaining = new Set([...totals.keys()].map(id => playerStatsId(seasonId, id)));
  const obsolete = oldStats.docs.filter(d => !remaining.has(d.id));
  return {
    writes: obsolete.length + totals.size + 1,
    write() {
      for (const d of obsolete) tx.delete(d.ref);
      for (const [playerId, total] of totals) tx.set(db.doc(`playerSeasonStats/${playerStatsId(seasonId, playerId)}`), { playerId, seasonId, totals: total, updatedAt: FieldValue.serverTimestamp() });
      tx.set(db.doc(`porraStandings/${seasonId}`), { seasonId, rows: sortPorra([...rows.values()]), matches: finished.length, updatedAt: FieldValue.serverTimestamp() });
    },
  };
}
