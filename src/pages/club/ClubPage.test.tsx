import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";

// /club «La plantilla en números»: the captain's name leads to his page, in the season. Router, data,
// content and the 3D kit are stubbed: no Firebase, no WebGL.

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className, to, params, search }: { children?: ReactNode; className?: string; to?: string; params?: Record<string, string>; search?: { season?: string } }) => (
    <a className={className} href={to === "/jugadores/$playerId" ? `/jugadores/${params?.playerId}${search?.season ? `?season=${search.season}` : ""}` : (to ?? "#")}>
      {children}
    </a>
  ),
}));
const squad = vi.hoisted(() => [{ id: "cap", shirtName: "EL CAPI", seasons: ["t1"], number: 4 }]);
const fail = vi.hoisted(() => ({ error: null as Error | null }));
vi.mock("../../lib/clubContent", async (orig) => {
  const real = await orig<typeof import("../../lib/clubContent")>();
  return { ...real, useClubContent: () => real.DEFAULT_CONTENT };
});
vi.mock("../../lib/clubData", async (orig) => ({ ...(await orig<typeof import("../../lib/clubData")>()), useClubData: () => (fail.error ? { matches: [], players: [], loading: false, error: fail.error } : { matches: [], players: squad, loading: false, error: null }) }));
vi.mock("../../context/SeasonContext", () => ({ useSeason: () => ({ seasons: [{ id: "t1", name: "Temporada 1", captainPlayerId: "cap" }], selectedSeasonId: "t1", loadingSeasons: false }) }));
vi.mock("../../hooks/useClock", () => ({ useClock: () => Date.UTC(2026, 8, 20) }));
vi.mock("../../hooks/useDocumentTheme", () => ({ useDocumentTheme: () => "dark" }));
vi.mock("../../components/ThemeToggle", () => ({ ThemeToggle: () => null }));
vi.mock("../../components/NewBadge", () => ({ NewBadge: () => null }));
vi.mock("../../components/celeste/AddToCalendar", () => ({ AddToCalendar: () => null }));
vi.mock("../../components/celeste/Chrome", () => ({ CelesteBackdrop: () => null, CelesteDock: () => null, CelesteFooter: () => null, CelesteHeader: () => null }));
vi.mock("../../components/jersey3d/Jersey3D", () => ({ Jersey3D: () => null }));
vi.mock("./Vitrina", () => ({ Vitrina: () => null }));
vi.mock("./PlantillaPosiciones", () => ({ PlantillaPosiciones: () => null }));

const { ClubPage } = await import("./ClubPage");

it("the captain is a link to his page, in the season", () => {
  render(<ClubPage />);
  const dd = screen.getByText("Capitán").nextElementSibling as HTMLElement;
  const a = screen.getByRole("link", { name: "EL CAPI" });
  expect(dd).toContainElement(a);
  expect(a).toHaveAttribute("href", "/jugadores/cap?season=t1");
  expect(a).toHaveClass("pl-link");
});

it("the data did not arrive: an inline error instead of the trophy room and a squad of zeros; the rest stays", () => {
  fail.error = new Error("unavailable");
  render(<ClubPage />);
  const alert = screen.getByRole("alert");
  expect(within(alert).getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "La sala de trofeos" })).toBeNull();
  expect(screen.queryByRole("heading", { name: "La plantilla en números" })).toBeNull();
  expect(screen.getByRole("heading", { level: 1, name: "El club" })).toBeInTheDocument();
  fail.error = null;
});
