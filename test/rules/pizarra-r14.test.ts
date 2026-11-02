// r14 · La pizarra: every new or changed rule, positive and negative (firestore.rules; the contract:
// piti-diseno/src/pizarra/r14/impl/API.txt). Its own project id, so it never clears the main suite's data.
import { readFileSync } from "node:fs";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, Timestamp, updateDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

let env: RulesTestEnvironment;
const db = (uid?: string) =>
  uid
    ? env.authenticatedContext(uid, { email: uid + "@test.dev", email_verified: true, firebase: { sign_in_provider: "google.com" } }).firestore()
    : env.unauthenticatedContext().firestore();
const seed = async (path: string, data: object) =>
  env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), path), data);
  });
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-manchester-piti-rules-r14",
    firestore: { host: "127.0.0.1", port: Number(process.env.FIRESTORE_EMULATOR_HOST?.split(":").pop()) || 8080, rules: readFileSync("firestore.rules", "utf8") },
  });
});
beforeEach(async () => {
  await env.clearFirestore();
  for (const [uid, role, playerId] of [
    ["member", "user", "p-member"],
    ["other", "user", "p-other"],
    ["socio", "user", null],
    ["admin", "admin", "p-admin"],
  ] as const) {
    await seed("users/" + uid, { email: uid + "@test.dev", nickname: uid, role, ...(playerId ? { playerId } : {}) });
    await seed("teamMembers/" + uid, { expiresAt: Timestamp.fromMillis(Date.now() + 3600000) });
  }
  await seed("users/outsider", { email: "outsider@test.dev", nickname: "outsider", role: "user" });
});
afterAll(async () => {
  await env?.cleanup();
});

const board = { ownerUid: "member", ownerNickname: "member", seasonId: "s1", name: "Mi siete", isOfficial: false };
const seven = ["a", "b", "c", "d", "e", "f", "g"];

describe("r14 · los campos nuevos del tablero", () => {
  const plan = { claves: ["Presión alta", "Que no gire su 7"], viz: [{ icon: "spark", zona: "arriba" }], notes: "Notas", parado: { corners: { playId: "lib-corner", box: ["a", "b"] }, freekicks: { playId: null, box: [] }, penalties: { rechace: ["c"] } } };
  it("plan, rival visible/danger, fromMesa and seasonPlays are accepted", async () => {
    await assertSucceeds(setDoc(doc(db("member"), "lineups", "x"), { ...board, plan, fromMesa: true, seasonPlays: ["sp1"], rival: { formation: "2-3-1", players: [{ num: 7 }], visible: false, danger: 0 } }));
    await assertSucceeds(updateDoc(doc(db("member"), "lineups", "x"), { plan: null, rival: { formation: "2-3-1", players: [], danger: null } }));
  });
  it("…within their caps and shapes", async () => {
    await seed("lineups/x", board);
    const up = (d: object) => updateDoc(doc(db("member"), "lineups", "x"), d);
    await assertFails(up({ plan: { ...plan, claves: ["1", "2", "3", "4"] } }));
    await assertFails(up({ plan: { ...plan, extra: 1 } }));
    await assertFails(up({ plan: { ...plan, notes: "x".repeat(401) } }));
    await assertFails(up({ plan: { ...plan, parado: { corners: { playId: null, box: [], otro: 1 } } } }));
    await assertFails(up({ plan: "texto" }));
    await assertFails(up({ rival: { formation: "2-3-1", players: [], danger: 7 } }));
    await assertFails(up({ rival: { formation: "2-3-1", players: [], visible: "si" } }));
    await assertFails(up({ fromMesa: "si" }));
    await assertFails(up({ seasonPlays: Array.from({ length: 25 }, (_, i) => "p" + i) }));
  });
  it("the server's fields (fanToken, sevenKey, sevenRev) are never set nor changed by a client — captains included", async () => {
    await assertFails(setDoc(doc(db("member"), "lineups", "y"), { ...board, fanToken: "T".repeat(24) }));
    await assertFails(setDoc(doc(db("member"), "lineups", "y"), { ...board, sevenRev: 1 }));
    await seed("lineups/x", { ...board, fanToken: "T".repeat(24), sevenKey: "a,b", sevenRev: 2 });
    await assertSucceeds(updateDoc(doc(db("member"), "lineups", "x"), { name: "Otro nombre" }));
    await assertFails(updateDoc(doc(db("member"), "lineups", "x"), { fanToken: "U".repeat(24) }));
    await assertFails(updateDoc(doc(db("admin"), "lineups", "x"), { sevenRev: 3 }));
    await assertFails(updateDoc(doc(db("admin"), "lineups", "x"), { sevenKey: "z" }));
    await assertFails(setDoc(doc(db("member"), "lineups", "x"), { ...board }));
  });
  it("today's client still writes as before (an old board, its usual fields)", async () => {
    await assertSucceeds(setDoc(doc(db("member"), "lineups", "x"), { ...board, formation: "2-3-1", freeMode: false, slots: seven.map((playerId) => ({ playerId })), tags: ["Liga"], rival: { formation: "2-3-1", players: [] }, condPlan: [{ id: "c1", when: "perdiendo", by: 1, from: 35, key: "mentality", value: "Ofensiva" }] }));
    await assertSucceeds(updateDoc(doc(db("member"), "lineups", "x"), { condPlan: [{ id: "c1", when: "perdiendo", by: 1, from: 35, key: "mentality", value: "Ofensiva", ver: "planb" }] }));
  });
});

