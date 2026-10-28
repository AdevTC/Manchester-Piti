// The liveEvent wrapper: the Firebase SDK encodes an `undefined` value as `null`, which the callable's zod
// `.optional()` refuses (functions/src/live.ts), so absent keys must not travel at all.
import { beforeEach, describe, expect, it, vi } from "vitest";

const fx = vi.hoisted(() => ({ calls: [] as { name: string; data: unknown }[], timeouts: new Map<string, number | undefined>() }));
vi.mock("../firebase", () => ({ db: {}, functions: {} }));
vi.mock("firebase/functions", () => ({
  httpsCallable: (_f: unknown, name: string, options?: { timeout?: number }) => {
    fx.timeouts.set(name, options?.timeout);
    return async (data: unknown) => {
      fx.calls.push({ name, data });
      return { data: { events: 1 } };
    };
  },
}));

import { deleteMatch, liveEvent, setMatchArchived, setSeasonArchived } from "./clubApi";

beforeEach(() => {
  fx.calls = [];
});

it("allows lifecycle calls the full backend cleanup window without extending live actions", async () => {
  await deleteMatch({ id: "m1" });
  await setMatchArchived({ id: "m1", archived: true });
  await setSeasonArchived({ seasonId: "s1", archived: false });
  expect(fx.calls.map(({ name }) => [name, fx.timeouts.get(name)])).toEqual([
    ["deleteMatch", 540_000], ["setMatchArchived", 540_000], ["setSeasonArchived", 540_000],
  ]);
  expect(fx.timeouts.get("liveEvent")).toBeUndefined();
});

it("r12: each wrapper calls its callable by name, the long ones with their window", async () => {
  const api = await import("./clubApi");
  await api.remindNow({ matchId: "m1" });
  await api.setMvpVote({ matchId: "m1", action: "close" });
  await api.saveMatchReport({ matchId: "m1", report: "Dos líneas" });
  await api.recalcMatchNotas({ matchId: "m1" });
  await api.discardMatchDraft({ matchId: "m1" });
  await api.setVideoMarks({ matchId: "m1", marks: { g1: 30 } });
  await api.addMatchGuest({ matchId: "m1", name: "Rafa" });
  await api.setMatchDuration({ matchId: "m1", minutes: 60 });
  await api.correctPrediction({ matchId: "m1", uid: "u1", remove: true });
  await api.recomputeSeasonPorra({ seasonId: "t1" });
  await api.deletePlayer({ playerId: "p1" });
  await api.deleteSeason({ seasonId: "t0" });
  await api.promoteGuest({ playerId: "p1", guests: [{ matchId: "m1", guestId: "g1" }] });
  await api.sendCaptainNotice({ text: "Hola", audience: "todos" });
  expect(fx.calls.map((c) => c.name)).toEqual(["remindNow", "setMvpVote", "saveMatchReport", "recalcMatchNotas", "discardMatchDraft", "setVideoMarks", "addMatchGuest", "setMatchDuration", "correctPrediction", "recomputeSeasonPorra", "deletePlayer", "deleteSeason", "promoteGuest", "sendCaptainNotice"]);
  expect([fx.timeouts.get("deleteSeason"), fx.timeouts.get("promoteGuest"), fx.timeouts.get("recalcMatchNotas")]).toEqual([540_000, 540_000, 120_000]);
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
