import { readFileSync } from "node:fs";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
const { initializeApp } = await import("firebase-admin/app");
const { getFirestore } = await import("firebase-admin/firestore");
initializeApp({ projectId: "demo-manchester-piti" });
const db = getFirestore();
const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const fake =
  b({ alg: "none", typ: "JWT" }) +
  "." +
  b({
    sub: "preview-admin",
    email: "admin@piti.test",
    email_verified: true,
    name: "Administrador de pruebas",
    aud: "demo",
    iss: "https://accounts.google.com",
  }) +
  ".";
const res = await fetch(
  "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=demo",
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      postBody: new URLSearchParams({
        id_token: fake,
        providerId: "google.com",
      }).toString(),
      requestUri: "http://localhost",
      returnSecureToken: true,
    }),
  },
);
const user = await res.json();
if (!user.idToken) throw new Error("No se pudo crear la cuenta de prueba.");
await db
  .doc("users/" + user.localId)
  .set({
    email: "admin@piti.test",
    nickname: "capitan",
    role: "admin",
    createdAt: new Date(),
  });
const secret = readFileSync(
  new URL("../.secret.local", import.meta.url),
  "utf8",
)
  .trim()
  .split("=")
  .slice(1)
  .join("=");
const call = async (name, data) => {
  const r = await fetch(
    "http://127.0.0.1:5001/demo-manchester-piti/us-central1/" + name,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer " + user.idToken,
      },
      body: JSON.stringify({ data }),
    },
  );
  const json = await r.json();
  if (json.error) throw new Error(JSON.stringify(json));
  return json.result;
};
await call("enterTeam", { password: secret });
await db
  .doc("seasons/preview-season")
  .set({ name: "Temporada 2026/27 · Prueba" });
const names = [
  "Álex",
  "Dani",
  "Marcos",
  "Pablo",
  "Sergio",
  "David",
  "Mario",
  "Hugo",
  "Lucas",
  "Nico",
];
const ids = names.map((_, i) => "preview-player-" + i);
for (let i = 0; i < ids.length; i++)
  await db
    .doc("players/" + ids[i])
    .set({
      firstName: names[i],
      shirtName: names[i],
      number: i + 1,
      seasons: ["preview-season"],
      active: true,
      naturalPosition:
        i === 0 ? "Portero" : i < 3 ? "Defensa" : i < 6 ? "Medio" : "Delantero",
    });
const base = {
  version: 2,
  seasonId: "preview-season",
  rival: "Atlético Demo",
  competition: "Liga · Datos de prueba",
  date: Date.now() + 86400000,
  duration: 60,
  venue: "Campo de pruebas",
  home: true,
  status: "scheduled",
  starters: ids.slice(0, 7),
  bench: ids.slice(7, 9),
  notCalled: [ids[9]],
  events: [],
  goalsFor: 0,
  goalsAgainst: 0,
  report: "",
  meetingNote: "Quedamos 30 minutos antes. Traed la camiseta celeste.",
};
for (const [id, sheet] of [
  ["preview-next", base],
  [
    "preview-finished",
    {
      ...base,
      status: "finished",
      date: Date.now() - 7200000,
      goalsFor: 2,
      goalsAgainst: 1,
      report:
        "Partido ficticio para probar las actas, los minutos y las votaciones.",
      events: [
        {
          id: "goal1",
          type: "goal",
          minute: 10,
          playerId: ids[6],
          assistPlayerId: ids[3],
        },
        {
          id: "change",
          type: "substitution",
          minute: 20,
          playerId: ids[4],
          inPlayerId: ids[7],
        },
        { id: "rival", type: "opponent_goal", minute: 33 },
        { id: "goal2", type: "goal_freekick", minute: 47, playerId: ids[7] },
      ],
    },
  ],
]) {
  const old = await db.doc("matches/" + id).get();
  await call("saveMatchSheet", {
    id,
    sheet: { ...sheet, revision: old.get("revision") ?? 0 },
    draft: false,
  });
}
console.log(
  "Vista de pruebas preparada: Google de prueba, temporada 2026/27, próximo encuentro y acta finalizada.",
);
await db.terminate();
