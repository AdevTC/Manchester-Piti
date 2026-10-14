import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRootRoute, createRouter, createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { z } from "zod";

// Real SeasonProvider + real SeasonUrlSync + the helper: only the Firestore subscription is stubbed.
vi.mock("./useFirestoreCollection", () => ({
  useFirestoreCollection: () => ({
    data: [
      { id: "s1", name: "Temporada 1", archived: false },
      { id: "s2", name: "Temporada 2", archived: false },
    ],
    isPending: false,
  }),
}));

import { SeasonProvider, useSeason } from "../context/SeasonContext";
import { SeasonUrlSync } from "../components/SeasonUrlSync";
import { ALL_SEASONS_LABEL, useSetSeason } from "./useSetSeason";

function Picker() {
  const { seasons, selectedSeasonId } = useSeason();
  const setSeason = useSetSeason();
  return (
    <>
      <select aria-label="Temporada" value={selectedSeasonId} onChange={(e) => setSeason(e.target.value)}>
        <option value="all">{ALL_SEASONS_LABEL}</option>
        {seasons.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <output data-testid="ctx">{selectedSeasonId}</output>
    </>
  );
}

function Root() {
  return (
    <>
      <SeasonUrlSync />
      <Picker />
    </>
  );
}

function mount() {
  const rootRoute = createRootRoute({
    validateSearch: z.object({ season: z.string().optional().catch("all") }),
    component: Root,
  });
  const router = createRouter({ routeTree: rootRoute, history: createMemoryHistory({ initialEntries: ["/"] }) });
  render(
    <SeasonProvider>
      <RouterProvider router={router} />
    </SeasonProvider>,
  );
  return router;
}

const urlSeason = (r: ReturnType<typeof mount>) => (r.state.location.search as { season?: string }).season;

beforeEach(() => localStorage.clear());

describe("useSetSeason", () => {
  it("dos cambios seguidos de temporada (incluida «Todo el historial») se mantienen", async () => {
    const user = userEvent.setup();
    const router = mount();
    const select = await screen.findByRole("combobox", { name: "Temporada" });

    await user.selectOptions(select, "s2");
    await waitFor(() => expect(screen.getByTestId("ctx")).toHaveTextContent("s2"));

    await user.selectOptions(select, "s1");
    await waitFor(() => expect(urlSeason(router)).toBe("s1"));
    await waitFor(() => expect(screen.getByTestId("ctx")).toHaveTextContent("s1"));
    expect(select).toHaveValue("s1");

    await user.selectOptions(select, "all");
    await waitFor(() => expect(urlSeason(router)).toBe("all"));
    await waitFor(() => expect(screen.getByTestId("ctx")).toHaveTextContent("all"));
    expect(select).toHaveValue("all");

    // And it stays there once the sync has settled.
    await waitFor(() => expect(router.state.status).toBe("idle"));
    expect(screen.getByTestId("ctx")).toHaveTextContent("all");
    expect(urlSeason(router)).toBe("all");
  });

  it("el rótulo de «todas» es «Todo el historial»", () => {
    expect(ALL_SEASONS_LABEL).toBe("Todo el historial");
  });
});
