import { HttpsError } from 'firebase-functions/v2/https';
import { db } from './common.js';

export const tombstoneRef = (id: string) => db.doc(`matchTombstones/${id}`);
export const archivedMatch = (data: FirebaseFirestore.DocumentData | undefined) => data?.archived === true || data?.individuallyArchived === true;

type MatchScope = { match: FirebaseFirestore.DocumentSnapshot; draft: FirebaseFirestore.DocumentSnapshot; deleted: FirebaseFirestore.DocumentSnapshot };
class MatchScopeChanged extends Error {}
const seasonIdsOf = (docs: readonly FirebaseFirestore.DocumentSnapshot[]) => docs.map(d => d.get('seasonId')).filter((id): id is string => typeof id === 'string' && !!id);

/** Lock order for every match mutation: seasons (sorted), then matches, then dependent records.
 * The outside read only discovers which season to lock; the transaction rechecks that scope before
 * using any data. Aggregate operations read the whole season before locking a particular match, so
 * archiving A and deleting B cannot each hold one match while waiting for the other. */
export async function runMatchTransaction<T>(id: string, work: (tx: FirebaseFirestore.Transaction, scope: MatchScope) => Promise<T>, options: { seasons?: string[]; aggregate?: boolean } = {}): Promise<T> {
  const refs = [db.doc(`matches/${id}`), db.doc(`matchDrafts/${id}`)];
  for (let attempt = 0; attempt < 3; attempt++) {
    const hint = await db.getAll(...refs);
    const seasonIds = [...new Set([...seasonIdsOf(hint), ...(options.seasons ?? [])])].sort();
    try {
      return await db.runTransaction(async tx => {
        // Sequential sorted reads make the acquisition order explicit, including cross-season moves.
        for (const season of seasonIds) await tx.get(db.doc(`seasons/${season}`));
        if (options.aggregate) for (const season of seasonIds) await tx.get(db.collection('matches').where('seasonId', '==', season));
        const [match, draft, deleted] = await tx.getAll(...refs, tombstoneRef(id));
        if (seasonIdsOf([match, draft]).some(season => !seasonIds.includes(season))) throw new MatchScopeChanged();
        return work(tx, { match, draft, deleted });
      });
    } catch (error) {
      if (!(error instanceof MatchScopeChanged)) throw error;
    }
  }
  throw new HttpsError('aborted', 'El partido ha cambiado de temporada. Recarga antes de continuar.');
}

export const runOptionalMatchTransaction = <T>(id: string | null | undefined, work: (tx: FirebaseFirestore.Transaction) => Promise<T>): Promise<T> => id ? runMatchTransaction(id, work) : db.runTransaction(work);

/** All readers participate in the same transaction as their write: deletion/archive wins the race. */
export async function matchActiveTx(tx: FirebaseFirestore.Transaction, id: string, known?: FirebaseFirestore.DocumentSnapshot): Promise<boolean> {
  const [match, deleted] = await Promise.all([known ?? tx.get(db.doc(`matches/${id}`)), tx.get(tombstoneRef(id))]);
  if (!match.exists || deleted.exists || archivedMatch(match.data())) return false;
  const seasonId = match.get('seasonId');
  if (typeof seasonId !== 'string' || !seasonId) return true;
  const season = await tx.get(db.doc(`seasons/${seasonId}`));
  return season.get('archived') !== true;
}

export async function requireActiveMatch(tx: FirebaseFirestore.Transaction, id: string, known?: FirebaseFirestore.DocumentSnapshot): Promise<void> {
  if (!(await matchActiveTx(tx, id, known))) throw new HttpsError('failed-precondition', 'El partido está archivado o ya no existe. Recarga antes de continuar.');
}

export async function assertMatchNotDeleted(tx: FirebaseFirestore.Transaction, id: string): Promise<void> {
  if ((await tx.get(tombstoneRef(id))).exists) throw new HttpsError('failed-precondition', 'Este partido se ha eliminado. No se puede recuperar desde una pestaña antigua.');
}

/** Match notices always link here, even the ones about the official pizarra. */
export const noticeMatchId = (url: string): string | null => /^\/matches\/([A-Za-z0-9_-]+)(?:[?#]|$)/.exec(url)?.[1] ?? null;
// A consistent read snapshot without write locks; actual log/data mutations still call matchActiveTx
// inside their own write transaction so an archive/delete invalidates their commit.
export const matchActive = (id: string) => db.runTransaction(tx => matchActiveTx(tx, id), { readOnly: true });
