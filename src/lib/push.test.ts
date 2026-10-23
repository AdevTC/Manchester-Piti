// This device's push subscription kept alive (src/lib/push.ts): the boot check re-asserts a lost or
// renewed subscription at most once a day, a stale session (signed out, another account) at once, the
// service worker's own re-subscription at once, and all-well once a week (to learn whether the server
// dropped it); setTopics remembers what the server accepted and leaves the service worker what it needs.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ call: vi.fn(), auth: { currentUser: null as { uid: string } | null } }));
vi.mock("firebase/functions", () => ({ httpsCallable: () => h.call }));
vi.mock("../firebase", () => ({ functions: {}, auth: h.auth, FUNCTIONS_REGION: "europe-southwest1" }));

import { REASSERT_EVERY_MS, reassertDue, reassertPush, REVERIFY_EVERY_MS, pushChoiceKey, pushChoiceOf, savedMatchTopics, setMatchTopics, setPushPreset, setTopics, upgradeLegacyTopics, type ReassertInput } from "./push";

const DAY = REASSERT_EVERY_MS;
const WEEK = REVERIFY_EVERY_MS;
const T0 = Date.UTC(2026, 9, 14, 9);

interface FakeSub {
  endpoint: string;
  toJSON: () => { endpoint: string; keys: { p256dh: string; auth: string } };
  unsubscribe: () => Promise<boolean>;
}
let n = 0;
const fakeSub = (endpoint: string): FakeSub => ({
  endpoint,
  toJSON: () => ({ endpoint, keys: { p256dh: "k", auth: "a" } }),
  unsubscribe: async () => {
    current = null;
    return true;
  },
});

let current: FakeSub | null;
let permission: NotificationPermission;
const subscribe = vi.fn(async () => (current = fakeSub(`https://push.test/new-${++n}`)));
const requestPermission = vi.fn(async () => permission);
const store = new Map<string, Response>();
const cachePut = vi.fn(async (key: string, res: Response) => void store.set(key, res));
const cacheDelete = vi.fn(async (key: string) => store.delete(key));
const cacheMatch = vi.fn(async (key: string) => store.get(key));
type Sent = { subscription: { endpoint: string }; topics: string[]; v?: number; resetMatches?: boolean };
/** What each call sent, without `v` (every registration carries the app's topic list version: the
 *  «tabla» tests check it). */
const sent = () =>
  h.call.mock.calls.map((c) => {
    const out = { ...(c[0] as Sent) };
    delete out.v;
    return out;
  });
const sentV = () => h.call.mock.calls.map((c) => (c[0] as Sent).v);

beforeEach(() => {
  localStorage.clear();
  store.clear();
  n = 0;
  current = null;
  permission = "granted";
  h.auth.currentUser = { uid: "socio" };
  h.call.mockReset().mockResolvedValue({ data: { topics: [], known: true } });
  subscribe.mockClear();
  requestPermission.mockClear();
  cachePut.mockClear();
  cacheDelete.mockClear();
  const reg = { pushManager: { getSubscription: async () => current, subscribe } };
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { ready: Promise.resolve(reg), getRegistration: async () => reg } });
  vi.stubGlobal("PushManager", function PushManager() {});
  vi.stubGlobal("Notification", {
    get permission() {
      return permission;
    },
    requestPermission,
  });
  vi.stubGlobal("caches", { open: async () => ({ put: cachePut, delete: cacheDelete, match: cacheMatch }) });
});
afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "serviceWorker");
});

/** A device the server accepted at T0, signed in as «socio». */
const registered = (endpoint = "https://push.test/a", topics: string[] = ["goals"], session = "socio") => {
  current = fakeSub(endpoint);
  localStorage.setItem("piti-push-topics", JSON.stringify(topics));
  localStorage.setItem("piti-push-endpoint", endpoint);
  localStorage.setItem("piti-push-session", session);
  localStorage.setItem("piti-push-checked", String(T0));
  localStorage.setItem("piti-push-accepted", "1");
};

