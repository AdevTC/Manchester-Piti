import { screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { adminFixture, mountAdmin, setAdminData } from "../../../test/adminKit";

// The admin's «Ha jugado de» rates by position as every page does: the published matches only (no
// captain's drafts merged in) and the shared MVP reader (AdminData.mvpOf, derived/mvpOf).

const spy = vi.hoisted(() => ({ calls: [] as unknown[][] }));
vi.mock("../../../lib/positionStats", async (orig) => {
  const real = await orig<typeof import("../../../lib/positionStats")>();
  return {
    ...real,
    playerPositions: (...args: Parameters<typeof real.playerPositions>) => {
      spy.calls.push(args);
      return real.playerPositions(...args);
    },
  };
});
vi.mock("../data/useAdminData", async () => ({ useAdminData: (await import("../../../test/adminMocks")).currentAdminData }));
vi.mock("../../../context/AuthContext", async () => ({ useAuth: (await import("../../../test/adminMocks")).fakeAuth }));
vi.mock("../../../lib/clubApi", () => ({ apiError: (e: unknown) => String(e) }));
vi.mock("../club/useClubWrites", () => ({ useClubWrites: () => ({ newPlayerId: vi.fn(() => "nuevo1"), savePlayer: vi.fn(() => Promise.resolve()), deletePlayer: vi.fn(() => Promise.resolve()) }) }));
vi.mock("../../../components/jersey3d/useShirtStills", () => ({ useShirtStills: () => () => undefined }));

const { Plantilla } = await import("./Plantilla");

beforeEach(() => {
  localStorage.clear();
  spy.calls.length = 0;
});

it("the open ficha's positions read data.published and data.mvpOf, never the merged drafts", async () => {
  const data = adminFixture();
  setAdminData(data);
  mountAdmin("/admin/plantilla", { plantilla: Plantilla });
  expect(await screen.findByRole("heading", { level: 1, name: "Plantilla" })).toBeInTheDocument();
  expect(spy.calls.length).toBeGreaterThan(0);
  for (const c of spy.calls) {
    expect(c[1]).toBe(data.published);
    expect(c[1]).not.toBe(data.matches);
    expect(c[2]).toBe(data.mvpOf);
  }
});
