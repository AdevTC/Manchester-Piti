import { useEffect, useMemo, useState } from "react";
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
/**
 * Re-renders at most once per animation frame: the first request at once, any later ones of that frame together
 * when it ends (a squad's stills arriving back to back re-render the page once, not once each).
 */
function frameThrottle(fn: () => void) {
  let raf = 0;
  let again = false;
  const tick = () => {
    raf = 0;
    if (!again) return;
    again = false;
    fn();
    raf = requestAnimationFrame(tick);
  };
  return {
    run() {
      if (raf) {
        again = true;
        return;
      }
      fn();
      raf = requestAnimationFrame(tick);
    },
    cancel() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      again = false;
    },
  };
}
/** The lookup a version hands out: a new function only when the stills changed, so memoized readers can skip. */
const lookupAt = (_version: number) => (r: StillRequest) => urls.get(stillKey(r));

/** Rendering waits until the page is idle, so it never competes with the first paint. */
const whenIdle = () =>
  new Promise<void>((ok) => ("requestIdleCallback" in window ? requestIdleCallback(() => ok(), { timeout: 1500 }) : setTimeout(ok, 200)));

/**
 * Returns a lookup for the stills of `reqs`; missing ones come from the device or render in the background, in order.
 * `offMainThread`: render them in a Web Worker (worth it for a whole squad; it has its own copy of three.js,
 * so a page that renders one or two stills next to a live jersey is better off on the main thread).
 */
export function useShirtStills(reqs: StillRequest[], { offMainThread = false } = {}) {
  const [version, bump] = useState(0);
  const [refresh] = useState(() => frameThrottle(() => bump((n) => n + 1)));
  useEffect(() => refresh.cancel, [refresh]);
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
      if (!cancelled && missing.length < todo.length) refresh.run();
      if (!missing.length) return;
      await whenIdle();
      const render = offMainThread
        ? (await import("./stillsClient")).renderStillFast
        : (await import("./scene")).renderStill;
      for (const k of missing) {
        if (cancelled) return;
        // (another page or shirt got it first: show it here too)
        if (urls.has(k)) {
          refresh.run();
          continue;
        }
        const blob = await render(parse(k));
        urls.set(k, URL.createObjectURL(blob));
        void toStore(k, blob);
        if (!cancelled) refresh.run();
      }
    })().catch((error: unknown) => {
      console.error("No se han podido preparar las camisetas:", error);
      failed = true;
      if (!cancelled) refresh.run();
    });
    return () => {
      cancelled = true;
    };
    // offMainThread is fixed per call site
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys]);
  return useMemo(() => lookupAt(version), [version]);
}
