import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adminFixture, mountAdmin, setAdminData } from "../../../test/adminKit";
import { Temporadas } from "./Temporadas";

const h = vi.hoisted(() => ({
  writes: {
    saveSeason: vi.fn((id: string, data: Record<string, unknown>) => Promise.resolve(void [id, data])),
    deleteSeason: vi.fn((id: string) => Promise.resolve(void id)),
    createSeason: vi.fn((name: string, copy: readonly unknown[]) => Promise.resolve(`new-${name}-${copy.length}`)),
    setArchived: vi.fn((id: string, archived: boolean) => Promise.resolve(void [id, archived])),
  },
}));
vi.mock("../data/useAdminData", async () => ({ useAdminData: (await import("../../../test/adminMocks")).currentAdminData }));
vi.mock("../../../context/AuthContext", async () => ({ useAuth: (await import("../../../test/adminMocks")).fakeAuth }));
vi.mock("../../../lib/clubApi", () => ({ apiError: (e: unknown) => String(e) }));
vi.mock("../club/useClubWrites", () => ({ useClubWrites: () => h.writes }));
vi.mock("../club/clubLive", () => ({ useArchivedCounts: () => ({ t0: { matches: 18, players: 9 } }) }));

const card = (name: string) => screen.getByRole("article", { name });

