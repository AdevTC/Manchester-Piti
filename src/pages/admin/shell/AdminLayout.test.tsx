import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adminFixture, mountAdmin, setAdminData } from "../../../test/adminKit";

vi.mock("../data/useAdminData", async () => ({ useAdminData: (await import("../../../test/adminMocks")).currentAdminData }));
vi.mock("../../../context/AuthContext", async () => ({ useAuth: (await import("../../../test/adminMocks")).fakeAuth }));
vi.mock("../../../lib/clubApi", () => ({ apiError: (e: unknown) => String(e) }));

const root = () => document.querySelector(".vx.adm") as HTMLElement;
const WIDTH = window.innerWidth;
const phone = () => Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });

describe("AdminLayout · the v2 shell", () => {
  beforeEach(() => {
    localStorage.clear();
    setAdminData(adminFixture());
  });
  afterEach(() => Object.defineProperty(window, "innerWidth", { configurable: true, value: WIDTH }));

  it("the header says where you are; the rail has its groups, exception-only counters and the captain", async () => {
    mountAdmin("/admin");
    const banner = await screen.findByRole("banner");
    expect(banner).toHaveTextContent("Sala de control · Hoy");
    expect(within(banner).getByRole("link", { name: "Ver la web" })).toHaveAttribute("href", "/");
    expect(root()).toHaveClass("d");
    const nav = screen.getByRole("navigation", { name: "Sala de control" });
    // Hoy = pending: the J2 is the hero at this hour (its FINAL), so the fichas + the 2 content gaps
    const hoy = within(nav).getByRole("link", { name: /^Hoy/ });
    expect(hoy).toHaveAttribute("aria-current", "page");
    expect(hoy).toHaveAccessibleName("Hoy · 3 por hacer");
    expect(within(nav).getByRole("link", { name: "Partidos · 1 por hacer" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Convocar" })).toHaveAttribute("href", "/admin/convocar");
    expect(within(nav).getByRole("link", { name: "Plantilla" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Fichas · 2 por hacer" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Temporadas" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Capitanes" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Contenido · 2 por hacer" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "La puerta (en el vestuario)" })).toHaveAttribute("href", "/vestuario#puerta");
    expect(within(nav).getByText("Club")).toBeInTheDocument();
    expect(within(nav).getByText("adrian_tc")).toBeInTheDocument();
    expect(within(nav).getByText("Capitán general")).toBeInTheDocument();
    // no counter without an exception
    expect(within(nav).getByRole("link", { name: "Plantilla" }).querySelector(".n")).toBeNull();
  });

  it("navigates from the rail; the header follows; a legacy view renders inside .v1", async () => {
    const user = userEvent.setup();
    const router = mountAdmin("/admin");
    const nav = await screen.findByRole("navigation", { name: "Sala de control" });
    await user.click(within(nav).getByRole("link", { name: /^Fichas/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/fichas"));
    expect(await screen.findByTestId("view")).toHaveTextContent("vista fichas");
    expect(screen.getByTestId("view").closest(".v1")).not.toBeNull();
    expect(screen.getByRole("banner")).toHaveTextContent("Sala de control · Fichas");
    expect(within(nav).getByRole("link", { name: /^Fichas/ })).toHaveAttribute("aria-current", "page");
  });

  it("toggles the theme from the header", async () => {
    const user = userEvent.setup();
    mountAdmin("/admin");
    const banner = await screen.findByRole("banner");
    const btn = within(banner).getByRole("button", { name: /Cambiar a tema de/ });
    const before = document.documentElement.getAttribute("data-theme");
    await user.click(btn);
    expect(document.documentElement.getAttribute("data-theme")).not.toBe(before);
  });
});

describe("AdminLayout · phones", () => {
  beforeEach(() => {
    localStorage.clear();
    setAdminData(adminFixture());
    phone();
  });
  afterEach(() => Object.defineProperty(window, "innerWidth", { configurable: true, value: WIDTH }));

  it("the header + the bar (Hoy and Más carry the badges); «Más» opens the Club sections", async () => {
    const user = userEvent.setup();
    const router = mountAdmin("/admin");
    const bar = await screen.findByRole("navigation", { name: "Sala de control" });
    expect(root()).toHaveClass("m");
    expect(root().style.getPropertyValue("--ltb")).toBe("80px");
    expect(screen.getByRole("heading", { level: 1, name: "Hoy" })).toBeInTheDocument();
    expect(within(bar).getByRole("link", { name: "Hoy · 3 por hacer" })).toHaveAttribute("aria-current", "page");
    expect(within(bar).getByRole("link", { name: "Partidos" })).toBeInTheDocument();
    expect(within(bar).getByRole("link", { name: "Convocar" })).toBeInTheDocument();
    expect(within(bar).getByRole("link", { name: "Plantilla" })).toBeInTheDocument();
    // Más = Fichas (2) + Contenido (2)
    const mas = within(bar).getByRole("button", { name: "Más · 4 por hacer" });
    await user.click(mas);
    const sheet = screen.getByRole("dialog", { name: "Más" });
    expect(mas).toHaveAttribute("aria-expanded", "true");
    expect(within(sheet).getByText("Capitán general")).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: "Fichas · 2 por hacer" })).toBeInTheDocument();
    expect(within(sheet).getByRole("link", { name: /La puerta/ })).toHaveAttribute("href", "/vestuario#puerta");
    expect(within(sheet).getByRole("button", { name: /Cambiar a tema de/ })).toBeInTheDocument();
    await user.click(within(sheet).getByRole("button", { name: "Temporadas" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/temporadas"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(within(screen.getByRole("navigation", { name: "Sala de control" })).getByRole("button", { name: /^Más/ })).toHaveAttribute("aria-current", "page");
  });

  it("hides the header and the bar inside the match workspace and En juego", async () => {
    mountAdmin("/admin/partidos/m7");
    expect(await screen.findByTestId("view")).toHaveTextContent("vista partidos");
    expect(screen.queryByRole("navigation", { name: "Sala de control" })).toBeNull();
    expect(screen.queryByRole("banner")).toBeNull();
    expect(root().style.getPropertyValue("--ltb")).toBe("150px");
  });

  it("En juego: no bar, the lower thirds over the pads", async () => {
    mountAdmin("/admin/en-juego/m8");
    expect(await screen.findByTestId("view")).toHaveTextContent("vista enjuego");
    expect(screen.queryByRole("navigation", { name: "Sala de control" })).toBeNull();
    expect(root().style.getPropertyValue("--ltb")).toBe("262px");
  });
});

describe("command palette", () => {
  beforeEach(() => {
    localStorage.clear();
    setAdminData(adminFixture());
  });

  it("opens with Ctrl K: grouped results, pinned matches, ↑↓ + Enter", async () => {
    const user = userEvent.setup();
    const router = mountAdmin("/admin");
    await screen.findByRole("banner");
    await user.keyboard("{Control>}k{/Control}");
    const dialog = screen.getByRole("dialog", { name: "Buscar" });
    expect(dialog).toHaveClass("pal");
    const input = within(dialog).getByRole("combobox");
    expect(input).toHaveFocus();
    const list = within(dialog).getByRole("listbox", { name: "Resultados" });
    expect(within(list).getAllByRole("group").map((g) => g.getAttribute("aria-label"))).toEqual(["Acciones", "Secciones", "Partidos"]);
    const options = within(list).getAllByRole("option");
    expect(input).toHaveAttribute("aria-activedescendant", options[0].id);
    await user.keyboard("{ArrowDown}");
    expect(input).toHaveAttribute("aria-activedescendant", options[1].id);
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(input).toHaveAttribute("aria-activedescendant", options[options.length - 1].id);
    await user.clear(input);
    await user.type(input, "J3");
    expect(within(list).getAllByRole("option").map((o) => o.textContent)).toEqual([expect.stringContaining("J3 · MAD SKY")]);
    await user.keyboard("{Enter}");
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/partidos/m8"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("finds players by name or dorsal and opens their drawer; says when nothing matches", async () => {
    const user = userEvent.setup();
    const router = mountAdmin("/admin");
    const banner = await screen.findByRole("banner");
    const buscar = within(banner).getByRole("button", { name: "Buscar (Ctrl K)" });
    await user.click(buscar);
    const input = screen.getByRole("combobox");
    await user.type(input, "9");
    expect(screen.getByRole("group", { name: "Jugadores" })).toHaveTextContent("ERIK");
    await user.clear(input);
    await user.type(input, "zzz");
    expect(screen.getByText("Nada con «zzz».")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(buscar).toHaveFocus();
    await user.click(buscar);
    await user.type(screen.getByRole("combobox"), "adrian");
    await user.click(screen.getByRole("option", { name: /ADRIÁN T\.C\./ }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/plantilla"));
    expect(router.state.location.search).toMatchObject({ jugador: "adrian" });
  });

  it("makes the app inert while open", async () => {
    const user = userEvent.setup();
    mountAdmin("/admin");
    await screen.findByRole("banner");
    await user.keyboard("{Control>}k{/Control}");
    expect(document.querySelector(".dk")).toHaveAttribute("inert");
    await user.keyboard("{Escape}");
    expect(document.querySelector(".dk")).not.toHaveAttribute("inert");
  });
});
