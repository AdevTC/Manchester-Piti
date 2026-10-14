// A member changes their handle (users/{uid}.nickname): every copy signed with it follows. The vestuario
// writes the handle next to the uid (the rules check `name == me().nickname` at write time), so after a
// rename the RSVP list, MVP voters, porra, tablón, training votes, the pizarra's «de @…», ficha claims,
// invitations and trainings kept the old one (M7). This trigger rewrites them, with admin privileges
// (no client rule changes), bounded to one club:
// - matches/{m}/votes/{uid}.voterName, matchPrivate/{m}/availability|predictions/{uid}.name — the
//   club's matches (ids only) and one direct get per match (no collectionGroup index needed);
// - trainings/{t}/votes/{uid}.name, trainings.proposedByName / confirmed.byName (who.name);
// - board where uid == uid; lineups where ownerUid == uid (ownerNickname); invites where by == uid
//   (byName = displayName || nickname, as createInvite writes it); playerClaims/{uid}.nickname;
// - porraStandings/{season}.rows[] (uid → name), after the predictions, in a transaction per season.
// Idempotent (docs already right are skipped), capped (RENAME_CAP writes), and it always writes the
// handle the profile has *now*: renames in a row (or events out of order) end with the last name.
import { type DocumentReference, type DocumentSnapshot } from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { db } from "./common.js";

/** Most documents one rename rewrites (one club: far above what a member signs in years). */
export const RENAME_CAP = 2000;
/** Refs per getAll. */
const CHUNK = 300;
/** Re-runs when the handle changed again while rewriting. */
const PASSES = 3;

const nickOf = (snap: DocumentSnapshot | undefined) => {
  const n = snap?.exists ? snap.get("nickname") : undefined;
  return typeof n === "string" ? n : "";
};

interface Change {
  ref: DocumentReference;
  data: Record<string, unknown>;
}

async function getAll(refs: DocumentReference[]): Promise<DocumentSnapshot[]> {
  const out: DocumentSnapshot[] = [];
  for (let i = 0; i < refs.length; i += CHUNK) out.push(...(await db.getAll(...refs.slice(i, i + CHUNK))));
  return out;
}

/** Each copy of `uid`'s handle that is not `nick` yet (porraStandings apart: see renamePorra). */
async function staleCopies(uid: string, nick: string, inviteName: string): Promise<Change[]> {
  const [matches, trainings, board, lineups, invites, claim] = await Promise.all([
    db.collection("matches").select().get(),
    db.collection("trainings").get(),
    db.collection("board").where("uid", "==", uid).get(),
    db.collection("lineups").where("ownerUid", "==", uid).get(),
    db.collection("invites").where("by", "==", uid).get(),
    db.doc(`playerClaims/${uid}`).get(),
  ]);
  const changes: Change[] = [];
  const field = (snap: DocumentSnapshot, key: string, value: string) => {
    if (snap.exists && snap.get(key) !== value) changes.push({ ref: snap.ref, data: { [key]: value } });
  };
  // (direct gets of the member's own doc under each match and training: missing ones cost a read, no write)
  const own: [string, string][] = [
    ...matches.docs.flatMap((m): [string, string][] => [
      [`matches/${m.id}/votes/${uid}`, "voterName"],
      [`matchPrivate/${m.id}/availability/${uid}`, "name"],
      [`matchPrivate/${m.id}/predictions/${uid}`, "name"],
    ]),
    ...trainings.docs.map((t): [string, string] => [`trainings/${t.id}/votes/${uid}`, "name"]),
  ];
  const snaps = await getAll(own.map(([path]) => db.doc(path)));
  snaps.forEach((s, i) => field(s, own[i][1], nick));
  for (const t of trainings.docs) {
    if (t.get("proposedBy") === uid) field(t, "proposedByName", nick);
    if (t.get("confirmed.by") === uid && t.get("confirmed.byName") !== nick) changes.push({ ref: t.ref, data: { "confirmed.byName": nick } });
  }
  for (const b of board.docs) field(b, "name", nick);
  for (const l of lineups.docs) field(l, "ownerNickname", nick);
  for (const i of invites.docs) field(i, "byName", inviteName);
  field(claim, "nickname", nick);
  return changes;
}

