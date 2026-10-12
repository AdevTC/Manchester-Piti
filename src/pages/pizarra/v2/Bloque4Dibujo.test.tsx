import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Lineup } from "../formations";
import type { Stroke } from "../drawings";
import { newPlay, type Play } from "../plays";
import { boardDoc, demoSquad, lineupOf } from "./testkit";
import { BoardHarness as Harness } from "./testkitBoard";
import { PREFS0 } from "./prefs";
import { boardSpots } from "./jugadas";
import { CLIP_NO_RECORDER, type Clock, type RecorderLike } from "./clip";
import { ClipExport, type ClipEnv } from "./ClipExport";
import type { CalMatch } from "./boards";

// Bloque 4 · B as a user drives it: Unir / Foco / Medir / Fuera de juego in Dibujar (undoable), the
// drawing turned into a jugada, the replay's speed and the bent runs, the video (supported or not), the
// QR and «Clonar este tablero», the rival in Plan and Tableros by rival.

vi.mock("../../../components/pitch3d/support", () => ({ unsupportedReason: () => "webdriver", supported: () => false }));
vi.mock("./cartel", async (orig) => {
  const real = await orig<typeof import("./cartel")>();
  return { ...real, crestImage: async () => null, cartelBlob: vi.fn(async () => new Blob(["png"], { type: "image/png" })) };
});

