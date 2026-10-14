import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, type ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import type { QuerySnapshot, Query } from "firebase/firestore";
import { QueryClient as RealQueryClient, QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { mapSnapshotDocs, handleSnapshotError, subscribeShared, useFirestoreCollection, _resetSharedSubsForTesting, KEEP_WARM_MS } from "./useFirestoreCollection";
import { LISTENER_RETRY_MS, REOPEN_MIN_MS, _resetSnapshotMetaForTesting, getSnapshotMeta, useSyncStatus } from "./syncStatus";

// onSnapshot is mocked so subscribeShared can be exercised without a live
// Firestore: each call returns a distinct unsubscribe spy we can assert on.
const onSnapshotMock = vi.fn();
vi.mock("firebase/firestore", () => ({
  onSnapshot: (...args: unknown[]) => onSnapshotMock(...args),
}));

describe("mapSnapshotDocs", () => {
  it("aplica el mapper a cada doc con su id", () => {
    const snap = { docs: [{ id: "a", data: () => ({ n: 1 }) }, { id: "b", data: () => ({ n: 2 }) }] };
    const out = mapSnapshotDocs(snap as unknown as QuerySnapshot, (id, data) => ({ id, n: (data as { n: number }).n }));
    expect(out).toEqual([{ id: "a", n: 1 }, { id: "b", n: 2 }]);
  });

  it("filtra los docs cuyo mapper devuelve null", () => {
    const snap = {
      docs: [
        { id: "a", data: () => ({ valid: true }) },
        { id: "b", data: () => ({ valid: false }) },
        { id: "c", data: () => ({ valid: true }) },
      ],
    };
    const out = mapSnapshotDocs(
      snap as unknown as QuerySnapshot,
      (_id, data) => ((data as { valid: boolean }).valid ? data : null),
    );
    expect(out).toEqual([{ valid: true }, { valid: true }]);
  });
});

describe("handleSnapshotError", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sin datos previos deja un array vacío (isPending termina)", () => {
    const qc = new RealQueryClient();
    handleSnapshotError(qc, ["seasons"], new Error("Firestore error"));
    expect(qc.getQueryData(["seasons"])).toEqual([]);
  });

  it("con datos previos los conserva: un error no se lee como «no hay datos»", () => {
    const qc = new RealQueryClient();
    const last = [{ id: "s1" }];
    qc.setQueryData(["seasons"], last);
    handleSnapshotError(qc, ["seasons"], new Error("Firestore error"));
    expect(qc.getQueryData(["seasons"])).toBe(last);
  });
});

describe("subscribeShared", () => {
  const fakeQc = { setQueryData: vi.fn() } as unknown as Pick<QueryClient, "setQueryData">;
  const q = {} as Query;
  const map = (id: string, data: unknown) => ({ id, ...(data as object) });

  beforeEach(() => {
    vi.useFakeTimers();
    // Clear the module-level registry so leftover ref counts can't leak in.
    _resetSharedSubsForTesting();
    onSnapshotMock.mockReset();
    // Each onSnapshot call returns its own unsubscribe spy.
    onSnapshotMock.mockImplementation(() => vi.fn());
  });

  afterEach(() => {
    _resetSharedSubsForTesting();
    vi.useRealTimers();
  });

  it("abre una sola suscripción onSnapshot para varios consumidores de la misma key", () => {
    const a = subscribeShared(fakeQc, ["players"], q, map);
    const b = subscribeShared(fakeQc, ["players"], q, map);
    expect(onSnapshotMock).toHaveBeenCalledOnce();
    a();
    b();
  });

  it("solo desuscribe cuando el último consumidor se va (ref-count)", () => {
    const unsub = vi.fn();
    onSnapshotMock.mockImplementationOnce(() => unsub);
    const a = subscribeShared(fakeQc, ["matches"], q, map);
    const b = subscribeShared(fakeQc, ["matches"], q, map);
    a();
    expect(unsub).not.toHaveBeenCalled();
    b();
    // kept warm for a minute after the last consumer, then closed
    expect(unsub).not.toHaveBeenCalled();
    vi.advanceTimersByTime(KEEP_WARM_MS);
    expect(unsub).toHaveBeenCalledOnce();
  });

  it("si alguien vuelve antes de un minuto, reutiliza la misma suscripción", () => {
    const unsub = vi.fn();
    onSnapshotMock.mockImplementationOnce(() => unsub);
    const a = subscribeShared(fakeQc, ["players"], q, map);
    a();
    vi.advanceTimersByTime(KEEP_WARM_MS - 1);
    const b = subscribeShared(fakeQc, ["players"], q, map);
    expect(onSnapshotMock).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(KEEP_WARM_MS);
    expect(unsub).not.toHaveBeenCalled();
    b();
  });

  it("usa suscripciones independientes para keys distintas", () => {
    const a = subscribeShared(fakeQc, ["lineups", "s1"], q, map);
    const b = subscribeShared(fakeQc, ["lineups", "s2"], q, map);
    expect(onSnapshotMock).toHaveBeenCalledTimes(2);
    a();
    b();
  });

  it("vuelve a abrir la suscripción si todos se fueron y luego entra uno nuevo", () => {
    const a = subscribeShared(fakeQc, ["users"], q, map);
    a();
    vi.advanceTimersByTime(KEEP_WARM_MS);
    const b = subscribeShared(fakeQc, ["users"], q, map);
    expect(onSnapshotMock).toHaveBeenCalledTimes(2);
    b();
  });
});

