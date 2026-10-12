import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { charlaLast, STEP_PLAN } from "./charla";
import { useVozCharla, type VozCharlaArgs } from "./useVozCharla";
import { VozPanel } from "./VozPanel";
import type { VozStore } from "./vozStore";
import type { VozClip } from "./voz";

// Bloque 5 · la voz en off as the captain uses it during La charla: record a step (the microphone asked,
// the clock, «Parar y guardar», the 30 s that stop it by themselves), hear it when the step comes (the
// charla waits for it), silence it on this device, delete it; and where the browser can't, why.

const LAST = charlaLast(2);
const clip = (step = "plan"): VozClip => ({ slot: "v0", step, mime: "audio/webm", ms: 12_000, data: "AQID", at: 1 });

function fakeStore(clips: VozClip[] = []): VozStore {
  return { clips, loading: false, error: false, stored: true, save: vi.fn(async () => undefined), remove: vi.fn(async () => undefined), want: vi.fn() };
}

function Harness(p: Partial<VozCharlaArgs> & { store: VozStore }) {
  const v = useVozCharla({ on: true, step: STEP_PLAN, last: LAST, playing: false, canEdit: true, pause: () => {}, resume: () => {}, announce: () => {}, ...p });
  return (
    <div className="pzv">
      <VozPanel v={v} />
    </div>
  );
}

const recs: FakeRec[] = [];
class FakeRec {
  static isTypeSupported = (t: string) => t === "audio/webm;codecs=opus";
  state: "inactive" | "recording" = "inactive";
  mimeType: string;
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  stream: unknown;
  constructor(stream: unknown, opts?: { mimeType?: string; audioBitsPerSecond?: number }) {
    this.stream = stream;
    this.mimeType = opts?.mimeType ?? "";
    this.opts = opts;
    recs.push(this);
  }
  opts?: { mimeType?: string; audioBitsPerSecond?: number };
  start() {
    this.state = "recording";
  }
  stop() {
    if (this.state === "inactive") return;
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob([new Uint8Array([1, 2, 3])], { type: this.mimeType }) });
    queueMicrotask(() => this.onstop?.());
  }
}

const track = { stop: vi.fn() };
let gum: ReturnType<typeof vi.fn>;
const played: HTMLMediaElement[] = [];

beforeEach(() => {
  recs.length = 0;
  played.length = 0;
  localStorage.clear();
  track.stop.mockClear();
  gum = vi.fn(async () => ({ getTracks: () => [track] }));
  vi.stubGlobal("MediaRecorder", FakeRec);
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: gum } });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) {
    played.push(this);
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const flush = () => act(async () => {});

describe("recording a step", () => {
  it("asks for the microphone, shows the clock, and «Parar y guardar» keeps the clip for that step", async () => {
    const store = fakeStore();
    const pause = vi.fn();
    const announce = vi.fn();
    render(<Harness store={store} pause={pause} announce={announce} />);
    expect(screen.getByText("Sin voz en este paso")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Grabar la voz" }));
    await flush();
    expect(gum).toHaveBeenCalledWith({ audio: true });
    expect(pause).toHaveBeenCalled();
    expect(recs[0].opts).toEqual({ mimeType: "audio/webm;codecs=opus", audioBitsPerSecond: 32_000 });
    expect(screen.getByText(/^Grabando 0:00 \/ 0:30$/)).toBeInTheDocument();
    const stop = screen.getByRole("button", { name: "Parar y guardar" });
    expect(stop).toHaveFocus();
    expect(announce).toHaveBeenCalledWith(expect.stringMatching(/^Grabando la voz para el plan/));
    fireEvent.click(stop);
    await flush();
    await flush();
    expect(store.save).toHaveBeenCalledWith("plan", { mime: "audio/webm;codecs=opus", ms: expect.any(Number), data: "AQID" });
    expect(track.stop).toHaveBeenCalled();
    expect(announce).toHaveBeenCalledWith(expect.stringMatching(/^Voz guardada para el plan \(0:0\d\)$/));
    expect(screen.getByRole("button", { name: "Grabar la voz" })).toBeInTheDocument();
  });

  it("stops by itself at 30 seconds", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "setInterval", "Date"] });
    const store = fakeStore();
    render(<Harness store={store} />);
    fireEvent.click(screen.getByRole("button", { name: "Grabar la voz" }));
    await flush();
    act(() => {
      vi.advanceTimersByTime(12_000);
    });
    expect(screen.getByText(/^Grabando 0:12 \/ 0:30$/)).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(18_100);
    });
    await flush();
    await flush();
    expect(recs[0].state).toBe("inactive");
    expect(store.save).toHaveBeenCalledWith("plan", expect.objectContaining({ ms: 30_000 }));
  });

  it("the microphone refused: why, in Spanish (nothing is saved)", async () => {
    gum.mockRejectedValueOnce(Object.assign(new Error("no"), { name: "NotAllowedError" }));
    const store = fakeStore();
    render(<Harness store={store} />);
    fireEvent.click(screen.getByRole("button", { name: "Grabar la voz" }));
    await flush();
    expect(screen.getByText(/Sin permiso para el micrófono/)).toBeInTheDocument();
    expect(store.save).not.toHaveBeenCalled();
  });

  it("a browser without MediaRecorder says so instead of a record button", () => {
    vi.stubGlobal("MediaRecorder", undefined);
    render(<Harness store={fakeStore()} />);
    expect(screen.queryByRole("button", { name: "Grabar la voz" })).toBeNull();
    expect(screen.getByText(/Este navegador no puede grabar audio/)).toBeInTheDocument();
  });

  it("a board that isn't stored yet asks to be saved first", () => {
    render(<Harness store={{ ...fakeStore(), stored: false }} />);
    expect(screen.queryByRole("button", { name: "Grabar la voz" })).toBeNull();
    expect(screen.getByText("Guarda el tablero para poder grabar la voz.")).toBeInTheDocument();
  });
});

