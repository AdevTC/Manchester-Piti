// r14 · the rules' evaluation budget (1000 expressions per request) on production-sized boards. The seeded boards
// of the shared emulators (test/rules/fixtures/pz-boards.json: «Como en J1», Jordi's own; «J3 · Red Demons», the
// official with plays, drawings, variants, plan, rival…) and a worst case at every list cap must save — the
// autosave rewrites the whole board — when created, edited, published and edited by a captain. Its own project id.
import { readFileSync } from "node:fs";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, serverTimestamp, setDoc, Timestamp, updateDoc } from "firebase/firestore";
import { autosave, changed, fx, OWNER, revive, worst } from "./fixtures/budgetBoards";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

let env: RulesTestEnvironment;
const ctx = (uid: string) => env.authenticatedContext(uid, { email_verified: true, firebase: { sign_in_provider: "google.com" } }).firestore();
const seed = async (path: string, data: object) =>
  env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), path), data);
  });

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-manchester-piti-rules-budget",
    firestore: { host: "127.0.0.1", port: Number(process.env.FIRESTORE_EMULATOR_HOST?.split(":").pop()) || 8080, rules: readFileSync("firestore.rules", "utf8") },
  });
});
beforeEach(async () => {
  await env.clearFirestore();
  for (const [uid, nick, role] of [[OWNER, "jordi", "user"], ["cap", "cap", "admin"]]) {
    await seed("users/" + uid, { nickname: nick, role });
    await seed("teamMembers/" + uid, { expiresAt: Timestamp.fromMillis(Date.now() + 3600000) });
  }
  for (const m of [fx.como.matchId, fx.j3.matchId, "mw"] as string[]) await seed("matches/" + m, { status: "scheduled", seasonId: "x", date: Timestamp.fromMillis(Date.now() + 86400000) });
  await seed("lineups/como", revive(fx.como) as object);
  await seed("lineups/j3", revive(fx.j3) as object);
});
afterAll(async () => {
  await env?.cleanup();
});

describe("presupuesto de las reglas con tableros de verdad (1000 expresiones por petición)", () => {
  it("«Como en J1» (the board TABLEROS could not save): its autosave with a new tag, and a minimal edit", async () => {
    await assertSucceeds(updateDoc(doc(ctx(OWNER), "lineups", "como"), autosave(fx.como, { tags: ["Liga", "Copa"] })));
    await assertSucceeds(updateDoc(doc(ctx(OWNER), "lineups", "como"), { matchId: fx.como.matchId, updatedAt: serverTimestamp() }));
  });
  it("«J3 · Red Demons» (the official, with everything): a captain's autosave, a tag, a minimal edit", async () => {
    const j3 = revive(fx.j3) as Record<string, unknown>;
    await assertSucceeds(updateDoc(doc(ctx("cap"), "lineups", "j3"), autosave(j3, { tags: ["Liga", "Copa"] })));
    await assertSucceeds(updateDoc(doc(ctx("cap"), "lineups", "j3"), { updatedAt: serverTimestamp() }));
    // …and still nobody else edits it, nor the server's fields
    await assertFails(updateDoc(doc(ctx(OWNER), "lineups", "j3"), { updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(ctx("cap"), "lineups", "j3"), { sevenRev: 9, updatedAt: serverTimestamp() }));
  });
  it("creating the seeded boards as new ones (duplicating them)", async () => {
    const copy = (b: Record<string, unknown>) => {
      const { fanToken: _f, sevenKey: _k, sevenRev: _r, ...rest } = revive(b) as Record<string, unknown>;
      return { ...rest, ownerUid: OWNER, ownerNickname: "jordi", isOfficial: false };
    };
    await assertSucceeds(setDoc(doc(ctx(OWNER), "lineups", "c1"), copy(fx.como)));
    await assertSucceeds(setDoc(doc(ctx(OWNER), "lineups", "c2"), copy(fx.j3)));
  });
  it("a board at every cap: created, rewritten with every field different, published by a captain", async () => {
    const w = worst("mw");
    await assertSucceeds(setDoc(doc(ctx(OWNER), "lineups", "w"), w));
    await assertSucceeds(updateDoc(doc(ctx(OWNER), "lineups", "w"), changed(w)));
    await assertSucceeds(setDoc(doc(ctx("cap"), "lineups", "w2"), { ...w, ownerUid: "cap", ownerNickname: "cap", isOfficial: true }));
    await assertSucceeds(updateDoc(doc(ctx("cap"), "lineups", "w2"), { ...changed(w), ownerUid: "cap", ownerNickname: "cap", isOfficial: false }));
  });
  it("…and one over a cap is still refused on create and on update", async () => {
    const w = worst("mw");
    await assertFails(setDoc(doc(ctx(OWNER), "lineups", "w"), { ...w, drawings: [...(w.drawings as object[]), {}] }));
    await assertSucceeds(setDoc(doc(ctx(OWNER), "lineups", "w"), w));
    await assertFails(updateDoc(doc(ctx(OWNER), "lineups", "w"), { ...changed(w), plays: [...(w.plays as object[]), {}] }));
    await assertFails(updateDoc(doc(ctx(OWNER), "lineups", "w"), { ...changed(w), tags: ["a", "b", "c", "d"] }));
    await assertFails(updateDoc(doc(ctx(OWNER), "lineups", "w"), { ...changed(w), plan: { claves: ["1", "2", "3", "4"] } }));
    await assertFails(updateDoc(doc(ctx(OWNER), "lineups", "w"), { ...changed(w), extra: 1 }));
    await assertFails(updateDoc(doc(ctx(OWNER), "lineups", "w"), { ...changed(w), isOfficial: true }));
  });
});
