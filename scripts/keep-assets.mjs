// After a production build on Vercel: copies the hashed files of the previous deploys (last few days) into this
// one, so a tab still running the previous version keeps loading its own chunks after a deploy instead of
// failing (or reloading) on its next navigation. Hashed names never collide, so nothing of the new version is
// touched and the service worker's precache (already generated) only lists the new files.
// dist/assets-kept.json records which files each deploy served (and when), for the next build to read.
// Any failure only logs: the build never depends on the previous deploy being reachable.
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIST = "dist";
const ASSETS = join(DIST, "assets");
const MANIFEST = "assets-kept.json";
/** How long a file of an older deploy stays reachable after the last deploy that served it. */
const KEEP_MS = 3 * 24 * 3600 * 1000;
const now = Date.now();

const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
const production = process.env.VERCEL === "1" && process.env.VERCEL_ENV === "production" && !!host;

/** The files this build serves, with the time they were last served (now). */
const current = Object.fromEntries(readdirSync(ASSETS).map((f) => [f, now]));

/** The previous deploys' files still worth keeping: { file: lastServedAt }. */
async function previous() {
  if (!production) return {};
  try {
    const res = await fetch(`https://${host}/${MANIFEST}`, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return {};
    const json = await res.json();
    return Object.fromEntries(Object.entries(json).filter(([f, at]) => typeof at === "number" && now - at < KEEP_MS && /^[\w.-]+$/.test(f)));
  } catch (e) {
    console.log(`keep-assets: no previous manifest (${e instanceof Error ? e.message : e})`);
    return {};
  }
}

async function copy(files) {
  let ok = 0;
  const queue = [...files];
  const worker = async () => {
    for (let f = queue.shift(); f; f = queue.shift()) {
      try {
        const res = await fetch(`https://${host}/assets/${f}`, { signal: AbortSignal.timeout(15_000) });
        if (!res.ok) continue;
        writeFileSync(join(ASSETS, f), Buffer.from(await res.arrayBuffer()));
        ok++;
      } catch {
        // gone or unreachable: that old tab will reload once (vite:preloadError), as before
      }
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  return ok;
}

const old = await previous();
const missing = Object.keys(old).filter((f) => !(f in current) && !existsSync(join(ASSETS, f)));
const copied = missing.length ? await copy(missing) : 0;
const kept = Object.fromEntries(Object.entries(old).filter(([f]) => !(f in current) && existsSync(join(ASSETS, f))));
writeFileSync(join(DIST, MANIFEST), JSON.stringify({ ...kept, ...current }));
console.log(production ? `keep-assets: ${copied} of ${missing.length} previous files kept` : "keep-assets: not a production build on Vercel, nothing to keep");
