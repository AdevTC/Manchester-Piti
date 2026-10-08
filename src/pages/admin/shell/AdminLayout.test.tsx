import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminFixture, mountAdmin, setAdminData } from "../../../test/adminKit";

vi.mock("../data/useAdminData", async () => ({ useAdminData: (await import("../../../test/adminMocks")).currentAdminData }));
vi.mock("../../../context/AuthContext", async () => ({ useAuth: (await import("../../../test/adminMocks")).fakeAuth }));
vi.mock("../../../lib/clubApi", () => ({ apiError: (e: unknown) => String(e) }));

const root = () => document.querySelector(".vx.adm") as HTMLElement;

describe("AdminLayout · shell", () => {
  beforeEach(() => {
    localStorage.clear();
    setAdminData(adminFixture());
  });

  it("shows the side menu with live counters as words, the current section and the door", async () => {
    mountAdmin("/admin");
    const nav = await screen.findByRole("navigation", { name: "Secciones de administración" });
    expect(within(nav).getByRole("link", { name: "Inicio · 4 cosas por hacer" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Partidos y actas · 1 acta por hacer" })).not.toHaveAttribute("aria-current");
    expect(within(nav).getByRole("link", { name: "Fichas · 2 fichas pendientes" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Plantilla · 12 jugadores" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Convocatorias · 3 sin asignar" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: /^La puerta: 2 llamando/ })).toHaveAttribute("href", "/vestuario#puerta");
    // the counters' tones: amber = por revisar, red = pending on someone
    const fichas = within(nav).getByRole("link", { name: /^Fichas/ });
    expect(fichas.querySelector(".ct")).toHaveClass("hot");
    expect(fichas.querySelector(".ct")).toHaveTextContent("2");
    expect(within(nav).getByText("adrian_tc")).toBeInTheDocument();
    expect(within(nav).getByText("Super admin · capitán")).toBeInTheDocument();
  });

  it("navigates from the menu and the header follows", async () => {
    const user = userEvent.setup();
    const router = mountAdmin("/admin");
    const nav = await screen.findByRole("navigation", { name: "Secciones de administración" });
    await user.click(within(nav).getByRole("link", { name: /^Fichas/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/fichas"));
    expect(await screen.findByTestId("view")).toHaveTextContent("vista fichas");
    expect(within(screen.getByRole("banner")).getByText("Fichas")).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: /^Fichas/ })).toHaveAttribute("aria-current", "page");
  });

  it("folds the menu automatically at 1000–1199 px and remembers an explicit choice per user", async () => {
    const user = userEvent.setup();
    mountAdmin("/admin");
    await screen.findByRole("navigation", { name: "Secciones de administración" });
    // jsdom's window is 1024 px wide: auto-folded
    expect(root()).toHaveClass("sda");
    const fold = screen.getByRole("button", { name: "Desplegar el menú" });
    expect(fold).toHaveAttribute("aria-expanded", "false");
    await user.click(fold);
    expect(root()).not.toHaveClass("sda");
    expect(screen.getByRole("button", { name: "Plegar el menú" })).toHaveAttribute("aria-expanded", "true");
    expect(localStorage.getItem("mp_admin_side:a1")).toBe("exp");
    await user.click(screen.getByRole("button", { name: "Plegar el menú" }));
    expect(root()).toHaveClass("sdc");
    expect(localStorage.getItem("mp_admin_side:a1")).toBe("col");
  });

  it("the phone bar: badges, and «Más» opens its sheet with the other sections", async () => {
    const user = userEvent.setup();
    const router = mountAdmin("/admin");
    const bar = await screen.findByRole("navigation", { name: "Administración" });
    expect(within(bar).getByRole("button", { name: "Inicio" })).toHaveAttribute("aria-current", "page");
    expect(within(bar).getByRole("button", { name: "Partidos · 1 acta por hacer" })).toBeInTheDocument();
    const mas = within(bar).getByRole("button", { name: /^Más secciones · 2 fichas pendientes/ });
    await user.click(mas);
    const sheet = screen.getByRole("dialog", { name: "Más secciones" });
    expect(mas).toHaveAttribute("aria-expanded", "true");
    expect(within(sheet).getByText("Super admin · capitán de la Temporada 1")).toBeInTheDocument();
    expect(within(sheet).getByRole("link", { name: /La puerta/ })).toHaveAttribute("href", "/vestuario#puerta");
    expect(within(sheet).getByRole("button", { name: /Tema de/ })).toBeInTheDocument();
    await user.click(within(sheet).getByRole("button", { name: "Temporadas" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/temporadas"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(within(bar).getByRole("button", { name: /^Más secciones/ })).toHaveAttribute("aria-current", "page");
  });

  it("toggles the theme from the header", async () => {
    const user = userEvent.setup();
    mountAdmin("/admin");
    const banner = await screen.findByRole("banner");
    const btn = within(banner).getByRole("button", { name: /Cambiar a tema/ });
    const before = document.documentElement.getAttribute("data-theme");
    await user.click(btn);
    expect(document.documentElement.getAttribute("data-theme")).not.toBe(before);
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
    const dialog = screen.getByRole("dialog", { name: "Buscar en la administración" });
    const input = within(dialog).getByRole("combobox");
    expect(input).toHaveFocus();
    const list = within(dialog).getByRole("listbox", { name: "Resultados" });
    expect(within(list).getAllByRole("group").map((g) => g.getAttribute("aria-label"))).toEqual(["Acciones", "Secciones", "Partidos"]);
    expect(within(within(list).getByRole("group", { name: "Partidos" })).getAllByRole("option").map((o) => o.textContent)).toEqual([
      expect.stringContaining("J2 · FUSION 7"),
      expect.stringContaining("J3 · MAD SKY"),
    ]);
    const options = within(list).getAllByRole("option");
    expect(input).toHaveAttribute("aria-activedescendant", options[0].id);
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowDown}");
    expect(input).toHaveAttribute("aria-activedescendant", options[1].id);
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(input).toHaveAttribute("aria-activedescendant", options[options.length - 1].id);
    await user.clear(input);
    await user.type(input, "J3");
    // «J3» finds the match and the action about its convocatoria
    expect(within(list).getAllByRole("option").map((o) => o.textContent)).toEqual([expect.stringContaining("Preparar la convocatoria de la J3"), expect.stringContaining("J3 · MAD SKY")]);
    await user.keyboard("{ArrowDown}{Enter}");
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/partidos/m8"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("finds players by name or dorsal and opens their drawer; says when nothing matches", async () => {
    const user = userEvent.setup();
    const router = mountAdmin("/admin");
    const banner = await screen.findByRole("banner");
    const buscar = within(banner).getByRole("button", { name: "Buscar en la administración (Ctrl K)" });
    await user.click(buscar);
    const input = screen.getByRole("combobox");
    await user.type(input, "9");
    expect(screen.getByRole("group", { name: "Jugadores" })).toHaveTextContent("ERIK");
    await user.clear(input);
    await user.type(input, "zzz");
    expect(screen.getByText("Nada con «zzz»")).toBeInTheDocument();
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
    expect(document.querySelector(".app")).toHaveAttribute("inert");
    await user.keyboard("{Escape}");
    expect(document.querySelector(".app")).not.toHaveAttribute("inert");
  });
});
