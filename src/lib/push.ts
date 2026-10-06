// Push notices on this device (Web Push, the club's own VAPID keys; functions/src/push.ts sends them).
// The topics chosen are kept on the device and on the server, by subscription.
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

export const VAPID_PUBLIC = "BAZRaiFp6DqaRb1e2ONwNyUivVNI6AqQCrb-ovbyBJ7c_BYYHRt9SrPbE96MjDZfasbQrRqDREKCG6z7Ug3uDYc";
export type Topic = "start" | "goals" | "final" | "mvp" | "dates";
export const TOPIC_LABELS: { id: Topic; label: string; hint?: string }[] = [
  { id: "start", label: "Cuando empiece el partido" },
  { id: "goals", label: "Cada gol", hint: "Del Piti y del rival, en directo" },
  { id: "final", label: "Resultado final" },
  { id: "mvp", label: "Se abre el voto del MVP" },
  { id: "dates", label: "Fechas nuevas y cambios", hint: "Partidos nuevos o cambios de hora" },
];
const KEY = "piti-push-topics";

const subscribeCall = httpsCallable<{ subscription: PushSubscriptionJSON; topics: Topic[] }, { topics: Topic[] }>(functions, "pushSubscribe");

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

export function savedTopics(): Topic[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as Topic[];
  } catch {
    return [];
  }
}

const keyBytes = (base64: string) => {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

/** Subscribes this device to `topics` (asks for permission the first time); an empty list stops all notices. */
export async function setTopics(topics: Topic[]): Promise<Topic[]> {
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!topics.length) {
    if (sub) await subscribeCall({ subscription: sub.toJSON(), topics: [] }).catch(() => undefined);
    await sub?.unsubscribe();
  } else {
    if (Notification.permission !== "granted" && (await Notification.requestPermission()) !== "granted") throw new Error("Sin permiso para avisos en este navegador.");
    sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC) });
    await subscribeCall({ subscription: sub.toJSON(), topics });
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(topics));
  } catch {
    /* storage can be off */
  }
  return topics;
}
