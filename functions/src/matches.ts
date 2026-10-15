// Match lifecycle: aggregate changes commit with the public state; related trees are cleaned only
// after the tombstone makes every stale client/trigger unable to recreate them.
import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { z } from 'zod';
import { admin, db, idSchema, parse } from './common.js';
import { archivedMatch, runMatchTransaction, tombstoneRef } from './matchAccess.js';
import { prepareMvpTallies, prepareSeasonMetrics } from './seasonMetrics.js';

export const setMatchArchived = onCall(async req => {
  await admin(req);
  const { id, archived } = parse(z.object({ id: idSchema, archived: z.boolean() }), req.data);
  await runMatchTransaction(id, async (tx, { match, draft, deleted }) => {
    if (deleted.exists || (!match.exists && !draft.exists)) throw new HttpsError('not-found', 'Ese partido ya no existe.');
    const source = match.exists ? match : draft;
    const seasonId = source.get('seasonId') as string;
    const season = await tx.get(db.doc(`seasons/${seasonId}`));
    if (!archived && season.get('archived') === true) throw new HttpsError('failed-precondition', 'Restaura primero la temporada para reactivar este partido.');
    if (archived && ['first', 'halftime', 'second'].includes(source.get('clock.phase'))) throw new HttpsError('failed-precondition', 'Finaliza o reinicia el reloj antes de archivar este partido.');
    const effective = archived || season.get('archived') === true;
    const mvp = await prepareMvpTallies(tx, !effective && match.exists ? [match] : []);
    const metrics = await prepareSeasonMetrics(tx, seasonId, new Map([[id, { ...match.data(), archived: effective, individuallyArchived: archived }]]));
    if (metrics.writes + mvp.writes + Number(match.exists) + Number(draft.exists) > 490) throw new HttpsError('resource-exhausted', 'La temporada es demasiado grande para esta operación atómica. No se ha cambiado ningún dato.');
    const revision = (source.get('revision') ?? 0) + 1;
    const fields = { archived: effective ? true : FieldValue.delete(), individuallyArchived: archived ? true : FieldValue.delete(), revision, updatedAt: FieldValue.serverTimestamp() };
    if (match.exists) tx.update(match.ref, fields);
    if (draft.exists) tx.update(draft.ref, fields);
    metrics.write();
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
    const seasonIds = [...new Set([match.get('seasonId'), draft.get('seasonId')].filter((s): s is string => typeof s === 'string' && !!s))];
    const sanctions = await tx.get(db.collection('players').where('sanction.untilMatchId', '==', id));
    const metrics = [];
    for (const season of seasonIds.sort()) metrics.push(await prepareSeasonMetrics(tx, season, new Map([[id, null]])));
    if (metrics.reduce((sum, m) => sum + m.writes, 4 + sanctions.size) > 490) throw new HttpsError('resource-exhausted', 'La temporada es demasiado grande para esta operación atómica. No se ha borrado ningún dato.');
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
  const [boards, locks, audit, logs, allMatches, deletedMatches] = await Promise.all([
    db.collection('lineups').where('matchId', '==', id).get(),
    db.collection('lineupOfficials').where('matchId', '==', id).get(),
    db.collection('matchAudit').where('matchId', '==', id).get(),
    db.collection('pushLog').get(), db.collection('matches').select().get(), db.collection('matchTombstones').select().get(),
  ]);
  const boardIds = new Set(boards.docs.map(b => b.id));
  for (const lock of locks.docs) if (typeof lock.get('lineupId') === 'string') boardIds.add(lock.get('lineupId'));
  const otherIds = [...allMatches.docs, ...deletedMatches.docs].map(m => m.id).filter(mid => mid !== id);
  const exact = new Set(['start', 'half', 'second', 'final', 'final-live', 'mvp-open', 'mvp-win', 'conv', 'siete', 'date'].map(prefix => `${prefix}-${id}`));
  exact.add(`conv-${id}-cambios`);
  for (const board of boardIds) { exact.add(`seven-${board}`); exact.add(`lineup-${board}-${id}`); }
  const prefixes = ['goal-off', 'goal', 'remind-48', 'remind-24', 'late'];
  const relatedLog = (log: FirebaseFirestore.QueryDocumentSnapshot) => {
    if (log.get('matchId') === id || exact.has(log.id)) return true;
    // Legacy logs had only a timestamp. Match delimiters, and don't take a longer match ID's log.
    return prefixes.some(prefix => (log.id === `${prefix}-${id}` || log.id.startsWith(`${prefix}-${id}-`)) && !otherIds.some(other => other.startsWith(`${id}-`) && (log.id === `${prefix}-${other}` || log.id.startsWith(`${prefix}-${other}-`))));
  };
  // Logs first: if the process stops after removing a board, no legacy board-only log gets stranded.
  for (const log of logs.docs.filter(relatedLog)) await db.recursiveDelete(log.ref);
  for (const row of [...audit.docs, ...locks.docs]) await db.recursiveDelete(row.ref);
  for (const board of boards.docs) await db.recursiveDelete(board.ref);
  for (const collection of ['matches', 'matchPrivate', 'matchDrafts', 'mvpResults', 'convocatoriaReminders']) await db.recursiveDelete(db.doc(`${collection}/${id}`));
}

export { archivedMatch };