describe("r14 · las copias de la mesa (PZ-D22T)", () => {
  it("a captain deletes another member's copy from la mesa; another member does not", async () => {
    await seed("matches/j3", { status: "finished", seasonId: "s1" });
    await seed("lineups/m", { ...board, ownerUid: "other", ownerNickname: "other", matchId: "j3", fromMesa: true, name: "Siete del campo · J3" });
    await assertFails(deleteDoc(doc(db("member"), "lineups", "m")));
    await assertSucceeds(deleteDoc(doc(db("admin"), "lineups", "m")));
  });
});

describe("r14 · reacciones por versión del siete (PZ-D01)", () => {
  const r = (uid: string, over: object = {}) => setDoc(doc(db(uid), "lineups", "x", "reactions", uid), { value: "ok", at: serverTimestamp(), ...over });
  it("a reaction carries the current version; an old version is refused; no version (old client) still goes", async () => {
    await seed("lineups/x", { ...board, isOfficial: true, sevenRev: 2 });
    await assertSucceeds(r("member", { rev: 2 }));
    await assertFails(r("other", { rev: 1 }));
    await assertFails(r("other", { rev: "2" }));
    await assertSucceeds(r("other"));
    await assertFails(r("admin", { rev: 2, extra: 1 }));
  });
  it("a board never stamped is version 0", async () => {
    await seed("lineups/x", { ...board, isOfficial: true });
    await assertSucceeds(r("member", { rev: 0 }));
    await assertFails(r("other", { rev: 1 }));
  });
});

describe("r14 · la voz por contenido (PZ-D22F)", () => {
  const clip = (step: string) => ({ step, mime: "audio/webm", ms: 1000, data: "AQID", by: "member", at: serverTimestamp() });
  it("keys by content are accepted, the old ones too, nonsense is not", async () => {
    await seed("lineups/x", board);
    const v = (slot: string, step: string) => setDoc(doc(db("member"), "lineups", "x", "voz", slot), clip(step));
    for (const [slot, step] of [["v0", "siete:erik"], ["v1", "siete:hueco-MC"], ["v2", "jugada:lib-corner"], ["v3", "jugada:j1:2"], ["v4", "rival"], ["v5", "siete-3"]]) await assertSucceeds(v(slot, step));
    for (const step of ["siete:", "siete:a/b", "jugada:x:123", "otro", "vamos!"]) await assertFails(v("v0", step));
    for (const step of ["suplentes", "galones", "vamos", "quedada"]) await assertSucceeds(v("v1", step));
  });
});

describe("r14 · la historia del tablero (PZ-D21T)", () => {
  it("the team reads it; nobody writes it from a client", async () => {
    await seed("lineups/x", board);
    await seed("lineups/x/history/h1", { kind: "nuevo", at: 1 });
    await assertSucceeds(getDocs(collection(db("other"), "lineups", "x", "history")));
    await assertFails(getDoc(doc(db("outsider"), "lineups", "x", "history", "h1")));
    await assertFails(setDoc(doc(db("member"), "lineups", "x", "history", "h2"), { kind: "nuevo", at: 2 }));
    await assertFails(setDoc(doc(db("admin"), "lineups", "x", "history", "h2"), { kind: "nuevo", at: 2 }));
    await assertFails(deleteDoc(doc(db("admin"), "lineups", "x", "history", "h1")));
  });
});

