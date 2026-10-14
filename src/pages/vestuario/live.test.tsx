import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

// One fake Firestore: `doc(db, path)` yields the path, `onSnapshot` registers a listener we can
// feed. Every distinct onSnapshot call is recorded so tests can count real listeners.
type SnapCb = (s: { exists: () => boolean; data: () => Record<string, unknown> }) => void;
const listeners = new Map<string, SnapCb[]>();
const onSnapshotMock = vi.fn((ref: { path: string }, cb: SnapCb) => {
  listeners.set(ref.path, [...(listeners.get(ref.path) ?? []), cb]);
  return () => {
    listeners.set(ref.path, (listeners.get(ref.path) ?? []).filter((c) => c !== cb));
  };
});

vi.mock("firebase/firestore", async (importOriginal) => ({
  ...(await importOriginal<typeof import("firebase/firestore")>()),
  doc: (_db: unknown, path: string) => ({ path }),
  collection: (_db: unknown, ...path: string[]) => ({ path: path.join("/") }),
  onSnapshot: (ref: { path: string }, cb: SnapCb) => onSnapshotMock(ref, cb),
}));
vi.mock("../../firebase", () => ({ db: {} }));

import { useLiveDoc, useMatchPrivate, useMatchScorers, useMeetingNote } from "./live";

const emitDoc = (path: string, data: Record<string, unknown> | undefined) =>
  act(() => {
    (listeners.get(path) ?? []).forEach((cb) => cb({ exists: () => data !== undefined, data: () => data ?? {} }));
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
