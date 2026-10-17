// La mesa's offline queue: every play goes through it, so scoring never waits for the network. A play is
// stored on the phone (localStorage, surviving a closed tab; shared across tabs with a BroadcastChannel)
// with its idempotent requestId and the time of play when it was tapped, and uploaded by itself, in order,
// as soon as there is signal. A play that fails for lack of signal never holds back the next one; a play
// the server refuses (the match closed, the player already off…) goes to «Por revisar» with the reason,
// to be fixed and resent, or discarded: never dropped, never forced in. A play leaves the queue when the
// realtime match document has it (`live-${requestId}`). Ideas from lib/quickMatchRecovery.
import { z } from "zod";
import { MESA_TYPES, type MesaType } from "../../../functions/src/liveRules";

const id = z.string().min(1).max(200);
const payloadSchema = z.object({
  type: z.enum(MESA_TYPES),
  minute: z.number().int().min(0).max(200),
  playerId: id.optional(),
  assistPlayerId: id.optional(),
  inPlayerId: id.optional(),
  assistReviewed: z.boolean().optional(),
  tappedElapsed: z.number().finite().min(0).max(4 * 3600),
  period: z.union([z.literal(1), z.literal(2)]),
  clockRevision: z.number().int().nonnegative().optional(),
});
const itemSchema = z.object({
  requestId: id,
  matchId: id,
  createdAt: z.number().finite(),
  text: z.string().max(300),
  payload: payloadSchema,
  /** pending: waiting to go up · sent: the server took it, waiting for the realtime doc · review: refused */
  status: z.enum(["pending", "sent", "review"]),
  reason: z.string().max(500).optional(),
  sentAt: z.number().finite().optional(),
});
const recordSchema = z.object({ version: z.literal(1), items: z.array(z.unknown()).max(500) });
export type QueuePayload = z.infer<typeof payloadSchema>;
export type QueueItem = z.infer<typeof itemSchema>;

/** Only play data and identifiers: never tokens or profile details. */
export const queueKey = (uid: string, matchId: string, project: string = import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "club") =>
  `mp:mesa-queue:v1:${project}:${encodeURIComponent(uid)}:${encodeURIComponent(matchId)}`;

/** Reads a stored queue: a corrupt record is dropped, a corrupt item skipped (never the whole queue). */
export function parseQueue(raw: string | null): QueueItem[] {
  if (!raw || raw.length > 400_000) return [];
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return [];
  }
  const rec = recordSchema.safeParse(value);
  if (!rec.success) return [];
  const out: QueueItem[] = [];
  for (const x of rec.data.items) {
    const it = itemSchema.safeParse(x);
    if (it.success) out.push(it.data);
  }
  return out;
}
export const serializeQueue = (items: readonly QueueItem[]): string => JSON.stringify({ version: 1, items });

/** The callable's codes that mean «the server looked at it and said no»: anything else is the network
 *  (or a passing hiccup) and is simply tried again. */
