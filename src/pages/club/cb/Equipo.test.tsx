import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { readKits } from "../../../lib/clubExtras";
import { Equipo, type EquipoProps } from "./Equipo";

vi.mock("@tanstack/react-router", () => ({ useRouter: () => ({ navigate: vi.fn() }) }));

// r12 M-19: El equipo's kits read clubContent.kits; without them, exactly the code's note and swatches.
const props: EquipoProps = { still: () => undefined, mk: { shirt: undefined, line: "", open: () => undefined }, squad: [], captain: "", toCrest: () => undefined, photo: "", venues: [], cap: false };

const swatches = () => {
  const list = screen.getByRole("list", { name: "Colores de la equipación" });
  return within(list)
    .getAllByRole("listitem")
    .map((li) => [li.textContent, li.querySelector("i")?.className, li.querySelector("i")?.getAttribute("style") ?? null]);
};

describe("El equipo · las equipaciones", () => {
  it("without kits (or with the default read): the code's note and its class-named swatches", () => {
    for (const kits of [undefined, readKits({})]) {
      const { unmount } = render(<Equipo {...props} kits={kits} />);
      expect(screen.getByText("Celeste de la casa, con el oro en el cuello y el bajo.")).toBeTruthy();
      expect(swatches()).toEqual([
        ["Celeste", "cb-sw__dot cb-sw__dot--celeste", null],
        ["Tinta", "cb-sw__dot cb-sw__dot--tinta", null],
        ["Oro", "cb-sw__dot cb-sw__dot--oro", null],
      ]);
      fireEvent.click(screen.getByRole("radio", { name: "2ª equipación" }));
      expect(screen.getByText("Negra de fuera, con la franja roja en diagonal.")).toBeTruthy();
      unmount();
    }
  });
  it("a saved kit: its note and its colours by hex; the other kit stays the code's", () => {
    render(<Equipo {...props} kits={readKits({ kits: { home: { note: "Celeste y blanca, la de siempre.", colors: [{ name: "Cielo", hex: "#8ac8f5" }, { name: "Nieve", hex: "#ffffff" }] } } })} />);
    expect(screen.getByText("Celeste y blanca, la de siempre.")).toBeTruthy();
    expect(swatches()).toEqual([
      ["Cielo", "cb-sw__dot", "background: rgb(138, 200, 245);"],
      ["Nieve", "cb-sw__dot", "background: rgb(255, 255, 255);"],
    ]);
    fireEvent.click(screen.getByRole("radio", { name: "2ª equipación" }));
    expect(screen.getByText("Negra de fuera, con la franja roja en diagonal.")).toBeTruthy();
  });
});
