// Push notices on this device (Web Push, the club's own VAPID keys; functions/src/push.ts sends them).
// The topics chosen are kept on the device and on the server, by subscription. A subscription can die
// without anyone noticing (the browser renews its keys, the push service forgets it): the service worker
// subscribes again by itself (public/push-sw.js, `pushsubscriptionchange`) and the app re-asserts it on
// boot, at most once a day (reassertPush).
import { httpsCallable } from "firebase/functions";
import { functions, FUNCTIONS_REGION } from "../firebase";

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
  { id: "lineup", label: "Cuando salga el siete oficial", hint: "Con el enlace a la charla de la pizarra" },
];
const KEY = "piti-push-topics";
/** The endpoint the server last accepted for this device (what the boot check compares with). */
const ENDPOINT_KEY = "piti-push-endpoint";
/** When the boot check last re-told the server (ms): at most once every REASSERT_EVERY_MS. */
const CHECKED_KEY = "piti-push-checked";
export const REASSERT_EVERY_MS = 24 * 3600_000;
/** What the service worker needs to subscribe again on its own (Cache API: it can't read localStorage). */
const SW_CACHE = "piti-push";
const SW_STATE = "/__piti-push-state";

const subscribeCall = httpsCallable<{ subscription: PushSubscriptionJSON; topics: Topic[] }, { topics: Topic[] }>(functions, "pushSubscribe");

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

/** Leaves the service worker what it needs to re-subscribe by itself (or nothing, with no topics). */
async function rememberForWorker(topics: readonly Topic[]): Promise<void> {
  try {
    if (typeof caches === "undefined") return;
    const cache = await caches.open(SW_CACHE);
    if (!topics.length) {
      await cache.delete(SW_STATE);
      return;
    }
    const state = { topics, subscribe: callableUrl("pushSubscribe"), unsubscribe: callableUrl("pushUnsubscribe") };
    await cache.put(SW_STATE, new Response(JSON.stringify(state), { headers: { "content-type": "application/json" } }));
  } catch {
    /* no Cache API here: the boot check still re-asserts it */
  }
}

/** Tells the server this device's subscription and topics, and remembers what it accepted. */
async function register(sub: PushSubscription, topics: Topic[]): Promise<void> {
  await subscribeCall({ subscription: sub.toJSON(), topics });
  write(ENDPOINT_KEY, sub.endpoint);
  await rememberForWorker(topics);
}

/** Subscribes this device to `topics` (asks for permission the first time); an empty list stops all notices. */
export async function setTopics(topics: Topic[]): Promise<Topic[]> {
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!topics.length) {
    if (sub) await subscribeCall({ subscription: sub.toJSON(), topics: [] }).catch(() => undefined);
    await sub?.unsubscribe();
    write(ENDPOINT_KEY, null);
    await rememberForWorker([]);
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

/**
 * Whether the boot check should re-tell the server about this device: it chose topics, the browser
 * already allows notices (never asks from here), and the subscription is gone or isn't the one the
 * server last accepted — at most once every REASSERT_EVERY_MS (a clock set back counts as due).
 */
export function reassertDue(o: { topics: readonly string[]; permission: string; endpoint: string | null; registered: string | null; lastTry: number | null; now: number }): boolean {
  if (!o.topics.length || o.permission !== "granted") return false;
  if (o.endpoint && o.endpoint === o.registered) return false;
  return o.lastTry == null || o.now < o.lastTry || o.now - o.lastTry >= REASSERT_EVERY_MS;
}

let inFlight: Promise<ReassertResult> | null = null;
export type ReassertResult = "skip" | "ok" | "failed";

/**
 * On app boot (once the session is known: the personal topics need it): when this device chose topics
 * but its subscription was lost or renewed, subscribe again silently (the permission is already there)
 * and send the saved topics again. At most once a day; never asks, never throws.
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
      const due = reassertDue({ topics, permission: Notification.permission, endpoint: sub?.endpoint ?? null, registered: read(ENDPOINT_KEY), lastTry: Number.isFinite(last) && last > 0 ? last : null, now });
      if (!due) return "skip";
      write(CHECKED_KEY, String(now));
      sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC) });
      await register(sub, topics);
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
