import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { longSeasonFixture } from "../../lib/derived/vidrio/fixtures";

// «El partido» (/partidos/<id>): the page with the long demo season (J5 played, J17 live at minute 23, J18 to
// play). Data, season, clock, viewer, live reads and the router are stubbed; the address is `route` and every
// navigation the page asks for is recorded (the test moves `route` itself when it wants the page to follow).
// Covers the screens following the address, the moviola (seek, play, ?min= written in place) and the match change
// (b7a78403: a replay running on one match stops on the next), the sheets (?hoja=) and the page's states.

const F = longSeasonFixture();
const clock = vi.hoisted(() => ({ now: 0 }));
const data = vi.hoisted(() => ({ matches: [] as unknown[], players: [] as unknown[], error: null as Error | null, loading: false }));
const route = vi.hoisted(() => ({
  path: "/partidos/j5",
  search: {} as Record<string, unknown>,
  navigate: vi.fn<(to: { href: string; replace?: boolean; resetScroll?: boolean }) => Promise<void>>(() => Promise.resolve()),
  back: vi.fn(),
}));
const who = vi.hoisted(() => ({ member: false, admin: false, playerId: null as string | null }));
const seasons = vi.hoisted(() => ({ list: [] as { id: string; name: string; captainPlayerId?: string }[] }));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className, to }: { children?: ReactNode; className?: string; to?: string }) => (
    <a className={className} href={to ?? "#"}>
      {children}
    </a>
  ),
  useNavigate: () => route.navigate,
  useRouter: () => ({ navigate: route.navigate, history: { back: route.back } }),
  useLocation: () => ({ pathname: route.path, search: route.search }),
  useSearch: () => route.search,
}));
vi.mock("../../lib/clubData", async (orig) => ({
  ...(await orig<typeof import("../../lib/clubData")>()),
  useClubData: () => ({ matches: data.matches, players: data.players, loading: data.loading, error: data.error }),
}));
vi.mock("../../context/SeasonContext", () => ({ useSeason: () => ({ seasons: seasons.list, selectedSeasonId: "all", loadingSeasons: false }) }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: who.member ? { uid: "u-jordi" } : null, profile: null, loading: false }) }));
vi.mock("../../context/TeamContext", () => ({ useTeam: () => ({ member: who.member, ready: true }) }));
vi.mock("../../hooks/useViewer", () => ({ useViewer: () => ({ member: who.member, admin: who.admin, playerId: who.playerId }) }));
vi.mock("../../hooks/useMatchClock", () => ({ useMatchClock: () => clock.now }));
vi.mock("../../hooks/useClock", async (orig) => ({ ...(await orig<typeof import("../../hooks/useClock")>()), useClock: () => clock.now }));
vi.mock("../../hooks/useSyncChip", () => ({ useSyncChip: () => null }));
vi.mock("../../hooks/useDocumentTheme", () => ({ useDocumentTheme: () => "dark" }));
vi.mock("../../lib/useStandings", () => ({ useStandings: () => ({ standings: null, loading: false }) }));
vi.mock("../../lib/weather", async (orig) => ({ ...(await orig<typeof import("../../lib/weather")>()), useMatchWeather: () => null, useMatchWeatherHourly: () => null }));
vi.mock("../../lib/useRotaTurns", () => ({ useMatchTurns: () => ({ turns: [] }) }));
vi.mock("../../lib/push", async (orig) => ({
  ...(await orig<typeof import("../../lib/push")>()),
  usePushPreset: () => ({ choice: "nada", vibrate: false, state: "unsupported", set: vi.fn() }),
  pushState: () => "unsupported",
  savedTopics: () => [],
}));
vi.mock("../partidos/vidrio/venuePlace", async (orig) => ({ ...(await orig<typeof import("../partidos/vidrio/venuePlace")>()), useVenuePlace: () => null }));
vi.mock("../../components/jersey3d/usePageKitStills", () => ({ usePageKitStills: () => () => undefined }));
vi.mock("../../components/jersey3d/useShirtStills", () => ({ useShirtStills: () => () => undefined }));
vi.mock("../pizarra/useMatchBoard", () => ({ useMatchBoard: () => null, useBoardView: () => null, useBoardSeven: () => null }));
vi.mock("../vestuario/live", () => {
  const live = <T,>(data: T) => ({ data, loading: false, error: null });
  return {
    useLiveDoc: (_p: string | null, _id: string, _map: unknown, empty: unknown) => live(empty),
    useMatchScorers: () => live([]),
    useMeetingNote: () => live(""),
    useMvpResults: () => new Map(),
    useMatchRatings: () => live([]),
    useMatchReactions: () => live([]),
    useAbsences: () => live([]),
    useAvailability: () => live([]),
    usePlayerLinks: () => live([]),
    usePorraCount: () => null,
    useCaja: () => ({ settings: { fee: 0 }, movs: [], loading: false, error: false }),
    useMatchPredictions: () => live([]),
    useMyCajaClaims: () => live([]),
    useMyMvpVote: () => live(""),
    useMyPrediction: () => live(null),
  };
});
vi.mock("../vestuario/writes", () => ({
  useMe: () => null,
  addAbsence: vi.fn(),
  claimPayment: vi.fn(),
  deleteAbsence: vi.fn(),
  markTurnDone: vi.fn(),
  predictScore: vi.fn(),
  rateMatch: vi.fn(),
  setAvailability: vi.fn(),
  setReactions: vi.fn(),
  unrateMatch: vi.fn(),
  voteMvp: vi.fn(),
}));
vi.mock("../../components/ThemeToggle", () => ({ ThemeToggle: () => null }));
vi.mock("../../components/celeste/Chrome", () => ({ CelesteDock: () => null, CelesteFooter: () => null, CelesteHeader: () => null }));
vi.mock("../../components/celeste/StatsChartsPanel", () => ({ StatsChartsPanel: () => null }));

