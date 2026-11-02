// r14 · Jugadas and Dibujar in the DOM: the library, the replay transport, Editar's drags (mouse and touch) with their
// keyboard alternatives, the timeline reorder, the step ops, the strokes on the Siete.
import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithPz, fakeBoard, fakeWorld, ME_CAPTAIN, ME_PLAYER, fakeLineup } from "../../store/testkit";
import type { Play } from "../../../plays";
import type { Lineup } from "../../../formations";

vi.mock("../../campo/PiCampo", () => ({ PiCampo: () => <div data-testid="campo" /> }));
vi.mock("../../../data/seasonPlays", () => ({
  useSeasonPlays: () => ({ plays: [], team: [], mine: () => [], loading: false, error: false }),
  createSeasonPlay: vi.fn(),
  deleteSeasonPlay: vi.fn(),
}));

import { Jugadas } from "./Jugadas";
import { Dibujar } from "./Dibujar";

const OWN: Play = {
  id: "jown",
  name: "Salida por Jordi",
  kind: "propia",
  frames: [
    { players: { evans: { x: 50, y: 92 }, fer: { x: 30, y: 72 }, jordi: { x: 18, y: 50 } }, ball: { x: 50, y: 88 }, rivals: [{ id: "r1", x: 50, y: 6 }], arrows: [], title: "Salida" },
    { players: { evans: { x: 50, y: 92 }, fer: { x: 30, y: 72 }, jordi: { x: 18, y: 30 } }, ball: { x: 18, y: 30 }, rivals: [{ id: "r1", x: 45, y: 10 }], arrows: [], title: "Arriba" },
    { players: { evans: { x: 50, y: 92 }, fer: { x: 40, y: 60 }, jordi: { x: 20, y: 20 } }, ball: { x: 20, y: 20 }, rivals: [{ id: "r1", x: 40, y: 12 }], arrows: [], title: "Centro" },
  ],
};
const lineupWith = (plays: Play[]): Lineup => ({ ...fakeLineup("3-2-1", ["evans", "fer", "erik", "jordi", "adrian", "eguzquiza", null]), plays });
const world = (plays: Play[] = [OWN]) => fakeWorld({ boards: [fakeBoard({ lineup: lineupWith(plays) })] });
/** The stage the shell gives Dibujar: a 600×600 box with the grass at x 100–500 (400 × 600). */
function Stage({ children }: { children: React.ReactNode }) {
  return (
    <div className="pz-s__stage">
      <div className="pz-c__plane" />
      {children}
    </div>
  );
}
const savedPlays = (commit: ReturnType<typeof vi.fn>): Play[] => (commit.mock.calls.at(-1)?.[0] as Lineup).plays ?? [];

beforeEach(() => {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const r = this.classList?.contains("pz-c__plane") ? { left: 100, top: 0, width: 400, height: 600 } : { left: 0, top: 0, width: 600, height: 600 };
    return { ...r, x: r.left, y: r.top, right: r.left + r.width, bottom: r.top + r.height, toJSON: () => r } as DOMRect;
  });
  localStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("Jugadas · the library", () => {
  it("shows the team's eight, yours, the search and the type filter", async () => {
    const { P, host, flush } = renderWithPz(
      <>
        <Jugadas region="lead" layout="desktop" />
        <Jugadas region="side" layout="desktop" />
      </>,
      { place: "jugadas", world: world() },
    );
    await flush();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("9 jugadas");
    expect(screen.getByRole("button", { name: /Córner a favor\./ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Salida por Jordi\./ })).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText(/Buscar/), { target: { value: "corner" } });
    await flush();
    expect(screen.queryByRole("button", { name: /Falta frontal\./ })).toBeNull();
    expect(screen.getByRole("button", { name: /Córner a favor\./ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Córner a favor\./ }));
    expect(host.navigate.mock.calls.at(-1)?.[0]).toContain("/pizarra/jugadas/lib-corner");
    // the stage previews a play with the `jugada` source
    expect(P.state.stage.source).toBe("jugada");
  });
  it("«Nueva jugada» makes a two-step play from the seven and opens it in Editar", async () => {
    const { P, host, flush } = renderWithPz(<Jugadas region="side" layout="desktop" />, { place: "jugadas", world: world([]) });
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Nueva jugada" }));
    const plays = savedPlays(host.commit);
    expect(plays.length).toBe(1);
    expect(plays[0].frames.length).toBe(2);
    expect(P).toBeTruthy();
    expect(host.navigate.mock.calls.at(-1)?.[0]).toMatch(/modo=editar&paso=2/);
  });
  it("a player reading someone else's board only reads (no Nueva)", async () => {
    renderWithPz(<Jugadas region="side" layout="desktop" />, { place: "jugadas", world: world(), me: ME_PLAYER });
    expect(screen.queryByRole("button", { name: "Nueva jugada" })).toBeNull();
  });
});

