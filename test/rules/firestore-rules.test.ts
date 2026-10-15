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
  deleteField,
  serverTimestamp,
  writeBatch,
  Timestamp,
} from "firebase/firestore";
import { beforeAll, beforeEach, afterAll, describe, it } from "vitest";
import type { PosCode, PositionSet } from "../../src/lib/positions";
import { editPositionsPayload, positionsPayload, proposalPayload, reviewPayload } from "../../src/lib/positionsEdit";
import { cajaMovFields, cajaSettingsFields, type NewCajaMov } from "../../src/lib/derived/caja";
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
describe("Sanciones a mano (players)", () => {
  const ref = (uid: string) => doc(db(uid), "players", "erik");
  const sanction = (over: object = {}) => ({ games: 2, from: 1_700_000_000_000, by: "admin", untilMatchId: null, reason: "Federación", ...over });
  /** The stored doc, read past the rules (withSecurityRulesDisabled resolves to nothing: the value is kept here). */
  const stored = async () => {
    let data: Record<string, unknown> | undefined;
    await env.withSecurityRulesDisabled(async (c) => {
      data = (await getDoc(doc(c.firestore(), "players", "erik"))).data();
    });
    return data;
  };
  beforeEach(async () => {
    await seed("players/erik", { shirtName: "ERIK", injured: false });
  });
  it("un admin sanciona por el camino de siempre (merge) y null la levanta; un jugador no puede", async () => {
    await assertSucceeds(setDoc(ref("admin"), { sanction: sanction() }, { merge: true }));
    await assertSucceeds(setDoc(ref("admin"), { sanction: sanction({ games: 1, untilMatchId: "m8", reason: null }) }, { merge: true }));
    await assertFails(setDoc(ref("member"), { sanction: sanction({ by: "member" }) }, { merge: true }));
    await assertFails(setDoc(ref("member"), { sanction: null, sanctionClearedAt: 1 }, { merge: true }));
    await assertSucceeds(setDoc(ref("admin"), { sanction: null, sanctionClearedAt: 1_700_000_100_000 }, { merge: true }));
    const after = await stored();
    if (!after || after.sanction !== null || after.sanctionClearedAt !== 1_700_000_100_000 || after.shirtName !== "ERIK") throw new Error("la sanción no se levantó: " + JSON.stringify(after));
  });
  it("los nulls de los opcionales sustituyen a los de una sanción anterior (el merge no deja el motivo viejo)", async () => {
    await assertSucceeds(setDoc(ref("admin"), { sanction: sanction() }, { merge: true }));
    await assertSucceeds(setDoc(ref("admin"), { sanction: sanction({ games: 1, reason: null }) }, { merge: true }));
    const s = (await stored())?.sanction as { reason?: unknown; games?: unknown } | undefined;
    if (s?.reason !== null || s?.games !== 1) throw new Error("quedó el motivo viejo: " + JSON.stringify(s));
  });
  it("valida tipos y topes: 1–10 partidos enteros, motivo ≤ 80, partido ≤ 128, firmada por quien la pone, sin campos extra", async () => {
    for (const bad of [
      { games: 0 },
      { games: 11 },
      { games: 1.5 },
      { games: "2" },
      { from: "ayer" },
      { from: 1.5 },
      { by: "super" },
      { reason: "x".repeat(81) },
      { reason: 7 },
      { untilMatchId: "m".repeat(129) },
      { untilMatchId: "" },
      { extra: true },
    ])
      await assertFails(setDoc(ref("admin"), { sanction: sanction(bad) }, { merge: true }));
    await assertFails(setDoc(ref("admin"), { sanction: { games: 2, from: 1, untilMatchId: null, reason: null } }, { merge: true }));
    await assertFails(setDoc(ref("admin"), { sanction: "dos partidos" }, { merge: true }));
    await assertFails(setDoc(ref("admin"), { sanctionClearedAt: "ayer" }, { merge: true }));
    await assertSucceeds(setDoc(ref("admin"), { sanction: sanction({ games: 10, reason: "x".repeat(80), untilMatchId: "m".repeat(128) }) }, { merge: true }));
  });
  it("otro admin edita la ficha sin tocar la sanción que firmó el primero", async () => {
    await seed("players/erik", { shirtName: "ERIK", sanction: sanction(), sanctionClearedAt: 5 });
    await assertSucceeds(setDoc(ref("super"), { shirtName: "ERIK 9", injured: true }, { merge: true }));
    await assertSucceeds(updateDoc(ref("super"), { naturalPosition: "DEL" }));
    // …but changing it signs it again
    await assertFails(updateDoc(ref("super"), { "sanction.games": 3 }));
    await assertSucceeds(setDoc(ref("super"), { sanction: sanction({ by: "super", games: 3 }) }, { merge: true }));
  });
  it("una ficha nueva puede nacer con o sin sanción válida", async () => {
    await assertSucceeds(setDoc(doc(db("admin"), "players", "nuevo"), { shirtName: "NUEVO" }));
    await assertFails(setDoc(doc(db("admin"), "players", "nuevo2"), { shirtName: "NUEVO", sanction: sanction({ games: 0 }) }));
    await assertSucceeds(setDoc(doc(db("admin"), "players", "nuevo3"), { shirtName: "NUEVO", sanction: sanction() }));
  });
});
describe("Posiciones: propuesta del jugador y aprobación", () => {
  const ref = (uid: string, id = "erik") => doc(db(uid), "players", id);
  const set = (main: string | null, also: string[] = []) => ({ main, also });
  beforeEach(async () => {
    await seed("users/member", { email: "member@test.dev", nickname: "member", role: "user", playerId: "erik" });
    await seed("players/erik", { shirtName: "ERIK", naturalPosition: "DEF" });
    await seed("players/otro", { shirtName: "OTRO" });
  });
  it("el jugador propone las suyas (y puede retirarlas)", async () => {
    await assertSucceeds(updateDoc(ref("member"), { positionsProposal: { ...set("LD", ["MD", "DFC"]), at: serverTimestamp() } }));
    await assertSucceeds(updateDoc(ref("member"), { positionsProposal: null }));
  });
  it("no puede proponer por otro, ni tocar otro campo, ni aprobarse", async () => {
    await assertFails(updateDoc(ref("member", "otro"), { positionsProposal: { ...set("MC"), at: serverTimestamp() } }));
    await assertFails(updateDoc(ref("member"), { positionsProposal: { ...set("MC"), at: serverTimestamp() }, shirtName: "YO" }));
    await assertFails(updateDoc(ref("member"), { positions: set("MC") }));
    await assertFails(updateDoc(ref("other"), { positionsProposal: { ...set("MC"), at: serverTimestamp() } }));
  });
  it("con su propuesta borra la revisión anterior; nunca la pone a otro valor ni la borra sola", async () => {
    await seed("players/erik", { shirtName: "ERIK", positions: set("DFC"), positionsReview: { status: "rechazada", at: Timestamp.now(), by: "admin" } });
    // a review of his own making, with or without a proposal: refused
    for (const status of ["aprobada", "ajustada", "rechazada"])
      await assertFails(updateDoc(ref("member"), { positionsProposal: { ...set("MC"), at: serverTimestamp() }, positionsReview: { status, at: serverTimestamp(), by: "member" } }));
    await assertFails(updateDoc(ref("member"), { positionsProposal: { ...set("MC"), at: serverTimestamp() }, positionsReview: "nada" }));
    // clearing the verdict alone (no proposal sent nor withdrawn): refused
    await assertFails(updateDoc(ref("member"), { positionsReview: null }));
    // with his proposal: the old verdict goes
    await assertSucceeds(updateDoc(ref("member"), { positionsProposal: { ...set("MC"), at: serverTimestamp() }, positionsReview: null }));
    const after = await getDoc(ref("admin"));
    if (after.get("positionsReview") !== null) throw new Error("la revisión anterior no se borró: " + JSON.stringify(after.get("positionsReview")));
    // and on withdrawing it
    await assertSucceeds(updateDoc(ref("member"), { positionsProposal: null, positionsReview: null }));
  });
  // Perfil › «Tus posiciones» writes updateDoc(players/{id}, proposalPayload(set | null, serverTimestamp())).
  it("lo que envía «Tus posiciones» del perfil: proposalPayload con updateDoc", async () => {
    const pos = (main: PosCode | null, also: PosCode[] = []): PositionSet => ({ main, also });
    await seed("players/erik", { shirtName: "ERIK", positions: set("DFC"), positionsReview: { status: "ajustada", at: Timestamp.now(), by: "admin" } });
    await assertSucceeds(updateDoc(ref("member"), proposalPayload(pos("MCD", ["MC", "DFC"]), serverTimestamp())));
    await assertSucceeds(updateDoc(ref("member"), proposalPayload(pos(null, ["MI"]), serverTimestamp())));
    await assertSucceeds(updateDoc(ref("member"), proposalPayload(pos("DC", ["EI", "ED", "MCO", "MI", "MD", "MC"]), serverTimestamp())));
    await assertSucceeds(updateDoc(ref("member"), proposalPayload(null, serverTimestamp())));
    // withdrawn, sent again: still fine
    await assertSucceeds(updateDoc(ref("member"), proposalPayload(pos("MCD"), serverTimestamp())));
    // dated by the client, or on someone else's ficha: refused
    await assertFails(updateDoc(ref("member"), proposalPayload(pos("MCD"), Timestamp.now())));
    await assertFails(updateDoc(ref("member", "otro"), proposalPayload(pos("MCD"), serverTimestamp())));
  });
  it("una propuesta mal formada se rechaza", async () => {
    for (const bad of [
      { ...set("XX"), at: serverTimestamp() },
      { ...set("MC", ["MC"]), at: serverTimestamp() },
      { ...set("MC", ["MI", "MI"]), at: serverTimestamp() },
      { ...set("MC", ["POR", "DFC", "LIB", "LI", "LD", "MCD", "MI"]), at: serverTimestamp() },
      { ...set("MC"), at: 5 },
      { ...set("MC"), at: serverTimestamp(), extra: 1 },
      { main: "MC", at: serverTimestamp() },
    ])
      await assertFails(updateDoc(ref("member"), { positionsProposal: bad }));
  });
  it("el admin aprueba: positions + revisión firmada + propuesta a null", async () => {
    await assertSucceeds(
      updateDoc(ref("admin"), {
        positions: set("LD", ["MD"]),
        naturalPosition: "DEF",
        positionsProposal: null,
        positionsReview: { status: "aprobada", at: serverTimestamp(), by: "admin" },
      }),
    );
    await assertFails(updateDoc(ref("admin"), { positions: set("LD", ["LD"]) }));
    await assertFails(updateDoc(ref("admin"), { positionsReview: { status: "aprobada", at: serverTimestamp(), by: "otro" } }));
    await assertFails(updateDoc(ref("admin"), { positionsReview: { status: "quizá", at: serverTimestamp(), by: "admin" } }));
  });
  it("el admin cambia la línea (merge, main a null) y crea fichas con o sin posiciones válidas", async () => {
    await assertSucceeds(setDoc(ref("admin"), { naturalPosition: "MED", positions: set(null, ["MD"]) }, { merge: true }));
    await assertSucceeds(setDoc(doc(db("admin"), "players", "nuevo"), { shirtName: "NUEVO" }));
    await assertSucceeds(setDoc(doc(db("admin"), "players", "nuevo2"), { shirtName: "NUEVO", positions: set("DC") }));
    await assertFails(setDoc(doc(db("admin"), "players", "nuevo3"), { shirtName: "NUEVO", positions: { ...set("DC"), extra: 1 } }));
    await assertFails(setDoc(doc(db("admin"), "players", "nuevo4"), { shirtName: "NUEVO", positions: "DC" }));
  });
  // Admin › Plantilla writes through savePlayer = setDoc(…, { merge: true }): the exact payloads it sends.
  describe("lo que escribe la ficha del admin (merge)", () => {
    const pos = (main: PosCode | null, also: PosCode[] = []): PositionSet => ({ main, also });
    const save = (data: object, id = "erik") => setDoc(ref("admin", id), data, { merge: true });
    const proposal = async () =>
      seed("players/erik", {
        shirtName: "ERIK",
        naturalPosition: "DEF",
        positions: set("LD", ["MD", "DFC"]),
        positionsProposal: { ...set("MCD", ["MC"]), at: Timestamp.now() },
        positionsReview: { status: "rechazada", at: Timestamp.now(), by: "otroadmin" },
      });
    it("editar a mano: positions entero (y la línea con la preferida), también sin preferida o vacío; la revisión anterior se borra", async () => {
      await proposal();
      await assertSucceeds(save(editPositionsPayload(pos("MCD", ["MC"]))));
      await assertSucceeds(save(editPositionsPayload(pos(null, ["MC"]))));
      await assertSucceeds(save(editPositionsPayload(pos(null))));
      const after = await getDoc(ref("admin"));
      if (JSON.stringify(after.get("positions")) !== JSON.stringify({ main: null, also: [] })) throw new Error("positions no se sustituyó entero: " + JSON.stringify(after.get("positions")));
      if (after.get("positionsReview") !== null) throw new Error("la revisión anterior no se borró");
    });
    it("aprobar, ajustar y rechazar, con la fecha del servidor y firmado por el admin", async () => {
      await proposal();
      await assertSucceeds(save(reviewPayload("aprobada", pos("MCD", ["MC"]), "admin", serverTimestamp())));
      await proposal();
      await assertSucceeds(save(reviewPayload("ajustada", pos("MC", ["MCD"]), "admin", serverTimestamp())));
      const adjusted = await getDoc(ref("admin"));
      if (adjusted.get("positionsProposal") !== null || adjusted.get("positionsReview.status") !== "ajustada" || adjusted.get("positionsReview.by") !== "admin" || adjusted.get("naturalPosition") !== "MED")
        throw new Error("la revisión ajustada no quedó como se escribió");
      await proposal();
      await assertSucceeds(save(reviewPayload("rechazada", null, "admin", serverTimestamp())));
      // signed by someone else, or dated by the client: refused
      await proposal();
      await assertFails(save(reviewPayload("aprobada", pos("MCD", ["MC"]), "otroadmin", serverTimestamp())));
      await assertFails(save(reviewPayload("rechazada", null, "admin", Timestamp.now())));
    });
    it("un alta con las posiciones del mapa", async () => {
      await assertSucceeds(save({ shirtName: "NUEVO", ...positionsPayload(pos("MCD", ["MC"])) }, "nuevo5"));
    });
  });
});

