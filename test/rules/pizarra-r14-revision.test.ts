// r14 · La pizarra, the review's fixes (firestore.rules): content caps per item (plan, attendance, prefs, slot ids),
// «Adivina el siete» frozen by the server's flag (unpublishing never reopens it), match dates stored as millis, a
// guest's walkout voice. Its own project id, so it never clears another suite's data.
import { readFileSync } from "node:fs";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc, Timestamp, updateDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

let env: RulesTestEnvironment;
const db = (uid: string) => env.authenticatedContext(uid, { email: uid + "@test.dev", email_verified: true, firebase: { sign_in_provider: "google.com" } }).firestore();
const seed = async (path: string, data: object) =>
  env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), path), data);
  });
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-manchester-piti-rules-r14b",
    firestore: { host: "127.0.0.1", port: Number(process.env.FIRESTORE_EMULATOR_HOST?.split(":").pop()) || 8080, rules: readFileSync("firestore.rules", "utf8") },
  });
});
beforeEach(async () => {
  await env.clearFirestore();
  for (const [uid, role, playerId] of [
    ["member", "user", "p-member"],
    ["other", "user", "p-other"],
    ["admin", "admin", "p-admin"],
  ] as const) {
    await seed("users/" + uid, { email: uid + "@test.dev", nickname: uid, role, playerId });
    await seed("teamMembers/" + uid, { expiresAt: Timestamp.fromMillis(Date.now() + 3600000) });
  }
});
afterAll(async () => {
  await env?.cleanup();
});

const board = { ownerUid: "member", ownerNickname: "member", seasonId: "s1", name: "Mi siete", isOfficial: false };
const seven = ["a", "b", "c", "d", "e", "f", "g"];

describe("r14 · revisión: topes por elemento", () => {
  const plan = { claves: ["Presión alta"], viz: [{ icon: "spark", zona: "arriba" }], notes: "", parado: { corners: { playId: "lib-corner", box: ["a", "guest:g1"] }, freekicks: { playId: null, box: [] }, penalties: { rechace: ["c"] } } };
  it("plan: each key a 1–60 text, each light {icon, zona}, box/rechace ≤ 5 player ids", async () => {
    await seed("lineups/x", board);
    const up = (p: object) => updateDoc(doc(db("member"), "lineups", "x"), { plan: { ...plan, ...p } });
    await assertSucceeds(up({}));
    await assertFails(up({ claves: [3] }));
    await assertFails(up({ claves: [""] }));
    await assertFails(up({ claves: ["x".repeat(61)] }));
    await assertFails(up({ viz: [{ icon: "spark", zona: "arriba", extra: 1 }] }));
    await assertFails(up({ viz: [{ icon: 1, zona: "arriba" }] }));
    await assertFails(up({ viz: ["spark"] }));
    await assertFails(up({ parado: { ...plan.parado, corners: { playId: null, box: [7] } } }));
    await assertFails(up({ parado: { ...plan.parado, corners: { playId: null, box: ["a b"] } } }));
    await assertFails(up({ parado: { ...plan.parado, corners: { playId: null, box: ["a", "b", "c", "d", "e", "f"] } } }));
    await assertFails(up({ parado: { ...plan.parado, penalties: { rechace: ["x".repeat(129)] } } }));
    await assertFails(up({ parado: { ...plan.parado, penalties: { rechace: [], otro: 1 } } }));
  });
  it("slots: a player id longer than 128 is refused (the server's sevenKey always fits its cap)", async () => {
    const slots = (id: unknown) => [id, "b", "c", "d", "e", "f", "g"].map((playerId) => ({ playerId }));
    await assertSucceeds(setDoc(doc(db("member"), "lineups", "x"), { ...board, slots: slots("x".repeat(128)) }));
    await assertFails(setDoc(doc(db("member"), "lineups", "y"), { ...board, slots: slots("x".repeat(129)) }));
    await assertFails(setDoc(doc(db("member"), "lineups", "y"), { ...board, slots: slots(5) }));
    await assertSucceeds(setDoc(doc(db("member"), "lineups", "z"), { ...board, slots: slots(null) }));
  });
  it("attendance: ids and names checked one by one", async () => {
    await seed("trainings/t1", { proposedBy: "admin", slots: [{ id: "s1" }], confirmed: { slotId: "s1" } });
    const a = (over: object) => setDoc(doc(db("admin"), "trainingAttendance", "t1"), { slotId: "s1", present: ["a"], guests: [], by: "admin", at: serverTimestamp(), ...over });
    await assertSucceeds(a({ present: ["a", "guest:g1"], guests: ["Rafa Gómez", "Marta"] }));
    await assertSucceeds(a({ present: [] }));
    await assertFails(a({ present: [3] }));
    await assertFails(a({ present: ["a,b"] }));
    await assertFails(a({ guests: ["x".repeat(41)] }));
    await assertFails(a({ guests: ["a|b"] }));
    await assertFails(a({ guests: [""] }));
    await assertFails(a({ guests: [5] }));
  });
  it("prefs: only the known settings, each with its type", async () => {
    const p = (prefs: object) => setDoc(doc(db("member"), "users", "member", "private", "pizarra"), { prefs, at: serverTimestamp() });
    await assertSucceeds(p({ sonido: true, camara: "foco", capa: "quimica", nombre: false, galones: true, mov: "menos", vozMute: true }));
    await assertSucceeds(p({}));
    await assertFails(p({ otra: 1 }));
    await assertFails(p({ sonido: "si" }));
    await assertFails(p({ camara: "dron" }));
    await assertFails(p({ capa: "Química!" }));
    await assertFails(p({ mov: 1 }));
  });
  it("a guest's walkout voice (siete:guest:g1)", async () => {
    await seed("lineups/x", board);
    const clip = (step: string) => ({ step, mime: "audio/webm", ms: 1000, data: "AQID", by: "member", at: serverTimestamp() });
    await assertSucceeds(setDoc(doc(db("member"), "lineups", "x", "voz", "v0"), clip("siete:guest:g1")));
    await assertFails(setDoc(doc(db("member"), "lineups", "x", "voz", "v1"), clip("siete:guest:")));
  });
});

