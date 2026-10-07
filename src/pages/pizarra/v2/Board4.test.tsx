import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState, type Ref } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Stadium3DHandle } from "../../../components/pitch3d/Stadium3D";
import type { PlayController, PlayOptions } from "../../../components/pitch3d/types";
import type { Stroke } from "../drawings";
import type { Lineup } from "../formations";
import { libraryPlays } from "../playLibrary";
import { toEngineFrames, type Play } from "../plays";
import { CAMS, proj, type CamName } from "./geometry";
import { framePointToPitch } from "./telestrator";
import { PREFS0, type BoardPrefs } from "./prefs";
import { demoSquad, lineupOf } from "./testkit";
import { BoardHarness as Harness, type HarnessProps } from "./testkitBoard";

// Phase 4 as a user drives it: Dibujar (the telestrator) and Jugadas (the library and your own, the
// editor, the «REPETICIÓN» replay, «En 3D»). The 3D stadium is never started: support.ts and the
// <Stadium3D> wrapper are mocked (no WebGL in tests).

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
const s3 = vi.hoisted(() => ({
  mode: "ready" as "ready" | "error",
  mounts: 0,
  unmounts: 0,
  handle: null as unknown,
}));
vi.mock("../../../components/pitch3d/Stadium3D", async () => {
  const React = await import("react");
  function Stadium3D({ ref, ...props }: FakeProps) {
    React.useImperativeHandle(ref, () => s3.handle as Stadium3DHandle);
    // mount-only, like the real stadium (the first props are the ones it starts with)
    const first = React.useRef(props);
    React.useEffect(() => {
      const p = first.current;
      s3.mounts++;
      if (s3.mode === "ready") p.onReady?.();
      else p.onError?.(new Error("contexto WebGL perdido"));
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
const W = 400;

const nav = () => screen.getByRole("navigation", { name: "Modos de la pizarra" });
const go = (name: string) => fireEvent.click(within(nav()).getByRole("button", { name: new RegExp("^(nuevo)?" + name + "$") }));
const root = (c: HTMLElement) => c.querySelector(".pzv") as HTMLElement;
const frame = (c: HTMLElement) => c.querySelector("[data-frame]") as HTMLElement;
const camOf = (c: HTMLElement): CamName => (frame(c).classList.contains("top") ? "top" : "tv");
/** Where pitch point (u, v) is on the screen (the frame is W px wide at the page's origin). */
const at = (cam: CamName, u: number, v: number) => {
  const q = proj(CAMS[cam], u, v);
  return { clientX: (q.x / 100) * W, clientY: (q.y / 100) * W * CAMS[cam].Fh };
};
/** A finger on `el`, through the points, and up. */
function swipe(el: Element, pts: { clientX: number; clientY: number }[]) {
  fireEvent.pointerDown(el, { button: 0, ...pts[0] });
  for (const p of pts.slice(1)) fireEvent.pointerMove(window, p);
  fireEvent.pointerUp(window, pts[pts.length - 1]);
}
const line = (cam: CamName, a: [number, number], b: [number, number], n = 6) =>
  Array.from({ length: n + 1 }, (_, k) => at(cam, a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n));
const toolBtn = (name: string) => within(screen.getByRole("group", { name: "Herramienta de dibujo" })).getByRole("button", { name });
const stroke = (id: string, kind: Stroke["kind"] = "pase"): Stroke => ({ id, kind, color: "sky", points: [{ x: 10, y: 10 }, { x: 30, y: 30 }] });
const bug = () => screen.getByRole("button", { name: /^Repetición:/ });
const corner = (): Play => libraryPlays(L7())[0];

/** The board with its preferences kept in state (Ajustes / «En 3D» change them). */
function WithPrefs({ prefs: p0 = PREFS0, ...h }: HarnessProps & { prefs?: BoardPrefs }) {
  const [prefs, setPrefs] = useState(p0);
  return <Harness {...h} props={{ ...h.props, prefs, onPrefs: (p) => setPrefs((x) => ({ ...x, ...p })) }} />;
}

beforeEach(() => {
  window.history.replaceState(null, "", "/pizarra");
  sup.reason = "webdriver";
  s3.mode = "ready";
  s3.mounts = 0;
  s3.unmounts = 0;
  // the frame is W px wide (its height follows the camera); everything else has no box
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const fr = this.matches("[data-frame]");
    const h = fr ? W * CAMS[this.classList.contains("top") ? "top" : "tv"].Fh : 0;
    const w = fr ? W : 0;
    return { x: 0, y: 0, left: 0, top: 0, width: w, height: h, right: w, bottom: h, toJSON: () => ({}) } as DOMRect;
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  Reflect.deleteProperty(document, "hidden");
  Reflect.deleteProperty(window, "matchMedia");
});

describe("Dibujar", () => {
  it("draws a stroke of light where the finger goes (gold carrera by default, any tool and colour)", () => {
    const commits: Lineup[] = [];
    const { container } = render(<Harness initial={L7()} onCommit={(l) => commits.push(l)} />);
    go("Dibujar");
    expect(toolBtn("Carrera")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Dibuja sobre el césped: carrera (puntos de luz).", { selector: ".hint span" })).toBeInTheDocument();
    swipe(frame(container), line("tv", [20, 80], [50, 40]));
    const s = commits.at(-1)?.drawings ?? [];
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ kind: "carrera", color: "gold" });
    expect(s[0].points[0].x).toBeCloseTo(20, 0);
    expect(s[0].points[0].y).toBeCloseTo(80, 0);
    expect(s[0].points.at(-1)?.x).toBeCloseTo(50, 0);
    expect(s[0].points.at(-1)?.y).toBeCloseTo(40, 0);
    // drawn at once (no waiting in line), dotted
    const g = container.querySelector(".ink g.c-g") as SVGGElement;
    expect(g.style.getPropertyValue("--dl")).toBe("0.00s");
    expect(g.querySelector("path.dt.drw")).not.toBeNull();
    // the strokes have their own undo: the lineup's stays as it was
    expect(screen.getByRole("button", { name: "Deshacer" })).toBeDisabled();
    // a zona in cielo
    fireEvent.click(toolBtn("Zona"));
    fireEvent.click(screen.getByRole("button", { name: "Color Cielo" }));
    swipe(frame(container), line("tv", [60, 30], [85, 55]));
    expect(commits.at(-1)?.drawings[1]).toMatchObject({ kind: "zona", color: "sky" });
    expect(container.querySelector(".ink g.c-s path.zf")).not.toBeNull();
    // a lápiz keeps its (simplified) path
    fireEvent.click(toolBtn("Lápiz"));
    swipe(frame(container), [...line("tv", [10, 50], [30, 60]), ...line("tv", [30, 60], [40, 45])]);
    const pen = commits.at(-1)?.drawings[2];
    expect(pen?.kind).toBe("lapiz");
    expect(pen?.points.length).toBeGreaterThan(2);
    expect(screen.getByRole("heading", { name: /Trazos de luz.*3 en el césped/ })).toBeInTheDocument();
  });

  it("maps the finger to the pitch with the cenital camera too", () => {
    const commits: Lineup[] = [];
    const { container } = render(<Harness initial={L7()} onCommit={(l) => commits.push(l)} props={{ prefs: { ...PREFS0, cam: "top" } }} />);
    go("Dibujar");
    expect(camOf(container)).toBe("top");
    fireEvent.click(toolBtn("Pase"));
    const pts = line("top", [15, 90], [85, 10]);
    swipe(frame(container), pts);
    const s = commits.at(-1)?.drawings[0];
    expect(s?.kind).toBe("pase");
    const end = pts[pts.length - 1];
    const want = framePointToPitch(CAMS.top, (end.clientX / W) * 100, (end.clientY / (W * CAMS.top.Fh)) * 100);
    expect(s?.points.at(-1)).toEqual(want);
    expect(want.x).toBeCloseTo(85, 0);
    expect(want.y).toBeCloseTo(10, 0);
  });

  it("texto: the words typed go where the finger touches; no words, no texto", () => {
    const commits: Lineup[] = [];
    const { container } = render(<Harness initial={L7()} onCommit={(l) => commits.push(l)} />);
    go("Dibujar");
    fireEvent.click(toolBtn("Texto"));
    const input = screen.getByRole("textbox", { name: "Texto para el campo" });
    expect(input).toHaveValue("¡PRESIÓN!");
    expect(input).toHaveAttribute("maxLength", "40");
    fireEvent.change(input, { target: { value: "AL HUECO" } });
    swipe(frame(container), [at("tv", 50, 30)]);
    expect(commits.at(-1)?.drawings[0]).toMatchObject({ kind: "texto", text: "AL HUECO" });
    expect(container.querySelector(".itx")?.textContent).toBe("AL HUECO");
    fireEvent.change(input, { target: { value: "  " } });
    swipe(frame(container), [at("tv", 40, 30)]);
    expect(commits).toHaveLength(1);
    expect(screen.getByText("Escribe el texto antes de tocar el césped")).toBeInTheDocument();
  });

  it("a tap marks a stroke; Borrar trazo (or Suprimir) deletes it, with Deshacer in the toast", () => {
    const commits: Lineup[] = [];
    const L = { ...L7(), drawings: [{ id: "k1", kind: "pase" as const, color: "gold" as const, points: [{ x: 20, y: 80 }, { x: 20, y: 20 }] }, stroke("k2", "carrera")] };
    const { container } = render(<Harness initial={L} onCommit={(l) => commits.push(l)} />);
    go("Dibujar");
    // a tap that misses everything marks nothing
    swipe(frame(container), [at("tv", 80, 50)]);
    expect(screen.queryByRole("button", { name: /Borrar el trazo marcado/ })).toBeNull();
    swipe(frame(container), [at("tv", 20.5, 50)]);
    expect(container.querySelector(".ink g.sel")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Borrar el trazo marcado: Pase · oro" }));
    expect(commits.at(-1)?.drawings.map((s) => s.id)).toEqual(["k2"]);
    expect(screen.getByText("Trazo borrado")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Deshacer: recuperar el trazo" }));
    expect(commits.at(-1)?.drawings.map((s) => s.id)).toEqual(["k1", "k2"]);
    // the keyboard: Suprimir deletes the marked one, Escape lets go of it
    swipe(frame(container), [at("tv", 20.5, 50)]);
    fireEvent.keyDown(root(container), { key: "Escape" });
    expect(container.querySelector(".ink g.sel")).toBeNull();
    swipe(frame(container), [at("tv", 20.5, 50)]);
    fireEvent.keyDown(root(container), { key: "Delete" });
    expect(commits.at(-1)?.drawings.map((s) => s.id)).toEqual(["k2"]);
    // and one by one from the list
    fireEvent.click(screen.getByRole("button", { name: "Borrar el trazo 1: Carrera · cielo" }));
    expect(commits.at(-1)?.drawings).toEqual([]);
  });

  it("undo: its own stack; then the last stroke of a board that came with strokes", () => {
    const commits: Lineup[] = [];
    const { container } = render(<Harness initial={{ ...L7(), drawings: [stroke("old")] }} onCommit={(l) => commits.push(l)} />);
    go("Dibujar");
    swipe(frame(container), line("tv", [20, 80], [50, 40]));
    swipe(frame(container), line("tv", [60, 80], [70, 40]));
    expect(commits.at(-1)?.drawings).toHaveLength(3);
    const undo = screen.getByRole("button", { name: "Deshacer el último trazo" });
    fireEvent.click(undo);
    expect(commits.at(-1)?.drawings).toHaveLength(2);
    // Ctrl+Z in Dibujar undoes strokes too (the lineup's undo is the app bar's)
    swipe(frame(container), line("tv", [60, 80], [70, 40]));
    fireEvent.keyDown(root(container), { key: "z", ctrlKey: true });
    expect(commits.at(-1)?.drawings).toHaveLength(2);
    fireEvent.click(undo);
    expect(commits.at(-1)?.drawings.map((s) => s.id)).toEqual(["old"]);
    fireEvent.click(undo);
    expect(commits.at(-1)?.drawings).toEqual([]);
    expect(undo).toBeDisabled();
  });

  it("borrar todo asks once more; the césped is clean and Deshacer brings it all back", () => {
    const commits: Lineup[] = [];
    render(<Harness initial={{ ...L7(), drawings: [stroke("a"), stroke("b")] }} onCommit={(l) => commits.push(l)} />);
    go("Dibujar");
    fireEvent.click(screen.getByRole("button", { name: "Borrar todos los trazos" }));
    const ask = screen.getByRole("group", { name: "¿Borrar todos los trazos?" });
    fireEvent.click(within(ask).getByRole("button", { name: "Cancelar" }));
    expect(commits).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Borrar todos los trazos" }));
    fireEvent.click(within(screen.getByRole("group", { name: "¿Borrar todos los trazos?" })).getByRole("button", { name: "Borrar todo" }));
    expect(commits.at(-1)?.drawings).toEqual([]);
    expect(screen.getByText("Césped limpio")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Deshacer: recuperar los trazos" }));
    expect(commits.at(-1)?.drawings.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("at 60 strokes it says so instead of drawing (a tap still marks one)", () => {
    const commits: Lineup[] = [];
    const full = Array.from({ length: 60 }, (_, i) => ({ ...stroke("s" + i), points: [{ x: 50, y: 50 }, { x: 52, y: 52 + (i % 40) }] }));
    const { container } = render(<Harness initial={{ ...L7(), drawings: full }} onCommit={(l) => commits.push(l)} />);
    go("Dibujar");
    swipe(frame(container), line("tv", [10, 90], [30, 70]));
    expect(commits).toHaveLength(0);
    expect(screen.getByText("Ya hay 60 trazos: borra alguno para dibujar más")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /En el césped · 60 de 60/ })).toBeInTheDocument();
  });

  it("a stroke too short, or a zona without a diagonal, is not one", () => {
    const commits: Lineup[] = [];
    const { container } = render(<Harness initial={L7()} onCommit={(l) => commits.push(l)} />);
    go("Dibujar");
    swipe(frame(container), [at("tv", 50, 50), at("tv", 50.4, 50.6), at("tv", 50.8, 51)]);
    expect(screen.getByText("Trazo muy corto: arrastra un poco más")).toBeInTheDocument();
    fireEvent.click(toolBtn("Zona"));
    swipe(frame(container), line("tv", [20, 50], [60, 50.4]));
    expect(screen.getByText("Arrastra en diagonal para marcar la zona")).toBeInTheDocument();
    expect(commits).toHaveLength(0);
  });

  it("drawing never moves a cromo: a finger on one draws over it", () => {
    const commits: Lineup[] = [];
    const { container } = render(<Harness initial={L7()} onCommit={(l) => commits.push(l)} />);
    go("Dibujar");
    const cc = container.querySelector('.cd[data-tok="adrian"] .cc') as HTMLElement;
    expect(cc).toHaveAttribute("tabindex", "-1");
    swipe(cc, line("tv", [50, 24], [70, 10]));
    expect(commits.at(-1)?.slots.map((s) => s.playerId)).toEqual(SEVEN);
    expect(commits.at(-1)?.drawings).toHaveLength(1);
    // the click that ends the stroke is not a tap on the cromo
    fireEvent.click(cc);
    expect(screen.queryByText(/ADRIAN en la mano/)).toBeNull();
  });

  it("read-only: the strokes are there, the tools are not", () => {
    const commits: Lineup[] = [];
    const { container } = render(<Harness initial={{ ...L7(), drawings: [stroke("a"), stroke("b", "zona")] }} ro onCommit={(l) => commits.push(l)} />);
    go("Dibujar");
    expect(screen.queryByRole("group", { name: "Herramienta de dibujo" })).toBeNull();
    expect(screen.getByText(/Solo lectura: los trazos se ven/)).toBeInTheDocument();
    expect(container.querySelectorAll(".ink g")).toHaveLength(3);
    expect(screen.queryByRole("button", { name: /Borrar el trazo/ })).toBeNull();
    swipe(frame(container), line("tv", [20, 80], [50, 40]));
    expect(commits).toHaveLength(0);
    expect(screen.getByText("Oficial: solo lectura. Duplícalo para editar")).toBeInTheDocument();
  });

  it("the strokes stay on the board while the lineup is undone", () => {
    const commits: Lineup[] = [];
    const { container } = render(<Harness initial={L7()} onCommit={(l) => commits.push(l)} />);
    fireEvent.click(screen.getByRole("button", { name: "Sistema siguiente" }));
    go("Dibujar");
    swipe(frame(container), line("tv", [20, 80], [50, 40]));
    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(commits.at(-1)?.formation).toBe("2-3-1");
    expect(commits.at(-1)?.drawings).toHaveLength(1);
    // and they show on the board (plus the live stroke's layer), not over a jugada
    go("Siete");
    expect(container.querySelectorAll(".ink g")).toHaveLength(2);
    go("Jugadas");
    expect(container.querySelectorAll(".ink g")).toHaveLength(1);
  });
});

describe("Jugadas · la repetición", () => {
  it("opens paused on the córner with the crest wipe; it plays paso by paso and goes round again", () => {
    vi.useFakeTimers();
    const { container } = render(<Harness initial={L7()} />);
    go("Jugadas");
    expect(bug()).toHaveAccessibleName("Repetición: Córner a favor, paso 1 de 4, Colocación. Abrir la biblioteca");
    expect(within(bug()).getByText("REPETICIÓN · CÓRNER · 1/4")).toBeInTheDocument();
    expect(container.querySelector(".wipe")).not.toBeNull();
    expect(container.querySelectorAll(".cd.mini")).toHaveLength(7);
    expect(container.querySelectorAll(".rv")).toHaveLength(5);
    expect(container.querySelector(".ball")).not.toBeNull();
    expect(container.querySelector(".sysp")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reproducir la repetición" }));
    // the 2D camera follows the ball (no 3D on this device)
    expect(root(container)).toHaveClass("fcam");
    expect(within(bug()).getByText("REPETICIÓN · CÓRNER · 1/4 · CÁMARA TV")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2300);
    });
    expect(bug()).toHaveAccessibleName(/paso 2 de 4, Bloqueo y desmarque/);
    // the cromos glide to the paso; the calco and the estelas of the paso before
    expect(container.querySelector(".cd.slow")).not.toBeNull();
    expect(container.querySelectorAll(".gh")).toHaveLength(7);
    expect(container.querySelector(".ink .tr")).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(2300);
    });
    act(() => {
      vi.advanceTimersByTime(2300);
    });
    expect(bug()).toHaveAccessibleName(/paso 4 de 4/);
    act(() => {
      vi.advanceTimersByTime(2600);
    });
    expect(bug()).toHaveAccessibleName(/paso 1 de 4/);
    expect(container.querySelector(".wipe")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Pausar la repetición" }));
    expect(root(container)).not.toHaveClass("fcam");
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(bug()).toHaveAccessibleName(/paso 1 de 4/);
  });

  it("paso by paso by hand: the arrows, the timeline with its ticks, the keyboard", () => {
    const { container } = render(<Harness initial={L7()} />);
    go("Jugadas");
    const tp = screen.getByRole("group", { name: "Repetición de la jugada" });
    fireEvent.click(within(tp).getByRole("button", { name: "Paso siguiente" }));
    expect(bug()).toHaveAccessibleName(/paso 2 de 4/);
    expect(within(tp).getByText("2/4")).toBeInTheDocument();
    expect(Array.from(tp.querySelectorAll(".tl li")).map((li) => li.className)).toEqual(["done", "cur", "", ""]);
    fireEvent.change(within(tp).getByRole("slider", { name: "Paso de la jugada" }), { target: { value: "3" } });
    expect(bug()).toHaveAccessibleName(/paso 4 de 4, Remate/);
    fireEvent.click(within(tp).getByRole("button", { name: "Paso anterior" }));
    expect(bug()).toHaveAccessibleName(/paso 3 de 4/);
    // keys anywhere on the page: ← →, and Space plays / pauses (not while typing)
    fireEvent.keyDown(document.body, { key: "ArrowLeft" });
    expect(bug()).toHaveAccessibleName(/paso 2 de 4/);
    fireEvent.keyDown(document.body, { key: " " });
    expect(screen.getByRole("button", { name: "Pausar la repetición" })).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: " " });
    expect(screen.getByRole("button", { name: "Reproducir la repetición" })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Título del paso 2" }), { key: "ArrowRight" });
    expect(bug()).toHaveAccessibleName(/paso 2 de 4/);
    // the bug opens the library
    fireEvent.click(bug());
    expect(root(container)).toHaveAttribute("data-snap", "half");
  });

  it("0,5× holds every paso longer; Calco, Estelas, Rivales and Balón come and go", () => {
    vi.useFakeTimers();
    const { container } = render(<Harness initial={L7()} props={{ prefs: { ...PREFS0, v3: false } }} />);
    go("Jugadas");
    fireEvent.click(screen.getByRole("button", { name: "0,5×" }));
    expect(root(container)).toHaveClass("slow2");
    fireEvent.click(screen.getByRole("button", { name: "Reproducir la repetición" }));
    // without «En 3D» the camera stays wide
    expect(root(container)).not.toHaveClass("fcam");
    expect(within(bug()).getByText("REPETICIÓN · CÓRNER · 1/4")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2300);
    });
    expect(bug()).toHaveAccessibleName(/paso 1 de 4/);
    act(() => {
      vi.advanceTimersByTime(2100);
    });
    expect(bug()).toHaveAccessibleName(/paso 2 de 4/);
    fireEvent.click(screen.getByRole("button", { name: "Pausar la repetición" }));
    fireEvent.click(screen.getByRole("button", { name: "Calco" }));
    expect(container.querySelectorAll(".gh")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Estelas" }));
    expect(root(container)).toHaveClass("no-trails");
    fireEvent.click(screen.getByRole("button", { name: "Rivales" }));
    expect(container.querySelectorAll(".rv")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Balón" }));
    expect(container.querySelector(".ball")).toBeNull();
  });

  it("pauses while the tab is hidden and goes on when it is back", () => {
    vi.useFakeTimers();
    render(<Harness initial={L7()} />);
    go("Jugadas");
    fireEvent.click(screen.getByRole("button", { name: "Reproducir la repetición" }));
    act(() => {
      Object.defineProperty(document, "hidden", { value: true, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(screen.getByRole("button", { name: "Reproducir la repetición" })).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(bug()).toHaveAccessibleName(/paso 1 de 4/);
    act(() => {
      Object.defineProperty(document, "hidden", { value: false, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    act(() => {
      vi.advanceTimersByTime(2300);
    });
    expect(bug()).toHaveAccessibleName(/paso 2 de 4/);
  });

  it("reduced motion: the pasos change without gliding and without the wipe", () => {
    vi.useFakeTimers();
    window.matchMedia = vi.fn((q: string) => ({ matches: q.includes("reduce"), media: q, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false }));
    const { container } = render(<Harness initial={L7()} />);
    go("Jugadas");
    expect(container.querySelector(".wipe")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reproducir la repetición" }));
    act(() => {
      vi.advanceTimersByTime(2300);
    });
    expect(bug()).toHaveAccessibleName(/paso 2 de 4/);
    expect(container.querySelector(".cd.slow")).toBeNull();
    expect(container.querySelector(".ink .tr.st")).not.toBeNull();
  });

  it("the library: another jugada starts paused at its first paso; a link to #jugadas plays at once", () => {
    vi.useFakeTimers();
    window.history.replaceState(null, "", "/pizarra#jugadas");
    render(<Harness initial={L7()} props={{ prefs: { ...PREFS0, v3: false } }} />);
    expect(screen.getByRole("button", { name: "Pausar la repetición" })).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2300);
    });
    expect(bug()).toHaveAccessibleName(/paso 2 de 4/);
    const lib = screen.getByRole("group", { name: "Biblioteca de jugadas" });
    expect(within(lib).getAllByRole("button").map((b) => b.textContent)).toEqual(["Córner", "Falta", "Banda", "Salida"]);
    fireEvent.click(within(lib).getByRole("button", { name: "Falta frontal (estrategia)" }));
    expect(bug()).toHaveAccessibleName("Repetición: Falta frontal, paso 1 de 3, Barrera. Abrir la biblioteca");
    expect(screen.getByRole("button", { name: "Reproducir la repetición" })).toBeInTheDocument();
    expect(within(lib).getByRole("button", { name: "Falta frontal (estrategia)" })).toHaveAttribute("aria-pressed", "true");
  });

  it("#dibujar opens the telestrator", () => {
    window.history.replaceState(null, "", "/pizarra#dibujar");
    render(<Harness initial={L7()} />);
    expect(screen.getByRole("group", { name: "Herramienta de dibujo" })).toBeInTheDocument();
  });
});

describe("Jugadas · el editor", () => {
  const ownJugada = (commits: Lineup[]) => {
    fireEvent.click(screen.getByRole("button", { name: "Nueva jugada propia" }));
    return commits.at(-1)?.plays[0] as Play;
  };

  it("a new jugada from where the seven stand: pasos added, copied, moved and removed (2 to 8)", () => {
    const commits: Lineup[] = [];
    render(<Harness initial={L7()} onCommit={(l) => commits.push(l)} />);
    go("Jugadas");
    const p = ownJugada(commits);
    expect(p).toMatchObject({ name: "Tu jugada 1", kind: "propia" });
    expect(p.frames).toHaveLength(2);
    expect(screen.getByText("Jugada nueva: añade pasos y arrastra")).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Biblioteca de jugadas" })).getByRole("button", { name: "Tu jugada 1 (propia)" })).toHaveAttribute("aria-pressed", "true");
    // the lineup's undo is not touched
    expect(screen.getByRole("button", { name: "Deshacer" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Paso" }));
    expect(commits.at(-1)?.plays[0].frames).toHaveLength(3);
    expect(commits.at(-1)?.plays[0].frames[2].title).toBe("Paso nuevo");
    expect(bug()).toHaveAccessibleName(/paso 3 de 3, Paso nuevo/);
    expect(screen.getByText("Paso 3 añadido: mueve los cromos")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Duplicar el paso 1" }));
    expect(commits.at(-1)?.plays[0].frames.map((f) => f.title)).toEqual(["Salida", "Salida", undefined, "Paso nuevo"]);
    fireEvent.click(screen.getByRole("button", { name: "Bajar el paso 1" }));
    expect(commits.at(-1)?.plays[0].frames.map((f) => f.title ?? "")).toEqual(["Salida", "Salida", "", "Paso nuevo"]);
    fireEvent.click(screen.getByRole("button", { name: "Subir el paso 4" }));
    expect(commits.at(-1)?.plays[0].frames.map((f) => f.title ?? "")).toEqual(["Salida", "Salida", "Paso nuevo", ""]);
    // removing one says so and can be undone
    fireEvent.click(screen.getByRole("button", { name: "Quitar el paso 3" }));
    expect(commits.at(-1)?.plays[0].frames).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Deshacer: recuperar el paso 3" }));
    expect(commits.at(-1)?.plays[0].frames).toHaveLength(4);
    // up to eight…
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole("button", { name: "Paso" }));
    expect(commits.at(-1)?.plays[0].frames).toHaveLength(8);
    fireEvent.click(screen.getByRole("button", { name: "Paso" }));
    expect(commits.at(-1)?.plays[0].frames).toHaveLength(8);
    expect(screen.getByText("Una jugada tiene entre 2 y 8 pasos.", { selector: ".tst span" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Duplicar el paso 1" })).toBeDisabled();
    // …and down to two
    for (let i = 8; i > 2; i--) fireEvent.click(screen.getByRole("button", { name: "Quitar el paso 1" }));
    expect(commits.at(-1)?.plays[0].frames).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Quitar el paso 1" })).toBeDisabled();
  });

  it("the paso's title and note, the name (checked), duplicate and delete (asked once more)", () => {
    const commits: Lineup[] = [];
    render(<Harness initial={L7()} onCommit={(l) => commits.push(l)} />);
    go("Jugadas");
    ownJugada(commits);
    const title = screen.getByRole("textbox", { name: "Título del paso 1" });
    fireEvent.change(title, { target: { value: "Robo  " } });
    fireEvent.keyDown(title, { key: "Enter" });
    expect(commits.at(-1)?.plays[0].frames[0].title).toBe("Robo");
    const note = screen.getByRole("textbox", { name: "Nota del paso" });
    fireEvent.change(note, { target: { value: "Salimos rápido por la banda." } });
    fireEvent.blur(note);
    expect(commits.at(-1)?.plays[0].frames[0].note).toBe("Salimos rápido por la banda.");
    const name = screen.getByRole("textbox", { name: "Nombre de la jugada" });
    const n0 = commits.length;
    fireEvent.change(name, { target: { value: "   " } });
    expect(screen.getByRole("alert")).toHaveTextContent("El nombre lleva entre 1 y 40 caracteres.");
    fireEvent.blur(name);
    expect(commits).toHaveLength(n0);
    fireEvent.change(name, { target: { value: "Contra rápida" } });
    fireEvent.blur(name);
    expect(commits.at(-1)?.plays[0].name).toBe("Contra rápida");
    fireEvent.click(screen.getByRole("button", { name: "Duplicar" }));
    expect(commits.at(-1)?.plays.map((p) => p.name)).toEqual(["Contra rápida", "Contra rápida (copia)"]);
    expect(bug()).toHaveAccessibleName(/^Repetición: Contra rápida \(copia\)/);
    fireEvent.click(screen.getByRole("button", { name: "Borrar" }));
    const ask = screen.getByRole("group", { name: "¿Borrar Contra rápida (copia)?" });
    fireEvent.click(within(ask).getByRole("button", { name: "Borrar" }));
    expect(commits.at(-1)?.plays.map((p) => p.name)).toEqual(["Contra rápida"]);
    expect(bug()).toHaveAccessibleName(/^Repetición: Córner a favor/);
    fireEvent.click(screen.getByRole("button", { name: "Deshacer el borrado de «Contra rápida (copia)»" }));
    expect(commits.at(-1)?.plays).toHaveLength(2);
    expect(bug()).toHaveAccessibleName(/^Repetición: Contra rápida \(copia\)/);
  });

  it("drag our cromos, the ball and the rivals in the paso; mark a rival to take it out, add one", () => {
    const commits: Lineup[] = [];
    const { container } = render(<Harness initial={L7()} onCommit={(l) => commits.push(l)} />);
    go("Jugadas");
    ownJugada(commits);
    fireEvent.click(screen.getByRole("button", { name: "Paso siguiente" }));
    // our forward to the edge of the box (held by his feet, like on the board)
    const adrian = container.querySelector('[data-piece="p:adrian"] .cc') as HTMLElement;
    const to = at("tv", 70, 20);
    swipe(adrian, [at("tv", 50, 24), at("tv", 60, 22), to]);
    const want = framePointToPitch(CAMS.tv, (to.clientX / W) * 100, (to.clientY / (W * CAMS.tv.Fh)) * 100 + 4);
    let p = commits.at(-1)?.plays[0] as Play;
    expect(p.frames[1].players.adrian).toEqual(want);
    expect(p.frames[0].players.adrian.y).not.toBe(want.y);
    // the arrows of the move follow
    expect(p.frames[0].arrows.some((a) => a.kind === "carrera")).toBe(true);
    // the ball
    swipe(container.querySelector('[data-piece="b"]') as HTMLElement, [at("tv", 50, 88), at("tv", 40, 60), at("tv", 30, 40)]);
    p = commits.at(-1)?.plays[0] as Play;
    expect(p.frames[1].ball.x).toBeCloseTo(30, 0);
    expect(p.frames[1].ball.y).toBeCloseTo(40, 0);
    // let go off the pitch: nothing changes
    const n0 = commits.length;
    swipe(container.querySelector('[data-piece="r:r2"]') as HTMLElement, [at("tv", 36, 40), { clientX: -300, clientY: -300 }]);
    expect(commits).toHaveLength(n0);
    // a rival: tap marks it, «Quitar el rival marcado» takes it out of every paso
    swipe(container.querySelector('[data-piece="r:r2"]') as HTMLElement, [at("tv", 36, 40)]);
    expect(container.querySelector(".rv.sel")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Quitar el rival marcado" }));
    p = commits.at(-1)?.plays[0] as Play;
    expect(p.frames.map((f) => f.rivals.map((r) => r.id))).toEqual([
      ["r1", "r3", "r4", "r5"],
      ["r1", "r3", "r4", "r5"],
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Rival" }));
    p = commits.at(-1)?.plays[0] as Play;
    expect(p.frames[0].rivals).toHaveLength(5);
    expect(screen.getByRole("heading", { name: "Rivales · 5 de 7" })).toBeInTheDocument();
  });

  it("a built-in jugada becomes yours on your first change (and the paso stays on screen)", () => {
    const commits: Lineup[] = [];
    const { container } = render(<Harness initial={L7()} onCommit={(l) => commits.push(l)} />);
    go("Jugadas");
    fireEvent.click(screen.getByRole("button", { name: "Paso siguiente" }));
    swipe(container.querySelector('[data-piece="b"]') as HTMLElement, [at("tv", 94, 4), at("tv", 80, 10), at("tv", 70, 12)]);
    const p = commits.at(-1)?.plays[0] as Play;
    expect(p).toMatchObject({ name: "Córner a favor (tuya)", kind: "corner" });
    expect(p.id).not.toBe("lib-corner");
    expect(p.frames).toHaveLength(4);
    expect(p.frames[1].ball.x).toBeCloseTo(70, 0);
    expect(screen.getByText("«Córner a favor» ya es tuya: se guarda con el tablero")).toBeInTheDocument();
    expect(bug()).toHaveAccessibleName(/^Repetición: Córner a favor \(tuya\), paso 2 de 4/);
    // the library keeps the original
    const lib = screen.getByRole("group", { name: "Biblioteca de jugadas" });
    expect(within(lib).getAllByRole("button").map((b) => b.textContent)).toEqual(["Córner", "Falta", "Banda", "Salida", "Córner a favor (tuya)"]);
  });

  it("twelve of your own at most: it says so instead", () => {
    const commits: Lineup[] = [];
    const base = libraryPlays(L7())[1];
    const plays = Array.from({ length: 12 }, (_, i) => ({ ...base, id: "j" + i, kind: "propia" as const, name: "J" + i }));
    const { container } = render(<Harness initial={{ ...L7(), plays }} onCommit={(l) => commits.push(l)} />);
    go("Jugadas");
    fireEvent.click(screen.getByRole("button", { name: "Nueva jugada propia" }));
    expect(screen.getByText("Ya hay 12 jugadas propias en este tablero: borra una para guardar otra.")).toBeInTheDocument();
    swipe(container.querySelector('[data-piece="b"]') as HTMLElement, [at("tv", 94, 4), at("tv", 80, 10), at("tv", 70, 12)]);
    expect(commits).toHaveLength(0);
  });

  it("those of the seven a jugada leaves out can join it", () => {
    const commits: Lineup[] = [];
    const L5 = lineupOf(["evans", "illescas", "tello", "huberoski", "eguzquiza"], "2-3-1", sq);
    const mine: Play = { id: "j1", name: "Cinco", kind: "propia", frames: [0, 1].map(() => ({ players: { evans: { x: 50, y: 92 }, illescas: { x: 30, y: 73 } }, ball: { x: 50, y: 88 }, rivals: [], arrows: [] })) };
    render(<Harness initial={{ ...L5, slots: L7().slots, plays: [mine] }} onCommit={(l) => commits.push(l)} />);
    go("Jugadas");
    fireEvent.click(within(screen.getByRole("group", { name: "Biblioteca de jugadas" })).getByRole("button", { name: "Cinco (propia)" }));
    fireEvent.click(screen.getByRole("button", { name: "Añadir a los 5 que faltan" }));
    expect(Object.keys(commits.at(-1)?.plays[0].frames[1].players ?? {})).toHaveLength(7);
    expect(screen.queryByRole("button", { name: /que faltan|que falta/ })).toBeNull();
  });

  it("whoever left the seven can leave the jugada too (to make room)", () => {
    const commits: Lineup[] = [];
    const seven = Object.fromEntries(["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "kevin"].map((id, i) => [id, { x: 10 + i * 10, y: 50 }]));
    const mine: Play = { id: "j1", name: "Con Kevin", kind: "propia", frames: [0, 1].map(() => ({ players: { ...seven }, ball: { x: 50, y: 88 }, rivals: [], arrows: [] })) };
    render(<Harness initial={{ ...L7(), plays: [mine] }} onCommit={(l) => commits.push(l)} />);
    go("Jugadas");
    fireEvent.click(within(screen.getByRole("group", { name: "Biblioteca de jugadas" })).getByRole("button", { name: "Con Kevin (propia)" }));
    // a full paso: no room for adrian until kevin goes
    expect(screen.queryByRole("button", { name: /que falta/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Quitar al que ya no está" }));
    expect(commits.at(-1)?.plays[0].frames.every((f) => !("kevin" in f.players))).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Añadir al que falta" }));
    expect(commits.at(-1)?.plays[0].frames[0].players.adrian).toBeDefined();
  });

  it("read-only: the jugadas play, nothing is retouched", () => {
    const { container } = render(<Harness initial={L7()} ro />);
    go("Jugadas");
    expect(screen.queryByRole("button", { name: "Nueva jugada propia" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Paso" })).toBeNull();
    expect(screen.getByText(/Solo lectura: la jugada se ve/)).toBeInTheDocument();
    expect(container.querySelector("[data-piece]")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Paso siguiente" }));
    expect(bug()).toHaveAccessibleName(/paso 2 de 4/);
  });
});

describe("Jugadas · en 3D", () => {
  const handle = () => {
    const ctl: PlayController = { pause: vi.fn(), resume: vi.fn(), seek: vi.fn(), stop: vi.fn(), done: Promise.resolve() };
    const h = {
      isReady: () => true,
      setPlayers: vi.fn(),
      setRivals: vi.fn(),
      setBall: vi.fn(),
      setCamera: vi.fn(async () => {}),
      setBoard: vi.fn(),
      setTheme: vi.fn(),
      intro: vi.fn(async () => {}),
      reveal: vi.fn(async () => {}),
      play: vi.fn((_f: unknown, _o?: PlayOptions): PlayController | null => ctl),
      pick: vi.fn(() => null),
      project: vi.fn(() => null),
      pause: vi.fn(),
      resume: vi.fn(),
      info: vi.fn(() => null),
    };
    s3.handle = h;
    return { h, ctl };
  };

  it("where the device can: the jugada plays in the stadium under the HUD; pausing goes back to 2D", async () => {
    sup.reason = null;
    const { h, ctl } = handle();
    const { container } = render(<Harness initial={L7()} />);
    go("Jugadas");
    expect(s3.mounts).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "Reproducir la repetición" }));
    await waitFor(() => expect(root(container)).toHaveClass("v3"));
    expect(container.querySelector(".p3d [data-testid=stadium3d]")).not.toBeNull();
    expect(h.play).toHaveBeenCalledWith(toEngineFrames(corner()), expect.objectContaining({ loop: true, speed: 1 }));
    expect(within(bug()).getByText("REPETICIÓN · CÓRNER · 1/4 · 3D")).toBeInTheDocument();
    expect(root(container)).not.toHaveClass("fcam");
    // the engine says where it is
    const opts = h.play.mock.calls[0][1];
    act(() => opts?.onFrame?.(2));
    expect(bug()).toHaveAccessibleName(/paso 3 de 4/);
    // 0,5×: it plays again, slower
    fireEvent.click(screen.getByRole("button", { name: "0,5×" }));
    expect(ctl.stop).toHaveBeenCalledTimes(1);
    expect(h.play).toHaveBeenLastCalledWith(toEngineFrames(corner()), expect.objectContaining({ speed: 0.5 }));
    expect(ctl.seek).toHaveBeenLastCalledWith(2 / 3);
    fireEvent.click(screen.getByRole("button", { name: "Pausar la repetición" }));
    expect(ctl.stop).toHaveBeenCalledTimes(2);
    expect(root(container)).not.toHaveClass("v3");
    expect(bug()).toHaveAccessibleName(/paso 3 de 4/);
    // leaving the jugadas lets the stadium go
    go("Siete");
    expect(container.querySelector("[data-testid=stadium3d]")).toBeNull();
    expect(s3.unmounts).toBe(1);
  });

  it("under automation (or without WebGL2) it never starts: 2D with the TV camera and a short note", () => {
    sup.reason = "webdriver";
    const { container } = render(<Harness initial={L7()} />);
    go("Jugadas");
    fireEvent.click(screen.getByRole("button", { name: "Reproducir la repetición" }));
    expect(container.querySelector("[data-testid=stadium3d]")).toBeNull();
    expect(s3.mounts).toBe(0);
    expect(root(container)).toHaveClass("fcam");
    expect(root(container)).not.toHaveClass("v3");
    expect(screen.getByText("Este dispositivo no muestra el estadio 3D: la jugada se ve con la cámara 2D que sigue al balón.")).toBeInTheDocument();
  });

  it("if the stadium fails it stays 2D and says so", async () => {
    sup.reason = null;
    s3.mode = "error";
    handle();
    const { container } = render(<Harness initial={L7()} />);
    go("Jugadas");
    fireEvent.click(screen.getByRole("button", { name: "Reproducir la repetición" }));
    await screen.findByText("El 3D no ha podido arrancar: seguimos en 2D");
    expect(container.querySelector("[data-testid=stadium3d]")).toBeNull();
    expect(root(container)).not.toHaveClass("v3");
    expect(root(container)).toHaveClass("fcam");
    expect(screen.getByText("El estadio 3D no ha podido arrancar: la jugada se ve con la cámara 2D que sigue al balón.")).toBeInTheDocument();
  });

  it("«En 3D» off: plain 2D, the stadium is not even loaded; on again, it tells what this device does", () => {
    sup.reason = "reduced-motion";
    const { container } = render(<WithPrefs initial={L7()} />);
    go("Jugadas");
    const k3 = screen.getByRole("button", { name: "En 3D" });
    expect(k3).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(k3);
    expect(screen.getByText("Vista 2D")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "En 3D" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: "Reproducir la repetición" }));
    expect(root(container)).not.toHaveClass("fcam");
    expect(within(bug()).getByText("REPETICIÓN · CÓRNER · 1/4")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "En 3D" }));
    expect(screen.getByText("Sin 3D aquí: cámara de televisión que sigue al balón")).toBeInTheDocument();
    expect(root(container)).toHaveClass("fcam");
    expect(s3.mounts).toBe(0);
  });
});
