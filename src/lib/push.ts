// Push notices on this device (Web Push, the club's own VAPID keys; functions/src/push.ts sends them).
// The topics chosen are kept on the device and on the server, by subscription; a signed-in member's
// subscription also carries their uid (their personal notices find it). A subscription can die without
// anyone noticing (the browser renews its keys, the push service forgets it and the server drops it):
// the service worker subscribes again by itself (public/push-sw.js, `pushsubscriptionchange`) and the
// app re-asserts it on boot (reassertPush) — also when the session changes, so a signed-out device stops
// carrying the member's uid.
import { useCallback, useSyncExternalStore } from "react";
import { httpsCallable } from "firebase/functions";
import { auth, functions, FUNCTIONS_REGION } from "../firebase";
import { presetOf, presetTopics, TOPICS_VERSION, type PushChoice, type PushPreset } from "../../functions/src/pushPresets";
import { isMatchTopic, type MatchTopic } from "../../functions/src/pushMatchTopics";
import type { PauseKind } from "../../functions/src/pushPauseLogic";

export const VAPID_PUBLIC = "BAZRaiFp6DqaRb1e2ONwNyUivVNI6AqQCrb-ovbyBJ7c_BYYHRt9SrPbE96MjDZfasbQrRqDREKCG6z7Ug3uDYc";
export type Topic = "start" | "goals" | "cards" | "final" | "mvp" | "dates" | "lineup" | "tabla" | DoorTopic | "convocatoria";
/** The vestuario door: "door" for captains (someone knocks), "access" for whoever waits to be let in. */
export type DoorTopic = "door" | "access";
export const TOPIC_LABELS: { id: Topic; label: string; hint?: string }[] = [
  { id: "start", label: "Cuando empiece el partido", hint: "Y el descanso y la 2ª parte" },
  { id: "goals", label: "Cada gol", hint: "Del Piti y del rival, en directo" },
  { id: "cards", label: "Tarjetas", hint: "Amarillas y rojas, en directo" },
  { id: "final", label: "Resultado final" },
  { id: "mvp", label: "MVP de la jornada", hint: "Cuando se abre el voto y cuando hay ganador" },
  { id: "dates", label: "Fechas nuevas y cambios", hint: "Partidos nuevos o cambios de hora" },
  { id: "lineup", label: "Cuando salga el siete oficial", hint: "Y sus cambios y la convocatoria, con el enlace al partido" },
  { id: "tabla", label: "Cuando se publique la clasificación", hint: "La tabla de la liga, en Partidos" },
];
/** The topics that need the member's session (the server refuses or drops them without it). */
const PERSONAL: readonly Topic[] = ["door", "access", "convocatoria"];
/** The ones the server refuses outright to a session that may not have them (instead of dropping them). */
const RESTRICTED: readonly Topic[] = ["door", "access"];
/** Whether the server kept a subscription doc at the last registration ("1") or none ("0"). */
const ACCEPTED_KEY = "piti-push-accepted";
const KEY = "piti-push-topics";
/** The version of the topic list this device's choice was last told to the server with (TOPICS_VERSION;
 *  absent: saved by an app from before «tabla», see upgradeLegacyTopics). */
const TOPICS_V_KEY = "piti-push-topics-v";
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
const subscribeCall = httpsCallable<{ subscription: PushSubscriptionJSON; topics: Topic[]; vibrate?: boolean; v?: number; resetMatches?: boolean }, SubscribeAnswer>(functions, "pushSubscribe");
/** «Vibrar con los goles» on this device ("1"; off by default). */
const VIBRATE_KEY = "piti-push-vibrate";
/** Left by the service worker when a notice's «Solo goles» button changed this device's topics. */
const SW_PRESET = "/__piti-push-preset";

/** A callable's plain HTTPS address (the service worker calls it with fetch, without the SDK). */
export function callableUrl(name: string): string {
  const project = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;
  // (the emulator's port as src/firebase.ts reads it: firebase.json's, or a spare set's)
  const port = /^\d+$/.test(import.meta.env.VITE_EMULATOR_FUNCTIONS_PORT ?? "") ? import.meta.env.VITE_EMULATOR_FUNCTIONS_PORT : "5001";
  return import.meta.env.VITE_USE_FIREBASE_EMULATOR === "1" ? `http://127.0.0.1:${port}/${project}/${FUNCTIONS_REGION}/${name}` : `https://${FUNCTIONS_REGION}-${project}.cloudfunctions.net/${name}`;
}

