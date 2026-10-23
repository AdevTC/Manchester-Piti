import { render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { lightFromPointer, lightWriter, movesLight, useLightPointer } from "./useLightPointer";

function Lit() {
  const ref = useRef<HTMLDivElement | null>(null);
  useLightPointer(ref);
  return <div ref={ref} data-testid="lit" />;
}

const move = (el: Element, pointerType: string, clientX: number, clientY: number) => {
  const e = new Event("pointermove", { bubbles: true });
  Object.defineProperties(e, { pointerType: { value: pointerType }, clientX: { value: clientX }, clientY: { value: clientY } });
  el.dispatchEvent(e);
};

afterEach(() => vi.restoreAllMocks());

describe("the glass's light", () => {
  it("follows a mouse or a pen, never a finger", () => {
    expect(movesLight("mouse")).toBe(true);
    expect(movesLight("pen")).toBe(true);
    expect(movesLight("touch")).toBe(false);
  });

  it("maps the pointer into the box, the height damped", () => {
    expect(lightFromPointer(150, 50, { left: 100, top: 0, width: 200, height: 100 })).toEqual({ lx: 0.25, ly: 0.3 });
    expect(lightFromPointer(-10, 500, { left: 0, top: 0, width: 200, height: 100 })).toEqual({ lx: 0, ly: 0.6 });
  });

  it("writes 3 decimals and skips the write when the rounded value hasn't changed", () => {
    const setProperty = vi.fn();
    const write = lightWriter({ setProperty });
    write(0.28, 0.1);
    expect(setProperty.mock.calls).toEqual([
      ["--vd-lx", "0.280"],
      ["--vd-ly", "0.100"],
    ]);
    write(0.2801, 0.1004);
    expect(setProperty).toHaveBeenCalledTimes(2);
    write(0.2801, 0.2);
    expect(setProperty).toHaveBeenCalledTimes(3);
    expect(setProperty).toHaveBeenLastCalledWith("--vd-ly", "0.200");
  });

  it("moves once a frame for a mouse and stays at rest for a touch", () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => frames.push(cb));
    const { getByTestId } = render(<Lit />);
    const el = getByTestId("lit");
    vi.spyOn(el, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100, x: 0, y: 0, toJSON: () => ({}) });
    move(el, "touch", 50, 50);
    expect(frames).toHaveLength(0);
    move(el, "mouse", 20, 10);
    move(el, "mouse", 100, 50);
    expect(frames).toHaveLength(1);
    frames[0](0);
    expect(el.style.getPropertyValue("--vd-lx")).toBe("0.500");
    expect(el.style.getPropertyValue("--vd-ly")).toBe("0.300");
  });
});
