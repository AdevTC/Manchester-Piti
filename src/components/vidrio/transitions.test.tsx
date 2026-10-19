import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GrowWindow } from "./GrowWindow";
import { SeeAll } from "./SeeAll";
import { morph, region, swap } from "./transitions";
import { useGrow } from "./useGrow";

// jsdom has no View Transitions: one is put on the document for a test and taken away after
const fakeVT = (impl: (cb: () => void) => { finished: Promise<void> }) => Object.defineProperty(document, "startViewTransition", { configurable: true, value: impl });

afterEach(() => {
  Reflect.deleteProperty(document, "startViewTransition");
  delete document.documentElement.dataset.vdDir;
});

describe("swap", () => {
  it("without View Transitions the update just happens", async () => {
    const update = vi.fn();
    const run = swap("right", update);
    expect(update).toHaveBeenCalledOnce();
    expect(run.animated).toBe(false);
    await run.finished;
  });

  it("with them: the direction is on <html> while it runs, the update inside the transition", async () => {
    let seen = "";
    fakeVT((cb) => {
      seen = document.documentElement.dataset.vdDir ?? "";
      cb();
      return { finished: Promise.resolve() };
    });
    const update = vi.fn();
    const run = swap("left", update);
    expect(seen).toBe("left");
    expect(update).toHaveBeenCalledOnce();
    expect(run.animated).toBe(true);
    await run.finished;
    expect(document.documentElement.dataset.vdDir).toBeUndefined();
  });

  it("names regions and shared objects", () => {
    expect(region(3)).toBe("vd-reg-3");
    expect(morph("lens")).toEqual({ className: "vd-morph", style: { viewTransitionName: "lens" } });
  });
});

function Plays() {
  const g = useGrow("plays");
  return (
    <div>
      <section data-testid="summary" {...g.summaryProps}>
        <p>7 jugadas</p>
        <SeeAll summary={<b>31 jugadas más</b>} count={31} label="Ver todo el partido" onOpen={g.grow} />
      </section>
      <GrowWindow open={g.open} title="Jugada a jugada" onClose={g.close} {...g.windowProps}>
        <p>38 jugadas</p>
      </GrowWindow>
    </div>
  );
}

describe("«Ver todo» grows in place", () => {
  it("the summary hands its name to the window and back; Escape and «Cerrar» close; focus comes back", () => {
    render(<Plays />);
    const summary = screen.getByTestId("summary");
    expect(summary.style.viewTransitionName).toBe("plays");
    const open = screen.getByRole("button", { name: "Ver todo el partido" });
    open.focus();
    act(() => {
      fireEvent.click(open);
    });
    const win = screen.getByRole("region", { name: "Jugada a jugada" });
    expect(win.style.viewTransitionName).toBe("plays");
    expect(summary.style.viewTransitionName).toBe("");
    expect(screen.getByRole("heading", { name: "Jugada a jugada" })).toHaveFocus();
    act(() => {
      fireEvent.keyDown(win, { key: "Escape" });
    });
    expect(screen.queryByRole("region", { name: "Jugada a jugada" })).toBeNull();
    expect(open).toHaveFocus();
    act(() => {
      fireEvent.click(open);
    });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    });
    expect(screen.queryByText("38 jugadas")).toBeNull();
  });

  it("nothing more, no footer", () => {
    render(<SeeAll summary="nada" count={0} label="Ver todo" onOpen={() => undefined} />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
