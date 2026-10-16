// Archive a season atomically, retaining an individual match archive when the season returns.
import { FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { db, idSchema, parse, admin } from './common.js';
import { prepareMvpTallies, prepareSeasonMetrics } from './seasonMetrics.js';

export const setSeasonArchived = onCall(async req => {
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
    if (archived && matches.docs.some(m => ['first', 'halftime', 'second'].includes(m.get('clock.phase')))) throw new HttpsError('failed-precondition', 'Finaliza o reinicia los relojes en marcha antes de archivar la temporada.');
    const archivedIds = new Set(seasons.docs.filter(s => s.id === seasonId ? archived : s.get('archived') === true).map(s => s.id));
    const overrides = new Map(matches.docs.map(m => [m.id, { ...m.data(), archived: archived || m.get('individuallyArchived') === true }]));
    const mvp = await prepareMvpTallies(tx, archived ? [] : matches.docs.filter(m => m.get('individuallyArchived') !== true));
    const metrics = await prepareSeasonMetrics(tx, seasonId, overrides, archived);
    if (1 + matches.size + drafts.size + players.size + metrics.writes + mvp.writes > 490) throw new HttpsError('resource-exhausted', 'La temporada es demasiado grande para archivarla de forma atómica. No se ha cambiado ningún dato.');
    const flag = (on: boolean) => on ? true : FieldValue.delete();
    tx.update(season.ref, { archived: flag(archived) });
    for (const m of [...matches.docs, ...drafts.docs]) tx.update(m.ref, { archived: flag(archived || m.get('individuallyArchived') === true), revision: (m.get('revision') ?? 0) + 1 });
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
