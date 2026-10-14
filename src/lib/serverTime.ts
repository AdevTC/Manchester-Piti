// The server's clock as this phone sees it. The match clock is stamped with the server's Date.now()
// (functions/src/liveClock.ts, live.ts), so reading it with the phone's own clock puts a phone that is
// 90 s off on another minute. Every callable that returns `serverNow` (liveEvent, controlMatchClock)
// gives one round-trip sample: offset = serverNow − the midpoint of the request, good to half the
// round trip. The sample with the shortest round trip among the last few wins (the most precise one).
// Before any of them, the `Date` header of a fresh /datos/club.bundle (second precision) stands in.
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
/** An offset beyond this is not a skewed clock but a broken one or a stale copy: ignored. */
export const MAX_OFFSET = 12 * 3_600_000;

let state: Stored | null = null;
let offset = 0;
const listeners = new Set<() => void>();

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/** The sample of one call: `serverNow` read on the server, `sentAt`/`receivedAt` on the phone. */
export function roundTripSample(serverNow: unknown, sentAt: number, receivedAt: number): OffsetSample | null {
  if (!finite(serverNow) || !finite(sentAt) || !finite(receivedAt) || receivedAt < sentAt) return null;
  const rtt = receivedAt - sentAt;
  const est = Math.round(serverNow - (sentAt + receivedAt) / 2);
  if (rtt > MAX_RTT || Math.abs(est) > MAX_OFFSET) return null;
  return { offset: est, rtt };
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
export function recordServerTime(serverNow: unknown, sentAt: number, receivedAt: number): void {
  const s = roundTripSample(serverNow, sentAt, receivedAt);
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
    const sentAt = Date.now();
    const r = await call(data);
    const body = r?.data;
    if (body && typeof body === "object" && "serverNow" in body) recordServerTime((body as { serverNow: unknown }).serverNow, sentAt, Date.now());
    return r;
  };
}

/** Tests: forget everything (memory and sessionStorage). */
export function resetServerTime(): void {
  state = null;
  offset = 0;
  try {
    storage()?.removeItem(KEY);
  } catch {
    /* nothing to forget */
  }
}
