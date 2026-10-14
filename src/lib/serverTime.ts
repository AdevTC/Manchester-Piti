// The server's clock as this phone sees it. The match clock is stamped with the server's Date.now()
// (functions/src/liveClock.ts, live.ts), so reading it with the phone's own clock puts a phone that is
// 90 s off on another minute. Every callable that returns `serverNow` (liveEvent, controlMatchClock)
// gives one round-trip sample: offset = serverNow − the midpoint of the request, good to half the
// round trip. The sample with the shortest round trip among the last few wins (the most precise one).
// Fans never call those: while a match is live or waiting for its whistle, the app asks /api/now (a
// same-origin Vercel function, never cached) once per session and again every 30 min — the same kind
// of sample. Before any of them, the `Date` header of a fresh /datos/club.bundle (second precision)
// stands in.
// Kept in memory and in sessionStorage (a reload keeps it); SSR-safe (no window: offset 0).

/** One round-trip estimate: the offset (ms, server − phone) and how long the round trip took. */
export interface OffsetSample {
  offset: number;
  rtt: number;
}

interface Stored {
  samples: OffsetSample[];
  header: number | null;
}

const KEY = "mp:serverTime";
/** How many callable samples are kept (the best of them is used). */
export const KEEP = 8;
/** A round trip longer than this says nothing useful (±10 s): it is dropped. */
export const MAX_RTT = 20_000;
/** A header offset beyond this is more likely a stale copy than a skewed clock: ignored. */
export const MAX_OFFSET = 12 * 3_600_000;
/** A round trip measures the server right now, so a phone set days wrong is still corrected (up to a week). */
export const MAX_SAMPLE_OFFSET = 7 * 24 * 3_600_000;
/** How often /api/now is asked again while a match is live. */
export const SYNC_EVERY = 30 * 60_000;
export const NOW_URL = "/api/now";

let state: Stored | null = null;
let offset = 0;
const listeners = new Set<() => void>();

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/** The sample of one call: `serverNow` read on the server, `sentAt`/`receivedAt` on the phone's wall
 *  clock (their midpoint), and the round trip from the monotonic clock when there is one (`rtt`: a wall
 *  clock adjusted mid-call would otherwise make it wrong). */
export function roundTripSample(serverNow: unknown, sentAt: number, receivedAt: number, rtt: number = receivedAt - sentAt): OffsetSample | null {
  if (!finite(serverNow) || !finite(sentAt) || !finite(receivedAt) || receivedAt < sentAt) return null;
  const trip = finite(rtt) && rtt >= 0 ? Math.round(rtt) : receivedAt - sentAt;
  const est = Math.round(serverNow - (sentAt + receivedAt) / 2);
  if (trip > MAX_RTT || Math.abs(est) > MAX_SAMPLE_OFFSET) return null;
  return { offset: est, rtt: trip };
}

/** The monotonic clock (ms), when the platform has one. */
export function monotonic(): number | null {
  return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : null;
}

/** Times a request: the wall clock at both ends (the midpoint) and the round trip from the monotonic clock. */
export function startTrip(): () => { sentAt: number; receivedAt: number; rtt: number } {
  const sentAt = Date.now();
  const p0 = monotonic();
  return () => {
    const receivedAt = Date.now();
    const p1 = monotonic();
    return { sentAt, receivedAt, rtt: p0 != null && p1 != null && p1 >= p0 ? p1 - p0 : receivedAt - sentAt };
  };
}

/** The offset a `Date` header gives (whole seconds: the server's time is somewhere in that second). */
export function dateHeaderOffset(date: string | null | undefined, sentAt: number, receivedAt: number): number | null {
  if (!date || !finite(sentAt) || !finite(receivedAt) || receivedAt < sentAt) return null;
  const at = Date.parse(date);
  if (!Number.isFinite(at)) return null;
  const est = Math.round(at + 500 - (sentAt + receivedAt) / 2);
  return Math.abs(est) > MAX_OFFSET ? null : est;
}

/** The offset to use: the callable sample with the shortest round trip (the newest on a tie), else the
 *  header's, else 0. */
export function pickOffset(samples: readonly OffsetSample[], header: number | null): number {
  let best: OffsetSample | null = null;
  for (const s of samples) if (!best || s.rtt <= best.rtt) best = s;
  return best ? best.offset : (header ?? 0);
}

