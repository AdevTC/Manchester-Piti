import { act, render, renderHook } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setIslaHero, useIslaHero, useIslaHeroShown } from "./heroSignal";

afterEach(() => {
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.islaHero;
});

function Hero() {
  const ref = useRef<HTMLElement>(null);
  useIslaHero(ref);
  return <section ref={ref}>hero</section>;
}

describe("useIslaHero", () => {
  it("while the hero is in view the island hides (html[data-isla-hero]); scrolled away or gone, it comes back", () => {
    let report: (entries: { isIntersecting: boolean }[]) => void = () => undefined;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
          report = cb;
        }
        observe() {}
        disconnect() {}
      },
    );
    const shown = renderHook(() => useIslaHeroShown());
    const { unmount } = render(<Hero />);
    act(() => report([{ isIntersecting: true }]));
    expect(document.documentElement.dataset.islaHero).toBe("1");
    expect(shown.result.current).toBe(true);
    act(() => report([{ isIntersecting: false }]));
    expect(document.documentElement.dataset.islaHero).toBeUndefined();
    expect(shown.result.current).toBe(false);
    act(() => report([{ isIntersecting: true }]));
    unmount();
    expect(document.documentElement.dataset.islaHero).toBeUndefined();
  });

  it("two heroes: the flag stays while any is in view; without IntersectionObserver a mounted hero counts", () => {
    const a = {};
    const b = {};
    setIslaHero(a, true);
    setIslaHero(b, true);
    setIslaHero(a, false);
    expect(document.documentElement.dataset.islaHero).toBe("1");
    setIslaHero(b, false);
    expect(document.documentElement.dataset.islaHero).toBeUndefined();
    vi.stubGlobal("IntersectionObserver", undefined);
    const { unmount } = render(<Hero />);
    expect(document.documentElement.dataset.islaHero).toBe("1");
    unmount();
    expect(document.documentElement.dataset.islaHero).toBeUndefined();
  });
});
