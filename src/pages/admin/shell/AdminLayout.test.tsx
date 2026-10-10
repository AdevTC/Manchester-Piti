import { act, cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adminFixture, mountAdmin, setAdminData } from "../../../test/adminKit";
import { fakeLogout } from "../../../test/adminMocks";
import { DOOR_LABEL } from "./nav";
import { RAIL_KEY } from "./railPrefs";

vi.mock("../data/useAdminData", async () => ({ useAdminData: (await import("../../../test/adminMocks")).currentAdminData }));
vi.mock("../../../context/AuthContext", async () => ({ useAuth: (await import("../../../test/adminMocks")).fakeAuth }));
vi.mock("../../../lib/clubApi", () => ({ apiError: (e: unknown) => String(e) }));

const root = () => document.querySelector(".vx.adm") as HTMLElement;
const WIDTH = window.innerWidth;
const phone = () => Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
const wide = () => Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440 });
const dk = () => document.querySelector(".dk") as HTMLElement;

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
    expect(within(nav).getByRole("link", { name: DOOR_LABEL })).toHaveAttribute("href", "/vestuario#puerta");
    expect(within(nav).getByText("Club")).toBeInTheDocument();
    expect(within(nav).getByText("adrian_tc")).toBeInTheDocument();
    expect(within(nav).getByText("Capitán general")).toBeInTheDocument();
    // no counter without an exception
    expect(within(nav).getByRole("link", { name: "Plantilla" }).querySelector(".n")).toBeNull();
  });

  it("navigates from the rail; the header follows; a redesigned view renders without the v1 wrapper", async () => {
    const user = userEvent.setup();
    const router = mountAdmin("/admin");
    const nav = await screen.findByRole("navigation", { name: "Sala de control" });
    await user.click(within(nav).getByRole("link", { name: /^Temporadas/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/temporadas"));
    expect(await screen.findByTestId("view")).toHaveTextContent("vista temporadas");
    expect(screen.getByTestId("view").closest(".v1")).toBeNull();
    expect(screen.getByRole("banner")).toHaveTextContent("Sala de control · Temporadas");
    expect(within(nav).getByRole("link", { name: /^Temporadas/ })).toHaveAttribute("aria-current", "page");
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
    expect(within(sheet).getByRole("link", { name: DOOR_LABEL })).toHaveAttribute("href", "/vestuario#puerta");
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
    expect(within(list).getAllByRole("group").map((g) => g.getAttribute("aria-label"))).toEqual(["Acciones", "Partidos", "Secciones"]);
    // the design's hints: what is pending to publish, a match's day and time, a player's position
    expect(within(list).getByRole("option", { name: /Publicar contenido/ })).toHaveTextContent("al día");
    expect(within(list).getByRole("option", { name: /J2 · FUSION 7/ })).toHaveTextContent("3–1");
    const options = within(list).getAllByRole("option");
    expect(input).toHaveAttribute("aria-activedescendant", options[0].id);
    await user.keyboard("{ArrowDown}");
    expect(input).toHaveAttribute("aria-activedescendant", options[1].id);
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(input).toHaveAttribute("aria-activedescendant", options[options.length - 1].id);
    await user.clear(input);
    await user.type(input, "J3");
    expect(within(list).getAllByRole("option").map((o) => o.textContent)).toEqual([expect.stringContaining("J3 · MAD SKY")]);
    expect(within(list).getByRole("option")).toHaveTextContent("8 nov · 12:00");
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
    expect(screen.getByRole("group", { name: "Jugadores" })).toHaveTextContent("9 · ERIKDEL");
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

describe("the rail · fold, keyboard, captain", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    fakeLogout.calls = 0;
    setAdminData(adminFixture());
  });
  afterEach(() => Object.defineProperty(window, "innerWidth", { configurable: true, value: WIDTH }));

  it("≥ 1200 px: «Plegar menú» folds the rail to its icons, remembers it on this device, and [ unfolds it", async () => {
    wide();
    const user = userEvent.setup();
    mountAdmin("/admin");
    const nav = await screen.findByRole("navigation", { name: "Sala de control" });
    expect(dk()).not.toHaveClass("ic");
    const fold = within(nav).getByRole("button", { name: "Plegar menú" });
    expect(fold).toHaveAttribute("aria-keyshortcuts", "[");
    expect(fold).toHaveAttribute("aria-expanded", "true");
    await user.click(fold);
    await waitFor(() => expect(dk()).toHaveClass("ic"));
    expect(dk()).toHaveAttribute("data-rail", "closed");
    expect(localStorage.getItem(RAIL_KEY)).toBe("plegado");
    expect(within(nav).getByRole("button", { name: "Desplegar menú" })).toHaveAttribute("aria-expanded", "false");
    // the names are still there for assistive tech
    expect(within(nav).getByRole("link", { name: "Fichas · 2 por hacer" })).toBeInTheDocument();
    // a fresh visit on this device starts folded
    cleanup();
    mountAdmin("/admin");
    await screen.findByRole("navigation", { name: "Sala de control" });
    expect(dk()).toHaveClass("ic");
    await user.keyboard("[[");
    await waitFor(() => expect(dk()).toHaveAttribute("data-rail", "open"));
    expect(dk()).not.toHaveClass("ic");
    expect(localStorage.getItem(RAIL_KEY)).toBeNull();
    // a Spanish keyboard types `[` with AltGr (Ctrl+Alt on Windows): it still folds; a real Ctrl+[ doesn't
    const altGr = new KeyboardEvent("keydown", { key: "[", ctrlKey: true, altKey: true, bubbles: true });
    Object.defineProperty(altGr, "getModifierState", { value: (m: string) => m === "AltGraph" });
    act(() => void document.body.dispatchEvent(altGr));
    await waitFor(() => expect(dk()).toHaveClass("ic"));
    act(() => void document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "[", ctrlKey: true, bubbles: true })));
    expect(dk()).toHaveClass("ic");
  });

  it("below 1200 px the rail is always icon-only: no fold control, [ does nothing", async () => {
    const user = userEvent.setup();
    mountAdmin("/admin");
    const nav = await screen.findByRole("navigation", { name: "Sala de control" });
    expect(dk()).toHaveClass("ic");
    expect(within(nav).queryByRole("button", { name: /menú$/ })).toBeNull();
    await user.keyboard("[[");
    expect(dk()).toHaveClass("ic");
    expect(localStorage.getItem(RAIL_KEY)).toBeNull();
  });

  it("g + a section's key jumps there (shown as aria-keyshortcuts); ignored while typing or with a modal open", async () => {
    const user = userEvent.setup();
    const router = mountAdmin("/admin");
    const nav = await screen.findByRole("navigation", { name: "Sala de control" });
    expect(within(nav).getByRole("link", { name: /^Hoy/ })).toHaveAttribute("aria-keyshortcuts", "g h");
    expect(within(nav).getByRole("link", { name: "Plantilla" })).toHaveAttribute("aria-keyshortcuts", "g l");
    expect(within(nav).getByRole("link", { name: "Capitanes" })).toHaveAttribute("aria-keyshortcuts", "g k");
    expect(within(nav).getByRole("link", { name: /^Contenido/ })).toHaveAttribute("aria-keyshortcuts", "g o");
    await user.keyboard("gt");
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/temporadas"));
    await user.keyboard("gk");
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/capitanes"));
    await user.keyboard("gl");
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/plantilla"));
    // a letter alone is nothing
    await user.keyboard("p");
    expect(router.state.location.pathname).toBe("/admin/plantilla");
    // typing in a field: letters are text
    const field = document.createElement("input");
    field.setAttribute("aria-label", "campo");
    document.body.appendChild(field);
    field.focus();
    await user.keyboard("gp");
    expect(field.value).toBe("gp");
    expect(router.state.location.pathname).toBe("/admin/plantilla");
    field.remove();
    // a modal is open (the palette): it owns the keyboard; its sections show their shortcut
    await user.click(within(screen.getByRole("banner")).getByRole("button", { name: "Buscar (Ctrl K)" }));
    const list = within(screen.getByRole("dialog", { name: "Buscar" })).getByRole("listbox");
    expect(within(list).getByRole("option", { name: /^Temporadas/ })).toHaveAttribute("aria-keyshortcuts", "g t");
    document.body.focus();
    await user.keyboard("gh");
    expect(router.state.location.pathname).toBe("/admin/plantilla");
  });

  it("the captain opens his menu: Mi perfil, Ver la web, the theme, and Salir (asks first, then signs out)", async () => {
    const user = userEvent.setup();
    mountAdmin("/admin");
    const nav = await screen.findByRole("navigation", { name: "Sala de control" });
    const me = within(nav).getByRole("button", { name: /adrian_tc/ });
    expect(me).toHaveAttribute("aria-haspopup", "menu");
    // the armband: gold for the capitán general
    expect(me.querySelector(".av .cc")).toHaveClass("gen");
    await user.click(me);
    const menu = screen.getByRole("menu", { name: "Menú del capitán" });
    expect(me).toHaveAttribute("aria-expanded", "true");
    const perfil = within(menu).getByRole("menuitem", { name: "Mi perfil" });
    expect(perfil).toHaveAttribute("href", "/profile");
    expect(perfil).toHaveFocus();
    expect(within(menu).getByRole("menuitem", { name: /Ver la web/ })).toHaveAttribute("href", "/");
    expect(within(menu).getByRole("menuitem", { name: /Tema de/ })).toBeInTheDocument();
    await user.keyboard("{ArrowDown}");
    expect(within(menu).getByRole("menuitem", { name: /Ver la web/ })).toHaveFocus();
    await user.keyboard("{End}");
    expect(within(menu).getByRole("menuitem", { name: "Salir en este dispositivo" })).toHaveFocus();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(me).toHaveFocus();
    await user.click(me);
    await user.click(screen.getByRole("menuitem", { name: "Salir en este dispositivo" }));
    const ask = screen.getByRole("dialog", { name: "¿Salir en este dispositivo?" });
    expect(fakeLogout.calls).toBe(0);
    await user.click(within(ask).getByRole("button", { name: "Salir" }));
    await waitFor(() => expect(fakeLogout.calls).toBe(1));
    expect(sessionStorage.getItem("mp_door_notice")).toBe("Has salido en este dispositivo");
  });

  it("every chrome control carries the sky focus ring (.fr)", async () => {
    mountAdmin("/admin");
    const nav = await screen.findByRole("navigation", { name: "Sala de control" });
    const banner = screen.getByRole("banner");
    const controls = [...within(nav).getAllByRole("link"), ...within(nav).getAllByRole("button"), ...within(banner).getAllByRole("button"), ...within(banner).getAllByRole("link")];
    expect(controls.length).toBeGreaterThan(10);
    for (const c of controls) expect(c).toHaveClass("fr");
  });
});

