import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

// The dialog stands in for SearchDialog (its data hooks are SearchPanel's and searchIndex's tests' business).
vi.mock("./SearchDialog", () => ({
  SearchDialog: ({ onClose }: { onClose: (refocus?: boolean) => void }) => (
    <div role="dialog" aria-modal="true" aria-label="Buscar en la web">
      <button type="button" onClick={() => onClose()}>
        Cerrar
      </button>
    </div>
  ),
}));

const { SearchLauncher } = await import("./SearchLauncher");
await import("./SearchDialog");

/** Fires inside an async act (the dialog arrives a tick later: its chunk). */
const inAct = (fire: () => void) =>
  act(async () => {
    fire();
    await Promise.resolve();
  });

it("the button opens the dialog and the focus comes back to it on close", async () => {
  render(<SearchLauncher />);
  const button = screen.getByRole("button", { name: /^Buscar \(/ });
  expect(button).toHaveAttribute("aria-haspopup", "dialog");
  button.focus();
  await inAct(() => fireEvent.click(button));
  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  expect(button).toHaveAttribute("aria-expanded", "true");
  fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(button).toHaveFocus();
});

it("Ctrl+K and «/» open it from the page, but not from inside a field", async () => {
  render(
    <>
      <input aria-label="Otro campo" />
      <SearchLauncher />
    </>,
  );
  const field = screen.getByRole("textbox", { name: "Otro campo" });
  field.focus();
  await inAct(() => fireEvent.keyDown(field, { key: "/" }));
  await inAct(() => fireEvent.keyDown(field, { key: "k", ctrlKey: true }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

  await inAct(() => fireEvent.keyDown(document.body, { key: "k", ctrlKey: true }));
  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

  await inAct(() => fireEvent.keyDown(document.body, { key: "/" }));
  expect(await screen.findByRole("dialog")).toBeInTheDocument();
});
