// The charla's voice: a microphone permission answered after the recording was cancelled, the charla closed or
// the page left must not start recording (it used to record for 30 s in the background and save the clip).
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../data/voz", () => ({
  VOZ_R14: { slots: 6, ms: 30_000, chars: 900_000, mime: 60 },
  useVozR14: () => ({ clips: [] }),
  vozByKey: () => new Map(),
  saveVoz: vi.fn(() => Promise.resolve()),
  removeVoz: vi.fn(() => Promise.resolve()),
}));

import { useCharlaVoz } from "./useCharlaVoz";

class FakeRecorder {
  static started = 0;
  state = "inactive";
  mimeType = "audio/webm";
  ondataavailable: ((e: unknown) => void) | null = null;
  onstop: (() => void) | null = null;
  static isTypeSupported = () => true;
  start() {
    FakeRecorder.started++;
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    this.onstop?.();
  }
}

let grant: (() => void) | null = null;
const trackStop = vi.fn();

beforeEach(() => {
  FakeRecorder.started = 0;
  grant = null;
  trackStop.mockClear();
  vi.stubGlobal("MediaRecorder", FakeRecorder);
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: () =>
        new Promise((res) => {
          grant = () => res({ getTracks: () => [{ stop: trackStop }] });
        }),
    },
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const opts = { boardId: "b1", on: true, uid: "u1", say: () => undefined };
const flush = () => act(async () => {
  grant?.();
  await Promise.resolve();
  await Promise.resolve();
});

describe("useCharlaVoz · the microphone's answer after the recording was dropped", () => {
  it("records when the permission comes while still asking", async () => {
    const { result } = renderHook(() => useCharlaVoz(opts));
    act(() => result.current.record("plan", "El plan"));
    expect(result.current.phase).toBe("asking");
    await flush();
    expect(FakeRecorder.started).toBe(1);
    expect(result.current.phase).toBe("rec");
    act(() => result.current.cancel());
  });

  it("cancelled while asking: the late permission records nothing and frees the microphone", async () => {
    const { result } = renderHook(() => useCharlaVoz(opts));
    act(() => result.current.record("plan", "El plan"));
    act(() => result.current.cancel());
    await flush();
    expect(FakeRecorder.started).toBe(0);
    expect(trackStop).toHaveBeenCalled();
    expect(result.current.phase).toBe("idle");
  });

  it("left the charla while asking: nothing records in the background", async () => {
    const { result, unmount } = renderHook(() => useCharlaVoz(opts));
    act(() => result.current.record("plan", "El plan"));
    unmount();
    await flush();
    expect(FakeRecorder.started).toBe(0);
    expect(trackStop).toHaveBeenCalled();
  });
});
