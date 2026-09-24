import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  getDocs,
  collection,
  setDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
} from "firebase/firestore";
import { beforeAll, beforeEach, afterAll, describe, it } from "vitest";
let env: RulesTestEnvironment;
const db = (uid?: string) =>
  uid
    ? env
        .authenticatedContext(uid, {
          email: uid + "@test.dev",
          email_verified: true,
          firebase: { sign_in_provider: "google.com" },
        })
        .firestore()
    : env.unauthenticatedContext().firestore();
const seed = async (path: string, data: object) =>
  env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), path), data);
  });
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-manchester-piti-rules",
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });
});
beforeEach(async () => {
  await env.clearFirestore();
  for (const [uid, role] of [
    ["member", "user"],
    ["other", "user"],
    ["admin", "admin"],
    ["super", "superadmin"],
  ]) {
    await seed("users/" + uid, {
      email: uid + "@test.dev",
      nickname: uid,
      role,
    });
    await seed("teamMembers/" + uid, {
      expiresAt: Timestamp.fromMillis(Date.now() + 3600000),
    });
  }
  await seed("users/outsider", {
    email: "outsider@test.dev",
    nickname: "outsider",
    role: "user",
  });
});
afterAll(async () => {
  await env?.cleanup();
});
describe("Publicación y cálculo del backend", () => {
  for (const coll of [
    "players",
    "seasons",
    "matches",
    "clubContent",
    "mvpResults",
    "playerSeasonStats",
  ]) {
    it(coll + " se puede leer sin registro", async () => {
      await seed(coll + "/item", { value: 1 });
      await assertSucceeds(getDoc(doc(db(), coll, "item")));
    });
  }
  for (const coll of [
    "matches",
    "mvpResults",
    "playerSeasonStats",
    "matchDrafts",
    "matchAudit",
    "accessAttempts",
    "teamMembers",
  ]) {
    it(
      "nadie puede escribir " +
        coll +
        " desde el navegador, ni un administrador",
      async () => {
        await assertFails(setDoc(doc(db("admin"), coll, "item"), { value: 1 }));
        await assertFails(
          setDoc(doc(db("member"), coll, "item"), { value: 1 }),
        );
      },
    );
  }
  for (const coll of ["players", "seasons"]) {
    it("solo admin con acceso de equipo puede gestionar " + coll, async () => {
      await assertSucceeds(
        setDoc(doc(db("admin"), coll, "item"), { name: "Prueba" }),
      );
      await assertFails(
        updateDoc(doc(db("member"), coll, "item"), { name: "Cambio" }),
      );
      await assertFails(deleteDoc(doc(db(), coll, "item")));
      await assertSucceeds(deleteDoc(doc(db("admin"), coll, "item")));
    });
  }
  it("una sesión Google sin la clave no puede administrar aunque tenga rol", async () => {
    await seed("users/outsider", { role: "admin" });
    await assertFails(
      setDoc(doc(db("outsider"), "seasons", "x"), { name: "No" }),
    );
  });
  it("el acceso expirado no sirve", async () => {
    await seed("teamMembers/admin", {
      expiresAt: Timestamp.fromMillis(Date.now() - 1000),
    });
    await assertFails(setDoc(doc(db("admin"), "players", "x"), { name: "No" }));
  });
  it("los borradores no son públicos ni visibles para jugadores", async () => {
    await seed("matchDrafts/x", { rival: "Prueba" });
    await assertFails(getDoc(doc(db(), "matchDrafts", "x")));
    await assertFails(getDoc(doc(db("member"), "matchDrafts", "x")));
    await assertSucceeds(getDoc(doc(db("admin"), "matchDrafts", "x")));
  });
});
describe("Vestuario e identidad", () => {
  it("solo se puede consultar el propio acceso", async () => {
    await assertSucceeds(getDoc(doc(db("member"), "teamMembers", "member")));
    await assertFails(getDoc(doc(db("member"), "teamMembers", "other")));
    await assertFails(getDocs(collection(db("admin"), "teamMembers")));
  });
  it("no se puede descubrir el contador de intentos", async () => {
    await assertFails(getDoc(doc(db("member"), "accessAttempts", "member")));
  });
  it("exige reservar el perfil y nickname mediante el backend", async () => {
    await seed("teamMembers/new", {
      expiresAt: Timestamp.fromMillis(Date.now() + 3600000),
    });
    await assertFails(
      setDoc(doc(db("new"), "users", "new"), {
        nickname: "new",
        email: "new@test.dev",
        role: "user",
        createdAt: Timestamp.now(),
      }),
    );
  });
  it("prohíbe perfiles con rol elevado o de otra persona", async () => {
    await assertFails(
      setDoc(doc(db("member"), "users", "new"), {
        nickname: "new",
        email: "member@test.dev",
        role: "user",
      }),
    );
    await assertFails(
      updateDoc(doc(db("member"), "users", "member"), { role: "admin" }),
    );
  });
  it("impide alterar campos reservados en el propio perfil", async () => {
    await assertFails(
      updateDoc(doc(db("member"), "users", "member"), { teamMember: true }),
    );
    await assertFails(
      updateDoc(doc(db("member"), "users", "member"), { nickname: "nuevo" }),
    );
  });
  it("no expone el directorio del vestuario a Google sin clave", async () => {
    await assertFails(getDocs(collection(db("outsider"), "users")));
    await assertSucceeds(getDoc(doc(db("outsider"), "users", "outsider")));
  });
  it("admin puede cambiar roles de miembros pero no degradar superadmin", async () => {
    await assertSucceeds(
      updateDoc(doc(db("admin"), "users", "member"), { role: "admin" }),
    );
    await assertFails(
      updateDoc(doc(db("admin"), "users", "super"), { role: "user" }),
    );
  });
  it("nadie elimina perfiles desde cliente", async () => {
    await assertFails(deleteDoc(doc(db("admin"), "users", "member")));
  });
});
describe("Votos y convocatorias", () => {
  it("un miembro lee su voto y el admin ve quién votó", async () => {
    await seed("matches/m/votes/member", { playerId: "p" });
    await assertSucceeds(
      getDoc(doc(db("member"), "matches", "m", "votes", "member")),
    );
    await assertSucceeds(
      getDocs(collection(db("admin"), "matches", "m", "votes")),
    );
    await assertFails(
      getDoc(doc(db("other"), "matches", "m", "votes", "member")),
    );
    await assertFails(getDocs(collection(db(), "matches", "m", "votes")));
  });
  it("los votos solo los escribe el backend", async () => {
    await assertFails(
      setDoc(doc(db("member"), "matches", "m", "votes", "member"), {
        playerId: "p",
      }),
    );
  });
  it("las notas y respuestas solo se ven dentro del equipo", async () => {
    await seed("matchPrivate/m", { meetingNote: "Quedada" });
    await assertSucceeds(getDoc(doc(db("member"), "matchPrivate", "m")));
    await assertFails(getDoc(doc(db(), "matchPrivate", "m")));
    await assertFails(getDoc(doc(db("outsider"), "matchPrivate", "m")));
  });
  it("las respuestas solo se escriben a través del backend", async () => {
    await assertFails(
      setDoc(doc(db("member"), "matchPrivate", "m", "availability", "member"), {
        response: "yes",
      }),
    );
  });
});
describe("Pizarra", () => {
  const board = {
    ownerUid: "member",
    seasonId: "season",
    name: "Mi siete",
    isOfficial: false,
  };
  it("solo miembros pueden leer y guardar su pizarra", async () => {
    await assertSucceeds(setDoc(doc(db("member"), "lineups", "x"), board));
    await assertSucceeds(getDoc(doc(db("other"), "lineups", "x")));
    await assertFails(getDoc(doc(db("outsider"), "lineups", "x")));
    await assertFails(
      setDoc(doc(db("member"), "lineups", "bad"), {
        ...board,
        ownerUid: "other",
      }),
    );
  });
  it("solo el propietario o el admin puede editar", async () => {
    await seed("lineups/x", board);
    await assertSucceeds(
      updateDoc(doc(db("member"), "lineups", "x"), { name: "Nueva" }),
    );
    await assertFails(
      updateDoc(doc(db("other"), "lineups", "x"), { name: "Ajena" }),
    );
    await assertSucceeds(
      updateDoc(doc(db("admin"), "lineups", "x"), { name: "Corregida" }),
    );
  });
  it("solo el admin puede publicar una alineación oficial", async () => {
    await seed("lineups/x", board);
    await assertFails(
      updateDoc(doc(db("member"), "lineups", "x"), { isOfficial: true }),
    );
    await assertSucceeds(
      updateDoc(doc(db("admin"), "lineups", "x"), { isOfficial: true }),
    );
    await assertFails(
      updateDoc(doc(db("member"), "lineups", "x"), { name: "Cambiar oficial" }),
    );
  });
  it("la propiedad no puede transferirse mediante una edición", async () => {
    await seed("lineups/x", board);
    await assertFails(
      updateDoc(doc(db("member"), "lineups", "x"), { ownerUid: "other" }),
    );
  });
  it("el dueño borra su borrador, pero no una alineación oficial", async () => {
    await seed("lineups/x", board);
    await assertSucceeds(deleteDoc(doc(db("member"), "lineups", "x")));
    await seed("lineups/x", { ...board, isOfficial: true });
    await assertFails(deleteDoc(doc(db("member"), "lineups", "x")));
    await assertSucceeds(deleteDoc(doc(db("admin"), "lineups", "x")));
  });
});
