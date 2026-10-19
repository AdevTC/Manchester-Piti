import { act, render, renderHook } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { liveDock, useLiveDock, useLiveDockState, type DockMode } from "./liveDock";

afterEach(() => liveDock.reset());

function Declares({ mode }: { mode: DockMode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useLiveDock(ref, mode);
  return <div ref={ref} data-testid={mode} />;
}

describe("liveDock", () => {
  it("floats by default; the live flag lights", () => {
    const { result } = renderHook(() => useLiveDockState());
    expect(result.current).toEqual({ live: false, mode: "float", anchor: null });
    act(() => liveDock.setLive(true));
    expect(result.current.live).toBe(true);
  });

  it("a page's anchor docks the float on it, while mounted", () => {
    const { result } = renderHook(() => useLiveDockState());
    const page = render(<Declares mode="anchor" />);
    expect(result.current.mode).toBe("anchor");
    expect(result.current.anchor).toBe(page.getByTestId("anchor"));
    page.unmount();
    expect(result.current).toMatchObject({ mode: "float", anchor: null });
  });

  it("a lens on screen wins over an anchor (never the match twice)", () => {
    const { result } = renderHook(() => useLiveDockState());
    render(
      <>
        <Declares mode="anchor" />
        <Declares mode="lens" />
      </>,
    );
    // (jsdom has no IntersectionObserver: the lens counts while mounted)
    expect(result.current).toMatchObject({ mode: "lens", anchor: null });
  });

  it("the snapshot is stable between changes (useSyncExternalStore)", () => {
    const a = liveDock.get();
    liveDock.setLive(false);
    expect(liveDock.get()).toBe(a);
  });
});
