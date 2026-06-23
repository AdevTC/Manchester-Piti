import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import {
  createRootRoute,
  createRouter,
  createMemoryHistory,
  RouterProvider,
} from "@tanstack/react-router";
import { z } from "zod";

// Mock SeasonContext so the test drives `useSeason()` directly (the real
// provider opens a Firestore subscription via useFirestoreCollection). We only
// need the reactive contract SeasonUrlSync depends on: the four fields it reads
// and the setSelectedSeasonId spy.
const seasonState = {
  selectedSeasonId: "all" as string,
  seasons: [] as { id: string; name: string }[],
  loadingSeasons: false,
  setSelectedSeasonId: vi.fn((id: string) => {
    seasonState.selectedSeasonId = id;
  }),
};
vi.mock("../context/SeasonContext", () => ({
  useSeason: () => seasonState,
}));

import { SeasonUrlSync } from "./SeasonUrlSync";

/** Build a memory router whose root mirrors the app's root search schema
 *  (`season` optional) and renders SeasonUrlSync. Returns the router so a test
 *  can read the resulting URL search and navigate. */
function buildRouter(initialEntries: string[]) {
  const rootRoute = createRootRoute({
    validateSearch: z.object({ season: z.string().optional().catch("all") }),
    component: SeasonUrlSync,
  });
  return createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries }),
  });
}

function currentSeasonParam(router: ReturnType<typeof buildRouter>): string | undefined {
  return (router.state.location.search as { season?: string }).season;
}

beforeEach(() => {
  seasonState.selectedSeasonId = "all";
  seasonState.seasons = [{ id: "s1", name: "Temp 1" }, { id: "s2", name: "Temp 2" }];
  seasonState.loadingSeasons = false;
  seasonState.setSelectedSeasonId.mockClear();
});

describe("SeasonUrlSync — deep-link (?season=X seeds context)", () => {
  it("adopta una temporada conocida de la URL al montar", async () => {
    const router = buildRouter(["/?season=s2"]);
    render(<RouterProvider router={router} />);

    await waitFor(() => expect(seasonState.setSelectedSeasonId).toHaveBeenCalledWith("s2"));
    // URL kept as-is (already explicit & known).
    expect(currentSeasonParam(router)).toBe("s2");
  });

  it("no re-setea si la temporada de la URL ya coincide con la selección", async () => {
    seasonState.selectedSeasonId = "s1";
    const router = buildRouter(["/?season=s1"]);
    render(<RouterProvider router={router} />);

    // Give the idempotent effect a chance to run.
    await waitFor(() => expect(router.state.status).toBe("idle"));
    expect(seasonState.setSelectedSeasonId).not.toHaveBeenCalled();
  });
});

describe("SeasonUrlSync — reset to 'all' for an unknown season", () => {
  it("una temporada desconocida en la URL cae a 'all' (contexto + URL)", async () => {
    seasonState.selectedSeasonId = "s1"; // currently on a real season
    const router = buildRouter(["/?season=does-not-exist"]);
    render(<RouterProvider router={router} />);

    await waitFor(() => expect(seasonState.setSelectedSeasonId).toHaveBeenCalledWith("all"));
    await waitFor(() => expect(currentSeasonParam(router)).toBe("all"));
  });

  it("espera a que las temporadas carguen antes de validar (no resetea en loading)", async () => {
    seasonState.loadingSeasons = true;
    seasonState.selectedSeasonId = "s1";
    const router = buildRouter(["/?season=maybe-valid"]);
    render(<RouterProvider router={router} />);

    await waitFor(() => expect(router.state.status).toBe("idle"));
    // Still loading → the explicit-season branch is skipped, no reset yet.
    expect(seasonState.setSelectedSeasonId).not.toHaveBeenCalled();
    expect(currentSeasonParam(router)).toBe("maybe-valid");
  });
});

describe("SeasonUrlSync — seed URL from context when absent", () => {
  it("siembra ?season en la URL desde la selección actual (no 'all')", async () => {
    seasonState.selectedSeasonId = "s2"; // a real season selected, but URL has none
    const router = buildRouter(["/"]);
    render(<RouterProvider router={router} />);

    await waitFor(() => expect(currentSeasonParam(router)).toBe("s2"));
    // Seeding the URL does not re-set context (URL was absent, not divergent).
    expect(seasonState.setSelectedSeasonId).not.toHaveBeenCalled();
  });

  it("mantiene la URL limpia cuando la selección es 'all'", async () => {
    seasonState.selectedSeasonId = "all";
    const router = buildRouter(["/"]);
    render(<RouterProvider router={router} />);

    await waitFor(() => expect(router.state.status).toBe("idle"));
    expect(currentSeasonParam(router)).toBeUndefined();
    expect(seasonState.setSelectedSeasonId).not.toHaveBeenCalled();
  });
});

describe("SeasonUrlSync — back-nav adopts the prior season", () => {
  it("al navegar (back/forward) a otra ?season, adopta el nuevo valor", async () => {
    seasonState.selectedSeasonId = "s1";
    const router = buildRouter(["/?season=s1"]);
    render(<RouterProvider router={router} />);

    // First the effect confirms s1 (already matches → no set).
    await waitFor(() => expect(router.state.status).toBe("idle"));
    expect(seasonState.setSelectedSeasonId).not.toHaveBeenCalled();

    // Navigate to s2 (simulating a selector/back-nav URL change).
    await router.navigate({ to: "/", search: { season: "s2" } });

    await waitFor(() => expect(seasonState.setSelectedSeasonId).toHaveBeenCalledWith("s2"));
  });
});
