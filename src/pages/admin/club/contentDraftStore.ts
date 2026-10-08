// The content drafts on this device (localStorage, one key per captain), as an external store: every
// reader re-renders on a change, other tabs included (the `storage` event). Reading or writing storage
// never throws (private mode, blocked storage): the drafts then live in memory for the session.
import { useCallback, useSyncExternalStore } from "react";
import { NO_DRAFTS, parseDrafts, type Drafts } from "./contentModel";

const PREFIX = "mp.admin.contentDrafts.v1:";
const memory = new Map<string, Drafts>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function read(key: string): Drafts {
  const cached = memory.get(key);
  if (cached) return cached;
  let d = NO_DRAFTS;
  try {
    d = parseDrafts(localStorage.getItem(key));
  } catch {
    d = NO_DRAFTS;
  }
  memory.set(key, d);
  return d;
}
function write(key: string, d: Drafts) {
  memory.set(key, d);
  try {
    if (!Object.keys(d.club).length && !Object.keys(d.stories).length) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(d));
  } catch {
    // storage unavailable: the drafts stay in memory for this session
  }
  emit();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (!e.key?.startsWith(PREFIX)) return;
    memory.delete(e.key);
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** This captain's content drafts and a functional updater. */
export function useContentDrafts(uid: string | undefined): [Drafts, (update: (d: Drafts) => Drafts) => void] {
  const key = `${PREFIX}${uid ?? "anon"}`;
  const drafts = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => NO_DRAFTS,
  );
  const update = useCallback((fn: (d: Drafts) => Drafts) => write(key, fn(read(key))), [key]);
  return [drafts, update];
}
/** Tests: forget the in-memory copies (localStorage.clear() alone keeps them). */
export function resetContentDraftsForTests() {
  memory.clear();
}