describe("reassertDue: when the boot check re-tells the server", () => {
  const due = (o: Partial<ReassertInput>) =>
    reassertDue({ topics: ["goals"], permission: "granted", endpoint: "https://push.test/a", registered: "https://push.test/a", session: "u1", registeredSession: "u1", triedSession: "u1", dirty: false, lastTry: T0, now: T0 + 60_000, ...o });
  it("a lost subscription, or one the server never accepted: at most once a day", () => {
    expect(due({ endpoint: null })).toBe(false);
    expect(due({ endpoint: null, lastTry: T0 - DAY })).toBe(true);
    expect(due({ endpoint: "https://push.test/b", lastTry: null })).toBe(true);
    // an old device that never recorded what the server accepted: once
    expect(due({ registered: null, registeredSession: null, lastTry: null })).toBe(true);
  });
  it("all well: once a week anyway (the server may have dropped it on a 410)", () => {
    expect(due({ lastTry: T0 - 6 * DAY })).toBe(false);
    expect(due({ lastTry: T0 - WEEK + 60_000 })).toBe(true);
  });
  it("at once (whatever the daily limit) after the worker re-subscribed by itself", () => {
    expect(due({ dirty: true })).toBe(true);
  });
  it("at once when the session changed (signed out, another account) — once per change", () => {
    expect(due({ session: "", triedSession: "u1" })).toBe(true);
    expect(due({ session: "u2", triedSession: "u1" })).toBe(true);
    // tried already for this session (it failed): daily, not weekly
    expect(due({ session: "", triedSession: "" })).toBe(false);
    expect(due({ session: "", triedSession: "", lastTry: T0 - DAY })).toBe(true);
    // a device registered before sessions were recorded: once, then daily
    expect(due({ registeredSession: null, triedSession: null })).toBe(true);
    expect(due({ registeredSession: null, triedSession: "u1" })).toBe(false);
    expect(due({ registeredSession: null, triedSession: "u1", lastTry: T0 - DAY })).toBe(true);
  });
  it("never without topics or without the browser's permission (it never asks)", () => {
    expect(due({ topics: [], dirty: true })).toBe(false);
    expect(due({ permission: "default", dirty: true })).toBe(false);
    expect(due({ permission: "denied", endpoint: null, lastTry: null })).toBe(false);
  });
  it("a clock set back counts as due", () => {
    expect(due({ now: T0 - 60_000 })).toBe(true);
  });
});

describe("«tabla» on a «Todo» from before it", () => {
  const core = ["start", "goals", "cards", "final", "mvp", "dates", "lineup"] as const;
  it("upgradeLegacyTopics: only a «Todo» saved by an app that never offered it", () => {
    expect(upgradeLegacyTopics([...core], null)).toEqual([...core, "tabla"]);
    expect(upgradeLegacyTopics([...core, "convocatoria"], null)).toEqual([...core, "convocatoria", "tabla"]);
    expect(upgradeLegacyTopics([...core], "2")).toBeNull();
    expect(upgradeLegacyTopics(["goals"], null)).toBeNull();
    expect(upgradeLegacyTopics([...core, "tabla"], null)).toBeNull();
  });
  it("the boot check adds it and tells the server at once, with the app's version", async () => {
    registered("https://push.test/a", [...core]);
    // (not due: re-told an hour ago)
    expect(await reassertPush(T0 + 3600_000)).toBe("ok");
    expect(sent()).toEqual([{ subscription: current!.toJSON(), topics: [...core, "tabla"] }]);
    expect(sentV()).toEqual([2]);
    expect(JSON.parse(localStorage.getItem("piti-push-topics") ?? "[]")).toEqual([...core, "tabla"]);
    expect(localStorage.getItem("piti-push-topics-v")).toBe("2");
    // once told, it rests again; and a «Todo» chosen without it later stays without it
    expect(await reassertPush(T0 + 7200_000)).toBe("skip");
  });
  it("choosing a preset drops the device's choices for single matches, on the server and here", async () => {
    registered("https://push.test/a", ["goals"]);
    localStorage.setItem("piti-push-matches", JSON.stringify({ j8: ["cards"] }));
    await setPushPreset("goles", false);
    expect(sent().at(-1)).toMatchObject({ topics: ["goals"], resetMatches: true });
    expect(savedMatchTopics()).toEqual({});
  });
});

