import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { LiveCatchUpBar } from "./LiveCatchUpBar";

// The acta editor's bar (MatchEditor): its copy in singular and plural, and the button that takes the jugadas in.
it("nothing to say: no bar", () => {
  const { container } = render(<LiveCatchUpBar count={0} conflict={false} onIncorporate={vi.fn()} />);
  expect(container).toBeEmptyDOMElement();
});

it("one jugada: «Ha llegado 1 jugada nueva…» · Incorporarla", () => {
  const onIncorporate = vi.fn();
  render(<LiveCatchUpBar count={1} conflict={false} onIncorporate={onIncorporate} />);
  expect(screen.getByRole("status")).toHaveTextContent("Ha llegado 1 jugada nueva desde que empezaste a editar");
  fireEvent.click(screen.getByRole("button", { name: "Incorporarla" }));
  expect(onIncorporate).toHaveBeenCalledTimes(1);
});

it("several: «Han llegado N jugadas nuevas…» · Incorporarlas, and a conflict is said up front", () => {
  const { rerender } = render(<LiveCatchUpBar count={3} conflict={false} onIncorporate={vi.fn()} />);
  expect(screen.getByRole("status")).toHaveTextContent("Han llegado 3 jugadas nuevas desde que empezaste a editar");
  expect(screen.getByRole("status")).toHaveTextContent("Se añaden a tu acta sin tocar tus cambios.");
  expect(screen.getByRole("button", { name: "Incorporarlas" })).toBeInTheDocument();
  rerender(<LiveCatchUpBar count={3} conflict onIncorporate={vi.fn()} />);
  expect(screen.getByRole("status")).toHaveTextContent("al guardar te pedirá recargar");
});
