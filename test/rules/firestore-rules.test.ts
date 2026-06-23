/**
 * Firestore security-rules tests (Phase 11) — run against the Firestore
 * EMULATOR via @firebase/rules-unit-testing, NOT the jsdom unit suite.
 *
 * These need the firestore emulator listening on 127.0.0.1:8080 (see the
 * `emulators` block in firebase.json). Run them with the dedicated script:
 *
 *   pnpm test:rules
 *
 * which wraps `firebase emulators:exec --only firestore "<vitest run>"` so the
 * emulator is booted, the tests run against it, and it is torn down. They are
 * intentionally excluded from `pnpm test` (the jsdom config only globs
 * `src/**`), so the existing component/unit suite is untouched.
 *
 * What is asserted mirrors firestore.rules one-to-one:
 *  - players/matches/seasons: public READ; only admin/superadmin WRITE.
 *  - users: signed-in read; self-create capped at role 'user' (no self-elevation);
 *    self-update may not change own role; admin may manage roles; no client delete.
 *  - lineups: signed-in read; owner CRUDs own board; non-owner cannot; only an
 *    admin may publish (isOfficial=true) or touch someone else's board.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const PROJECT_ID = "futbolmanagement-dc6cb";
const SUPERADMIN_EMAIL = "adriantomascv@gmail.com";
const RULES_PATH = fileURLToPath(new URL("../../firestore.rules", import.meta.url));

let testEnv: RulesTestEnvironment;

/** Seed a users/{uid} doc with `role` while rules are disabled (admin lookup). */
async function seedUser(uid: string, role: "user" | "admin" | "superadmin") {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "users", uid), {
      email: `${uid}@test.dev`,
      nickname: uid,
      role,
    });
  });
}

/** Seed an arbitrary doc with rules disabled (e.g. an existing lineup/match). */
async function seedDoc(path: string, data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), path), data);
  });
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(RULES_PATH, "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe("public content collections (players / matches / seasons)", () => {
  for (const coll of ["players", "matches", "seasons"] as const) {
    describe(coll, () => {
      it("anyone (anonymous) can read", async () => {
        await seedDoc(`${coll}/x`, { name: "x" });
        const anon = testEnv.unauthenticatedContext();
        await assertSucceeds(getDoc(doc(anon.firestore(), coll, "x")));
      });

      it("anonymous cannot write", async () => {
        const anon = testEnv.unauthenticatedContext();
        await assertFails(addDoc(collection(anon.firestore(), coll), { name: "n" }));
      });

      it("signed-in non-admin user cannot write", async () => {
        await seedUser("u1", "user");
        const u = testEnv.authenticatedContext("u1");
        await assertFails(addDoc(collection(u.firestore(), coll), { name: "n" }));
      });

      it("admin can create, update and delete", async () => {
        await seedUser("admin1", "admin");
        const a = testEnv.authenticatedContext("admin1");
        await assertSucceeds(setDoc(doc(a.firestore(), coll, "doc1"), { name: "n" }));
        await assertSucceeds(updateDoc(doc(a.firestore(), coll, "doc1"), { name: "n2" }));
        await assertSucceeds(deleteDoc(doc(a.firestore(), coll, "doc1")));
      });

      it("superadmin can write too", async () => {
        await seedUser("super1", "superadmin");
        const s = testEnv.authenticatedContext("super1");
        await assertSucceeds(setDoc(doc(s.firestore(), coll, "doc2"), { name: "n" }));
      });
    });
  }
});

describe("players — Pizarra naturalPosition update path", () => {
  it("admin can update a player's naturalPosition", async () => {
    await seedDoc("players/p1", { name: "Piti", naturalPosition: "DC" });
    await seedUser("admin1", "admin");
    const a = testEnv.authenticatedContext("admin1");
    await assertSucceeds(updateDoc(doc(a.firestore(), "players", "p1"), { naturalPosition: "MC" }));
  });

  it("non-admin cannot update a player's naturalPosition", async () => {
    await seedDoc("players/p1", { name: "Piti", naturalPosition: "DC" });
    await seedUser("u1", "user");
    const u = testEnv.authenticatedContext("u1");
    await assertFails(updateDoc(doc(u.firestore(), "players", "p1"), { naturalPosition: "MC" }));
  });
});

