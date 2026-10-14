import { act, fireEvent, render, screen } from "@testing-library/react";
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from "@tanstack/react-router";
import { z } from "zod";
import { beforeEach, describe, expect, it } from "vitest";
import { _resetTrailForTesting, useRecordTrail } from "../../lib/backTrail";
import { BackLink } from "./BackLink";

// «Volver» with memory: a real router (memory history), the trail recorded by the root as RootLayout
// does. From another page of the app it steps back to it (past the page's own tab entries); on a deep
// link it is the section's link.

function Root() {
  useRecordTrail();
  return <Outlet />;
}

function setup(url: string) {
  const root = createRootRoute({ component: Root });
  const page = (path: string, name: string) => createRoute({ getParentRoute: () => root, path, component: () => <h1>{name}</h1> });
  const match = createRoute({
    getParentRoute: () => root,
    path: "/matches/$matchId",
    validateSearch: z.object({ tab: z.string().optional() }),
    component: () => (
      <>
        <h1>ficha</h1>
        <BackLink className="fc-back" to="/partidos" label="Partidos" />
      </>
    ),
  });
  const router = createRouter({
    routeTree: root.addChildren([page("/", "inicio"), page("/stats", "stats"), page("/partidos", "partidos"), match]),
    history: createMemoryHistory({ initialEntries: [url] }),
  });
  render(<RouterProvider router={router} />);
  return router;
}

describe("BackLink", () => {
  beforeEach(() => {
    _resetTrailForTesting();
    sessionStorage.clear();
  });

  it("a deep link: «Partidos», a link to the section, and a click goes there", async () => {
    const router = setup("/matches/j1");
    const back = await screen.findByRole("link", { name: "Partidos" });
    expect(back).toHaveAttribute("href", "/partidos");
    expect(back).toHaveClass("fc-back");
    fireEvent.click(back);
    expect(await screen.findByRole("heading", { name: "partidos" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/partidos");
  });

  it("came from the stats: «Volver» goes back there (a history step, not a new entry)", async () => {
    const router = setup("/stats");
    expect(await screen.findByRole("heading", { name: "stats" })).toBeInTheDocument();
    await act(() => router.navigate({ to: "/matches/$matchId", params: { matchId: "j1" } }));
    const back = await screen.findByRole("link", { name: "Volver" });
    // its href is still the section (a new tab, a copied link)
    expect(back).toHaveAttribute("href", "/partidos");
    const length = router.history.length;
    fireEvent.click(back);
    expect(await screen.findByRole("heading", { name: "stats" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/stats");
    expect(router.history.length).toBe(length);
  });

  it("past the page's own tab entries: back to the page before them", async () => {
    const router = setup("/");
    expect(await screen.findByRole("heading", { name: "inicio" })).toBeInTheDocument();
    await act(() => router.navigate({ to: "/matches/$matchId", params: { matchId: "j1" } }));
    await act(() => router.navigate({ to: "/matches/$matchId", params: { matchId: "j1" }, search: { tab: "campo" } }));
    await act(() => router.navigate({ to: "/matches/$matchId", params: { matchId: "j1" }, search: { tab: "pulso" } }));
    fireEvent.click(await screen.findByRole("link", { name: "Volver" }));
    expect(await screen.findByRole("heading", { name: "inicio" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");
  });

  it("a deep link then its tabs: still the section", async () => {
    const router = setup("/matches/j1");
    expect(await screen.findByRole("heading", { name: "ficha" })).toBeInTheDocument();
    await act(() => router.navigate({ to: "/matches/$matchId", params: { matchId: "j1" }, search: { tab: "campo" } }));
    expect(await screen.findByRole("link", { name: "Partidos" })).toHaveAttribute("href", "/partidos");
  });

  it("a modified click (new tab) is left to the browser: no history step", async () => {
    const router = setup("/stats");
    expect(await screen.findByRole("heading", { name: "stats" })).toBeInTheDocument();
    await act(() => router.navigate({ to: "/matches/$matchId", params: { matchId: "j1" } }));
    const back = await screen.findByRole("link", { name: "Volver" });
    fireEvent.click(back, { ctrlKey: true });
    expect(router.state.location.pathname).toBe("/matches/j1");
  });
});
