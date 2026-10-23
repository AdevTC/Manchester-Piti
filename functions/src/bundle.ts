// Public data as a Firestore bundle (/datos/club.bundle via the Vercel rewrite): the page starts
// downloading it from the HTML, in parallel with the JavaScript, and loads it into the local cache.
// The first paint then has data without waiting for a Firestore connection; the realtime listeners
// take over right after. Every request reflects current archival/deletion state; a cached snapshot
// must not make removed matches reappear before the realtime listener connects.
import { gzipSync } from "node:zlib";
import { onRequest } from "firebase-functions/v2/https";
import { db } from "./common.js";

/** Same queries the app listens to (clubData, SeasonContext, live.ts, useStandings), so the cache serves them at once. */
async function build() {
  const [matches, players, seasons, mvpResults, standings, content] = await Promise.all([
    db.collection("matches").orderBy("date", "desc").get(),
    db.collection("players").get(),
    db.collection("seasons").orderBy("name", "asc").get(),
    db.collection("mvpResults").get(),
    db.collection("standings").get(),
    db.doc("clubContent/main").get(),
  ]);
  const bundle = db
    .bundle("club-publico")
    .add("matches", matches)
    .add("players", players)
    .add("seasons", seasons)
    .add("mvpResults", mvpResults)
    .add("standings", standings);
  if (content.exists) bundle.add(content);
  return bundle.build();
}

export const clubBundle = onRequest({ memory: "512MiB", maxInstances: 3 }, async (req, res) => {
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
    // ~1 MB of JSON text squeezes to ~55 KB: the repeat visits (the service worker refreshes it on each one)
    // and the server render download that instead.
    res.set("Vary", "Accept-Encoding");
    if (/\bgzip\b/.test(String(req.headers["accept-encoding"] ?? ""))) {
      res.set("Content-Encoding", "gzip");
      res.send(gzipSync(body, { level: 6 }));
      return;
    }
    res.send(body);
  } catch (error) {
    console.error("clubBundle", error);
    res.status(500).set("Cache-Control", "no-store").end();
  }
});
