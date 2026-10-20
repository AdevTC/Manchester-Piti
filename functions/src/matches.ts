// Match lifecycle: aggregate changes commit with the public state; related trees are cleaned only
// after the tombstone makes every stale client/trigger unable to recreate them.
import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { z } from 'zod';
import { admin, db, idSchema, parse } from './common.js';
import { archivedMatch, matchSeasonIds, runMatchTransaction, tombstoneRef } from './matchAccess.js';
import { prepareMvpTallies, prepareSeasonMetrics } from './seasonMetrics.js';
import { archiveClock, restoreArchivedClock, type MatchClock } from './matchClock.js';

export const setMatchArchived = onCall({ timeoutSeconds: 540 }, async req => {
  await admin(req);
  const { id, archived } = parse(z.object({ id: idSchema, archived: z.boolean() }), req.data);
  await runMatchTransaction(id, async (tx, { match, draft, deleted }) => {
    if (deleted.exists || (!match.exists && !draft.exists)) throw new HttpsError('not-found', 'Ese partido ya no existe.');
    const source = match.exists ? match : draft;
    const seasonIds = matchSeasonIds([match, draft]);
    const seasons = seasonIds.length ? await tx.getAll(...seasonIds.map(id => db.doc(`seasons/${id}`))) : [];
    if (!archived && seasons.some(season => season.get('archived') === true)) throw new HttpsError('failed-precondition', 'Restaura primero la temporada para reactivar este partido.');
    const effective = archived;
    const mvp = await prepareMvpTallies(tx, !effective && match.exists ? [match] : []);
    const metrics = [];
    for (const seasonId of seasonIds) metrics.push(await prepareSeasonMetrics(tx, seasonId, new Map([[id, match.exists ? { ...match.data(), archived: effective, individuallyArchived: archived } : null]])));
    const revision = (source.get('revision') ?? 0) + 1;
    const fields = { archived: effective ? true : FieldValue.delete(), individuallyArchived: archived ? true : FieldValue.delete(), revision, updatedAt: FieldValue.serverTimestamp() };
    const now = Date.now();
    for (const row of [match, draft].filter(row => row.exists)) {
      const clock = (effective ? archiveClock : restoreArchivedClock)(row.get('clock') as MatchClock | undefined, now);
      tx.update(row.ref, { ...fields, ...(clock ? { clock } : {}) });
    }
    for (const metric of metrics) metric.write();
    mvp.write();
  }, { aggregate: true });
  return { ok: true };
});

export const deleteMatch = onCall({ timeoutSeconds: 540 }, async req => {
  await admin(req);
  const { id } = parse(z.object({ id: idSchema }), req.data);
  await runMatchTransaction(id, async (tx, { match, draft, deleted }) => {
    if (deleted.exists) return;
    if (!match.exists && !draft.exists) throw new HttpsError('not-found', 'Ese partido ya no existe.');
    const seasonIds = matchSeasonIds([match, draft]);
    const sanctions = await tx.get(db.collection('players').where('sanction.untilMatchId', '==', id));
    const metrics = [];
    for (const season of seasonIds) metrics.push(await prepareSeasonMetrics(tx, season, new Map([[id, null]])));
    // Minimal permanent deny marker. No match content, personal data, actor or audit remains here.
    tx.create(tombstoneRef(id), { deletedAt: FieldValue.serverTimestamp() });
    tx.delete(match.ref); tx.delete(draft.ref); tx.delete(db.doc(`mvpResults/${id}`));
    // Keep the admin's game-count sanction; only remove its now-dead fixture reference.
    for (const player of sanctions.docs) tx.update(player.ref, { 'sanction.untilMatchId': FieldValue.delete() });
    for (const m of metrics) m.write();
  }, { aggregate: true });
  await cleanupDeletedMatch(id);
  return { ok: true };
});

// A durable retry also finishes the cascade if the callable process dies after its atomic commit.
// The caller still waits for its own cleanup; both paths may safely process the same tombstone.
export const cleanupMatchTombstone = onDocumentCreated({ document: 'matchTombstones/{matchId}', retry: true, timeoutSeconds: 540 }, async event => {
  await cleanupDeletedMatch(event.params.matchId);
});

