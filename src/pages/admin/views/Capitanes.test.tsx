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

const captains = () => within(screen.getByRole("list", { name: /^Con brazalete/ })).queryAllByRole("listitem");
const socios = () => {
  const list = screen.queryByRole("list", { name: /^Socios/ });
  return list ? within(list).getAllByRole("listitem") : [];
};

describe("Capitanes", () => {
  beforeEach(() => {
    localStorage.clear();
    h.writes.setRole.mockClear();
    setAdminData(adminFixture());
  });
  afterEach(() => vi.useRealTimers());

  it("hangs the armbands in lockers (gold = capitán general, protected) and lists the socios", async () => {
    mountAdmin("/admin/capitanes", { capitanes: Capitanes });
    expect(await screen.findByRole("heading", { level: 1, name: "Capitanes" })).toBeInTheDocument();
    expect(screen.getByText("Con brazalete")).toHaveTextContent("Con brazalete 2");
    expect(screen.getByText("Socios")).toHaveTextContent("Socios 1");
    const [adrian, erik] = captains();
    expect(adrian).toHaveAccessibleName("@adrian_tc (tú) · Capitán general · super admin");
    expect(adrian).toHaveTextContent("Capitán general · super admin · capitan.adrian.tc@gmail.com");
    expect(adrian.querySelector(".arm.gd")).toHaveTextContent("C");
    expect(within(adrian).getByText("Protegido")).toBeInTheDocument();
    expect(within(adrian).queryByRole("button")).toBeNull();
    expect(erik.querySelector(".arm:not(.gd)")).toHaveTextContent("C");
    expect(within(erik).getByRole("button", { name: "Quitar el brazalete a @erik9" })).toBeInTheDocument();
    const [kevin] = socios();
    expect(kevin).toHaveTextContent("Socio · kevin@hotmail.com");
    expect(kevin.querySelector(".arm")).toBeNull();
    expect(within(kevin).getByRole("button", { name: "Dar el brazalete a @kevin11" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Las normas del brazalete" })).toHaveTextContent("el último no puede quitárselo");
  });

  it("gives the armband after asking, behind a lower third with «Deshacer»; taking it off is red", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin/capitanes", { capitanes: Capitanes });
    await user.click(await screen.findByRole("button", { name: "Dar el brazalete a @kevin11" }));
    const ask = screen.getByRole("dialog", { name: "¿Dar el brazalete a @kevin11?" });
    expect(ask).toHaveTextContent("Podrá publicar actas y convocar");
    expect(ask).toHaveTextContent("Podrá aprobar fichas y cambiar el contenido");
    await user.click(within(ask).getByRole("button", { name: "Dar el brazalete" }));
    expect(screen.getByText("@kevin11 ya lleva el brazalete")).toBeInTheDocument();
    expect(captains()).toHaveLength(3);
    expect(socios()).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(captains()).toHaveLength(2);
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    expect(h.writes.setRole).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Quitar el brazalete a @erik9" }));
    const red = screen.getByRole("alertdialog", { name: "¿Quitar el brazalete a @erik9?" });
    expect(red).toHaveTextContent("Deja de ver la sala de control");
    expect(red).toHaveTextContent("Sigue siendo socio: su carta y su voto no cambian");
    await user.click(within(red).getByRole("button", { name: "Quitar el brazalete" }));
    expect(screen.getByText("@erik9 deja el brazalete · sigue como socio")).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(5300);
    });
    expect(h.writes.setRole).toHaveBeenCalledWith("a2", "segundo.capitan@gmail.com", "user");
  });

  it("the last captain cannot take his own armband off", async () => {
    const base = adminFixture();
    setAdminData({ ...base, people: base.people.filter((p) => p.uid !== "a1") });
    mountAdmin("/admin/capitanes", { capitanes: Capitanes });
    const [erik] = await screen.findAllByRole("listitem", { name: /@erik9/ });
    expect(within(erik).getByText("Último capitán")).toBeInTheDocument();
    expect(within(erik).queryByRole("button")).toBeNull();
  });

  it("warns you when you are taking your own armband off", async () => {
    const user = userEvent.setup();
    const base = adminFixture();
    setAdminData({ ...base, people: base.people.map((p) => (p.uid === "a1" ? { ...p, role: "admin" } : p)) });
    mountAdmin("/admin/capitanes", { capitanes: Capitanes });
    await user.click(await screen.findByRole("button", { name: "Quitar el brazalete a @adrian_tc" }));
    const ask = screen.getByRole("alertdialog", { name: "¿Quitar el brazalete a @adrian_tc?" });
    expect(ask).toHaveTextContent("Eres tú: dejarás de ver esta página en cuanto se guarde");
  });

  it("keeps the super admin protected by e-mail even without the role", async () => {
    const base = adminFixture();
    setAdminData({ ...base, people: [...base.people, { uid: "s1", nickname: "jefe", displayName: "", email: "adriantomascv@gmail.com", role: "admin", playerId: null, removed: false }] });
    mountAdmin("/admin/capitanes", { capitanes: Capitanes });
    const [jefe] = await screen.findAllByRole("listitem", { name: /@jefe/ });
    expect(within(jefe).getByText("Protegido")).toBeInTheDocument();
    expect(within(jefe).queryByRole("button")).toBeNull();
  });
});
