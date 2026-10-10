// «Pitar el final» on this device: the matches whose end a captain whistled before the clock did (Hoy
// leaves «En juego» for «Después»). localStorage, as an external store (other tabs follow through the
// `storage` event); storage that throws (private mode) keeps it in memory for the session. Entries older
// than two days are dropped on write.
import { useSyncExternalStore } from "react";

const KEY = "mp.admin.whistled.v1";
const KEEP_MS = 2 * 24 * 60 * 60_000;
type Entries = Record<string, number>;

let memory: Entries | null = null;
let snapshot: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

function parse(raw: string | null): Entries {
  try {
    const v: unknown = raw ? JSON.parse(raw) : {};
    if (!v || typeof v !== "object") return {};
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).filter((e): e is [string, number] => typeof e[1] === "number"));
  } catch {
    return {};
  }
}
function read(): Entries {
  if (memory) return memory;
  try {
    memory = parse(localStorage.getItem(KEY));
  } catch {
    memory = {};
  }
  snapshot = new Set(Object.keys(memory));
  return memory;
}
function write(next: Entries) {
  memory = next;
  snapshot = new Set(Object.keys(next));
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage unavailable: memory only
  }
  listeners.forEach((l) => l());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    memory = null;
    read();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
const getSnapshot = () => {
  read();
  return snapshot;
};
const EMPTY: ReadonlySet<string> = new Set();

/** The match ids whistled on this device. */
export function useWhistled(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
}
/** Marks a match as whistled (now). */
export function whistle(matchId: string, now = Date.now()) {
  const cur = read();
  const kept = Object.fromEntries(Object.entries(cur).filter(([, at]) => now - at < KEEP_MS));
  write({ ...kept, [matchId]: now });
}
/** Takes a whistle back (the lower third's «Deshacer»). */
export function unwhistle(matchId: string) {
  const cur = { ...read() };
  delete cur[matchId];
  write(cur);
}
/** Tests: forget the in-memory copy. */
export function resetWhistledForTests() {
  memory = null;
  snapshot = new Set();
}
