import { HttpsError } from 'firebase-functions/v2/https';
import { createHash } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { narrationSnapshot } from './privateSources.js';
import { db } from '../common.js';
import type { MatchSheet } from '../matchEngine.js';
import type { NarrationSource } from './schema.js';

/** Reads precede every write in publication; equal retries leave the existing audit untouched. */
export async function prepareNarrationHistory(tx: FirebaseFirestore.Transaction, id: string, uid: string, revision: number, draft: boolean, sheet: MatchSheet, sources: NarrationSource[], old: FirebaseFirestore.DocumentSnapshot) {
  const snapshots = [narrationSnapshot(sheet, sources), old.exists ? narrationSnapshot({ events: old.get('events') ?? [], analysis: old.get('analysis') }) : null].filter(s => s !== null);
  if (snapshots.some(s => Buffer.byteLength(JSON.stringify(s)) > 900000)) throw new HttpsError('invalid-argument', 'El historial del análisis supera el tamaño permitido. Reduce los fragmentos privados.');
  const unique = new Map(snapshots.map(s => [createHash('sha256').update(JSON.stringify(s)).digest('hex'), s]));
  const entries = [...unique.entries()];
  const refs = entries.map(([hash]) => db.doc(`matchPrivate/${id}/analysisHistory/${hash}`));
  const stored = refs.length ? await tx.getAll(...refs) : [];
  return () => entries.forEach(([, snapshot], i) => {
    if (!stored[i].exists) tx.create(refs[i], { ...snapshot, revision, draft, uid, createdAt: FieldValue.serverTimestamp() });
  });
}
