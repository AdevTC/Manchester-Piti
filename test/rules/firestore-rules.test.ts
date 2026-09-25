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
  serverTimestamp,
  writeBatch,
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
  it("un voto sin firmar ni fecha se rechaza", async () => {
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
  it("una respuesta sin firmar se rechaza", async () => {
    await assertFails(
      setDoc(doc(db("member"), "matchPrivate", "m", "availability", "member"), {
        response: "yes",
      }),
    );
  });
});
describe("Vestuario: porra, entrenos, tablón y fichas", () => {
  for (const path of [
    "trainings/t",
    "trainings/t/votes/member",
    "board/b",
    "boardRate/member",
    "porraStandings/s",
    "playerClaims/member",
    "playerLinks/p",
    "matchPrivate/m/predictions/member",
  ]) {
    it("un documento mal formado no entra en " + path, async () => {
      await assertFails(setDoc(doc(db("member"), path), { value: 1 }));
      await assertFails(setDoc(doc(db("admin"), path), { value: 1 }));
    });
  }
  it("entrenos, votos, tablón, clasificación y vínculos solo dentro del equipo", async () => {
    for (const path of ["trainings/t", "trainings/t/votes/other", "board/b", "porraStandings/s", "playerLinks/p"]) {
      await seed(path, { value: 1 });
      await assertSucceeds(getDoc(doc(db("member"), path)));
      await assertFails(getDoc(doc(db(), path)));
      await assertFails(getDoc(doc(db("outsider"), path)));
    }
    await assertSucceeds(getDocs(collection(db("member"), "board")));
    await assertFails(getDocs(collection(db("outsider"), "board")));
  });
  it("nadie lee el control de ritmo del tablón", async () => {
    await seed("boardRate/member", { at: 1 });
    await assertFails(getDoc(doc(db("member"), "boardRate", "member")));
  });
  it("la porra ajena queda oculta hasta el inicio del partido", async () => {
    await seed("matches/future", { date: Timestamp.fromMillis(Date.now() + 3600000) });
    await seed("matches/past", { date: Timestamp.fromMillis(Date.now() - 3600000) });
    for (const m of ["future", "past"]) {
      await seed(`matchPrivate/${m}/predictions/member`, { goalsFor: 2, goalsAgainst: 1 });
      await seed(`matchPrivate/${m}/predictions/other`, { goalsFor: 0, goalsAgainst: 0 });
    }
    await assertSucceeds(getDoc(doc(db("member"), "matchPrivate/future/predictions/member")));
    await assertFails(getDoc(doc(db("member"), "matchPrivate/future/predictions/other")));
    await assertFails(getDocs(collection(db("member"), "matchPrivate/future/predictions")));
    await assertSucceeds(getDocs(collection(db("member"), "matchPrivate/past/predictions")));
    await assertFails(getDocs(collection(db("outsider"), "matchPrivate/past/predictions")));
  });
  it("cada uno ve su solicitud de ficha y el admin las revisa todas", async () => {
    await seed("playerClaims/member", { playerId: "p", status: "pending" });
    await assertSucceeds(getDoc(doc(db("member"), "playerClaims", "member")));
    await assertFails(getDoc(doc(db("other"), "playerClaims", "member")));
    await assertFails(getDocs(collection(db("member"), "playerClaims")));
    await assertSucceeds(getDocs(collection(db("admin"), "playerClaims")));
  });
  it("el vínculo con la ficha no se edita desde el perfil", async () => {
    await assertFails(updateDoc(doc(db("member"), "users", "member"), { playerId: "p" }));
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

describe("Escrituras directas del vestuario", () => {
  const HOUR = 3600000;
  const signed = (uid: string, extra: object) => ({ ...extra, name: uid, playerId: null, at: serverTimestamp() });
  beforeEach(async () => {
    await seed("matches/done", {
      status: "finished",
      date: Timestamp.fromMillis(Date.now() - 2 * HOUR),
      voteClosesAt: Date.now() + HOUR,
      ledger: { p: { played: true }, q: { played: false } },
    });
    await seed("matches/closed", { status: "finished", date: Timestamp.fromMillis(Date.now() - 72 * HOUR), voteClosesAt: Date.now() - HOUR, ledger: { p: { played: true } } });
    await seed("matches/next", { status: "scheduled", date: Timestamp.fromMillis(Date.now() + 24 * HOUR) });
    await seed("matches/started", { status: "scheduled", date: Timestamp.fromMillis(Date.now() - HOUR) });
    await seed("trainings/t", { slots: [{ id: "s1" }, { id: "s2" }], lastSlotAt: Timestamp.fromMillis(Date.now() + 48 * HOUR) });
    await seed("trainings/fixed", { slots: [{ id: "s1" }, { id: "s2" }], lastSlotAt: Timestamp.fromMillis(Date.now() + 48 * HOUR), confirmed: { slotId: "s2" } });
  });
  it("MVP: tu voto, a quien jugó y con la votación abierta", async () => {
    const vote = (who: string, match: string, extra: object = {}) =>
      setDoc(doc(db(who), "matches", match, "votes", who), { playerId: "p", voterName: who, at: serverTimestamp(), ...extra });
    await assertSucceeds(vote("member", "done"));
    await assertSucceeds(vote("member", "done")); // cambiar el voto
    await assertFails(vote("member", "done", { playerId: "q" }));
    await assertFails(vote("member", "done", { voterName: "otro" }));
    await assertFails(vote("member", "closed"));
    await assertFails(vote("outsider", "done"));
    await assertFails(setDoc(doc(db("member"), "matches", "done", "votes", "other"), { playerId: "p", voterName: "member", at: serverTimestamp() }));
    await assertFails(deleteDoc(doc(db("member"), "matches", "done", "votes", "member")));
  });
  it("Convocatoria: voy / no puedo antes del partido y firmado", async () => {
    const answer = (who: string, match: string, data: object) => setDoc(doc(db(who), "matchPrivate", match, "availability", who), data);
    await assertSucceeds(answer("member", "next", signed("member", { response: "yes" })));
    await assertSucceeds(answer("member", "next", signed("member", { response: "maybe" })));
    await assertFails(answer("member", "next", signed("member", { response: "claro" })));
    await assertFails(answer("member", "next", { ...signed("member", { response: "yes" }), name: "other" }));
    await assertFails(answer("member", "started", signed("member", { response: "yes" })));
    await assertFails(answer("outsider", "next", signed("outsider", { response: "yes" })));
  });
  it("Porra: marcador entre 0 y 30 hasta el inicio", async () => {
    const guess = (match: string, goalsFor: number, goalsAgainst = 1) =>
      setDoc(doc(db("member"), "matchPrivate", match, "predictions", "member"), signed("member", { goalsFor, goalsAgainst }));
    await assertSucceeds(guess("next", 3));
    await assertFails(guess("next", 31));
    await assertFails(guess("next", 1.5));
    await assertFails(guess("started", 2));
  });
  it("Entrenos: huecos de la propuesta y, confirmado, solo el fijado", async () => {
    const vote = (training: string, slotIds: string[]) =>
      setDoc(doc(db("member"), "trainings", training, "votes", "member"), signed("member", { slotIds }));
    await assertSucceeds(vote("t", ["s1", "s2"]));
    await assertFails(vote("t", ["s3"]));
    await assertFails(vote("t", []));
    await assertSucceeds(vote("fixed", ["s2"]));
    await assertFails(vote("fixed", ["s1"]));
    await assertSucceeds(deleteDoc(doc(db("member"), "trainings", "t", "votes", "member")));
    await assertFails(setDoc(doc(db("member"), "trainings", "t", "votes", "other"), signed("member", { slotIds: ["s1"] })));
  });
  it("Tablón: mensaje firmado con su sello de ritmo, uno cada 5 s", async () => {
    const post = (who: string, text: string, name = who) => {
      const c = db(who);
      const b = writeBatch(c);
      b.set(doc(c, "boardRate", who), { at: serverTimestamp() });
      b.set(doc(collection(c, "board")), { text, uid: who, name, playerId: null, at: serverTimestamp() });
      return b.commit();
    };
    await assertSucceeds(post("member", "¡Hola, equipo!"));
    await assertFails(post("member", "otra vez")); // antes de 5 s
    await assertFails(post("other", "   "));
    await assertFails(post("other", "hola", "member"));
    await assertFails(setDoc(doc(db("other"), "board", "solo"), { text: "sin sello", uid: "other", name: "other", playerId: null, at: serverTimestamp() }));
    await seed("board/mine", { text: "x", uid: "member", name: "member", playerId: null, at: Timestamp.now() });
    await assertFails(deleteDoc(doc(db("other"), "board", "mine")));
    await assertSucceeds(deleteDoc(doc(db("member"), "board", "mine")));
    await seed("board/theirs", { text: "x", uid: "other", name: "other", playerId: null, at: Timestamp.now() });
    await assertSucceeds(deleteDoc(doc(db("admin"), "board", "theirs")));
  });
});
