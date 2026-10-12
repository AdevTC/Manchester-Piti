import { act, fireEvent, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BENCH_HOLD_MS, stripGesture } from "./drag";
import { useDragController, type DragHandlers } from "./useDragController";
import { lineupOf } from "./testkit";

// The board's hands on their own: the phone's bench strip (a finger scrolls it sideways, lifts a cromo
// with a hold or an upward move) and one finger at a time.

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
    onLift: vi.fn(),
  };
}

function Hands({ h, strip = true }: { h: DragHandlers; strip?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const swp = useRef<SVGPathElement>(null);
  const live = useRef<SVGPathElement>(null);
  const ctl = useDragController(
    { root, frame, sheet, layer, swp, live },
    { lineup: lineupOf(["evans"]), cam: "tv", canMove: true, canLine: false, magnets: false, draw: false, drawRo: false, pieces: false },
    h,
  );
  return (
    <div ref={root} onPointerDown={ctl.onPointerDown}>
      <div ref={frame} data-frame="">
        <button type="button" className="cd" data-tok="evans" data-zone="p">
          EVANS
        </button>
      </div>
      <section ref={sheet}>
        <div className="cvb" data-bench="1" style={strip ? { overflowX: "auto" } : undefined}>
          <button type="button" className="ac" data-tok="kevin" data-zone="b">
            KEVIN
          </button>
        </div>
      </section>
      <div ref={layer} />
    </div>
  );
}

const kevin = (c: HTMLElement) => c.querySelector('[data-tok="kevin"]') as HTMLElement;
const touch = { pointerType: "touch", pointerId: 1, button: 0 };

afterEach(() => {
  vi.useRealTimers();
});

describe("the phone's bench strip", () => {
  it("a sideways swipe with the finger scrolls the strip: no drag starts", () => {
    const h = handlers();
    const { container } = render(<Hands h={h} />);
    fireEvent.pointerDown(kevin(container), { ...touch, clientX: 100, clientY: 500 });
    fireEvent.pointerMove(window, { ...touch, clientX: 70, clientY: 503 });
    fireEvent.pointerMove(window, { ...touch, clientX: 20, clientY: 505 });
    fireEvent.pointerUp(window, { ...touch, clientX: 20, clientY: 505 });
    expect(h.onStart).not.toHaveBeenCalled();
    expect(h.onDrop).not.toHaveBeenCalled();
  });

  it("moving the finger up, toward the pitch, lifts the cromo at once", () => {
    const h = handlers();
    const { container } = render(<Hands h={h} />);
    fireEvent.pointerDown(kevin(container), { ...touch, clientX: 100, clientY: 500 });
    fireEvent.pointerMove(window, { ...touch, clientX: 104, clientY: 470 });
    expect(h.onStart).toHaveBeenCalledWith("tok", "kevin", "bench");
    fireEvent.pointerUp(window, { ...touch, clientX: 104, clientY: 300 });
    expect(h.onDrop).toHaveBeenCalledWith({ id: "kevin", from: "bench" }, null, null);
  });

  it("holding the finger still lifts it (a buzz), and then it can go sideways", () => {
    vi.useFakeTimers();
    const h = handlers();
    const { container } = render(<Hands h={h} />);
    fireEvent.pointerDown(kevin(container), { ...touch, clientX: 100, clientY: 500 });
    act(() => {
      vi.advanceTimersByTime(BENCH_HOLD_MS + 10);
    });
    expect(h.onLift).toHaveBeenCalledTimes(1);
    expect(kevin(container)).toHaveClass("armed");
    // (the ficha still waits: a lifted cromo is for moving)
    expect(h.onLongPress).not.toHaveBeenCalled();
    fireEvent.pointerMove(window, { ...touch, clientX: 40, clientY: 505 });
    expect(h.onStart).toHaveBeenCalledWith("tok", "kevin", "bench");
  });

  it("the mouse drags straight away, sideways too; so does a finger where the bench doesn't scroll", () => {
    const h = handlers();
    const { container } = render(<Hands h={h} />);
    fireEvent.pointerDown(kevin(container), { pointerType: "mouse", pointerId: 1, button: 0, clientX: 100, clientY: 500 });
    fireEvent.pointerMove(window, { pointerType: "mouse", pointerId: 1, clientX: 70, clientY: 500 });
    expect(h.onStart).toHaveBeenCalledTimes(1);
    fireEvent.pointerUp(window, { pointerType: "mouse", pointerId: 1, clientX: 70, clientY: 500 });
    const h2 = handlers();
    const r2 = render(<Hands h={h2} strip={false} />);
    fireEvent.pointerDown(kevin(r2.container), { ...touch, clientX: 100, clientY: 500 });
    fireEvent.pointerMove(window, { ...touch, clientX: 70, clientY: 500 });
    expect(h2.onStart).toHaveBeenCalledTimes(1);
  });

  it("the gesture: still under the slop waits; up drags; sideways or down scrolls; lifted always drags", () => {
    expect(stripGesture(3, -3, false)).toBe("wait");
    expect(stripGesture(4, -20, false)).toBe("drag");
    expect(stripGesture(-30, -5, false)).toBe("scroll");
    expect(stripGesture(0, 20, false)).toBe("scroll");
    expect(stripGesture(-30, 2, true)).toBe("drag");
  });
});

describe("one finger at a time", () => {
  it("a second finger moving or lifting doesn't move or drop the cromo; its own finger does", () => {
    const h = handlers();
    const { container } = render(<Hands h={h} />);
    const evans = container.querySelector('[data-tok="evans"]') as HTMLElement;
    fireEvent.pointerDown(evans, { ...touch, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(window, { ...touch, clientX: 130, clientY: 120 });
    expect(h.onStart).toHaveBeenCalledTimes(1);
    fireEvent.pointerDown(kevin(container), { ...touch, pointerId: 2, clientX: 300, clientY: 500 });
    fireEvent.pointerMove(window, { ...touch, pointerId: 2, clientX: 320, clientY: 400 });
    fireEvent.pointerUp(window, { ...touch, pointerId: 2, clientX: 320, clientY: 400 });
    fireEvent.pointerCancel(window, { ...touch, pointerId: 2 });
    expect(h.onDrop).not.toHaveBeenCalled();
    expect(h.onEnd).not.toHaveBeenCalled();
    expect(h.onStart).toHaveBeenCalledTimes(1);
    fireEvent.pointerUp(window, { ...touch, clientX: 140, clientY: 130 });
    expect(h.onDrop).toHaveBeenCalledTimes(1);
    expect(vi.mocked(h.onDrop).mock.calls[0][0]).toEqual({ id: "evans", from: "pitch" });
  });

  it("the drag's own finger cancelled (the system took it) ends the drag", () => {
    const h = handlers();
    const { container } = render(<Hands h={h} />);
    const evans = container.querySelector('[data-tok="evans"]') as HTMLElement;
    fireEvent.pointerDown(evans, { ...touch, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(window, { ...touch, clientX: 130, clientY: 120 });
    fireEvent.pointerCancel(window, { ...touch });
    expect(h.onEnd).toHaveBeenCalledTimes(1);
    fireEvent.pointerUp(window, { ...touch, clientX: 140, clientY: 130 });
    expect(h.onDrop).not.toHaveBeenCalled();
  });
});
