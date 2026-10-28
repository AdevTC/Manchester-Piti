// The Sala de control's frame (r12): the desktop bar with the capsule, the tablet/phone header and the dock, who
// looks (a captain, the door, the anotador's mesa), the match's head and carril, the shared pieces (the status
// strip, the sheet, the palette, the keyboard) and the redirects of the old addresses, on a memory router with the
// real AdminLayout and PartidoLayout. The screens are markers (adminKit) unless a test needs a real one.
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adminFixture, fixturePublished, mountAdmin, setAdminData } from "../../../test/adminKit";
import { useToast } from "../ui/toastContext";
import { LayerProvider } from "../ui/layers";
import { SalaSheet } from "./Sheet";
import { StatusProvider, StatusStrip } from "./StatusStrip";

const who = vi.hoisted(() => ({ role: "superadmin" as string, uid: "a1", nickname: "adrian_tc", playerId: "adrian" as string | undefined, logout: async () => undefined as void, scorers: [] as string[] }));
vi.mock("../data/useAdminData", async () => ({ useAdminData: (await import("../../../test/adminMocks")).currentAdminData }));
vi.mock("../../../context/AuthContext", () => ({
  useAuth: () => ({ user: { uid: who.uid }, profile: { nickname: who.nickname, role: who.role, playerId: who.playerId, email: "x@y.z", createdAt: new Date(0) }, loading: false, logout: () => who.logout() }),
}));
vi.mock("../data/useCaja", () => ({ useCajaClaims: () => ({ data: [{ status: "pendiente" }, { status: "pendiente" }, { status: "confirmado" }], loading: false, error: false }) }));
vi.mock("../../vestuario/live", async (orig) => ({ ...(await orig<typeof import("../../vestuario/live")>()), useMatchScorers: () => ({ data: who.scorers, loading: false, error: false }) }));
// (the door reads the public matches: the fixture's, set in beforeEach — importing the kit here would deadlock the mock)
const club = vi.hoisted(() => ({ matches: [] as unknown[] }));
vi.mock("../../../lib/clubData", async (orig) => ({ ...(await orig<typeof import("../../../lib/clubData")>()), useClubData: () => ({ matches: club.matches, players: [], loading: false, error: null }) }));
// (adminKit's NOW: Monday 2 Nov 2026, 10:00 in Madrid)
vi.mock("../../../hooks/useMatchClock", () => ({ useMatchClock: () => Date.UTC(2026, 10, 2, 9, 0) }));
vi.mock("../../../lib/clubApi", () => ({ apiError: (e: unknown) => (e instanceof Error ? e.message : String(e)) }));

const WIDTH = window.innerWidth;
const wide = (w: number) => Object.defineProperty(window, "innerWidth", { configurable: true, value: w });
const sala = () => screen.getByRole("navigation", { name: "Sala de control" });

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  who.role = "superadmin";
  who.playerId = "adrian";
  who.scorers = [];
  who.logout = async () => undefined;
  club.matches = fixturePublished;
  setAdminData(adminFixture());
});
afterEach(() => wide(WIDTH));

