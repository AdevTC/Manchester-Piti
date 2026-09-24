// Season archive: an archived season (and its matches and the players who only
// played it) stays in Firestore untouched, but every public reader drops it.
// The flag is denormalised onto each match/player so the client mappers can
// filter without knowing which seasons are archived.
import { FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { db, idSchema, parse, admin } from "./common.js";

const BATCH = 400;

export const setSeasonArchived = onCall(async (req) => {
  await admin(req);
  const { seasonId, archived } = parse(
    z.object({ seasonId: idSchema, archived: z.boolean() }),
    req.data,
  );
  const season = await db.doc(`seasons/${seasonId}`).get();
  if (!season.exists) throw new HttpsError("not-found", "La temporada no existe.");
  const [seasons, matches, players] = await Promise.all([
    db.collection("seasons").get(),
    db.collection("matches").where("seasonId", "==", seasonId).get(),
    db.collection("players").where("seasons", "array-contains", seasonId).get(),
  ]);
  const archivedIds = new Set(
    seasons.docs
      .filter((s) => (s.id === seasonId ? archived : s.get("archived") === true))
      .map((s) => s.id),
  );
  const flag = (on: boolean) => (on ? true : FieldValue.delete());
  const writes: [FirebaseFirestore.DocumentReference, boolean][] = [
    [season.ref, archived],
    ...matches.docs.map((m) => [m.ref, archived] as [FirebaseFirestore.DocumentReference, boolean]),
    // A player disappears only when every season they belong to is archived.
    ...players.docs.map((p) => {
      const theirs = (p.get("seasons") ?? []) as string[];
      return [p.ref, theirs.length > 0 && theirs.every((id) => archivedIds.has(id))] as [FirebaseFirestore.DocumentReference, boolean];
    }),
  ];
  for (let i = 0; i < writes.length; i += BATCH) {
    const batch = db.batch();
    for (const [ref, on] of writes.slice(i, i + BATCH)) batch.update(ref, { archived: flag(on) });
    await batch.commit();
  }
  return {
    matches: matches.size,
    players: writes.slice(1 + matches.size).filter(([, on]) => on).length,
  };
});