describe("users", () => {
  it("anonymous cannot read the users collection", async () => {
    await seedUser("u1", "user");
    const anon = testEnv.unauthenticatedContext();
    await assertFails(getDoc(doc(anon.firestore(), "users", "u1")));
  });

  it("signed-in user can read users (nickname-uniqueness + admin list)", async () => {
    await seedUser("u1", "user");
    const u = testEnv.authenticatedContext("u1");
    await assertSucceeds(getDocs(query(collection(u.firestore(), "users"), where("nickname", "==", "u1"))));
  });

  it("self-create with role 'user' succeeds", async () => {
    const u = testEnv.authenticatedContext("u1");
    await assertSucceeds(
      setDoc(doc(u.firestore(), "users", "u1"), { email: "u1@test.dev", nickname: "u1", role: "user" }),
    );
  });

  it("self-create with role 'admin' is rejected (no self-elevation)", async () => {
    const u = testEnv.authenticatedContext("u1");
    await assertFails(
      setDoc(doc(u.firestore(), "users", "u1"), { email: "u1@test.dev", nickname: "u1", role: "admin" }),
    );
  });

  it("cannot create a profile for a different uid", async () => {
    const u = testEnv.authenticatedContext("u1");
    await assertFails(
      setDoc(doc(u.firestore(), "users", "someone-else"), { email: "x@test.dev", nickname: "x", role: "user" }),
    );
  });

  it("superadmin email may self-create as 'superadmin'", async () => {
    const s = testEnv.authenticatedContext("superuid", { email: SUPERADMIN_EMAIL });
    await assertSucceeds(
      setDoc(doc(s.firestore(), "users", "superuid"), {
        email: SUPERADMIN_EMAIL,
        nickname: "boss",
        role: "superadmin",
      }),
    );
  });

  it("user may self-update WITHOUT changing role", async () => {
    await seedUser("u1", "user");
    const u = testEnv.authenticatedContext("u1");
    await assertSucceeds(setDoc(doc(u.firestore(), "users", "u1"), { role: "user", nickname: "u1-renamed" }, { merge: true }));
  });

  it("user CANNOT elevate own role on update", async () => {
    await seedUser("u1", "user");
    const u = testEnv.authenticatedContext("u1");
    await assertFails(setDoc(doc(u.firestore(), "users", "u1"), { role: "admin" }, { merge: true }));
  });

  it("admin can change another user's role", async () => {
    await seedUser("admin1", "admin");
    await seedUser("u1", "user");
    const a = testEnv.authenticatedContext("admin1");
    await assertSucceeds(setDoc(doc(a.firestore(), "users", "u1"), { role: "admin" }, { merge: true }));
  });

  it("a plain user cannot change another user's doc", async () => {
    await seedUser("u1", "user");
    await seedUser("u2", "user");
    const u = testEnv.authenticatedContext("u1");
    await assertFails(setDoc(doc(u.firestore(), "users", "u2"), { role: "admin" }, { merge: true }));
  });

  it("no client may delete a user doc (even admin)", async () => {
    await seedUser("admin1", "admin");
    await seedUser("u1", "user");
    const a = testEnv.authenticatedContext("admin1");
    await assertFails(deleteDoc(doc(a.firestore(), "users", "u1")));
  });
});

describe("lineups", () => {
  const board = (ownerUid: string, isOfficial: boolean) => ({
    ownerUid,
    ownerNickname: ownerUid,
    seasonId: "all",
    name: "board",
    isOfficial,
    matchId: null,
  });

  it("anonymous cannot read lineups", async () => {
    await seedDoc("lineups/l1", board("u1", false));
    const anon = testEnv.unauthenticatedContext();
    await assertFails(getDoc(doc(anon.firestore(), "lineups", "l1")));
  });

  it("any signed-in user can read lineups", async () => {
    await seedDoc("lineups/l1", board("u1", false));
    const u2 = testEnv.authenticatedContext("u2");
    await assertSucceeds(getDoc(doc(u2.firestore(), "lineups", "l1")));
  });

  it("owner can create their own non-official board", async () => {
    const u = testEnv.authenticatedContext("u1");
    await assertSucceeds(addDoc(collection(u.firestore(), "lineups"), board("u1", false)));
  });

  it("cannot create a board owned by someone else", async () => {
    const u = testEnv.authenticatedContext("u1");
    await assertFails(addDoc(collection(u.firestore(), "lineups"), board("u2", false)));
  });

  it("non-admin cannot create a board already flagged official", async () => {
    await seedUser("u1", "user");
    const u = testEnv.authenticatedContext("u1");
    await assertFails(addDoc(collection(u.firestore(), "lineups"), board("u1", true)));
  });

  it("admin can create an official board", async () => {
    await seedUser("admin1", "admin");
    const a = testEnv.authenticatedContext("admin1");
    await assertSucceeds(addDoc(collection(a.firestore(), "lineups"), board("admin1", true)));
  });

  it("owner can update (rename/save) their own board", async () => {
    await seedDoc("lineups/l1", board("u1", false));
    const u = testEnv.authenticatedContext("u1");
    await assertSucceeds(updateDoc(doc(u.firestore(), "lineups", "l1"), { name: "renamed" }));
  });

  it("non-owner non-admin cannot update someone else's board", async () => {
    await seedUser("u2", "user");
    await seedDoc("lineups/l1", board("u1", false));
    const u2 = testEnv.authenticatedContext("u2");
    await assertFails(updateDoc(doc(u2.firestore(), "lineups", "l1"), { name: "hijack" }));
  });

  it("owner (non-admin) CANNOT flip isOfficial to true on their board", async () => {
    await seedUser("u1", "user");
    await seedDoc("lineups/l1", board("u1", false));
    const u = testEnv.authenticatedContext("u1");
    await assertFails(updateDoc(doc(u.firestore(), "lineups", "l1"), { isOfficial: true }));
  });

  it("admin CAN publish (set isOfficial=true) on any board", async () => {
    await seedUser("admin1", "admin");
    await seedDoc("lineups/l1", board("u1", false));
    const a = testEnv.authenticatedContext("admin1");
    await assertSucceeds(updateDoc(doc(a.firestore(), "lineups", "l1"), { isOfficial: true }));
  });

  it("owner can delete their own board", async () => {
    await seedDoc("lineups/l1", board("u1", false));
    const u = testEnv.authenticatedContext("u1");
    await assertSucceeds(deleteDoc(doc(u.firestore(), "lineups", "l1")));
  });

  it("non-owner non-admin cannot delete someone else's board", async () => {
    await seedUser("u2", "user");
    await seedDoc("lineups/l1", board("u1", false));
    const u2 = testEnv.authenticatedContext("u2");
    await assertFails(deleteDoc(doc(u2.firestore(), "lineups", "l1")));
  });

  it("admin can delete any board", async () => {
    await seedUser("admin1", "admin");
    await seedDoc("lineups/l1", board("u1", false));
    const a = testEnv.authenticatedContext("admin1");
    await assertSucceeds(deleteDoc(doc(a.firestore(), "lineups", "l1")));
  });
});
