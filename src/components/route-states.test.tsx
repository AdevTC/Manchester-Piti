import { render, screen, within } from "@testing-library/react";
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from "@tanstack/react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

// The router's error boundary: a page that fails shows the Celeste error with the site chrome (the
// page that brought its own is gone), offers «Reintentar», and never says «no encontrado». Inside the
// admin app it is the panel alone, with the way back to Hoy.

vi.mock("./ThemeToggle", () => ({ ThemeToggle: () => null }));
const { RouteError } = await import("./route-states");

function Boom(): never {
  throw new Error("Failed to fetch dynamically imported module");
}

function open(url: string) {
  const root = createRootRoute({ component: Outlet });
  const routes = ["/", "/partidos", "/matches/$matchId", "/admin", "/admin/partidos"].map((path) => createRoute({ getParentRoute: () => root, path, component: Boom }));
  const router = createRouter({ routeTree: root.addChildren(routes), history: createMemoryHistory({ initialEntries: [url] }), defaultErrorComponent: RouteError });
  render(<RouterProvider router={router} />);
}

describe("RouteError", () => {
  afterEach(() => vi.restoreAllMocks());

  it("a public page: the error in the Celeste chrome, its section lit, «Reintentar» and «Ir al inicio»", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    open("/matches/j1");
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
});