export type PushState = "unsupported" | "ios-install" | "denied" | "ready";
/** Why a device can't get notices, in the words of «Avisos a medida» (and the match's own avisos). */
export const PUSH_WHY: Record<Exclude<PushState, "ready">, string> = {
  "ios-install": "En el iPhone, añade la web a la pantalla de inicio (Compartir › Añadir a inicio) y elige aquí tus avisos.",
  denied: "Tienes los avisos bloqueados para esta web: actívalos en los ajustes del navegador y vuelve aquí.",
  unsupported: "Este navegador no recibe avisos. El marcador sigue en la web.",
};
/** A choice of notices that couldn't be saved, in the words of «Avisos a medida». */
export const pushSaveError = (e: unknown): string =>
  e instanceof Error && /permiso/i.test(e.message) ? "Sin permiso para avisos en este navegador." : "No se han podido guardar tus avisos. Inténtalo otra vez.";
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

export const savedTopics = (): Topic[] => topicsOf(read(KEY));
function topicsOf(stored: string | null): Topic[] {
  try {
    const raw: unknown = JSON.parse(stored ?? "[]");
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
    const state = { topics, endpoint, vibrate: savedVibrate(), subscribe: callableUrl("pushSubscribe"), unsubscribe: callableUrl("pushUnsubscribe"), setPreset: callableUrl("pushSetPreset") };
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
 * saved here stays for when a session that may have them comes back. `resetMatches`: a preset was chosen,
 * so the server drops this device's choices for single matches too.
 */
async function register(sub: PushSubscription, topics: Topic[], fallback = false, resetMatches = false): Promise<SubscribeAnswer> {
  const who = session();
  // (another endpoint than the one the server had: the match overrides stayed on the old one's doc)
  const before = read(ENDPOINT_KEY);
  if (before && before !== sub.endpoint) setMatchMirror(null);
  let send = who ? topics : topics.filter((t) => !PERSONAL.includes(t));
  const extra = { ...vibrateField(), v: TOPICS_VERSION, ...(resetMatches ? { resetMatches: true } : {}) };
  let data: SubscribeAnswer | undefined;
  try {
    data = (await subscribeCall({ subscription: sub.toJSON(), topics: send, ...extra })).data;
  } catch (e) {
    if (!fallback || !RESTRICTED.some((t) => send.includes(t)) || !["functions/permission-denied", "functions/unauthenticated"].includes(code(e))) throw e;
    send = send.filter((t) => !RESTRICTED.includes(t));
    data = (await subscribeCall({ subscription: sub.toJSON(), topics: send, ...extra })).data;
  }
  if (resetMatches) setMatchMirror(null);
  write(TOPICS_V_KEY, String(TOPICS_VERSION));
  write(ENDPOINT_KEY, sub.endpoint);
  write(SESSION_KEY, who);
  // (what the server holds now: a device it keeps, or none — then a `known: false` later is no news)
  write(ACCEPTED_KEY, (data?.topics ?? send).length ? "1" : "0");
  await rememberForWorker(topics, sub.endpoint);
  return data ?? { topics: send };
}

/** This browser's push subscription, asking for the permission first when it isn't there yet (call it from
 *  the tap): the first step of every choice that turns notices on (setTopics, setMatchTopics). */
async function ensureSubscription(reg: ServiceWorkerRegistration, sub: PushSubscription | null): Promise<PushSubscription> {
  if (Notification.permission !== "granted" && (await Notification.requestPermission()) !== "granted") throw new Error("Sin permiso para avisos en este navegador.");
  return sub ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC) }));
}

/** Subscribes this device to `topics` (asks for permission the first time); an empty list stops all notices.
 *  `resetMatches` (a preset): the device's choices for single matches go too. */
export async function setTopics(topics: Topic[], { resetMatches = false }: { resetMatches?: boolean } = {}): Promise<Topic[]> {
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!topics.length) {
    if (sub) await subscribeCall({ subscription: sub.toJSON(), topics: [] }).catch(() => undefined);
    await sub?.unsubscribe();
    write(ENDPOINT_KEY, null);
    write(SESSION_KEY, null);
    write(ACCEPTED_KEY, null);
    // («Nada»: the server forgot the device, its choices for single matches too)
    setMatchMirror(null);
    await rememberForWorker([], null);
  } else {
    sub = await ensureSubscription(reg, sub);
    await register(sub, topics, false, resetMatches);
  }
  write(KEY, JSON.stringify(topics));
  notifyPreset();
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

