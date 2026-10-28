// Archive a season atomically, retaining an individual match archive when the season returns.
import { FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { db, idSchema, parse, admin } from './common.js';
import { prepareMvpTallies, prepareSeasonMetrics } from './seasonMetrics.js';
import { archiveClock, restoreArchivedClock, type MatchClock } from './matchClock.js';
import { onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { afterSeasonDeleted } from './matchExtrasLogic.js';

/**
 * B-CLUB-01 · «Eliminar la temporada»: the season goes, and every player loses it from `seasons` with his archive
 * flag recomputed from the ones he still has (none left: not archived, a baja among «Antiguos»). Its matches stay,
 * archived and without a season. One transaction; the trigger below does the same for a season deleted directly
 * (today's web), so nobody is left archived for ever either way.
 */
export const deleteSeason = onCall({ timeoutSeconds: 540 }, async req => {
  await admin(req);
  const { seasonId } = parse(z.object({ seasonId: idSchema }), req.data);
  return db.runTransaction(async tx => {
    const seasons = await tx.get(db.collection('seasons'));
    const season = seasons.docs.find(s => s.id === seasonId);
    if (!season) throw new HttpsError('not-found', 'La temporada no existe.');
    const matches = await tx.get(db.collection('matches').where('seasonId', '==', seasonId));
    if (season.get('archived') !== true && matches.size > 0) throw new HttpsError('failed-precondition', 'Archiva la temporada antes de eliminarla.');
    const players = await tx.get(db.collection('players').where('seasons', 'array-contains', seasonId));
    const archivedIds = new Set(seasons.docs.filter(s => s.id !== seasonId && s.get('archived') === true).map(s => s.id));
    tx.delete(season.ref);
    let back = 0;
    for (const p of players.docs) {
      const next = afterSeasonDeleted((p.get('seasons') ?? []) as string[], seasonId, archivedIds);
      if (!next.archived && p.get('archived') === true) back++;
      tx.update(p.ref, { seasons: next.seasons, archived: next.archived ? true : FieldValue.delete() });
    }
    return { players: back, matches: matches.size };
  });
});

/** A season deleted without deleteSeason (the web of today deletes the document): its players are released. */
export const onSeasonDeleted = onDocumentDeleted('seasons/{seasonId}', async event => {
  const { seasonId } = event.params;
  try {
    await db.runTransaction(async tx => {
      const seasons = await tx.get(db.collection('seasons'));
      // (recreated meanwhile: leave it)
      if (seasons.docs.some(s => s.id === seasonId)) return;
      const players = await tx.get(db.collection('players').where('seasons', 'array-contains', seasonId));
      const archivedIds = new Set(seasons.docs.filter(s => s.get('archived') === true).map(s => s.id));
      for (const p of players.docs) {
        const next = afterSeasonDeleted((p.get('seasons') ?? []) as string[], seasonId, archivedIds);
        tx.update(p.ref, { seasons: next.seasons, archived: next.archived ? true : FieldValue.delete() });
      }
    });
  } catch (e) {
    console.error('onSeasonDeleted', seasonId, e);
    throw e;
  }
});

export const setSeasonArchived = onCall({ timeoutSeconds: 540 }, async req => {
  await admin(req);
  const { seasonId, archived } = parse(z.object({ seasonId: idSchema, archived: z.boolean() }), req.data);
  return db.runTransaction(async tx => {
    // Seasons first, then matches and their dependants: same order as match-level transactions.
    const seasons = await tx.get(db.collection('seasons'));
    const season = seasons.docs.find(s => s.id === seasonId);
    if (!season) throw new HttpsError('not-found', 'La temporada no existe.');
    const matches = await tx.get(db.collection('matches').where('seasonId', '==', seasonId));
    const drafts = await tx.get(db.collection('matchDrafts').where('seasonId', '==', seasonId));
    const players = await tx.get(db.collection('players').where('seasons', 'array-contains', seasonId));
    const archivedIds = new Set(seasons.docs.filter(s => s.id === seasonId ? archived : s.get('archived') === true).map(s => s.id));
    const overrides = new Map(matches.docs.map(m => [m.id, { ...m.data(), archived: archived || m.get('individuallyArchived') === true }]));
    const mvp = await prepareMvpTallies(tx, archived ? [] : matches.docs.filter(m => m.get('individuallyArchived') !== true));
    const metrics = await prepareSeasonMetrics(tx, seasonId, overrides, archived);
    const flag = (on: boolean) => on ? true : FieldValue.delete();
    tx.update(season.ref, { archived: flag(archived) });
    const now = Date.now();
    for (const m of [...matches.docs, ...drafts.docs]) {
      const effective = archived || m.get('individuallyArchived') === true;
      const clock = (effective ? archiveClock : restoreArchivedClock)(m.get('clock') as MatchClock | undefined, now);
      tx.update(m.ref, { archived: flag(effective), revision: (m.get('revision') ?? 0) + 1, ...(clock ? { clock } : {}) });
    }
    let archivedPlayers = 0;
    for (const p of players.docs) {
      const theirs = (p.get('seasons') ?? []) as string[];
      const on = theirs.length > 0 && theirs.every(id => archivedIds.has(id));
      if (on) archivedPlayers++;
      tx.update(p.ref, { archived: flag(on) });
    }
    metrics.write();
    mvp.write();
    return { matches: matches.size, players: archivedPlayers };
  });
});
