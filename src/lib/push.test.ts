// This device's push subscription kept alive (src/lib/push.ts): the boot check re-asserts a lost or
// renewed subscription at most once a day, silently; setTopics remembers what the server accepted and
// leaves the service worker what it needs to re-subscribe by itself.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("firebase/functions", () => ({ httpsCallable: () => h.call }));
vi.mock("../firebase", () => ({ functions: {}, FUNCTIONS_REGION: "europe-southwest1" }));

import { REASSERT_EVERY_MS, reassertDue, reassertPush, setTopics } from "./push";

const DAY = REASSERT_EVERY_MS;
const T0 = Date.UTC(2026, 9, 14, 9);

interface FakeSub {
  endpoint: string;
  toJSON: () => { endpoint: string; keys: { p256dh: string; auth: string } };
  unsubscribe: () => Promise<boolean>;
}
const fakeSub = (endpoint: string): FakeSub => ({ endpoint, toJSON: () => ({ endpoint, keys: { p256dh: "k", auth: "a" } }), unsubscribe: async () => true });

let current: FakeSub | null;
let permission: NotificationPermission;
const subscribe = vi.fn(async () => (current = fakeSub("https://push.test/new")));
const requestPermission = vi.fn(async () => permission);
const cachePut = vi.fn(async (_key: string, _res: Response) => undefined);
const cacheDelete = vi.fn(async (_key: string) => true);

beforeEach(() => {
  localStorage.clear();
  current = null;
  permission = "granted";
  h.call.mockReset().mockResolvedValue({ data: { topics: [] } });
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
  vi.stubGlobal("caches", { open: async () => ({ put: cachePut, delete: cacheDelete }) });
});
afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "serviceWorker");
});

describe("reassertDue: when the boot check re-tells the server", () => {
  const due = (o: Partial<Parameters<typeof reassertDue>[0]>) => reassertDue({ topics: ["goals"], permission: "granted", endpoint: null, registered: "https://push.test/a", lastTry: null, now: T0, ...o });
  it("a lost subscription, or one the server never accepted (renewed by the browser)", () => {
    expect(due({ endpoint: null })).toBe(true);
    expect(due({ endpoint: "https://push.test/b" })).toBe(true);
    // an old device that never recorded what the server accepted: once
    expect(due({ endpoint: "https://push.test/a", registered: null })).toBe(true);
  });
  it("not when all is well, without topics, or without the browser's permission (it never asks)", () => {
    expect(due({ endpoint: "https://push.test/a" })).toBe(false);
    expect(due({ topics: [] })).toBe(false);
    expect(due({ permission: "default" })).toBe(false);
    expect(due({ permission: "denied" })).toBe(false);
  });
  it("at most once a day (a clock set back counts as due)", () => {
    expect(due({ lastTry: T0 - DAY + 1 })).toBe(false);
    expect(due({ lastTry: T0 - DAY })).toBe(true);
    expect(due({ lastTry: T0 + 60_000 })).toBe(true);
  });
});

describe("reassertPush on app boot", () => {
  it("a lost subscription: subscribes again silently and sends the saved topics, then rests", async () => {
    localStorage.setItem("piti-push-topics", JSON.stringify(["goals", "convocatoria"]));
    localStorage.setItem("piti-push-endpoint", "https://push.test/old");
    expect(await reassertPush(T0)).toBe("ok");
    expect(requestPermission).not.toHaveBeenCalled();
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(h.call).toHaveBeenCalledWith({ subscription: fakeSub("https://push.test/new").toJSON(), topics: ["goals", "convocatoria"] });
    expect(localStorage.getItem("piti-push-endpoint")).toBe("https://push.test/new");
    // the server has it now: nothing more, today or tomorrow
    expect(await reassertPush(T0 + 60_000)).toBe("skip");
    expect(await reassertPush(T0 + 2 * DAY)).toBe("skip");
    expect(h.call).toHaveBeenCalledTimes(1);
  });
  it("a subscription the server doesn't know (renewed by the worker): re-sent without subscribing again", async () => {
    localStorage.setItem("piti-push-topics", JSON.stringify(["start"]));
    localStorage.setItem("piti-push-endpoint", "https://push.test/old");
    current = fakeSub("https://push.test/renewed");
    expect(await reassertPush(T0)).toBe("ok");
    expect(subscribe).not.toHaveBeenCalled();
    expect(h.call).toHaveBeenCalledWith({ subscription: current.toJSON(), topics: ["start"] });
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
  it("nothing without saved topics, without permission, or with the subscription the server accepted", async () => {
    expect(await reassertPush(T0)).toBe("skip");
    localStorage.setItem("piti-push-topics", JSON.stringify(["goals"]));
    permission = "default";
    expect(await reassertPush(T0)).toBe("skip");
    expect(requestPermission).not.toHaveBeenCalled();
    permission = "granted";
    current = fakeSub("https://push.test/a");
    localStorage.setItem("piti-push-endpoint", "https://push.test/a");
    expect(await reassertPush(T0)).toBe("skip");
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
  it("stores the endpoint and leaves the worker the topics and the callables' URLs", async () => {
    await setTopics(["goals", "door"]);
    expect(localStorage.getItem("piti-push-endpoint")).toBe("https://push.test/new");
    expect(cachePut).toHaveBeenCalledTimes(1);
    const [key, res] = cachePut.mock.calls[0];
    expect(key).toBe("/__piti-push-state");
    const state = (await res.json()) as { topics: string[]; subscribe: string; unsubscribe: string };
    expect(state.topics).toEqual(["goals", "door"]);
    expect(state.subscribe).toMatch(/europe-southwest1.*pushSubscribe$/);
    expect(state.unsubscribe).toMatch(/pushUnsubscribe$/);
  });
  it("no topics: forgets both, so the worker keeps nothing alive", async () => {
    await setTopics(["goals"]);
    await setTopics([]);
    expect(localStorage.getItem("piti-push-endpoint")).toBeNull();
    expect(cacheDelete).toHaveBeenCalledWith("/__piti-push-state");
  });
});
