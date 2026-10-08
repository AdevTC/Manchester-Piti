import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buzz, canBuzz, canPlay, useBoardSound, type SoundKind } from "./sound";

// The board's sounds never play on their own: off by default, and the audio is only created inside a
// user gesture (a tap or a key) while the sound is on. A fake Web Audio stands in for the real one.

class FakeAudio {
  static made = 0;
  state: "suspended" | "running" | "closed" = "suspended";
  sampleRate = 8000;
  currentTime = 0;
  destination = {};
  started = 0;
  constructor() {
    FakeAudio.made++;
  }
  resume = vi.fn(async () => {
    this.state = "running";
  });
  suspend = vi.fn(async () => {
    this.state = "suspended";
  });
  close = vi.fn(async () => {
    this.state = "closed";
  });
  createBuffer(_c: number, n: number) {
    const d = new Float32Array(n);
    return { getChannelData: () => d };
  }
  createBufferSource() {
    return { buffer: null as unknown, connect: () => {}, start: () => void this.started++ };
  }
  createBiquadFilter() {
    return { type: "", frequency: { value: 0 }, Q: { value: 0 }, connect: () => {} };
  }
  createGain() {
    return { gain: { setValueAtTime: () => {} }, connect: () => {} };
  }
}

let last: FakeAudio | null = null;
const gesture = { active: false };

/** The board's sound behind three buttons (a click is not a pointerdown: only `gesture` says if the
 *  browser counts it as one). */
function Probe({ on }: { on: boolean }) {
  const snd = useBoardSound(on);
  const kinds: SoundKind[] = ["clac", "flip", "crowd"];
  return (
    <>
      <button type="button">tocar</button>
      {kinds.map((k) => (
        <button key={k} type="button" onClick={() => snd(k)}>
          {k}
        </button>
      ))}
    </>
  );
}
const play = (k: SoundKind) => fireEvent.click(screen.getByRole("button", { name: k }));

beforeEach(() => {
  FakeAudio.made = 0;
  last = null;
  gesture.active = false;
  vi.stubGlobal(
    "AudioContext",
    class extends FakeAudio {
      constructor() {
        super();
        last = this as FakeAudio;
      }
    },
  );
  Object.defineProperty(navigator, "userActivation", { configurable: true, get: () => ({ isActive: gesture.active }) });
});
afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "userActivation");
});

describe("los sonidos de la pizarra", () => {
  it("the rule: the sound on, and the audio already there or a gesture to create it", () => {
    expect(canPlay(false, true, true)).toBe(false);
    expect(canPlay(true, false, false)).toBe(false);
    expect(canPlay(true, false, true)).toBe(true);
    expect(canPlay(true, true, false)).toBe(true);
  });

  it("off by default: nothing is created, not even on a tap", () => {
    render(<Probe on={false} />);
    fireEvent.pointerDown(screen.getByRole("button", { name: "tocar" }));
    gesture.active = true;
    play("clac");
    expect(FakeAudio.made).toBe(0);
  });

  it("on, but no gesture yet (a timer, the charla's clock): silent, no audio created", () => {
    render(<Probe on />);
    play("crowd");
    expect(FakeAudio.made).toBe(0);
  });

  it("on: the first tap creates the audio, then the sounds play", () => {
    const { rerender } = render(<Probe on />);
    fireEvent.pointerDown(screen.getByRole("button", { name: "tocar" }));
    expect(FakeAudio.made).toBe(1);
    expect(last?.resume).toHaveBeenCalled();
    play("clac");
    play("flip");
    expect(last?.started).toBe(2);
    // a key counts as a gesture too (only one audio, ever)
    fireEvent.keyDown(window, { key: "a" });
    expect(FakeAudio.made).toBe(1);
    // turned off: silent again, the audio sleeps
    rerender(<Probe on={false} />);
    play("crowd");
    expect(last?.started).toBe(2);
    expect(last?.suspend).toHaveBeenCalled();
  });

  it("a sound asked for inside a gesture creates the audio itself (turning the sound on answers)", () => {
    render(<Probe on />);
    gesture.active = true;
    play("clac");
    expect(FakeAudio.made).toBe(1);
    expect(last?.started).toBe(1);
  });

  it("the audio goes with the board", () => {
    const { unmount } = render(<Probe on />);
    fireEvent.pointerDown(screen.getByRole("button", { name: "tocar" }));
    unmount();
    expect(last?.close).toHaveBeenCalled();
  });
});

describe("la vibración", () => {
  const act8 = (ua: { hasBeenActive: boolean; isActive: boolean } | undefined) => {
    if (ua) Object.defineProperty(navigator, "userActivation", { configurable: true, get: () => ua });
    else Reflect.deleteProperty(navigator, "userActivation");
  };
  afterEach(() => {
    Reflect.deleteProperty(navigator, "vibrate");
  });

  it("only in answer to a tap: never before the page has been touched, never outside a gesture", () => {
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true });
    act8({ hasBeenActive: false, isActive: false });
    expect(canBuzz()).toBe(false);
    buzz(14);
    act8({ hasBeenActive: true, isActive: false });
    expect(canBuzz()).toBe(false);
    buzz(14);
    expect(vibrate).not.toHaveBeenCalled();
    act8({ hasBeenActive: true, isActive: true });
    buzz([10, 20]);
    expect(vibrate).toHaveBeenCalledWith([10, 20]);
  });

  it("no vibration API: nothing (and nothing throws)", () => {
    act8({ hasBeenActive: true, isActive: true });
    expect(canBuzz()).toBe(false);
    expect(() => buzz(10)).not.toThrow();
  });
});