const { MatchPage } = await import("./MatchPage");

const players = F.squad.map((p) => ({ id: p.id, shirtName: p.name.toUpperCase(), firstName: p.name, number: Number(p.num), seasons: [F.seasonId] }));
// (the header's moviola; the tabs' strip, .pp-tira__range, is its compact twin)
const moviola = () => document.querySelector<HTMLInputElement>(".pp-mov__range")!;
const playBtn = () => document.querySelector<HTMLButtonElement>(".pp-mov__play")!;
const hrefs = () => route.navigate.mock.calls.map(([a]) => a.href);
const tab = (name: string) => within(screen.getByRole("navigation", { name: "Secciones del partido" })).getByRole("link", { name: new RegExp(`^${name}`) });

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  clock.now = F.now;
  data.matches = longSeasonFixture().matches;
  data.players = players;
  data.error = null;
  data.loading = false;
  seasons.list = [{ id: F.seasonId, name: "Temporada larga", captainPlayerId: "adrian" }];
  route.path = "/partidos/j5";
  route.search = {};
  route.navigate.mockClear();
  route.back.mockClear();
  who.member = false;
  who.admin = false;
  who.playerId = null;
});
afterEach(() => {
  vi.useRealTimers();
});

it("a played match: its score, the moviola at the final whistle and «El partido» as the screen shown", () => {
  render(<MatchPage />);
  expect(screen.getByRole("region", { name: "El partido" })).toBeInTheDocument();
  expect(moviola()).toHaveValue("50");
  expect(playBtn()).toHaveAttribute("aria-pressed", "false");
  expect(tab("El partido")).toHaveAttribute("aria-current", "page");
  expect(tab("El siete")).not.toHaveAttribute("aria-current");
  expect(screen.getByRole("navigation", { name: "Partido anterior y siguiente" })).toBeInTheDocument();
  // nothing to write: the address already says what the page shows
  expect(route.navigate).not.toHaveBeenCalled();
});

it("a tab asks for its address; the page shows the screen once the address says so", () => {
  const r = render(<MatchPage />);
  fireEvent.click(tab("El siete"));
  expect(hrefs()).toEqual(["/partidos/j5/siete"]);
  expect(tab("El partido")).toHaveAttribute("aria-current", "page");
  route.path = "/partidos/j5/siete";
  r.rerender(<MatchPage />);
  expect(tab("El siete")).toHaveAttribute("aria-current", "page");
  expect(document.querySelector(".pp.s-siete")).not.toBeNull();
});

