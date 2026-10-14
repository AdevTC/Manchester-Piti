import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

// One fake Firestore: `doc(db, path)` yields the path, `onSnapshot` registers a listener we can
// feed (or fail). Every distinct onSnapshot call is recorded so tests can count real listeners.
type SnapCb = (s: unknown) => void;
interface Listener { next: SnapCb; fail: (e: unknown) => void; options: unknown }
const listeners = new Map<string, Listener[]>();
const onSnapshotMock = vi.fn((ref: { path: string }, options: unknown, next: SnapCb, fail: (e: unknown) => void) => {
  const l: Listener = { next, fail, options };
  listeners.set(ref.path, [...(listeners.get(ref.path) ?? []), l]);
  return () => {
    listeners.set(ref.path, (listeners.get(ref.path) ?? []).filter((c) => c !== l));
  };
});

vi.mock("firebase/firestore", async (importOriginal) => ({
  ...(await importOriginal<typeof import("firebase/firestore")>()),
  doc: (_db: unknown, path: string) => ({ path }),
  collection: (_db: unknown, ...path: string[]) => ({ path: path.join("/") }),
  onSnapshot: (ref: { path: string }, options: unknown, next: SnapCb, fail: (e: unknown) => void) => onSnapshotMock(ref, options, next, fail),
}));
vi.mock("../../firebase", () => ({ db: {} }));

import { useAvailability, useLiveDoc, useMatchPrivate, useMatchScorers, useMeetingNote } from "./live";
import { LISTENER_RETRY_MS, REOPEN_MIN_MS, _resetSnapshotMetaForTesting, getSnapshotMeta } from "../../lib/syncStatus";

const meta = (fromCache = false, hasPendingWrites = false) => ({ fromCache, hasPendingWrites });
const emitDoc = (path: string, data: Record<string, unknown> | undefined, metadata = meta()) =>
  act(() => {
    (listeners.get(path) ?? []).forEach((l) => l.next({ exists: () => data !== undefined, data: () => data ?? {}, metadata }));
  });
const failAt = (path: string) =>
  act(() => {
    (listeners.get(path) ?? []).forEach((l) => l.fail(new Error("unavailable")));
  });

const DOC = { meetingNote: "Quedamos a las 9 en el campo", scorerUids: ["uid-erik", "uid-adri"] };

describe("matchPrivate: la quedada y los anotadores comparten documento, no forma", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    onSnapshotMock.mockClear();
  });
  afterEach(() => {
    // drain the 60 s keep-warm timers so the registry is empty for the next test
    vi.runAllTimers();
    vi.useRealTimers();
    listeners.clear();
  });

  it("la quedada primero, los anotadores después: cada uno recibe su forma", () => {
    const note = renderHook(() => useMeetingNote("m1"));
    const scorers = renderHook(() => useMatchScorers("m1"));
    emitDoc("matchPrivate/m1", DOC);
    expect(note.result.current.data).toBe(DOC.meetingNote);
    expect(scorers.result.current.data).toEqual(DOC.scorerUids);
    note.unmount();
    scorers.unmount();
  });

  it("los anotadores primero, la quedada después: cada uno recibe su forma", () => {
    const scorers = renderHook(() => useMatchScorers("m2"));
    const note = renderHook(() => useMeetingNote("m2"));
    emitDoc("matchPrivate/m2", DOC);
    expect(scorers.result.current.data).toEqual(DOC.scorerUids);
    expect(note.result.current.data).toBe(DOC.meetingNote);
    scorers.unmount();
    note.unmount();
  });

  it("abre una sola escucha del documento aunque lo lean los dos", () => {
    const a = renderHook(() => useMeetingNote("m3"));
    const b = renderHook(() => useMatchScorers("m3"));
    const c = renderHook(() => useMatchPrivate("m3"));
    expect(onSnapshotMock).toHaveBeenCalledTimes(1);
    a.unmount();
    b.unmount();
    c.unmount();
  });

  it("documento vacío o sin campos: nota vacía y ningún anotador", () => {
    const note = renderHook(() => useMeetingNote("m4"));
    const scorers = renderHook(() => useMatchScorers("m4"));
    emitDoc("matchPrivate/m4", undefined);
    expect(note.result.current.data).toBe("");
    expect(scorers.result.current.data).toEqual([]);
    emitDoc("matchPrivate/m4", { meetingNote: "Solo nota" });
    expect(note.result.current.data).toBe("Solo nota");
    expect(scorers.result.current.data).toEqual([]);
    note.unmount();
    scorers.unmount();
  });

  it("sin id no escucha nada y devuelve los valores vacíos", () => {
    const note = renderHook(() => useMeetingNote(undefined));
    const scorers = renderHook(() => useMatchScorers(undefined));
    expect(onSnapshotMock).not.toHaveBeenCalled();
    expect(note.result.current).toEqual({ data: "", loading: false, error: false });
    expect(scorers.result.current).toEqual({ data: [], loading: false, error: false });
  });

  it("los selectores mantienen la identidad del array entre renders (sin bucles de efectos)", () => {
    const scorers = renderHook(() => useMatchScorers("m5"));
    emitDoc("matchPrivate/m5", DOC);
    const first = scorers.result.current.data;
    scorers.rerender();
    expect(scorers.result.current.data).toBe(first);
    scorers.unmount();
  });
});

