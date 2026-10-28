// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { playBeeps } from "./fxRuntime";

// The walkout's beeps: one AudioContext while they play, closed a few seconds after the last ones, made again on
// the next tap. The context is a fake (jsdom has no Web Audio).

class FakeAudio {
  static made = 0;
  state = "running";
  currentTime = 0;
  destination = {};
  closed = false;
  constructor() {
    FakeAudio.made++;
  }
  createOscillator() {
    return { type: "", frequency: { value: 0 }, connect: () => undefined, start: () => undefined, stop: () => undefined };
  }
  createGain() {
    return { gain: { setValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined }, connect: () => undefined };
  }
  resume() {
    return Promise.resolve();
  }
  close() {
    this.closed = true;
    return Promise.resolve();
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeAudio.made = 0;
  vi.stubGlobal("AudioContext", FakeAudio);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("playBeeps", () => {
  it("closes the audio once the beeps are over and makes a new one on the next tap", () => {
    playBeeps();
    playBeeps(); // a second tap reuses it
    expect(FakeAudio.made).toBe(1);
    vi.advanceTimersByTime(4000);
    playBeeps(); // still open: the close waits for the last beeps
    vi.advanceTimersByTime(4000);
    expect(FakeAudio.made).toBe(1);
    vi.advanceTimersByTime(2000);
    playBeeps();
    expect(FakeAudio.made).toBe(2);
  });
});