/** Keeps the newest `KEEP` samples. */
export function addSample(samples: readonly OffsetSample[], s: OffsetSample): OffsetSample[] {
  return [...samples, s].slice(-KEEP);
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function load(): Stored {
  if (state) return state;
  state = { samples: [], header: null };
  try {
    const raw = storage()?.getItem(KEY);
    const v: unknown = raw ? JSON.parse(raw) : null;
    if (v && typeof v === "object") {
      const o = v as { samples?: unknown; header?: unknown };
      const samples = Array.isArray(o.samples)
        ? o.samples.filter((s): s is OffsetSample => !!s && typeof s === "object" && finite((s as OffsetSample).offset) && finite((s as OffsetSample).rtt)).slice(-KEEP)
        : [];
      state = { samples, header: finite(o.header) ? o.header : null };
    }
  } catch {
    /* blocked or corrupt: start again */
  }
  offset = pickOffset(state.samples, state.header);
  return state;
}

function save(next: Stored) {
  state = next;
  const was = offset;
  offset = pickOffset(next.samples, next.header);
  try {
    storage()?.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode or full: memory is enough */
  }
  if (offset !== was) for (const fn of [...listeners]) fn();
}

/** The phone's estimate of (server time − phone time), in ms. */
export function serverOffset(): number {
  load();
  return offset;
}

/** The server's time now, as best this phone knows it. Every live minute reads this. */
export function serverNow(): number {
  return Date.now() + serverOffset();
}

/** Records the `serverNow` of a callable's answer (ignored when missing: an older server). */
export function recordServerTime(serverNow: unknown, sentAt: number, receivedAt: number, rtt?: number): void {
  const s = roundTripSample(serverNow, sentAt, receivedAt, rtt);
  if (!s) return;
  const cur = load();
  save({ samples: addSample(cur.samples, s), header: cur.header });
}

/** Records the `Date` header of a fresh response (used only until a callable sample exists). */
export function recordDateHeader(date: string | null | undefined, sentAt: number, receivedAt: number): void {
  const est = dateHeaderOffset(date, sentAt, receivedAt);
  if (est == null) return;
  const cur = load();
  save({ samples: cur.samples, header: est });
}

/** Called whenever the offset changes (so a clock on screen re-reads the time). */
export function subscribeServerTime(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Wraps a callable whose answer carries `serverNow`: each answer becomes a sample. */
export function withServerTime<Req, R extends { readonly data: unknown }>(call: (data: Req) => Promise<R>): (data: Req) => Promise<R> {
  return async (data: Req) => {
    const done = startTrip();
    const r = await call(data);
    const t = done();
    const body = r?.data;
    if (body && typeof body === "object" && "serverNow" in body) recordServerTime((body as { serverNow: unknown }).serverNow, t.sentAt, t.receivedAt, t.rtt);
    return r;
  };
}

const SYNC_KEY = "mp:serverTimeSync";
let lastSync: number | null = null;
let syncing = false;

function lastSyncAt(): number | null {
  if (lastSync != null) return lastSync;
  try {
    const v = Number(storage()?.getItem(SYNC_KEY));
    lastSync = Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    lastSync = null;
  }
  return lastSync;
}

/** Asks /api/now for the server's time, at most once per SYNC_EVERY (and once per session: the time
 *  of the last ask is kept in sessionStorage). Callers only call it while a match is live or waiting for
 *  its whistle. A failure (offline, the dev server's SPA fallback) waits for the next window too. */
export async function syncServerTime(fetchImpl: typeof fetch = fetch, url: string = NOW_URL): Promise<boolean> {
  const last = lastSyncAt();
  if (syncing || (last != null && Math.abs(Date.now() - last) < SYNC_EVERY)) return false;
  syncing = true;
  lastSync = Date.now();
  try {
    storage()?.setItem(SYNC_KEY, String(lastSync));
  } catch {
    /* memory is enough */
  }
  try {
    const done = startTrip();
    const r = await fetchImpl(url, { cache: "no-store", headers: { accept: "application/json" } });
    const t = done();
    if (!r.ok || !(r.headers.get("content-type") ?? "").includes("json")) return false;
    const body: unknown = await r.json();
    const now = body && typeof body === "object" ? (body as { now?: unknown }).now : undefined;
    if (!finite(now)) return false;
    recordServerTime(now, t.sentAt, t.receivedAt, t.rtt);
    return true;
  } catch {
    return false;
  } finally {
    syncing = false;
  }
}

/** Tests: forget everything (memory and sessionStorage). */
export function resetServerTime(): void {
  state = null;
  offset = 0;
  lastSync = null;
  syncing = false;
  try {
    storage()?.removeItem(KEY);
    storage()?.removeItem(SYNC_KEY);
  } catch {
    /* nothing to forget */
  }
}
