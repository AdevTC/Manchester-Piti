import { act, fireEvent, render, screen } from "@testing-library/react";
import { createBrowserHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from "@tanstack/react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { LineupDoc } from "../lineupDoc";
import type { UseLineups } from "../useLineups";
import { useBoardSession } from "./useBoardSession";
import { useForgetDeepLink } from "./deeplink";
import { lineupOf } from "./testkit";

// /pizarra?tablero=X opens X once: the link is then taken out of the URL, so switching to Y and
// reloading (or a PWA resume, or Back) reopens Y — not X again, nor «ya no existe» once X is deleted.

const doc = (id: string): LineupDoc => ({
  ...lineupOf(["evans", "illescas"]),
  id,
  ownerUid: "me",
  ownerNickname: "yo",
  seasonId: "t1",
  name: "Tablero " + id,
  isOfficial: false,
  matchId: null,
  createdAt: 1,
  updatedAt: id === "x" ? 1 : 2,
});

const lineups = (docs: LineupDoc[]): UseLineups => ({
  mine: docs,
  official: [],
  all: docs,
  loading: false,
  create: vi.fn(async () => "new1"),
  save: vi.fn(async () => undefined),
  rename: vi.fn(async () => undefined),
  remove: vi.fn(async () => undefined),
  markOfficial: vi.fn(async () => undefined),
});

function Harness({ store }: { store: UseLineups }) {
  const s = useBoardSession({ seasonId: "t1", lineups: store, squadIds: ["evans", "illescas"], squadReady: true, uid: "me", isAdmin: false, draftName: "Borrador" });
  useForgetDeepLink(s.ready);
  return (
    <>
      <p>En pantalla: {s.name}</p>
      <p>{s.notice?.msg}</p>
      <button type="button" onClick={() => s.open("y")}>Abrir Y</button>
    </>
  );
}

/** A fresh app on the browser's current URL (a reload). */
function boot(store: UseLineups) {
  const root = createRootRoute({ component: Outlet });
  const pizarra = createRoute({ getParentRoute: () => root, path: "/pizarra", validateSearch: z.object({ tablero: z.string().optional(), season: z.string().optional() }), component: () => <Harness store={store} /> });
  const router = createRouter({ routeTree: root.addChildren([pizarra]), history: createBrowserHistory() });
  return { router, ...render(<RouterProvider router={router} />) };
}

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/pizarra");
});

describe("useForgetDeepLink", () => {
  it("deep link to X, switch to Y, reload → Y; the link is gone from the URL (the season stays)", async () => {
    window.history.replaceState(null, "", "/pizarra?season=t1&tablero=x");
    const store = lineups([doc("x"), doc("y")]);
    const a = boot(store);
    expect(await screen.findByText("En pantalla: Tablero x")).toBeInTheDocument();
    await vi.waitFor(() => expect(window.location.search).toBe("?season=t1"));
    expect(a.router.state.location.search).toEqual({ season: "t1" });
    fireEvent.click(screen.getByRole("button", { name: "Abrir Y" }));
    expect(screen.getByText("En pantalla: Tablero y")).toBeInTheDocument();
    a.unmount();

    boot(store);
    expect(await screen.findByText("En pantalla: Tablero y")).toBeInTheDocument();
  });

  it("a link to a deleted board says so once; the reload does not say it again", async () => {
    window.history.replaceState(null, "", "/pizarra?tablero=gone");
    const store = lineups([doc("y")]);
    const a = boot(store);
    expect(await screen.findByText("Ese tablero ya no existe o no es de esta temporada")).toBeInTheDocument();
    await vi.waitFor(() => expect(window.location.search).toBe(""));
    a.unmount();

    boot(store);
    expect(await screen.findByText("En pantalla: Tablero y")).toBeInTheDocument();
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByText("Ese tablero ya no existe o no es de esta temporada")).toBeNull();
  });
});
