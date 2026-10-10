import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adminFixture, fixturePublished, mountAdmin, setAdminData } from "../../../test/adminKit";
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
vi.mock("../club/clubLive", () => ({
  useArchivedCounts: () => ({ t0: { matches: 18, players: 9 } }),
  // The J1 (Emirates, 4–1): ERIK was the MVP.
  useMvpTally: () => new Map([["m6", { id: "m6", counts: { erik: 5, adrian: 2 }, total: 7 }]]),
}));

const vitrina = () => screen.getByRole("region", { name: /^Temporada/ });
const card = (name: string) => screen.getByRole("article", { name });

describe("Temporadas", () => {
  beforeEach(() => {
    localStorage.clear();
    Object.values(h.writes).forEach((f) => f.mockClear());
    setAdminData(adminFixture());
  });
  afterEach(() => vi.useRealTimers());

  it("shows the season in course as the vitrina, from the published actas only", async () => {
    mountAdmin("/admin/temporadas", { temporadas: Temporadas });
    expect(await screen.findByRole("heading", { level: 1, name: "Temporadas" })).toBeInTheDocument();
    const v = vitrina();
    expect(within(v).getByRole("heading", { name: "Temporada 1" })).toBeInTheDocument();
    expect(v).toHaveTextContent("● Activa · se ve en la web");
    // J1 published (4–1), J2 played but not published, J3 to play
    expect(v).toHaveTextContent(/Victorias\s*1/);
    expect(v).toHaveTextContent(/Empates\s*0/);
    expect(v).toHaveTextContent(/Derrotas\s*0/);
    expect(within(v).getByLabelText("4 a favor, 1 en contra")).toBeInTheDocument();
    expect(v).toHaveTextContent("La balda · jornadas 1 de 3");
    const shelf = within(within(v).getByRole("list", { name: "La balda" })).getAllByRole("listitem");
    expect(shelf.map((s) => s.getAttribute("aria-label"))).toEqual(["J1 · Victoria 4–1 a Emirates", "J2 · sin publicar", "J3 · por jugar"]);
    expect(shelf.map((s) => s.className)).toEqual(["ved V", "ved o", "ved o"]);
    expect(v).toHaveTextContent("Mayor victoria4–1a Emirates · J1");
    expect(v).toHaveTextContent("Mejor racha1 victoria");
    expect(v).toHaveTextContent("Más veces MVPERIK1 jornada");
    expect(v).toHaveTextContent("Pichichi—Todavía sin goles");
    expect(v).toHaveTextContent("Cuentan las actas publicadas · la J2 entra al publicarla");
    expect(within(v).getByRole("button", { name: "Cambiar el capitán de la Temporada 1 (ahora: ADRIÁN T.C.)" })).toHaveTextContent("12 en la plantilla");
    expect(within(v).queryByRole("button", { name: /Eliminar/ })).toBeNull();

    const t0 = card("Temporada 0 · pre-Piti");
    expect(t0).toHaveClass("arch", "isA");
    expect(t0).toHaveTextContent("Archivada · oculta");
    expect(t0).toHaveTextContent("18 jornadas");
    expect(t0).toHaveTextContent("9 jugadores");
    expect(within(t0).getByRole("button", { name: "Desarchivar «Temporada 0 · pre-Piti»" })).toBeInTheDocument();
    expect(within(t0).getByRole("button", { name: "Eliminar «Temporada 0 · pre-Piti»" })).toBeInTheDocument();
  });

  it("names the Pichichi with his shirt and his goals", async () => {
    const published = fixturePublished.map((m) =>
      m.id === "m6"
        ? {
            ...m,
            events: [
              { id: "e1", type: "goal" as const, minute: 3, playerId: "erik" },
              { id: "e2", type: "goal_penalty" as const, minute: 20, playerId: "erik" },
              { id: "e3", type: "goal" as const, minute: 30, playerId: "kevin" },
              { id: "e4", type: "opponent_own_goal" as const, minute: 40 },
            ],
          }
        : m,
    );
    setAdminData(adminFixture({ published }));
    mountAdmin("/admin/temporadas", { temporadas: Temporadas });
    const v = await screen.findByRole("region", { name: "Temporada 1" });
    expect(v).toHaveTextContent("PichichiERIK2 goles");
    expect(v.querySelector(".pich .sh b")).toHaveTextContent("9");
  });

  it("renames inline (checked live) behind a lower third with «Deshacer»", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin/temporadas", { temporadas: Temporadas });
    await user.click(await screen.findByRole("button", { name: "Renombrar «Temporada 1»" }));
    const input = within(vitrina()).getByRole("textbox", { name: "Nombre de la temporada" });
    await waitFor(() => expect(input).toHaveFocus());
    await user.clear(input);
    await user.type(input, "Te");
    expect(within(vitrina()).getByText("Mínimo 3 letras.")).toBeInTheDocument();
    expect(within(vitrina()).getByRole("button", { name: "Guardar" })).toHaveAttribute("aria-disabled", "true");
    await user.type(input, "mporada 0 · pre-Piti");
    expect(within(vitrina()).getByText("Ya hay una temporada con ese nombre.")).toBeInTheDocument();
    await user.clear(input);
    await user.type(input, "Temporada Uno{Enter}");
    expect(screen.getByText("Ahora se llama «Temporada Uno»")).toBeInTheDocument();
    expect(screen.getByText("T1")).toBeInTheDocument();
    expect(within(vitrina()).getByRole("heading", { name: "Temporada Uno" })).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(5300);
    });
    expect(h.writes.saveSeason).toHaveBeenCalledWith("t1", { name: "Temporada Uno" });
  });

  it("archives with its consequences; «Deshacer» keeps it as it was", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin/temporadas", { temporadas: Temporadas });
    await user.click(await screen.findByRole("button", { name: "Archivar «Temporada 1»" }));
    const ask = screen.getByRole("dialog", { name: "¿Archivar Temporada 1?" });
    expect(ask).toHaveTextContent("Sus 3 partidos y las estadísticas de 12 jugadores se ocultan en la web");
    expect(ask).toHaveTextContent("12 jugadores que solo juegan esta temporada salen también de la plantilla de aquí");
    expect(ask).toHaveTextContent("Es la temporada en curso: la web se queda sin temporada activa");
    expect(ask).toHaveTextContent("Las actas y la plantilla no se pierden");
    await user.click(within(ask).getByRole("button", { name: "Archivar" }));
    expect(screen.getByText("Temporada 1 archivada · oculta en la web")).toBeInTheDocument();
    expect(vitrina()).toHaveTextContent("Archivada · oculta en la web");
    expect(within(vitrina()).getByRole("button", { name: "Desarchivar «Temporada 1»" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(vitrina()).toHaveTextContent("● Activa · se ve en la web");
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
    const ask = screen.getByRole("dialog", { name: "¿Desarchivar Temporada 0 · pre-Piti?" });
    expect(ask).toHaveTextContent("Sus 18 partidos y las estadísticas de 9 jugadores vuelven a verse en la web");
    expect(ask).toHaveTextContent("La Temporada 1 sigue siendo la temporada en curso");
    await user.click(within(ask).getByRole("button", { name: "Desarchivar" }));
    expect(screen.getByText("Temporada 0 · pre-Piti visible otra vez")).toBeInTheDocument();
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
    let ask = screen.getByRole("alertdialog", { name: "¿Eliminar Temporada 0 · pre-Piti para siempre?" });
    expect(ask).toHaveTextContent("Sus 18 partidos se quedan sin temporada: no se borran, pero ya no salen en ninguna");
    expect(ask).toHaveTextContent("No se puede deshacer");
    await user.click(within(ask).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Eliminar «Temporada 0 · pre-Piti»" }));
    ask = screen.getByRole("alertdialog");
    await user.click(within(ask).getByRole("button", { name: "Eliminar temporada" }));
    expect(await within(ask).findByRole("alert")).toHaveTextContent("No se ha podido eliminar: permiso denegado");
    await user.click(within(ask).getByRole("button", { name: "Eliminar temporada" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(h.writes.deleteSeason).toHaveBeenLastCalledWith("t0");
    expect(screen.getByText("Temporada 0 · pre-Piti eliminada")).toBeInTheDocument();
  });

  it("creates a season in preparation, copying the plantilla with its dorsals (or empty)", async () => {
    const user = userEvent.setup();
    mountAdmin("/admin/temporadas", { temporadas: Temporadas });
    await user.click(await screen.findByRole("button", { name: /Nueva temporada/ }));
    const modal = screen.getByRole("dialog", { name: "Nueva temporada" });
    const name = within(modal).getByRole("textbox", { name: "Nombre" });
    expect(name).toHaveValue("Temporada 2");
    await user.clear(name);
    expect(within(modal).getByText("Mínimo 3 letras.")).toBeInTheDocument();
    expect(within(modal).getByRole("button", { name: "Crear temporada" })).toHaveAttribute("aria-disabled", "true");
    await user.type(name, "Temporada 2");
    expect(within(modal).getByRole("group", { name: "¿Copiar la plantilla de la Temporada 1?" })).toBeInTheDocument();
    expect(within(modal).getByRole("button", { name: "Sí, con sus dorsales" })).toHaveAttribute("aria-pressed", "true");
    expect(modal).toHaveTextContent("12 jugadores de la Temporada 1 entran con su nombre en camiseta y su dorsal");
    await user.click(within(modal).getByRole("button", { name: "No, empieza vacía" }));
    expect(modal).not.toHaveTextContent("entran con su nombre");
    await user.click(within(modal).getByRole("button", { name: "Sí, con sus dorsales" }));
    await user.click(within(modal).getByRole("button", { name: "Crear temporada" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(h.writes.createSeason).toHaveBeenCalledTimes(1);
    const [n, copy] = h.writes.createSeason.mock.calls[0];
    expect(n).toBe("Temporada 2");
    expect(copy).toHaveLength(12);
    expect(copy[0]).toEqual({ id: "evans", shirtName: "EVANS", number: 1 });
    expect(screen.getByText("Temporada 2 creada en preparación · plantilla copiada (12 jugadores)")).toBeInTheDocument();
  });

  it("changes the season's captain behind a lower third with «Deshacer»", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin/temporadas", { temporadas: Temporadas });
    await user.click(await screen.findByRole("button", { name: "Cambiar el capitán de la Temporada 1 (ahora: ADRIÁN T.C.)" }));
    const modal = screen.getByRole("dialog", { name: "Capitán de la Temporada 1" });
    expect(within(modal).getByRole("button", { name: "Guardar capitán" })).toHaveAttribute("aria-disabled", "true");
    await user.selectOptions(within(modal).getByRole("combobox", { name: "Capitán" }), "erik");
    await user.click(within(modal).getByRole("button", { name: "Guardar capitán" }));
    expect(screen.getByText("Capitán de la Temporada 1: ERIK")).toBeInTheDocument();
    expect(within(vitrina()).getByRole("button", { name: /ahora: ERIK/ })).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(5300);
    });
    expect(h.writes.saveSeason).toHaveBeenCalledWith("t1", { captainPlayerId: "erik" });
  });

  it("without a season in course: the empty vitrina and the way to create one", async () => {
    setAdminData(adminFixture({ season: null }));
    mountAdmin("/admin/temporadas", { temporadas: Temporadas });
    expect(await screen.findByRole("heading", { name: "Ninguna temporada en curso" })).toBeInTheDocument();
    expect(card("Temporada 1")).toHaveTextContent("En preparación");
    expect(within(card("Temporada 1")).getByRole("button", { name: "Archivar «Temporada 1»" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Nueva temporada/ })).toBeInTheDocument();
  });
});