describe("Temporadas", () => {
  beforeEach(() => {
    localStorage.clear();
    Object.values(h.writes).forEach((f) => f.mockClear());
    setAdminData(adminFixture());
  });
  afterEach(() => vi.useRealTimers());

  it("shows one card per season with its state and numbers", async () => {
    mountAdmin("/admin/temporadas", { temporadas: Temporadas });
    expect(await screen.findByRole("heading", { level: 1, name: "Temporadas" })).toBeInTheDocument();
    const t1 = card("Temporada 1");
    expect(within(t1).getByText("Activa")).toBeInTheDocument();
    expect(within(t1).getByText("1 de 3")).toBeInTheDocument();
    expect(within(t1).getByText("12")).toBeInTheDocument();
    expect(within(t1).getByText("1 jugado")).toBeInTheDocument();
    expect(within(t1).getByRole("button", { name: "Cambiar el capitán de la Temporada 1 (ahora: ADRIÁN T.C.)" })).toBeInTheDocument();
    expect(within(t1).queryByRole("button", { name: /Eliminar/ })).toBeNull();
    const t0 = card("Temporada 0 · pre-Piti");
    expect(t0).toHaveClass("arch");
    expect(within(t0).getByText("Archivada")).toBeInTheDocument();
    expect(within(t0).getByText("18 de 18")).toBeInTheDocument();
    expect(within(t0).getByText("18 partidos")).toBeInTheDocument();
    expect(within(t0).getByRole("button", { name: "Eliminar «Temporada 0 · pre-Piti»" })).toBeInTheDocument();
  });

  it("renames inline (checked live) behind an undo toast", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin/temporadas", { temporadas: Temporadas });
    await user.click(await screen.findByRole("button", { name: "Renombrar «Temporada 1»" }));
    const input = within(card("Temporada 1")).getByRole("textbox", { name: /Nuevo nombre/ });
    await waitFor(() => expect(input).toHaveFocus());
    await user.clear(input);
    await user.type(input, "Te");
    expect(within(card("Temporada 1")).getByText("Mínimo 3 letras.")).toBeInTheDocument();
    await user.type(input, "mporada 0 · pre-Piti");
    expect(within(card("Temporada 1")).getByText("Ya hay una temporada con ese nombre.")).toBeInTheDocument();
    await user.clear(input);
    await user.type(input, "Temporada Uno{Enter}");
    expect(screen.getByText("Renombrada: «Temporada Uno».")).toBeInTheDocument();
    expect(card("Temporada Uno")).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(5300);
    });
    expect(h.writes.saveSeason).toHaveBeenCalledWith("t1", { name: "Temporada Uno" });
  });

  it("archives with its consequences; Deshacer keeps it as it was", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin/temporadas", { temporadas: Temporadas });
    await user.click(await screen.findByRole("button", { name: "Archivar «Temporada 1»" }));
    const ask = screen.getByRole("dialog", { name: "¿Archivar «Temporada 1»?" });
    expect(ask).toHaveTextContent("Sus 3 partidos y las estadísticas de 12 jugadores dejan de salir en la web");
    expect(ask).toHaveTextContent("12 jugadores que solo juegan esa temporada dejan de salir también aquí, en la plantilla");
    expect(ask).toHaveTextContent("Es la temporada activa: la web se quedará sin temporada en curso");
    await user.click(within(ask).getByRole("button", { name: "Archivar" }));
    expect(screen.getByText("«Temporada 1» archivada · oculta en la web.")).toBeInTheDocument();
    expect(within(card("Temporada 1")).getByText("Archivada")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(within(card("Temporada 1")).getByText("Activa")).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    expect(h.writes.setArchived).not.toHaveBeenCalled();
  });

  it("unarchives through the callable after the undo window", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin/temporadas", { temporadas: Temporadas });
    await user.click(await screen.findByRole("button", { name: "Desarchivar «Temporada 0 · pre-Piti»" }));
    const ask = screen.getByRole("dialog", { name: "¿Desarchivar «Temporada 0 · pre-Piti»?" });
    expect(ask).toHaveTextContent("18 partidos y las estadísticas de 9 jugadores vuelven a ser públicos");
    expect(ask).toHaveTextContent("La Temporada 1 sigue siendo la activa");
    await user.click(within(ask).getByRole("button", { name: "Desarchivar" }));
    await act(async () => {
      vi.advanceTimersByTime(5300);
    });
    expect(h.writes.setArchived).toHaveBeenCalledWith("t0", false);
  });

  it("deletes only an archived season, after a red confirmation, and reports a failure in the modal", async () => {
    const user = userEvent.setup();
    h.writes.deleteSeason.mockImplementationOnce(() => Promise.reject(new Error("permiso denegado")));
    mountAdmin("/admin/temporadas", { temporadas: Temporadas });
    await user.click(await screen.findByRole("button", { name: "Eliminar «Temporada 0 · pre-Piti»" }));
    let ask = screen.getByRole("alertdialog", { name: "¿Eliminar «Temporada 0 · pre-Piti»?" });
    expect(ask).toHaveTextContent("Temporadas · no se puede deshacer");
    expect(ask).toHaveTextContent("Sus 18 partidos se quedan sin temporada: no se borran, pero ya no salen en ninguna");
    await user.click(within(ask).getByRole("button", { name: "Mejor no" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Eliminar «Temporada 0 · pre-Piti»" }));
    ask = screen.getByRole("alertdialog");
    await user.click(within(ask).getByRole("button", { name: "Eliminar para siempre" }));
    expect(await within(ask).findByRole("alert")).toHaveTextContent("No se ha podido eliminar: permiso denegado");
    await user.click(within(ask).getByRole("button", { name: "Eliminar para siempre" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(h.writes.deleteSeason).toHaveBeenLastCalledWith("t0");
    expect(screen.getByText("«Temporada 0 · pre-Piti» eliminada.")).toBeInTheDocument();
  });

  it("creates a season, optionally with the previous season's plantilla", async () => {
    const user = userEvent.setup();
    mountAdmin("/admin/temporadas", { temporadas: Temporadas });
    await user.click((await screen.findAllByRole("button", { name: /Nueva temporada/ }))[0]);
    const modal = screen.getByRole("dialog", { name: "Nueva temporada" });
    const name = within(modal).getByRole("textbox", { name: /Nombre/ });
    expect(name).toHaveValue("Temporada 2");
    await user.clear(name);
    expect(within(modal).getByText("Mínimo 3 letras.")).toBeInTheDocument();
    expect(within(modal).getByRole("button", { name: "Crear temporada" })).toHaveAttribute("aria-disabled", "true");
    await user.type(name, "Temporada 2");
    await user.click(within(modal).getByRole("button", { name: "Copiar la plantilla de una temporada anterior" }));
    expect(modal).toHaveTextContent("12 jugadores de la Temporada 1 entran con su nombre en camiseta y su dorsal");
    await user.click(within(modal).getByRole("button", { name: "Crear temporada" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(h.writes.createSeason).toHaveBeenCalledTimes(1);
    const [n, copy] = h.writes.createSeason.mock.calls[0];
    expect(n).toBe("Temporada 2");
    expect(copy).toHaveLength(12);
    expect(copy[0]).toEqual({ id: "evans", shirtName: "EVANS", number: 1 });
    expect(screen.getByText("«Temporada 2» creada · en preparación con 12 jugadores.")).toBeInTheDocument();
  });

  it("changes the season's captain behind an undo toast", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin/temporadas", { temporadas: Temporadas });
    await user.click(await screen.findByRole("button", { name: "Cambiar el capitán de la Temporada 1 (ahora: ADRIÁN T.C.)" }));
    const modal = screen.getByRole("dialog", { name: "Capitán de la Temporada 1" });
    expect(within(modal).getByRole("button", { name: "Guardar capitán" })).toHaveAttribute("aria-disabled", "true");
    await user.selectOptions(within(modal).getByRole("combobox", { name: "Capitán" }), "erik");
    await user.click(within(modal).getByRole("button", { name: "Guardar capitán" }));
    expect(screen.getByText("Capitán de la Temporada 1: ERIK.")).toBeInTheDocument();
    expect(within(card("Temporada 1")).getByRole("button", { name: /ahora: ERIK/ })).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(5300);
    });
    expect(h.writes.saveSeason).toHaveBeenCalledWith("t1", { captainPlayerId: "erik" });
  });
});
