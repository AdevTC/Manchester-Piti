import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Ref } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Stadium3DHandle } from "../../../components/pitch3d/Stadium3D";
import type { PlayController, PlayOptions, RevealOptions } from "../../../components/pitch3d/types";
import type { Lineup } from "../formations";
import { INTRO_KEY } from "./intro";
import { PREFS0 } from "./prefs";
import { demoSquad, lineupOf } from "./testkit";
import { BoardHarness as Harness } from "./testkitBoard";

// Phase 5 as a user drives it: la charla (the system, the seven one by one, the plan, the jugada,
// «¡A por ellos!»; its transport, keys, hidden tab, reduced motion, read-only boards, an incomplete
// seven, the deep link), the charla filmed in the one 3D stadium, and the opening (the 2D crane or the
// 3D intro with «Saltar», once per session). The 3D never really starts: support.ts and <Stadium3D>
// are mocked (no WebGL in tests).

const sup = vi.hoisted(() => ({ reason: "webdriver" as string | null }));
vi.mock("../../../components/pitch3d/support", () => ({
  unsupportedReason: () => sup.reason,
  supported: () => sup.reason === null,
}));

interface FakeProps {
  ref?: Ref<Stadium3DHandle>;
  onReady?: () => void;
  onError?: (e: Error) => void;
}
const s3 = vi.hoisted(() => ({ mode: "ready" as "ready" | "error" | "slow", mounts: 0, unmounts: 0, handle: null as unknown }));
vi.mock("../../../components/pitch3d/Stadium3D", async () => {
  const React = await import("react");
  function Stadium3D({ ref, ...props }: FakeProps) {
    React.useImperativeHandle(ref, () => s3.handle as Stadium3DHandle);
    const first = React.useRef(props);
    React.useEffect(() => {
      const p = first.current;
      s3.mounts++;
      if (s3.mode === "ready") p.onReady?.();
      else if (s3.mode === "error") p.onError?.(new Error("contexto WebGL perdido"));
      return () => {
        s3.unmounts++;
      };
    }, []);
    return React.createElement("div", { "data-testid": "stadium3d" });
  }
  return { Stadium3D };
});