describe("r14 · Adivina el siete (PZ-D04)", () => {
  const g = (uid: string, slots: unknown = seven) => setDoc(doc(db(uid), "matchPrivate", "j3", "guesses", uid), { slots, at: serverTimestamp() });
  beforeEach(async () => {
    await seed("matches/j3", { status: "scheduled", seasonId: "s1", date: Timestamp.fromMillis(Date.now() + 86400000) });
  });
  it("a player keeps his own guess before the official; only he reads it", async () => {
    await assertSucceeds(g("member"));
    await assertSucceeds(g("member", [...seven].reverse()));
    await assertSucceeds(getDoc(doc(db("member"), "matchPrivate", "j3", "guesses", "member")));
    await assertFails(getDoc(doc(db("other"), "matchPrivate", "j3", "guesses", "member")));
    await assertFails(getDocs(collection(db("other"), "matchPrivate", "j3", "guesses")));
    await assertFails(setDoc(doc(db("other"), "matchPrivate", "j3", "guesses", "member"), { slots: seven, at: serverTimestamp() }));
    await assertSucceeds(deleteDoc(doc(db("member"), "matchPrivate", "j3", "guesses", "member")));
  });
  it("seven ids, signed now; a member without a ficha, an outsider or a played match: no", async () => {
    await assertFails(g("member", seven.slice(0, 6)));
    await assertFails(g("member", [...seven.slice(0, 6), 3]));
    await assertFails(setDoc(doc(db("member"), "matchPrivate", "j3", "guesses", "member"), { slots: seven, at: Timestamp.fromMillis(0) }));
    await assertFails(setDoc(doc(db("member"), "matchPrivate", "j3", "guesses", "member"), { slots: seven, at: serverTimestamp(), extra: 1 }));
    await assertFails(g("socio"));
    await assertFails(g("outsider"));
    await seed("matches/j3", { status: "finished", seasonId: "s1", date: Timestamp.fromMillis(Date.now() - 86400000) });
    await assertFails(g("member"));
  });
  it("once the official is out: frozen, and the team reads them all", async () => {
    await assertSucceeds(g("member"));
    await seed("lineupOfficials/s1__j3", { lineupId: "x", seasonId: "s1", matchId: "j3", at: Timestamp.now() });
    await assertFails(g("member", [...seven].reverse()));
    await assertFails(deleteDoc(doc(db("member"), "matchPrivate", "j3", "guesses", "member")));
    await assertSucceeds(getDocs(collection(db("other"), "matchPrivate", "j3", "guesses")));
    await assertFails(getDocs(collection(db("outsider"), "matchPrivate", "j3", "guesses")));
  });
});

describe("r14 · la quedada (PZ-D03)", () => {
  const q = (uid: string, over: object = {}) => setDoc(doc(db(uid), "quedadas", "j3"), { at: Timestamp.fromMillis(Date.now() + 3600000), where: "Puerta del campo", by: uid, setAt: serverTimestamp(), ...over });
  beforeEach(async () => {
    await seed("matches/j3", { status: "scheduled", seasonId: "s1" });
  });
  it("captains write it, the team reads it, the public doesn't", async () => {
    await assertSucceeds(q("admin", { note: "Con la equipación puesta" }));
    await assertSucceeds(getDoc(doc(db("member"), "quedadas", "j3")));
    await assertFails(getDoc(doc(db(), "quedadas", "j3")));
    await assertFails(q("member"));
    await assertFails(deleteDoc(doc(db("member"), "quedadas", "j3")));
    await assertSucceeds(deleteDoc(doc(db("admin"), "quedadas", "j3")));
  });
  it("its shape: a time, a place (1–80), by himself, now; an archived match: no", async () => {
    await assertFails(q("admin", { where: "" }));
    await assertFails(q("admin", { where: "x".repeat(81) }));
    await assertFails(q("admin", { at: "17:30" }));
    await assertFails(q("admin", { by: "member" }));
    await assertFails(q("admin", { setAt: Timestamp.fromMillis(0) }));
    await assertFails(q("admin", { extra: 1 }));
    await assertFails(q("admin", { note: "x".repeat(141) }));
    await seed("matches/j3", { status: "scheduled", seasonId: "s1", archived: true });
    await assertFails(q("admin"));
  });
});