describe("Jugadas · a play: the transport and the timeline", () => {
  it("plays, pauses and steps (buttons and keys)", async () => {
    vi.useFakeTimers();
    const { P, flush } = renderWithPz(
      <>
        <Jugadas region="lead" layout="desktop" />
        <Jugadas region="side" layout="desktop" />
      </>,
      { place: "jugadas", sub: "jown", world: world() },
    );
    await flush();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Salida por Jordi");
    fireEvent.click(screen.getByRole("button", { name: "Paso siguiente" }));
    await flush();
    expect(screen.getByText("Paso 2 de 3")).toBeTruthy();
    fireEvent.keyDown(window, { key: "End" });
    await flush();
    expect(screen.getByText("Paso 3 de 3")).toBeTruthy();
    fireEvent.keyDown(window, { key: "Home" });
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Reproducir la jugada" }));
    await act(async () => {
      vi.advanceTimersByTime(20000);
    });
    expect(screen.getByText("Paso 3 de 3")).toBeTruthy();
    expect(P.state.stage.source).toBe("jugada");
    expect(screen.getByRole("button", { name: "Reproducir la jugada" }).textContent).toContain("Otra vez");
  });
  it("Editar: drag a step's mini to reorder (mouse), Antes/Después by keyboard, Paso al final", async () => {
    const { host, flush } = renderWithPz(
      <>
        <Jugadas region="lead" layout="desktop" />
        <Jugadas region="side" layout="desktop" />
      </>,
      { place: "jugadas", sub: "jown", q: { modo: "editar" }, world: world() },
    );
    await flush();
    const mini = (k: number) => screen.getByRole("button", { name: new RegExp(`^Paso ${k} de 3`) });
    // drop target: elementFromPoint finds the third mini
    const third = mini(3);
    document.elementFromPoint = vi.fn(() => third);
    fireEvent.pointerDown(mini(1), { pointerType: "mouse", pointerId: 1, button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(window, { pointerType: "mouse", pointerId: 1, clientX: 40, clientY: 10 });
    fireEvent.pointerUp(window, { pointerType: "mouse", pointerId: 1, clientX: 200, clientY: 10 });
    await flush();
    expect(savedPlays(host.commit)[0].frames.map((f) => f.title)).toEqual(["Arriba", "Centro", "Salida"]);
    fireEvent.click(screen.getByRole("button", { name: "Mover este paso antes" }));
    await flush();
    expect(savedPlays(host.commit)[0].frames.map((f) => f.title)).toEqual(["Arriba", "Salida", "Centro"]);
    fireEvent.click(screen.getByRole("button", { name: /Paso al final/ }));
    await flush();
    expect(savedPlays(host.commit)[0].frames.length).toBe(4);
  });
  it("Editar: a touch reorders after a hold (a quick swipe scrolls the strip instead)", async () => {
    vi.useFakeTimers();
    const { host, flush } = renderWithPz(<Jugadas region="panel" layout="phone" />, { place: "jugadas", sub: "jown", q: { modo: "editar" }, world: world(), layout: "phone" });
    await flush();
    const mini = (k: number) => screen.getByRole("button", { name: new RegExp(`^Paso ${k} de 3`) });
    document.elementFromPoint = vi.fn(() => mini(2));
    const n0 = host.commit.mock.calls.length;
    // a swipe: no reorder
    fireEvent.pointerDown(mini(3), { pointerType: "touch", pointerId: 2, button: 0, clientX: 300, clientY: 10 });
    fireEvent.pointerMove(window, { pointerType: "touch", pointerId: 2, clientX: 200, clientY: 10 });
    fireEvent.pointerUp(window, { pointerType: "touch", pointerId: 2, clientX: 100, clientY: 10 });
    expect(host.commit.mock.calls.length).toBe(n0);
    // hold, then move
    fireEvent.pointerDown(mini(3), { pointerType: "touch", pointerId: 3, button: 0, clientX: 300, clientY: 10 });
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    fireEvent.pointerMove(window, { pointerType: "touch", pointerId: 3, clientX: 150, clientY: 10 });
    fireEvent.pointerUp(window, { pointerType: "touch", pointerId: 3, clientX: 150, clientY: 10 });
    await flush();
    expect(savedPlays(host.commit)[0].frames.map((f) => f.title)).toEqual(["Salida", "Centro", "Arriba"]);
  });
});

describe("Jugadas › Editar · the pitch is the editor (Dibujar's layer)", () => {
  const editor = (sub = "jown", q: Record<string, string> = { modo: "editar", paso: "2" }, plays: Play[] = [OWN]) =>
    renderWithPz(
      <>
        <Jugadas region="lead" layout="desktop" />
        <Stage>
          <Dibujar region="dock" layout="desktop" />
        </Stage>
      </>,
      { place: "jugadas", sub, q, world: world(plays), me: ME_CAPTAIN },
    );
  it("drags a shirt with the mouse (one undo step) and with a finger", async () => {
    const { P, host, flush } = editor();
    await flush();
    expect(P.state.drawing).toBe(true);
    const jordi = screen.getByRole("button", { name: /^JORDI en el paso 2/ });
    // the grass is 400 px wide: 40 px = 10 %
    fireEvent.pointerDown(jordi, { pointerType: "mouse", pointerId: 1, button: 0, clientX: 200, clientY: 200 });
    fireEvent.pointerMove(window, { pointerType: "mouse", pointerId: 1, clientX: 240, clientY: 200 });
    fireEvent.pointerUp(window, { pointerType: "mouse", pointerId: 1, clientX: 240, clientY: 200 });
    await flush();
    expect(savedPlays(host.commit)[0].frames[1].players.jordi).toEqual({ x: 28, y: 30 });
    expect(P.sel.undoLabel()).toMatch(/JORDI movido en el paso 2/);
    fireEvent.pointerDown(screen.getByRole("button", { name: /^JORDI en el paso 2/ }), { pointerType: "touch", pointerId: 7, button: 0, clientX: 200, clientY: 200 });
    fireEvent.pointerMove(window, { pointerType: "touch", pointerId: 7, clientX: 200, clientY: 260 });
    fireEvent.pointerUp(window, { pointerType: "touch", pointerId: 7, clientX: 200, clientY: 260 });
    await flush();
    expect(savedPlays(host.commit)[0].frames[1].players.jordi).toEqual({ x: 28, y: 40 });
    P.act.undo();
    expect(savedPlays(host.commit)[0].frames[1].players.jordi).toEqual({ x: 28, y: 30 });
  });
  it("moves the ball and a rival with the arrows (Mayús: 10 %), Supr takes the rival out", async () => {
    const { host, flush } = editor();
    await flush();
    fireEvent.keyDown(screen.getByRole("button", { name: /^El balón en el paso 2/ }), { key: "ArrowRight" });
    await flush();
    expect(savedPlays(host.commit)[0].frames[1].ball).toEqual({ x: 20, y: 30 });
    fireEvent.keyDown(screen.getByRole("button", { name: /^Rival 1 de Red Demons/ }), { key: "ArrowDown", shiftKey: true });
    await flush();
    expect(savedPlays(host.commit)[0].frames[1].rivals[0]).toEqual({ id: "r1", x: 45, y: 20 });
    fireEvent.keyDown(screen.getByRole("button", { name: /^Rival 1 de Red Demons/ }), { key: "Delete" });
    await flush();
    expect(savedPlays(host.commit)[0].frames.every((f) => f.rivals.length === 0)).toBe(true);
  });
  it("«Varias a la vez»: two picked shirts move together", async () => {
    const { host, flush } = editor();
    await flush();
    fireEvent.keyDown(screen.getByRole("button", { name: /^JORDI en el paso 2/ }), { key: "Enter" });
    fireEvent.keyDown(screen.getByRole("button", { name: /^FER en el paso 2/ }), { key: "Enter", shiftKey: true });
    await flush();
    fireEvent.pointerDown(screen.getByRole("button", { name: /^FER en el paso 2/ }), { pointerType: "mouse", pointerId: 1, button: 0, clientX: 200, clientY: 200 });
    fireEvent.pointerMove(window, { pointerType: "mouse", pointerId: 1, clientX: 200, clientY: 140 });
    fireEvent.pointerUp(window, { pointerType: "mouse", pointerId: 1, clientX: 200, clientY: 140 });
    await flush();
    const f = savedPlays(host.commit)[0].frames[1];
    expect(f.players.jordi).toEqual({ x: 18, y: 20 });
    expect(f.players.fer).toEqual({ x: 30, y: 62 });
  });
  it("bends a run by its 44 px handle (drag), the arrows, and straightens it with Supr", async () => {
    const { host, flush } = editor();
    await flush();
    const hd = screen.getByRole("button", { name: /^Curva de la carrera de JORDI al paso 2, recta/ });
    fireEvent.pointerDown(hd, { pointerType: "mouse", pointerId: 1, button: 0, clientX: 172, clientY: 240 });
    fireEvent.pointerMove(window, { pointerType: "mouse", pointerId: 1, clientX: 140, clientY: 240 });
    fireEvent.pointerUp(window, { pointerType: "mouse", pointerId: 1, clientX: 140, clientY: 240 });
    await flush();
    expect(savedPlays(host.commit)[0].frames[1].curves?.jordi).toBeDefined();
    fireEvent.keyDown(screen.getByRole("button", { name: /^Curva de la carrera de JORDI al paso 2, curvada/ }), { key: "Delete" });
    await flush();
    expect(savedPlays(host.commit)[0].frames[1].curves).toBeUndefined();
    fireEvent.keyDown(screen.getByRole("button", { name: /^Curva de la carrera de JORDI al paso 2, recta/ }), { key: "ArrowLeft" });
    await flush();
    expect(savedPlays(host.commit)[0].frames[1].curves?.jordi).toBeDefined();
  });
  it("a team play asks «Hacer mi copia» on the first drag and never changes the team's", async () => {
    const { P, host, flush } = editor("lib-corner", { modo: "editar", paso: "2" }, []);
    await flush();
    const n0 = host.commit.mock.calls.length;
    const shirt = screen.getAllByRole("button", { name: /en el paso 2\. Arrastra/ })[1];
    fireEvent.pointerDown(shirt, { pointerType: "mouse", pointerId: 1, button: 0, clientX: 200, clientY: 200 });
    fireEvent.pointerMove(window, { pointerType: "mouse", pointerId: 1, clientX: 260, clientY: 200 });
    fireEvent.pointerUp(window, { pointerType: "mouse", pointerId: 1, clientX: 260, clientY: 200 });
    await flush();
    expect(host.commit.mock.calls.length).toBe(n0);
    expect(P.state.toast?.text).toMatch(/es del equipo: haz tu copia/);
    fireEvent.click(screen.getAllByRole("button", { name: /Hacer mi copia/ })[0]);
    await flush();
    const plays = savedPlays(host.commit);
    expect(plays.length).toBe(1);
    expect(plays[0].name).toBe("Córner a favor (tuya)");
    expect(host.navigate.mock.calls.at(-1)?.[0]).toContain(plays[0].id);
  });
  it("step title is written on leaving the field; «Listo» goes back to Ver", async () => {
    const { P, host, flush } = editor();
    await flush();
    const t = screen.getByLabelText("Título del paso");
    fireEvent.change(t, { target: { value: "Desmarque" } });
    fireEvent.blur(t);
    await flush();
    expect(savedPlays(host.commit)[0].frames[1].title).toBe("Desmarque");
    fireEvent.click(within(screen.getByRole("toolbar", { name: "Color, deshacer y listo" })).getByRole("button", { name: /Listo/ }));
    await flush();
    expect(P.state.drawing).toBe(false);
  });
});

describe("Dibujar · on the Siete", () => {
  const siete = (me = ME_CAPTAIN) =>
    renderWithPz(
      <Stage>
        <Dibujar region="dock" layout="desktop" />
      </Stage>,
      { place: "siete", world: world([]), me },
    );
  it("draws a Flecha with the mouse, recolours, deletes from the list; Deshacer", async () => {
    const { P, host, flush } = siete();
    await flush();
    const pad = document.querySelector(".pd-pad") as HTMLElement;
    fireEvent.pointerDown(pad, { pointerType: "mouse", pointerId: 1, button: 0, clientX: 200, clientY: 300 });
    fireEvent.pointerMove(window, { pointerType: "mouse", pointerId: 1, clientX: 300, clientY: 200 });
    fireEvent.pointerUp(window, { pointerType: "mouse", pointerId: 1, clientX: 300, clientY: 200 });
    await flush();
    const d = (host.commit.mock.calls.at(-1)?.[0] as Lineup).drawings;
    expect(d.length).toBe(1);
    expect(d[0].kind).toBe("carrera");
    expect(d[0].points).toEqual([
      { x: 25, y: 50 },
      { x: 50, y: 33.3 },
    ]);
    expect(P.state.stage.overlay?.paths[0].kind).toBe("flecha");
    fireEvent.click(screen.getByRole("button", { name: /Los trazos: 1 de 60/ }));
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Borrar: Flecha" }));
    await flush();
    expect((host.commit.mock.calls.at(-1)?.[0] as Lineup).drawings.length).toBe(0);
    P.act.undo();
    expect((host.commit.mock.calls.at(-1)?.[0] as Lineup).drawings.length).toBe(1);
  });
  it("Texto: a tap opens the field and «Poner» writes it", async () => {
    const { host, flush } = siete();
    await flush();
    fireEvent.click(screen.getByRole("button", { name: /^Texto:/ }));
    const pad = document.querySelector(".pd-pad") as HTMLElement;
    fireEvent.pointerDown(pad, { pointerType: "touch", pointerId: 1, button: 0, clientX: 300, clientY: 300 });
    fireEvent.pointerUp(window, { pointerType: "touch", pointerId: 1, clientX: 300, clientY: 300 });
    await flush();
    fireEvent.change(screen.getByLabelText("Texto para el campo"), { target: { value: "¡PRESIÓN!" } });
    fireEvent.click(screen.getByRole("button", { name: "Poner" }));
    await flush();
    const d = (host.commit.mock.calls.at(-1)?.[0] as Lineup).drawings;
    expect(d[0]).toMatchObject({ kind: "texto", text: "¡PRESIÓN!", points: [{ x: 50, y: 50 }] });
  });
  it("«Jugada» turns a run that leaves a player into a two-step play", async () => {
    const { P, host, flush } = siete();
    await flush();
    // JORDI (LD of the 3-2-1): find his spot from the store and draw from it
    const s = P.sel.ver()!.slots.find((x) => x.playerId === "jordi")!;
    const pad = document.querySelector(".pd-pad") as HTMLElement;
    const X = 100 + (s.x / 100) * 400;
    const Y = (s.y / 100) * 600;
    fireEvent.pointerDown(pad, { pointerType: "mouse", pointerId: 1, button: 0, clientX: X, clientY: Y });
    fireEvent.pointerMove(window, { pointerType: "mouse", pointerId: 1, clientX: X, clientY: Y - 150 });
    fireEvent.pointerUp(window, { pointerType: "mouse", pointerId: 1, clientX: X, clientY: Y - 150 });
    await flush();
    fireEvent.click(screen.getByRole("button", { name: /Convertir en jugada: 1 trazo sale/ }));
    await flush();
    const plays = (host.commit.mock.calls.at(-1)?.[0] as Lineup).plays ?? [];
    expect(plays.length).toBe(1);
    expect(plays[0].frames[1].players.jordi.y).toBeLessThan(plays[0].frames[0].players.jordi.y);
    expect(host.navigate.mock.calls.at(-1)?.[0]).toMatch(/pizarra.jugadas.+modo=editar/);
  });
  it("a read-only board: no tools, «Solo lectura» with Duplicar", async () => {
    siete(ME_PLAYER);
    expect(screen.queryByRole("toolbar", { name: "Herramientas de dibujo" })).toBeNull();
    expect(screen.getByText("Solo lectura")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Duplicar para dibujar" })).toBeTruthy();
  });
});