describe("registro de escuchas: un mismo documento con dos proyecciones es un error de programación", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.runAllTimers();
    vi.useRealTimers();
    listeners.clear();
  });

  it("la clave incluye la proyección: mismo path y distinto mapId no se pisan, pero avisa en desarrollo", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const a = renderHook(() => useLiveDoc("x/1", "a", (d) => d?.v as string, ""));
    const b = renderHook(() => useLiveDoc("x/1", "b", (d) => String(d?.v ?? "").toUpperCase(), ""));
    emitDoc("x/1", { v: "hola" });
    expect(a.result.current.data).toBe("hola");
    expect(b.result.current.data).toBe("HOLA");
    expect(err).toHaveBeenCalledTimes(1);
    expect(String(err.mock.calls[0][0])).toContain("x/1");
    err.mockRestore();
    a.unmount();
    b.unmount();
  });

  it("no avisa si cada path usa una sola proyección, aunque dos lectores la compartan", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const a = renderHook(() => useLiveDoc("y/1", "same", (d) => d?.v as string, ""));
    const b = renderHook(() => useLiveDoc("y/1", "same", (d) => d?.v as string, ""));
    const c = renderHook(() => useLiveDoc("y/2", "same", (d) => d?.v as string, ""));
    expect(err).not.toHaveBeenCalled();
    err.mockRestore();
    a.unmount();
    b.unmount();
    c.unmount();
  });
});