describe("r14 · la pachanga del entreno (PZ-D09)", () => {
  const a = (uid: string, over: object = {}) => setDoc(doc(db(uid), "trainingAttendance", "t1"), { slotId: "s2", present: ["a", "b"], guests: ["Rafa"], by: uid, at: serverTimestamp(), ...over });
  it("the proposer or a captain saves who came to a confirmed training; others read it", async () => {
    await seed("trainings/t1", { proposedBy: "other", slots: [{ id: "s1" }, { id: "s2" }], confirmed: { slotId: "s2" } });
    await assertSucceeds(a("other"));
    await assertSucceeds(a("admin"));
    await assertFails(a("member"));
    await assertSucceeds(getDoc(doc(db("member"), "trainingAttendance", "t1")));
    await assertFails(getDoc(doc(db("outsider"), "trainingAttendance", "t1")));
    await assertFails(deleteDoc(doc(db("member"), "trainingAttendance", "t1")));
    await assertSucceeds(deleteDoc(doc(db("other"), "trainingAttendance", "t1")));
  });
  it("only for the confirmed slot, with its caps; not before the training is confirmed", async () => {
    await seed("trainings/t1", { proposedBy: "other", slots: [{ id: "s1" }, { id: "s2" }], confirmed: { slotId: "s2" } });
    await assertFails(a("admin", { slotId: "s1" }));
    await assertFails(a("admin", { present: Array.from({ length: 41 }, (_, i) => "p" + i) }));
    await assertFails(a("admin", { guests: Array.from({ length: 13 }, (_, i) => "g" + i) }));
    await assertFails(a("admin", { by: "other" }));
    await assertFails(a("admin", { extra: 1 }));
    await seed("trainings/t2", { proposedBy: "admin", slots: [{ id: "s1" }] });
    await assertFails(setDoc(doc(db("admin"), "trainingAttendance", "t2"), { slotId: "s1", present: [], by: "admin", at: serverTimestamp() }));
  });
});

describe("r14 · jugadas de la temporada (PZ-D05)", () => {
  const play = { id: "j", name: "Córner", kind: "corner", frames: [] };
  const sp = (uid: string, over: object = {}) => ({ seasonId: "s1", ownerUid: uid, ownerNickname: uid, scope: "mine", play, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...over });
  it("a member keeps his own; the team's library is the captains'", async () => {
    await assertSucceeds(setDoc(doc(db("member"), "seasonPlays", "a"), sp("member")));
    await assertFails(setDoc(doc(db("member"), "seasonPlays", "b"), sp("member", { scope: "team" })));
    await assertSucceeds(setDoc(doc(db("admin"), "seasonPlays", "c"), sp("admin", { scope: "team" })));
    await assertFails(setDoc(doc(db("member"), "seasonPlays", "d"), sp("other")));
    await assertFails(setDoc(doc(db("member"), "seasonPlays", "d"), sp("member", { ownerNickname: "otro" })));
    await assertFails(setDoc(doc(db("member"), "seasonPlays", "d"), sp("member", { play: { ...play, frames: Array.from({ length: 9 }, () => ({})) } })));
    await assertSucceeds(getDocs(collection(db("other"), "seasonPlays")));
    await assertFails(getDocs(collection(db("outsider"), "seasonPlays")));
  });
  it("its owner (or a captain) edits and deletes it; owner, season and creation never change", async () => {
    await seed("seasonPlays/a", { ...sp("member"), createdAt: Timestamp.fromMillis(1), updatedAt: Timestamp.fromMillis(1) });
    const up = (uid: string, over: object) => updateDoc(doc(db(uid), "seasonPlays", "a"), { updatedAt: serverTimestamp(), ...over });
    await assertSucceeds(up("member", { play: { ...play, name: "Córner 2" } }));
    await assertFails(up("other", { play }));
    await assertFails(up("member", { ownerUid: "other" }));
    await assertFails(up("member", { seasonId: "s2" }));
    await assertFails(up("member", { scope: "team" }));
    await assertSucceeds(up("admin", { scope: "team" }));
    await assertFails(deleteDoc(doc(db("other"), "seasonPlays", "a")));
    await assertSucceeds(deleteDoc(doc(db("member"), "seasonPlays", "a")));
  });
});

