import { act, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useProgressiveLoad } from "./useProgressiveLoad";

afterEach(() => vi.unstubAllGlobals());

function List({ batch = "24", enabled = true, next }: { batch?: string; enabled?: boolean; next: () => void }) {
  const ref = useProgressiveLoad(enabled, batch, next);
  return <div style={{ overflowY: "auto" }}><div ref={ref}><button onClick={next}>Mostrar más</button></div></div>;
}

function observerMock() {
  const instances: { notify: (visible: boolean) => void; options: IntersectionObserverInit; disconnect: ReturnType<typeof vi.fn> }[] = [];
  vi.stubGlobal("IntersectionObserver", class {
    disconnect = vi.fn();
    observe = vi.fn();
    constructor(callback: IntersectionObserverCallback, options: IntersectionObserverInit) {
      instances.push({ notify: (visible) => callback([{ isIntersecting: visible } as IntersectionObserverEntry], this as unknown as IntersectionObserver), options, disconnect: this.disconnect });
    }
  });
  return instances;
}

it("loads once per batch, re-arms for the next batch and ignores callbacks after unmount", () => {
  const observers = observerMock();
  const next = vi.fn();
  const { rerender, unmount } = render(<List next={next} />);
  act(() => { observers[0].notify(false); });
  expect(next).not.toHaveBeenCalled();
  act(() => { observers[0].notify(true); observers[0].notify(true); });
  expect(next).toHaveBeenCalledTimes(1);
  expect(observers[0].disconnect).toHaveBeenCalled();
  rerender(<List batch="48" next={next} />);
  act(() => { observers[1].notify(true); });
  expect(next).toHaveBeenCalledTimes(2);
  unmount();
  act(() => { observers[1].notify(true); });
  expect(next).toHaveBeenCalledTimes(2);
});

it("uses the viewport when an overflow container has no actual scroll, and pauses when disabled", () => {
  const observers = observerMock();
  const next = vi.fn();
  const { rerender } = render(<List next={next} />);
  expect(observers[0].options).toEqual({ root: null, rootMargin: "240px 0px" });
  rerender(<List next={next} enabled={false} />);
  act(() => { observers[0].notify(true); });
  expect(next).not.toHaveBeenCalled();
  expect(observers).toHaveLength(1);
});

it("preserves the manual button when IntersectionObserver is unavailable", () => {
  vi.stubGlobal("IntersectionObserver", undefined);
  const next = vi.fn();
  const { getByRole } = render(<List next={next} />);
  act(() => { getByRole("button", { name: "Mostrar más" }).click(); });
  expect(next).toHaveBeenCalledOnce();
});
