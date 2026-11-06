import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { _resetWidthForTesting, useWidth } from "./useWidth";

// Partidos' width: read from the layout when it can have changed (resize, <html> resizing), never on a render —
// reading clientWidth in the store's snapshot forced a layout of the whole page on every render of Partidos.

let width = 390;
let reads = 0;
let roCallbacks: (() => void)[] = [];

beforeEach(() => {
  _resetWidthForTesting();
  width = 390;
  reads = 0;
  roCallbacks = [];
  vi.spyOn(document.documentElement, "clientWidth", "get").mockImplementation(() => {
    reads++;
    return width;
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(cb: () => void) {
        roCallbacks.push(cb);
      }
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function Probe({ n = 0 }: { n?: number }) {
  const w = useWidth();
  return (
    <p>
      {w}·{n}
    </p>
  );
}

it("reads the width once, not on every render", () => {
  const { container, rerender } = render(<Probe />);
  expect(container.textContent).toBe("390·0");
  const after = reads;
  for (let i = 1; i <= 5; i++) rerender(<Probe n={i} />);
  expect(container.textContent).toBe("390·5");
  expect(reads).toBe(after);
});

it("follows a resize of the window", () => {
  const { container } = render(<Probe />);
  width = 1200;
  act(() => {
    window.dispatchEvent(new Event("resize"));
  });
  expect(container.textContent).toBe("1200·0");
});

it("follows <html> changing width without a resize (a scrollbar coming)", () => {
  const { container } = render(<Probe />);
  width = 375;
  act(() => roCallbacks.forEach((cb) => cb()));
  expect(container.textContent).toBe("375·0");
});

it("reads afresh for the next page once nobody follows it", () => {
  const first = render(<Probe />);
  first.unmount();
  width = 800;
  const { container } = render(<Probe />);
  expect(container.textContent).toBe("800·0");
});
