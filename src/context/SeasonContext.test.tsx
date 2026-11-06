import { render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

// The saved season and the server's page: taking over a server-painted page, the first render is the server's
// («all»), and the saved choice comes in right after; a page the client paints alone starts with it.
vi.mock("../lib/useFirestoreCollection", () => ({
  useFirestoreCollection: () => ({ data: [{ id: "t1", name: "Temporada 1" }, { id: "t2", name: "Temporada 2" }], isPending: false }),
}));

const { SeasonProvider, useSeason } = await import("./SeasonContext");

function Probe({ seen }: { seen: string[] }) {
  seen.push(useSeason().selectedSeasonId);
  return null;
}

afterEach(() => localStorage.clear());

it("hydrating a server page, the first render is the server's season and the saved one comes after", () => {
  localStorage.setItem("selected_season_id", "t1");
  const seen: string[] = [];
  render(
    <SeasonProvider>
      <Probe seen={seen} />
    </SeasonProvider>,
    { hydrate: true },
  );
  expect(seen[0]).toBe("all");
  expect(seen.at(-1)).toBe("t1");
});

it("a page the client paints alone starts with the saved season", () => {
  localStorage.setItem("selected_season_id", "t2");
  const seen: string[] = [];
  render(
    <SeasonProvider>
      <Probe seen={seen} />
    </SeasonProvider>,
  );
  expect(seen[0]).toBe("t2");
});