it("the moviola: a minute held back is written in place (?min=, replace, a moment later); back to the end clears it", () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  const r = render(<MatchPage />);
  fireEvent.change(moviola(), { target: { value: "20" } });
  expect(moviola()).toHaveValue("20");
  expect(route.navigate).not.toHaveBeenCalled();
  act(() => void vi.advanceTimersByTime(300));
  expect(route.navigate).toHaveBeenCalledWith({ href: "/partidos/j5?min=20", replace: true, resetScroll: false });
  // (the router moves the address: the page reads it back without moving)
  route.search = { min: "20" };
  r.rerender(<MatchPage />);
  expect(moviola()).toHaveValue("20");
  route.navigate.mockClear();
  fireEvent.click(document.querySelector(".pp-mov__b[aria-label=\"Jugada siguiente\"]")!);
  const next = Number(moviola().value);
  expect(next).toBeGreaterThan(20);
  act(() => void vi.advanceTimersByTime(300));
  expect(route.navigate).toHaveBeenLastCalledWith({ href: `/partidos/j5?min=${next}`, replace: true, resetScroll: false });
  // back to the final whistle: the address loses its ?min=
  route.search = { min: String(next) };
  r.rerender(<MatchPage />);
  fireEvent.change(moviola(), { target: { value: "50" } });
  act(() => void vi.advanceTimersByTime(300));
  expect(route.navigate).toHaveBeenLastCalledWith({ href: "/partidos/j5", replace: true, resetScroll: false });
});

it("a ?min= from outside (a shared moment, back/forward) moves the moviola", () => {
  route.search = { min: "12" };
  const r = render(<MatchPage />);
  expect(moviola()).toHaveValue("12");
  route.search = { min: "31" };
  r.rerender(<MatchPage />);
  expect(moviola()).toHaveValue("31");
});

it("play runs the replay minute by minute; the next match stops it and opens at its own address's minute (b7a78403)", () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  route.search = { min: "10" };
  const r = render(<MatchPage />);
  act(() => playBtn().click());
  expect(playBtn()).toHaveAttribute("aria-pressed", "true");
  act(() => void vi.advanceTimersByTime(340 * 5));
  expect(moviola()).toHaveValue("15");
  // «Siguiente»: the same page, another match (no ?min=)
  route.path = "/partidos/j6";
  route.search = {};
  r.rerender(<MatchPage />);
  expect(playBtn()).toHaveAttribute("aria-pressed", "false");
  expect(moviola()).toHaveValue("50");
  act(() => void vi.advanceTimersByTime(340 * 10));
  expect(moviola()).toHaveValue("50");
});

it("the sheets: «El cartel» pushes ?hoja=cartel; closing it goes back; a sheet opened from the address closes in place", () => {
  const r = render(<MatchPage />);
  fireEvent.click(screen.getByRole("button", { name: /cartel/i }));
  expect(hrefs()).toEqual(["/partidos/j5?hoja=cartel"]);
  route.search = { hoja: "cartel" };
  r.rerender(<MatchPage />);
  const d = screen.getByRole("dialog");
  fireEvent.click(within(d).getByRole("button", { name: "Cerrar el cartel" }));
  expect(route.back).toHaveBeenCalledTimes(1);
  r.unmount();

  route.navigate.mockClear();
  render(<MatchPage />);
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(route.navigate).toHaveBeenCalledWith({ href: "/partidos/j5", replace: true, resetScroll: false });
  expect(route.back).toHaveBeenCalledTimes(1);
});

it("the web's ?season= stays in every address the page writes", () => {
  route.search = { season: "t9" };
  render(<MatchPage />);
  fireEvent.click(tab("Números"));
  fireEvent.click(screen.getByRole("button", { name: /cartel/i }));
  expect(hrefs()).toEqual(["/partidos/j5/numeros?season=t9", "/partidos/j5?hoja=cartel&season=t9"]);
});

it("tonight's live match: the moviola runs up to the minute being played", () => {
  route.path = "/partidos/j17";
  render(<MatchPage />);
  expect(moviola()).toHaveAttribute("max", "23");
  expect(moviola()).toHaveValue("23");
});

it("states: loading, a match that is not in the calendar and the data error", () => {
  data.loading = true;
  const r1 = render(<MatchPage />);
  expect(screen.getByRole("status")).toHaveTextContent("Cargando el partido…");
  r1.unmount();
  data.loading = false;
  route.path = "/partidos/nope";
  const r2 = render(<MatchPage />);
  expect(screen.getByRole("heading", { level: 1, name: "Partido no encontrado" })).toBeInTheDocument();
  r2.unmount();
  data.matches = [];
  data.error = new Error("unavailable");
  render(<MatchPage />);
  expect(screen.getByRole("alert")).toBeInTheDocument();
});
