import { afterEach, describe, expect, it } from "vitest";
import { _resetSnapshotMetaForTesting, getSnapshotMeta, markListenerStale, recordSnapshotMeta } from "../syncStatus";
import { RECONNECTING, STALE_AFTER_MS, syncChip, syncChipAnnouncement } from "./syncChip";

const T = Date.UTC(2026, 10, 8, 12);
const MIN = 60_000;
const status = (s: Partial<{ online: boolean; fresh: boolean; since: number | null; staleAt: number | null }>) => ({ online: true, fresh: true, since: T, staleAt: null, ...s });

describe("syncChip", () => {
  it("in sync, online: nothing", () => {
    expect(syncChip(status({}), T + 10 * MIN, true)).toBeNull();
  });

  it("offline: «Reconectando…», live or not", () => {
    expect(syncChip(status({ online: false, fresh: false, staleAt: T }), T + 5_000, true)).toEqual({ kind: "offline", text: RECONNECTING });
    expect(syncChip(status({ online: false }), T, false)).toEqual({ kind: "offline", text: "Reconectando…" });
  });

  it("live and unconfirmed for over a minute: «Sin conexión · marcador de hace N min», counted from when it lost sync", () => {
    const s = status({ online: false, fresh: false, since: T - 30 * MIN, staleAt: T });
    expect(syncChip(s, T + STALE_AFTER_MS, true)).toEqual({ kind: "offline", text: RECONNECTING });
    expect(syncChip(s, T + STALE_AFTER_MS + 1, true)).toEqual({ kind: "stale", minutes: 1, text: "Sin conexión · marcador de hace 1 min" });
    expect(syncChip(s, T + 7 * MIN + 59_000, true)).toMatchObject({ text: "Sin conexión · marcador de hace 7 min" });
    // the device says online but the listener can't reach the server: the same
    expect(syncChip({ ...s, online: true }, T + 2 * MIN, true)).toMatchObject({ kind: "stale", minutes: 2 });
    // online, a few seconds out of sync (a reconnection): nothing
    expect(syncChip({ ...s, online: true }, T + 20_000, true)).toBeNull();
  });

  it("never «hace N min» when no match is live; and a score only ever seen from the cache has no age to tell", () => {
    expect(syncChip(status({ fresh: false, staleAt: T }), T + 10 * MIN, false)).toBeNull();
    expect(syncChip(status({ fresh: false, since: null, staleAt: T }), T + 2 * MIN, true)).toEqual({ kind: "offline", text: RECONNECTING });
  });

  it("the spoken line names the kind only, never the minutes", () => {
    expect(syncChipAnnouncement(null)).toBe("");
    expect(syncChipAnnouncement({ kind: "offline", text: RECONNECTING })).toBe("Sin conexión: reconectando.");
    expect(syncChipAnnouncement({ kind: "stale", minutes: 3, text: "x" })).toBe(syncChipAnnouncement({ kind: "stale", minutes: 4, text: "y" }));
  });
});

describe("staleAt (lib/syncStatus)", () => {
  afterEach(() => _resetSnapshotMetaForTesting());

  it("set when the key leaves the server (cache snapshot or listener stopped), kept while it stays out, cleared back in sync", () => {
    recordSnapshotMeta("k", { fromCache: true, hasPendingWrites: false }, T);
    expect(getSnapshotMeta("k")).toMatchObject({ since: null, staleAt: T });
    recordSnapshotMeta("k", { fromCache: false, hasPendingWrites: false }, T + MIN);
    expect(getSnapshotMeta("k")).toMatchObject({ since: T + MIN, staleAt: null });
    recordSnapshotMeta("k", { fromCache: true, hasPendingWrites: false }, T + 20 * MIN);
    recordSnapshotMeta("k", { fromCache: true, hasPendingWrites: true }, T + 25 * MIN);
    expect(getSnapshotMeta("k")).toMatchObject({ since: T + MIN, staleAt: T + 20 * MIN });
    recordSnapshotMeta("k", { fromCache: false, hasPendingWrites: false }, T + 30 * MIN);
    markListenerStale("k", T + 31 * MIN);
    expect(getSnapshotMeta("k")).toMatchObject({ fromCache: true, since: T + 30 * MIN, staleAt: T + 31 * MIN });
    markListenerStale("k", T + 40 * MIN);
    expect(getSnapshotMeta("k")?.staleAt).toBe(T + 31 * MIN);
  });
});