describe("Vestuario e identidad", () => {
  it("solo se puede consultar el propio acceso", async () => {
    await assertSucceeds(getDoc(doc(db("member"), "teamMembers", "member")));
    await assertFails(getDoc(doc(db("member"), "teamMembers", "other")));
    await assertFails(getDocs(collection(db("member"), "teamMembers")));
    // Captains see who is inside (the door's control room); nobody writes it from the client.
    await assertSucceeds(getDocs(collection(db("admin"), "teamMembers")));
    await assertFails(setDoc(doc(db("admin"), "teamMembers", "x"), { expiresAt: Timestamp.fromMillis(Date.now() + 3600000) }));
  });
  it("la puerta: invitaciones solo para capitanes y cada petición para su dueño", async () => {
    await seed("invites/ABCDEFGH23", { by: "admin", uses: 0, maxUses: 1 });
    await seed("accessRequests/new", { status: "pending" });
    await assertSucceeds(getDocs(collection(db("admin"), "invites")));
    await assertFails(getDoc(doc(db("member"), "invites", "ABCDEFGH23")));
    await assertFails(getDoc(doc(db(), "invites", "ABCDEFGH23")));
    await assertSucceeds(getDoc(doc(db("new"), "accessRequests", "new")));
    await assertFails(getDoc(doc(db("member"), "accessRequests", "new")));
    await assertSucceeds(getDocs(collection(db("admin"), "accessRequests")));
    await assertFails(setDoc(doc(db("new"), "accessRequests", "new"), { status: "pending" }));
    await assertFails(setDoc(doc(db("admin"), "invites", "ZZZZZZZZ22"), { by: "admin" }));
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
    await seed("matches/future", { status: "scheduled", date: Timestamp.fromMillis(Date.now() - 3600000), clock: { phase: "ready" } });
    await seed("matches/past", { status: "scheduled", date: Timestamp.fromMillis(Date.now() + 3600000), clock: { phase: "first" } });
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
    ownerNickname: "member",
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
  it("dibujos y jugadas: listas con tope (60 trazos, 12 jugadas)", async () => {
    const stroke = { id: "k", kind: "carrera", color: "gold", points: [{ x: 10, y: 10 }, { x: 20, y: 20 }] };
    const play = { id: "j", name: "Córner", kind: "propia", frames: [] };
    await assertSucceeds(
      setDoc(doc(db("member"), "lineups", "x"), { ...board, drawings: [stroke], plays: [play] }),
    );
    await assertSucceeds(
      updateDoc(doc(db("member"), "lineups", "x"), {
        drawings: Array.from({ length: 60 }, () => stroke),
        plays: Array.from({ length: 12 }, () => play),
      }),
    );
    await assertFails(
      updateDoc(doc(db("member"), "lineups", "x"), { drawings: Array.from({ length: 61 }, () => stroke) }),
    );
    await assertFails(
      updateDoc(doc(db("member"), "lineups", "x"), { plays: Array.from({ length: 13 }, () => play) }),
    );
    await assertFails(updateDoc(doc(db("member"), "lineups", "x"), { drawings: "nada" }));
    await assertFails(
      setDoc(doc(db("member"), "lineups", "y"), { ...board, plays: { j: play } }),
    );
    // un tablero antiguo, sin los campos nuevos, se sigue editando
    await seed("lineups/old", board);
    await assertSucceeds(updateDoc(doc(db("member"), "lineups", "old"), { name: "Viejo" }));
  });
  it("el rival en la pizarra: su sistema y hasta siete jugadores; null lo quita; trazos pegados y curvas caben", async () => {
    const rival = { formation: "2-3-1", players: Array.from({ length: 7 }, (_, i) => (i === 6 ? { num: 9, note: "presionar al 9 por su izquierda" } : {})) };
    const unir = { id: "k1", kind: "unir", color: "gold", anchors: ["p1", "p2"], points: [{ x: 10, y: 10 }, { x: 20, y: 20 }] };
    const fuera = { id: "k2", kind: "fuera", color: "white", side: "nos", points: [{ x: 0, y: 70 }, { x: 100, y: 70 }] };
    const frame = { players: {}, ball: { x: 50, y: 50 }, rivals: [], arrows: [], curves: { p1: { x: 40, y: 40 } } };
    const play = { id: "j", name: "Curva", kind: "propia", frames: [frame, frame] };
    await assertSucceeds(setDoc(doc(db("member"), "lineups", "x"), { ...board, rival, drawings: [unir, fuera], plays: [play] }));
    await assertSucceeds(updateDoc(doc(db("member"), "lineups", "x"), { rival: null }));
    await assertSucceeds(updateDoc(doc(db("member"), "lineups", "x"), { rival: { formation: "3-2-1", players: [] } }));
    await assertFails(updateDoc(doc(db("member"), "lineups", "x"), { rival: { ...rival, players: Array.from({ length: 8 }, () => ({})) } }));
    await assertFails(updateDoc(doc(db("member"), "lineups", "x"), { rival: { ...rival, extra: true } }));
    await assertFails(updateDoc(doc(db("member"), "lineups", "x"), { rival: { players: [] } }));
    await assertFails(updateDoc(doc(db("member"), "lineups", "x"), { rival: { formation: "2-3-1-y-mucho-más", players: [] } }));
    await assertFails(updateDoc(doc(db("member"), "lineups", "x"), { rival: "MAD SKY" }));
    await assertFails(updateDoc(doc(db("member"), "lineups", "x"), { rival: { formation: "2-3-1", players: { a: {} } } }));
    // el rival de otro no se toca
    await seed("lineups/z", { ...board, ownerUid: "other" });
    await assertFails(updateDoc(doc(db("member"), "lineups", "z"), { rival }));
  });

  it("día de partido: cambios (≤ 20), lanzadores en orden (≤ 3 por lista) y vice-capitán", async () => {
    const sub = { id: "s1", min: 25, out: "p1", in: "p2" };
    const takers = { penalties: ["p1", "p2", "p3"], freekicks: [], corners: ["p2"] };
    const roles = { captainId: "p1", viceId: "p2", penaltiesId: "p1", freekicksId: "p3", cornersId: "p2" };
    await assertSucceeds(setDoc(doc(db("member"), "lineups", "x"), { ...board, subs: [sub], takers, roles }));
    await assertSucceeds(updateDoc(doc(db("member"), "lineups", "x"), { subs: Array.from({ length: 20 }, () => sub) }));
    await assertFails(updateDoc(doc(db("member"), "lineups", "x"), { subs: Array.from({ length: 21 }, () => sub) }));
    await assertFails(updateDoc(doc(db("member"), "lineups", "x"), { subs: { s1: sub } }));
    await assertFails(updateDoc(doc(db("member"), "lineups", "x"), { takers: { ...takers, penalties: ["a", "b", "c", "d"] } }));
    await assertFails(updateDoc(doc(db("member"), "lineups", "x"), { takers: { ...takers, throwins: [] } }));
    await assertFails(updateDoc(doc(db("member"), "lineups", "x"), { takers: ["p1"] }));
    await assertFails(updateDoc(doc(db("member"), "lineups", "x"), { roles: { ...roles, extra: "p9" } }));
    // a board from before the match day still saves
    await seed("lineups/old", board);
    await assertSucceeds(updateDoc(doc(db("member"), "lineups", "old"), { roles: { captainId: "p1" } }));
  });
  it("un tablero solo lleva sus campos, con su tipo y su tope", async () => {
    const slot = { slotId: "pz-slot-0", playerId: null, position: "POR", zone: "POR", x: 50, y: 90 };
    const full = {
      ...board,
      formation: "2-3-1",
      freeMode: false,
      slots: Array.from({ length: 7 }, () => slot),
      roles: { captainId: "p1" },
      tactics: { press: "Alta" },
      playerPositions: { p1: "DEF" },
      drawings: [],
      plays: [],
      matchId: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await assertSucceeds(setDoc(doc(db("member"), "lineups", "x"), full));
    await assertFails(setDoc(doc(db("member"), "lineups", "y"), { ...full, extra: 1 }));
    await assertFails(setDoc(doc(db("member"), "lineups", "y"), { ...full, name: "x".repeat(61) }));
    await assertFails(setDoc(doc(db("member"), "lineups", "y"), { ...full, name: "" }));
    await assertFails(setDoc(doc(db("member"), "lineups", "y"), { ...full, slots: [slot] }));
    await assertFails(setDoc(doc(db("member"), "lineups", "y"), { ...full, slots: Array.from({ length: 7 }, () => "x") }));
    await assertFails(setDoc(doc(db("member"), "lineups", "y"), { ...full, isOfficial: "no" }));
    await assertFails(setDoc(doc(db("member"), "lineups", "y"), { ...full, matchId: 8 }));
    await assertFails(setDoc(doc(db("member"), "lineups", "y"), { ...full, roles: "capi" }));
    await assertFails(
      setDoc(doc(db("member"), "lineups", "y"), {
        ...full,
        playerPositions: Object.fromEntries(Array.from({ length: 61 }, (_, i) => ["p" + i, "DEF"])),
      }),
    );
    // the autosave: only the board fields, the old bench and «pinned» dropped
    await seed("lineups/old", { ...board, bench: ["a", "b"], pinned: [] });
    await assertSucceeds(
      updateDoc(doc(db("member"), "lineups", "old"), {
        slots: full.slots,
        tactics: full.tactics,
        bench: deleteField(),
        pinned: deleteField(),
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(updateDoc(doc(db("member"), "lineups", "old"), { slots: [slot, slot] }));
  });
  it("la táctica del tablero: sin balón, plan condicional (≤ 3) y estilo, con su tipo y su tope", async () => {
    const offs = Array.from({ length: 7 }, () => ({ du: 0, dv: 6 }));
    const rule = { id: "r1", when: "ganando", by: 2, from: 30, key: "mentality", value: "Defensiva", sub: { out: "p1", in: "p2" } };
    const tactica = { shapeOff: { formation: "3-2-1", offs }, condPlan: [rule], style: "presion" };
    await assertSucceeds(setDoc(doc(db("member"), "lineups", "x"), { ...board, ...tactica }));
    // the autosave writes them always: nothing («null», [], "") is valid too
    await assertSucceeds(updateDoc(doc(db("member"), "lineups", "x"), { shapeOff: null, condPlan: [], style: "" }));
    await assertSucceeds(updateDoc(doc(db("member"), "lineups", "x"), { condPlan: [rule, rule, rule] }));
    await assertFails(updateDoc(doc(db("member"), "lineups", "x"), { condPlan: [rule, rule, rule, rule] }));
    await assertFails(updateDoc(doc(db("member"), "lineups", "x"), { condPlan: ["si ganamos"] }));
    await assertFails(updateDoc(doc(db("member"), "lineups", "x"), { condPlan: { r1: rule } }));
    await assertFails(updateDoc(doc(db("member"), "lineups", "x"), { shapeOff: { formation: "3-2-1", offs, extra: 1 } }));
    await assertFails(updateDoc(doc(db("member"), "lineups", "x"), { shapeOff: { formation: "3-2-1", offs: [...offs, { du: 0, dv: 0 }] } }));
    await assertFails(updateDoc(doc(db("member"), "lineups", "x"), { shapeOff: "3-2-1" }));
    await assertFails(updateDoc(doc(db("member"), "lineups", "x"), { style: "x".repeat(25) }));
    await assertFails(updateDoc(doc(db("member"), "lineups", "x"), { style: 3 }));
    // a board from before the táctica still saves
    await seed("lineups/old", board);
    await assertSucceeds(updateDoc(doc(db("member"), "lineups", "old"), { name: "Viejo" }));
  });
  it("las etiquetas del tablero: hasta tres textos de 1 a 20 letras", async () => {
    await assertSucceeds(setDoc(doc(db("member"), "lineups", "x"), { ...board, tags: ["Liga", "Copa"] }));
    await assertSucceeds(updateDoc(doc(db("member"), "lineups", "x"), { tags: [] }));
    await assertSucceeds(updateDoc(doc(db("member"), "lineups", "x"), { tags: ["Liga", "Copa", "x".repeat(20)] }));
    await assertFails(updateDoc(doc(db("member"), "lineups", "x"), { tags: ["Liga", "Copa", "Entreno", "Final"] }));
    await assertFails(updateDoc(doc(db("member"), "lineups", "x"), { tags: ["x".repeat(21)] }));
    await assertFails(updateDoc(doc(db("member"), "lineups", "x"), { tags: [""] }));
    await assertFails(updateDoc(doc(db("member"), "lineups", "x"), { tags: [3] }));
    await assertFails(updateDoc(doc(db("member"), "lineups", "x"), { tags: "Liga" }));
    // las etiquetas de otro no se tocan
    await seed("lineups/z", { ...board, ownerUid: "other", ownerNickname: "other" });
    await assertFails(updateDoc(doc(db("member"), "lineups", "z"), { tags: ["Liga"] }));
  });
  it("el autor firma con su propio apodo; la temporada no cambia", async () => {
    await assertFails(setDoc(doc(db("member"), "lineups", "x"), { ...board, ownerNickname: "admin" }));
    await assertFails(setDoc(doc(db("member"), "lineups", "x"), { ownerUid: "member", seasonId: "season", name: "Sin apodo" }));
    await seed("lineups/x", board);
    await assertFails(updateDoc(doc(db("member"), "lineups", "x"), { ownerNickname: "other" }));
    await assertFails(updateDoc(doc(db("admin"), "lineups", "x"), { ownerNickname: "admin" }));
    await assertFails(updateDoc(doc(db("member"), "lineups", "x"), { seasonId: "otra" }));
    await assertFails(updateDoc(doc(db("admin"), "lineups", "x"), { seasonId: "otra" }));
    // the owner's nickname changed in the profile: the board may follow it
    await seed("lineups/y", { ...board, ownerNickname: "antiguo" });
    await assertSucceeds(updateDoc(doc(db("member"), "lineups", "y"), { ownerNickname: "member" }));
  });
  describe("el oficial de cada alcance", () => {
    const scope = (matchId: string | null) => ({ lineupId: "x", seasonId: "season", matchId, at: serverTimestamp() });
    it("solo los capitanes lo escriben, con el id de su alcance; los miembros lo leen", async () => {
      await seed("lineups/x", board);
      await assertFails(setDoc(doc(db("member"), "lineupOfficials", "season__m8"), scope("m8")));
      await assertFails(setDoc(doc(db("admin"), "lineupOfficials", "season__m9"), scope("m8")));
      await assertFails(setDoc(doc(db("admin"), "lineupOfficials", "season__m8"), { ...scope("m8"), extra: 1 }));
      await assertSucceeds(setDoc(doc(db("admin"), "lineupOfficials", "season__m8"), scope("m8")));
      await assertSucceeds(setDoc(doc(db("admin"), "lineupOfficials", "season__temporada"), scope(null)));
      await assertSucceeds(getDoc(doc(db("member"), "lineupOfficials", "season__m8")));
      await assertFails(getDoc(doc(db("outsider"), "lineupOfficials", "season__m8")));
      await assertFails(deleteDoc(doc(db("member"), "lineupOfficials", "season__m8")));
      await assertSucceeds(deleteDoc(doc(db("admin"), "lineupOfficials", "season__m8")));
    });
    it("publicar es atómico: el tablero, el anterior oficial y el alcance a la vez", async () => {
      await seed("lineups/x", board);
      await seed("lineups/prev", { ...board, isOfficial: true, matchId: "m8" });
      const a = db("admin");
      const b = writeBatch(a);
      b.update(doc(a, "lineups", "prev"), { isOfficial: false, updatedAt: serverTimestamp() });
      b.update(doc(a, "lineups", "x"), { isOfficial: true, matchId: "m8", updatedAt: serverTimestamp() });
      b.set(doc(a, "lineupOfficials", "season__m8"), scope("m8"));
      await assertSucceeds(b.commit());
    });
  });
  describe("reacciones al siete oficial", () => {
    const official = { ...board, isOfficial: true };
    const mine = (uid: string, value: unknown) =>
      setDoc(doc(db(uid), "lineups", "x", "reactions", uid), { value, at: serverTimestamp() });
    it("un miembro opina en su propio documento, con «ok» o «dudas»", async () => {
      await seed("lineups/x", official);
      await assertSucceeds(mine("member", "ok"));
      await assertSucceeds(mine("member", "dudas"));
      await assertFails(mine("member", "fatal"));
      await assertFails(
        setDoc(doc(db("member"), "lineups", "x", "reactions", "other"), { value: "ok", at: serverTimestamp() }),
      );
      await assertFails(
        setDoc(doc(db("member"), "lineups", "x", "reactions", "member"), { value: "ok", at: serverTimestamp(), extra: 1 }),
      );
      await assertFails(
        setDoc(doc(db("member"), "lineups", "x", "reactions", "member"), { value: "ok", at: Timestamp.fromMillis(0) }),
      );
    });
    it("solo en un tablero oficial, y solo miembros", async () => {
      await seed("lineups/x", board);
      await assertFails(mine("member", "ok"));
      await seed("lineups/x", official);
      await assertFails(mine("outsider", "ok"));
      await assertFails(
        setDoc(doc(db(), "lineups", "x", "reactions", "anon"), { value: "ok", at: serverTimestamp() }),
      );
    });
    it("los miembros ven las reacciones; cada uno borra solo la suya", async () => {
      await seed("lineups/x", official);
      await seed("lineups/x/reactions/other", { value: "dudas", at: Timestamp.now() });
      await seed("lineups/x/reactions/member", { value: "ok", at: Timestamp.now() });
      await assertSucceeds(getDocs(collection(db("member"), "lineups", "x", "reactions")));
      await assertFails(getDocs(collection(db("outsider"), "lineups", "x", "reactions")));
      await assertFails(deleteDoc(doc(db("member"), "lineups", "x", "reactions", "other")));
      await assertSucceeds(deleteDoc(doc(db("member"), "lineups", "x", "reactions", "member")));
    });
    it("al dejar de ser oficial o borrarse, se limpian: los capitanes, o el dueño si ya no es oficial", async () => {
      await seed("lineups/x", official);
      await seed("lineups/x/reactions/other", { value: "dudas", at: Timestamp.now() });
      await seed("lineups/x/reactions/admin", { value: "ok", at: Timestamp.now() });
      // the owner (a member) cannot empty the reactions of a board that is still official
      await assertFails(deleteDoc(doc(db("member"), "lineups", "x", "reactions", "other")));
      await assertSucceeds(deleteDoc(doc(db("admin"), "lineups", "x", "reactions", "other")));
      await seed("lineups/x", board);
      await assertFails(deleteDoc(doc(db("other"), "lineups", "x", "reactions", "admin")));
      await assertSucceeds(deleteDoc(doc(db("member"), "lineups", "x", "reactions", "admin")));
    });
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
  it("Porra: ninguna escritura directa puede saltarse la validación del servidor", async () => {
    const guess = (match: string, goalsFor: number, goalsAgainst = 1) =>
      setDoc(doc(db("member"), "matchPrivate", match, "predictions", "member"), signed("member", { goalsFor, goalsAgainst }));
    await assertFails(guess("next", 3));
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
describe("Contenido de El club", () => {
  const content = {
    intro: "Hola",
    story: "Historia",
    location: "",
    founded: "",
    venue: "",
    email: "",
    instagram: "",
    photoUrl: "",
    milestones: [],
    sponsors: [],
    gallery: [],
    faq: [{ q: "¿Cómo me apunto?", a: "Escríbenos." }],
    crestStory: "Lo dibujó el capitán.",
  };
  it("un admin publica el contenido con preguntas e historia del escudo", async () => {
    await assertSucceeds(setDoc(doc(db("admin"), "clubContent", "main"), content));
  });
  it("un miembro no admin no puede publicarlo", async () => {
    await assertFails(setDoc(doc(db("member"), "clubContent", "main"), content));
  });
  it("sin campos desconocidos, sin otro documento y con límites", async () => {
    await assertFails(setDoc(doc(db("admin"), "clubContent", "main"), { ...content, hack: true }));
    await assertFails(setDoc(doc(db("admin"), "clubContent", "otro"), content));
    await assertFails(setDoc(doc(db("admin"), "clubContent", "main"), { ...content, faq: "no es una lista" }));
    await assertFails(setDoc(doc(db("admin"), "clubContent", "main"), { ...content, crestStory: "x".repeat(5000) }));
  });
  it("los documentos antiguos sin preguntas siguen siendo válidos", async () => {
    const { faq: _faq, crestStory: _crest, ...legacy } = content;
    await assertSucceeds(setDoc(doc(db("admin"), "clubContent", "main"), legacy));
  });
});
describe("Pizarra · el día de partido (variantes y recordatorios)", () => {
  const board = { ownerUid: "member", ownerNickname: "member", seasonId: "season", name: "Mi siete", isOfficial: false };
  const slot = { slotId: "pz-slot-0", playerId: null, position: "POR", zone: "POR", x: 50, y: 90 };
  const variant = (id: string) => ({ id, name: id === "vb" ? "Plan B" : "2ª parte", formation: "3-2-1", freeMode: false, slots: Array.from({ length: 7 }, () => slot), tactics: { press: "Alta" } });
  it("un tablero lleva hasta dos variantes, cada una con sus siete huecos", async () => {
    await assertSucceeds(setDoc(doc(db("member"), "lineups", "x"), { ...board, variants: [variant("v2"), variant("vb")] }));
    await assertSucceeds(updateDoc(doc(db("member"), "lineups", "x"), { variants: [] }));
    await assertFails(updateDoc(doc(db("member"), "lineups", "x"), { variants: [variant("v2"), variant("vb"), variant("v2")] }));
    await assertFails(updateDoc(doc(db("member"), "lineups", "x"), { variants: [{ ...variant("v2"), slots: [slot] }] }));
    await assertFails(updateDoc(doc(db("member"), "lineups", "x"), { variants: [{ ...variant("v2"), name: "x".repeat(25) }] }));
    await assertFails(updateDoc(doc(db("member"), "lineups", "x"), { variants: "Plan B" }));
    // the official carries its variants: only a captain edits them
    await seed("lineups/off", { ...board, isOfficial: true });
    await assertFails(updateDoc(doc(db("member"), "lineups", "off"), { variants: [variant("vb")] }));
    await assertSucceeds(updateDoc(doc(db("admin"), "lineups", "off"), { variants: [variant("vb")] }));
  });
  it("«Recordatorios automáticos»: los capitanes los encienden o apagan; el equipo los ve", async () => {
    const off = { auto: false, by: "admin", at: serverTimestamp() };
    await assertSucceeds(setDoc(doc(db("admin"), "convocatoriaReminders", "m1"), off));
    await assertSucceeds(getDoc(doc(db("member"), "convocatoriaReminders", "m1")));
    await assertFails(getDoc(doc(db("outsider"), "convocatoriaReminders", "m1")));
    await assertFails(setDoc(doc(db("member"), "convocatoriaReminders", "m2"), { auto: false, by: "member", at: serverTimestamp() }));
    await assertFails(setDoc(doc(db("admin"), "convocatoriaReminders", "m2"), { ...off, by: "other" }));
    await assertFails(setDoc(doc(db("admin"), "convocatoriaReminders", "m2"), { ...off, auto: "no" }));
    await assertFails(setDoc(doc(db("admin"), "convocatoriaReminders", "m2"), { ...off, extra: 1 }));
    await assertFails(deleteDoc(doc(db("admin"), "convocatoriaReminders", "m1")));
  });
  it("el registro de avisos (pushLog) es solo del servidor", async () => {
    await seed("pushLog/seven-x", { at: 1 });
    await assertFails(getDoc(doc(db("admin"), "pushLog", "seven-x")));
    await assertFails(setDoc(doc(db("admin"), "pushLog", "seven-y"), { at: 1 }));
    await assertFails(getDocs(collection(db("member"), "pushLog")));
    await assertFails(deleteDoc(doc(db("admin"), "pushLog", "seven-x")));
  });
  it("las suscripciones de avisos (pushSubscriptions) son solo del servidor: nadie las lee ni las escribe", async () => {
    const sub = { endpoint: "https://push.example.test/x", keys: { p256dh: "p", auth: "a" }, topics: ["goals"], uid: "member" };
    await seed("pushSubscriptions/x", sub);
    for (const who of [undefined, "outsider", "member", "admin"]) {
      await assertFails(getDoc(doc(db(who), "pushSubscriptions", "x")));
      await assertFails(getDocs(collection(db(who), "pushSubscriptions")));
      await assertFails(setDoc(doc(db(who), "pushSubscriptions", "y"), { ...sub, uid: who ?? "anon" }));
      await assertFails(updateDoc(doc(db(who), "pushSubscriptions", "x"), { topics: [] }));
      await assertFails(deleteDoc(doc(db(who), "pushSubscriptions", "x")));
    }
  });
});

describe("Pizarra · Bloque 5 (la voz de la charla, el vídeo de la jugada)", () => {
  const board = { ownerUid: "member", ownerNickname: "member", seasonId: "season", name: "Mi siete", isOfficial: false };
  const clip = (over: object = {}) => ({ step: "plan", mime: "audio/webm;codecs=opus", ms: 12000, data: "AQID", by: "member", at: serverTimestamp(), ...over });
  const voz = (uid: string, slot: string) => doc(db(uid), "lineups", "x", "voz", slot);
  it("el dueño graba la voz de un paso; el equipo la oye; fuera nadie", async () => {
    await seed("lineups/x", board);
    await assertSucceeds(setDoc(voz("member", "v0"), clip()));
    await assertSucceeds(setDoc(voz("member", "v5"), clip({ step: "siete-3", mime: "audio/mp4" })));
    await assertSucceeds(getDoc(voz("other", "v0")));
    await assertSucceeds(getDocs(collection(db("other"), "lineups", "x", "voz")));
    await assertFails(getDoc(voz("outsider", "v0")));
    await assertFails(setDoc(voz("other", "v1"), clip({ by: "other" })));
    await assertSucceeds(deleteDoc(voz("member", "v5")));
    await assertFails(deleteDoc(voz("other", "v0")));
  });
  it("seis huecos como mucho, y cada clip con su tope (30 s, 900 000 caracteres, audio, un paso conocido)", async () => {
    await seed("lineups/x", board);
    await assertFails(setDoc(voz("member", "v6"), clip()));
    await assertFails(setDoc(voz("member", "voz"), clip()));
    await assertFails(setDoc(voz("member", "v0"), clip({ ms: 30001 })));
    await assertFails(setDoc(voz("member", "v0"), clip({ ms: 1.5 })));
    await assertFails(setDoc(voz("member", "v0"), clip({ data: "A".repeat(900001) })));
    await assertSucceeds(setDoc(voz("member", "v0"), clip({ data: "A".repeat(900000) })));
    await assertFails(setDoc(voz("member", "v1"), clip({ mime: "text/html" })));
    await assertFails(setDoc(voz("member", "v1"), clip({ step: "siete-9" })));
    await assertFails(setDoc(voz("member", "v1"), clip({ by: "other" })));
    await assertFails(setDoc(voz("member", "v1"), clip({ at: Timestamp.fromMillis(0) })));
    await assertFails(setDoc(voz("member", "v1"), clip({ extra: 1 })));
  });
  it("la voz del oficial solo la tocan los capitanes; sin tablero no hay voz", async () => {
    await seed("lineups/x", { ...board, isOfficial: true });
    await assertFails(setDoc(voz("member", "v0"), clip()));
    await assertSucceeds(setDoc(voz("admin", "v0"), clip({ by: "admin" })));
    await assertFails(deleteDoc(voz("member", "v0")));
    await assertSucceeds(deleteDoc(voz("admin", "v0")));
    await assertFails(setDoc(doc(db("member"), "lineups", "nada", "voz", "v0"), clip()));
  });
  it("una jugada lleva su vídeo enlazado dentro (la lista de jugadas sigue con su tope)", async () => {
    const play = { id: "j", name: "Córner", kind: "propia", frames: [], video: { url: "https://youtu.be/abc", at: 75 } };
    await assertSucceeds(setDoc(doc(db("member"), "lineups", "x"), { ...board, plays: [play] }));
    await assertFails(updateDoc(doc(db("member"), "lineups", "x"), { plays: Array.from({ length: 13 }, () => play) }));
  });
});

describe("La caja (caja, cajaMovs)", () => {
  const settings = (over: object = {}) => ({ ...cajaSettingsFields({ cuota: 3000, cuotaPeriod: "temporada", howToPay: "Bizum al 600 000 000" }), updatedAt: serverTimestamp(), ...over });
  const movement = (by: string, over: Partial<NewCajaMov> = {}, extra: object = {}) => ({
    ...cajaMovFields("t1", { kind: "cargo", playerId: "ana", amount: 643, concept: "Campo y árbitro · J5 vs Rival", date: "2026-10-15", matchId: "m5", ...over }, by),
    createdAt: serverTimestamp(),
    ...extra,
  });
  const seeded = { seasonId: "t1", kind: "pago", playerId: "ana", amount: 1250, concept: "Bizum", date: "2026-10-15", matchId: null, by: "admin", createdAt: Timestamp.fromMillis(0), void: false };

  it("los socios leen los ajustes y los movimientos; fuera del equipo, nadie", async () => {
    await seed("caja/t1", { cuota: 3000, cuotaPeriod: "temporada", howToPay: "Bizum", updatedAt: Timestamp.fromMillis(0) });
    await seed("cajaMovs/x", seeded);
    await assertSucceeds(getDoc(doc(db("member"), "caja", "t1")));
    await assertSucceeds(getDoc(doc(db("member"), "cajaMovs", "x")));
    await assertSucceeds(getDocs(collection(db("other"), "cajaMovs")));
    await assertFails(getDoc(doc(db("outsider"), "caja", "t1")));
    await assertFails(getDocs(collection(db("outsider"), "cajaMovs")));
    await assertFails(getDoc(doc(db(), "cajaMovs", "x")));
  });

  it("solo los capitanes guardan los ajustes, con su forma; nadie los borra", async () => {
    await assertSucceeds(setDoc(doc(db("admin"), "caja", "t1"), settings()));
    await assertSucceeds(setDoc(doc(db("admin"), "caja", "t1"), settings({ cuota: 0, cuotaPeriod: "mensual", howToPay: "" })));
    await assertFails(setDoc(doc(db("member"), "caja", "t1"), settings()));
    await assertFails(setDoc(doc(db("admin"), "caja", "t2"), settings({ cuota: 12.5 })));
    await assertFails(setDoc(doc(db("admin"), "caja", "t2"), settings({ cuota: -1 })));
    await assertFails(setDoc(doc(db("admin"), "caja", "t2"), settings({ cuotaPeriod: "semanal" })));
    await assertFails(setDoc(doc(db("admin"), "caja", "t2"), settings({ howToPay: "x".repeat(501) })));
    await assertFails(setDoc(doc(db("admin"), "caja", "t2"), settings({ updatedAt: Timestamp.fromMillis(0) })));
    await assertFails(setDoc(doc(db("admin"), "caja", "t2"), settings({ multas: true })));
    await assertFails(deleteDoc(doc(db("admin"), "caja", "t1")));
  });

  it("solo los capitanes apuntan movimientos, en un lote, firmados por ellos", async () => {
    const cap = db("admin");
    const batch = writeBatch(cap);
    batch.set(doc(collection(cap, "cajaMovs")), movement("admin"));
    batch.set(doc(collection(cap, "cajaMovs")), movement("admin", { playerId: "bea", amount: 642 }));
    batch.set(doc(collection(cap, "cajaMovs")), movement("admin", { kind: "gasto", playerId: null, amount: 4500, concept: "Campo", matchId: null }));
    batch.set(doc(collection(cap, "cajaMovs")), movement("admin", { kind: "ingreso", playerId: null, amount: 10000, concept: "Patrocinio", matchId: null }));
    await assertSucceeds(batch.commit());
    await assertSucceeds(setDoc(doc(db("super"), "cajaMovs", "p"), movement("super", { kind: "pago", matchId: null })));
    await assertFails(setDoc(doc(db("member"), "cajaMovs", "y"), movement("member", { kind: "pago" })));
    await assertFails(setDoc(doc(db("outsider"), "cajaMovs", "y"), movement("outsider")));
    await assertFails(setDoc(doc(db("admin"), "cajaMovs", "y"), movement("other")));
  });

  it("la forma de un movimiento: tipo conocido, céntimos enteros y positivos, jugador solo en cargos y pagos", async () => {
    const bad = [
      movement("admin", {}, { kind: "multa" }),
      movement("admin", { amount: 0 }),
      movement("admin", { amount: -100 }),
      movement("admin", { amount: 6.43 }),
      movement("admin", { amount: 10000001 }),
      movement("admin", { playerId: null }),
      movement("admin", { kind: "gasto", playerId: "ana", matchId: null }, { playerId: "ana" }),
      movement("admin", { concept: "" }),
      movement("admin", {}, { concept: "   " }),
      movement("admin", {}, { concept: "x".repeat(81) }),
      movement("admin", { date: "15/10/2026" }),
      movement("admin", {}, { matchId: 5 }),
      movement("admin", {}, { void: true }),
      movement("admin", {}, { createdAt: Timestamp.fromMillis(0) }),
      movement("admin", {}, { extra: 1 }),
    ];
    for (const [i, d] of bad.entries()) await assertFails(setDoc(doc(db("admin"), "cajaMovs", `bad${i}`), d));
    const { matchId: _m, ...noMatch } = movement("admin", { kind: "pago" });
    void _m;
    await assertSucceeds(setDoc(doc(db("admin"), "cajaMovs", "nomatch"), noMatch));
  });

  it("append-only: anular solo pasa void de false a true; nada más cambia y nadie borra", async () => {
    await seed("cajaMovs/x", seeded);
    await assertFails(updateDoc(doc(db("member"), "cajaMovs", "x"), { void: true }));
    await assertFails(updateDoc(doc(db("admin"), "cajaMovs", "x"), { amount: 1 }));
    await assertFails(updateDoc(doc(db("admin"), "cajaMovs", "x"), { void: true, concept: "Otro" }));
    await assertFails(deleteDoc(doc(db("admin"), "cajaMovs", "x")));
    await assertFails(deleteDoc(doc(db("super"), "cajaMovs", "x")));
    await assertSucceeds(updateDoc(doc(db("admin"), "cajaMovs", "x"), { void: true }));
    await assertFails(updateDoc(doc(db("admin"), "cajaMovs", "x"), { void: false }));
    await assertFails(setDoc(doc(db("admin"), "cajaMovs", "x"), movement("admin")));
  });
});
