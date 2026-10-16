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
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import type { PosCode, PositionSet } from "../../src/lib/positions";
import { editPositionsPayload, positionsPayload, proposalPayload, reviewPayload } from "../../src/lib/positionsEdit";
import { cajaMovFields, cajaSettingsFields, cajaVoidFields, type NewCajaMov } from "../../src/lib/derived/caja";
import { absenceFields } from "../../src/lib/derived/absences";
import { standingsFields, type StandingRow } from "../../src/lib/standings";
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
    "matchTombstones",
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
    await seed("matches/m8", { status: "scheduled" });
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
    await seed(`matches/${"m".repeat(128)}`, { status: "scheduled" });
    await assertSucceeds(setDoc(ref("admin"), { sanction: sanction({ games: 10, reason: "x".repeat(80), untilMatchId: "m".repeat(128) }) }, { merge: true }));
  });
  it("una pestaña antigua no puede volver a vincular una sanción a un partido eliminado", async () => {
    await assertFails(setDoc(ref("admin"), { sanction: sanction({ untilMatchId: "missing" }) }, { merge: true }));
    await seed("matches/m8", { status: "finished", archived: true });
    await assertSucceeds(setDoc(ref("admin"), { sanction: sanction({ untilMatchId: "m8" }) }, { merge: true }));
    await seed("matchTombstones/m8", { deletedAt: Timestamp.now() });
    await assertFails(setDoc(ref("admin"), { sanction: sanction({ untilMatchId: "m8", games: 3 }) }, { merge: true }));
    await assertSucceeds(setDoc(ref("admin"), { sanction: sanction({ untilMatchId: null }) }, { merge: true }));
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
    beforeEach(async () => { await seed("matches/m8", { status: "scheduled" }); });
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
    await seed("matches/m1", { status: "scheduled" });
    await seed("matches/m2", { status: "scheduled" });
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

describe("Partidos archivados y eliminados", () => {
  const upcomingMatch = () => ({ status: "scheduled", date: Timestamp.fromMillis(Date.now() + 3600000) });
  const linkedBoard = { ownerUid: "member", ownerNickname: "member", seasonId: "season", matchId: "sleep", name: "Siete", isOfficial: true };
  it("solo el backend puede archivar, reactivar o eliminar, incluso con sesión admin", async () => {
    await seed("matches/sleep", { ...upcomingMatch(), archived: true });
    for (const uid of ["admin", "member", "other"]) {
      await assertFails(updateDoc(doc(db(uid), "matches/sleep"), { archived: false }));
      await assertFails(deleteDoc(doc(db(uid), "matches/sleep")));
    }
    await seed("matchTombstones/sleep", { deletedAt: Timestamp.now() });
    await assertFails(getDoc(doc(db("admin"), "matchTombstones/sleep")));
    await assertFails(deleteDoc(doc(db("admin"), "matchTombstones/sleep")));
  });
  for (const state of ["archived", "missing", "tombstone"] as const) {
    it(`bloquea escrituras tardías del partido ${state}`, async () => {
      if (state !== "missing") await seed("matches/sleep", { ...upcomingMatch(), ...(state === "archived" ? { archived: true } : {}) });
      if (state === "tombstone") await seed("matchTombstones/sleep", { deletedAt: Timestamp.now() });
      await seed("lineups/sleep", linkedBoard);
      await seed("lineupOfficials/season__sleep", { lineupId: "sleep", seasonId: "season", matchId: "sleep" });
      await assertFails(setDoc(doc(db("member"), "matchPrivate/sleep/availability/member"), { response: "yes", name: "member", playerId: null, at: serverTimestamp() }));
      await assertFails(setDoc(doc(db("admin"), "lineups/new"), { ...linkedBoard, ownerUid: "admin", ownerNickname: "admin" }));
      await assertFails(updateDoc(doc(db("admin"), "lineups/sleep"), { name: "Cambio tardío" }));
      await assertFails(updateDoc(doc(db("admin"), "lineups/sleep"), { matchId: null }));
      await assertFails(deleteDoc(doc(db("admin"), "lineups/sleep")));
      await assertFails(setDoc(doc(db("member"), "lineups/sleep/reactions/member"), { value: "ok", at: serverTimestamp() }));
      await assertFails(setDoc(doc(db("admin"), "lineups/sleep/voz/v0"), { step: "sistema", mime: "audio/webm", ms: 1000, data: "abc", by: "admin", at: serverTimestamp() }));
      await assertFails(setDoc(doc(db("admin"), "lineupOfficials/season__sleep"), { lineupId: "sleep", seasonId: "season", matchId: "sleep", at: serverTimestamp() }));
      await assertFails(setDoc(doc(db("admin"), "convocatoriaReminders/sleep"), { auto: false, by: "admin", at: serverTimestamp() }));
    });
  }
  it("congela el MVP archivado y lo admite de nuevo al reactivar dentro del plazo", async () => {
    const match = { status: "finished", voteClosesAt: Date.now() + 3600000, ledger: { p1: { played: true } } };
    const vote = () => setDoc(doc(db("member"), "matches/sleep/votes/member"), { playerId: "p1", voterName: "member", at: serverTimestamp() });
    await seed("matches/sleep", { ...match, archived: true });
    await assertFails(vote());
    await seed("matches/sleep", match);
    await assertSucceeds(vote());
    await seed("matchTombstones/sleep", { deletedAt: Timestamp.now() });
    await assertFails(vote());
  });
  it("el admin puede preparar pizarras para un borrador activo, nunca archivado ni eliminado", async () => {
    const board = { ...linkedBoard, ownerUid: "admin", ownerNickname: "admin" };
    await seed("matchDrafts/sleep", upcomingMatch());
    await assertSucceeds(setDoc(doc(db("admin"), "lineups/draft"), board));
    await assertFails(setDoc(doc(db("member"), "lineups/member-draft"), { ...linkedBoard, isOfficial: false }));
    await seed("matchDrafts/sleep", { ...upcomingMatch(), archived: true });
    await assertFails(updateDoc(doc(db("admin"), "lineups/draft"), { name: "Dormido" }));
    await seed("matchDrafts/sleep", upcomingMatch());
    await seed("matchTombstones/sleep", { deletedAt: Timestamp.now() });
    await assertFails(updateDoc(doc(db("admin"), "lineups/draft"), { name: "Borrado" }));
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

describe("Ausencias (absences)", () => {
  const absence = (who: string, from = "2026-10-12", to = "2026-10-19", note = "", extra: object = {}) => ({
    ...absenceFields({ uid: who, name: who, playerId: null }, from, to, note),
    createdAt: serverTimestamp(),
    ...extra,
  });
  const seeded = (uid: string) => ({ uid, playerId: null, name: uid, from: "2026-10-12", to: "2026-10-19", createdAt: Timestamp.fromMillis(0) });

  it("los socios leen las de todos; fuera del equipo, nadie", async () => {
    await seed("absences/x", seeded("other"));
    await assertSucceeds(getDoc(doc(db("member"), "absences", "x")));
    await assertSucceeds(getDocs(collection(db("member"), "absences")));
    await assertFails(getDoc(doc(db("outsider"), "absences", "x")));
    await assertFails(getDoc(doc(db(), "absences", "x")));
  });

  it("cada socio escribe las suyas, firmadas y con fechas de verdad, de 1 a 120 días", async () => {
    const add = (who: string, data: object) => setDoc(doc(collection(db(who), "absences")), data);
    await assertSucceeds(add("member", absence("member")));
    await assertSucceeds(add("member", absence("member", "2026-10-12", "2026-10-12", "Boda en Cuenca")));
    await assertSucceeds(add("member", absence("member", "2026-10-01", "2027-01-28"))); // 120 días justos
    await assertSucceeds(add("member", absence("member", "2026-10-20", "2026-10-30"))); // cruza el cambio de hora
    const bad = [
      absence("other"), // a nombre de otro
      absence("member", undefined, undefined, "", { name: "other" }),
      absence("member", undefined, undefined, "", { playerId: "p1" }),
      absence("member", "2026-10-19", "2026-10-12"),
      absence("member", "2026-10-01", "2027-01-29"), // 121 días
      absence("member", "12/10/2026", "19/10/2026"),
      absence("member", "2026-02-30", "2026-03-02"),
      absence("member", "2026-13-01", "2026-13-02"),
      absence("member", undefined, undefined, "", { note: "x".repeat(141) }),
      absence("member", undefined, undefined, "", { note: 5 }),
      absence("member", undefined, undefined, "", { createdAt: Timestamp.fromMillis(0) }),
      absence("member", undefined, undefined, "", { response: "no" }),
    ];
    for (const d of bad) await assertFails(add("member", d));
    const { to: _to, ...noEnd } = absence("member");
    void _to;
    await assertFails(add("member", noEnd));
    await assertFails(add("outsider", absence("outsider")));
  });

  it("sin ediciones: se quita y se pone otra; los capitanes quitan cualquiera", async () => {
    await seed("absences/mine", seeded("member"));
    await seed("absences/theirs", seeded("other"));
    await assertFails(updateDoc(doc(db("member"), "absences", "mine"), { to: "2026-10-20" }));
    await assertFails(updateDoc(doc(db("admin"), "absences", "theirs"), { to: "2026-10-20" }));
    await assertFails(deleteDoc(doc(db("member"), "absences", "theirs")));
    await assertFails(deleteDoc(doc(db("outsider"), "absences", "theirs")));
    await assertSucceeds(deleteDoc(doc(db("member"), "absences", "mine")));
    await assertSucceeds(deleteDoc(doc(db("admin"), "absences", "theirs")));
  });

  it("la respuesta a mano sustituye a la de la ausencia (sin source); el navegador nunca escribe source", async () => {
    await seed("matches/next", { status: "scheduled", date: Timestamp.fromMillis(Date.now() + 24 * 3600000) });
    await seed("matchPrivate/next/availability/member", { response: "no", name: "member", playerId: null, at: Timestamp.now(), source: "absence", absenceId: "x" });
    const ref = doc(db("member"), "matchPrivate", "next", "availability", "member");
    await assertFails(setDoc(ref, { response: "no", name: "member", playerId: null, at: serverTimestamp(), source: "absence", absenceId: "x" }));
    await assertSucceeds(setDoc(ref, { response: "yes", name: "member", playerId: null, at: serverTimestamp() }));
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

  it("append-only: anular solo pasa void de false a true, con quién y cuándo; nada más cambia y nadie borra", async () => {
    await seed("cajaMovs/x", seeded);
    const voiding = (by: string, extra: object = {}) => ({ ...cajaVoidFields(by), voidedAt: serverTimestamp(), ...extra });
    await assertFails(updateDoc(doc(db("member"), "cajaMovs", "x"), voiding("member")));
    await assertFails(updateDoc(doc(db("admin"), "cajaMovs", "x"), { amount: 1 }));
    await assertFails(updateDoc(doc(db("admin"), "cajaMovs", "x"), voiding("admin", { concept: "Otro" })));
    // without who and when, or signed by someone else, or with another time: refused
    await assertFails(updateDoc(doc(db("admin"), "cajaMovs", "x"), { void: true }));
    await assertFails(updateDoc(doc(db("admin"), "cajaMovs", "x"), { void: true, voidedBy: "admin" }));
    await assertFails(updateDoc(doc(db("admin"), "cajaMovs", "x"), { void: true, voidedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db("admin"), "cajaMovs", "x"), voiding("super")));
    await assertFails(updateDoc(doc(db("admin"), "cajaMovs", "x"), voiding("admin", { voidedAt: Timestamp.fromMillis(0) })));
    // (and the trail is never written without voiding)
    await assertFails(updateDoc(doc(db("admin"), "cajaMovs", "x"), { voidedBy: "admin", voidedAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(db("admin"), "cajaMovs", "x")));
    await assertFails(deleteDoc(doc(db("super"), "cajaMovs", "x")));
    await assertSucceeds(updateDoc(doc(db("admin"), "cajaMovs", "x"), voiding("admin")));
    const voided = (await getDoc(doc(db("member"), "cajaMovs", "x"))).data();
    const at: unknown = voided?.voidedAt;
    if (voided?.voidedBy !== "admin" || typeof (at as { toMillis?: unknown } | undefined)?.toMillis !== "function") throw new Error("anular no dejó quién y cuándo");
    // voided once: never again (nor un-voided, nor re-signed by another captain)
    await assertFails(updateDoc(doc(db("admin"), "cajaMovs", "x"), { void: false }));
    await assertFails(updateDoc(doc(db("super"), "cajaMovs", "x"), voiding("super")));
    await assertFails(setDoc(doc(db("admin"), "cajaMovs", "x"), movement("admin")));
  });
});

describe("La clasificación de la liga (standings)", () => {
  const r = (team: string, over: Partial<StandingRow> = {}): StandingRow => ({ team, pj: 8, g: 5, e: 2, p: 1, gf: 20, gc: 9, pts: 17, isUs: false, ...over });
  const rows = [r("Rayo Norte"), r("Manchester Piti", { isUs: true }), r("Los Rojos")];
  const table = (by: string, over: object = {}, prev?: { jornada: number | null; rows: StandingRow[]; rowsPrev?: StandingRow[] }) => ({
    ...standingsFields({ competition: "Liga F7", jornada: 8, rows }, by, prev),
    updatedAt: serverTimestamp(),
    ...over,
  });
  it("everyone reads it, fans included", async () => {
    await seed("standings/t1", { competition: "Liga", jornada: 8, updatedAt: Timestamp.fromMillis(0), updatedBy: "admin", rows });
    await assertSucceeds(getDoc(doc(db(), "standings", "t1")));
    await assertSucceeds(getDocs(collection(db(), "standings")));
    await assertSucceeds(getDoc(doc(db("outsider"), "standings", "t1")));
  });
  it("only captains write it, signed and stamped by the server, and nobody deletes it", async () => {
    await assertSucceeds(setDoc(doc(db("admin"), "standings", "t1"), table("admin")));
    await assertSucceeds(setDoc(doc(db("super"), "standings", "t2"), table("super", { jornada: null, competition: "" })));
    await assertFails(setDoc(doc(db("member"), "standings", "t3"), table("member")));
    await assertFails(setDoc(doc(db("outsider"), "standings", "t3"), table("outsider")));
    await assertFails(setDoc(doc(db(), "standings", "t3"), table("x")));
    await assertFails(setDoc(doc(db("admin"), "standings", "t3"), table("super")));
    await assertFails(setDoc(doc(db("admin"), "standings", "t3"), table("admin", { updatedAt: Timestamp.fromMillis(0) })));
    await assertFails(deleteDoc(doc(db("admin"), "standings", "t1")));
    await assertFails(deleteDoc(doc(db("super"), "standings", "t1")));
  });
  // (per row the rules can only afford the name and «nosotros»: whole numbers ≥ 0 are the app's, lib/standings)
  it("the shape: 2–24 rows, exactly one ours, names ≤ 40, nothing else", async () => {
    const ref = (id: string) => doc(db("admin"), "standings", id);
    const many = (n: number) => Array.from({ length: n }, (_, i) => r(`Equipo ${i + 1}`, { isUs: i === n - 1 }));
    await assertSucceeds(setDoc(ref("min"), table("admin", { rows: many(2) })));
    await assertSucceeds(setDoc(ref("max"), table("admin", { rows: many(24) })));
    const bad: object[] = [
      { rows: many(1) },
      { rows: many(25) },
      { rows: [r("A"), r("B")] },
      { rows: [r("A", { isUs: true }), r("B", { isUs: true })] },
      { rows: [r("A", { isUs: true }), r("x".repeat(41))] },
      { rows: [r("A", { isUs: true }), { team: "B", pj: 1 }] },
      { rows: [r("A", { isUs: true }), "B"] },
      { rows: [...many(23), r("Z", { isUs: true })] },
      { jornada: -1 },
      { jornada: "8" },
      { competition: "x".repeat(81) },
      { multas: true },
      { rowsPrev: rows },
    ];
    for (const [i, over] of bad.entries()) await assertFails(setDoc(ref(`bad${i}`), table("admin", over)));
    const { updatedBy: _by, ...unsigned } = table("admin");
    await assertFails(setDoc(ref("unsigned"), unsigned));
  });
  it("rowsPrev: only the table this save replaces, or the one already kept", async () => {
    const before = [r("Manchester Piti", { isUs: true }), r("Rayo Norte"), r("Los Rojos")];
    const older = [r("Los Rojos"), r("Rayo Norte"), r("Manchester Piti", { isUs: true })];
    await seed("standings/t1", { competition: "Liga F7", jornada: 7, updatedAt: Timestamp.fromMillis(0), updatedBy: "admin", rows: before, rowsPrev: older });
    const ref = doc(db("admin"), "standings", "t1");
    await assertFails(setDoc(ref, table("admin", { rowsPrev: [r("Otro", { isUs: true }), r("Más")] })));
    await assertSucceeds(setDoc(ref, table("admin", {}, { jornada: 7, rows: before, rowsPrev: older })));
    // (now rows = the new table, rowsPrev = before: a correction within jornada 8 keeps `before`)
    await assertSucceeds(setDoc(ref, table("admin", { rows: [...rows].reverse() }, { jornada: 8, rows, rowsPrev: before })));
    const saved = (await getDoc(doc(db(), "standings", "t1"))).data();
    expect(saved?.rowsPrev).toEqual(before);
    await assertSucceeds(setDoc(ref, table("admin")));
  });
});

describe("Centro de avisos (notices) y users.noticesSeenAt", () => {
  const notice = (audience: string, extra: object = {}) => ({
    topic: "lineup",
    title: "Ya está la convocatoria",
    body: "Rival FC.",
    url: "/matches/m1",
    at: Timestamp.now(),
    audience,
    expireAt: Timestamp.fromMillis(Date.now() + 60 * 86400000),
    ...extra,
  });
  const latest = (who: string | undefined, audience: string) =>
    getDocs(query(collection(db(who), "notices"), where("audience", "==", audience), orderBy("at", "desc"), limit(30)));
  const mine = (who: string, uid: string) =>
    getDocs(query(collection(db(who), "notices"), where("audience", "==", "personal"), where("uid", "==", uid), orderBy("at", "desc"), limit(30)));
  beforeEach(async () => {
    await seed("notices/team", notice("team"));
    await seed("notices/captains", notice("captains", { topic: "convocatoria" }));
    await seed("notices/personal-member", notice("personal", { topic: "personal", uid: "member" }));
    await seed("notices/personal-other", notice("personal", { topic: "personal", uid: "other" }));
  });

  it("los socios leen los del equipo; un aficionado o un anónimo, no", async () => {
    await assertSucceeds(latest("member", "team"));
    await assertSucceeds(getDoc(doc(db("member"), "notices", "team")));
    await assertFails(latest("outsider", "team"));
    await assertFails(getDoc(doc(db("outsider"), "notices", "team")));
    await assertFails(latest(undefined, "team"));
  });

  it("los de los capitanes, solo los capitanes", async () => {
    await assertSucceeds(latest("admin", "captains"));
    await assertSucceeds(latest("super", "captains"));
    await assertFails(latest("member", "captains"));
    await assertFails(getDoc(doc(db("member"), "notices", "captains")));
  });

  it("los personales, solo su socio; nunca los de otro ni sin filtrar por audiencia", async () => {
    await assertSucceeds(mine("member", "member"));
    await assertSucceeds(getDoc(doc(db("member"), "notices", "personal-member")));
    await assertFails(mine("member", "other"));
    await assertFails(getDoc(doc(db("member"), "notices", "personal-other")));
    await assertFails(getDoc(doc(db("admin"), "notices", "personal-other")));
    await assertFails(latest("member", "personal"));
    await assertFails(getDocs(collection(db("member"), "notices")));
  });

  it("nadie escribe avisos desde el navegador, ni un capitán", async () => {
    await assertFails(setDoc(doc(db("admin"), "notices", "nuevo"), notice("team")));
    await assertFails(setDoc(doc(db("member"), "notices", "nuevo"), notice("personal", { uid: "member" })));
    await assertFails(updateDoc(doc(db("admin"), "notices", "team"), { title: "Otro" }));
    await assertFails(deleteDoc(doc(db("admin"), "notices", "team")));
  });

  it("cada socio marca sus avisos vistos (solo noticesSeenAt, con la hora del servidor) y nada más", async () => {
    await assertSucceeds(updateDoc(doc(db("member"), "users", "member"), { noticesSeenAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(db("member"), "users", "member"), { noticesSeenAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db("member"), "users", "member"), { noticesSeenAt: Timestamp.fromMillis(Date.now() + 86400000) }));
    await assertFails(updateDoc(doc(db("member"), "users", "member"), { noticesSeenAt: serverTimestamp(), nickname: "otro-nombre" }));
    await assertFails(updateDoc(doc(db("member"), "users", "member"), { role: "admin" }));
    await assertFails(updateDoc(doc(db("member"), "users", "member"), { nickname: "otro-nombre" }));
    await assertFails(updateDoc(doc(db("member"), "users", "other"), { noticesSeenAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db("admin"), "users", "other"), { noticesSeenAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db(), "users", "member"), { noticesSeenAt: serverTimestamp() }));
    // (the captains' role rule is untouched)
    await assertSucceeds(updateDoc(doc(db("admin"), "users", "other"), { role: "admin" }));
  });
});

describe("Encuestas del vestuario (polls, polls/{id}/votes)", () => {
  const HOUR = 3_600_000;
  const DAY = 24 * HOUR;
  const opts = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `o${i + 1}`, label: `Opción ${i + 1}` }));
  /** What the app writes on create: createdAt by the server, closesAt `ms` from now. */
  const poll = (who: string, extra: object = {}, ms = 3 * DAY) => ({
    question: "¿Cena el viernes?",
    options: opts(2),
    multi: false,
    authorUid: who,
    authorName: who,
    createdAt: serverTimestamp(),
    closesAt: Timestamp.fromMillis(Date.now() + ms),
    ...extra,
  });
  const seeded = (authorUid: string, extra: object = {}) => ({
    question: "¿Cena el viernes?",
    options: opts(3),
    multi: false,
    authorUid,
    authorName: authorUid,
    createdAt: Timestamp.fromMillis(Date.now() - HOUR),
    closesAt: Timestamp.fromMillis(Date.now() + DAY),
    ...extra,
  });
  const vote = (who: string, optionIds: string[], extra: object = {}) => ({ optionIds, name: who, playerId: null, at: serverTimestamp(), ...extra });
  const voteRef = (who: string, pollId: string, uid = who) => doc(db(who), "polls", pollId, "votes", uid);

  it("los socios leen encuestas y votos; un aficionado o un anónimo, nada", async () => {
    await seed("polls/p", seeded("other"));
    await seed("polls/p/votes/other", { optionIds: ["o1"], name: "other", playerId: null, at: Timestamp.now() });
    await assertSucceeds(getDoc(doc(db("member"), "polls", "p")));
    await assertSucceeds(getDocs(collection(db("member"), "polls")));
    await assertSucceeds(getDoc(doc(db("member"), "polls", "p", "votes", "other")));
    await assertSucceeds(getDocs(collection(db("member"), "polls", "p", "votes")));
    for (const who of ["outsider", undefined]) {
      await assertFails(getDoc(doc(db(who), "polls", "p")));
      await assertFails(getDocs(collection(db(who), "polls")));
      await assertFails(getDoc(doc(db(who), "polls", "p", "votes", "other")));
      await assertFails(getDocs(collection(db(who), "polls", "p", "votes")));
    }
  });

  it("cualquier socio crea una, a su nombre, con 2–6 opciones y cierre de 1 h a 14 días", async () => {
    const add = (who: string, data: object) => setDoc(doc(collection(db(who), "polls")), data);
    await assertSucceeds(add("member", poll("member")));
    await assertSucceeds(add("member", poll("member", { options: opts(6), multi: true })));
    await assertSucceeds(add("member", poll("member", { question: "x".repeat(120), options: [{ id: "a", label: "y".repeat(40) }, { id: "b", label: "No" }] })));
    await assertSucceeds(add("member", poll("member", {}, HOUR + 60_000))); // 1 h (+ el minuto de margen de la app)
    await assertSucceeds(add("member", poll("member", {}, 14 * DAY - 60_000))); // casi 14 días
    await assertSucceeds(add("admin", poll("admin")));
    const bad = [
      poll("other"), // a nombre de otro
      poll("member", { question: "x".repeat(121) }),
      poll("member", { question: "   " }),
      poll("member", { options: opts(1) }),
      poll("member", { options: opts(7) }),
      poll("member", { options: [{ id: "a", label: "y".repeat(41) }, { id: "b", label: "No" }] }),
      poll("member", { options: [{ id: "a", label: "" }, { id: "b", label: "No" }] }),
      poll("member", { options: [{ id: "a", label: "Sí" }, { id: "a", label: "No" }] }), // ids repetidos
      poll("member", { options: [{ id: "a", label: "Sí", extra: 1 }, { id: "b", label: "No" }] }),
      poll("member", { options: ["Sí", "No"] }),
      poll("member", { multi: "no" }),
      poll("member", { authorName: "" }),
      poll("member", { authorName: "other" }), // firma con el nombre de otro (el aviso lo enseña)
      poll("member", { authorName: "admin" }),
      poll("member", { createdAt: Timestamp.now() }), // no es la hora del servidor
      poll("member", { closedAt: serverTimestamp() }), // nace abierta
      poll("member", { extra: true }),
      poll("member", {}, 30 * 60_000), // cierra antes de 1 h
      poll("member", {}, 14 * DAY + HOUR), // más de 14 días
      poll("member", { closesAt: Date.now() + DAY }), // no es un Timestamp
    ];
    for (const data of bad) await assertFails(add("member", data));
    const noQuestion = Object.fromEntries(Object.entries(poll("member")).filter(([k]) => k !== "question"));
    await assertFails(add("member", noQuestion));
    await assertFails(add("outsider", poll("outsider")));
    await assertFails(add("outsider", poll("member")));
  });

  it("el autor o un capitán la cierran (solo closedAt, una vez); nadie más, ni otra cosa", async () => {
    await seed("polls/mine", seeded("member"));
    await seed("polls/theirs", seeded("other"));
    await assertFails(updateDoc(doc(db("other"), "polls", "mine"), { closedAt: serverTimestamp() })); // no es el autor
    await assertFails(updateDoc(doc(db("outsider"), "polls", "mine"), { closedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db("member"), "polls", "mine"), { closedAt: Timestamp.now() }));
    await assertFails(updateDoc(doc(db("member"), "polls", "mine"), { closedAt: serverTimestamp(), question: "¿Otra?" }));
    await assertFails(updateDoc(doc(db("member"), "polls", "mine"), { question: "¿Otra?" }));
    await assertFails(updateDoc(doc(db("member"), "polls", "mine"), { closesAt: Timestamp.fromMillis(Date.now() + 2 * DAY) }));
    await assertSucceeds(updateDoc(doc(db("member"), "polls", "mine"), { closedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db("member"), "polls", "mine"), { closedAt: serverTimestamp() })); // ya cerrada
    await assertFails(updateDoc(doc(db("member"), "polls", "mine"), { closedAt: deleteField() })); // ni se reabre
    await assertSucceeds(updateDoc(doc(db("admin"), "polls", "theirs"), { closedAt: serverTimestamp() }));
  });

  it("el autor o un capitán la borran; nadie más", async () => {
    await seed("polls/mine", seeded("member"));
    await seed("polls/theirs", seeded("other"));
    await assertFails(deleteDoc(doc(db("member"), "polls", "theirs")));
    await assertFails(deleteDoc(doc(db("outsider"), "polls", "theirs")));
    await assertSucceeds(deleteDoc(doc(db("member"), "polls", "mine")));
    await assertSucceeds(deleteDoc(doc(db("admin"), "polls", "theirs")));
  });

  it("cada socio vota la suya mientras está abierta, firmado, y puede cambiarla", async () => {
    await seed("polls/one", seeded("other"));
    await seed("polls/many", seeded("other", { multi: true }));
    await assertSucceeds(setDoc(voteRef("member", "one"), vote("member", ["o2"])));
    await assertSucceeds(setDoc(voteRef("member", "one"), vote("member", ["o3"]))); // cambia el voto
    await assertSucceeds(setDoc(voteRef("member", "many"), vote("member", ["o1"])));
    await assertSucceeds(setDoc(voteRef("member", "many"), vote("member", ["o1", "o2", "o3"])));
    await assertSucceeds(setDoc(voteRef("admin", "one"), vote("admin", ["o1"])));
  });

  it("votos rechazados: de otro, fuera de la encuesta, de más, sin firma o con la encuesta cerrada", async () => {
    await seed("polls/one", seeded("other"));
    await seed("polls/many", seeded("other", { multi: true }));
    await seed("polls/late", seeded("other", { closesAt: Timestamp.fromMillis(Date.now() - 60_000) }));
    await seed("polls/closed", seeded("other", { closedAt: Timestamp.fromMillis(Date.now() - 60_000) }));
    await assertFails(setDoc(voteRef("member", "one", "other"), vote("other", ["o1"]))); // el voto de otro
    await assertFails(setDoc(voteRef("member", "one", "other"), vote("member", ["o1"])));
    await assertFails(setDoc(voteRef("member", "one"), vote("member", ["o9"]))); // no es de la encuesta
    await assertFails(setDoc(voteRef("member", "one"), vote("member", ["o1", "o2"]))); // 2 en una de una sola
    await assertFails(setDoc(voteRef("member", "one"), vote("member", [])));
    await assertFails(setDoc(voteRef("member", "many"), vote("member", ["o1", "o1"])));
    await assertFails(setDoc(voteRef("member", "many"), vote("member", ["o1", "o9"])));
    await assertFails(setDoc(voteRef("member", "many"), vote("member", [])));
    await assertFails(setDoc(voteRef("member", "one"), vote("member", ["o1"], { name: "other" })));
    await assertFails(setDoc(voteRef("member", "one"), vote("member", ["o1"], { playerId: "p1" })));
    await assertFails(setDoc(voteRef("member", "one"), vote("member", ["o1"], { at: Timestamp.now() })));
    await assertFails(setDoc(voteRef("member", "one"), vote("member", ["o1"], { extra: 1 })));
    await assertFails(setDoc(voteRef("member", "one"), { optionIds: ["o1"], name: "member", playerId: null }));
    await assertFails(setDoc(voteRef("member", "late"), vote("member", ["o1"]))); // pasó su hora
    await assertFails(setDoc(voteRef("member", "closed"), vote("member", ["o1"]))); // cerrada antes
    await assertFails(setDoc(voteRef("member", "missing"), vote("member", ["o1"]))); // no existe
    await assertFails(setDoc(voteRef("outsider", "one"), vote("outsider", ["o1"])));
    // (a vote already there can't be changed once the poll closed)
    await seed("polls/closed/votes/member", { optionIds: ["o1"], name: "member", playerId: null, at: Timestamp.now() });
    await assertFails(setDoc(voteRef("member", "closed"), vote("member", ["o2"])));
  });

  it("cada socio quita su propio voto mientras está abierta; nunca el de otro", async () => {
    await seed("polls/one", seeded("other"));
    await seed("polls/closed", seeded("other", { closedAt: Timestamp.fromMillis(Date.now() - 60_000) }));
    const v = { optionIds: ["o1"], name: "x", playerId: null, at: Timestamp.now() };
    await seed("polls/one/votes/member", v);
    await seed("polls/one/votes/other", v);
    await seed("polls/closed/votes/member", v);
    await seed("polls/gone/votes/member", v);
    await assertFails(deleteDoc(voteRef("member", "one", "other")));
    await assertFails(deleteDoc(voteRef("admin", "one", "other")));
    await assertFails(deleteDoc(voteRef("member", "closed")));
    await assertSucceeds(deleteDoc(voteRef("member", "one")));
    await assertSucceeds(deleteDoc(voteRef("member", "gone"))); // la encuesta ya no está
  });
});

describe("Turnos del equipo (rotas, rotaTurns)", () => {
  const job = (over: object = {}) => ({ id: "lavar", name: "Lavar la equipación", icon: "shirt", awayOnly: false, order: ["p1", "p2"], ...over });
  const rota = (by: string, over: object = {}) => ({ jobs: [job(), job({ id: "coche", name: "Coche a los partidos fuera", icon: "car", awayOnly: true })], updatedAt: serverTimestamp(), updatedBy: by, ...over });
  const turn = (over: object = {}) => ({ playerId: "p2", swappedFrom: "p1", at: serverTimestamp(), ...over });
  it("members read them; fans and outsiders don't", async () => {
    await seed("rotas/s1", { jobs: [], updatedAt: Timestamp.fromMillis(0), updatedBy: "admin" });
    await seed("rotaTurns/m1", { lavar: { playerId: "p1", at: Timestamp.fromMillis(0) } });
    await assertSucceeds(getDoc(doc(db("member"), "rotas", "s1")));
    await assertSucceeds(getDoc(doc(db("member"), "rotaTurns", "m1")));
    await assertFails(getDoc(doc(db(), "rotas", "s1")));
    await assertFails(getDoc(doc(db("outsider"), "rotaTurns", "m1")));
  });
  it("only captains write the jobs, signed and stamped by the server; nobody deletes them", async () => {
    await assertSucceeds(setDoc(doc(db("admin"), "rotas", "s1"), rota("admin")));
    await assertSucceeds(setDoc(doc(db("super"), "rotas", "s2"), rota("super", { jobs: [] })));
    await assertFails(setDoc(doc(db("member"), "rotas", "s3"), rota("member")));
    await assertFails(setDoc(doc(db(), "rotas", "s3"), rota("x")));
    await assertFails(setDoc(doc(db("admin"), "rotas", "s3"), rota("super")));
    await assertFails(setDoc(doc(db("admin"), "rotas", "s3"), rota("admin", { updatedAt: Timestamp.fromMillis(0) })));
    await assertFails(deleteDoc(doc(db("admin"), "rotas", "s1")));
  });
  it("the jobs' shape: ≤ 6, name 1–30, a known icon, awayOnly bool, order ≤ 40, nothing else", async () => {
    const ref = (id: string) => doc(db("admin"), "rotas", id);
    const six = Array.from({ length: 6 }, (_, i) => job({ id: `j${i}`, order: Array.from({ length: 40 }, (_, k) => `p${k}`) }));
    await assertSucceeds(setDoc(ref("max"), rota("admin", { jobs: six })));
    const bad: object[] = [
      { jobs: [...six, job({ id: "j7" })] },
      { jobs: [job({ name: "" })] },
      { jobs: [job({ name: "x".repeat(31) })] },
      { jobs: [job({ icon: "rocket" })] },
      { jobs: [job({ awayOnly: "no" })] },
      { jobs: [job({ order: Array.from({ length: 41 }, (_, k) => `p${k}`) })] },
      { jobs: [job({ order: "p1" })] },
      { jobs: [job({ id: "Con Espacios" })] },
      { jobs: [job({ extra: 1 })] },
      { jobs: [{ id: "a", name: "A", icon: "shirt", awayOnly: false }] },
      { jobs: ["lavar"] },
      { jobs: "lavar" },
      { extra: true },
    ];
    for (const over of bad) await assertFails(setDoc(ref("bad"), rota("admin", over)));
  });
  it("only captains pin or swap a match's turns, with the shape; they can unpin", async () => {
    const ref = (uid: string) => doc(db(uid), "rotaTurns", "m1");
    await assertSucceeds(setDoc(ref("admin"), { lavar: turn() }));
    await assertSucceeds(setDoc(ref("admin"), { lavar: { playerId: "p3", at: serverTimestamp() } }));
    await assertSucceeds(setDoc(ref("super"), { coche: turn({ playerId: "p9" }) }, { merge: true }));
    await assertFails(setDoc(ref("member"), { lavar: turn() }));
    await assertFails(setDoc(doc(db(), "rotaTurns", "m2"), { lavar: turn() }));
    const bad: object[] = [
      { lavar: turn({ playerId: "" }) },
      { lavar: turn({ playerId: 3 }) },
      { lavar: turn({ swappedFrom: "" }) },
      { lavar: turn({ at: "ayer" }) },
      { lavar: { playerId: "p1" } },
      { lavar: turn({ extra: 1 }) },
      { lavar: "p1" },
      Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`j${i}`, turn()])),
    ];
    for (const d of bad) await assertFails(setDoc(doc(db("admin"), "rotaTurns", "bad"), d));
    await assertFails(deleteDoc(ref("member")));
    await assertSucceeds(deleteDoc(ref("admin")));
  });
});
describe("Tras el partido: reacciones y nota (matches/{id}/reactions, matches/{id}/ratings)", () => {
  const HOUR = 3_600_000;
  const DAY = 24 * HOUR;
  /** A published acta: saveMatchSheet stamps voteClosesAt = first publication + 48 h. */
  const publishedAgo = (ms: number, extra: object = {}) => ({ status: "finished", voteClosesAt: Date.now() - ms + 48 * HOUR, ...extra });
  const reaction = (who: string, moments: object, extra: object = {}) => ({ moments, name: who, playerId: null, at: serverTimestamp(), ...extra });
  const rating = (who: string, score: unknown, extra: object = {}) => ({ score, name: who, playerId: null, at: serverTimestamp(), ...extra });
  const reactionRef = (who: string | undefined, match: string, uid = who ?? "member") => doc(db(who), "matches", match, "reactions", uid);
  const ratingRef = (who: string | undefined, match: string, uid = who ?? "member") => doc(db(who), "matches", match, "ratings", uid);
  beforeEach(async () => {
    await seed("matches/pub", publishedAgo(HOUR)); // published an hour ago
    await seed("matches/late", publishedAgo(7 * DAY - HOUR)); // the nota's last hour
    await seed("matches/old", publishedAgo(7 * DAY + HOUR)); // the nota froze an hour ago
    await seed("matches/next", { status: "scheduled", date: Timestamp.fromMillis(Date.now() + DAY), voteClosesAt: null });
    await seed("matches/legacy", { status: "finished" }); // an old acta without the MVP window
    await seed("matches/sleep", publishedAgo(HOUR, { archived: true }));
    await seed("matches/gone", publishedAgo(HOUR));
    await seed("matchTombstones/gone", { at: Timestamp.now() });
  });

  it("anyone reads them, a fan and an anonymous visitor too (the counts and the average are public)", async () => {
    await seed("matches/pub/reactions/other", { moments: { g1: "fuego" }, name: "other", playerId: null, at: Timestamp.now() });
    await seed("matches/pub/ratings/other", { score: 4, name: "other", playerId: null, at: Timestamp.now() });
    for (const who of ["member", "outsider", undefined]) {
      await assertSucceeds(getDoc(reactionRef(who, "pub", "other")));
      await assertSucceeds(getDocs(collection(db(who), "matches", "pub", "reactions")));
      await assertSucceeds(getDoc(ratingRef(who, "pub", "other")));
      await assertSucceeds(getDocs(collection(db(who), "matches", "pub", "ratings")));
    }
  });

  it("reactions: a member writes, changes and deletes his own once the acta is published, at any time after", async () => {
    await assertSucceeds(setDoc(reactionRef("member", "pub"), reaction("member", { g1: "fuego", "live-abc_1": "aplauso", final: "uy" })));
    await assertSucceeds(setDoc(reactionRef("member", "pub"), reaction("member", { g1: "risa" })));
    await assertSucceeds(setDoc(reactionRef("member", "pub"), reaction("member", {})));
    await assertSucceeds(setDoc(reactionRef("member", "old"), reaction("member", { g1: "fuego" }))); // no window
    const thirty = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`e${i}`, "fuego"]));
    await assertSucceeds(setDoc(reactionRef("admin", "pub"), reaction("admin", thirty)));
    await assertSucceeds(deleteDoc(reactionRef("member", "pub")));
    await assertSucceeds(deleteDoc(reactionRef("member", "old")));
  });

  it("reactions: refused before the acta, on an archived or deleted match, and with bad values", async () => {
    for (const match of ["next", "legacy", "sleep", "gone", "nope"]) await assertFails(setDoc(reactionRef("member", match), reaction("member", { g1: "fuego" })));
    const thirtyOne = Object.fromEntries(Array.from({ length: 31 }, (_, i) => [`e${i}`, "fuego"]));
    const bad = [
      reaction("member", { g1: "corazón" }), // not one of the four
      reaction("member", { g1: 1 }),
      reaction("member", { g1: null }),
      reaction("member", thirtyOne),
      reaction("member", { "mal id": "fuego" }), // not an event id
      reaction("member", { "g1.x": "fuego" }),
      reaction("member", { ["x".repeat(129)]: "fuego" }),
      reaction("member", { e0: "fuego", e1: "fuego", e2: "fuego", e3: "fuego", e4: "fuego", e5: "fuego", e6: "fuego", e7: "fuego", e8: "fuego", e9: "fuego", e10: "fuego", e11: "fuego", e12: "fuego", e13: "fuego", e14: "fuego", e15: "fuego", e16: "fuego", e17: "fuego", e18: "fuego", e19: "fuego", e20: "fuego", e21: "fuego", e22: "fuego", e23: "fuego", e24: "fuego", e25: "fuego", e26: "fuego", e27: "fuego", e28: "fuego", "e 29": "fuego" }), // the 30th key is checked too
      reaction("member", ["fuego"] as unknown as object),
      reaction("member", { g1: "fuego" }, { extra: true }),
      reaction("member", { g1: "fuego" }, { name: "other" }), // signed as someone else
      reaction("member", { g1: "fuego" }, { playerId: "erik" }), // not his ficha
      reaction("member", { g1: "fuego" }, { at: Timestamp.now() }), // not the server's time
    ];
    for (const data of bad) await assertFails(setDoc(reactionRef("member", "pub"), data));
    const noMoments = Object.fromEntries(Object.entries(reaction("member", {})).filter(([k]) => k !== "moments"));
    await assertFails(setDoc(reactionRef("member", "pub"), noMoments));
  });

  it("reactions: nobody writes or deletes another's; a fan or an anonymous visitor writes nothing", async () => {
    await seed("matches/pub/reactions/other", { moments: { g1: "fuego" }, name: "other", playerId: null, at: Timestamp.now() });
    await assertFails(setDoc(reactionRef("member", "pub", "other"), reaction("member", { g1: "uy" })));
    await assertFails(setDoc(reactionRef("member", "pub", "other"), reaction("other", { g1: "uy" })));
    await assertFails(deleteDoc(reactionRef("member", "pub", "other")));
    await assertFails(deleteDoc(reactionRef("admin", "pub", "other")));
    await assertFails(setDoc(reactionRef("outsider", "pub"), reaction("outsider", { g1: "fuego" })));
    await assertFails(setDoc(reactionRef(undefined, "pub", "anon"), reaction("anon", { g1: "fuego" })));
    await seed("matches/pub/reactions/outsider", { moments: {}, name: "outsider", playerId: null, at: Timestamp.now() });
    await assertFails(deleteDoc(reactionRef("outsider", "pub")));
  });

  it("the nota: a member rates 1–5, changes and takes it back for 7 days from the publication", async () => {
    await assertSucceeds(setDoc(ratingRef("member", "pub"), rating("member", 1)));
    await assertSucceeds(setDoc(ratingRef("member", "pub"), rating("member", 5)));
    await assertSucceeds(deleteDoc(ratingRef("member", "pub")));
    await assertSucceeds(setDoc(ratingRef("member", "late"), rating("member", 3)));
    await assertSucceeds(deleteDoc(ratingRef("member", "late")));
  });

  it("the nota: closed after 7 days (no rating, change or removal), before the acta, and on an archived or deleted match", async () => {
    await seed("matches/old/ratings/member", { score: 4, name: "member", playerId: null, at: Timestamp.now() });
    await assertFails(setDoc(ratingRef("member", "old"), rating("member", 5)));
    await assertFails(setDoc(ratingRef("other", "old"), rating("other", 5)));
    await assertFails(deleteDoc(ratingRef("member", "old")));
    for (const match of ["next", "legacy", "sleep", "gone", "nope"]) await assertFails(setDoc(ratingRef("member", match), rating("member", 4)));
  });

  it("the nota: a whole 1–5, signed by the member himself, nothing else", async () => {
    for (const score of [0, 6, -1, 3.5, "4", null]) await assertFails(setDoc(ratingRef("member", "pub"), rating("member", score)));
    await assertFails(setDoc(ratingRef("member", "pub"), rating("member", 4, { extra: true })));
    await assertFails(setDoc(ratingRef("member", "pub"), rating("member", 4, { name: "other" })));
    await assertFails(setDoc(ratingRef("member", "pub"), rating("member", 4, { playerId: "erik" })));
    await assertFails(setDoc(ratingRef("member", "pub"), rating("member", 4, { at: Timestamp.now() })));
    const noScore = Object.fromEntries(Object.entries(rating("member", 4)).filter(([k]) => k !== "score"));
    await assertFails(setDoc(ratingRef("member", "pub"), noScore));
  });

  it("the nota: nobody rates or removes another's; a fan or an anonymous visitor writes nothing", async () => {
    await seed("matches/pub/ratings/other", { score: 2, name: "other", playerId: null, at: Timestamp.now() });
    await assertFails(setDoc(ratingRef("member", "pub", "other"), rating("member", 5)));
    await assertFails(setDoc(ratingRef("member", "pub", "other"), rating("other", 5)));
    await assertFails(deleteDoc(ratingRef("member", "pub", "other")));
    await assertFails(deleteDoc(ratingRef("admin", "pub", "other")));
    await assertFails(setDoc(ratingRef("outsider", "pub"), rating("outsider", 5)));
    await assertFails(setDoc(ratingRef(undefined, "pub", "anon"), rating("anon", 5)));
    await seed("matches/pub/ratings/outsider", { score: 3, name: "outsider", playerId: null, at: Timestamp.now() });
    await assertFails(deleteDoc(ratingRef("outsider", "pub")));
  });
});
