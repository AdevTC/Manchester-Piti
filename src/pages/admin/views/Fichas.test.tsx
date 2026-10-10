import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NOW, adminFixture, mountAdmin, setAdminData } from "../../../test/adminKit";
import type { ClaimLogRow } from "../club/clubLive";
import { Fichas } from "./Fichas";

const h = vi.hoisted(() => ({
  log: [] as ClaimLogRow[],
  writes: { resolveClaim: vi.fn((uid: string, approve: boolean) => Promise.resolve(void [uid, approve])) },
}));
vi.mock("../data/useAdminData", async () => ({ useAdminData: (await import("../../../test/adminMocks")).currentAdminData }));
vi.mock("../../../context/AuthContext", async () => ({ useAuth: (await import("../../../test/adminMocks")).fakeAuth }));
vi.mock("../../../lib/clubApi", () => ({ apiError: (e: unknown) => String(e) }));
vi.mock("../club/useClubWrites", () => ({ useClubWrites: () => h.writes }));
vi.mock("../club/clubLive", () => ({
  useClaimsLog: () => ({ data: h.log, loading: false, error: false }),
  useMembersVia: () => ({ data: [{ uid: "u1", via: "invite", by: "a2" }, { uid: "u2", via: "request", by: "a1" }], loading: false, error: false }),
}));

const row = (over: Partial<ClaimLogRow> & { uid: string }): ClaimLogRow => ({ playerId: "", playerName: "", nickname: "", email: "", status: "pending", at: 0, resolvedAt: 0, resolvedBy: "", ...over });

describe("Fichas", () => {
  beforeEach(() => {
    localStorage.clear();
    h.writes.resolveClaim.mockClear();
    h.log = [
      row({ uid: "u1", playerId: "kevin", nickname: "nuevo.socio", email: "nuevo.socio@gmail.com", at: NOW - 2 * 3_600_000 }),
      row({ uid: "u2", playerId: "fer", nickname: "fer.portero12", email: "fernando.portero.doce.piti@gmail.com", at: Date.UTC(2026, 10, 1, 20, 40) }),
      row({ uid: "u3", playerId: "andia", nickname: "andia19", status: "approved", at: Date.UTC(2026, 9, 27), resolvedAt: Date.UTC(2026, 9, 28, 12), resolvedBy: "a2" }),
      row({ uid: "a2", playerId: "erik", nickname: "erik9", status: "approved", resolvedAt: Date.UTC(2026, 9, 20, 12), resolvedBy: "a2" }),
    ];
    setAdminData(adminFixture());
  });
  afterEach(() => vi.useRealTimers());

  it("lists who asks for which ficha, when and how they came in; resolved and linked accounts below", async () => {
    mountAdmin("/admin/fichas", { fichas: Fichas });
    expect(await screen.findByRole("heading", { level: 1, name: "Fichas" })).toBeInTheDocument();
    const pending = screen.getByRole("list", { name: "Pendientes" });
    const items = within(pending).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("@nuevo.socio pide la ficha de 11KEVIN");
    expect(items[0]).toHaveTextContent("hace 2 h · entró con la invitación de erik9 · nuevo.socio@gmail.com");
    expect(items[1]).toHaveTextContent("ayer, 21:40 · llamó a la puerta y le abrió adrian_tc · fernando.portero.doce.piti@gmail.com");
    const resolved = within(screen.getByRole("list", { name: "Resueltas" })).getAllByRole("listitem");
    expect(resolved[0]).toHaveTextContent("@andia19 · ficha de 19ANDIA Aprobada");
    expect(resolved[0]).toHaveTextContent("28 oct · aprobada por erik9");
    expect(resolved[1]).toHaveTextContent("se aprobó sola (es administrador)");
    const linked = within(screen.getByRole("list", { name: "Cuentas vinculadas" })).getAllByRole("listitem");
    expect(linked.map((li) => li.querySelector("b")?.textContent)).toEqual(["@adrian_tc", "@erik9"]);
    expect(within(linked[0]).queryByRole("button")).toBeNull();
    expect(within(linked[0]).getByText("vinculada al entrar en el vestuario")).toBeInTheDocument();
    expect(within(linked[1]).getByRole("button", { name: "Desvincular a @erik9 de ERIK" })).toBeInTheDocument();
  });

  it("approves behind an undo toast: Deshacer means the call never happens", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin/fichas", { fichas: Fichas });
    await user.click(await screen.findByRole("button", { name: "Aprobar: @nuevo.socio es KEVIN" }));
    expect(within(screen.getByRole("list", { name: "Pendientes" })).getAllByRole("listitem")).toHaveLength(1);
    expect(within(screen.getByRole("list", { name: "Resueltas" })).getAllByRole("listitem")[0]).toHaveTextContent("ahora mismo · aprobada por adrian_tc");
    expect(screen.getByText("Ficha aprobada · @nuevo.socio ya es KEVIN (11).")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(within(screen.getByRole("list", { name: "Pendientes" })).getAllByRole("listitem")).toHaveLength(2);
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    expect(h.writes.resolveClaim).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Rechazar la petición de @fer.portero12" }));
    expect(screen.getByText("Petición de @fer.portero12 rechazada · puede volver a pedirla.")).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(5300);
    });
    expect(h.writes.resolveClaim).toHaveBeenCalledWith("u2", false);
  });

  it("puts the row back and says so when the write fails", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    h.writes.resolveClaim.mockImplementationOnce(() => Promise.reject(new Error("sin red")));
    mountAdmin("/admin/fichas", { fichas: Fichas });
    await user.click(await screen.findByRole("button", { name: "Aprobar: @nuevo.socio es KEVIN" }));
    await act(async () => {
      vi.advanceTimersByTime(5300);
    });
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("No se ha podido aprobar la ficha: Error: sin red"));
    expect(within(screen.getByRole("list", { name: "Pendientes" })).getAllByRole("listitem")).toHaveLength(2);
    expect(within(screen.getByRole("alert")).getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });

  it("unlinks an account behind an undo toast", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin/fichas", { fichas: Fichas });
    await user.click(await screen.findByRole("button", { name: "Desvincular a @erik9 de ERIK" }));
    expect(screen.getByText("@erik9 ya no es ERIK · su cuenta sigue en el vestuario.")).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Cuentas vinculadas" })).getAllByRole("listitem")).toHaveLength(1);
    await act(async () => {
      vi.advanceTimersByTime(5300);
    });
    expect(h.writes.resolveClaim).toHaveBeenCalledWith("a2", false);
  });

  it("says there is nothing pending", async () => {
    setAdminData(adminFixture({ claimsCount: 0 }));
    mountAdmin("/admin/fichas", { fichas: Fichas });
    expect(await screen.findByText("No hay fichas pendientes")).toBeInTheDocument();
    expect(screen.getByText("Al día")).toBeInTheDocument();
  });

  it("shows loading and error states", async () => {
    setAdminData(adminFixture({ loading: true }));
    mountAdmin("/admin/fichas", { fichas: Fichas });
    expect(await screen.findByRole("status", { name: "Cargando las fichas…" })).toBeInTheDocument();
  });
});
