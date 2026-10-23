// Firebase after the first paint. The page paints from the data bundle without it (lib/publicSeed); the SDK
// (lib/fbSdk, about a third of the app's start-up code) loads when the page first needs it — its listeners,
// opened once React has painted, or a tap that writes — instead of before anything shows. No Firebase import
// here: whatever imports this stays out of the SDK's chunk.
import type { HttpsCallableOptions, HttpsCallableResult } from "firebase/functions";

export type Fb = typeof import("./fbSdk");

let sdk: Fb | null = null;
let loading: Promise<Fb> | null = null;
const onLoad: ((fb: Fb) => void)[] = [];
const waiting = new Set<(fb: Fb) => void>();

/** Runs once the SDK is in, before any listener opens (lib/bundle: the bundle into the local cache first). */
export function beforeListeners(run: (fb: Fb) => void): void {
  if (sdk) run(sdk);
  else onLoad.push(run);
}

/** The SDK, loading it if nobody has yet. */
export function loadFirebase(): Promise<Fb> {
  loading ??= import("./fbSdk").then((m) => {
    sdk = m;
    for (const run of onLoad.splice(0)) run(m);
    for (const open of [...waiting]) open(m);
    waiting.clear();
    return m;
  });
  return loading;
}

/** The SDK if it's in (a sign-in popup must open in the tap itself, without waiting), else null. */
export const firebaseNow = (): Fb | null => sdk;

/** Runs `run` with the SDK: in the same tick if it's in (a write reaches the local cache, and every open
 *  listener, at once), else once it has loaded. */
export function viaFirebase<T>(run: (fb: Fb) => T | PromiseLike<T>): Promise<T> {
  if (!sdk) return loadFirebase().then(run);
  try {
    return Promise.resolve(run(sdk));
  } catch (error) {
    return Promise.reject(error);
  }
}

/**
 * Runs `open` (a listener that returns its unsubscribe) with the SDK: now if it's in, else once it is (and
 * starts loading it). The returned function stops it either way: before it opened, it is never opened.
 */
export function withFirebase(open: (fb: Fb) => () => void): () => void {
  if (sdk) return open(sdk);
  let stop: (() => void) | null = null;
  let cancelled = false;
  const run = (fb: Fb) => {
    if (!cancelled) stop = open(fb);
  };
  waiting.add(run);
  void loadFirebase();
  return () => {
    cancelled = true;
    waiting.delete(run);
    stop?.();
  };
}

/** A callable of the club's functions, loading the SDK on the first call (same call and answer as httpsCallable). */
export function lazyCallable<Req = unknown, Res = unknown>(name: string, options?: HttpsCallableOptions): (data: Req) => Promise<HttpsCallableResult<Res>> {
  return (data) => loadFirebase().then((fb) => fb.httpsCallable<Req, Res>(fb.functions, name, options)(data));
}

/** Test-only: forget the loaded SDK. */
export function _resetFirebaseForTesting(): void {
  sdk = null;
  loading = null;
  onLoad.length = 0;
  waiting.clear();
}