describe("useShared: metadatos aparte y escuchas que se recuperan", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-14T18:00:00Z"));
    onSnapshotMock.mockClear();
    _resetSnapshotMetaForTesting();
  });
  afterEach(() => {
    vi.runAllTimers();
    vi.useRealTimers();
    listeners.clear();
  });

  it("pide los metadatos; un cambio solo de metadatos no cambia los datos ni vuelve a pintar", () => {
    let renders = 0;
    const note = renderHook(() => {
      renders += 1;
      return useMatchPrivate("r1");
    });
    expect(listeners.get("matchPrivate/r1")?.[0].options).toEqual({ includeMetadataChanges: true });
    emitDoc("matchPrivate/r1", DOC, meta(true));
    const first = note.result.current;
    const rendersAfterData = renders;
    expect(getSnapshotMeta("doc:matchPrivate/r1#matchPrivate")).toEqual({ fromCache: true, hasPendingWrites: false, since: null, staleAt: Date.now() });

    emitDoc("matchPrivate/r1", { ...DOC, scorerUids: [...DOC.scorerUids] }, meta(false));
    expect(note.result.current).toBe(first);
    expect(renders).toBe(rendersAfterData);
    expect(getSnapshotMeta("doc:matchPrivate/r1#matchPrivate")).toEqual({ fromCache: false, hasPendingWrites: false, since: Date.now(), staleAt: null });

    emitDoc("matchPrivate/r1", { ...DOC, meetingNote: "A las 10" });
    expect(note.result.current.data.meetingNote).toBe("A las 10");
    note.unmount();
  });

  it("consultas: sin cambios de documentos se queda el mismo array", () => {
    const rsvp = renderHook(() => useAvailability("r2"));
    const path = "matchPrivate/r2/availability";
    const docs = [{ id: "u1", data: () => ({ response: "yes", name: "Erik" }) }];
    act(() => listeners.get(path)?.forEach((l) => l.next({ docs, docChanges: () => [{}], metadata: meta(true) })));
    const first = rsvp.result.current.data;
    expect(first).toEqual([{ uid: "u1", response: "yes", name: "Erik", playerId: null }]);
    act(() => listeners.get(path)?.forEach((l) => l.next({ docs, docChanges: () => [], metadata: meta(false) })));
    expect(rsvp.result.current.data).toBe(first);
    expect(getSnapshotMeta(`query:availability/r2`)?.fromCache).toBe(false);
    rsvp.unmount();
  });

  it("tras un error conserva los últimos datos con error y reintenta una sola vez", () => {
    const note = renderHook(() => useMeetingNote("r3"));
    emitDoc("matchPrivate/r3", DOC);
    failAt("matchPrivate/r3");
    expect(note.result.current).toEqual({ data: DOC.meetingNote, loading: false, error: true });
    expect(getSnapshotMeta("doc:matchPrivate/r3#matchPrivate")?.fromCache).toBe(true);
    expect(onSnapshotMock).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(LISTENER_RETRY_MS);
    });
    expect(onSnapshotMock).toHaveBeenCalledTimes(2);
    failAt("matchPrivate/r3");
    act(() => {
      vi.advanceTimersByTime(LISTENER_RETRY_MS * 10);
    });
    expect(onSnapshotMock).toHaveBeenCalledTimes(2);
    expect(note.result.current.data).toBe(DOC.meetingNote);

    // a new reader reopens it at once, and a good snapshot clears the error
    const again = renderHook(() => useMatchScorers("r3"));
    expect(onSnapshotMock).toHaveBeenCalledTimes(3);
    emitDoc("matchPrivate/r3", { ...DOC, meetingNote: "Nueva" });
    expect(note.result.current).toEqual({ data: "Nueva", loading: false, error: false });
    expect(again.result.current.data).toEqual(DOC.scorerUids);
    note.unmount();
    again.unmount();
  });

  it("una instantánea de caché antes de cada fallo no rearma el reintento; luego, como mucho una reapertura cada REOPEN_MIN_MS", () => {
    const a = renderHook(() => useMeetingNote("r5"));
    const path = "matchPrivate/r5";
    emitDoc(path, DOC, meta(true));
    failAt(path);
    act(() => {
      vi.advanceTimersByTime(LISTENER_RETRY_MS);
    });
    expect(onSnapshotMock).toHaveBeenCalledTimes(2);
    emitDoc(path, DOC, meta(true));
    failAt(path);
    act(() => {
      vi.advanceTimersByTime(LISTENER_RETRY_MS * 4);
    });
    expect(onSnapshotMock).toHaveBeenCalledTimes(2);
    expect(a.result.current).toEqual({ data: DOC.meetingNote, loading: false, error: true });
    a.unmount();

    // a permanently failing key: a new reader waits (showing the error, not «loading») instead of reopening at once
    const b = renderHook(() => useMeetingNote("r5"));
    expect(onSnapshotMock).toHaveBeenCalledTimes(2);
    expect(b.result.current).toEqual({ data: "", loading: false, error: true });
    act(() => {
      vi.advanceTimersByTime(REOPEN_MIN_MS);
    });
    expect(onSnapshotMock).toHaveBeenCalledTimes(3);
    emitDoc(path, DOC);
    expect(b.result.current).toEqual({ data: DOC.meetingNote, loading: false, error: false });
    b.unmount();
  });

  it("si el error llega sin lectores, se suelta la entrada y el siguiente lector se suscribe de nuevo", () => {
    const a = renderHook(() => useMeetingNote("r4"));
    emitDoc("matchPrivate/r4", DOC);
    a.unmount(); // kept warm
    failAt("matchPrivate/r4");
    act(() => {
      vi.advanceTimersByTime(LISTENER_RETRY_MS);
    });
    expect(onSnapshotMock).toHaveBeenCalledTimes(1);
    const b = renderHook(() => useMeetingNote("r4"));
    expect(onSnapshotMock).toHaveBeenCalledTimes(2);
    expect(b.result.current.loading).toBe(true);
    b.unmount();
  });
});
