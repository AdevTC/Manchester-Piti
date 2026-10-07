import { fireEvent, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useNoScrollJump } from "./useNoScrollJump";

function Board() {
  const ref = useRef<HTMLDivElement>(null);
  useNoScrollJump(ref);
  return (
    <div ref={ref}>
      <button type="button">Sugerir siete</button>
    </div>
  );
}

const scrollTo = (y: number) => {
  Object.defineProperty(window, "scrollY", { value: y, configurable: true });
  window.dispatchEvent(new Event("scroll"));
};

afterEach(() => {
  Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
  vi.mocked(window.scrollTo).mockClear();
});

describe("useNoScrollJump", () => {
  it("puts the page back when a tap on the board moved it", () => {
    const { getByRole } = render(<Board />);
    fireEvent.click(getByRole("button"));
    scrollTo(400);
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "instant" });
  });
  it("leaves the user's own scrolling alone", () => {
    const { getByRole } = render(<Board />);
    fireEvent.click(getByRole("button"));
    window.dispatchEvent(new Event("wheel"));
    scrollTo(400);
    expect(window.scrollTo).not.toHaveBeenCalled();
    scrollTo(800);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });
});