describe("reassertPush on app boot", () => {
  it("a lost subscription: subscribes again silently and sends the saved topics, then rests", async () => {
    registered("https://push.test/old", ["goals", "convocatoria"]);
    current = null;
    expect(await reassertPush(T0 + DAY)).toBe("ok");
    expect(requestPermission).not.toHaveBeenCalled();
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(sent()).toEqual([{ subscription: fakeSub("https://push.test/new-1").toJSON(), topics: ["goals", "convocatoria"] }]);
    expect(localStorage.getItem("piti-push-endpoint")).toBe("https://push.test/new-1");
    // the server has it now: nothing more until the weekly check
    expect(await reassertPush(T0 + 2 * DAY)).toBe("skip");
    expect(h.call).toHaveBeenCalledTimes(1);
  });
  it("a subscription the server doesn't know yet (renewed by the browser): re-sent, not re-subscribed", async () => {
    registered("https://push.test/old", ["start"]);
    current = fakeSub("https://push.test/renewed");
    expect(await reassertPush(T0 + DAY)).toBe("ok");
    expect(subscribe).not.toHaveBeenCalled();
    expect(sent()[0]).toEqual({ subscription: current.toJSON(), topics: ["start"] });
  });
  it("signed out: at once, without the personal topics (so the server drops the uid and them)", async () => {
    registered("https://push.test/a", ["goals", "convocatoria", "door"]);
    h.auth.currentUser = null;
    expect(await reassertPush(T0 + 60_000)).toBe("ok");
    expect(sent()).toEqual([{ subscription: current!.toJSON(), topics: ["goals"] }]);
    expect(localStorage.getItem("piti-push-session")).toBe("");
    // the saved choice stays: signing in again sends it whole, at once
    h.auth.currentUser = { uid: "socio" };
    expect(await reassertPush(T0 + 120_000)).toBe("ok");
    expect(sent()[1].topics).toEqual(["goals", "convocatoria", "door"]);
    expect(await reassertPush(T0 + 180_000)).toBe("skip");
  });
  it("another account on this device: at once, under the new session", async () => {
    registered();
    h.auth.currentUser = { uid: "otro" };
    expect(await reassertPush(T0 + 60_000)).toBe("ok");
    expect(localStorage.getItem("piti-push-session")).toBe("otro");
  });
  it("the worker re-subscribed by itself (its «dirty» mark): the full set at once, and the mark goes", async () => {
    registered("https://push.test/a", ["goals", "convocatoria"]);
    store.set("/__piti-push-dirty", new Response("1"));
    expect(await reassertPush(T0 + 60_000)).toBe("ok");
    expect(sent()[0].topics).toEqual(["goals", "convocatoria"]);
    expect(store.has("/__piti-push-dirty")).toBe(false);
  });
  it("the weekly check finds the server dropped this endpoint (410): renews the subscription", async () => {
    registered();
    h.call.mockResolvedValueOnce({ data: { topics: ["goals"], known: false } });
    expect(await reassertPush(T0 + WEEK)).toBe("renewed");
    // the dead one's doc goes again, then the fresh subscription is registered
    expect(sent().map((c) => [c.subscription.endpoint, c.topics])).toEqual([
      ["https://push.test/a", ["goals"]],
      ["https://push.test/a", []],
      ["https://push.test/new-1", ["goals"]],
    ]);
    expect(localStorage.getItem("piti-push-endpoint")).toBe("https://push.test/new-1");
  });
  it("a device the server kept no doc for last time (no topics it accepted): «didn't know it» is no news", async () => {
    registered();
    localStorage.setItem("piti-push-accepted", "0");
    h.call.mockResolvedValueOnce({ data: { topics: ["goals"], known: false } });
    expect(await reassertPush(T0 + WEEK)).toBe("ok");
    expect(subscribe).not.toHaveBeenCalled();
    expect(h.call).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("piti-push-accepted")).toBe("1");
  });
  it("another account that may not have the door: registered without it, under the new session", async () => {
    registered("https://push.test/a", ["goals", "door"], "capitan");
    h.auth.currentUser = { uid: "socio" };
    h.call.mockRejectedValueOnce(Object.assign(new Error("Solo los administradores reciben la puerta."), { code: "functions/permission-denied" }));
    expect(await reassertPush(T0 + 60_000)).toBe("ok");
    expect(sent().map((c) => c.topics)).toEqual([["goals", "door"], ["goals"]]);
    expect(localStorage.getItem("piti-push-session")).toBe("socio");
    // the device's choice stays: a captain signing in here gets the door back
    expect(JSON.parse(localStorage.getItem("piti-push-topics")!)).toEqual(["goals", "door"]);
  });
  it("other errors are not retried without topics (and the toggles never retry silently)", async () => {
    registered("https://push.test/a", ["goals", "door"], "capitan");
    h.auth.currentUser = { uid: "socio" };
    h.call.mockRejectedValueOnce(Object.assign(new Error("offline"), { code: "functions/unavailable" }));
    expect(await reassertPush(T0 + 60_000)).toBe("failed");
    expect(h.call).toHaveBeenCalledTimes(1);
    h.call.mockReset().mockRejectedValueOnce(Object.assign(new Error("no"), { code: "functions/permission-denied" }));
    await expect(setTopics(["goals", "door"])).rejects.toThrow("no");
    expect(h.call).toHaveBeenCalledTimes(1);
  });
  it("a first registration the server doesn't know yet is not a dropped one", async () => {
    localStorage.setItem("piti-push-topics", JSON.stringify(["goals"]));
    h.call.mockResolvedValueOnce({ data: { topics: ["goals"], known: false } });
    expect(await reassertPush(T0)).toBe("ok");
    expect(subscribe).toHaveBeenCalledTimes(1);
  });
  it("a failed attempt waits a day before trying again", async () => {
    localStorage.setItem("piti-push-topics", JSON.stringify(["goals"]));
    h.call.mockRejectedValueOnce(new Error("offline"));
    expect(await reassertPush(T0)).toBe("failed");
    expect(await reassertPush(T0 + DAY - 1)).toBe("skip");
    expect(h.call).toHaveBeenCalledTimes(1);
    expect(await reassertPush(T0 + DAY)).toBe("ok");
    expect(h.call).toHaveBeenCalledTimes(2);
  });
  it("nothing without saved topics, without permission, or with all well this week", async () => {
    expect(await reassertPush(T0)).toBe("skip");
    registered();
    permission = "default";
    expect(await reassertPush(T0 + WEEK)).toBe("skip");
    expect(requestPermission).not.toHaveBeenCalled();
    permission = "granted";
    expect(await reassertPush(T0 + 6 * DAY)).toBe("skip");
    expect(subscribe).not.toHaveBeenCalled();
    expect(h.call).not.toHaveBeenCalled();
  });
  it("two boots at once (StrictMode) send it once", async () => {
    localStorage.setItem("piti-push-topics", JSON.stringify(["goals"]));
    const [a, b] = await Promise.all([reassertPush(T0), reassertPush(T0)]);
    expect([a, b]).toEqual(["ok", "ok"]);
    expect(h.call).toHaveBeenCalledTimes(1);
  });
});

