import { useEffect, useMemo, useState } from "react";
import type { StillRequest } from "./scene";
import { STILL_VERSION } from "./scene-constants";

// Photos of the real kit (rendered once per name/number/kit/theme/angle). They are kept on
// the device (Cache Storage), so later visits show them at once without loading three.js.
const urls = new Map<string, string>();
// Each mounted hook holds the stills it asks for. The ones nobody holds stay for a while (a page and back), oldest
// first out past KEEP_UNHELD: their object URLs are revoked, so a long session (names typed in the shirt maker,
// a squad in two themes) does not pile up photos. A held still is never revoked: an <img> on screen may use it.
const held = new Map<string, number>();
const KEEP_UNHELD = 48;
function hold(keys: string[]) {
  for (const k of keys) held.set(k, (held.get(k) ?? 0) + 1);
}
function letGo(keys: string[]) {
  for (const k of keys) {
    const n = (held.get(k) ?? 0) - 1;
    if (n > 0) {
      held.set(k, n);
      continue;
    }
    held.delete(k);
    // the newest unheld goes to the back of the line
    const url = urls.get(k);
    if (url === undefined) continue;
    urls.delete(k);
    urls.set(k, url);
  }
  // (after the commit's other effects: a hook whose list changed, or the next page's, holds its stills first)
  queueMicrotask(trim);
}
function trim() {
  let unheld = 0;
  for (const k of urls.keys()) if (!held.has(k)) unheld++;
  for (const [k, url] of urls) {
    if (unheld <= KEEP_UNHELD) return;
    if (held.has(k)) continue;
    URL.revokeObjectURL(url);
    urls.delete(k);
    unheld--;
  }
}
/** Keeps the first URL made for a still (another page or shirt may have got it meanwhile): a later one is revoked. */
function keep(k: string, url: string) {
  if (urls.has(k)) URL.revokeObjectURL(url);
  else urls.set(k, url);
  trim();
}
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

/** Stills sent for ahead of the page that shows them (warmStills): its hook waits for them instead of rendering them
 *  again. Each one settles once it is in `urls` (or failed: the hook then makes it itself). */
const coming = new Map<string, Promise<void>>();

/**
 * Sends for a page's first stills before the page can ask: from its route, while its code loads and React takes the
 * page the server painted over (Plantilla's hanging shirts, its largest paint). From the device, or rendered in the
 * Web Worker at once instead of when the page is idle; useShirtStills shows them as soon as they land. The same
 * stills as the page's own, only sooner. Nothing on the server, nothing once stills have failed here.
 */
export function warmStills(reqs: readonly StillRequest[]): void {
  if (typeof window === "undefined" || failed) return;
  for (const r of reqs) {
    const k = stillKey(r);
    if (urls.has(k) || coming.has(k)) continue;
    const job = (async () => {
      // (the worker's code is sent for while the device is asked)
      const client = import("./stillsClient");
      client.catch(() => undefined);
      const cached = await fromStore(k);
      if (cached) return keep(k, cached);
      const blob = await (await client).renderStillFast(parse(k));
      keep(k, URL.createObjectURL(blob));
      void toStore(k, blob);
    })()
      // (the page's own hook tries again, and says so if it fails too)
      .catch(() => undefined)
      .finally(() => coming.delete(k));
    coming.set(k, job);
  }
}

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
    if (!keys) return;
    const list = keys.split("\n");
    hold(list);
    return () => letGo(list);
  }, [keys]);
  useEffect(() => {
    if (failed || !keys) return;
    const wanted = keys.split("\n").filter((k) => !urls.has(k));
    if (!wanted.length) return;
    let cancelled = false;
    // (the ones already on their way, warmStills: shown when they land, not made again)
    for (const k of wanted)
      void coming.get(k)?.then(() => {
        if (!cancelled && urls.has(k)) refresh.run();
      });
    const todo = wanted.filter((k) => !coming.has(k));
    (async () => {
      if (!todo.length) return;
      const cached = await Promise.all(todo.map(fromStore));
      const missing: string[] = [];
      cached.forEach((url, i) => {
        if (url) keep(todo[i], url);
        else missing.push(todo[i]);
      });
      if (!cancelled && missing.length < todo.length) refresh.run();
      if (!missing.length) return;
      await whenIdle();
      const render = offMainThread
        ? (await import("./stillsClient")).renderStillFast
        : (await import("./scene")).renderStill;
      for (const k of missing) {
        if (cancelled) return;
        // (another page or shirt got it first, or it was sent for ahead meanwhile: show it here too)
        await coming.get(k);
        if (cancelled) return;
        if (urls.has(k)) {
          refresh.run();
          continue;
        }
        const blob = await render(parse(k));
        keep(k, URL.createObjectURL(blob));
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
