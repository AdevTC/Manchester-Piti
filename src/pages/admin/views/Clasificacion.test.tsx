import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Standings } from "../../../lib/standings";
import { adminFixture } from "../../../test/adminKit";

// The editor alone: the sala's data, the toast and the table's listener and save are stubbed.
const h = vi.hoisted(() => ({
  standings: null as Standings | null,
  save: vi.fn((..._args: unknown[]) => Promise.resolve()),
}));
const data = adminFixture();
vi.mock("../shell/context", () => ({ useAdmin: () => data }));
vi.mock("../ui/toastContext", () => ({ useToast: () => ({ show: vi.fn() }) }));
vi.mock("../data/useClasificacion", () => ({
  useStandings: () => ({ standings: h.standings, loading: false }),
  useClasificacionWrites: () => ({ save: h.save }),
}));
const { Clasificacion } = await import("./Clasificacion");

const row = (team: string, pj: number, isUs = false) => ({ team, pj, g: pj, e: 0, p: 0, gf: pj, gc: 0, pts: 3 * pj, isUs });
const table = (): Standings => ({
  id: "t1",
  competition: "Liga F7",
  jornada: 7,
  updatedAt: 0,
  updatedBy: "u",
  rows: [row("Rayo Norte", 7), row("Manchester Piti", 7, true), row("Atlético Demo", 7)],
});

describe("Clasificación (admin)", () => {
  beforeEach(() => {
    h.standings = table();
    h.save.mockClear();
  });

  it("«Subir» and «Bajar»: focus follows the moved team (to its other button at the top) and a live region says where it is", async () => {
    const user = userEvent.setup();
    render(<Clasificacion />);
    await user.click(screen.getByRole("button", { name: "Subir Atlético Demo" }));
    expect(screen.getByRole("button", { name: "Subir Atlético Demo" })).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("Atlético Demo, ahora 2.º");
    await user.keyboard("{Enter}");
    // (at the top «Subir» is off: focus moves to its «Bajar»)
    expect(screen.getByRole("button", { name: "Subir Atlético Demo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Bajar Atlético Demo" })).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("Atlético Demo, ahora 1.º");
    expect(screen.getAllByRole("textbox", { name: /^Equipo, puesto/ }).map((i) => (i as HTMLInputElement).value)).toEqual(["Atlético Demo", "Rayo Norte", "Manchester Piti"]);
  });

  it("a paste lists the lines it could not read, and without «Jornada N» takes the most matches played", async () => {
    const user = userEvent.setup();
    render(<Clasificacion />);
    await user.click(screen.getByRole("button", { name: "Pegar desde la liga" }));
    await user.click(screen.getByRole("textbox", { name: "La tabla copiada" }));
    await user.paste("Pos\tEquipo\tPJ\tG\tE\tP\tGF\tGC\tPts\n1\tRayo Norte\t8\t6\t1\t1\t25\t8\t19\n2\tManchester Piti\t8\t5\t3\t0\t20\t9\t18\n3\tLos Rojos\t8\t2\n4\tAzules\t7\t2\t2\t3\t10\t15\t8");
    await user.click(screen.getByRole("button", { name: "Leer la tabla" }));
    expect(screen.getByText(/^3 equipos leídos · jornada 8/)).toBeInTheDocument();
    const unread = screen.getByRole("note", { name: "Líneas sin leer" });
    expect(unread).toHaveTextContent("Esta línea no se ha leído:");
    expect(within(unread).getByRole("listitem")).toHaveTextContent("3 · Los Rojos · 8 · 2");
    await user.click(screen.getByRole("button", { name: "Usar esta tabla" }));
    expect(screen.getByRole("textbox", { name: "Jornada" })).toHaveValue("8");
  });

  it("a jornada the captain typed wins over the paste's", async () => {
    const user = userEvent.setup();
    render(<Clasificacion />);
    const jornada = screen.getByRole("textbox", { name: "Jornada" });
    await user.clear(jornada);
    await user.type(jornada, "9");
    await user.click(screen.getByRole("button", { name: "Pegar desde la liga" }));
    await user.click(screen.getByRole("textbox", { name: "La tabla copiada" }));
    await user.paste("Jornada 8\nRayo Norte\t8\t6\t1\t1\t25\t8\t19\nManchester Piti\t8\t5\t3\t0\t20\t9\t18");
    await user.click(screen.getByRole("button", { name: "Leer la tabla" }));
    await user.click(screen.getByRole("button", { name: "Usar esta tabla" }));
    expect(screen.getByRole("textbox", { name: "Jornada" })).toHaveValue("9");
  });
});
