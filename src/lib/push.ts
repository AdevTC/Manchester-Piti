// Push notices on this device (Web Push, the club's own VAPID keys; functions/src/push.ts sends them).
// The topics chosen are kept on the device and on the server, by subscription; a signed-in member's
// subscription also carries their uid (their personal notices find it). A subscription can die without
// anyone noticing (the browser renews its keys, the push service forgets it and the server drops it):
// the service worker subscribes again by itself (public/push-sw.js, `pushsubscriptionchange`) and the
// app re-asserts it on boot (reassertPush) — also when the session changes, so a signed-out device stops
// carrying the member's uid.
import { httpsCallable } from "firebase/functions";
import { auth, functions, FUNCTIONS_REGION } from "../firebase";

export const VAPID_PUBLIC = "BAZRaiFp6DqaRb1e2ONwNyUivVNI6AqQCrb-ovbyBJ7c_BYYHRt9SrPbE96MjDZfasbQrRqDREKCG6z7Ug3uDYc";
export type Topic = "start" | "goals" | "final" | "mvp" | "dates" | "lineup" | DoorTopic | "convocatoria";
/** The vestuario door: "door" for captains (someone knocks), "access" for whoever waits to be let in. */
export type DoorTopic = "door" | "access";
export const TOPIC_LABELS: { id: Topic; label: string; hint?: string }[] = [
  { id: "start", label: "Cuando empiece el partido", hint: "Y el descanso y la 2ª parte" },
  { id: "goals", label: "Cada gol", hint: "Del Piti y del rival, en directo" },
  { id: "final", label: "Resultado final" },
  { id: "mvp", label: "MVP de la jornada", hint: "Cuando se abre el voto y cuando hay ganador" },
  { id: "dates", label: "Fechas nuevas y cambios", hint: "Partidos nuevos o cambios de hora" },
  { id: "lineup", label: "Cuando salga el siete oficial", hint: "Y sus cambios y la convocatoria, con el enlace al partido" },
];
/** The topics that need the member's session (the server refuses or drops them without it). */
const PERSONAL: readonly Topic[] = ["door", "access", "convocatoria"];
/** The ones the server refuses outright to a session that may not have them (instead of dropping them). */
const RESTRICTED: readonly Topic[] = ["door", "access"];
/** Whether the server kept a subscription doc at the last registration ("1") or none ("0"). */
const ACCEPTED_KEY = "piti-push-accepted";
const KEY = "piti-push-topics";
/** The endpoint the server last accepted for this device (what the boot check compares with). */
const ENDPOINT_KEY = "piti-push-endpoint";
/** The session (uid, "" signed out) of that registration: another session means the server's uid is stale. */
const SESSION_KEY = "piti-push-session";
/** The session the boot check last tried for (a session change skips the daily limit once, not every boot). */
const TRIED_SESSION_KEY = "piti-push-session-tried";
/** When the boot check last re-told the server (ms). */
const CHECKED_KEY = "piti-push-checked";
/** A lost or renewed subscription: re-told at most once a day. */
export const REASSERT_EVERY_MS = 24 * 3600_000;
/** All well on this side: re-told once a week anyway, to learn whether the server dropped it (404/410). */
export const REVERIFY_EVERY_MS = 7 * 24 * 3600_000;
/** What the service worker needs to subscribe again on its own (Cache API: it can't read localStorage). */
const SW_CACHE = "piti-push";
const SW_STATE = "/__piti-push-state";
/** Left by the service worker when it re-subscribed by itself (with the public topics only). */
const SW_DIRTY = "/__piti-push-dirty";

interface SubscribeAnswer {
  topics: Topic[];
  uid?: string | null;
  /** Whether the server still had this device before this call. */
  known?: boolean;
}
const subscribeCall = httpsCallable<{ subscription: PushSubscriptionJSON; topics: Topic[] }, SubscribeAnswer>(functions, "pushSubscribe");

/** A callable's plain HTTPS address (the service worker calls it with fetch, without the SDK). */
export function callableUrl(name: string): string {
  const project = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;
  return import.meta.env.VITE_USE_FIREBASE_EMULATOR === "1" ? `http://127.0.0.1:5001/${project}/${FUNCTIONS_REGION}/${name}` : `https://${FUNCTIONS_REGION}-${project}.cloudfunctions.net/${name}`;
}

