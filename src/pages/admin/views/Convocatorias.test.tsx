import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../../lib/clubApi";
import { adminFixture, mountAdmin, setAdminData } from "../../../test/adminKit";
import { Convocatorias } from "./Convocatorias";

vi.mock("../data/useAdminData", async () => ({ useAdminData: (await import("../../../test/adminMocks")).currentAdminData }));
vi.mock("../../../context/AuthContext", async () => ({ useAuth: (await import("../../../test/adminMocks")).fakeAuth }));
vi.mock("../../../lib/clubApi", () => ({
  apiError: (e: unknown) => (e instanceof Error ? e.message : String(e)),
  saveMatchSheet: vi.fn(() => Promise.resolve({ data: { id: "m8" } })),
}));
vi.mock("../partidos/live", () => ({
  useMatchNote: () => ({ data: "Quedada 11:15", loading: false }),
  useMatchRsvp: () => ({
    data: [
      { playerId: "evans", response: "yes" },
      { playerId: "erik", response: "yes" },
      { playerId: "andia", response: "maybe" },
    ],
    loading: false,
  }),
  useMatchMvp: () => undefined,
}));
const save = vi.mocked(api.saveMatchSheet);
/** The first saveMatchSheet payload. */
const call = () => {
  const a = save.mock.calls[0]?.[0];
  if (!a) throw new Error("saveMatchSheet no se llamó");
  return a;
};
const role = (name: string, r: "Titular" | "Suplente" | "No convocado") => within(screen.getByRole("group", { name: `Convocatoria de ${name} para la J3` })).getByRole("button", { name: r });

describe("Convocatorias", () => {
  beforeEach(() => {
    localStorage.clear();
    save.mockClear();
    setAdminData(adminFixture());
  });
  afterEach(() => vi.useRealTimers());

  it("shows the next match with its counters, RSVP and rows", async () => {
    mountAdmin("/admin/convocatorias", { convocatorias: Convocatorias });
    expect(await screen.findByRole("heading", { level: 1, name: "Convocatorias" })).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Partido" })).getByRole("button", { name: "J3 · MSK" })).toHaveAttribute("aria-pressed", "true");
    const counts = screen.getByRole("group", { name: "Recuento" });
    expect(within(counts).getByText("6 de 7 titulares")).toBeInTheDocument();
    expect(within(counts).getByText("3 sin asignar")).toHaveClass("warn");
    expect(within(counts).getByText(/MAD SKY · dom 8 nov · 12:00 · 2 vienen, 1 en duda, 0 no/)).toBeInTheDocument();
    const adrian = screen.getByRole("group", { name: "Convocatoria de ADRIÁN T.C. para la J3" }).closest("li")!;
    expect(adrian).toHaveClass("U");
    expect(adrian).toHaveTextContent("Delantero · sin respuesta · sin asignar");
    expect(screen.getByRole("group", { name: "Convocatoria de ANDIA para la J3" }).closest("li")).toHaveTextContent("en duda");
  });

  it("max seven titulares; Publicar y avisar asks for everyone first, then publishes behind «Deshacer»", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin/convocatorias", { convocatorias: Convocatorias });
    await screen.findByText("6 de 7 titulares");
    await user.click(screen.getByRole("button", { name: "Publicar y avisar" }));
    expect(screen.getByText("Faltan 3 jugadores por asignar: titular, suplente o no convocado.")).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
    await user.click(role("ADRIÁN T.C.", "Titular"));
    expect(screen.getByText("7 de 7 titulares")).toHaveClass("ok");
    await user.click(role("ANDIA", "Titular"));
    expect(screen.getByText("Ya hay siete titulares: pasa uno a suplente antes de subir a ANDIA.")).toBeInTheDocument();
    await user.click(role("ANDIA", "Suplente"));
    await user.click(role("FER", "No convocado"));
    expect(screen.getByText("0 sin asignar")).toHaveClass("ok");
    await user.click(screen.getByRole("button", { name: "Publicar y avisar" }));
    expect(screen.getByText("Convocatoria de la J3 actualizada · el aviso ya había salido.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publicada y avisada" })).toHaveAttribute("aria-disabled", "true");
    // undo: nothing is written
    await user.click(screen.getByRole("button", { name: "Deshacer" }));
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Publicar y avisar" })).toBeInTheDocument();
    // again, and let it go
    await user.click(screen.getByRole("button", { name: "Publicar y avisar" }));
    await act(async () => {
      vi.advanceTimersByTime(5100);
    });
    expect(save).toHaveBeenCalledTimes(1);
    const arg = call();
    expect(arg).toMatchObject({ id: "m8", draft: false });
    expect(arg.sheet.starters).toContain("adrian");
    expect(arg.sheet.bench).toContain("andia");
    expect(arg.sheet.notCalled).toEqual(expect.arrayContaining(["brawan", "fer"]));
    expect(arg.sheet).toMatchObject({ rival: "MAD SKY", status: "scheduled", meetingNote: "Quedada 11:15" });
  });

  it("copies the previous convocatoria (with undo) and saves a draft", async () => {
    const user = userEvent.setup();
    mountAdmin("/admin/convocatorias", { convocatorias: Convocatorias });
    await user.click(await screen.findByRole("button", { name: "Copiar la convocatoria de la J2" }));
    expect(screen.getByText("7 de 7 titulares")).toBeInTheDocument();
    expect(screen.getByText("0 sin asignar")).toBeInTheDocument();
    expect(screen.getByText("Convocatoria de la J2 copiada.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(screen.getByText("6 de 7 titulares")).toBeInTheDocument();
    await user.click(role("ADRIÁN T.C.", "Titular"));
    await user.click(screen.getByRole("button", { name: "Guardar borrador" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(call()).toMatchObject({ id: "m8", draft: true });
    expect(await screen.findByText("Convocatoria de la J3 guardada en borrador · solo la ven los capitanes.")).toBeInTheDocument();
  });

  it("switching match with unsaved changes asks first", async () => {
    const user = userEvent.setup();
    const router = mountAdmin("/admin/convocatorias?j=m7", { convocatorias: Convocatorias });
    expect(await screen.findByRole("button", { name: "J2 · FU7" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("group", { name: "Convocatoria de KEVIN para la J2" }).querySelector<HTMLButtonElement>("button[aria-label='No convocado']")!);
    await user.click(screen.getByRole("button", { name: "J3 · MSK" }));
    const guard = await screen.findByRole("alertdialog", { name: "¿Salir sin guardar?" });
    expect(within(guard).getByText(/la convocatoria de la J2/)).toBeInTheDocument();
    await user.click(within(guard).getByRole("button", { name: "Descartar cambios" }));
    await waitFor(() => expect(router.state.location.search).toMatchObject({ j: "m8" }));
  });

  it("says when there is nothing to call up", async () => {
    setAdminData(adminFixture({ matches: adminFixture().matches.filter((m) => m.id === "m6") }));
    mountAdmin("/admin/convocatorias", { convocatorias: Convocatorias });
    expect(await screen.findByText("No hay partidos por jugar")).toBeInTheDocument();
  });
});
