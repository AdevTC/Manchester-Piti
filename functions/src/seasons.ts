// Archive a season atomically, retaining an individual match archive when the season returns.
import { FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { db, idSchema, parse, admin } from './common.js';
import { prepareMvpTallies, prepareSeasonMetrics } from './seasonMetrics.js';
import { archiveClock, restoreArchivedClock, type MatchClock } from './matchClock.js';

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