/** The two trainings fields of one doc travel in one update (a doc written twice in a BulkWriter fails). */
function merged(changes: Change[]): Change[] {
  const byPath = new Map<string, Change>();
  for (const c of changes) {
    const seen = byPath.get(c.ref.path);
    if (seen) Object.assign(seen.data, c.data);
    else byPath.set(c.ref.path, { ref: c.ref, data: { ...c.data } });
  }
  return [...byPath.values()];
}

async function write(changes: Change[]): Promise<number> {
  if (!changes.length) return 0;
  const writer = db.bulkWriter();
  // (a doc deleted meanwhile — NOT_FOUND, gRPC 5 — is simply gone: no retry)
  writer.onWriteError((e) => e.code !== 5 && e.failedAttempts < 3);
  let done = 0;
  const all = changes.map((c) =>
    writer.update(c.ref, c.data).then(
      () => void done++,
      (e: unknown) => console.error("renameEverywhere: not rewritten", c.ref.path, e),
    ),
  );
  await writer.close();
  await Promise.all(all);
  return done;
}

const isRow = (r: unknown): r is { uid: unknown; name: unknown } => !!r && typeof r === "object" && "uid" in r;
/** porraStandings rows are an array inside each season's doc: rewrite the member's row, one season at a time. */
async function renamePorra(uid: string, nick: string, budget: number): Promise<number> {
  const seasons = await db.collection("porraStandings").get();
  let done = 0;
  for (const s of seasons.docs) {
    if (done >= budget) break;
    const rows = s.get("rows");
    if (!Array.isArray(rows) || !rows.some((r: unknown) => isRow(r) && r.uid === uid && r.name !== nick)) continue;
    // (in a transaction: recomputePorra may be rebuilding this table right now)
    const wrote = await db.runTransaction(async (tx) => {
      const fresh = await tx.get(s.ref);
      const current = fresh.get("rows");
      if (!Array.isArray(current)) return false;
      let changed = false;
      const next = current.map((r: unknown) => {
        if (!isRow(r) || r.uid !== uid || r.name === nick) return r;
        changed = true;
        return { ...r, name: nick };
      });
      if (changed) tx.update(s.ref, { rows: next });
      return changed;
    });
    if (wrote) done++;
  }
  return done;
}

/** Rewrites every copy of `uid`'s handle to the one users/{uid} has now. Returns the documents written. */
export async function renameCopies(uid: string): Promise<number> {
  let written = 0;
  for (let pass = 0; pass < PASSES; pass++) {
    const user = await db.doc(`users/${uid}`).get();
    const nick = nickOf(user);
    if (!nick) return written;
    const inviteName = (user.get("displayName") as string | undefined) || nick;
    const budget = RENAME_CAP - written;
    const changes = merged(await staleCopies(uid, nick, inviteName));
    if (changes.length > budget) console.error("renameEverywhere: capped", { uid, stale: changes.length, cap: RENAME_CAP });
    written += await write(changes.slice(0, budget));
    // (after the predictions: a porra rebuilt from now on already reads the new name)
    written += await renamePorra(uid, nick, RENAME_CAP - written);
    if (written >= RENAME_CAP) {
      console.error("renameEverywhere: cap reached, some copies keep the old handle", { uid, cap: RENAME_CAP });
      return written;
    }
    // Renamed again meanwhile: another pass with the newest (the later trigger converges on it too).
    if (nickOf(await db.doc(`users/${uid}`).get()) === nick) return written;
  }
  return written;
}

/**
 * Only when the handle changes (any other write of a profile exits here, without a read). A profile just
 * created has signed nothing yet; a deleted one has no handle to rename to.
 */
export const renameEverywhere = onDocumentWritten("users/{uid}", async (event) => {
  const before = event.data?.before;
  const after = event.data?.after;
  if (!before?.exists || !after?.exists) return;
  const next = nickOf(after);
  if (!next || nickOf(before) === next) return;
  const written = await renameCopies(event.params.uid);
  if (written) console.log("renameEverywhere", { uid: event.params.uid, written });
});
