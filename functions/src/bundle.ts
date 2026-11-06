// Public data as a Firestore bundle (/datos/club.bundle via the Vercel rewrite): the page starts
// downloading it from the HTML, in parallel with the JavaScript, and loads it into the local cache.
// The first paint then has data without waiting for a Firestore connection; the realtime listeners
// take over right after. Every request reflects current archival/deletion state; a cached snapshot
// must not make removed matches reappear before the realtime listener connects.
import { gzipSync } from "node:zlib";
import { onRequest } from "firebase-functions/v2/https";
import { db } from "./common.js";

/** Same queries the app listens to (clubData, SeasonContext, live.ts, useStandings: src/lib/publicData opens each by its
 *  name here, namedQuery), so the cache serves them at once and the listeners resume from the bundle's read time. The
 *  matches' analyses are not in it (matchAnalysis/{id}, analysisPlace.ts): once the move's second step has taken them
 *  out of the match documents, this bundle is ~0.26 MB instead of ~1.9. */
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

/** The matches' narrated analyses (matchAnalysis/{id}), for the pages that show them (src/lib/matchAnalyses): its
 *  named query «matchAnalysis» is the one their listener opens. */
async function buildAnalyses() {
  const analyses = await db.collection("matchAnalysis").get();
  return db.bundle("club-analisis").add("matchAnalysis", analyses).build();
}

type Req = Parameters<Parameters<typeof onRequest>[0]>[0];
type Res = Parameters<Parameters<typeof onRequest>[0]>[1];
/** Answers a bundle: compressed for whoever accepts it, never cached here (the CDN keeps it: api/bundle.js). */
async function answer(req: Req, res: Res, what: string, make: () => Promise<Buffer>) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.status(405).end();
    return;
  }
  try {
    const body = await make();
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
    console.error(what, error);
    res.status(500).set("Cache-Control", "no-store").end();
  }
}

export const clubBundle = onRequest({ memory: "512MiB", maxInstances: 3 }, (req, res) => answer(req, res, "clubBundle", build));
export const clubAnalysisBundle = onRequest({ memory: "512MiB", maxInstances: 3 }, (req, res) => answer(req, res, "clubAnalysisBundle", buildAnalyses));
