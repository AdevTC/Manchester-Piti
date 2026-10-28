import { renderHook, waitFor } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { StillRequest } from "./scene";
import { useShirtStills } from "./useShirtStills";

// The stills' object URLs: kept while a mounted hook asks for them, the unheld ones bounded (oldest revoked first).
// The renderer is a mock (no WebGL here); jsdom has no Cache Storage, so every still is "rendered".

const scene = vi.hoisted(() => ({ renderStill: vi.fn(async () => new Blob(["still"], { type: "image/webp" })) }));
vi.mock("./scene", () => scene);

let made = 0;
const create = vi.fn(() => `blob:still-${++made}`);
const revoke = vi.fn();
const original = { create: URL.createObjectURL, revoke: URL.revokeObjectURL, idle: window.requestIdleCallback };
beforeAll(() => {
  URL.createObjectURL = create;
  URL.revokeObjectURL = revoke;
  window.requestIdleCallback = (cb: IdleRequestCallback) => {
    cb({ didTimeout: false, timeRemaining: () => 50 });
    return 0;
  };
});
afterAll(() => {
  URL.createObjectURL = original.create;
  URL.revokeObjectURL = original.revoke;
  window.requestIdleCallback = original.idle;
});

const shirt = (n: number): StillRequest => ({ kit: "home", theme: "dark", name: `P${n}`, num: String(n) });

describe("useShirtStills", () => {
  it("revokes the oldest stills nobody holds past 48, never one a mounted hook holds", async () => {
    const kept = renderHook(() => useShirtStills([shirt(0)]));
    await waitFor(() => expect(kept.result.current(shirt(0))).toBeDefined());
    const mine = kept.result.current(shirt(0));

    const many = Array.from({ length: 50 }, (_, i) => shirt(i + 1));
    const page = renderHook(({ list }) => useShirtStills(list), { initialProps: { list: many } });
    await waitFor(() => expect(many.every((r) => page.result.current(r))).toBe(true), { timeout: 4000 });
    const oldest = [0, 1, 2].map((i) => page.result.current(many[i]));
    expect(revoke).not.toHaveBeenCalled();

    // the same hook asks for one shirt more: the 50 it already showed stay held, none goes
    const more = [...many, shirt(51)];
    page.rerender({ list: more });
    await waitFor(() => expect(page.result.current(shirt(51))).toBeDefined());
    expect(revoke).not.toHaveBeenCalled();
    expect(page.result.current(many[0])).toBe(oldest[0]);

    page.unmount();
    await Promise.resolve();
    // 51 unheld, 48 kept: the three oldest go
    expect(revoke.mock.calls.map((c) => c[0])).toEqual(oldest);
    expect(revoke).not.toHaveBeenCalledWith(mine);
    expect(kept.result.current(shirt(0))).toBe(mine);
    kept.unmount();
  });
});
