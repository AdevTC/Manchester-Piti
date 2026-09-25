import { useEffect, useState } from "react";
import type { StillRequest } from "./scene";
import { STILL_VERSION } from "./scene-constants";

// Photos of the real kit (rendered once per name/number/kit/theme/angle). They are kept on
// the device (Cache Storage), so later visits show them at once without loading three.js.
const urls = new Map<string, string>();
let failed = false;
const SEP = "\u001f";
export const stillKey = (r: StillRequest) => [r.kit, r.theme, r.name, r.num, r.yaw ?? 0].join(SEP);
const parse = (k: string): StillRequest => {
  const [kit, theme, name, num, yaw] = k.split(SEP);
  return { kit: kit as StillRequest["kit"], theme: theme as StillRequest["theme"], name, num, yaw: Number(yaw) };
};

const CACHE = `piti-stills-v${STILL_VERSION}`;
// Cache Storage keys are URLs; this one is never fetched, it only names the photo.
const cacheUrl = (k: string) => `/__stills/${encodeURIComponent(k)}`;
let store: Promise<Cache | null> | null = null;
function openStore() {
  store ??= (async () => {
    try {
      if (!("caches" in window)) return null;
      // Drop the photos of older versions of the kit.
      for (const name of await caches.keys()) if (name.startsWith("piti-stills-") && name !== CACHE) void caches.delete(name);
      return await caches.open(CACHE);
    } catch {
      return null; // private mode or storage disabled: render every visit
    }
  })();
  return store;
}
async function fromStore(k: string) {
  try {
    const hit = await (await openStore())?.match(cacheUrl(k));
    return hit ? URL.createObjectURL(await hit.blob()) : null;
  } catch {
    return null;
  }
}
async function toStore(k: string, blob: Blob) {
  try {
    await (await openStore())?.put(cacheUrl(k), new Response(blob, { headers: { "content-type": blob.type } }));
  } catch {
    /* quota or storage disabled: the photo stays for this visit only */
  }
}
/** Rendering waits until the page is idle, so it never competes with the first paint. */
const whenIdle = () =>
  new Promise<void>((ok) => ("requestIdleCallback" in window ? requestIdleCallback(() => ok(), { timeout: 1500 }) : setTimeout(ok, 200)));

/** Returns a lookup for the stills of `reqs`; missing ones come from the device or render in the background, in order. */
export function useShirtStills(reqs: StillRequest[]) {
  const [, bump] = useState(0);
  const keys = reqs.map(stillKey).join("\n");
  useEffect(() => {
    if (failed || !keys) return;
    const todo = keys.split("\n").filter((k) => !urls.has(k));
    if (!todo.length) return;
    let cancelled = false;
    (async () => {
      const cached = await Promise.all(todo.map(fromStore));
      const missing: string[] = [];
      cached.forEach((url, i) => {
        if (url && !urls.has(todo[i])) urls.set(todo[i], url);
        else if (!url) missing.push(todo[i]);
      });
      if (!cancelled && missing.length < todo.length) bump((n) => n + 1);
      if (!missing.length) return;
      await whenIdle();
      const { renderStill } = await import("./scene");
      for (const k of missing) {
        if (cancelled) return;
        if (urls.has(k)) continue;
        const blob = await renderStill(parse(k));
        urls.set(k, URL.createObjectURL(blob));
        void toStore(k, blob);
        if (!cancelled) bump((n) => n + 1);
      }
    })().catch((error: unknown) => {
      console.error("No se han podido preparar las camisetas:", error);
      failed = true;
      if (!cancelled) bump((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [keys]);
  return (r: StillRequest) => urls.get(stillKey(r));
}