const sq = demoSquad();
const SEVEN = ["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "adrian"];
const L7 = (): Lineup => lineupOf(SEVEN, "2-3-1", sq);

const root = (c: HTMLElement) => c.querySelector(".pzv") as HTMLElement;
const nav = () => screen.getByRole("navigation", { name: "Modos de la pizarra" });
const go = (name: string) => fireEvent.click(within(nav()).getByRole("button", { name: new RegExp("^(nuevo)?" + name + "$") }));
const openCharla = () => fireEvent.click(screen.getByRole("button", { name: "La charla: presentar el siete" }));
const counter = () => screen.getByRole("status", { name: /^Paso \d+\/\d+/ });
const lt = (c: HTMLElement) => c.querySelector(".ch-lt") as HTMLElement | null;
const card = (c: HTMLElement, id: string) => c.querySelector(`.cd[data-tok="${id}"]`) as HTMLElement;
const tick = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

function handle() {
  const ctl: PlayController = { pause: vi.fn(), resume: vi.fn(), seek: vi.fn(), stop: vi.fn(), done: Promise.resolve() };
  const h = {
    isReady: () => true,
    setPlayers: vi.fn(),
    setRivals: vi.fn(),
    setBall: vi.fn(),
    setCamera: vi.fn(async () => {}),
    setBoard: vi.fn(),
    setTheme: vi.fn(),
    intro: vi.fn(() => new Promise<void>(() => {})),
    reveal: vi.fn((_o: string[], _r?: RevealOptions) => new Promise<void>(() => {})),
    play: vi.fn((_f: unknown, _o?: PlayOptions): PlayController | null => ctl),
    pick: vi.fn(() => null),
    project: vi.fn(() => null),
    pause: vi.fn(),
    resume: vi.fn(),
    info: vi.fn(() => null),
  };
  s3.handle = h;
  return { h, ctl };
}

beforeEach(() => {
  window.history.replaceState(null, "", "/pizarra");
  // most tests are about the board, not its opening: the intro already played in this session
  sessionStorage.setItem(INTRO_KEY, "1");
  sup.reason = "webdriver";
  s3.mode = "ready";
  s3.mounts = 0;
  s3.unmounts = 0;
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  sessionStorage.clear();
  Reflect.deleteProperty(document, "hidden");
  Reflect.deleteProperty(window, "matchMedia");
});

describe("La charla", () => {
  it("runs as designed: the system, the seven face up one by one, the plan, the jugada, «¡A por ellos!»", () => {
    vi.useFakeTimers();
    const { container } = render(<Harness initial={L7()} />);
    openCharla();
    expect(root(container)).toHaveClass("m-charla");
    expect(counter()).toHaveAccessibleName("Paso 1/14: sistema");
    expect(within(lt(container)!).getByText("Así salimos")).toBeInTheDocument();
    expect(container.querySelector(".ch-big b")?.textContent).toBe("2-3-1");
    expect(container.querySelector(".bug small")?.textContent).toBe("LA CHARLA · SÁB 8 NOV");
    // every cromo face down, nothing to tap (no empty slots, no línea), the LED board says it
    expect(container.querySelectorAll(".cd.hide")).toHaveLength(7);
    expect(container.querySelector(".slot")).toBeNull();
    expect(container.querySelector(".dl-h")).toBeNull();
    expect(container.querySelector(".lks .lk")).toBeNull();
    expect(container.querySelector(".ledt b")?.textContent).toMatch(/^LA CHARLA · J8 · MAD SKY · 2-3-1 · QUÍMICA \d+ · $/);
    expect(screen.getByRole("button", { name: "Pausar la charla" })).toHaveFocus();
    // the first of the seven: he flips under the spotlight, the camera pushes in
    tick(2600);
    expect(counter()).toHaveAccessibleName("Paso 2/14: los siete");
    expect(card(container, "evans")).toHaveClass("flip", "hero");
    expect(container.querySelectorAll(".cd.hide")).toHaveLength(6);
    expect(container.querySelector(".spot")).not.toBeNull();
    expect(root(container)).toHaveClass("fcam");
    expect(within(lt(container)!).getByText("EVANS")).toBeInTheDocument();
    tick(2300);
    expect(card(container, "illescas")).toHaveClass("hero");
    expect(card(container, "evans")).toHaveClass("dim");
    expect(card(container, "evans")).not.toHaveClass("hide");
    // the rest of the seven, then the plan: discs, the consignas, the plan painted, the química lit
    for (let i = 0; i < 6; i++) tick(2300);
    expect(counter()).toHaveAccessibleName("Paso 9/14: el plan");
    expect(container.querySelectorAll(".cd.mini")).toHaveLength(7);
    expect(container.querySelectorAll(".ch-plan > div")).toHaveLength(4);
    expect(lt(container)).toBeNull();
    expect(root(container)).toHaveClass("chp");
    expect(container.querySelector(".tarr")).not.toBeNull();
    expect(container.querySelector(".lks .lk")).not.toBeNull();
    // the jugada: its pasos on the pitch, with the rivals and the ball
    tick(4400);
    expect(counter()).toHaveAccessibleName("Paso 10/14: jugada");
    expect(within(lt(container)!).getByText("LA JUGADA · CÓRNER · PASO 1 DE 4")).toBeInTheDocument();
    expect(container.querySelectorAll(".rv")).toHaveLength(5);
    expect(container.querySelector(".ball")).not.toBeNull();
    for (let i = 0; i < 4; i++) tick(2400);
    // «¡A por ellos!»: the flash and the sparks, the big words; it stops there
    expect(counter()).toHaveAccessibleName("Paso 14/14: final");
    expect(container.querySelector(".ch-big.fin b")?.textContent).toBe("¡A POR ELLOS!");
    expect(container.querySelector(".fx .cele")).not.toBeNull();
    expect(root(container)).toHaveClass("cheer");
    expect(screen.getByRole("button", { name: "Reproducir la charla" })).toBeInTheDocument();
    tick(10000);
    expect(counter()).toHaveAccessibleName("Paso 14/14: final");
    // play again: from the start
    fireEvent.click(screen.getByRole("button", { name: "Reproducir la charla" }));
    expect(counter()).toHaveAccessibleName("Paso 1/14: sistema");
    // «Salir»: back to the board, everything face up
    fireEvent.click(screen.getByRole("button", { name: "Salir" }));
    expect(root(container)).toHaveClass("m-editar");
    expect(container.querySelector(".ch")).toBeNull();
    expect(container.querySelector(".cd.hide")).toBeNull();
  });

  it("the transport: prev / next and the timeline pause it; the guion in the sheet follows", () => {
    vi.useFakeTimers();
    render(<Harness initial={L7()} />);
    openCharla();
    fireEvent.click(screen.getByRole("button", { name: "Paso siguiente" }));
    expect(counter()).toHaveAccessibleName("Paso 2/14: los siete");
    expect(screen.getByRole("button", { name: "Reproducir la charla" })).toBeInTheDocument();
    tick(10000);
    expect(counter()).toHaveAccessibleName("Paso 2/14: los siete");
    fireEvent.change(screen.getByRole("slider", { name: "Momento de la charla" }), { target: { value: "8" } });
    expect(counter()).toHaveAccessibleName("Paso 9/14: el plan");
    fireEvent.click(screen.getByRole("button", { name: "Paso anterior" }));
    expect(counter()).toHaveAccessibleName("Paso 8/14: los siete");
    const guion = screen.getByRole("heading", { name: "El guion" }).closest("section") as HTMLElement;
    expect(within(guion).getByText("10 · ADRIAN").closest("li")).toHaveAttribute("aria-current", "step");
    expect(within(guion).getByText("Córner · 1 · Colocación")).toBeInTheDocument();
    expect(within(guion).getByText("Sin 3D en este dispositivo: la charla se presenta sobre la pizarra.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reproducir la charla" }));
    tick(2300);
    expect(counter()).toHaveAccessibleName("Paso 9/14: el plan");
  });

  it("the keys: Space plays / pauses, ← → step, Escape leaves", () => {
    vi.useFakeTimers();
    const { container } = render(<Harness initial={L7()} />);
    openCharla();
    (document.activeElement as HTMLElement).blur();
    fireEvent.keyDown(document.body, { key: " " });
    expect(screen.getByRole("button", { name: "Reproducir la charla" })).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: "ArrowRight" });
    fireEvent.keyDown(document.body, { key: "ArrowRight" });
    expect(counter()).toHaveAccessibleName("Paso 3/14: los siete");
    fireEvent.keyDown(document.body, { key: "ArrowLeft" });
    expect(counter()).toHaveAccessibleName("Paso 2/14: los siete");
    fireEvent.keyDown(document.body, { key: " " });
    expect(screen.getByRole("button", { name: "Pausar la charla" })).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(root(container)).toHaveClass("m-editar");
  });

  it("a hidden tab pauses it; coming back, it goes on", () => {
    vi.useFakeTimers();
    render(<Harness initial={L7()} />);
    openCharla();
    act(() => {
      Object.defineProperty(document, "hidden", { value: true, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(screen.getByRole("button", { name: "Reproducir la charla" })).toBeInTheDocument();
    tick(10000);
    expect(counter()).toHaveAccessibleName("Paso 1/14: sistema");
    act(() => {
      Object.defineProperty(document, "hidden", { value: false, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    tick(2600);
    expect(counter()).toHaveAccessibleName("Paso 2/14: los siete");
  });

  it("reduced motion: no clock and no flash — one step at a time by hand", () => {
    vi.useFakeTimers();
    window.matchMedia = vi.fn((q: string) => ({ matches: q.includes("reduce"), media: q, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false }));
    const { container } = render(<Harness initial={L7()} />);
    openCharla();
    tick(10000);
    expect(counter()).toHaveAccessibleName("Paso 1/14: sistema");
    fireEvent.click(screen.getByRole("button", { name: "Avanzar la charla un paso" }));
    expect(counter()).toHaveAccessibleName("Paso 2/14: los siete");
    expect(container.querySelector(".cd.slow")).toBeNull();
    fireEvent.change(screen.getByRole("slider", { name: "Momento de la charla" }), { target: { value: "13" } });
    expect(container.querySelector(".fx .cele")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Volver al principio de la charla" }));
    expect(counter()).toHaveAccessibleName("Paso 1/14: sistema");
  });

  it("anyone can watch the official: a read-only board presents too", () => {
    vi.useFakeTimers();
    const { container } = render(<Harness initial={L7()} ro />);
    openCharla();
    tick(2600);
    expect(counter()).toHaveAccessibleName("Paso 2/14: los siete");
    expect(container.querySelector(".tst.on")).toBeNull();
  });

  it("an incomplete seven: the charla says what is missing and presents the hole", () => {
    vi.useFakeTimers();
    const { container } = render(<Harness initial={lineupOf(["evans", null, "tello", "huberoski", "eguzquiza", "almachi", "adrian"], "2-3-1", sq)} />);
    openCharla();
    expect(within(lt(container)!).getByText(/Falta 1 en el siete: sus huecos salen en la charla\./)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("slider", { name: "Momento de la charla" }), { target: { value: "2" } });
    expect(within(lt(container)!).getByText("Hueco libre")).toBeInTheDocument();
    expect(within(lt(container)!).getByText("Falta un jugador en DFC.")).toBeInTheDocument();
    expect(container.querySelectorAll(".cd")).toHaveLength(6);
  });

  it("vibrates only in answer to a press, never while it plays on its own", () => {
    vi.useFakeTimers();
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true });
    // the browser would allow it (the page has been tapped): still, autoplay steps don't buzz
    Object.defineProperty(navigator, "userActivation", { configurable: true, get: () => ({ hasBeenActive: true, isActive: true }) });
    render(<Harness initial={L7()} />);
    openCharla();
    vibrate.mockClear();
    tick(2600);
    expect(counter()).toHaveAccessibleName("Paso 2/14: los siete");
    expect(vibrate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Paso siguiente" }));
    expect(vibrate).toHaveBeenCalledWith(14);
    Reflect.deleteProperty(navigator, "vibrate");
    Reflect.deleteProperty(navigator, "userActivation");
  });

  it("singular and plural in the lower third: «1 partido · 1 gol»", () => {
    const one = demoSquad();
    one.byId.set("evans", { ...one.byId.get("evans")!, stats: { played: 1, goals: 1, assists: 0, minutes: 50, starts: 1, mvps: 0 } });
    const { container } = render(<Harness initial={L7()} props={{ squad: one }} />);
    openCharla();
    fireEvent.click(screen.getByRole("button", { name: "Paso siguiente" }));
    expect(within(lt(container)!).getByText("1 partido · 1 gol · 0 asist. · forma 87")).toBeInTheDocument();
  });

  it("an empty board: the charla says so", () => {
    const { container } = render(<Harness initial={lineupOf([], "2-3-1", sq)} />);
    openCharla();
    expect(within(lt(container)!).getByText(/El siete está vacío/)).toBeInTheDocument();
  });

  it("«Verla en la charla» presents the jugada picked in Jugadas; else the córner", () => {
    const { container } = render(<Harness initial={L7()} />);
    go("Jugadas");
    fireEvent.click(screen.getByRole("button", { name: "Falta frontal (estrategia)" }));
    fireEvent.click(screen.getByRole("button", { name: "Verla en la charla" }));
    expect(root(container)).toHaveClass("m-charla");
    // a falta has three pasos: 9 + 3 + 1 steps
    expect(counter()).toHaveAccessibleName("Paso 1/13: sistema");
    fireEvent.change(screen.getByRole("slider", { name: "Momento de la charla" }), { target: { value: "9" } });
    expect(within(lt(container)!).getByText("LA JUGADA · FALTA · PASO 1 DE 3")).toBeInTheDocument();
  });

  it("a link straight to the charla waits for the board to load before it runs", () => {
    vi.useFakeTimers();
    window.history.replaceState(null, "", "/pizarra#charla");
    const { container, rerender } = render(<Harness initial={L7()} session={{ ready: false }} />);
    expect(within(lt(container)!).getByText(/Cargando el siete…/)).toBeInTheDocument();
    tick(10000);
    expect(counter()).toHaveAccessibleName("Paso 1/14: sistema");
    rerender(<Harness initial={L7()} session={{ ready: true }} />);
    tick(2600);
    expect(counter()).toHaveAccessibleName("Paso 2/14: los siete");
  });

  it("a link straight to #charla opens it (with no intro)", () => {
    sessionStorage.clear();
    window.history.replaceState(null, "", "/pizarra#charla");
    const { container } = render(<Harness initial={L7()} />);
    expect(root(container)).toHaveClass("m-charla");
    expect(root(container)).not.toHaveClass("intro");
    expect(counter()).toHaveAccessibleName("Paso 1/14: sistema");
  });
});

describe("La charla en el estadio 3D", () => {
  it("the one stadium films it: the engine paces the seven and reports each one; leaving, it rests", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    sup.reason = null;
    const { h } = handle();
    const { container } = render(<Harness initial={L7()} />);
    expect(s3.mounts).toBe(0);
    openCharla();
    await waitFor(() => expect(root(container)).toHaveClass("v3"));
    expect(s3.mounts).toBe(1);
    expect(container.querySelector(".bug small")?.textContent).toBe("LA CHARLA · ESTADIO 3D · SÁB 8 NOV");
    await waitFor(() => expect(h.setCamera).toHaveBeenCalledWith("stands", { duration: 0 }));
    // the system holds its beat on the board's clock; then the engine takes the seven
    tick(2600);
    expect(h.reveal).toHaveBeenCalledWith(SEVEN, expect.objectContaining({ stepMs: 2300 }));
    tick(10000);
    expect(counter()).toHaveAccessibleName("Paso 2/14: los siete");
    const o = h.reveal.mock.calls[0][1];
    act(() => o?.onStep?.(2, { id: "tello", name: "TELLO", num: 20, x: 0, y: 0 }));
    expect(counter()).toHaveAccessibleName("Paso 4/14: los siete");
    const guion = screen.getByRole("heading", { name: "El guion" }).closest("section") as HTMLElement;
    expect(within(guion).getByText("En el estadio 3D: la cámara visita a cada jugador.")).toBeInTheDocument();
    // paused: the low camera on the hero
    fireEvent.click(screen.getByRole("button", { name: "Pausar la charla" }));
    expect(h.setCamera).toHaveBeenLastCalledWith("low", { duration: 900 });
    // leaving: back to the board; the stadium stays, resting, for the next 3D moment
    fireEvent.click(screen.getByRole("button", { name: "Salir de la charla" }));
    expect(root(container)).not.toHaveClass("v3");
    tick(1100);
    expect(h.pause).toHaveBeenCalled();
    expect(s3.unmounts).toBe(0);
    // the jugadas use the same stadium (no second one)
    go("Jugadas");
    fireEvent.click(screen.getByRole("button", { name: "Reproducir la repetición" }));
    await waitFor(() => expect(root(container)).toHaveClass("v3"));
    expect(h.play).toHaveBeenCalled();
    expect(s3.mounts).toBe(1);
  });

  it("the transport acts on every press while the stadium films: fourteen quick «siguiente» reach the end", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    sup.reason = null;
    const { h } = handle();
    const { container } = render(<Harness initial={L7()} />);
    openCharla();
    await waitFor(() => expect(root(container)).toHaveClass("v3"));
    tick(2600);
    expect(h.reveal).toHaveBeenCalled();
    const next = screen.getByRole("button", { name: "Paso siguiente" });
    // all the presses land before the board draws any of them
    act(() => {
      for (let k = 0; k < 14; k++) next.click();
    });
    expect(counter()).toHaveAccessibleName("Paso 14/14: final");
    // the stadium is cut to the step asked for at once: «¡A por ellos!» in the stands
    await waitFor(() => expect(h.setCamera).toHaveBeenLastCalledWith("stands", { duration: 2600 }));
    expect(h.setBoard).toHaveBeenLastCalledWith(["¡A por ellos!", "Manchester Piti", "J8 · MAD SKY"]);
    // and back by hand, one step per press
    const prev = screen.getByRole("button", { name: "Paso anterior" });
    act(() => {
      for (let k = 0; k < 3; k++) prev.click();
    });
    expect(counter()).toHaveAccessibleName("Paso 11/14: jugada");
  });

  it("if the stadium fails, the charla goes on over the board", async () => {
    sup.reason = null;
    s3.mode = "error";
    handle();
    const { container } = render(<Harness initial={L7()} />);
    openCharla();
    await screen.findByText("El 3D no ha podido arrancar: seguimos en 2D");
    expect(root(container)).not.toHaveClass("v3");
    expect(container.querySelector("[data-testid=stadium3d]")).toBeNull();
    expect(counter()).toHaveAccessibleName("Paso 1/14: sistema");
  });
});

describe("La apertura", () => {
  it("the 2D crane once per session; the next visit finds the board at rest", () => {
    vi.useFakeTimers();
    sessionStorage.clear();
    const { container, unmount } = render(<Harness initial={L7()} />);
    expect(root(container)).toHaveClass("intro");
    tick(3300);
    expect(root(container)).not.toHaveClass("intro");
    unmount();
    const again = render(<Harness initial={L7()} />);
    expect(root(again.container)).not.toHaveClass("intro");
  });

  it("the 3D intro where the device can: the 2D board hidden, the engine's intro; «Saltar» crossfades to the board", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    sessionStorage.clear();
    sup.reason = null;
    const { h } = handle();
    const { container } = render(<Harness initial={L7()} />);
    expect(root(container)).toHaveClass("i3");
    expect(root(container)).not.toHaveClass("intro");
    await waitFor(() => expect(h.intro).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Saltar la presentación" }));
    expect(root(container)).not.toHaveClass("i3");
    expect(root(container)).toHaveClass("hand");
    expect(h.setCamera).toHaveBeenCalledWith("tv", { duration: 0 });
    tick(1500);
    expect(root(container)).not.toHaveClass("hand");
    expect(screen.queryByRole("button", { name: "Saltar la presentación" })).toBeNull();
  });

  it("Escape skips the 3D intro too", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    sessionStorage.clear();
    sup.reason = null;
    const { h } = handle();
    const { container } = render(<Harness initial={L7()} />);
    await waitFor(() => expect(h.intro).toHaveBeenCalled());
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(root(container)).not.toHaveClass("i3");
  });

  it("the 3D intro never lasts longer than 3,5 s", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    sessionStorage.clear();
    sup.reason = null;
    const { h } = handle();
    const { container } = render(<Harness initial={L7()} />);
    await waitFor(() => expect(h.intro).toHaveBeenCalled());
    tick(3500);
    expect(root(container)).not.toHaveClass("i3");
  });

  it("a stadium slow to come up: the 2D crane plays instead", () => {
    vi.useFakeTimers();
    sessionStorage.clear();
    sup.reason = null;
    s3.mode = "slow";
    handle();
    const { container } = render(<Harness initial={L7()} />);
    expect(root(container)).toHaveClass("i3");
    tick(2000);
    expect(root(container)).not.toHaveClass("i3");
    expect(root(container)).toHaveClass("intro");
  });

  it("«3D» off in Ajustes, or reduced motion: the 2D crane, or nothing", () => {
    sessionStorage.clear();
    sup.reason = null;
    const off = render(<Harness initial={L7()} props={{ prefs: { ...PREFS0, v3: false } }} />);
    expect(root(off.container)).toHaveClass("intro");
    expect(s3.mounts).toBe(0);
    off.unmount();
    sessionStorage.clear();
    window.matchMedia = vi.fn((q: string) => ({ matches: q.includes("reduce"), media: q, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false }));
    const { container } = render(<Harness initial={L7()} />);
    expect(root(container)).not.toHaveClass("intro");
    expect(root(container)).not.toHaveClass("i3");
  });
});
