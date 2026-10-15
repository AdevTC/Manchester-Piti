// Public data as a Firestore bundle (/datos/club.bundle via the Vercel rewrite): the page starts
// downloading it from the HTML, in parallel with the JavaScript, and loads it into the local cache.
// The first paint then has data without waiting for a Firestore connection; the realtime listeners
// take over right after. Every request reflects current archival/deletion state; a cached snapshot
// must not make removed matches reappear before the realtime listener connects.
import { onRequest } from "firebase-functions/v2/https";
import { db } from "./common.js";

/** Same queries the app listens to (clubData, SeasonContext, live.ts), so the cache serves them at once. */
async function build() {
  const [matches, players, seasons, mvpResults, content] = await Promise.all([
    db.collection("matches").orderBy("date", "desc").get(),
    db.collection("players").get(),
    db.collection("seasons").orderBy("name", "asc").get(),
    db.collection("mvpResults").get(),
    db.doc("clubContent/main").get(),
  ]);
  const bundle = db
    .bundle("club-publico")
    .add("matches", matches)
    .add("players", players)
    .add("seasons", seasons)
    .add("mvpResults", mvpResults);
  if (content.exists) bundle.add(content);
  return bundle.build();
}

export const clubBundle = onRequest({ memory: "256MiB", maxInstances: 3 }, async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.status(405).end();
    return;
  }
  try {
    const body = await build();
    res.set("Content-Type", "application/octet-stream");
    res.set("Cache-Control", "no-store");
    res.set("CDN-Cache-Control", "no-store");
    res.set("Vercel-Cache-Tag", "club-bundle");
    res.send(body);
  } catch (error) {
    console.error("clubBundle", error);
    res.status(500).set("Cache-Control", "no-store").end();
  }
});