export type PushState = "unsupported" | "ios-install" | "denied" | "ready";
/** Whether this device can get notices, and why not. iPhone/iPad need the web added to the home screen. */
export function pushState(): PushState {
  if (typeof window === "undefined") return "unsupported";
  const ios = /iP(hone|ad|od)/.test(navigator.userAgent);
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return ios && !standalone ? "ios-install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  return "ready";
}

const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string | null) => {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage can be off */
  }
};

export function savedTopics(): Topic[] {
  try {
    const raw: unknown = JSON.parse(read(KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((t): t is Topic => typeof t === "string") : [];
  } catch {
    return [];
  }
}

const keyBytes = (base64: string) => {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

/** This browser's session: the signed-in uid, "" signed out. */
const session = (): string => auth.currentUser?.uid ?? "";

async function swCache(): Promise<Cache | null> {
  try {
    return typeof caches === "undefined" ? null : await caches.open(SW_CACHE);
  } catch {
    return null;
  }
}

/** Leaves the service worker what it needs to re-subscribe by itself (or nothing, with no topics), and
 *  clears its «re-subscribed by myself» mark: the app has just told the server everything. */
async function rememberForWorker(topics: readonly Topic[], endpoint: string | null): Promise<void> {
  try {
    const cache = await swCache();
    if (!cache) return;
    await cache.delete(SW_DIRTY);
    if (!topics.length || !endpoint) {
      await cache.delete(SW_STATE);
      return;
    }
    const state = { topics, endpoint, subscribe: callableUrl("pushSubscribe"), unsubscribe: callableUrl("pushUnsubscribe") };
    await cache.put(SW_STATE, new Response(JSON.stringify(state), { headers: { "content-type": "application/json" } }));
  } catch {
    /* no Cache API here: the boot check still re-asserts it */
  }
}

async function workerDirty(): Promise<boolean> {
  try {
    return !!(await (await swCache())?.match(SW_DIRTY));
  } catch {
    return false;
  }
}

/** Tells the server this device's subscription and topics (signed out: only the public ones, and no uid)
 *  and remembers what it accepted, with which session. */
const code = (e: unknown): string => (e && typeof e === "object" && typeof (e as { code?: unknown }).code === "string" ? (e as { code: string }).code : "");

/**
 * Tells the server this device's subscription and topics (signed out: only the public ones, and no uid)
 * and remembers what it accepted, with which session. `fallback` (the silent re-assert): a session the
 * server refuses some topics to (`door` is for captains, `access` for a Google account) is registered
 * without them, so the device still moves to that session (its uid replaces the old one) — the choice
 * saved here stays for when a session that may have them comes back.
 */
async function register(sub: PushSubscription, topics: Topic[], fallback = false): Promise<SubscribeAnswer> {
  const who = session();
  let send = who ? topics : topics.filter((t) => !PERSONAL.includes(t));
  let data: SubscribeAnswer | undefined;
  try {
    data = (await subscribeCall({ subscription: sub.toJSON(), topics: send })).data;
  } catch (e) {
    if (!fallback || !RESTRICTED.some((t) => send.includes(t)) || !["functions/permission-denied", "functions/unauthenticated"].includes(code(e))) throw e;
    send = send.filter((t) => !RESTRICTED.includes(t));
    data = (await subscribeCall({ subscription: sub.toJSON(), topics: send })).data;
  }
  write(ENDPOINT_KEY, sub.endpoint);
  write(SESSION_KEY, who);
  // (what the server holds now: a device it keeps, or none — then a `known: false` later is no news)
  write(ACCEPTED_KEY, (data?.topics ?? send).length ? "1" : "0");
  await rememberForWorker(topics, sub.endpoint);
  return data ?? { topics: send };
}

/** Subscribes this device to `topics` (asks for permission the first time); an empty list stops all notices. */
export async function setTopics(topics: Topic[]): Promise<Topic[]> {
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!topics.length) {
    if (sub) await subscribeCall({ subscription: sub.toJSON(), topics: [] }).catch(() => undefined);
    await sub?.unsubscribe();
    write(ENDPOINT_KEY, null);
    write(SESSION_KEY, null);
    write(ACCEPTED_KEY, null);
    await rememberForWorker([], null);
  } else {
    if (Notification.permission !== "granted" && (await Notification.requestPermission()) !== "granted") throw new Error("Sin permiso para avisos en este navegador.");
    sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC) });
    await register(sub, topics);
  }
  write(KEY, JSON.stringify(topics));
  return topics;
}

