import { act, render, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Stadium3D, type Stadium3DHandle } from "./Stadium3D";
import type { Handle, MountOptions } from "./types";

// The React wrapper with the engine module mocked: the guard keeps the chunk from loading at all,
// calls made while loading are queued, the theme follows <html data-theme>, failures report
// onError, and the engine is disposed on unmount.

const engine = vi.hoisted(() => ({ mount: vi.fn() }));
vi.mock("./engine", () => engine);

function fakeHandle(): Handle {
  return {
    setPlayers: vi.fn(),
    setRivals: vi.fn(),
    setBall: vi.fn(),
    setCamera: vi.fn(() => Promise.resolve()),
    setBoard: vi.fn(),
    intro: vi.fn(() => Promise.resolve()),
    reveal: vi.fn(() => Promise.resolve()),
    play: vi.fn(),
    pick: vi.fn(() => null),
    project: vi.fn(() => null),
    setTheme: vi.fn(),
    setQuality: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    info: vi.fn(),
    dispose: vi.fn(),
  };
}
const players = [{ id: "a", name: "A", num: 1, x: 50, y: 10 }];

beforeEach(() => {
  engine.mount.mockReset();
  Object.defineProperty(navigator, "webdriver", { value: false, configurable: true });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(((type: string) =>
    type === "webgl2" ? { getExtension: () => null } : null) as unknown as HTMLCanvasElement["getContext"]);
  document.documentElement.setAttribute("data-theme", "light");
});
afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, "webdriver");
  document.documentElement.removeAttribute("data-theme");
});

describe("<Stadium3D>", () => {
  it("never loads the engine under automation and tells the host to stay 2D", async () => {
    Object.defineProperty(navigator, "webdriver", { value: true, configurable: true });
    const onUnsupported = vi.fn();
    const ref = createRef<Stadium3DHandle>();
    const { container } = render(<Stadium3D ref={ref} players={players} onUnsupported={onUnsupported} />);
    expect(onUnsupported).toHaveBeenCalledWith("webdriver");
    expect(container.firstElementChild?.getAttribute("data-state")).toBe("unsupported");
    await expect(ref.current!.intro()).rejects.toThrow();
    expect(ref.current!.play([])).toBeNull();
    expect(engine.mount).not.toHaveBeenCalled();
  });

  it("mounts with the props and the document theme, queues early calls, follows the theme, disposes", async () => {
    const h = fakeHandle();
    let finish: (x: Handle) => void = () => undefined;
    engine.mount.mockImplementation(() => new Promise<Handle>((ok) => (finish = ok)));
    const ref = createRef<Stadium3DHandle>();
    const { container, unmount } = render(<Stadium3D ref={ref} players={players} camera="top" board={["Vamos Piti"]} />);
    await waitFor(() => expect(engine.mount).toHaveBeenCalledTimes(1));
    const opts = engine.mount.mock.calls[0][1] as MountOptions;
    expect(opts).toMatchObject({ theme: "light", players, camera: "top", board: ["Vamos Piti"] });
    expect(ref.current!.isReady()).toBe(false);
    const intro = ref.current!.intro();
    ref.current!.setBall({ x: 1, y: 2 });
    await act(async () => finish(h));
    await intro;
    expect(h.intro).toHaveBeenCalled();
    expect(h.setBall).toHaveBeenCalledWith({ x: 1, y: 2 });
    expect(ref.current!.isReady()).toBe(true);
    expect(container.firstElementChild?.getAttribute("data-state")).toBe("ready");
    await act(async () => document.documentElement.setAttribute("data-theme", "dark"));
    await waitFor(() => expect(h.setTheme).toHaveBeenLastCalledWith("dark"));
    unmount();
    expect(h.dispose).toHaveBeenCalled();
  });

  it("syncs a new seven to the engine", async () => {
    const h = fakeHandle();
    engine.mount.mockResolvedValue(h);
    const { rerender, container } = render(<Stadium3D players={players} />);
    await waitFor(() => expect(container.firstElementChild?.getAttribute("data-state")).toBe("ready"));
    const next = [{ ...players[0], x: 20 }];
    rerender(<Stadium3D players={next} />);
    expect(h.setPlayers).toHaveBeenLastCalledWith(next);
  });

  it("reports a failed load and a lost context as errors (the host shows 2D)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    engine.mount.mockRejectedValueOnce(new Error("sin kit"));
    const onError = vi.fn();
    const { container } = render(<Stadium3D players={players} onError={onError} />);
    await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "sin kit" })));
    expect(container.firstElementChild?.getAttribute("data-state")).toBe("failed");

    const h = fakeHandle();
    engine.mount.mockImplementationOnce((_el: HTMLElement, o: MountOptions) => {
      queueMicrotask(() => setTimeout(() => o.onError?.(new Error("contexto perdido")), 0));
      return Promise.resolve(h);
    });
    const onError2 = vi.fn();
    render(<Stadium3D players={players} onError={onError2} />);
    await waitFor(() => expect(onError2).toHaveBeenCalled());
    expect(h.dispose).toHaveBeenCalled();
  });

  it("disposes a handle that arrives after unmount", async () => {
    const h = fakeHandle();
    let finish: (x: Handle) => void = () => undefined;
    engine.mount.mockImplementation(() => new Promise<Handle>((ok) => (finish = ok)));
    const { unmount } = render(<Stadium3D players={players} />);
    await waitFor(() => expect(engine.mount).toHaveBeenCalled());
    unmount();
    await act(async () => finish(h));
    expect(h.dispose).toHaveBeenCalled();
  });
});