describe("r14 · los ajustes te siguen (PZ-D21E)", () => {
  it("only the member reads and writes his own, a small map", async () => {
    const p = doc(db("member"), "users", "member", "private", "pizarra");
    await assertSucceeds(setDoc(p, { prefs: { sonido: true, camara: "grada" }, at: serverTimestamp() }));
    await assertSucceeds(getDoc(p));
    await assertFails(getDoc(doc(db("other"), "users", "member", "private", "pizarra")));
    await assertFails(setDoc(doc(db("other"), "users", "member", "private", "pizarra"), { prefs: {}, at: serverTimestamp() }));
    await assertFails(setDoc(p, { prefs: "x", at: serverTimestamp() }));
    await assertFails(setDoc(p, { prefs: Object.fromEntries(Array.from({ length: 25 }, (_, i) => ["k" + i, true])), at: serverTimestamp() }));
    await assertFails(setDoc(p, { prefs: {}, at: Timestamp.fromMillis(0) }));
    await assertFails(setDoc(p, { prefs: {}, at: serverTimestamp(), extra: 1 }));
    await assertSucceeds(deleteDoc(p));
  });
});

describe("r14 · la vista de la afición (PZ-D21F), a prueba de carreras", () => {
  const token = "T".repeat(24);
  it("anyone with the link reads it while its board names the token; nobody lists or writes", async () => {
    await seed("lineups/x", { ...board, fanToken: token });
    await seed(`fanBoards/${token}`, { v: 1, boardId: "x", seven: [], system: "2-3-1", title: "J3" });
    await assertSucceeds(getDoc(doc(db(), "fanBoards", token)));
    await assertSucceeds(getDoc(doc(db("outsider"), "fanBoards", token)));
    await assertFails(getDocs(collection(db(), "fanBoards")));
    await assertFails(getDocs(collection(db("admin"), "fanBoards")));
    await assertFails(setDoc(doc(db("admin"), "fanBoards", "U".repeat(24)), { v: 1, boardId: "x" }));
    await assertFails(updateDoc(doc(db("admin"), "fanBoards", token), { title: "x" }));
    await assertFails(deleteDoc(doc(db("admin"), "fanBoards", token)));
    // the board itself stays members-only
    await assertFails(getDoc(doc(db(), "lineups", "x")));
  });
  it("(revisión) the fan doc never lists, even by token prefix", async () => {
    await assertFails(getDocs(collection(db("member"), "fanBoards")));
  });
  it("a revoked link (a stale doc left behind) reads nothing", async () => {
    await seed("lineups/x", { ...board });
    await seed(`fanBoards/${token}`, { v: 1, boardId: "x", seven: [], system: "2-3-1", title: "J3" });
    await assertFails(getDoc(doc(db(), "fanBoards", token)));
  });
  it("a rotated token: the old one reads nothing, the new one does", async () => {
    const next = "N".repeat(24);
    await seed("lineups/x", { ...board, fanToken: next });
    await seed(`fanBoards/${token}`, { v: 1, boardId: "x", seven: [], system: "2-3-1", title: "J3" });
    await seed(`fanBoards/${next}`, { v: 1, boardId: "x", seven: [], system: "2-3-1", title: "J3" });
    await assertFails(getDoc(doc(db(), "fanBoards", token)));
    await assertSucceeds(getDoc(doc(db(), "fanBoards", next)));
  });
  it("its board deleted: the old token reads nothing; a missing token is just missing", async () => {
    await seed(`fanBoards/${token}`, { v: 1, boardId: "gone", seven: [], system: "2-3-1", title: "J3" });
    await assertFails(getDoc(doc(db(), "fanBoards", token)));
    await seed(`fanBoards/${"B".repeat(24)}`, { v: 1, seven: [], system: "2-3-1", title: "sin tablero" });
    await assertFails(getDoc(doc(db(), "fanBoards", "B".repeat(24))));
    await assertSucceeds(getDoc(doc(db(), "fanBoards", "Z".repeat(24))));
  });
});
