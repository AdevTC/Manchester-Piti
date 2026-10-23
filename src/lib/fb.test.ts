import { afterEach, describe, expect, it, vi } from "vitest";
import { _resetFirebaseForTesting, beforeListeners, firebaseNow, lazyCallable, loadFirebase, viaFirebase, withFirebase } from "./fb";

const sdk = vi.hoisted(() => ({
  order: [] as string[],
  call: vi.fn(async (data: unknown) => ({ data: { echoed: data } })),
}));
vi.mock("./fbSdk", () => ({
  db: { name: "db" },
  functions: { name: "functions" },
  httpsCallable: (_functions: unknown, name: string) => (data: unknown) => {
    sdk.order.push(`call:${name}`);
    return sdk.call(data);
  },
}));

afterEach(() => {
  _resetFirebaseForTesting();
  sdk.order.length = 0;
  sdk.call.mockClear();
});

describe("Firebase after the first paint", () => {
  it("is not loaded until something needs it", () => {
    expect(firebaseNow()).toBeNull();
  });

  it("opens a listener once it's in, after the work that must come before any listener (the bundle)", async () => {
    beforeListeners(() => sdk.order.push("bundle"));
    withFirebase(() => {
      sdk.order.push("listener");
      return () => sdk.order.push("stop");
    });
    expect(sdk.order).toEqual([]);
    await loadFirebase();
    expect(sdk.order).toEqual(["bundle", "listener"]);
  });

  it("never opens a listener stopped before Firebase came in", async () => {
    const stop = withFirebase(() => {
      sdk.order.push("listener");
      return () => sdk.order.push("stop");
    });
    stop();
    await loadFirebase();
    expect(sdk.order).toEqual([]);
  });

  it("once it's in, opens listeners and runs writes in the same tick", async () => {
    await loadFirebase();
    const stop = withFirebase(() => {
      sdk.order.push("listener");
      return () => sdk.order.push("stop");
    });
    void viaFirebase(() => sdk.order.push("write"));
    expect(sdk.order).toEqual(["listener", "write"]);
    stop();
    expect(sdk.order).toEqual(["listener", "write", "stop"]);
  });

  it("a write before it's in waits for it; one that throws rejects", async () => {
    const done = viaFirebase(() => "saved");
    await expect(done).resolves.toBe("saved");
    await expect(
      viaFirebase(() => {
        throw new Error("refused");
      }),
    ).rejects.toThrow("refused");
  });

  it("a callable loads it on the first call and answers like httpsCallable", async () => {
    const echo = lazyCallable<{ n: number }, { echoed: unknown }>("echo");
    expect(firebaseNow()).toBeNull();
    await expect(echo({ n: 1 })).resolves.toEqual({ data: { echoed: { n: 1 } } });
    expect(sdk.order).toEqual(["call:echo"]);
    expect(firebaseNow()).not.toBeNull();
  });
});
