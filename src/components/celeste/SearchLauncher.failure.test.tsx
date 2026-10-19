import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

// The dialog's chunk never arrives (offline, a new deploy): the opening is undone and said in words, once.
vi.mock("./SearchDialog", () => {
  throw new Error("Failed to fetch dynamically imported module");
});

const { SearchLauncher } = await import("./SearchLauncher");

it("a failed opening says so in a polite status, and the next opening clears it", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
  render(<SearchLauncher />);
  const button = screen.getByRole("button", { name: /^Buscar \(/ });
  const status = screen.getByRole("status");
  expect(status).toBeEmptyDOMElement();

  await act(async () => {
    fireEvent.click(button);
    await new Promise((r) => setTimeout(r, 0));
  });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(button).toHaveAttribute("aria-expanded", "false");
  expect(screen.getByRole("status")).toHaveTextContent("No se ha podido abrir el buscador. Comprueba la conexión y vuelve a intentarlo.");
  expect(screen.getByRole("status")).toHaveClass("sr-fail");

  fireEvent.click(button);
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
  error.mockRestore();
});
