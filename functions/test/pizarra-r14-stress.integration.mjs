// r14 · onLineupR14 under contention, the way impl/pz-state.mjs moves J3 between moments on the shared emulators:
// in a rapid sequence and without waiting for the triggers — delete the official's scope doc, its reactions and the
// mesa's copy board, update the match, publish / change / unpublish the official board several times, write the
// reactions and a new mesa copy — ten rounds in a row. The emulator must keep answering (no `2 UNKNOWN`, no hang),
// and once the triggers settle the board is consistent (stamped, no history under a deleted board). Demo emulators,
// its own `r14s-…` documents only (cleaned up at the end).
import assert from "node:assert/strict";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
const { initializeApp } = await import("firebase-admin/app");
const { getFirestore, Timestamp, FieldValue } = await import("firebase-admin/firestore");
initializeApp({ projectId: "demo-manchester-piti" });
const db = getFirestore();
const suffix = `r14s-${Date.now().toString(36)}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
/** A read that must answer within `ms` (a hung emulator never does). */
const alive = async (what, ms = 15_000) => {
  const t = setTimeout(() => {
    console.error(`pizarra-r14-stress: the emulator stopped answering (${what})`);
    process.exit(1);
  }, ms);
  await db.doc(`seasons/${suffix}-season`).get();
  clearTimeout(t);
};

const seasonId = `${suffix}-season`, matchId = `${suffix}-j3`, B = `lineups/${suffix}-official`, MESA = `lineups/${suffix}-mesa`;
const lock = `lineupOfficials/${seasonId}__${matchId}`;
const ids = Array.from({ length: 12 }, (_, i) => `${suffix}-p${i}`);
const seven = (k) => ids.slice(k % 5, (k % 5) + 7).map((playerId) => ({ playerId }));
const board = (k, extra = {}) => ({ name: "Oficial", ownerUid: "u-owner", ownerNickname: "owner", seasonId, formation: k % 2 ? "3-2-1" : "2-3-1", freeMode: false, slots: seven(k), matchId, isOfficial: false, updatedAt: Timestamp.now(), ...extra });
let errors = 0;
const tryWrite = async (p) => {
  try {
    await p;
  } catch (e) {
    errors++;
    if (/UNKNOWN|DEADLINE|unavailable/i.test(String(e))) throw e;
  }
};
try {
  await db.doc(`seasons/${seasonId}`).set({ name: "r14 · estrés" });
  await db.doc(`matches/${matchId}`).set({ seasonId, status: "scheduled", rival: "Red Demons", date: Date.now() + 86_400_000, events: [] });
  await db.doc(B).set(board(0));
  await wait(1500);
  const t0 = Date.now();
  for (let round = 0; round < 10; round++) {
    // undo: the scope doc, the reactions and the mesa copy go; the match and the board are put back
    const batch = db.batch();
    batch.delete(db.doc(lock));
    for (let i = 0; i < 11; i++) batch.delete(db.doc(`${B}/reactions/u${i}`));
    await tryWrite(batch.commit());
    await tryWrite(db.doc(MESA).delete());
    await tryWrite(db.doc(`matches/${matchId}`).update({ date: Date.now() + 86_400_000 - round * 60_000, starters: [], bench: [] }));
    await tryWrite(db.doc(B).update({ isOfficial: false, slots: seven(round), updatedAt: Timestamp.now() }));
    // apply: the match, the board published and changed, its scope doc, reactions and a fresh mesa copy
    await tryWrite(db.doc(`matches/${matchId}`).update({ starters: seven(round + 1).map((s) => s.playerId), updatedAt: Timestamp.now() }));
    await tryWrite(db.doc(B).update({ isOfficial: true, formation: round % 2 ? "2-3-1" : "3-2-1", slots: seven(round + 1), updatedAt: Timestamp.now() }));
    await tryWrite(db.doc(B).update({ slots: seven(round + 2), updatedAt: Timestamp.now() }));
    await tryWrite(db.doc(lock).set({ lineupId: B.split("/")[1], seasonId, matchId, at: Timestamp.now() }));
    const w = db.batch();
    for (let i = 0; i < 11; i++) w.set(db.doc(`${B}/reactions/u${i}`), { value: i % 4 ? "ok" : "dudas", at: Timestamp.now() });
    w.set(db.doc(MESA), board(round, { name: "Siete del campo · J3", ownerUid: "u-fer", fromMesa: true }));
    await tryWrite(w.commit());
    await alive(`round ${round + 1}`);
  }
  // let the triggers settle, then: still answering, the board stamped, its history capped, the mesa copy's history
  // only under a board that exists
  // (the emulator runs the triggers one after another, so they settle well after the writes: up to 2 min)
  let b;
  for (let i = 0; i < 120; i++) {
    await alive(`settling ${i}`);
    b = (await db.doc(B).get()).data();
    const key = [...new Set(b.slots.map((s) => s.playerId))].sort().join(",");
    if (b.sevenKey === key && b.sevenRev >= 1) break;
    await wait(1000);
  }
  assert.equal(b.isOfficial, true);
  assert.ok(typeof b.sevenKey === "string" && b.sevenRev >= 1, `stamped: ${JSON.stringify({ k: b.sevenKey, r: b.sevenRev })}`);
  assert.ok((await db.collection(`${B}/history`).get()).size <= 20);
  await db.doc(MESA).delete();
  await wait(4000);
  assert.equal((await db.collection(`${MESA}/history`).get()).size, 0, "history left under the deleted mesa copy");
  console.log(`pizarra-r14-stress: 10 rounds in ${Date.now() - t0} ms, ${errors} refused writes, emulator answering, board stamped (rev ${b.sevenRev}) — OK`);
} finally {
  for (const p of [B, MESA]) await db.recursiveDelete(db.doc(p)).catch(() => {});
  for (const p of [lock, `matches/${matchId}`, `matchPrivate/${matchId}`, `seasons/${seasonId}`]) await db.recursiveDelete(db.doc(p)).catch(() => {});
  void FieldValue;
}
