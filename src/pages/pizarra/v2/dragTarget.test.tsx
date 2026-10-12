import { fireEvent, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDragController, type DragHandlers } from "./useDragController";
import { lineupOf } from "./testkit";

// Bloque 4 · A5: while a cromo is carried, the board hears the spot it would land on (only when it changes),
// to preview «+2 química aquí»; and that it is gone when the drag ends.

function handlers(): DragHandlers {
  return {
    onStart: vi.fn(),
    onEnd: vi.fn(),
    onDrop: vi.fn(),
    onLongPress: vi.fn(),
    onLine: vi.fn(),
    onGrab: vi.fn(),
    onBaja: vi.fn(),
    onDraw: vi.fn(),
    onDrawRo: vi.fn(),
    onPieceStart: vi.fn(),
    onPiece: vi.fn(),
    onPieceTap: vi.fn(),
    onTarget: vi.fn(),
  };
}

function Hands({ h }: { h: DragHandlers }) {
  const root = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const swp = useRef<SVGPathElement>(null);
  const live = useRef<SVGPathElement>(null);
  const ctl = useDragController(
    { root, frame, sheet, layer, swp, live },
    { lineup: lineupOf(["evans", "tello"]), cam: "tv", canMove: true, canLine: false, magnets: false, draw: false, drawRo: false, pieces: false },
    h,
  );
  return (
    <div ref={root} onPointerDown={ctl.onPointerDown}>
      <div ref={frame} data-frame="">
        <div className="cd" data-tok="evans" data-zone="p">
          <button type="button">EVANS</button>
        </div>
        <div className="cd" data-tok="tello" data-zone="p">
          <button type="button">TELLO</button>
        </div>
        <button type="button" data-slot="3">Hueco</button>
      </div>
      <section ref={sheet} />
      <div ref={layer} />
    </div>
  );
}

const mouse = { pointerType: "mouse", pointerId: 1, button: 0 };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the landing spot of a carried cromo", () => {
  it("is told when it changes (a cromo, an empty slot, nothing) and cleared when the drag ends", () => {
    const h = handlers();
    const { container } = render(<Hands h={h} />);
    const evans = container.querySelector('[data-tok="evans"] button') as HTMLElement;
    const tello = container.querySelector('[data-tok="tello"] button') as HTMLElement;
    const slot = container.querySelector("[data-slot]") as HTMLElement;
    let under: Element | null = null;
    Object.defineProperty(document, "elementFromPoint", { configurable: true, value: () => under });
    fireEvent.pointerDown(evans, { ...mouse, clientX: 10, clientY: 10 });
    under = tello;
    fireEvent.pointerMove(window, { ...mouse, clientX: 60, clientY: 60 });
    fireEvent.pointerMove(window, { ...mouse, clientX: 62, clientY: 61 });
    under = slot;
    fireEvent.pointerMove(window, { ...mouse, clientX: 90, clientY: 90 });
    under = null;
    fireEvent.pointerMove(window, { ...mouse, clientX: 95, clientY: 95 });
    under = tello;
    fireEvent.pointerMove(window, { ...mouse, clientX: 60, clientY: 60 });
    fireEvent.pointerUp(window, { ...mouse, clientX: 60, clientY: 60 });
    const src = { id: "evans", from: "pitch" };
    expect(h.onTarget).toHaveBeenNthCalledWith(1, src, { k: "tok", id: "tello", from: "pitch" });
    expect(h.onTarget).toHaveBeenNthCalledWith(2, src, { k: "slot", i: 3 });
    expect(h.onTarget).toHaveBeenNthCalledWith(3, src, null);
    expect(h.onTarget).toHaveBeenNthCalledWith(4, src, { k: "tok", id: "tello", from: "pitch" });
    // the drag ended: the spot is gone
    expect(h.onTarget).toHaveBeenNthCalledWith(5, src, null);
    expect(h.onTarget).toHaveBeenCalledTimes(5);
    expect(h.onDrop).toHaveBeenCalledWith(src, { k: "tok", id: "tello", from: "pitch" }, null);
    Reflect.deleteProperty(document, "elementFromPoint");
  });
});
