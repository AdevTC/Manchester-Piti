import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  reportDroppedDoc,
  getDroppedDocStats,
  getTotalDroppedDocs,
  resetDroppedDocStats,
  setDroppedDocReporter,
  type DroppedDocIssue,
} from "./docTelemetry";

// A minimal but type-correct ZodIssue for the reporter payload assertions.
const issue = (): DroppedDocIssue =>
  ({ code: "custom", message: "boom", path: [], input: undefined }) as DroppedDocIssue;

describe("docTelemetry", () => {
  beforeEach(() => {
    resetDroppedDocStats();
    setDroppedDocReporter(null);
    // Silence the DEV console.error so test output stays clean; assert separately.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setDroppedDocReporter(null);
    resetDroppedDocStats();
  });

  it("incrementa el contador por colección", () => {
    reportDroppedDoc("matches", "m1", [issue()]);
    reportDroppedDoc("matches", "m2", [issue()]);
    reportDroppedDoc("players", "p1", [issue()]);

    expect(getDroppedDocStats()).toEqual({ matches: 2, players: 1 });
    expect(getTotalDroppedDocs()).toBe(3);
  });

  it("getDroppedDocStats devuelve una copia (no muta el estado interno)", () => {
    reportDroppedDoc("matches", "m1", [issue()]);
    const snap = getDroppedDocStats();
    snap.matches = 999;
    expect(getDroppedDocStats().matches).toBe(1);
  });

  it("resetDroppedDocStats limpia los contadores", () => {
    reportDroppedDoc("seasons", "s1", [issue()]);
    expect(getTotalDroppedDocs()).toBe(1);
    resetDroppedDocStats();
    expect(getTotalDroppedDocs()).toBe(0);
    expect(getDroppedDocStats()).toEqual({});
  });

  it("invoca el reporter pluggable con el payload completo", () => {
    const calls: Array<{ collection: string; id: string; issues: DroppedDocIssue[] }> = [];
    setDroppedDocReporter((info) => calls.push(info));

    const issues = [issue()];
    reportDroppedDoc("lineups", "l1", issues);

    expect(calls).toHaveLength(1);
    expect(calls[0].collection).toBe("lineups");
    expect(calls[0].id).toBe("l1");
    expect(calls[0].issues).toBe(issues);
  });

  it("setDroppedDocReporter(null) desconecta el handler", () => {
    const fn = vi.fn();
    setDroppedDocReporter(fn);
    setDroppedDocReporter(null);
    reportDroppedDoc("users", "u1", [issue()]);
    expect(fn).not.toHaveBeenCalled();
  });

  it("setDroppedDocReporter devuelve el handler anterior", () => {
    const first = vi.fn();
    const prevWhenSettingFirst = setDroppedDocReporter(first);
    const prevWhenSettingSecond = setDroppedDocReporter(vi.fn());
    expect(prevWhenSettingFirst).toBeNull();
    expect(prevWhenSettingSecond).toBe(first);
  });

  it("RESILIENCIA: un reporter que lanza NO propaga y se sigue contando", () => {
    setDroppedDocReporter(() => {
      throw new Error("monitor caído");
    });

    // No debe lanzar.
    expect(() => reportDroppedDoc("matches", "m1", [issue()])).not.toThrow();
    // El contador sigue incrementándose pese al fallo del monitor.
    expect(getDroppedDocStats().matches).toBe(1);
  });

  it("cuenta y reporta incluso cuando no hay handler (contador siempre activo)", () => {
    // Sin reporter: el contador debe seguir funcionando (visibilidad DEV).
    reportDroppedDoc("seasons", "s1", [issue()]);
    expect(getDroppedDocStats().seasons).toBe(1);
  });
});
