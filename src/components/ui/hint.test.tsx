import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { Hint } from "./hint";

// <Hint> renders only its child until the first hover or focus; then the Radix tooltip loads (with its own
// provider: there is none at the app root any more) and opens with the root provider's 300 ms delay,
// counted from that first hover. The child is the same node throughout (never remounted).
const button = (onClick = vi.fn()) => (
  <Hint label="Cambiar a tema claro">
    <button type="button" aria-label="Cambiar a tema claro" className="mp-theme-toggle" onClick={onClick}>
      ☀
    </button>
  </Hint>
);

describe("Hint", () => {
  // (the tooltip module compiled ahead, so the first hover isn't timed against Vitest's cold transform;
  // Hint still loads it on its own, on that first hover)
  beforeAll(async () => {
    await import("./hint-tooltip");
  });

  it("first hover: the child as Radix's closed trigger, then the tooltip after the delay, on the same node", async () => {
    const onClick = vi.fn();
    render(button(onClick));
    const el = screen.getByRole("button", { name: "Cambiar a tema claro" });
    // the closed trigger's markup, before any tooltip code is there
    expect(el).toHaveAttribute("data-state", "closed");
    expect(el).toHaveAttribute("data-slot", "tooltip-trigger");
    expect(el).not.toHaveAttribute("aria-describedby");
    expect(el).toHaveClass("mp-theme-toggle");

    const start = Date.now();
    fireEvent.pointerMove(el);
    await act(async () => new Promise((ok) => setTimeout(ok, 150)));
    expect(screen.queryByRole("tooltip")).toBeNull();
    const tip = await screen.findByRole("tooltip", {}, { timeout: 2000 });
    expect(Date.now() - start).toBeGreaterThanOrEqual(280);
    expect(tip).toHaveTextContent("Cambiar a tema claro");
    expect(screen.getByRole("button", { name: "Cambiar a tema claro" })).toBe(el);
    expect(el).toHaveAttribute("aria-describedby", tip.id);
    expect(el.getAttribute("data-state")).toMatch(/open/);

    // the child's own handler still runs, and a click closes the tooltip (as Radix's trigger did)
    fireEvent.click(el);
    expect(onClick).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
    expect(el).toHaveAttribute("data-state", "closed");
  });

  it("keyboard focus shows it at once and blur hides it", async () => {
    render(button());
    const el = screen.getByRole("button", { name: "Cambiar a tema claro" });
    act(() => el.focus());
    const tip = await screen.findByRole("tooltip");
    expect(tip).toHaveTextContent("Cambiar a tema claro");
    expect(el).toHaveAttribute("aria-describedby", tip.id);
    expect(document.activeElement).toBe(el);
    act(() => el.blur());
    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
    expect(el).not.toHaveAttribute("aria-describedby");
  });

  it("a hover that leaves before the delay shows nothing", async () => {
    // (past the skip delay the previous test's tooltip started when it closed)
    await act(async () => new Promise((ok) => setTimeout(ok, 400)));
    render(button());
    const el = screen.getByRole("button", { name: "Cambiar a tema claro" });
    fireEvent.pointerMove(el);
    await act(async () => new Promise((ok) => setTimeout(ok, 100)));
    fireEvent.pointerLeave(el);
    await act(async () => new Promise((ok) => setTimeout(ok, 500)));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