const sq = demoSquad();
const SEVEN = ["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "adrian"];
const L7 = (): Lineup => lineupOf(SEVEN, "2-3-1", sq);
const nav = () => screen.getByRole("navigation", { name: "Herramientas de la pizarra" });
const go = (name: string) => fireEvent.click(within(nav()).getByRole("button", { name: new RegExp("^(nuevo)?" + name + "$") }));
const root = (c: HTMLElement) => c.querySelector(".pzv") as HTMLElement;
const P0 = { prefs: { ...PREFS0, v3: false } };

beforeEach(() => {
  window.history.replaceState(null, "", "/pizarra");
});
afterEach(() => {
  vi.useRealTimers();
});

describe("Dibujar · pegado a los jugadores", () => {
  const chip = (name: RegExp) => within(screen.getByRole("group", { name: /^Jugadores para/ })).getByRole("button", { name });

  it("«Unir» two players by keyboard: a line that is theirs, undone and redone like any stroke", () => {
    const commits: Lineup[] = [];
    const { container } = render(<Harness initial={L7()} props={P0} onCommit={(l) => commits.push(l)} />);
    go("Dibujar");
    fireEvent.click(screen.getByRole("button", { name: "Unir" }));
    expect(screen.getByRole("button", { name: "Unir" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(chip(/ILLESCAS$/));
    fireEvent.click(chip(/TELLO$/));
    expect(chip(/ILLESCAS$/)).toHaveAttribute("aria-pressed", "true");
    expect(container.querySelectorAll(".dr-pk-r")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Unir a los 2" }));
    const st = commits.at(-1)?.drawings.at(-1);
    expect(st).toMatchObject({ kind: "unir", anchors: ["illescas", "tello"], color: "gold" });
    expect(container.querySelectorAll(".dr-svg .dr-unir")).toHaveLength(1);
    expect(container.querySelectorAll(".dr-pk-r")).toHaveLength(0);
    expect(screen.getByRole("button", { name: /^Unir ILLESCAS, TELLO · oro/ })).toBeInTheDocument();
    // Ctrl Z takes it off; Ctrl ⇧ Z brings it back
    fireEvent.keyDown(document.body, { key: "z", ctrlKey: true });
    expect(commits.at(-1)?.drawings).toHaveLength(0);
    fireEvent.keyDown(document.body, { key: "z", ctrlKey: true, shiftKey: true });
    expect(commits.at(-1)?.drawings.at(-1)).toMatchObject({ kind: "unir" });
  });

  it("«Foco» lights one; «Medir» two players says the metres; marked by keyboard it says it stays with them", () => {
    const commits: Lineup[] = [];
    const { container } = render(<Harness initial={L7()} props={P0} onCommit={(l) => commits.push(l)} />);
    go("Dibujar");
    fireEvent.click(screen.getByRole("button", { name: "Foco" }));
    fireEvent.click(chip(/ADRIAN$/));
    expect(commits.at(-1)?.drawings.at(-1)).toMatchObject({ kind: "foco", anchors: ["adrian"] });
    expect(container.querySelectorAll(".dr-foco")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Medir" }));
    fireEvent.click(chip(/ILLESCAS$/));
    expect(commits.at(-1)?.drawings).toHaveLength(1);
    fireEvent.click(chip(/ADRIAN$/));
    const m = commits.at(-1)?.drawings.at(-1);
    expect(m).toMatchObject({ kind: "medir", anchors: ["illescas", "adrian"] });
    expect(container.querySelector(".dr-lab")?.textContent).toMatch(/^\d+(,\d)? m$/);
    expect(screen.getByText(/ILLESCAS – ADRIAN: \d+(,\d)? m/, { selector: ".tst span" })).toBeInTheDocument();
    // marked from the list: the arrows don't move it (it goes with the players)
    fireEvent.click(screen.getByRole("button", { name: /^Medir \d+(,\d)? m \(ILLESCAS–ADRIAN\)/ }));
    const before = commits.length;
    fireEvent.keyDown(document.body, { key: "ArrowUp" });
    expect(commits).toHaveLength(before);
    expect(container.querySelector(".dr-svg .dr-medir.dr-sel")).not.toBeNull();
  });

  it("«Fuera de juego» puts our line on and off; theirs waits for the rival seven", () => {
    const commits: Lineup[] = [];
    const { container } = render(<Harness initial={L7()} props={P0} onCommit={(l) => commits.push(l)} />);
    go("Dibujar");
    const ours = screen.getByRole("button", { name: "Fuera de juego · nuestra línea" });
    expect(screen.getByRole("button", { name: "Fuera de juego · la suya" })).toBeDisabled();
    fireEvent.click(ours);
    expect(commits.at(-1)?.drawings.at(-1)).toMatchObject({ kind: "fuera", side: "nos" });
    expect(ours).toHaveAttribute("aria-pressed", "true");
    expect(container.querySelector(".dr-lab")?.textContent).toBe("FUERA · NOSOTROS");
    fireEvent.click(ours);
    expect(commits.at(-1)?.drawings).toHaveLength(0);
  });

  it("«Convertir el dibujo en jugada»: the carrera from a cromo becomes a two-paso jugada, on screen", () => {
    const commits: Lineup[] = [];
    const spots = boardSpots(L7());
    const a = spots.adrian;
    const carrera: Stroke = { id: "k1", kind: "carrera", color: "gold", points: [a, { x: a.x + 8, y: a.y - 6 }, { x: a.x + 10, y: a.y - 15 }] };
    const { container } = render(<Harness initial={{ ...L7(), drawings: [carrera] }} props={P0} onCommit={(l) => commits.push(l)} />);
    go("Dibujar");
    fireEvent.click(screen.getByRole("button", { name: "Convertir el dibujo en jugada" }));
    const pl = commits.at(-1)?.plays.at(-1);
    expect(pl?.name).toBe("Del dibujo");
    expect(pl?.frames).toHaveLength(2);
    expect(pl?.frames[1].players.adrian).toEqual({ x: a.x + 10, y: a.y - 15 });
    expect(root(container).getAttribute("data-modo")).toBe("jugadas");
    expect(screen.getByText("«Del dibujo» creada desde el dibujo: dos pasos para retocar", { selector: ".tst span" })).toBeInTheDocument();
  });

  it("with nothing to convert the button says why", () => {
    render(<Harness initial={L7()} props={P0} />);
    go("Dibujar");
    expect(screen.getByRole("button", { name: "Convertir el dibujo en jugada" })).toBeDisabled();
    expect(screen.getByText(/Dibuja una carrera, un pase o una conducción/)).toBeInTheDocument();
  });

  it("a read-only board shows the pinned strokes but no tools", () => {
    const st: Stroke = { id: "f1", kind: "foco", color: "gold", anchors: ["adrian"], points: [{ x: 50, y: 20 }] };
    const { container } = render(<Harness initial={{ ...L7(), drawings: [st] }} ro props={P0} />);
    go("Dibujar");
    expect(container.querySelectorAll(".dr-foco")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Unir" })).toBeNull();
  });
});

describe("Jugadas · velocidad, curvas y vídeo", () => {
  /** An own jugada where ADRIAN runs forward from where he stands. */
  const runPlay = (): Play => {
    const spots = boardSpots(L7());
    const p = newPlay("Desmarque", spots);
    const a = spots.adrian;
    return { ...p, frames: [p.frames[0], { ...p.frames[1], players: { ...p.frames[1].players, adrian: { x: a.x, y: Math.max(0, a.y - 20) } } }] };
  };

  it("0,5× · 1× · 1,5×: one pressed at a time, and the board plays at it", () => {
    const { container } = render(<Harness initial={L7()} props={P0} />);
    go("Jugadas");
    const speed = screen.getByRole("group", { name: "Velocidad de la repetición" });
    expect(within(speed).getByRole("button", { name: "1×" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(speed).getByRole("button", { name: "1,5×" }));
    expect(root(container)).toHaveClass("dr-fast");
    expect(root(container)).not.toHaveClass("slow2");
    fireEvent.click(within(speed).getByRole("button", { name: "0,5×" }));
    expect(root(container)).toHaveClass("slow2");
    expect(root(container)).not.toHaveClass("dr-fast");
    expect(within(speed).getByRole("button", { name: "1,5×" })).toHaveAttribute("aria-pressed", "false");
  });

  it("each run into the paso has a handle: the arrows bend it (one undo step), saved with the jugada", () => {
    const commits: Lineup[] = [];
    const pl = runPlay();
    const { container } = render(<Harness initial={{ ...L7(), plays: [pl] }} props={P0} onCommit={(l) => commits.push(l)} />);
    go("Jugadas");
    fireEvent.click(screen.getByRole("button", { name: "Desmarque (propia)" }));
    expect(container.querySelectorAll(".dr-ch")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Paso siguiente" }));
    const h = screen.getByRole("button", { name: /^Curva de la carrera de ADRIAN al paso 2, recta/ });
    fireEvent.keyDown(h, { key: "ArrowRight", shiftKey: true });
    const saved = commits.at(-1)?.plays.find((x) => x.id === pl.id);
    expect(saved?.frames[1].curves?.adrian).toBeDefined();
    expect(screen.getByRole("button", { name: /^Curva de la carrera de ADRIAN al paso 2, curvada/ })).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: "z", ctrlKey: true });
    expect(commits.at(-1)?.plays.find((x) => x.id === pl.id)?.frames[1].curves).toBeUndefined();
  });

  it("the video, where this browser can't record it, says why in Spanish; no «próximamente» anywhere", () => {
    render(<Harness initial={L7()} props={P0} />);
    go("Jugadas");
    expect(screen.getByText(CLIP_NO_RECORDER)).toBeInTheDocument();
    expect(screen.queryByText(/próximamente/i)).toBeNull();
    go("Compartir");
    expect(screen.getByText(CLIP_NO_RECORDER)).toBeInTheDocument();
    expect(screen.queryByText(/próximamente/i)).toBeNull();
  });
});

describe("Compartir · QR y clonar", () => {
  it("the board's link as a QR drawn here, and «Clonar este tablero» makes your own copy", async () => {
    const copyBoard = vi.fn(async () => "J8 · MAD SKY (copia)");
    render(<Harness initial={L7()} props={P0} session={{ copyBoard }} />);
    go("Compartir");
    const qr = screen.getByRole("img", { name: "Código QR del enlace al tablero «J8 · MAD SKY»" });
    expect(qr.tagName.toLowerCase()).toBe("svg");
    expect(qr.querySelector("path")?.getAttribute("d")?.length).toBeGreaterThan(100);
    fireEvent.click(screen.getByRole("button", { name: "Clonar este tablero" }));
    expect(copyBoard).toHaveBeenCalledWith(null, true);
    expect(await screen.findByText("Clonado: «J8 · MAD SKY (copia)» es tuyo para editar", { selector: ".tst span" })).toBeInTheDocument();
  });
  it("a board not saved yet: no QR, no clone", () => {
    render(<Harness initial={L7()} props={P0} session={{ id: null }} />);
    go("Compartir");
    expect(screen.queryByRole("img", { name: /Código QR/ })).toBeNull();
    expect(screen.getByText("El QR llega en cuanto el tablero se guarde (con tu primer cambio).")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clonar este tablero" })).toBeDisabled();
  });
});

describe("El rival", () => {
  it("Plan: add their seven (red tokens), a dorsal and a note, their system; «Rival» hides them; taken off with Deshacer", () => {
    const commits: Lineup[] = [];
    const { container } = render(<Harness initial={L7()} props={P0} onCommit={(l) => commits.push(l)} />);
    fireEvent.click(screen.getByRole("button", { name: /^Plan/ }));
    fireEvent.click(screen.getByRole("button", { name: "Añadir el siete rival" }));
    expect(commits.at(-1)?.rival?.players).toHaveLength(7);
    expect(container.querySelectorAll(".dr-rv")).toHaveLength(7);
    const num = screen.getByRole("textbox", { name: "Dorsal de su DC (7 de 7)" });
    fireEvent.change(num, { target: { value: "9a" } });
    fireEvent.blur(num);
    expect(commits.at(-1)?.rival?.players[6]).toEqual({ num: 9 });
    const note = screen.getByRole("textbox", { name: "Nota para el 9 (dc)" });
    fireEvent.change(note, { target: { value: "presionar al 9 por su izquierda" } });
    fireEvent.keyDown(note, { key: "Enter" });
    expect(commits.at(-1)?.rival?.players[6]).toEqual({ num: 9, note: "presionar al 9 por su izquierda" });
    expect(container.querySelector(".dr-rv.dr-noted")?.getAttribute("title")).toBe("Rival: el 9 (dc). presionar al 9 por su izquierda");
    fireEvent.change(screen.getByRole("combobox", { name: "Su sistema" }), { target: { value: "3-2-1" } });
    expect(commits.at(-1)?.rival?.formation).toBe("3-2-1");
    // «Rival» hides the tokens (they are kept)
    fireEvent.click(within(screen.getByRole("region", { name: "El rival" })).getByRole("button", { name: "Rival" }));
    expect(container.querySelectorAll(".dr-rv")).toHaveLength(0);
    // taken off, and back with Deshacer
    fireEvent.click(screen.getByRole("button", { name: "Quitar el rival" }));
    expect(commits.at(-1)?.rival).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Deshacer: recuperar el siete rival" }));
    expect(commits.at(-1)?.rival?.players[6]).toEqual({ num: 9, note: "presionar al 9 por su izquierda" });
  });

  it("in Dibujar too, with their fuera de juego line", () => {
    const commits: Lineup[] = [];
    const { container } = render(<Harness initial={{ ...L7(), rival: { formation: "2-3-1", players: Array.from({ length: 7 }, () => ({})) } }} props={P0} onCommit={(l) => commits.push(l)} />);
    go("Dibujar");
    expect(container.querySelectorAll(".dr-rv")).toHaveLength(7);
    fireEvent.click(screen.getByRole("button", { name: "Fuera de juego · la suya" }));
    expect(commits.at(-1)?.drawings.at(-1)).toMatchObject({ kind: "fuera", side: "rival" });
    expect(container.querySelector(".dr-lab")?.textContent).toBe("FUERA · ELLOS");
    fireEvent.click(within(container.querySelector(".dr-bar") as HTMLElement).getByRole("button", { name: "Rival" }));
    expect(container.querySelectorAll(".dr-rv")).toHaveLength(0);
  });

  it("Tableros: filter my boards by the rival of their match", () => {
    const m = (id: string, rival: string): CalMatch => ({ id, j: 8, rival, dateMs: 0, played: false, gf: null, ga: null, home: true, venue: "" });
    const mine = [boardDoc("b1", L7(), { name: "Contra el Sky", matchId: "m1", updatedAt: 9 }), boardDoc("b2", L7(), { name: "Contra el Rayo", matchId: "m2", updatedAt: 8 }), boardDoc("b3", L7(), { name: "Sin partido", updatedAt: 7 })];
    render(<Harness initial={L7()} props={{ ...P0, calendar: [m("m1", "MAD SKY"), m("m2", "RAYO")] }} session={{ mine }} />);
    go("Tableros");
    const flt = screen.getByRole("group", { name: "Filtrar por rival" });
    expect(within(flt).getByRole("button", { name: "Todos" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(flt).getByRole("button", { name: "vs RAYO" }));
    const list = screen.getByRole("list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(within(list).getByRole("button", { name: /^Contra el Rayo/ })).toBeInTheDocument();
    fireEvent.click(within(flt).getByRole("button", { name: "Todos" }));
    expect(within(screen.getByRole("list")).getAllByRole("listitem")).toHaveLength(3);
  });
});

describe("ClipExport", () => {
  function env(over: Partial<ClipEnv> = {}) {
    let t = 0;
    let q: (() => void)[] = [];
    const clock: Clock = {
      now: () => t,
      next: (cb) => {
        q.push(cb);
        return q.length;
      },
      cancel: () => {
        q = [];
      },
    };
    const tick = (ms: number) => {
      t += ms;
      const run = q;
      q = [];
      run.forEach((f) => f());
    };
    class Rec implements RecorderLike {
      state = "inactive";
      ondataavailable: ((e: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      start() {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        this.ondataavailable?.({ data: new Blob(["v"], { type: "video/webm" }) });
        this.onstop?.();
      }
    }
    const ctx = new Proxy({}, { get: () => () => undefined, set: () => true });
    const e: ClipEnv = {
      support: () => ({ ok: true, mime: "video/webm", Recorder: Rec }),
      clock,
      canvas: () => ({ width: 0, height: 0, getContext: () => ctx, captureStream: () => ({ getTracks: () => [] }) as unknown as MediaStream }),
      share: vi.fn(async () => "shared" as const),
      save: vi.fn(),
      ...over,
    };
    return { e, tick };
  }
  const play = newPlay("Córner a favor", { adrian: { x: 50, y: 40 } });

  it("records (with its progress), then sends it to the group or downloads it", async () => {
    const { e, tick } = env();
    const said: string[] = [];
    render(<ClipExport play={play} who={{ adrian: { num: 10, name: "ADRIAN" } }} head="J8" rate={1} say={(m) => said.push(m)} env={e} />);
    expect(screen.getByText("720p · 6 s · WebM")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Grabar la jugada en vídeo" }));
    expect(said.at(-1)).toBe("Grabando la jugada en vídeo (6 segundos)");
    act(() => tick(3000));
    expect(screen.getByRole("progressbar", { name: "Grabando el vídeo de la jugada" })).toHaveAttribute("value", "50");
    expect(screen.getByText("Grabando… 50 %")).toBeInTheDocument();
    await act(async () => tick(3000));
    expect(said.at(-1)).toBe("Vídeo listo: mándalo al grupo o descárgalo");
    fireEvent.click(screen.getByRole("button", { name: "Mandar el vídeo al grupo" }));
    expect(e.share).toHaveBeenCalledWith(expect.any(Blob), "pizarra-jugada-corner-a-favor.webm", "Jugada · Córner a favor");
    fireEvent.click(screen.getByRole("button", { name: "Descargar el vídeo (pizarra-jugada-corner-a-favor.webm)" }));
    expect(e.save).toHaveBeenCalledTimes(1);
    await act(async () => undefined);
    expect(said.at(-1)).toBe("Vídeo listo para el grupo");
  });

  it("can be cancelled while it records", async () => {
    const { e, tick } = env();
    const said: string[] = [];
    render(<ClipExport play={play} who={{}} head="J8" rate={1} say={(m) => said.push(m)} env={e} />);
    fireEvent.click(screen.getByRole("button", { name: "Grabar la jugada en vídeo" }));
    act(() => tick(500));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Cancelar" })));
    expect(said.at(-1)).toBe("Grabación cancelada");
    expect(screen.getByRole("button", { name: "Grabar la jugada en vídeo" })).toBeInTheDocument();
  });

  it("a canvas that can't draw is said, not thrown", () => {
    const { e } = env({ canvas: () => null });
    const said: string[] = [];
    render(<ClipExport play={play} who={{}} head="J8" rate={1} say={(m) => said.push(m)} env={e} />);
    fireEvent.click(screen.getByRole("button", { name: "Grabar la jugada en vídeo" }));
    expect(said.at(-1)).toBe("Este navegador no puede dibujar el vídeo.");
    expect(screen.getByText("Este navegador no puede dibujar el vídeo.")).toBeInTheDocument();
  });
});
