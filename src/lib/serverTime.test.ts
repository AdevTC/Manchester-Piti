import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addSample,
  dateHeaderOffset,
  KEEP,
  pickOffset,
  recordDateHeader,
  recordServerTime,
  resetServerTime,
  roundTripSample,
  serverNow,
  serverOffset,
  subscribeServerTime,
  withServerTime,
} from "./serverTime";
import { freshTiming } from "./bundle";

vi.mock("../firebase", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({ loadBundle: vi.fn() }));

beforeEach(() => resetServerTime());
afterEach(() => vi.useRealTimers());

describe("the offset maths", () => {
  it("a round trip: the server's time minus the midpoint of the request", () => {
    // sent at 1000, answered at 1400 (midpoint 1200), the server read 91_200: the phone is 90 s behind
    expect(roundTripSample(91_200, 1000, 1400)).toEqual({ offset: 90_000, rtt: 400 });
    expect(roundTripSample(1_150, 1000, 1400)).toEqual({ offset: -50, rtt: 400 });
  });

  it("a missing or broken serverNow (an older server), a reversed or endless round trip: no sample", () => {
    expect(roundTripSample(undefined, 1000, 1400)).toBeNull();
    expect(roundTripSample("91200", 1000, 1400)).toBeNull();
    expect(roundTripSample(Number.NaN, 1000, 1400)).toBeNull();
    expect(roundTripSample(5000, 1400, 1000)).toBeNull();
    expect(roundTripSample(5000, 1000, 60_000)).toBeNull();
    expect(roundTripSample(1000 + 13 * 3_600_000, 1000, 1000)).toBeNull();
  });

  it("the sample with the shortest round trip wins (the newest on a tie); the header only without any", () => {
    expect(pickOffset([], null)).toBe(0);
    expect(pickOffset([], 2_000)).toBe(2_000);
    expect(pickOffset([{ offset: 900, rtt: 800 }, { offset: 1_000, rtt: 120 }, { offset: 1_300, rtt: 600 }], 2_000)).toBe(1_000);
    expect(pickOffset([{ offset: 900, rtt: 120 }, { offset: 1_000, rtt: 120 }], null)).toBe(1_000);
  });

  it("keeps only the newest samples", () => {
    let list = [{ offset: 0, rtt: 1 }];
    for (let i = 1; i <= KEEP + 3; i++) list = addSample(list, { offset: i, rtt: 500 });
    expect(list).toHaveLength(KEEP);
    expect(list[0].offset).toBe(4);
    // the old precise sample has gone: a phone whose clock was changed recovers
    expect(pickOffset(list, null)).toBe(KEEP + 3);
  });

  it("a Date header: whole seconds, so the middle of that second", () => {
    const sent = Date.parse("2026-10-14T18:00:00.000Z");
    expect(dateHeaderOffset("Wed, 14 Oct 2026 18:01:30 GMT", sent, sent + 200)).toBe(90_400);
    expect(dateHeaderOffset("nonsense", sent, sent + 200)).toBeNull();
    expect(dateHeaderOffset(null, sent, sent + 200)).toBeNull();
  });
});

describe("the shared offset", () => {
  it("serverNow is the phone's time plus the best estimate; a callable sample beats the header", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    expect(serverNow()).toBe(1_000_000);
    recordDateHeader(new Date(1_000_000 + 30_000).toUTCString(), 1_000_000, 1_000_000);
    expect(serverOffset()).toBe(30_500);
    recordServerTime(1_000_000 + 90_100, 1_000_000, 1_000_200);
    expect(serverOffset()).toBe(90_000);
    expect(serverNow()).toBe(1_090_000);
    // a later header does not override a callable sample
    recordDateHeader(new Date(1_000_000).toUTCString(), 1_000_000, 1_000_000);
    expect(serverOffset()).toBe(90_000);
  });

  it("survives a reload through sessionStorage", async () => {
    recordServerTime(5_000, 1_000, 1_000);
    expect(serverOffset()).toBe(4_000);
    vi.resetModules();
    const reloaded = await import("./serverTime");
    expect(reloaded.serverOffset()).toBe(4_000);
  });

  it("a stored copy with broken samples keeps only the good ones", () => {
    sessionStorage.setItem("mp:serverTime", JSON.stringify({ samples: [{ offset: 7_000, rtt: 50 }, { offset: "x" }, null], header: "y" }));
    expect(serverOffset()).toBe(7_000);
  });

  it("a corrupt or blocked sessionStorage: offset 0, nothing thrown", () => {
    sessionStorage.setItem("mp:serverTime", "{nope");
    expect(serverOffset()).toBe(0);
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    recordServerTime(3_000, 1_000, 1_000);
    expect(serverOffset()).toBe(2_000);
    spy.mockRestore();
  });

  it("tells subscribers when the offset changes (and only then)", () => {
    const fn = vi.fn();
    const off = subscribeServerTime(fn);
    recordServerTime(3_000, 1_000, 1_000);
    expect(fn).toHaveBeenCalledTimes(1);
    recordServerTime(3_000, 1_000, 1_000);
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    recordServerTime(9_000, 1_000, 1_000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("a wrapped callable records the serverNow of its answer and passes the answer through", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(2_000_000);
    const call = vi.fn(async (d: { matchId: string }) => {
      vi.setSystemTime(2_000_400);
      return { data: { events: d.matchId === "m" ? 3 : 0, serverNow: 2_000_200 + 45_000 } };
    });
    const wrapped = withServerTime(call);
    await expect(wrapped({ matchId: "m" })).resolves.toEqual({ data: { events: 3, serverNow: 2_045_200 } });
    expect(call).toHaveBeenCalledWith({ matchId: "m" });
    expect(serverOffset()).toBe(45_000);
  });

  it("an answer without serverNow (an older server) and a failed call change nothing", async () => {
    await withServerTime(async () => ({ data: { events: 1 } }))(undefined);
    expect(serverOffset()).toBe(0);
    await expect(withServerTime(async () => Promise.reject(new Error("no")))(undefined)).rejects.toThrow("no");
    expect(serverOffset()).toBe(0);
  });
});

describe("the bundle's Date header", () => {
  const entry = { transferSize: 5_000, workerStart: 0, requestStart: 100, responseStart: 180 };
  it("only for an answer that came over the network just now", () => {
    expect(freshTiming(entry, 1_000)).toEqual({ sentAt: 1_100, receivedAt: 1_180 });
    expect(freshTiming(undefined, 1_000)).toBeNull();
    // the browser's cache, the service worker's stale-while-revalidate copy
    expect(freshTiming({ ...entry, transferSize: 0 }, 1_000)).toBeNull();
    expect(freshTiming({ ...entry, workerStart: 90 }, 1_000)).toBeNull();
    expect(freshTiming({ ...entry, requestStart: 0 }, 1_000)).toBeNull();
  });
});
