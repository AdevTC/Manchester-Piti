// /api/now is asked only while a match is live or waiting for its whistle, and at serverTime's pace.
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readyClock } from "../../functions/src/matchClock";
import { resetServerTime, serverOffset, SYNC_EVERY } from "../lib/serverTime";
import { liveOrWaiting, useServerTimeSync } from "./useServerTimeSync";

const MIN = 60_000;
const DATE = Date.UTC(2026, 9, 14, 18);
const fetchMock = vi.fn(async () => new Response(JSON.stringify({ now: Date.now() + 30_000 }), { headers: { "content-type": "application/json" } }));

beforeEach(() => {
  resetServerTime();
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("live or waiting: a started clock, or the date come and nobody has whistled; not before, not after, not cancelled", () => {
  const scheduled = { status: "scheduled", date: DATE, duration: 50, clock: readyClock() };
  expect(liveOrWaiting([scheduled], DATE - 10 * MIN)).toBe(false);
  expect(liveOrWaiting([scheduled], DATE + 5 * MIN)).toBe(true);
  expect(liveOrWaiting([{ ...scheduled, clock: { phase: "first" as const, revision: 1, firstStartedAt: DATE } }], DATE + 20 * MIN)).toBe(true);
  expect(liveOrWaiting([{ ...scheduled, status: "cancelled" }], DATE + 5 * MIN)).toBe(false);
  expect(liveOrWaiting([{ ...scheduled, status: "finished" }], DATE + 5 * MIN)).toBe(false);
  expect(liveOrWaiting([], DATE)).toBe(false);
});

it("no match on: nothing is asked", async () => {
  const { rerender } = renderHook(({ now }) => useServerTimeSync(false, now), { initialProps: { now: DATE } });
  rerender({ now: DATE + MIN });
  await Promise.resolve();
  expect(fetchMock).not.toHaveBeenCalled();
});

it("a match on: asked once, not again on every tick, again after 30 min", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(DATE);
  const { rerender } = renderHook(({ now }) => useServerTimeSync(true, now), { initialProps: { now: DATE } });
  await vi.waitFor(() => expect(Math.abs(serverOffset() - 30_000)).toBeLessThan(1_000));
  for (let i = 1; i <= 4; i++) rerender({ now: DATE + i * 15_000 });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  vi.setSystemTime(DATE + SYNC_EVERY + 1);
  rerender({ now: DATE + SYNC_EVERY + 1 });
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
});
