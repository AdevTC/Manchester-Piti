// Public data as a Firestore bundle (/datos/club.bundle via the Vercel rewrite): the page starts
// downloading it from the HTML, in parallel with the JavaScript, and loads it into the local cache.
// The first paint then has data without waiting for a Firestore connection; the realtime listeners
// take over right after. Vercel's CDN caches it, so building it (one read per document) is rare.
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

// One build per warm instance per half minute, whatever the CDN does.
let memo: { at: number; body: Promise<Buffer> } | null = null;
const MEMO_MS = 30_000;

export const clubBundle = onRequest({ memory: "256MiB", maxInstances: 3 }, async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.status(405).end();
    return;
  }
  if (!memo || Date.now() - memo.at > MEMO_MS) memo = { at: Date.now(), body: build() };
  try {
    const body = await memo.body;
    res.set("Content-Type", "application/octet-stream");
    // Browsers revalidate after a minute; Vercel's CDN keeps it 5 minutes and serves the old copy
    // while it refreshes. Listeners correct anything newer within the second.
    res.set("Cache-Control", "public, max-age=60");
    res.set("CDN-Cache-Control", "max-age=300, stale-while-revalidate=86400");
    res.set("Vercel-Cache-Tag", "club-bundle");
    res.send(body);
  } catch (error) {
    memo = null;
    console.error("clubBundle", error);
    res.status(500).set("Cache-Control", "no-store").end();
  }
});
