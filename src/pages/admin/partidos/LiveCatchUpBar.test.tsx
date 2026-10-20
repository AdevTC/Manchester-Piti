import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { LiveCatchUpBar } from "./LiveCatchUpBar";

// The acta editor's bar (MatchEditor): its copy in singular and plural, and the button that takes the jugadas in.
it("nothing to say: no bar", () => {
  const { container } = render(<LiveCatchUpBar count={0} conflict={false} onIncorporate={vi.fn()} />);
  expect(container).toBeEmptyDOMElement();
});

it("one change in the mesa can be incorporated", () => {
  const onIncorporate = vi.fn();
  render(<LiveCatchUpBar count={1} conflict={false} onIncorporate={onIncorporate} />);
  expect(screen.getByRole("status")).toHaveTextContent("Hay 1 cambio en la mesa desde que empezaste a editar");
  fireEvent.click(screen.getByRole("button", { name: "Incorporar cambio" }));
  expect(onIncorporate).toHaveBeenCalledTimes(1);
});

it("several changes and a conflict are explained up front", () => {
  const { rerender } = render(<LiveCatchUpBar count={3} conflict={false} onIncorporate={vi.fn()} />);
  expect(screen.getByRole("status")).toHaveTextContent("Hay 3 cambios en la mesa desde que empezaste a editar");
  expect(screen.getByRole("status")).toHaveTextContent("Se incorporan las jugadas añadidas, corregidas o borradas y se conservan tus cambios.");
  expect(screen.getByRole("button", { name: "Incorporar cambios" })).toBeInTheDocument();
  rerender(<LiveCatchUpBar count={3} conflict onIncorporate={vi.fn()} />);
  expect(screen.getByRole("status")).toHaveTextContent("al guardar te pedirá recargar");
});
