// Capitanes (/admin/plantilla/capitanes): el brazalete (who enters the sala) and el capitán en el campo of each season,
// inside the real frame (mountAdmin). Giving and taking the brazalete confirm in place and wait behind «Deshacer»;
// the general is protected (also by e-mail), the last captain stays, and M-40: another captain's brazalete is only
// the capitán general's to take off, while each captain can take off his own.
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adminFixture, mountAdmin, setAdminData } from "../../../../test/adminKit";
import type { PersonRow } from "../../../vestuario/live";
import { CapitanesScreen } from "./Capitanes";

const h = vi.hoisted(() => ({
  auth: { uid: "a1", role: "superadmin", nickname: "adrian_tc", email: "capitan.adrian.tc@gmail.com" },
  writes: {
    setRole: vi.fn((uid: string, email: string, role: string) => Promise.resolve(void [uid, email, role])),
    saveSeason: vi.fn((id: string, data: Record<string, unknown>) => Promise.resolve(void [id, data])),
  },
}));
vi.mock("../../data/useAdminData", async () => ({ useAdminData: (await import("../../../../test/adminMocks")).currentAdminData }));
vi.mock("../../../../context/AuthContext", () => ({
  useAuth: () => ({ user: { uid: h.auth.uid }, profile: { nickname: h.auth.nickname, role: h.auth.role, email: h.auth.email, createdAt: new Date(0) }, loading: false, logout: async () => undefined }),
}));
vi.mock("../../../../lib/clubApi", () => ({ apiError: (e: unknown) => (e instanceof Error ? e.message : String(e)) }));
vi.mock("../../club/useClubWrites", () => ({ useClubWrites: () => h.writes }));
vi.mock("../../data/useCaja", () => ({ useCajaClaims: () => ({ data: [], loading: false, error: false }) }));
vi.mock("../../../../components/jersey3d/useShirtStills", () => ({ useShirtStills: () => () => undefined }));

const person = (over: Partial<PersonRow> & { uid: string }): PersonRow => ({ nickname: over.uid, displayName: "", email: `${over.uid}@piti.test`, role: "user", playerId: null, removed: false, ...over });
const captains = () => within(screen.getByRole("list", { name: /^Con brazalete/ })).getAllByRole("listitem").filter((li) => li.classList.contains("pl-person"));
const socios = () => within(screen.getByRole("list", { name: /^Socios/ })).queryAllByRole("listitem").filter((li) => li.classList.contains("pl-person"));
const rowOf = (text: string) => screen.getAllByRole("listitem").find((li) => li.classList.contains("pl-person") && li.textContent?.includes(text))!;
const caption = () => screen.getAllByRole("status").find((s) => s.classList.contains("sc-status__live"))!;
const fake = () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
};
const mount = () => mountAdmin("/admin/plantilla/capitanes", { capitanes: CapitanesScreen });