const REJECTED = new Set(["invalid-argument", "failed-precondition", "permission-denied", "not-found", "out-of-range", "already-exists"]);
export function isRejection(error: unknown): boolean {
  const code = typeof error === "object" && error && "code" in error ? String((error as { code: unknown }).code) : "";
  return REJECTED.has(code.replace(/^functions\//, ""));
}
const messageOf = (error: unknown): string => {
  const m = typeof error === "object" && error && "message" in error ? String((error as { message: unknown }).message) : "";
  return m && !/^(internal|INTERNAL)$/.test(m) ? m : "El servidor no ha aceptado la jugada.";
};

export interface QueueSnapshot {
  items: readonly QueueItem[];
  /** The upload in flight (requestId), if any. */
  sending: string | null;
  /** The last upload failed for lack of signal (or the browser says it is offline). */
  offline: boolean;
  lastTryAt: number | null;
}

export interface QueueOptions {
  key: string;
  /** Uploads one play (liveEvent add). Resolves when the server took it. */
  send: (item: QueueItem) => Promise<void>;
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
  now?: () => number;
  /** Cross-tab channel (tests pass null). */
  channel?: Pick<BroadcastChannel, "postMessage" | "close"> & { onmessage: ((ev: MessageEvent) => void) | null } | null;
  /** Whether the browser thinks it is online. */
  isOnline?: () => boolean;
  /** Retry delay after a network failure (ms). */
  retryMs?: number;
}

/** A play the server took but the realtime doc hasn't shown in this long goes up again (same requestId). */
export const RESEND_SENT_MS = 90_000;

export class MesaQueue {
  private items: QueueItem[] = [];
  private listeners = new Set<() => void>();
  private snap: QueueSnapshot;
  private sending: string | null = null;
  private netDown = false;
  private lastTryAt: number | null = null;
  private flushing = false;
  private again = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private readonly o: Required<Omit<QueueOptions, "channel" | "storage">> & Pick<QueueOptions, "channel" | "storage">;

  constructor(opts: QueueOptions) {
    this.o = {
      now: () => Date.now(),
      isOnline: () => (typeof navigator === "undefined" ? true : navigator.onLine !== false),
      retryMs: 5_000,
      ...opts,
    };
    this.items = this.read();
    this.snap = this.makeSnap();
    if (this.o.channel) this.o.channel.onmessage = () => this.reload();
  }

  // ---------- store
  private read(): QueueItem[] {
    try {
      return parseQueue(this.o.storage?.getItem(this.o.key) ?? null);
    } catch {
      return [];
    }
  }
  private write() {
    try {
      if (this.items.length) this.o.storage?.setItem(this.o.key, serializeQueue(this.items));
      else this.o.storage?.removeItem(this.o.key);
    } catch {
      /* full or blocked: memory still holds the plays while the tab lives */
    }
    try {
      this.o.channel?.postMessage({ t: "sync" });
    } catch {
      /* closed */
    }
  }
  /** Another tab changed the queue (or the storage event fired). */
  reload() {
    if (this.closed) return;
    this.items = this.read();
    this.emit();
    this.flush();
  }
  private makeSnap(): QueueSnapshot {
    return { items: this.items, sending: this.sending, offline: this.netDown || !this.o.isOnline(), lastTryAt: this.lastTryAt };
  }
  private emit() {
    this.snap = this.makeSnap();
    for (const fn of [...this.listeners]) fn();
  }
  private set(items: QueueItem[]) {
    this.items = items;
    this.write();
    this.emit();
  }

  // ---------- reading
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  getSnapshot = (): QueueSnapshot => this.snap;

  // ---------- writing
  /** A new play: stored first, then uploaded. */
  enqueue(item: Omit<QueueItem, "status">) {
    if (this.items.some((x) => x.requestId === item.requestId)) return;
    this.set([...this.items, { ...item, status: "pending" }]);
    this.flush();
  }
  /** The realtime doc now has these events: their plays leave the queue. */
  confirm(eventIds: ReadonlySet<string>) {
    const left = this.items.filter((x) => !eventIds.has(`live-${x.requestId}`));
    if (left.length !== this.items.length) this.set(left);
  }
  /** Drops a play (Deshacer of a queued play, «Descartar» in «Por revisar»). False if it is uploading now. */
  drop(requestId: string): boolean {
    if (this.sending === requestId) return false;
    const left = this.items.filter((x) => x.requestId !== requestId);
    if (left.length === this.items.length) return false;
    this.set(left);
    return true;
  }
  /** Changes a play still waiting to go up (the assist of a goal tapped without signal). False when it
   *  is not pending here any more (uploading or already up: then it is edited on the server). */
  amend(requestId: string, patch: Partial<Pick<QueuePayload, "type" | "playerId" | "assistPlayerId" | "inPlayerId" | "assistReviewed">>): boolean {
    const it = this.items.find((x) => x.requestId === requestId);
    if (!it || it.status !== "pending" || this.sending === requestId) return false;
    const payload: QueuePayload = { ...it.payload };
    for (const [k, v] of Object.entries(patch) as [keyof typeof patch, string | boolean | undefined][]) {
      if (v === undefined || v === "") delete payload[k];
      else Object.assign(payload, { [k]: v });
    }
    this.set(this.items.map((x) => (x.requestId === requestId ? { ...x, payload } : x)));
    return true;
  }
  /** «Por revisar» → fixed and sent again, under a new requestId (the refused one is spent). */
  resend(requestId: string, fix: { playerId?: string; minute?: number }, newId: string) {
    const it = this.items.find((x) => x.requestId === requestId && x.status === "review");
    if (!it) return;
    const payload: QueuePayload = { ...it.payload };
    if (fix.playerId) payload.playerId = fix.playerId;
    if (typeof fix.minute === "number" && Number.isFinite(fix.minute)) {
      const m = Math.max(1, Math.round(fix.minute));
      payload.minute = m - 1;
      payload.tappedElapsed = (m - 1) * 60 + 30;
    }
    const next: QueueItem = { ...it, requestId: newId, payload, status: "pending", reason: undefined, sentAt: undefined };
    this.set(this.items.map((x) => (x.requestId === requestId ? next : x)));
    this.flush();
  }

  // ---------- uploading
  /** Uploads every pending play, one by one, in order; a network failure never stops the next one. */
  flush = (): void => {
    if (this.closed) return;
    if (this.flushing) {
      this.again = true;
      return;
    }
    this.flushing = true;
    void this.run().finally(() => {
      this.flushing = false;
      if (this.again && !this.closed) {
        this.again = false;
        this.flush();
      }
    });
  };
  private async run() {
    const now = this.o.now();
    // (a play the server took but the doc never showed goes up again: the requestId makes it harmless)
    if (this.items.some((x) => x.status === "sent" && now - (x.sentAt ?? 0) > RESEND_SENT_MS)) this.set(this.items.map((x) => (x.status === "sent" && now - (x.sentAt ?? 0) > RESEND_SENT_MS ? { ...x, status: "pending" as const } : x)));
    let failed = false;
    const tried = new Set<string>();
    for (;;) {
      const next = this.items.find((x) => x.status === "pending" && !tried.has(x.requestId));
      if (!next || this.closed) break;
      tried.add(next.requestId);
      this.sending = next.requestId;
      this.lastTryAt = this.o.now();
      this.emit();
      try {
        await this.o.send(next);
        this.netDown = false;
        this.patch(next.requestId, { status: "sent", sentAt: this.o.now() });
      } catch (e) {
        if (isRejection(e)) this.patch(next.requestId, { status: "review", reason: messageOf(e) });
        else {
          failed = true;
          this.netDown = true;
        }
      } finally {
        this.sending = null;
        this.emit();
      }
    }
    if (failed || this.items.some((x) => x.status === "sent")) this.schedule(failed ? this.o.retryMs : RESEND_SENT_MS);
  }
  private patch(requestId: string, p: Partial<QueueItem>) {
    if (!this.items.some((x) => x.requestId === requestId)) return;
    this.set(this.items.map((x) => (x.requestId === requestId ? { ...x, ...p } : x)));
  }
  private schedule(ms: number) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, ms);
  }
  /** The browser says the signal is back (or gone). */
  setOnline(online: boolean) {
    if (online) {
      this.netDown = false;
      this.flush();
    }
    this.emit();
  }
  close() {
    this.closed = true;
    if (this.timer) clearTimeout(this.timer);
    this.listeners.clear();
    try {
      this.o.channel?.close();
    } catch {
      /* already closed */
    }
  }
}

/** The plays per player still to go up (the «↓N» badges): who did it and who came in. */
export function pendingByPlayer(items: readonly QueueItem[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const x of items) {
    if (x.status === "review") continue;
    for (const p of [x.payload.playerId, x.payload.inPlayerId]) if (p) out[p] = (out[p] ?? 0) + 1;
  }
  return out;
}
export type { MesaType };