/** Turns one topic on or off on this device, keeping the others. */
export const toggleTopic = (topic: Topic, on: boolean) => {
  const rest = savedTopics().filter((t) => t !== topic);
  return setTopics(on ? [...rest, topic] : rest);
};

export interface ReassertInput {
  topics: readonly string[];
  permission: string;
  /** The browser's subscription now (null: none). */
  endpoint: string | null;
  /** The endpoint the server last accepted (null: never recorded). */
  registered: string | null;
  /** The session now ("" signed out) and the one of that registration (null: never recorded). */
  session: string;
  registeredSession: string | null;
  /** The session the last attempt was for (a change bypasses the daily limit only once). */
  triedSession: string | null;
  /** The service worker re-subscribed by itself (public topics only): the full set is owed. */
  dirty: boolean;
  lastTry: number | null;
  now: number;
}

/**
 * Whether the boot check should re-tell the server about this device. Never without topics or without
 * the browser's permission (it never asks). At once: after the worker re-subscribed by itself, or when
 * the session changed (signed out, or someone else signed in: the server's uid is stale) or was never
 * recorded — the first time for that session; if that fails, daily. A lost or renewed subscription: at
 * most once a day. All well: once a week anyway, to learn
 * whether the server dropped it (a clock set back counts as due).
 */
export function reassertDue(o: ReassertInput): boolean {
  if (!o.topics.length || o.permission !== "granted") return false;
  if (o.dirty) return true;
  const since = o.lastTry == null || o.now < o.lastTry ? Infinity : o.now - o.lastTry;
  // A session the server doesn't have for this device (or never recorded, before this check existed):
  // at once the first time for it, then daily like any other pending fix.
  if (o.registeredSession === null || o.session !== o.registeredSession) return o.session !== o.triedSession || since >= REASSERT_EVERY_MS;
  if (!o.endpoint || o.endpoint !== o.registered) return since >= REASSERT_EVERY_MS;
  return since >= REVERIFY_EVERY_MS;
}

let inFlight: Promise<ReassertResult> | null = null;
export type ReassertResult = "skip" | "ok" | "renewed" | "failed";

/**
 * On app boot and on every session change (once the session is known: the personal topics need it):
 * when reassertDue says so, subscribe again silently if the subscription is gone (the permission is
 * already there) and send the saved topics again. If the server says it had dropped this very endpoint
 * (404/410), the subscription is dead: renew it and register the new one. Never asks, never throws.
 */
export function reassertPush(now: number = Date.now()): Promise<ReassertResult> {
  // (one at a time: StrictMode, or a session that settles twice, never sends it twice)
  if (inFlight) return inFlight;
  const run = (async (): Promise<ReassertResult> => {
    try {
      if (pushState() !== "ready") return "skip";
      const topics = savedTopics();
      if (!topics.length) return "skip";
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return "skip";
      let sub = await reg.pushManager.getSubscription();
      const last = Number(read(CHECKED_KEY));
      const registered = read(ENDPOINT_KEY);
      const who = session();
      const due = reassertDue({
        topics,
        permission: Notification.permission,
        endpoint: sub?.endpoint ?? null,
        registered,
        session: who,
        registeredSession: read(SESSION_KEY),
        triedSession: read(TRIED_SESSION_KEY),
        dirty: await workerDirty(),
        lastTry: Number.isFinite(last) && last > 0 ? last : null,
        now,
      });
      if (!due) return "skip";
      write(CHECKED_KEY, String(now));
      write(TRIED_SESSION_KEY, who);
      sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC) });
      // (did the server keep a doc for us last time? only then is a «didn't know it» news)
      const hadDoc = read(ACCEPTED_KEY) === "1";
      const answer = await register(sub, topics, true);
      // The server had dropped the endpoint it had accepted from us: the push service said it is gone.
      if (answer.known === false && hadDoc && registered === sub.endpoint) {
        // (the doc this call just re-created for the dead endpoint goes too)
        await subscribeCall({ subscription: sub.toJSON(), topics: [] }).catch(() => undefined);
        await sub.unsubscribe();
        const fresh = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC) });
        await register(fresh, topics, true);
        return "renewed";
      }
      return "ok";
    } catch {
      return "failed";
    }
  })();
  inFlight = run;
  void run.then(() => {
    if (inFlight === run) inFlight = null;
  });
  return run;
}