/** Resumable and idempotent: a retry also cleans subcollections whose parent was already removed. */
export async function cleanupDeletedMatch(id: string): Promise<void> {
  const [boards, allLocks, audit, logs, allMatches, deletedMatches] = await Promise.all([
    db.collection('lineups').where('matchId', '==', id).get(),
    db.collection('lineupOfficials').get(),
    db.collection('matchAudit').where('matchId', '==', id).get(),
    db.collection('pushLog').get(), db.collection('matches').select().get(), db.collection('matchTombstones').select().get(),
  ]);
  if (allMatches.docs.some(match => match.id === id)) throw new Error('The public match must be removed before cleaning its tombstone.');
  const otherIds = [...allMatches.docs, ...deletedMatches.docs].map(m => m.id).filter(mid => mid !== id);
  // Early official-board locks sometimes stored the match only in their scope ID.
  const locks = allLocks.docs.filter(lock => lock.get('matchId') === id || (lock.get('matchId') == null && lock.id.endsWith(`__${id}`) && !otherIds.some(other => other.endsWith(`__${id}`) && lock.id.endsWith(`__${other}`))));
  const boardIds = new Set(boards.docs.map(b => b.id));
  for (const lock of locks) if (idSchema.safeParse(lock.get('lineupId')).success) boardIds.add(lock.get('lineupId'));
  // A missing parent does not mean its voice clips/reactions have disappeared. Follow a retained
  // lock to that orphan tree, but do not touch an existing board now bound to a different match.
  const boardRefs = boardIds.size ? await db.getAll(...[...boardIds].map(boardId => db.doc(`lineups/${boardId}`))) : [];
  const relatedBoards = boardRefs.filter(board => !board.exists || board.get('matchId') === id);
  const exact = new Set(['start', 'half', 'second', 'final', 'final-live', 'mvp-open', 'mvp-win', 'conv', 'siete', 'date'].map(prefix => `${prefix}-${id}`));
  exact.add(`conv-${id}-cambios`);
  for (const board of boardIds) exact.add(`lineup-${board}-${id}`);
  for (const board of relatedBoards) exact.add(`seven-${board.id}`);
  const prefixes = ['goal-off', 'goal', 'remind-48', 'remind-24', 'late'];
  const relatedLog = (log: FirebaseFirestore.QueryDocumentSnapshot) => {
    if (typeof log.get('matchId') === 'string') return log.get('matchId') === id;
    if (exact.has(log.id)) return true;
    // A board can move away and release its old lock. Its old match-specific notice still belongs
    // here; the board-wide seven notice belongs to the current board and must be retained.
    if (log.id.startsWith('lineup-') && log.id.endsWith(`-${id}`) && !otherIds.some(other => other.endsWith(`-${id}`) && log.id.endsWith(`-${other}`))) return true;
    // Legacy logs had only a timestamp. Match delimiters, and don't take a longer match ID's log.
    return prefixes.some(prefix => (log.id === `${prefix}-${id}` || log.id.startsWith(`${prefix}-${id}-`)) && !otherIds.some(other => other.startsWith(`${id}-`) && (log.id === `${prefix}-${other}` || log.id.startsWith(`${prefix}-${other}-`))));
  };
  // Logs first: if the process stops after removing a board, no legacy board-only log gets stranded.
  for (const log of logs.docs.filter(relatedLog)) await db.recursiveDelete(log.ref);
  // Keep locks until their orphan board trees are gone, so an interrupted cleanup can find them.
  for (const board of relatedBoards) await db.recursiveDelete(board.ref);
  for (const row of [...audit.docs, ...locks]) await db.recursiveDelete(row.ref);
  // The tombstone transaction already removed the public document and blocks its recreation.
  // Its descendants can outlive it; clean those trees without deleting the absent root again.
  for (const collection of await db.doc(`matches/${id}`).listCollections()) await db.recursiveDelete(collection);
  for (const collection of ['matchPrivate', 'matchDrafts', 'mvpResults', 'convocatoriaReminders']) await db.recursiveDelete(db.doc(`${collection}/${id}`));
}

export { archivedMatch };
