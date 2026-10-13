import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { squadRow, type SquadPlayer } from "../../lib/squad";
import { FichaModal } from "./FichaModal";

// The public ficha (/plantilla): «Posición: Pivote» and, under it, «También mediocentro (MC) · central (DFC)». No WebGL: the 3D kit is a stub.

vi.mock("../../components/jersey3d/Jersey3D", () => ({ Jersey3D: () => null }));
vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children?: ReactNode }) => <a>{children}</a> }));

const none = { matchesPlayed: 0, goals: 0, assists: 0, minutes: 0, tracked: 0 };
const open = (p: SquadPlayer) =>
  render(<FichaModal row={squadRow(p, none, Date.UTC(2026, 8, 25))} seasonName="Temporada 1" withStats={false} kit="home" theme="dark" onClose={vi.fn()} onStep={vi.fn()} onCompare={vi.fn()} />);
const posicion = () => screen.getByText("Posición").nextElementSibling as HTMLElement;

describe("FichaModal · Posición", () => {
  it("la preferida y, debajo, «También …» con nombre y código", () => {
    open({ id: "erik", shirtName: "ERIK", number: 9, positions: { main: "MCD", also: ["MC", "DFC"] } });
    expect(posicion()).toHaveTextContent("Pivote");
    expect(posicion()).toHaveTextContent("También mediocentro (MC) · central (DFC)");
  });
  it("sin «también» no hay segunda línea", () => {
    open({ id: "erik", shirtName: "ERIK", number: 9, positions: { main: "MCD", also: [] } });
    expect(posicion()).toHaveTextContent(/^Pivote$/);
  });
});