describe("r14 · revisión: Adivina el siete", () => {
  const g = (m: string) => setDoc(doc(db("member"), "matchPrivate", m, "guesses", "member"), { slots: seven, at: serverTimestamp() });
  it("a match date stored in millis works like a Timestamp", async () => {
    await seed("matches/j4", { status: "scheduled", seasonId: "s1", date: Date.now() + 86400000 });
    await assertSucceeds(g("j4"));
    await seed("matches/j5", { status: "scheduled", seasonId: "s1", date: Date.now() - 1000 });
    await assertFails(g("j5"));
  });
  it("unpublishing never reopens them: the server's flag keeps them closed (and readable by the team)", async () => {
    await seed("matches/j4", { status: "scheduled", seasonId: "s1", date: Timestamp.fromMillis(Date.now() + 86400000) });
    await assertSucceeds(g("j4"));
    // published once (the flag), then unpublished (no scope doc)
    await seed("matchPrivate/j4", { sieteOutAt: Timestamp.now() });
    await assertFails(g("j4"));
    await assertFails(deleteDoc(doc(db("member"), "matchPrivate", "j4", "guesses", "member")));
    await assertSucceeds(getDocs(collection(db("other"), "matchPrivate", "j4", "guesses")));
  });
  it("a matchPrivate doc without the flag (la mesa's scorers) doesn't close them", async () => {
    await seed("matches/j6", { status: "scheduled", seasonId: "s1", date: Timestamp.fromMillis(Date.now() + 86400000) });
    await seed("matchPrivate/j6", { scorerUids: ["admin"] });
    await assertSucceeds(g("j6"));
    await assertFails(getDocs(collection(db("other"), "matchPrivate", "j6", "guesses")));
  });
});
