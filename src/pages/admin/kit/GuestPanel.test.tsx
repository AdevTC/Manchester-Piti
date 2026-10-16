import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { addGuest, guestInUse, removeGuest, type MatchGuest } from "../acta/guests";
import { GuestPanel } from "./GuestPanel";

function Harness({ used = false }: { used?: boolean }) {
  const [x, setX] = useState<{ starters: string[]; bench: string[]; guests?: MatchGuest[] }>({ starters: [], bench: [] });
  const events = used ? [{ id: "e", type: "goal" as const, minute: 3, playerId: "guest:g1" }] : [];
  return (
    <>
      <GuestPanel
        guests={x.guests ?? []}
        inUse={(id) => guestInUse(events, id)}
        onAdd={(name) => {
          const r = addGuest(x, name);
          if (!r.ok) return r.error;
          setX(r.value);
          return "";
        }}
        onRemove={(id) => {
          const r = removeGuest(x, id);
          if (r.ok) setX(r.value);
        }}
      />
      <output>{x.bench.join(",")}</output>
    </>
  );
}

const add = (name: string) => {
  fireEvent.change(screen.getByLabelText("Nombre del invitado"), { target: { value: name } });
  fireEvent.click(screen.getByRole("button", { name: "Añadir invitado" }));
};

describe("GuestPanel", () => {
  it("adds a guest as a chip with the word «Invitado», on the banquillo, and removes him", () => {
    render(<Harness />);
    add("Rafa");
    expect(screen.getByText("Rafa")).toBeInTheDocument();
    expect(document.querySelector(".gst-chip small")).toHaveTextContent(/^Invitado$/);
    expect(screen.getByText("INV")).toBeInTheDocument();
    expect(document.querySelector("output")?.textContent).toBe("guest:g1");
    expect(screen.getByLabelText("Nombre del invitado")).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "Quitar al invitado Rafa" }));
    expect(screen.queryByText("Rafa")).toBeNull();
    expect(document.querySelector("output")?.textContent).toBe("");
  });

  it("says why a name is refused, and stops at four", () => {
    render(<Harness />);
    add("");
    expect(screen.getByRole("alert")).toHaveTextContent("Escribe el nombre del invitado.");
    for (const n of ["A", "B", "C", "D"]) add(n);
    expect(screen.queryByRole("button", { name: "Añadir invitado" })).toBeNull();
    expect(screen.getByText("Ya hay 4 invitados: es el máximo por partido.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Nombre del invitado")).toBeNull();
  });

  it("can't remove a guest an event names", () => {
    render(<Harness used />);
    add("Rafa");
    expect(screen.getByRole("button", { name: "No se puede quitar a Rafa: sale en el acta" })).toBeDisabled();
    expect(screen.getByText(/sale en el acta/)).toBeInTheDocument();
  });
});
