import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

// /club (CL- boards): the hub paints the vitrina and its four doors for the afición; a door moves to its room's
// address; the address names the room and the piece in focus. Router, data, the member reads and the stills are
// stubbed: no Firebase, no WebGL.

const nav = vi.hoisted(() => ({ pathname: "/club", navigate: vi.fn(() => Promise.resolve()) }));
vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: nav.pathname, search: {} }),
  useSearch: () => ({}),
  useRouter: () => ({ navigate: nav.navigate }),
}));
vi.mock("../../lib/clubContent", async (orig) => {
  const real = await orig<typeof import("../../lib/clubContent")>();
  return { ...real, useClubContent: () => real.DEFAULT_CONTENT };
});
const squad = vi.hoisted(() => [
  { id: "cap", shirtName: "EL CAPI", firstName: "Juan", lastName: "Capi", seasons: ["t1"], number: 4, birthDate: "2004-10-27" },
  { id: "kev", shirtName: "KEVIN", firstName: "Kevin", lastName: "Jumbo", seasons: ["t1"], number: 11 },
]);
vi.mock("../../lib/clubData", async (orig) => ({ ...(await orig<typeof import("../../lib/clubData")>()), useClubData: () => ({ matches: [], players: squad, loading: false, error: null }) }));
vi.mock("../../context/SeasonContext", () => ({ useSeason: () => ({ seasons: [{ id: "t1", name: "Temporada 1", captainPlayerId: "cap" }], selectedSeasonId: "t1", loadingSeasons: false }) }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: null, profile: null }) }));
vi.mock("../../hooks/useViewer", () => ({ useViewer: () => ({ member: false, admin: false, playerId: null }) }));
vi.mock("../../hooks/useClock", () => ({ useClock: () => Date.parse("2026-10-22T10:00:00Z") }));
vi.mock("../../hooks/useDocumentTheme", () => ({ useDocumentTheme: () => "dark" }));
vi.mock("../../lib/useStandings", () => ({ useStandings: () => ({ standings: null, loading: false }) }));
vi.mock("../vestuario/live", () => ({ useMvpResults: () => new Map() }));
vi.mock("../vestuario/vx/summary", () => ({ useVxSummary: () => ({ yes: 0, maybe: 0, no: 0, pending: 2, knocking: [], owes: false, mine: undefined, myTurn: null }) }));
vi.mock("../../components/ThemeToggle", () => ({ ThemeToggle: () => null }));
vi.mock("../../components/celeste/Chrome", () => ({ CelesteDock: () => null, CelesteHeader: () => null }));
vi.mock("../../components/jersey3d/useShirtStills", () => ({ useShirtStills: () => () => undefined }));
vi.mock("../../components/vidrio", () => ({ useLightPointer: () => undefined }));

const { ClubPage } = await import("./ClubPage");

beforeEach(() => {
  nav.pathname = "/club";
  nav.navigate.mockClear();
});

it("the hub: the vitrina with the crest on its peana and the four doors", () => {
  render(<ClubPage />);
  expect(screen.getByRole("heading", { level: 1, name: "El club" })).toBeInTheDocument();
  expect(screen.getByText("Nº 01 · El escudo")).toBeInTheDocument();
  const doors = screen.getByRole("navigation", { name: "Las salas del club" });
  expect([...doors.querySelectorAll("button")].map((b) => b.querySelector(".cb-door__t")?.textContent)).toEqual(["La historia", "El equipo", "La gente", "El vestuario"]);
  expect(screen.getByRole("button", { name: /^El vestuario\. Solo plantilla/ })).toBeInTheDocument();
});

it("a door opens its room's address", () => {
  render(<ClubPage />);
  fireEvent.click(screen.getByRole("button", { name: /^La gente\./ }));
  expect(nav.navigate).toHaveBeenCalledWith({ href: "/club/gente", replace: undefined });
});

it("the address names the room: La gente with the next birthday and the afición's invitation", () => {
  nav.pathname = "/club/gente";
  render(<ClubPage />);
  expect(screen.getByRole("heading", { level: 1, name: "La gente" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "El Capi cumple 22 el martes 27" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "¿Juegas en el Piti?" })).toBeInTheDocument();
});

it("a piece in the address is the one on the peana", () => {
  nav.pathname = "/club/vitrina/primera-copa";
  render(<ClubPage />);
  expect(screen.getByText("Nº 10 · La primera copa")).toBeInTheDocument();
});