describe("hearing it", () => {
  it("plays when its step comes; the charla waits for it and goes on when it ends", async () => {
    const pause = vi.fn();
    const resume = vi.fn();
    render(<Harness store={fakeStore([clip()])} playing pause={pause} resume={resume} />);
    await flush();
    expect(played).toHaveLength(1);
    expect(played[0].getAttribute("src") ?? (played[0] as HTMLAudioElement).src).toBe("data:audio/webm;base64,AQID");
    expect(pause).toHaveBeenCalledTimes(1);
    act(() => {
      played[0].dispatchEvent(new Event("playing"));
    });
    expect(screen.getByText("Suena la voz · 0:12")).toBeInTheDocument();
    act(() => {
      played[0].dispatchEvent(new Event("ended"));
    });
    expect(resume).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Voz · 0:12")).toBeInTheDocument();
  });

  it("another step has none: nothing plays; muted on this device: nothing plays either", async () => {
    const { rerender } = render(<Harness store={fakeStore([clip("final")])} />);
    await flush();
    expect(played).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Silenciar la voz" }));
    expect(screen.getByRole("button", { name: "Voz silenciada" })).toHaveAttribute("aria-pressed", "true");
    expect(localStorage.getItem("mp_pizarra_voz_mute")).toBe("1");
    rerender(<Harness store={fakeStore([clip("final")])} step={LAST} />);
    await flush();
    expect(played).toHaveLength(0);
  });

  it("a browser that holds the sound back: «Oír la voz» plays it", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) {
      played.push(this);
      return Promise.reject(new Error("NotAllowedError"));
    });
    render(<Harness store={fakeStore([clip()])} />);
    await flush();
    const hear = screen.getByRole("button", { name: "Oír la voz" });
    fireEvent.click(hear);
    expect(played).toHaveLength(2);
  });
});

describe("the step's clip", () => {
  it("is deleted after a confirmation", async () => {
    const store = fakeStore([clip()]);
    const announce = vi.fn();
    render(<Harness store={store} announce={announce} />);
    fireEvent.click(screen.getByRole("button", { name: "Borrar la voz" }));
    expect(screen.getByRole("group", { name: "¿Borrar la voz de este paso?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Borrar" }));
    await flush();
    expect(store.remove).toHaveBeenCalledWith("plan");
    expect(announce).toHaveBeenCalledWith("Voz borrada del plan");
  });

  it("is re-recorded into the same step («Volver a grabar»)", () => {
    render(<Harness store={fakeStore([clip()])} />);
    expect(screen.getByRole("button", { name: "Volver a grabar" })).toBeInTheDocument();
  });

  it("a board that isn't yours: you hear it, you can't record or delete it", () => {
    render(<Harness store={fakeStore([clip()])} canEdit={false} />);
    expect(screen.queryByRole("button", { name: /grabar/i })).toBeNull();
    expect(screen.queryByRole("button", { name: "Borrar la voz" })).toBeNull();
    expect(screen.getByRole("button", { name: "Silenciar la voz" })).toBeInTheDocument();
  });

  it("nothing to show on a board that isn't yours and has no voice", () => {
    const { container } = render(<Harness store={fakeStore()} canEdit={false} />);
    expect(container.querySelector(".b5p-voz")).toBeNull();
  });
});
