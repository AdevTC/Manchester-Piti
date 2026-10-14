import { act, render, screen } from "@testing-library/react";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

// The app's real router and layout: an unknown address is the 404 («Fuera de juego») with the Celeste
// chrome, never a silent redirect; a member who is not a captain, on /admin, gets a Celeste page that
// sends him to the vestuario. The legacy Navbar is stubbed so its absence can be checked; auth, team
// and the lazy pages are stubbed (no Firebase).

const who = vi.hoisted(() => ({ role: null as string | null, member: false, ready: true, loading: false }));
vi.mock("./context/AuthContext", () => ({
  useAuth: () => ({ profile: who.role ? { role: who.role } : null, loading: who.loading }),
}));
vi.mock("./context/TeamContext", () => ({ useTeam: () => ({ member: who.member, ready: who.ready }) }));
vi.mock("./components/Navbar", () => ({ Navbar: () => <nav aria-label="menú antiguo" /> }));
vi.mock("./components/SeasonUrlSync", () => ({ SeasonUrlSync: () => null }));
vi.mock("./components/ThemeToggle", () => ({ ThemeToggle: () => null }));
vi.mock("./components/celeste/LiveIsland", () => ({ LiveIsland: () => null }));
vi.mock("./pages/acceso/AccessGate", () => ({ AccessGate: () => <p>la puerta</p> }));
vi.mock("./pages/admin/shell/AdminLayout", () => ({ AdminLayout: () => <p>sala de control</p> }));
vi.mock("./pages/admin/views/Hoy", () => ({ Hoy: () => null }));
vi.mock("./pages/partidos/PartidosPage", () => ({ PartidosPage: () => <h1>la página de partidos</h1> }));
vi.mock("./pages/squad/SquadPage", () => ({ SquadPage: () => <h1>la percha</h1> }));

const { createAppRouter } = await import("./router");

const open = (url: string) => {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [url] }));
  render(<RouterProvider router={router} />);
  return router;
};
const legacyMenu = () => screen.queryByRole("navigation", { name: "menú antiguo" });

describe("RootLayout · the 404 route", () => {
  it("an unknown address: «Fuera de juego», a way to Inicio and Partidos, the Celeste chrome and no redirect", async () => {
    const router = open("/esto/no/existe");
    expect(await screen.findByRole("heading", { level: 1, name: "Fuera de juego" })).toBeInTheDocument();
    expect(screen.getByText(/Esta jugada no existe/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir al inicio" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Ver los partidos" })).toHaveAttribute("href", "/partidos");
    expect(screen.getByRole("navigation", { name: "Navegación principal" })).toBeInTheDocument();
    expect(legacyMenu()).toBeNull();
    expect(router.state.location.pathname).toBe("/esto/no/existe");
  });

  it("the catch-all never takes an address the app has", () => {
    const router = createAppRouter(createMemoryHistory({ initialEntries: ["/"] }));
    const leaf = (path: string) => router.matchRoutes(path, {}).at(-1)?.routeId;
    for (const path of ["/", "/partidos", "/stats", "/plantilla", "/club", "/vestuario", "/pizarra", "/profile", "/matches/j1", "/jugadores/erik", "/admin", "/admin/partidos/j1", "/invitacion/abc"])
      expect(leaf(path), path).not.toBe("/$");
    expect(leaf("/partido")).toBe("/$");
    expect(leaf("/adminx")).toBe("/$");
  });

  it("while it is up, robots are told not to index it; leaving it takes the tag away", async () => {
    const router = open("/nada");
    expect(await screen.findByRole("heading", { level: 1, name: "Fuera de juego" })).toBeInTheDocument();
    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute("content", "noindex");
    await act(() => router.navigate({ to: "/partidos" }));
    expect(await screen.findByRole("heading", { name: "la página de partidos" })).toBeInTheDocument();
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
  });

  it("the bare /matches and /jugadores lead to their sections, not the 404", async () => {
    const router = open("/matches");
    expect(await screen.findByRole("heading", { name: "la página de partidos" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/partidos");
    const other = open("/jugadores");
    expect(await screen.findByRole("heading", { name: "la percha" })).toBeInTheDocument();
    expect(other.state.location.pathname).toBe("/plantilla");
    expect(screen.queryByText("Fuera de juego")).toBeNull();
  });
});

describe("RootLayout · /admin for a member who is not a captain", () => {
  afterEach(() => {
    who.role = null;
    who.member = false;
    who.ready = true;
    who.loading = false;
  });

  it("while the session is still being checked: the neutral wait, no capitanía panel flashing first", async () => {
    who.role = "member";
    who.member = true;
    who.loading = true;
    open("/admin");
    expect(await screen.findByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("Solo para la capitanía")).toBeNull();
    expect(legacyMenu()).toBeNull();
    who.loading = false;
    who.ready = false;
    open("/admin/partidos");
    expect(screen.queryByText("Solo para la capitanía")).toBeNull();
  });

  it("«Solo para la capitanía», back to the vestuario, in the Celeste chrome (not the old menu)", async () => {
    who.role = "member";
    who.member = true;
    open("/admin");
    expect(await screen.findByRole("heading", { level: 1, name: "Solo para la capitanía" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver al vestuario" })).toHaveAttribute("href", "/vestuario");
    expect(screen.queryByText("sala de control")).toBeNull();
    expect(legacyMenu()).toBeNull();
  });

  it("a captain gets the Sala de control", async () => {
    who.role = "admin";
    who.member = true;
    open("/admin");
    expect(await screen.findByText("sala de control")).toBeInTheDocument();
    expect(screen.queryByText("Solo para la capitanía")).toBeNull();
  });
});
