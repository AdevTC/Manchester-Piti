import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { z } from "zod";
import { describe, expect, it, vi } from "vitest";

// PlayerLink: the season's name, a real link to /jugadores/$playerId (with ?season= when it has one), and
// plain text for an id nobody in the squad has. Real router (memory history); data stubbed: no Firebase.

const PEPE = { id: "p1", shirtName: "PEPE", seasons: ["t1", "t2"], seasonDetails: { t2: { shirtName: "PEPITO" } } };
vi.mock("../../lib/clubData", async (orig) => ({ ...(await orig<typeof import("../../lib/clubData")>()), useClubData: () => ({ matches: [], players: [PEPE], loading: false, error: null }) }));

const { PlayerLink } = await import("./PlayerLink");

async function view(ui: ReactNode) {
  const root = createRootRoute({ validateSearch: z.object({ season: z.string().optional().catch("all") }), component: () => <>{ui}</> });
  const jugador = createRoute({ getParentRoute: () => root, path: "/jugadores/$playerId", component: () => null });
  const router = createRouter({ routeTree: root.addChildren([jugador]), history: createMemoryHistory({ initialEntries: ["/"] }) });
  render(<RouterProvider router={router} />);
  await router.load();
}

describe("PlayerLink", () => {
  it("names him as the season does and keeps the season in the link", async () => {
    await view(<PlayerLink id="p1" seasonId="t2" />);
    const a = await screen.findByRole("link", { name: "PEPITO" });
    expect(a).toHaveAttribute("href", "/jugadores/p1?season=t2");
    expect(a).toHaveClass("pl-link");
    expect(a).not.toHaveClass("quiet");
  });

  it("without a season: his name and a clean link", async () => {
    await view(<PlayerLink id="p1" />);
    expect(await screen.findByRole("link", { name: "PEPE" })).toHaveAttribute("href", "/jugadores/p1");
  });

  it("«all seasons» is no season in the link", async () => {
    await view(<PlayerLink id="p1" seasonId="all" />);
    expect(await screen.findByRole("link", { name: "PEPE" })).toHaveAttribute("href", "/jugadores/p1");
  });

  it("the caller's own text and the quiet look", async () => {
    await view(
      <PlayerLink id="p1" seasonId="t1" variant="quiet">
        Pepe el 9
      </PlayerLink>,
    );
    const a = await screen.findByRole("link", { name: "Pepe el 9" });
    expect(a).toHaveAttribute("href", "/jugadores/p1?season=t1");
    expect(a).toHaveClass("pl-link", "quiet");
  });

  it("an unknown id is plain text, never a link", async () => {
    await view(
      <p>
        Gol de <PlayerLink id="nadie">EL INVITADO</PlayerLink>
      </p>,
    );
    expect(await screen.findByText(/EL INVITADO/)).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("an unknown id without text reads «Jugador»", async () => {
    await view(<PlayerLink id="nadie" className="nm" />);
    const el = await screen.findByText("Jugador");
    expect(el.tagName).toBe("SPAN");
    expect(el).toHaveClass("nm");
    expect(screen.queryByRole("link")).toBeNull();
  });
});
