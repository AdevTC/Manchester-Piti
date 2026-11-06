import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PorraSheet } from "./Sheets";

// Inicio's sheets: the focus stays where the user put it while Inicio re-renders under them (each tick of its
// clock hands the sheet a new onClose), and Escape still closes them with the latest one.
const props = { sub: "J5", rival: "Rival", code: "RIV", home: true, note: "", initial: { us: 1, them: 1 }, onSave: () => Promise.resolve() };

describe("Inicio's sheets", () => {
  it("keep the focus on the stepper when the page re-renders with a new onClose", () => {
    const { rerender } = render(<PorraSheet {...props} onClose={() => undefined} />);
    expect(screen.getByRole("button", { name: "Cerrar la porra" })).toHaveFocus();
    const more = screen.getByRole("button", { name: "Un gol más del Piti" });
    more.focus();
    rerender(<PorraSheet {...props} onClose={() => undefined} />);
    expect(more).toHaveFocus();
  });

  it("close with Escape through the latest onClose", () => {
    const first = vi.fn();
    const latest = vi.fn();
    const { rerender } = render(<PorraSheet {...props} onClose={first} />);
    rerender(<PorraSheet {...props} onClose={latest} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(latest).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });
});
