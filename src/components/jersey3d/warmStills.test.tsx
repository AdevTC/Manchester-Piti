// @vitest-environment jsdom
// A page's first still sent for ahead (warmStills, from Plantilla's route as the visitor arrives): rendered once in
// the stills worker at once, not at idle, and the page's own useShirtStills shows that same still without making it
// again. jsdom has no Cache Storage, so it is "rendered" (by the mock).
import { renderHook, waitFor } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { StillRequest } from "./scene";

const fast = vi.hoisted(() => {
  let done: (b: Blob) => void = () => undefined;
  return {
    renderStillFast: vi.fn(() => new Promise<Blob>((ok) => (done = ok))),
    finish: () => done(new Blob(["still"], { type: "image/webp" })),
  };
});
vi.mock("./stillsClient", () => ({ renderStillFast: fast.renderStillFast }));
const scene = vi.hoisted(() => ({ renderStill: vi.fn(async () => new Blob(["main"], { type: "image/webp" })) }));
vi.mock("./scene", () => scene);
const { useShirtStills, warmStills } = await import("./useShirtStills");

const original = { create: URL.createObjectURL, idle: window.requestIdleCallback };
const idle = vi.fn();
beforeAll(() => {
  URL.createObjectURL = vi.fn(() => "blob:warm");
  // (the page's idle never comes in this test: only the warm still can show)
  window.requestIdleCallback = idle;
});
afterAll(() => {
  URL.createObjectURL = original.create;
  window.requestIdleCallback = original.idle;
});

const blank: StillRequest = { kit: "away", theme: "dark", name: "", num: "" };

describe("warmStills", () => {
  it("makes the still once, at once, and the page's hook shows that one when it lands", async () => {
    warmStills([blank]);
    warmStills([blank]);
    await waitFor(() => expect(fast.renderStillFast).toHaveBeenCalledTimes(1));
    expect(fast.renderStillFast).toHaveBeenCalledWith({ ...blank, yaw: 0 });
    const page = renderHook(() => useShirtStills([blank], { offMainThread: true }));
    expect(page.result.current(blank)).toBeUndefined();
    fast.finish();
    await waitFor(() => expect(page.result.current(blank)).toBe("blob:warm"));
    expect(fast.renderStillFast).toHaveBeenCalledTimes(1);
    expect(scene.renderStill).not.toHaveBeenCalled();
    expect(idle).not.toHaveBeenCalled();
    page.unmount();
  });
});
