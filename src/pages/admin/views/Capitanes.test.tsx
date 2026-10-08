import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adminFixture, mountAdmin, setAdminData } from "../../../test/adminKit";
import { Capitanes } from "./Capitanes";

const h = vi.hoisted(() => ({ writes: { setRole: vi.fn((uid: string, email: string, role: string) => Promise.resolve(void [uid, email, role])) } }));
vi.mock("../data/useAdminData", async () => ({ useAdminData: (await import("../../../test/adminMocks")).currentAdminData }));
vi.mock("../../../context/AuthContext", async () => ({ useAuth: (await import("../../../test/adminMocks")).fakeAuth }));
vi.mock("../../../lib/clubApi", () => ({ apiError: (e: unknown) => String(e) }));
vi.mock("../club/useClubWrites", () => ({ useClubWrites: () => h.writes }));

const members = () => within(screen.getByRole("list", { name: "Miembros" })).getAllByRole("listitem");

describe("Capitanes", () => {
  beforeEach(() => {
    localStorage.clear();
    h.writes.setRole.mockClear();
    setAdminData(adminFixture());
  });
  afterEach(() => vi.useRealTimers());

  it("lists the members by role, filters them and protects the super admin", async () => {
    const user = userEvent.setup();
    mountAdmin("/admin/capitanes", { capitanes: Capitanes });
    expect(await screen.findByRole("heading", { level: 1, name: "Capitanes" })).toBeInTheDocument();
    expect(screen.getByText("2 administradores · 1 usuario")).toBeInTheDocument();
    const rows = members();
    expect(rows.map((r) => r.querySelector("b")?.textContent)).toEqual(["adrian_tc(tú)Super admin", "erik9Administrador", "kevin11Usuario"]);
    expect(rows[0]).toHaveTextContent("capitan.adrian.tc@gmail.com");
    expect(within(rows[0]).getByText("Protegido")).toBeInTheDocument();
    expect(within(rows[0]).queryByRole("button")).toBeNull();
    expect(within(rows[1]).getByRole("button", { name: "Quitar admin a erik9" })).toBeInTheDocument();
    expect(within(rows[2]).getByRole("button", { name: "Hacer administrador a kevin11" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Usuarios/ }));
    expect(members()).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: /^Administradores/ }));
    expect(members().map((r) => r.querySelector("b")?.firstChild?.textContent)).toEqual(["adrian_tc", "erik9"]);
  });

  it("makes someone an admin after asking, behind an undo toast", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin/capitanes", { capitanes: Capitanes });
    await user.click(await screen.findByRole("button", { name: "Hacer administrador a kevin11" }));
    const ask = screen.getByRole("alertdialog", { name: "¿Hacer administrador a kevin11?" });
    expect(ask).toHaveTextContent("Podrá editar actas, plantilla, temporadas y contenido");
    expect(ask).toHaveTextContent("No podrá quitar al super admin");
    await user.click(within(ask).getByRole("button", { name: "Hacer administrador" }));
    expect(screen.getByText("kevin11 ya es administrador.")).toBeInTheDocument();
    expect(screen.getByText("3 administradores · 0 usuarios")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(screen.getByText("2 administradores · 1 usuario")).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    expect(h.writes.setRole).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Quitar admin a erik9" }));
    const red = screen.getByRole("alertdialog", { name: "¿Quitar el admin a erik9?" });
    expect(red).toHaveTextContent("Sigue siendo socio: su cuenta y su ficha no cambian");
    await user.click(within(red).getByRole("button", { name: "Quitar admin" }));
    await act(async () => {
      vi.advanceTimersByTime(5100);
    });
    expect(h.writes.setRole).toHaveBeenCalledWith("a2", "segundo.capitan@gmail.com", "user");
  });

  it("warns you when you are removing your own access", async () => {
    const user = userEvent.setup();
    const base = adminFixture();
    setAdminData({ ...base, people: base.people.map((p) => (p.uid === "a1" ? { ...p, role: "admin" } : p)) });
    mountAdmin("/admin/capitanes", { capitanes: Capitanes });
    await user.click(await screen.findByRole("button", { name: "Quitar admin a adrian_tc" }));
    const ask = screen.getByRole("alertdialog", { name: "¿Quitar el admin a adrian_tc?" });
    expect(ask).toHaveTextContent("Eres tú: dejarás de ver esta página en cuanto se guarde");
    expect(ask).toHaveTextContent("Dejarás de poder entrar en esta administración.");
  });

  it("keeps the super admin protected by e-mail even without the role", async () => {
    const base = adminFixture();
    setAdminData({ ...base, people: [...base.people, { uid: "s1", nickname: "jefe", displayName: "", email: "adriantomascv@gmail.com", role: "admin", playerId: null, removed: false }] });
    mountAdmin("/admin/capitanes", { capitanes: Capitanes });
    const jefe = (await screen.findAllByRole("listitem")).find((li) => li.textContent?.startsWith("JEjefe"));
    expect(jefe).toBeDefined();
    expect(within(jefe!).getByText("Protegido")).toBeInTheDocument();
    expect(within(jefe!).queryByRole("button")).toBeNull();
  });
});