describe("setTopics remembers what the server accepted", () => {
  it("stores the endpoint and session, and leaves the worker the topics, the endpoint and the callables", async () => {
    await setTopics(["goals", "door"]);
    expect(localStorage.getItem("piti-push-endpoint")).toBe("https://push.test/new-1");
    expect(localStorage.getItem("piti-push-session")).toBe("socio");
    const state = (await store.get("/__piti-push-state")!.json()) as { topics: string[]; endpoint: string; subscribe: string; unsubscribe: string };
    expect(state.topics).toEqual(["goals", "door"]);
    expect(state.endpoint).toBe("https://push.test/new-1");
    expect(state.subscribe).toMatch(/europe-southwest1.*pushSubscribe$/);
    expect(state.unsubscribe).toMatch(/pushUnsubscribe$/);
  });
  it("no topics: forgets it all, so the worker keeps nothing alive", async () => {
    await setTopics(["goals"]);
    await setTopics([]);
    expect(localStorage.getItem("piti-push-endpoint")).toBeNull();
    expect(localStorage.getItem("piti-push-session")).toBeNull();
    expect(store.has("/__piti-push-state")).toBe(false);
  });
});

describe("setMatchTopics: this device's avisos for one match", () => {
  it("the first one on a device without notices asks, subscribes and sends its keys; the server's answer is kept", async () => {
    permission = "default";
    requestPermission.mockImplementationOnce(async () => (permission = "granted"));
    h.call.mockResolvedValue({ data: { matchTopics: { j8: ["goals"] }, kept: true } });
    await expect(setMatchTopics("j8", ["goals"])).resolves.toEqual(["goals"]);
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(h.call).toHaveBeenLastCalledWith({ endpoint: "https://push.test/new-1", keys: { p256dh: "k", auth: "a" }, matchId: "j8", topics: ["goals"] });
    expect(savedMatchTopics()).toEqual({ j8: ["goals"] });
  });
  it("refused permission: nothing is sent", async () => {
    permission = "default";
    requestPermission.mockImplementationOnce(async () => (permission = "denied"));
    await expect(setMatchTopics("j8", ["goals"])).rejects.toThrow("permiso");
    expect(h.call).not.toHaveBeenCalled();
  });
  it("«Nada» forgets the device's choices for single matches too", async () => {
    registered();
    h.call.mockResolvedValue({ data: { matchTopics: { j8: [] }, kept: true } });
    await setMatchTopics("j8", []);
    expect(savedMatchTopics()).toEqual({ j8: [] });
    expect(pushChoiceOf(pushChoiceKey())).toEqual({ topics: ["goals"], matches: { j8: [] } });
    expect(pushChoiceOf("")).toEqual({ topics: [], matches: {} });
    h.call.mockResolvedValue({ data: { topics: [] } });
    await setTopics([]);
    expect(savedMatchTopics()).toEqual({});
  });
});