describe("the phone bar and «Más» · captain, focus rings", () => {
  beforeEach(() => {
    localStorage.clear();
    fakeLogout.calls = 0;
    setAdminData(adminFixture());
    phone();
  });
  afterEach(() => Object.defineProperty(window, "innerWidth", { configurable: true, value: WIDTH }));

  it("the bar's tabs and the sheet's rows carry the focus ring; the captain's row opens Mi perfil and Salir", async () => {
    const user = userEvent.setup();
    mountAdmin("/admin");
    const bar = await screen.findByRole("navigation", { name: "Sala de control" });
    for (const c of [...within(bar).getAllByRole("link"), ...within(bar).getAllByRole("button")]) expect(c).toHaveClass("fr");
    // the floodlight sits behind the current tab
    expect(within(bar).getByRole("link", { name: "Hoy · 3 por hacer" }).querySelector(".fl")).not.toBeNull();
    await user.click(within(bar).getByRole("button", { name: /^Más/ }));
    const sheet = screen.getByRole("dialog", { name: "Más" });
    const cap = within(sheet).getByRole("button", { name: /adrian_tc/ });
    expect(cap).toHaveClass("fr");
    expect(cap).toHaveAttribute("aria-expanded", "false");
    expect(within(sheet).queryByRole("link", { name: "Mi perfil" })).toBeNull();
    await user.click(cap);
    expect(cap).toHaveAttribute("aria-expanded", "true");
    expect(within(sheet).getByRole("link", { name: "Mi perfil" })).toHaveAttribute("href", "/profile");
    await user.click(within(sheet).getByRole("button", { name: "Salir en este dispositivo" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Más" })).toBeNull());
    await user.click(within(screen.getByRole("dialog", { name: "¿Salir en este dispositivo?" })).getByRole("button", { name: "Salir" }));
    await waitFor(() => expect(fakeLogout.calls).toBe(1));
  });
});