describe("Capitanes", () => {
  beforeEach(() => {
    localStorage.clear();
    Object.assign(h.auth, { uid: "a1", role: "superadmin", nickname: "adrian_tc", email: "capitan.adrian.tc@gmail.com" });
    h.writes.setRole.mockClear();
    h.writes.saveSeason.mockClear();
    setAdminData(adminFixture());
  });
  afterEach(() => vi.useRealTimers());

  it("the brazalete: the captains with their «C» (gold: the general, protected), the socios, the rules and the ways out", async () => {
    mount();
    expect(await screen.findByRole("heading", { level: 1, name: "Capitanes" })).toBeInTheDocument();
    expect(screen.getByText("Quién lleva el brazalete (entra en la sala) y, aparte, el capitán en el campo de cada temporada (sin permisos).")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Con brazalete 2" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Socios 1" })).toBeInTheDocument();
    const [adrian, erik] = captains();
    expect(adrian).toHaveTextContent("@adrian_tc · tú");
    expect(adrian).toHaveTextContent("Capitán general · ADRIÁN T.C.");
    expect(adrian).toHaveTextContent("capitan.adrian.tc@gmail.com");
    expect(adrian.querySelector(".pl-ini--arm.is-superadmin b")).toHaveTextContent("C");
    expect(adrian).toHaveTextContent("Eres tú · protegido");
    expect(within(adrian).queryByRole("button")).toBeNull();
    expect(erik.querySelector(".pl-ini--arm.is-admin b")).toHaveTextContent("C");
    expect(erik).toHaveTextContent("Capitán · ERIK");
    expect(within(erik).getByRole("button", { name: "Quitar el brazalete a @erik9" })).toHaveAttribute("aria-expanded", "false");
    const [kevin] = socios();
    expect(kevin).toHaveTextContent("@kevin11Socio");
    expect(kevin.querySelector(".pl-ini--arm")).toBeNull();
    expect(kevin.querySelector(".pl-ini")).toHaveTextContent("K");
    expect(within(kevin).getByRole("button", { name: "Dar el brazalete a @kevin11" })).toBeInTheDocument();
    const rules = screen.getByRole("complementary", { name: "Las normas del brazalete" });
    expect(rules).toHaveTextContent("el último no se puede quitar");
    expect(rules).toHaveTextContent("Solo el capitán general quita el brazalete o el acceso a otro capitán; cada uno puede quitarse el suyo.");
    expect(within(rules).getByRole("link", { name: "La puerta, en Socios ›" })).toHaveAttribute("href", "/admin/plantilla/socios");
    expect(screen.getByRole("link", { name: "Las temporadas, en Club ›" })).toHaveAttribute("href", "/admin/club/temporadas");
  });

  it("gives the brazalete after asking in place, behind «Deshacer»; taking it off says what changes", async () => {
    const user = fake();
    mount();
    const give = await screen.findByRole("button", { name: "Dar el brazalete a @kevin11" });
    await user.click(give);
    expect(give).toHaveAttribute("aria-expanded", "true");
    const ask = screen.getByRole("group", { name: "Dar el brazalete a @kevin11" });
    expect(ask).toHaveTextContent("¿Dar el brazalete a @kevin11?");
    expect(within(ask).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Podrá publicar actas y convocar", "Podrá aprobar cuentas, abrir la puerta y cambiar el contenido", "Se lo puede quitar el capitán general, o él mismo"]);
    await user.click(within(ask).getByRole("button", { name: "Dar el brazalete" }));
    expect(caption()).toHaveTextContent("@kevin11 ya lleva el brazalete");
    expect(caption().querySelector(".sc-status__tag")).toHaveTextContent("Brazalete");
    expect(captains()).toHaveLength(3);
    expect(socios()).toHaveLength(0);
    expect(screen.getByText("Todos los de dentro llevan el brazalete. Los nuevos entran por la puerta.")).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 3, name: "Con brazalete 3" }));
    await user.click(within(caption()).getByRole("button", { name: "Deshacer" }));
    expect(captains()).toHaveLength(2);
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    expect(h.writes.setRole).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Quitar el brazalete a @erik9" }));
    const red = screen.getByRole("group", { name: "Quitar el brazalete a @erik9" });
    expect(within(red).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Deja de ver la sala de control", "Sigue siendo socio: su carta y su voto no cambian"]);
    const go = within(red).getByRole("button", { name: "Quitar el brazalete" });
    expect(go).toHaveClass("pl-danger");
    await user.click(go);
    expect(caption()).toHaveTextContent("@erik9 deja el brazalete · sigue como socio");
    await act(async () => {
      vi.advanceTimersByTime(5300);
    });
    expect(h.writes.setRole).toHaveBeenCalledWith("a2", "segundo.capitan@gmail.com", "user");
  });

  it("«Cancelar» closes the confirm and gives the focus back to its button", async () => {
    const user = userEvent.setup();
    mount();
    const give = await screen.findByRole("button", { name: "Dar el brazalete a @kevin11" });
    await user.click(give);
    await user.click(within(screen.getByRole("group", { name: "Dar el brazalete a @kevin11" })).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("group", { name: "Dar el brazalete a @kevin11" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Dar el brazalete a @kevin11" }));
  });

  it("the last captain cannot take his own brazalete off", async () => {
    Object.assign(h.auth, { uid: "a2", role: "admin", nickname: "erik9", email: "segundo.capitan@gmail.com" });
    const base = adminFixture();
    setAdminData({ ...base, people: base.people.filter((p) => p.uid !== "a1") });
    mount();
    await screen.findByRole("heading", { level: 1, name: "Capitanes" });
    const erik = rowOf("@erik9");
    expect(erik).toHaveTextContent("Último capitán");
    expect(within(erik).queryByRole("button")).toBeNull();
  });

  it("warns you when you are taking your own brazalete off", async () => {
    const user = userEvent.setup();
    const base = adminFixture();
    setAdminData({ ...base, people: base.people.map((p) => (p.uid === "a1" ? { ...p, role: "admin" } : p)) });
    mount();
    await user.click(await screen.findByRole("button", { name: "Quitar el brazalete a @adrian_tc" }));
    expect(screen.getByRole("group", { name: "Quitar el brazalete a @adrian_tc" })).toHaveTextContent("Eres tú: dejarás de ver la sala en cuanto se guarde");
  });

  it("keeps the capitán general protected by e-mail even without the role", async () => {
    const base = adminFixture();
    setAdminData({ ...base, people: [...base.people, person({ uid: "s1", nickname: "jefe", email: "adriantomascv@gmail.com", role: "admin" })] });
    mount();
    await screen.findByRole("heading", { level: 1, name: "Capitanes" });
    const jefe = rowOf("@jefe");
    expect(jefe).toHaveTextContent("Protegido");
    expect(jefe.querySelector(".pl-ini--arm.is-superadmin")).not.toBeNull();
    expect(within(jefe).queryByRole("button")).toBeNull();
  });

  it("M-40: a captain who is not the general takes off only his own brazalete; the general takes another's", async () => {
    Object.assign(h.auth, { uid: "a2", role: "admin", nickname: "erik9", email: "segundo.capitan@gmail.com" });
    const base = adminFixture();
    const people = [...base.people, person({ uid: "a4", nickname: "jorge30", role: "admin" })];
    setAdminData({ ...base, people });
    const user = userEvent.setup();
    mount();
    await screen.findByRole("heading", { level: 1, name: "Capitanes" });
    const jorge = rowOf("@jorge30");
    expect(jorge).toHaveTextContent("Solo el capitán general");
    expect(within(jorge).queryByRole("button")).toBeNull();
    // his own: yes, warned
    await user.click(within(rowOf("@erik9 · tú")).getByRole("button", { name: "Quitar el brazalete a @erik9" }));
    expect(screen.getByRole("group", { name: "Quitar el brazalete a @erik9" })).toHaveTextContent("Eres tú: dejarás de ver la sala en cuanto se guarde");
    // and he can still give it
    expect(within(rowOf("@kevin11")).getByRole("button", { name: "Dar el brazalete a @kevin11" })).toBeInTheDocument();
  });

  it("the general sees «Quitar el brazalete» on every other captain", async () => {
    const base = adminFixture();
    setAdminData({ ...base, people: [...base.people, person({ uid: "a4", nickname: "jorge30", role: "admin" })] });
    mount();
    expect(await screen.findByRole("button", { name: "Quitar el brazalete a @jorge30" })).toBeInTheDocument();
  });

  it("el capitán en el campo: a select per season writes saveSeason behind «Deshacer»; an archived one only says so", async () => {
    const user = fake();
    mount();
    const field = (await screen.findByRole("heading", { level: 2, name: "El capitán en el campo" })).closest("section")!;
    const t1 = within(field).getByRole("combobox", { name: "Capitán en el campo de la Temporada 1" });
    expect(t1).toHaveValue("adrian");
    expect(within(t1).getAllByRole("option").map((o) => o.textContent)).toEqual(["— Sin capitán —", "1 · EVANS", "4 · ILLESCAS", "8 · EGUZQUIZA", "9 · ERIK", "10 · ADRIÁN T.C.", "11 · KEVIN", "12 · FER", "14 · HUBEROSKI", "19 · ANDIA", "20 · TELLO", "21 · ALMACHI", "33 · BRAWAN"]);
    const rows = within(field).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Temporada 1ADRIÁN T.C. · 10");
    // the archived season: a quiet tag of its own size, no select
    expect(rows[1]).toHaveTextContent("Temporada 0 · pre-Piti · archivadaSin capitán en el campo");
    expect(within(rows[1]).queryByRole("combobox")).toBeNull();
    const tag = within(rows[1]).getByText("Archivada");
    expect(tag).toHaveClass("sc-tag", "sc-tag--quiet");
    expect(tag.parentElement).toHaveClass("pl-fcap__tag");

    await user.selectOptions(t1, "erik");
    expect(caption()).toHaveTextContent("Capitán de la T1: ERIK · sale con el brazalete en la web");
    expect(rows[0]).toHaveTextContent("ERIK · 9");
    await user.click(within(caption()).getByRole("button", { name: "Deshacer" }));
    expect(t1).toHaveValue("adrian");
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    expect(h.writes.saveSeason).not.toHaveBeenCalled();

    await user.selectOptions(t1, "");
    expect(caption()).toHaveTextContent("La T1 se queda sin capitán en el campo");
    await act(async () => {
      vi.advanceTimersByTime(5300);
    });
    expect(h.writes.saveSeason).toHaveBeenCalledWith("t1", { captainPlayerId: "" });
  });

  it("says its loading", async () => {
    setAdminData(adminFixture({ loading: true }));
    mount();
    expect(await screen.findByRole("status", { name: "Cargando los capitanes" })).toBeInTheDocument();
  });
});
