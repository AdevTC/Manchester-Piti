// The public listeners open once the data bundle is in the local cache, not while it loads.
// Loading a bundle saves each of its named queries (matches, players, seasons…) as a target that a
// listen of the same query resumes from. If that listen is already open, the SDK rewrites its live
// target with the bundle's read time and documents (localStoreSaveNamedQuery), and the server's first
// answer then comes back as a synced, EMPTY snapshot: the page painted «Próximo partido por confirmar»
// and «Todo por estrenar» for about 1.5 s until Firestore noticed and sent the real list. Opened after
// the bundle, the same listen starts from it: its first snapshot is the bundle's documents.
// No Firebase import here, so the listener registry stays testable without a Firestore client.

let pending: Promise<void> | null = null;

/**
 * Holds `afterBundle` openings until `load` settles (loaded or failed) or `maxMs` pass, whichever is
 * first: a slow or hung bundle never keeps the listeners closed for longer than that.
 */
export function holdListenersFor(load: Promise<unknown>, maxMs: number): void {
  const gate: Promise<void> = Promise.race([
    load.then(
      () => undefined,
      () => undefined,
    ),
    new Promise<void>((resolve) => setTimeout(resolve, maxMs)),
  ]).then(() => {
    if (pending === gate) pending = null;
  });
  pending = gate;
}

/**
 * Runs `open` (an onSnapshot that returns its unsubscribe) now, or once the bundle has settled. The
 * returned function stops it either way: before it opened, it is never opened.
 */
export function afterBundle(open: () => () => void): () => void {
  if (!pending) return open();
  let stop: (() => void) | null = null;
  let cancelled = false;
  void pending.then(() => {
    if (!cancelled) stop = open();
  });
  return () => {
    cancelled = true;
    stop?.();
  };
}

/** Test-only: no bundle pending. */
export function _resetBundleGateForTesting(): void {
  pending = null;
}
