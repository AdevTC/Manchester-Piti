import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Lineup } from "../formations";
import { newPlay, type Play } from "../plays";
import { demoSquad, lineupOf } from "./testkit";
import { BoardHarness as Harness } from "./testkitBoard";
import { PREFS0 } from "./prefs";
import { goFree } from "./ops";
import { boardSpots } from "./jugadas";
import type { VozStore } from "./vozStore";

// Bloque 5 · B as a user drives the board: several fichas moved at once (free mode and a paso), the jugada's
// video link, the presentation mode (P, «Presentar», Esc, the browser's own way out) and the charla's voice.

vi.mock("../../../components/pitch3d/support", () => ({ unsupportedReason: () => "webdriver", supported: () => false }));

const sq = demoSquad();
const SEVEN = ["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "adrian"];
const L7 = (): Lineup => lineupOf(SEVEN, "2-3-1", sq);
const nav = () => screen.getByRole("navigation", { name: "Herramientas de la pizarra" });
const go = (name: string) => fireEvent.click(within(nav()).getByRole("button", { name: new RegExp("^(nuevo)?" + name + "$") }));
const root = (c: HTMLElement) => c.querySelector(".pzv") as HTMLElement;
const sr = (c: HTMLElement) => (c.querySelector(".pzv .sr") as HTMLElement).textContent?.replace(/[​‌]/g, "") ?? "";
const cromoButton = (name: string) => screen.getByRole("button", { name: new RegExp("^" + name + ", dorsal") });
const P0 = { prefs: { ...PREFS0, v3: false } };
const slotOf = (L: Lineup | undefined, id: string) => L?.slots.find((s) => s.playerId === id);

beforeEach(() => {
  window.history.replaceState(null, "", "/pizarra");
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("varias fichas a la vez · modo libre", () => {
  it("Mayús + Intro picks cromos (rings, said); the arrows move them together; Esc lets them go", () => {
    const commits: Lineup[] = [];
    const L = goFree(L7());
    const { container } = render(<Harness initial={L} props={P0} onCommit={(l) => commits.push(l)} />);
    const bar = screen.getByRole("group", { name: "Mover varias fichas a la vez" });
    expect(within(bar).getByRole("button", { name: "Seleccionar" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.keyDown(cromoButton("TELLO"), { key: "Enter", shiftKey: true });
    expect(sr(container)).toBe("TELLO elegido · 1 ficha para mover juntas");
    fireEvent.keyDown(cromoButton("ADRIAN"), { key: "Enter", shiftKey: true });
    expect(sr(container)).toBe("ADRIAN elegido · 2 fichas para mover juntas");
    expect(container.querySelectorAll(".b5p-ring")).toHaveLength(2);
    expect(within(bar).getByText("elegidas")).toBeInTheDocument();
    // (nothing went into the hand: Mayús + Intro is not a tap)
    expect(screen.queryByRole("toolbar", { name: /^En la mano/ })).toBeNull();
    fireEvent.keyDown(cromoButton("TELLO"), { key: "ArrowRight" });
    const last = commits.at(-1);
    // (the grid is on: a step is one 5 % square)
    const g5 = (v: number) => Math.round((v + 5) / 5) * 5;
    expect(slotOf(last, "tello")?.x).toBe(g5(slotOf(L, "tello")?.x ?? 0));
    expect(slotOf(last, "adrian")?.x).toBe(g5(slotOf(L, "adrian")?.x ?? 0));
    expect(slotOf(last, "evans")).toEqual(slotOf(L, "evans"));
    expect(sr(container)).toMatch(/^2 fichas movidas al? /);
    // Ctrl Z takes the whole move back at once
    fireEvent.keyDown(document.body, { key: "z", ctrlKey: true });
    expect(slotOf(commits.at(-1), "tello")?.x).toBe(slotOf(L, "tello")?.x);
    fireEvent.keyDown(cromoButton("TELLO"), { key: "Escape" });
    expect(sr(container)).toBe("Fichas soltadas");
    expect(container.querySelectorAll(".b5p-ring")).toHaveLength(0);
  });

  it("«Seleccionar» (touch) is a toggle, said; a board in a system, or read-only, has no picking", () => {
    const { container, unmount } = render(<Harness initial={goFree(L7())} props={P0} />);
    fireEvent.click(screen.getByRole("button", { name: "Seleccionar" }));
    expect(screen.getByRole("button", { name: "Seleccionar" })).toHaveAttribute("aria-pressed", "true");
    expect(sr(container)).toBe("Seleccionar: toca las fichas que quieras mover juntas");
    expect(screen.getByText("Toca las fichas que quieras mover juntas")).toBeInTheDocument();
    unmount();
    const r2 = render(<Harness initial={L7()} props={P0} />);
    expect(screen.queryByRole("group", { name: "Mover varias fichas a la vez" })).toBeNull();
    r2.unmount();
    render(<Harness initial={goFree(L7())} ro props={P0} />);
    expect(screen.queryByRole("group", { name: "Mover varias fichas a la vez" })).toBeNull();
  });
});

describe("varias fichas a la vez · una jugada", () => {
  const own = (): Play => newPlay("Mía", boardSpots(L7()));
  it("the ball and a rival picked by keyboard move together in the paso (one jugada edit)", () => {
    const commits: Lineup[] = [];
    const pl = own();
    const { container } = render(<Harness initial={{ ...L7(), plays: [pl] }} props={P0} onCommit={(l) => commits.push(l)} />);
    go("Jugadas");
    fireEvent.click(screen.getByRole("button", { name: "Mía (propia)" }));
    const ball = screen.getByRole("button", { name: /^Balón, en / });
    const rival = screen.getByRole("button", { name: /^Rival 1, en / });
    fireEvent.keyDown(ball, { key: "Enter", shiftKey: true });
    fireEvent.keyDown(rival, { key: "Enter", shiftKey: true });
    expect(sr(container)).toBe("Un rival elegido · 2 fichas para mover juntas");
    // (Mayús + Intro on a rival picks it; it does not mark it)
    expect(rival).toHaveAttribute("aria-pressed", "false");
    fireEvent.keyDown(screen.getByRole("button", { name: /^Balón, en / }), { key: "ArrowUp" });
    const saved = commits.at(-1)?.plays.find((x) => x.id === pl.id);
    expect(saved?.frames[0].ball.y).toBeCloseTo(pl.frames[0].ball.y - 2, 5);
    expect(saved?.frames[0].rivals[0].y).toBeCloseTo(pl.frames[0].rivals[0].y - 2, 5);
    expect(saved?.frames[0].rivals[1]).toEqual(pl.frames[0].rivals[1]);
    expect(sr(container)).toMatch(/^2 fichas movidas /);
  });
});

describe("Ver en vídeo", () => {
  it("links a video (https only) at its minute; it opens in a new tab; it is taken off", () => {
    const commits: Lineup[] = [];
    const pl = newPlay("Mía", boardSpots(L7()));
    render(<Harness initial={{ ...L7(), plays: [pl] }} props={P0} onCommit={(l) => commits.push(l)} />);
    go("Jugadas");
    fireEvent.click(screen.getByRole("button", { name: "Mía (propia)" }));
    fireEvent.click(screen.getByRole("button", { name: "Enlazar un vídeo" }));
    const url = screen.getByLabelText("Enlace del vídeo (https)");
    fireEvent.change(url, { target: { value: "http://youtu.be/abc" } });
    fireEvent.change(screen.getByLabelText("Empieza en (min:seg)"), { target: { value: "1:05" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar el vídeo" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Solo enlaces seguros: tiene que empezar por https://");
    expect(url).toHaveAttribute("aria-invalid", "true");
    fireEvent.change(url, { target: { value: "https://youtu.be/abc" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar el vídeo" }));
    expect(commits.at(-1)?.plays.find((x) => x.id === pl.id)?.video).toEqual({ url: "https://youtu.be/abc", at: 65 });
    const link = screen.getByRole("link", { name: "Ver en vídeo (1:05), en youtu.be. Se abre en otra pestaña" });
    expect(link).toHaveAttribute("href", "https://youtu.be/abc?t=65s");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    fireEvent.click(screen.getByRole("button", { name: "Quitar el vídeo" }));
    expect(commits.at(-1)?.plays.find((x) => x.id === pl.id)?.video).toBeUndefined();
    expect(screen.queryByRole("link", { name: /Ver en vídeo/ })).toBeNull();
  });

  it("a read-only board shows the link but not the editor", () => {
    const pl = { ...newPlay("Mía", boardSpots(L7())), video: { url: "https://club.es/corner.mp4", at: 12 } };
    render(<Harness initial={{ ...L7(), plays: [pl] }} ro props={P0} />);
    go("Jugadas");
    fireEvent.click(screen.getByRole("button", { name: "Mía (propia)" }));
    expect(screen.getByRole("link", { name: /^Ver en vídeo \(0:12\)/ })).toHaveAttribute("href", "https://club.es/corner.mp4#t=12");
    expect(screen.queryByRole("button", { name: /vídeo/ })).toBeNull();
  });
});

describe("modo presentación", () => {
  it("P opens it (the chrome hidden, the LED, the controls with the focus); Esc closes it and the focus goes back", () => {
    const { container } = render(<Harness initial={L7()} props={P0} />);
    fireEvent.keyDown(document.body, { key: "p" });
    expect(root(container)).toHaveClass("b5p-pres");
    expect(sr(container)).toBe("Modo presentación: el campo a toda pantalla. Esc o P para salir.");
    const bar = screen.getByRole("toolbar", { name: "Modo presentación" });
    expect(within(bar).getByRole("button", { name: "La charla" })).toHaveFocus();
    expect(container.querySelector(".b5p-led")?.textContent).toMatch(/^MANCHESTER PITI {2}· {2}J8 · MAD SKY {2}· {2}SISTEMA 2-3-1/);
    // the tool keys wait while it is on
    fireEvent.keyDown(document.body, { key: "3" });
    expect(root(container).getAttribute("data-modo")).toBe("editar");
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(root(container)).not.toHaveClass("b5p-pres");
    expect(screen.queryByRole("toolbar", { name: "Modo presentación" })).toBeNull();
  });

  it("«Presentar» in the command bar, then «Jugadas»: the jugada's transport at the bottom; «Salir»", () => {
    const { container } = render(<Harness initial={L7()} props={P0} />);
    const btn = screen.getByRole("button", { name: "Presentar: el campo a toda pantalla (P)" });
    btn.focus();
    fireEvent.click(btn);
    expect(root(container)).toHaveClass("b5p-pres");
    fireEvent.click(within(screen.getByRole("toolbar", { name: "Modo presentación" })).getByRole("button", { name: "Jugadas" }));
    const bar = screen.getByRole("toolbar", { name: "Modo presentación" });
    expect(root(container).getAttribute("data-modo")).toBe("jugadas");
    expect(within(bar).getByText(/^Paso 1 de \d/)).toBeInTheDocument();
    fireEvent.click(within(bar).getByRole("button", { name: "Paso siguiente" }));
    expect(within(bar).getByText(/^Paso 2 de \d/)).toBeInTheDocument();
    fireEvent.click(within(bar).getByRole("button", { name: "Salir del modo presentación (Esc)" }));
    expect(root(container)).not.toHaveClass("b5p-pres");
  });

  it("with the browser's full screen, leaving it (its own Esc) closes the presentation", async () => {
    let fsEl: Element | null = null;
    Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => fsEl });
    const req = vi.fn(async () => {
      fsEl = document.body;
    });
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", { configurable: true, value: req });
    const { container } = render(<Harness initial={L7()} props={P0} />);
    await act(async () => {
      fireEvent.keyDown(document.body, { key: "P" });
    });
    expect(req).toHaveBeenCalledTimes(1);
    expect(root(container)).toHaveClass("b5p-pres");
    act(() => {
      fsEl = null;
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    expect(root(container)).not.toHaveClass("b5p-pres");
    delete (HTMLElement.prototype as { requestFullscreen?: unknown }).requestFullscreen;
    delete (document as { fullscreenElement?: unknown }).fullscreenElement;
  });

  it("the prompt bar offers «P Presentar»", () => {
    const { container } = render(<Harness initial={L7()} props={P0} />);
    fireEvent.click(within(container.querySelector(".pmb") as HTMLElement).getByRole("button", { name: "Presentar (P)" }));
    expect(root(container)).toHaveClass("b5p-pres");
  });
});

describe("la voz en off en la charla", () => {
  it("the charla asks the store for its clips and shows the step's voice controls", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    const want = vi.fn();
    const store: VozStore = {
      clips: [{ slot: "v0", step: "sistema", mime: "audio/webm", ms: 4000, data: "AQID", at: 1 }],
      loading: false,
      error: false,
      stored: true,
      save: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
      want,
    };
    render(<Harness initial={L7()} props={{ ...P0, voz: store }} />);
    expect(want).toHaveBeenLastCalledWith(false);
    fireEvent.click(screen.getByRole("button", { name: "La charla: presentar el siete" }));
    expect(want).toHaveBeenLastCalledWith(true);
    const g = screen.getByRole("group", { name: "Voz en off: el sistema" });
    expect(within(g).getByRole("button", { name: "Silenciar la voz" })).toBeInTheDocument();
    // (jsdom has no MediaRecorder: the captain hears why it cannot be recorded here)
    expect(within(g).getByText(/Este navegador no puede grabar audio/)).toBeInTheDocument();
    await act(async () => {});
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
  });
});