describe("the desktop (≥ 1100): the web's bar with the capsule", () => {
  it("the crest and «Sala de control», the five places with their g + letter, their counters in words, search, the web, the avatar", async () => {
    wide(1440);
    mountAdmin("/admin");
    const nav = await screen.findByRole("navigation", { name: "Sala de control" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((a) => a.textContent?.replace(/\d+$/, ""))).toEqual(["Hoy", "Partidos", "Plantilla", "Caja", "Club"]);
    expect(links.map((a) => a.getAttribute("aria-keyshortcuts"))).toEqual(["g h", "g p", "g l", "g a", "g b"]);
    expect(within(nav).getByRole("link", { name: /^Hoy/ })).toHaveAttribute("aria-current", "page");
    // only what is yours to do, as a number and in words (the caja: the payments waiting)
    expect(within(nav).getByRole("link", { name: "Caja · 2 cosas por hacer" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sala de control, Hoy" })).toHaveAttribute("href", "/admin");
    expect(screen.getByRole("button", { name: "Buscar (Ctrl K)" })).toHaveAttribute("aria-keyshortcuts", "Control+K Meta+K");
    expect(screen.getByRole("link", { name: /Ver la web/ })).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("button", { name: "adrian_tc, Capitán general: abrir el menú" })).toBeInTheDocument();
    // one <main> (B-SH-04), the frame's, and no dock on the desktop
    expect(document.querySelectorAll("main")).toHaveLength(1);
    expect(document.querySelector("main")).toHaveAttribute("id", "contenido");
    expect(document.querySelector(".sc-dock")).toBeNull();
  });

  it("the avatar's menu: Mi perfil, the sala's season (the one picker), the theme and «Salir»", async () => {
    wide(1440);
    const user = userEvent.setup();
    const router = mountAdmin("/admin/partidos");
    await user.click(await screen.findByRole("button", { name: /abrir el menú/ }));
    const menu = screen.getByRole("menu", { name: "Tu cuenta" });
    expect(within(menu).getByRole("menuitem", { name: "Mi perfil" })).toHaveAttribute("href", "/perfil");
    const seasons = within(menu).getAllByRole("menuitemradio");
    expect(seasons.map((s) => s.textContent)).toEqual(["Temporada 1La de ahora", "Temporada 0 · pre-PitiArchivada"]);
    expect(seasons[0]).toHaveAttribute("aria-checked", "true");
    await user.click(seasons[1]);
    await waitFor(() => expect(router.state.location.search).toMatchObject({ season: "t0" }));
    expect(router.state.location.pathname).toBe("/admin/partidos");
  });

  it("«Salir en este dispositivo» that fails says why and leaves no «Has salido» behind (B-SH-08)", async () => {
    wide(1440);
    who.logout = async () => {
      throw new Error("sin red");
    };
    const user = userEvent.setup();
    mountAdmin("/admin");
    await user.click(await screen.findByRole("button", { name: /abrir el menú/ }));
    await user.click(screen.getByRole("menuitem", { name: "Salir en este dispositivo" }));
    const dialog = screen.getByRole("alertdialog", { name: "¿Salir en este dispositivo?" });
    await user.click(within(dialog).getByRole("button", { name: "Salir" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("No se ha podido cerrar la sesión: sin red");
    expect(sessionStorage.getItem("mp_door_notice")).toBeNull();
  });

  it("…and that works leaves the door its greeting", async () => {
    wide(1440);
    const user = userEvent.setup();
    mountAdmin("/admin");
    await user.click(await screen.findByRole("button", { name: /abrir el menú/ }));
    await user.click(screen.getByRole("menuitem", { name: "Salir en este dispositivo" }));
    await user.click(within(screen.getByRole("alertdialog", { name: "¿Salir en este dispositivo?" })).getByRole("button", { name: "Salir" }));
    await waitFor(() => expect(sessionStorage.getItem("mp_door_notice")).toBe("Has salido en este dispositivo"));
  });
});

describe("the phone: the header and the dock", () => {
  it("the header says the screen (a line, not a second h1: B-SH-09) and the dock has the five places", async () => {
    wide(390);
    mountAdmin("/admin/nada");
    expect(await screen.findByRole("heading", { level: 1, name: "Esta sección no existe" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const dock = document.querySelector(".sc-dock");
    expect(dock).toBeNull(); // (a screen with a way back hides the dock)
    expect(screen.getByRole("link", { name: "Volver a Hoy" })).toHaveAttribute("href", "/admin");
  });

  it("on a place: the dock, its counters in words, the current place on the bead", async () => {
    wide(390);
    mountAdmin("/admin/plantilla");
    const dock = await waitFor(() => sala());
    expect(dock).toHaveClass("sc-dock");
    expect(within(dock).getAllByRole("link")).toHaveLength(5);
    expect(within(dock).getByRole("link", { name: /^Plantilla/ })).toHaveAttribute("aria-current", "page");
    expect(within(dock).getByRole("link", { name: "Caja · 2 cosas por hacer" })).toBeInTheDocument();
    expect(document.querySelector(".sc-phead__h")?.textContent).toBe("Plantilla");
    expect(screen.queryByRole("link", { name: /^Volver/ })).toBeNull();
  });

  it("inside a match the dock hides and «‹» goes back to Partidos; the header names the match", async () => {
    wide(390);
    mountAdmin("/admin/partidos/m8");
    expect(await screen.findByRole("link", { name: "Volver a Partidos" })).toHaveAttribute("href", "/admin/partidos");
    expect(document.querySelector(".sc-dock")).toBeNull();
    expect(document.querySelector(".sc-phead__h")?.textContent).toBe("J3 · MAD SKY");
  });
});

describe("who looks", () => {
  it("someone inside without the armband: «Solo para la capitanía» in the sala's frame, no places, no captains' data", async () => {
    who.role = "user";
    who.playerId = undefined;
    wide(1440);
    mountAdmin("/admin/partidos");
    expect(await screen.findByRole("heading", { level: 1, name: "Solo para la capitanía" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver al vestuario" })).toHaveAttribute("href", "/vestuario");
    expect(screen.queryByRole("navigation", { name: "Sala de control" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Buscar/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Socio: abrir el menú/ })).toBeInTheDocument();
  });

  it("the anotador of the match that matters now sees his mesa (M-21)", async () => {
    who.role = "user";
    who.uid = "u-jorge";
    who.scorers = ["u-jorge"];
    wide(390);
    mountAdmin("/admin");
    const open = await screen.findByRole("link", { name: /^Abrir la mesa/ });
    expect(open.getAttribute("href")).toMatch(/^\/partidos\/m\d\/mesa$/);
    expect(screen.getByText(/Lo tuyo hoy es la mesa: anotas/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver al vestuario" })).toBeInTheDocument();
    who.uid = "a1";
  });
});

describe("the match: its head and the carril", () => {
  it("the J, the rival with its code, the date and its state; the six stations, the one of its moment lit", async () => {
    wide(1440);
    mountAdmin("/admin/partidos/m8");
    const h1 = await screen.findByRole("heading", { level: 1 });
    expect(h1).toHaveTextContent(/^Manchester Piti – MAD SKY$/);
    expect(screen.getByText("Código del rival: MAD")).toBeInTheDocument();
    expect(screen.getAllByText("J3 · Liga · dom 8 nov · 12:00 · fuera").length).toBeGreaterThan(0);
    expect(screen.getByText("En el calendario")).toHaveClass("sc-tag");
    const carril = screen.getByRole("navigation", { name: "Las estaciones del partido" });
    const stations = within(carril).getAllByRole("link");
    expect(stations).toHaveLength(6);
    expect(stations.map((s) => s.getAttribute("aria-label")?.split(":")[0])).toEqual(["1 de 6 · Convocatoria", "2 de 6 · Datos", "3 de 6 · La mesa", "4 de 6 · Acta", "5 de 6 · Publicar", "6 de 6 · Después"]);
    expect(stations[0]).toHaveAttribute("aria-current", "page");
    expect(screen.getByTestId("view")).toHaveTextContent("estación de su momento");
    expect(screen.getByRole("link", { name: /Ver en la web/ })).toHaveAttribute("href", "/partidos/m8");
  });

  it("← → walk the stations (the address changes, the carril follows)", async () => {
    wide(1440);
    const user = userEvent.setup();
    const router = mountAdmin("/admin/partidos/m8/convocatoria");
    await screen.findByRole("navigation", { name: "Las estaciones del partido" });
    await user.keyboard("{ArrowRight}");
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/partidos/m8/datos"));
    expect(screen.getByRole("link", { name: /^2 de 6 · Datos/ })).toHaveAttribute("aria-current", "page");
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/partidos/m8/convocatoria"));
  });

  it("a match that is not there says so, with the way back", async () => {
    wide(1440);
    mountAdmin("/admin/partidos/zzz/acta");
    expect(await screen.findByRole("heading", { level: 1, name: "Ese partido no está" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver a la lista" })).toHaveAttribute("href", "/admin/partidos");
  });
});

describe("the old addresses (DIRECTION.md § Redirecciones), the season kept", () => {
  it.each([
    ["/admin/convocar?j=m8", "/admin/partidos/m8/convocatoria"],
    ["/admin/partidos/m8?tab=encuentro", "/admin/partidos/m8/datos"],
    ["/admin?tab=seasons", "/admin/club/temporadas"],
    ["/admin/fichas", "/admin/plantilla/socios"],
    ["/admin/contenido?seccion=foto", "/admin/club/web/contacto"],
  ])("%s → %s", async (from, to) => {
    wide(1440);
    const router = mountAdmin(from);
    await waitFor(() => expect(router.state.location.pathname).toBe(to));
  });
  it("/admin/convocar without a match: the next one's convocatoria, the season kept", async () => {
    wide(1440);
    const router = mountAdmin("/admin/convocar?season=t1");
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/partidos/m8/convocatoria"));
    expect(router.state.location.search).toMatchObject({ season: "t1" });
  });
});

describe("the keyboard and the palette", () => {
  it("g then p goes to Partidos; n opens «Nuevo partido»; ⌘K opens the palette with the places", async () => {
    wide(1440);
    const user = userEvent.setup();
    const router = mountAdmin("/admin");
    await screen.findByRole("navigation", { name: "Sala de control" });
    await user.keyboard("gp");
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/partidos"));
    await user.keyboard("n");
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/partidos/nuevo"));
    await user.keyboard("{Control>}k{/Control}");
    const dialog = screen.getByRole("dialog", { name: "Buscar" });
    const sitios = within(dialog).getByRole("group", { name: "Sitios" });
    expect(within(sitios).getAllByRole("option").map((o) => o.querySelector("b")?.textContent)).toEqual(["Hoy", "Partidos", "Plantilla", "Caja", "Club"]);
    expect(within(sitios).getByRole("option", { name: /Caja/ })).toHaveAttribute("aria-keyshortcuts", "g a");
    await user.type(within(dialog).getByRole("combobox"), "erik");
    await user.keyboard("{Enter}");
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/plantilla/erik"));
  });
});

describe("the shared pieces", () => {
  const Harness = ({ children }: { children: ReactNode }) => {
    const root = createRootRoute({ component: () => <Outlet /> });
    const page = createRoute({ getParentRoute: () => root, path: "/", component: () => <>{children}</> });
    const router = createRouter({ routeTree: root.addChildren([page]), history: createMemoryHistory({ initialEntries: ["/"] }) });
    return <RouterProvider router={router} />;
  };
  function Saver() {
    const status = useToast();
    return (
      <>
        <button type="button" onClick={() => status.show({ tag: "Guardado", message: "ERIK · ficha guardada", undo: () => undefined })}>
          guardar
        </button>
        <button type="button" onClick={() => status.show({ tone: "error", message: "No se ha podido guardar: sin red", retry: () => undefined })}>
          fallar
        </button>
      </>
    );
  }
  it("the status strip: «Guardado · Deshacer» politely, an error as an alert with «Reintentar» and a way to close it; at rest, its line", async () => {
    const user = userEvent.setup();
    render(
      <StatusProvider>
        <Saver />
        <StatusStrip rest="Todo guardado · 20:00" />
      </StatusProvider>,
    );
    expect(screen.getByText("Todo guardado · 20:00")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "guardar" }));
    const polite = screen.getByRole("status");
    expect(polite).toHaveTextContent("GuardadoERIK · ficha guardadaDeshacer");
    await user.click(screen.getByRole("button", { name: "fallar" }));
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("No se ha podido guardar: sin red");
    expect(within(alert).getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
    await user.click(within(alert).getByRole("button", { name: "Cerrar el aviso" }));
    expect(screen.getByText("Todo guardado · 20:00")).toBeInTheDocument();
  });

  it("what waits behind «Deshacer» is written when the tab closes or the app is hidden, not lost", async () => {
    const user = userEvent.setup();
    const commits: string[] = [];
    function Deferrer() {
      const status = useToast();
      return (
        <button type="button" onClick={() => status.defer({ message: "ERIK · pago apuntado", commit: async () => void commits.push("pago") })}>
          apuntar
        </button>
      );
    }
    render(
      <StatusProvider>
        <Deferrer />
        <StatusStrip rest="Todo guardado · 20:00" />
      </StatusProvider>,
    );
    await user.click(screen.getByRole("button", { name: "apuntar" }));
    expect(commits).toEqual([]);
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    expect(commits).toEqual(["pago"]);
    // (once only: the timer that was waiting does not write it again)
    await user.click(screen.getByRole("button", { name: "apuntar" }));
    // (an own property over the prototype's getter, removed after)
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    Reflect.deleteProperty(document, "visibilityState");
    expect(commits).toEqual(["pago", "pago"]);
  });

  it("the sheet always has a real «Cerrar» (B-SH-05); Esc closes it too", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Harness>
        <LayerProvider>
          <SalaSheet open title="Archivar la J3" onClose={onClose}>
            <p>Sale del calendario.</p>
          </SalaSheet>
        </LayerProvider>
      </Harness>,
    );
    const sheet = await screen.findByRole("dialog", { name: "Archivar la J3" });
    await user.click(within(sheet).getByRole("button", { name: "Cerrar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await act(async () => {
      await user.keyboard("{Escape}");
    });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
