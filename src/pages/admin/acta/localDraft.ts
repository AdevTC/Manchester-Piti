// Local draft recovery (pure over a Storage): every edit of an unsaved acta / convocatoria is mirrored to
// localStorage per match, with the signature of the version it started from. Reopening the match offers
// «Recuperar cambios sin guardar de hh:mm» only when that base is still the current version (otherwise
// someone saved since: the mirror is stale and is dropped). Saving or discarding clears it.
export interface StoredDraft<T> {
  /** When the last edit was mirrored (ms). */
  at: number;
  /** sig() of the version the edits started from. */
  base: string;
  value: T;
}

const PREFIX = "mp-admin:";
export const draftKey = (kind: "acta" | "conv", matchId: string) => `${PREFIX}${kind}:${matchId}`;

/** localStorage, or null where it throws (private mode, blocked storage). */
export function safeStorage(): Storage | null {
  try {
    const s = globalThis.localStorage;
    return s ?? null;
  } catch {
    return null;
  }
}

export function readDraft<T>(key: string, isValue: (v: unknown) => v is T, storage: Storage | null = safeStorage()): StoredDraft<T> | null {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return null;
    const d: unknown = JSON.parse(raw);
    if (!d || typeof d !== "object") return null;
    const o = d as Record<string, unknown>;
    if (typeof o.at !== "number" || typeof o.base !== "string" || !isValue(o.value)) return null;
    return { at: o.at, base: o.base, value: o.value };
  } catch {
    return null;
  }
}
export function writeDraft<T>(key: string, d: StoredDraft<T>, storage: Storage | null = safeStorage()): void {
  try {
    storage?.setItem(key, JSON.stringify(d));
  } catch {
    /* full or blocked storage: recovery is a convenience */
  }
}
export function clearDraft(key: string, storage: Storage | null = safeStorage()): void {
  try {
    storage?.removeItem(key);
  } catch {
    /* blocked storage */
  }
}

/** The stored edits worth offering: same base as now, and different from it. */
export function recoverable<T>(stored: StoredDraft<T> | null, baseSig: string, sigOf: (v: T) => string): StoredDraft<T> | null {
  if (!stored || stored.base !== baseSig) return null;
  return sigOf(stored.value) === baseSig ? null : stored;
}
