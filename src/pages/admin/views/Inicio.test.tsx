import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../../lib/clubApi";
import { adminFixture, mountAdmin, setAdminData } from "../../../test/adminKit";
import { Inicio } from "./Inicio";

vi.mock("../data/useAdminData", async () => ({ useAdminData: (await import("../../../test/adminMocks")).currentAdminData }));
vi.mock("../../../context/AuthContext", async () => ({ useAuth: (await import("../../../test/adminMocks")).fakeAuth }));
vi.mock("../../../lib/clubApi", () => ({
  apiError: (e: unknown) => String(e),
  resolvePlayerClaim: vi.fn(() => Promise.resolve({ data: { ok: true } })),
}));
const resolve = vi.mocked(api.resolvePlayerClaim);

describe("Inicio · Centro de mando", () => {
  beforeEach(() => {
    localStorage.clear();
    resolve.mockClear();
    setAdminData(adminFixture());
  });
  afterEach(() => vi.useRealTimers());

  it("lists what is to do, the jornada and the tiles from the club's data", async () => {
    mountAdmin("/admin", { inicio: Inicio });
    expect(await screen.findByRole("heading", { level: 1, name: "Centro de mando" })).toBeInTheDocument();
    expect(screen.getByText(/Lunes 2 nov · Temporada 1 · 4 cosas por hacer/)).toBeInTheDocument();
    const todo = screen.getByRole("region", { name: "Por hacer" });
    expect(within(todo).getByText("4 de 4 pendientes")).toBeInTheDocument();
    expect(within(todo).getAllByRole("listitem").map((li) => li.querySelector("b")?.textContent)).toEqual([
      "Acta J2 · falta el goleador del gol 3",
      "Convocatoria J3 · 3 sin asignar",
      "2 fichas pendientes",
      "Contenido · 2 cosas por completar",
    ]);
    const jornada = screen.getByRole("region", { name: "Jornada" });
    expect(within(jornada).getByText("Última · J2 · dom 1 nov · en casa")).toBeInTheDocument();
    expect(within(jornada).getByText("3–1")).toBeInTheDocument();
    expect(within(jornada).getByText("No cuadra todavía")).toBeInTheDocument();
    expect(within(jornada).getByText("Borrador guardado a las 13:04")).toBeInTheDocument();
    expect(within(jornada).getByRole("list", { name: "Pasos del acta" }).children[2]).toHaveAttribute("aria-label", "Acta: falta 1");
    expect(within(jornada).getByText("Siguiente · J3 · dom 8 nov · 12:00 · fuera")).toBeInTheDocument();
    expect(within(jornada).getByText("9 vienen")).toBeInTheDocument();
    expect(within(jornada).getByText("3 sin asignar en la convocatoria")).toBeInTheDocument();
    expect(within(jornada).getByText("2ª equipación · Quedada 11:15")).toBeInTheDocument();
    expect(within(jornada).getByText(/J1: ganó ERIK con 9 votos/)).toBeInTheDocument();
    const tiles = within(document.querySelector<HTMLElement>(".tiles")!);
    const plantilla = tiles.getByRole("button", { name: /^Plantilla/ });
    expect(plantilla.querySelector(".big")).toHaveTextContent("12");
    expect(plantilla).toHaveTextContent("2 porteros · 1 lesionado · dorsales únicos");
    expect(tiles.getByRole("button", { name: /^Temporadas/ })).toHaveTextContent("T1Activa · 1 de 3 jornadas · 1 archivada");
    expect(tiles.getByRole("link", { name: /La puerta/ })).toHaveAttribute("href", "/vestuario#puerta");
  });

  it("each action opens its place", async () => {
    const user = userEvent.setup();
    const router = mountAdmin("/admin", { inicio: Inicio });
    await user.click(await screen.findByRole("button", { name: "Abrir acta: Acta J2 · falta el goleador del gol 3" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/partidos/m7"));
    expect(router.state.location.search).toMatchObject({ tab: "acta" });
  });

  it("items tick themselves when done", async () => {
    setAdminData(adminFixture({ claimsCount: 0 }));
    mountAdmin("/admin", { inicio: Inicio });
    const todo = await screen.findByRole("region", { name: "Por hacer" });
    const done = within(todo).getAllByRole("listitem").filter((li) => li.classList.contains("done"));
    expect(done.map((li) => li.querySelector("b")?.textContent)).toEqual(["Hecho: Fichas al día"]);
    expect(within(todo).getByText("3 de 4 pendientes")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Fichas" })).getByText("Fichas al día")).toBeInTheDocument();
  });

  it("approves a ficha inline behind an undo toast; the write waits for the undo window", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin", { inicio: Inicio });
    const fichas = await screen.findByRole("region", { name: "Fichas" });
    await user.click(within(fichas).getByRole("button", { name: "Aprobar: @nuevo.socio es KEVIN" }));
    expect(within(fichas).queryByText("@nuevo.socio")).toBeNull();
    expect(screen.getByText("Ficha aprobada · @nuevo.socio ya es KEVIN (11).")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(within(fichas).getByText("@nuevo.socio")).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    expect(resolve).not.toHaveBeenCalled();
    await user.click(within(fichas).getByRole("button", { name: "Rechazar la petición de @fer.portero12" }));
    expect(screen.getByText("Petición de @fer.portero12 rechazada · puede volver a pedirla.")).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(5100);
    });
    expect(resolve).toHaveBeenCalledWith({ uid: "u2", approve: false });
  });

  it("shows loading and error states", async () => {
    setAdminData(adminFixture({ loading: true }));
    mountAdmin("/admin", { inicio: Inicio });
    expect(await screen.findByRole("status", { name: "Cargando el centro de mando…" })).toBeInTheDocument();
  });

  it("says when the data could not be read", async () => {
    setAdminData(adminFixture({ error: true }));
    mountAdmin("/admin", { inicio: Inicio });
    const alert = (await screen.findByText("No se han podido cargar los datos")).closest<HTMLElement>("[role=alert]")!;
    expect(alert).toHaveClass("empty");
    expect(within(alert).getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });
});