/**
 * A «Todo» saved by an app from before «tabla» (`version` null: no TOPICS_V_KEY): «Todo» covers the table now,
 * so its topics gain it (the server sends it to such a device meanwhile: pushPresets.ts legacyTodoGets). Null
 * when there is nothing to upgrade: a device whose app already knew the topic chose without it.
 */
export function upgradeLegacyTopics(topics: readonly Topic[], version: string | null): Topic[] | null {
  if (version !== null || presetOf(topics) !== "todo" || topics.includes("tabla")) return null;
  return [...topics, "tabla"];
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
      // (a «Solo goles» tapped on a notice changed the topics on the server: this device takes them first)
      await syncFromWorker();
      let topics = savedTopics();
      if (!topics.length) return "skip";
      // (a «Todo» from before «tabla»: it gains it here, and the server has to hear it now)
      const upgraded = upgradeLegacyTopics(topics, read(TOPICS_V_KEY));
      if (upgraded) {
        topics = upgraded;
        write(KEY, JSON.stringify(topics));
        notifyPreset();
      }
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
      if (!due && !(upgraded && Notification.permission === "granted")) return "skip";
      write(CHECKED_KEY, String(now));
      write(TRIED_SESSION_KEY, who);
      sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC) });
      // (did the server keep a doc for us last time? only then is a «didn't know it» news)
      const hadDoc = read(ACCEPTED_KEY) === "1";
      const answer = await register(sub, topics, true);
      // The server had dropped the endpoint it had accepted from us: the push service said it is gone.
      if (answer.known === false && hadDoc && registered === sub.endpoint) {
        // (the server's doc is gone, with this device's choices for single matches)
        setMatchMirror(null);
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

// ---------- «Avisos a medida»: Solo goles · Todo · Nada (functions/src/pushPresets.ts), and «Vibrar con los goles»

export type { PushChoice, PushPreset } from "../../functions/src/pushPresets";
export { PRESET_LABELS, PRESET_NOTES, PUSH_PRESETS, presetOf } from "../../functions/src/pushPresets";

/** «Vibrar con los goles» on this device (off by default). */
export const savedVibrate = (): boolean => read(VIBRATE_KEY) === "1";
/** What a registration tells the server about the vibration: nothing until the device chose (the server keeps its value). */
const vibrateField = (): { vibrate?: boolean } => (read(VIBRATE_KEY) === null ? {} : { vibrate: savedVibrate() });

const presetListeners = new Set<() => void>();
function notifyPreset() {
  presetSnapshot = null;
  for (const l of presetListeners) l();
  for (const l of choiceListeners) l();
}

/**
 * A notice's «Solo goles» button (public/push-sw.js) moved this device to «Solo goles» on the server; the
 * worker can't reach localStorage, so it leaves the server's answer in the Cache API: take it here.
 */
async function syncFromWorker(): Promise<void> {
  try {
    const cache = await swCache();
    const hit = await cache?.match(SW_PRESET);
    if (!cache || !hit) return;
    const saved = (await hit.json().catch(() => null)) as { topics?: unknown } | null;
    await cache.delete(SW_PRESET);
    if (!saved || !Array.isArray(saved.topics)) return;
    write(KEY, JSON.stringify(saved.topics.filter((t): t is Topic => typeof t === "string")));
    // (a preset is for every match: the server dropped this device's choices for single matches, pushSetPreset)
    setMatchMirror(null);
    notifyPreset();
  } catch {
    /* no Cache API: the next choice in the bell sets it again */
  }
}

/**
 * Chooses «Solo goles», «Todo» or «Nada» for this device (asks for permission the first time, like
 * setTopics) and «Vibrar con los goles». «Todo» carries a member's personal notices (convocatoria, turnos);
 * the door's topics a captain has stay as they are. «Nada» forgets the device. A preset is for every match:
 * the device's choices for single matches go. Resolves to its topics.
 */
export async function setPushPreset(preset: PushPreset, vibrate: boolean): Promise<Topic[]> {
  write(VIBRATE_KEY, vibrate ? "1" : "0");
  const topics = presetTopics(preset, savedTopics(), !!auth.currentUser) as Topic[];
  return setTopics(topics, { resetMatches: true });
}

/** «Vibrar con los goles» alone, whatever the topics (A medida's switch: «Solo goles», «Todo» or topics one by
 *  one): kept here and told to the server with this device's topics. */
export async function setPushVibrate(vibrate: boolean): Promise<void> {
  write(VIBRATE_KEY, vibrate ? "1" : "0");
  const topics = savedTopics();
  if (topics.length) await setTopics(topics);
  else notifyPreset();
}

export interface PushPresetState {
  /** The device's choice: a preset, or «A medida» (custom) for topics picked one by one. */
  choice: PushChoice;
  vibrate: boolean;
  /** Whether this device can get notices at all (ios-install / denied: say so instead of the control). */
  state: PushState;
}
let presetSnapshot: PushPresetState | null = null;
const presetState = (): PushPresetState => (presetSnapshot ??= { choice: presetOf(savedTopics()), vibrate: savedVibrate(), state: pushState() });
const SERVER_PRESET: PushPresetState = { choice: "nada", vibrate: false, state: "unsupported" };

/**
 * The bell's «Avisos a medida»: this device's choice and vibration, live across the app (every
 * setPushPreset / setTopics / toggleTopic, and a «Solo goles» tapped on a notice, updates it), plus the
 * setter. The server render sees «Nada» on an unsupported device.
 */
export function usePushPreset(): PushPresetState & { set: (preset: PushPreset, vibrate: boolean) => Promise<Topic[]> } {
  const subscribe = useCallback((cb: () => void) => {
    presetListeners.add(cb);
    void syncFromWorker();
    return () => {
      presetListeners.delete(cb);
    };
  }, []);
  const s = useSyncExternalStore(subscribe, presetState, () => SERVER_PRESET);
  return { ...s, set: setPushPreset };
}

// ---------- «Avisos de este partido»: this device's own choice for one match (functions/src/pushMatchTopics.ts)

/** The device's overrides as the server last answered them (pushSetMatchTopics returns them all). */
const MATCH_KEY = "piti-push-matches";
const choiceListeners = new Set<() => void>();

/** This device's override per match (absent: its global topics decide for that match). */
export const savedMatchTopics = (): Record<string, MatchTopic[]> => matchTopicsOf(read(MATCH_KEY));
function matchTopicsOf(stored: string | null): Record<string, MatchTopic[]> {
  try {
    const raw: unknown = JSON.parse(stored ?? "{}");
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const out: Record<string, MatchTopic[]> = {};
    for (const [id, v] of Object.entries(raw as Record<string, unknown>)) if (Array.isArray(v)) out[id] = v.filter(isMatchTopic);
    return out;
  } catch {
    return {};
  }
}

function setMatchMirror(map: Record<string, MatchTopic[]> | null): void {
  write(MATCH_KEY, map && Object.keys(map).length ? JSON.stringify(map) : null);
  notifyPreset();
}

/** Re-renders on every change of this device's choices (global topics or a match's). */
export function subscribePushChoice(cb: () => void): () => void {
  choiceListeners.add(cb);
  return () => {
    choiceListeners.delete(cb);
  };
}
/** A snapshot of this device's choices that changes whenever they do (for useSyncExternalStore; read it
 *  back with pushChoiceOf, so what is shown derives from the snapshot alone). */
export const pushChoiceKey = (): string => JSON.stringify([read(KEY), read(MATCH_KEY)]);
/** The choices a pushChoiceKey snapshot holds: the global topics and the overrides per match. */
export function pushChoiceOf(key: string): { topics: Topic[]; matches: Record<string, MatchTopic[]> } {
  let raw: unknown = null;
  try {
    raw = JSON.parse(key);
  } catch {
    /* an empty (server) snapshot */
  }
  const [t, m] = Array.isArray(raw) ? raw : [];
  return { topics: topicsOf(typeof t === "string" ? t : null), matches: matchTopicsOf(typeof m === "string" ? m : null) };
}

const matchCall = httpsCallable<{ endpoint: string; keys?: { p256dh: string; auth: string }; matchId: string; topics: MatchTopic[] | null }, { matchTopics: Record<string, MatchTopic[]>; kept: boolean }>(functions, "pushSetMatchTopics");

/**
 * Chooses this device's notices for one match (`null`: drop the choice, its global topics decide again).
 * Turning something on where the browser has no subscription yet asks for the permission and subscribes
 * first, like setTopics (call it from the tap); the server then keeps this device for this match only.
 * Resolves to the match's override as the server kept it.
 */
export async function setMatchTopics(matchId: string, topics: MatchTopic[] | null): Promise<MatchTopic[] | null> {
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (topics?.length) sub = await ensureSubscription(reg, sub);
  if (!sub) {
    // (no device on the server: nothing of this match reaches it anyway)
    const rest = savedMatchTopics();
    delete rest[matchId];
    setMatchMirror(rest);
    return null;
  }
  const keys = sub.toJSON().keys;
  const { data } = await matchCall({ endpoint: sub.endpoint, ...(keys?.p256dh && keys.auth ? { keys: { p256dh: keys.p256dh, auth: keys.auth } } : {}), matchId, topics });
  setMatchMirror(data.matchTopics);
  return data.matchTopics[matchId] ?? null;
}

// ---------- «Pausar»: this device stops ringing for a while (functions/src/pushPause.ts; the bell keeps everything)

export type { PauseKind } from "../../functions/src/pushPauseLogic";
export { matchEndAt, MAX_PAUSE_MS, tomorrowAtNine } from "../../functions/src/pushPauseLogic";

/** This device's pause as it was chosen: until when (ms) and which of the three («1h», «manana», «partido»). */
export interface PushPause {
  until: number;
  kind: PauseKind;
}
const PAUSE_KEY = "piti-push-pause";
const PAUSE_KINDS: readonly string[] = ["1h", "manana", "partido"];

/** The pause saved on this device (null: none; an expired one reads as none). */
export function savedPause(now: number = Date.now()): PushPause | null {
  return pauseOf(read(PAUSE_KEY), now);
}
function pauseOf(stored: string | null, now: number): PushPause | null {
  try {
    const raw: unknown = JSON.parse(stored ?? "null");
    if (!raw || typeof raw !== "object") return null;
    const { until, kind } = raw as { until?: unknown; kind?: unknown };
    if (typeof until !== "number" || !Number.isFinite(until) || until <= now || typeof kind !== "string" || !PAUSE_KINDS.includes(kind)) return null;
    return { until, kind: kind as PauseKind };
  } catch {
    return null;
  }
}

const pauseCall = httpsCallable<{ endpoint: string; until: number | null }, { pausedUntil: number | null }>(functions, "pushSetPause");

/**
 * Pauses this device until `pause.until` (null: resume now). The server keeps it on the device's subscription (a
 * week at most, clamped there) and sendTo skips the device meanwhile; a device the server doesn't have gets
 * nothing anyway, so the choice is only kept here. Resolves to the pause kept.
 */
export async function setPushPause(pause: PushPause | null): Promise<PushPause | null> {
  let kept = pause;
  const reg = typeof navigator !== "undefined" && "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
  const sub = reg && "pushManager" in reg ? await reg.pushManager.getSubscription() : null;
  if (sub) {
    try {
      const { data } = await pauseCall({ endpoint: sub.endpoint, until: pause?.until ?? null });
      kept = pause && data.pausedUntil !== null ? { until: data.pausedUntil, kind: pause.kind } : null;
    } catch (e) {
      // (the server forgot this device: nothing reaches it, so the pause is only this device's word)
      if (code(e) !== "functions/not-found") throw e;
    }
  }
  write(PAUSE_KEY, kept ? JSON.stringify(kept) : null);
  notifyPreset();
  return kept;
}

const pauseSnapshot = (): string => read(PAUSE_KEY) ?? "";

/** This device's pause, live across the app (null: none, or over at `now`), and its setter. */
export function usePushPause(now: number = Date.now()): { pause: PushPause | null; set: (p: PushPause | null) => Promise<PushPause | null> } {
  const subscribe = useCallback((cb: () => void) => {
    presetListeners.add(cb);
    return () => {
      presetListeners.delete(cb);
    };
  }, []);
  const key = useSyncExternalStore(subscribe, pauseSnapshot, () => "");
  return { pause: pauseOf(key || null, now), set: setPushPause };
}