// ---------- metadata, sync status and recovery (Bloque 3 · L2 / M2)
type Next = (snap: unknown) => void;
type Fail = (err: unknown) => void;
interface FakeDoc { id: string; data: () => unknown }
/** A query snapshot as the registry reads it: docs, document changes and metadata. */
const snapOf = (docs: FakeDoc[], opts: { changes?: number; fromCache?: boolean; pending?: boolean } = {}) => ({
  docs,
  docChanges: () => Array.from({ length: opts.changes ?? docs.length }),
  metadata: { fromCache: opts.fromCache ?? false, hasPendingWrites: opts.pending ?? false },
});
const docOf = (id: string, n: number): FakeDoc => ({ id, data: () => ({ n }) });
/** The callbacks of the n-th onSnapshot call (default: the last one). */
const listenerAt = (i = onSnapshotMock.mock.calls.length - 1) => {
  const call = onSnapshotMock.mock.calls[i] as [Query, { includeMetadataChanges?: boolean }, Next, Fail];
  return { options: call[1], next: call[2], fail: call[3] };
};
const MATCHES_META = JSON.stringify(["matches"]);

describe("subscribeShared · metadatos y recuperación", () => {
  const q = {} as Query;
  const map = (id: string, data: unknown) => ({ id, ...(data as object) });
  let qc: RealQueryClient;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-14T18:00:00Z"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    _resetSharedSubsForTesting();
    _resetSnapshotMetaForTesting();
    onSnapshotMock.mockReset();
    onSnapshotMock.mockImplementation(() => vi.fn());
    qc = new RealQueryClient();
  });
  afterEach(() => {
    _resetSharedSubsForTesting();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("pide los cambios de metadatos y los guarda aparte, sin tocar los datos si no cambia ningún documento", () => {
    const release = subscribeShared(qc, ["matches"], q, map);
    const { options, next } = listenerAt();
    expect(options).toEqual({ includeMetadataChanges: true });

    act(() => next(snapOf([docOf("m1", 1)], { fromCache: true })));
    const first = qc.getQueryData(["matches"]);
    expect(first).toEqual([{ id: "m1", n: 1 }]);
    expect(getSnapshotMeta(MATCHES_META)).toEqual({ fromCache: true, hasPendingWrites: false, since: null });

    // the server confirms the same data: metadata only
    act(() => next(snapOf([docOf("m1", 1)], { changes: 0, fromCache: false })));
    expect(qc.getQueryData(["matches"])).toBe(first);
    expect(getSnapshotMeta(MATCHES_META)).toEqual({ fromCache: false, hasPendingWrites: false, since: Date.now() });

    // a local write waiting for the server, then its acknowledgement
    act(() => next(snapOf([docOf("m1", 2)], { changes: 1, pending: true })));
    expect(qc.getQueryData(["matches"])).toEqual([{ id: "m1", n: 2 }]);
    expect(getSnapshotMeta(MATCHES_META)?.hasPendingWrites).toBe(true);
    const afterWrite = qc.getQueryData(["matches"]);
    act(() => next(snapOf([docOf("m1", 2)], { changes: 0 })));
    expect(qc.getQueryData(["matches"])).toBe(afterWrite);
    expect(getSnapshotMeta(MATCHES_META)?.hasPendingWrites).toBe(false);
    release();
  });

  it("la primera instantánea siempre escribe los datos, aunque la colección esté vacía", () => {
    const release = subscribeShared(qc, ["players"], q, map);
    act(() => listenerAt().next(snapOf([], { changes: 0 })));
    expect(qc.getQueryData(["players"])).toEqual([]);
    release();
  });

  it("tras un error conserva los últimos datos, expone el error y reintenta una vez si quedan lectores", () => {
    const release = subscribeShared(qc, ["matches"], q, map);
    act(() => listenerAt().next(snapOf([docOf("m1", 1)])));
    const last = qc.getQueryData(["matches"]);
    const err = new Error("unavailable");

    act(() => listenerAt().fail(err));
    expect(qc.getQueryData(["matches"])).toBe(last);
    expect(qc.getQueryData(["matches", "__error"])).toBe(err);
    expect(getSnapshotMeta(MATCHES_META)?.fromCache).toBe(true);
    expect(onSnapshotMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(LISTENER_RETRY_MS);
    expect(onSnapshotMock).toHaveBeenCalledTimes(2);

    // the retry fails too: no more automatic retries (no hot loop)
    act(() => listenerAt().fail(err));
    vi.advanceTimersByTime(LISTENER_RETRY_MS * 10);
    expect(onSnapshotMock).toHaveBeenCalledTimes(2);
    expect(qc.getQueryData(["matches"])).toBe(last);
    release();
  });

  it("una instantánea de caché antes de cada fallo no rearma el reintento (sin bucle cada 5 s)", () => {
    // a fan with cached docs and a key the rules refuse: every listen paints the cache, then fails
    const release = subscribeShared(qc, ["lineups", "s1"], q, map);
    const err = new Error("permission-denied");
    act(() => listenerAt().next(snapOf([docOf("l1", 1)], { fromCache: true })));
    act(() => listenerAt().fail(err));
    vi.advanceTimersByTime(LISTENER_RETRY_MS);
    expect(onSnapshotMock).toHaveBeenCalledTimes(2);
    act(() => listenerAt().next(snapOf([docOf("l1", 1)], { fromCache: true })));
    act(() => listenerAt().fail(err));
    vi.advanceTimersByTime(LISTENER_RETRY_MS * 20);
    expect(onSnapshotMock).toHaveBeenCalledTimes(2);
    release();
  });

  it("una clave que falla siempre se reabre para lectores nuevos como mucho cada REOPEN_MIN_MS", () => {
    const a = subscribeShared(qc, ["lineups", "s2"], q, map);
    const err = new Error("permission-denied");
    act(() => listenerAt().fail(err));
    vi.advanceTimersByTime(LISTENER_RETRY_MS);
    act(() => listenerAt().fail(err)); // the retry failed too: a permanent error
    expect(onSnapshotMock).toHaveBeenCalledTimes(2);
    a();
    // mount/unmount churn doesn't reopen it at once
    const b = subscribeShared(qc, ["lineups", "s2"], q, map);
    b();
    const c = subscribeShared(qc, ["lineups", "s2"], q, map);
    expect(onSnapshotMock).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(REOPEN_MIN_MS);
    expect(onSnapshotMock).toHaveBeenCalledTimes(3);
    // a server snapshot ends the streak: the next failure gets its automatic retry again
    act(() => listenerAt().next(snapOf([docOf("l1", 1)])));
    act(() => listenerAt().fail(err));
    vi.advanceTimersByTime(LISTENER_RETRY_MS);
    expect(onSnapshotMock).toHaveBeenCalledTimes(4);
    c();
  });

  it("un lector nuevo reabre al momento una escucha muerta, y una buena instantánea limpia el error", () => {
    const a = subscribeShared(qc, ["matches"], q, map);
    act(() => listenerAt().next(snapOf([docOf("m1", 1)])));
    act(() => listenerAt().fail(new Error("unavailable")));
    const b = subscribeShared(qc, ["matches"], q, map);
    expect(onSnapshotMock).toHaveBeenCalledTimes(2);
    // the pending retry was absorbed by the reopen
    vi.advanceTimersByTime(LISTENER_RETRY_MS);
    expect(onSnapshotMock).toHaveBeenCalledTimes(2);

    act(() => listenerAt().next(snapOf([docOf("m1", 3)])));
    expect(qc.getQueryData(["matches", "__error"])).toBeNull();
    expect(qc.getQueryData(["matches"])).toEqual([{ id: "m1", n: 3 }]);
    a();
    b();
  });

  it("si nadie lee cuando llega el error, suelta la entrada: el siguiente lector se suscribe de nuevo", () => {
    const unsub = vi.fn();
    onSnapshotMock.mockImplementationOnce(() => unsub);
    const a = subscribeShared(qc, ["players"], q, map);
    act(() => listenerAt().next(snapOf([docOf("p1", 1)])));
    a(); // kept warm, nobody reading
    act(() => listenerAt().fail(new Error("permission-denied")));
    vi.advanceTimersByTime(KEEP_WARM_MS);
    expect(onSnapshotMock).toHaveBeenCalledTimes(1); // no retry without readers
    expect(unsub).not.toHaveBeenCalled(); // the dead listener is not closed again
    expect(qc.getQueryData(["players"])).toEqual([{ id: "p1", n: 1 }]);
    expect(qc.getQueryData(["players", "__error"])).toBeInstanceOf(Error);

    const b = subscribeShared(qc, ["players"], q, map);
    expect(onSnapshotMock).toHaveBeenCalledTimes(2);
    // the new entry's first snapshot clears the error the dropped one left behind
    act(() => listenerAt().next(snapOf([docOf("p1", 2)], { fromCache: true })));
    expect(qc.getQueryData(["players", "__error"])).toBeNull();
    expect(qc.getQueryData(["players"])).toEqual([{ id: "p1", n: 2 }]);
    b();
  });

  it("una escucha que se cierra por inactividad deja de contar como fresca (conserva «since»)", () => {
    const a = subscribeShared(qc, ["matches"], q, map);
    act(() => listenerAt().next(snapOf([docOf("m1", 1)])));
    const since = Date.now();
    a();
    vi.advanceTimersByTime(KEEP_WARM_MS);
    expect(getSnapshotMeta(MATCHES_META)).toEqual({ fromCache: true, hasPendingWrites: false, since });
  });
});

describe("useFirestoreCollection + useSyncStatus", () => {
  const q = {} as Query;
  const map = (id: string, data: unknown) => ({ id, ...(data as object) });
  // TanStack batches its notifications on a 0 ms timer (fake here): emit, then let them out.
  const flush = (fn: () => void) =>
    act(() => {
      fn();
      vi.advanceTimersByTime(0);
    });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-14T18:00:00Z"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    _resetSharedSubsForTesting();
    _resetSnapshotMetaForTesting();
    onSnapshotMock.mockReset();
    onSnapshotMock.mockImplementation(() => vi.fn());
  });
  afterEach(() => {
    _resetSharedSubsForTesting();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("un cambio solo de metadatos no vuelve a pintar a quien lee los datos, pero sí el estado de sincronía", () => {
    const qc = new RealQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children);
    let dataRenders = 0;
    const data = renderHook(
      () => {
        dataRenders += 1;
        return useFirestoreCollection(["matches"], q, map);
      },
      { wrapper },
    );
    const status = renderHook(() => useSyncStatus());
    expect(status.result.current).toEqual({ online: true, fresh: false, since: null });

    flush(() => listenerAt().next(snapOf([docOf("m1", 1)], { fromCache: true })));
    expect(data.result.current.data).toEqual([{ id: "m1", n: 1 }]);
    expect(status.result.current).toEqual({ online: true, fresh: false, since: null });
    const rendersAfterData = dataRenders;
    const before = data.result.current.data;

    flush(() => listenerAt().next(snapOf([docOf("m1", 1)], { changes: 0, fromCache: false })));
    expect(dataRenders).toBe(rendersAfterData);
    expect(data.result.current.data).toBe(before);
    expect(status.result.current).toEqual({ online: true, fresh: true, since: Date.now() });

    // the connection drops: Firestore says «from cache», the browser says offline
    const syncedAt = Date.now();
    vi.advanceTimersByTime(30_000);
    flush(() => listenerAt().next(snapOf([docOf("m1", 1)], { changes: 0, fromCache: true })));
    const onLine = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(status.result.current).toEqual({ online: false, fresh: false, since: syncedAt });
    expect(dataRenders).toBe(rendersAfterData);

    onLine.mockReturnValue(true);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    flush(() => listenerAt().next(snapOf([docOf("m1", 1)], { changes: 0, fromCache: false })));
    expect(status.result.current).toEqual({ online: true, fresh: true, since: Date.now() });

    // an error keeps the data on screen and returns it in `error`
    flush(() => listenerAt().fail(new Error("unavailable")));
    expect(data.result.current.data).toBe(before);
    expect(data.result.current.error).toBeInstanceOf(Error);
    expect(status.result.current.fresh).toBe(false);

    data.unmount();
    status.unmount();
  });
});
