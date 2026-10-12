import { fireEvent, render } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { useDragController, type DragHandlers, type DragState } from "./useDragController";
import { lineupOf } from "./testkit";

// Bloque 5 · the board's hands moving several fichas at once: Shift / Ctrl (or «Seleccionar») turns a tap
// into picking; dragging one of the group carries the rest (and their rings) along and lets them go
// together; a ficha outside the group still drags alone.

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
    onMultiTap: vi.fn(),
    onGroup: vi.fn(),
  };
}

function Hands({ h, st }: { h: DragHandlers; st: Partial<DragState> }) {
  const root = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const swp = useRef<SVGPathElement>(null);
  const live = useRef<SVGPathElement>(null);
  const ctl = useDragController(
    { root, frame, sheet, layer, swp, live },
    { lineup: lineupOf(["evans", "tello"]), cam: "tv", canMove: true, canLine: false, magnets: false, draw: false, drawRo: false, pieces: false, multi: true, ...st },
    h,
  );
  return (
    <div ref={root} onPointerDown={ctl.onPointerDown}>
      <div
        ref={(el) => {
          frame.current = el;
          if (el) el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 200, right: 200, bottom: 200, x: 0, y: 0, toJSON: () => ({}) });
        }}
        data-frame=""
      >
        <div className="cd" data-tok="evans" data-zone="p" style={{ ["--x" as string]: "20", ["--y" as string]: "30" }}>
          EVANS
        </div>
        <div className="cd" data-tok="tello" data-zone="p" style={{ ["--x" as string]: "60", ["--y" as string]: "70" }}>
          TELLO
        </div>
        <button type="button" className="rv" data-piece="r:r1" style={{ ["--x" as string]: "40", ["--y" as string]: "20" }}>
          R
        </button>
        <button type="button" className="ball" data-piece="b" style={{ ["--x" as string]: "50", ["--y" as string]: "50" }}>
          B
        </button>
        <span className="b5p-ring" data-msel="tello" style={{ ["--x" as string]: "60", ["--y" as string]: "70" }} />
      </div>
      <section ref={sheet} />
      <div ref={layer} />
    </div>
  );
}

const mouse = { pointerType: "mouse", pointerId: 1, button: 0 };
const tok = (c: HTMLElement, id: string) => c.querySelector('[data-tok="' + id + '"]') as HTMLElement;

describe("picking", () => {
  it("Shift-click or Ctrl-click on a cromo picks it (no drag, no long press, no tap after)", () => {
    const h = handlers();
    const { container } = render(<Hands h={h} st={{}} />);
    fireEvent.pointerDown(tok(container, "evans"), { ...mouse, shiftKey: true, clientX: 40, clientY: 60 });
    fireEvent.pointerUp(window, { ...mouse, clientX: 40, clientY: 60 });
    expect(h.onMultiTap).toHaveBeenCalledWith("evans");
    fireEvent.pointerDown(tok(container, "tello"), { ...mouse, ctrlKey: true, clientX: 120, clientY: 140 });
    fireEvent.pointerUp(window, { ...mouse, clientX: 120, clientY: 140 });
    expect(h.onMultiTap).toHaveBeenLastCalledWith("tello");
    expect(h.onDrop).not.toHaveBeenCalled();
    expect(h.onLongPress).not.toHaveBeenCalled();
  });

  it("with «Seleccionar» on, a plain tap on a piece picks it instead of marking it", () => {
    const h = handlers();
    const { container } = render(<Hands h={h} st={{ pieces: true, selecting: true }} />);
    const r1 = container.querySelector('[data-piece="r:r1"]') as HTMLElement;
    fireEvent.pointerDown(r1, { ...mouse, clientX: 80, clientY: 40 });
    fireEvent.pointerUp(window, { ...mouse, clientX: 80, clientY: 40 });
    expect(h.onMultiTap).toHaveBeenCalledWith("r:r1");
    expect(h.onPieceTap).not.toHaveBeenCalled();
  });

  it("without multi (system mode), Shift does nothing special", () => {
    const h = handlers();
    const { container } = render(<Hands h={h} st={{ multi: false }} />);
    fireEvent.pointerDown(tok(container, "evans"), { ...mouse, shiftKey: true, clientX: 40, clientY: 60 });
    fireEvent.pointerUp(window, { ...mouse, clientX: 40, clientY: 60 });
    expect(h.onMultiTap).not.toHaveBeenCalled();
  });
});

describe("the group dragged", () => {
  it("one cromo of the group carries the others and their rings, and they are let go together", () => {
    const h = handlers();
    const { container } = render(<Hands h={h} st={{ group: ["evans", "tello"] }} />);
    fireEvent.pointerDown(tok(container, "evans"), { ...mouse, clientX: 40, clientY: 60 });
    fireEvent.pointerMove(window, { ...mouse, clientX: 60, clientY: 70 });
    expect(h.onStart).toHaveBeenCalledWith("tok", "evans", "pitch");
    // 20 px of a 200 px frame = 10 %, 10 px = 5 %
    expect(tok(container, "tello").style.getPropertyValue("--x")).toBe("70.00");
    expect(tok(container, "tello").style.getPropertyValue("--y")).toBe("75.00");
    expect(tok(container, "evans").style.getPropertyValue("--x")).toBe("30.00");
    expect((container.querySelector("[data-msel]") as HTMLElement).style.getPropertyValue("--x")).toBe("70.00");
    fireEvent.pointerUp(window, { ...mouse, clientX: 60, clientY: 70 });
    expect(h.onGroup).toHaveBeenCalledWith(["evans", "tello"], { dX: 10, dY: 5 });
    expect(h.onDrop).not.toHaveBeenCalled();
    expect(h.onEnd).toHaveBeenCalled();
    // (put back: the board redraws them where they now are)
    expect(tok(container, "tello").style.getPropertyValue("--x")).toBe("60");
  });

  it("a paso's pieces of the group go together too", () => {
    const h = handlers();
    const { container } = render(<Hands h={h} st={{ pieces: true, group: ["r:r1", "b"] }} />);
    const ball = container.querySelector('[data-piece="b"]') as HTMLElement;
    fireEvent.pointerDown(ball, { ...mouse, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(window, { ...mouse, clientX: 90, clientY: 120 });
    expect((container.querySelector('[data-piece="r:r1"]') as HTMLElement).style.getPropertyValue("--x")).toBe("35.00");
    fireEvent.pointerUp(window, { ...mouse, clientX: 90, clientY: 120 });
    expect(h.onGroup).toHaveBeenCalledWith(["r:r1", "b"], { dX: -5, dY: 10 });
    expect(h.onPiece).not.toHaveBeenCalled();
  });

  it("a cromo outside the group still drags alone", () => {
    const h = handlers();
    const { container } = render(<Hands h={h} st={{ group: ["tello"] }} />);
    fireEvent.pointerDown(tok(container, "evans"), { ...mouse, clientX: 40, clientY: 60 });
    fireEvent.pointerMove(window, { ...mouse, clientX: 60, clientY: 70 });
    fireEvent.pointerUp(window, { ...mouse, clientX: 60, clientY: 70 });
    expect(h.onGroup).not.toHaveBeenCalled();
    expect(h.onDrop).toHaveBeenCalledTimes(1);
  });
});
