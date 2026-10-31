import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The door's hook with its world faked: a signed-in fan with a profile-less account, no invitation, and the
// request as the TeamContext listener reports it (set per test).
const team = vi.hoisted(() => ({ request: null as { status: string; playerId?: string } | null }));
const api = vi.hoisted(() => ({ resolve: null as null | ((v: unknown) => void) }));

vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: "fan", displayName: "Fichaje" }, profile: null, loginWithGoogle: vi.fn() }) }));
vi.mock("../../context/TeamContext", () => ({ useTeam: () => ({ member: false, request: team.request, exit: vi.fn() }) }));
vi.mock("../../context/SeasonContext", () => ({ useSeason: () => ({ seasons: [] }) }));
vi.mock("../../lib/clubData", () => ({ useClubData: () => ({ matches: [], players: [] }), nextFixture: () => undefined, playerForSeason: (p: unknown) => p, playerName: () => "" }));
vi.mock("../../lib/vestuario", async (importOriginal) => ({ ...(await importOriginal<object>()), currentSeasonId: () => "s1", kickoffLabel: () => "" }));
vi.mock("../../lib/clubApi", () => ({
  apiError: () => "error",
  cancelAccessRequest: vi.fn(),
  doorShirts: () => Promise.resolve({ data: { taken: [], inside: 0 } }),
  inviteInfo: vi.fn(),
  joinWithInvite: vi.fn(),
  requestAccess: () => new Promise((resolve) => (api.resolve = resolve)),
}));
vi.mock("../../lib/doorWelcome", () => ({ useWelcome: () => null, startWelcome: vi.fn(), endWelcome: vi.fn(), walkOut: vi.fn() }));
vi.mock("../../lib/doorNotice", () => ({ takeDoorNotice: () => "", onDoorNotice: () => () => undefined }));
vi.mock("../../lib/push", () => ({ pushState: () => "unsupported", savedTopics: () => [], toggleTopic: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({ useRouterState: ({ select }: { select: (s: unknown) => unknown }) => select({ location: { pathname: "/vestuario", search: "" } }) }));

const { useDoor } = await import("./useDoor");

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>;
}

describe("la puerta · «Cambiar ficha»", () => {
  beforeEach(() => {
    team.request = null;
    api.resolve = null;
  });

  it("a request still on its way back does not close the chooser opened after it was sent", async () => {
    const { result, rerender } = renderHook(() => useDoor(), { wrapper });
    expect(result.current.step).toBe("quien-eres");

    // «Pedir acceso»: the listener sees the request before the call comes back, so the screen already waits…
    act(() => void result.current.send({ playerId: "p1" }));
    team.request = { status: "pending", playerId: "p1" };
    rerender();
    expect(result.current.step).toBe("pendiente");

    // …and «Cambiar ficha» is pressed in that moment
    act(() => result.current.choose());
    expect(result.current.step).toBe("quien-eres");

    // the call comes back: the chooser stays open
    await act(async () => api.resolve?.({ data: { status: "pending" } }));
    await waitFor(() => expect(result.current.busy).toBe(""));
    expect(result.current.step).toBe("quien-eres");
  });

  it("asking again from the chooser goes back to waiting", async () => {
    team.request = { status: "pending", playerId: "p1" };
    const { result } = renderHook(() => useDoor(), { wrapper });
    expect(result.current.step).toBe("pendiente");
    act(() => result.current.choose());
    expect(result.current.step).toBe("quien-eres");

    act(() => void result.current.send({ playerId: "p2" }));
    await act(async () => api.resolve?.({ data: { status: "pending" } }));
    await waitFor(() => expect(result.current.step).toBe("pendiente"));
  });
});
