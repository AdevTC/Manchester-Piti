// The liveEvent wrapper: the Firebase SDK encodes an `undefined` value as `null`, which the callable's zod
// `.optional()` refuses (functions/src/live.ts), so absent keys must not travel at all.
import { beforeEach, describe, expect, it, vi } from "vitest";

const fx = vi.hoisted(() => ({ calls: [] as { name: string; data: unknown }[] }));
vi.mock("../firebase", () => ({ db: {}, functions: {} }));
vi.mock("firebase/functions", () => ({
  httpsCallable: (_f: unknown, name: string) => async (data: unknown) => {
    fx.calls.push({ name, data });
    return { data: { events: 1 } };
  },
}));

import { liveEvent } from "./clubApi";

beforeEach(() => {
  fx.calls = [];
});

describe("liveEvent drops undefined keys before the callable", () => {
  it("from the envelope and from the event (a match without a clock, a team chance)", async () => {
    await liveEvent({ action: "add", matchId: "m1", requestId: "r1", clockRevision: undefined, manualTime: false, event: { type: "chance", minute: 12, playerId: undefined, assistPlayerId: undefined, inPlayerId: undefined } });
    expect(fx.calls).toStrictEqual([{ name: "liveEvent", data: { action: "add", matchId: "m1", requestId: "r1", manualTime: false, event: { type: "chance", minute: 12 } } }]);
    expect(JSON.stringify(fx.calls[0].data)).not.toContain("null");
  });
  it("keeps every defined value as it was (falsy ones too) and in the same order", async () => {
    const data = { action: "add" as const, matchId: "m1", requestId: "r1", clockRevision: 0, manualTime: false, event: { type: "goal" as const, minute: 0, playerId: "erik", assistPlayerId: "adrian" } };
    await liveEvent(data);
    expect(JSON.stringify(fx.calls[0].data)).toBe(JSON.stringify(data));
  });
  it("undo / finish / reopen too", async () => {
    await liveEvent({ action: "undo", matchId: "m1", eventId: undefined });
    await liveEvent({ action: "finish", matchId: "m1" });
    expect(fx.calls.map((c) => c.data)).toStrictEqual([{ action: "undo", matchId: "m1" }, { action: "finish", matchId: "m1" }]);
  });
});
