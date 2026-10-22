import { fireEvent, render, screen, within } from "@testing-library/react";
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from "@tanstack/react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

// The router's error boundary: a page that fails shows the Celeste error with the site chrome (the
// page that brought its own is gone), offers «Reintentar», and never says «no encontrado». Inside the
// admin app it is the panel alone, with the way back to Hoy.

vi.mock("./ThemeToggle", () => ({ ThemeToggle: () => null }));
const { RouteError } = await import("./route-states");

// fails while `boom.on`; «Reintentar» after the cause is gone renders the page
const boom = { on: true };
function Boom() {
  if (boom.on) throw new Error("Failed to fetch dynamically imported module");
  return <h1>de vuelta</h1>;
}

function open(url: string) {
  const root = createRootRoute({ component: Outlet });
  const routes = ["/", "/partidos", "/partidos/$matchId", "/admin", "/admin/partidos"].map((path) => createRoute({ getParentRoute: () => root, path, component: Boom }));
  const router = createRouter({ routeTree: root.addChildren(routes), history: createMemoryHistory({ initialEntries: [url] }), defaultErrorComponent: RouteError });
  render(<RouterProvider router={router} />);
  return router;
}

describe("RouteError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    boom.on = true;
  });

  it("a public page: the error in the Celeste chrome, its section lit, «Reintentar» and «Ir al inicio»", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    open("/partidos/j1");
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByRole("heading", { level: 1, name: "Algo se ha torcido" })).toBeInTheDocument();
    expect(within(alert).getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
    expect(within(alert).getByRole("link", { name: "Ir al inicio" })).toHaveAttribute("href", "/");
    expect(within(alert).getByText("Failed to fetch dynamically imported module")).toBeInTheDocument();
    expect(alert.textContent).not.toMatch(/no encontrad/i);
    const nav = screen.getByRole("navigation", { name: "Navegación principal" });
    expect(within(nav).getByRole("link", { name: "Partidos" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("navigation", { name: "Navegación móvil" })).toBeInTheDocument();
  });

  it("inside the admin app: the panel alone (no public chrome), back to Hoy", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    open("/admin/partidos");
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByRole("link", { name: "Ir a Hoy" })).toHaveAttribute("href", "/admin");
    expect(screen.queryByRole("navigation", { name: "Navegación principal" })).toBeNull();
  });

  it("«Reintentar» re-runs the loaders (router.invalidate) and resets the boundary: the page comes back", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const router = open("/partidos");
    const invalidate = vi.spyOn(router, "invalidate");
    const retry = await screen.findByRole("button", { name: "Reintentar" });
    boom.on = false;
    fireEvent.click(retry);
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("heading", { name: "de vuelta" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
