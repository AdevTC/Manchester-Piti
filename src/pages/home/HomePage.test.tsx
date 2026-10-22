import { fireEvent, render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClubMatch } from "../../lib/clubData";
import { PLAYERS, SCENES } from "./inicio.fixtures";

// Inicio «La portada» as a whole: the server render (the public match, no member data), the headline per
// moment, the actions, the screens behind their addresses (/hoy/campo, /hoy/jugadas, /hoy/lo-tuyo, /camiseta).
// The chrome, the router, the data hooks and the shirt stills are stubbed (their own tests cover them).
const state = vi.hoisted(() => ({
  matches: [] as ClubMatch[],
  now: 0,
  viewer: { member: false, admin: false, playerId: null as string | null },
  loading: false,
  scorers: [] as string[],
  path: "/",
  search: {} as Record<string, unknown>,
  navigate: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className, to, params, ...rest }: { children?: ReactNode; className?: string; to?: string; params?: Record<string, string>; "aria-label"?: string }) => (
    <a className={className} aria-label={rest["aria-label"]} href={(to ?? "").replace("$matchId", params?.matchId ?? "").replace("$playerId", params?.playerId ?? "")}>
      {children}
    </a>
  ),
  useRouter: () => ({ navigate: state.navigate, history: { back: vi.fn() } }),
  useRouterState: ({ select }: { select: (s: { location: { pathname: string; search: Record<string, unknown> } }) => unknown }) => select({ location: { pathname: state.path, search: state.search } }),
}));
vi.mock("../../lib/clubData", async (orig) => ({ ...(await orig<typeof import("../../lib/clubData")>()), useClubData: () => ({ matches: state.loading ? [] : state.matches, players: PLAYERS, loading: state.loading, error: null }) }));
vi.mock("../../context/SeasonContext", () => ({ useSeason: () => ({ seasons: [{ id: "t1", name: "Temporada 1" }] }) }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: null, profile: null, loading: false }) }));
vi.mock("../../context/TeamContext", () => ({ useTeam: () => ({ member: false, ready: true }) }));
vi.mock("../../hooks/useViewer", () => ({ useViewer: () => state.viewer }));
vi.mock("../../hooks/useMatchClock", () => ({ useMatchClock: () => state.now }));
vi.mock("../../hooks/useClock", () => ({ useClock: () => state.now }));
vi.mock("../../hooks/useDocumentTheme", () => ({ useDocumentTheme: () => "dark" }));
vi.mock("../../lib/useStandings", () => ({ useStandings: () => ({ standings: null, loading: false }) }));
vi.mock("../../lib/weather", async (orig) => ({ ...(await orig<typeof import("../../lib/weather")>()), useMatchWeather: () => null, useMatchWeatherHourly: () => null }));
vi.mock("../../lib/useRotaTurns", () => ({ useMatchTurns: () => ({ turns: [] }) }));
vi.mock("../../lib/push", async (orig) => ({ ...(await orig<typeof import("../../lib/push")>()), usePushPreset: () => ({ choice: "nada", vibrate: false, state: "unsupported", set: vi.fn() }), pushState: () => "unsupported", savedTopics: () => [] }));
vi.mock("../partidos/vidrio/venuePlace", () => ({ useVenuePlace: () => null }));
vi.mock("../../components/jersey3d/useShirtStills", () => ({ useShirtStills: () => () => undefined }));
vi.mock("../vestuario/live", () => {
  const none = { data: [], loading: false, error: null };
  return {
    useAbsences: () => none,
    useAvailability: () => none,
    useMatchScorers: () => ({ data: state.scorers, loading: false, error: null }),
    useMyMvpVote: () => ({ data: "", loading: false, error: null }),
    useMyPrediction: () => ({ data: null, loading: false, error: null }),
    useMvpResults: () => new Map(),
    useMeetingNote: () => ({ data: "", loading: false, error: null }),
    useCaja: () => ({ settings: { cuota: 0, cuotaPeriod: "temporada", howToPay: "", updatedAt: 0 }, movs: [], loading: false, error: false }),
    usePolls: () => none,
    usePollVotes: () => none,
    useNotices: () => none,
    useMyCajaClaims: () => none,
  };
});
vi.mock("../vestuario/writes", () => ({ useMe: () => (state.viewer.member ? { uid: "u1", name: "jordi", playerId: state.viewer.playerId } : null), voteMvp: vi.fn(), votePoll: vi.fn(), predictScore: vi.fn(), setAvailability: vi.fn(() => Promise.resolve()) }));
vi.mock("../../components/celeste/Chrome", () => ({
  CelesteHeader: () => <header />,
  CelesteDock: () => <nav aria-label="Navegación móvil" />,
  CelesteFooter: () => <footer />,
}));
vi.mock("../../components/ThemeToggle", () => ({ ThemeToggle: () => null }));

const { HomePage } = await import("./HomePage");

const at = (phase: keyof typeof SCENES, path = "/") => {
  state.matches = SCENES[phase].matches;
  state.now = SCENES[phase].now;
  state.path = path;
};

beforeEach(() => {
  state.viewer = { member: false, admin: false, playerId: null };
  state.loading = false;
  state.scorers = [];
  state.path = "/";
  state.search = {};
  state.navigate.mockReset();
  state.navigate.mockResolvedValue(undefined);
});

describe("Inicio, la portada", () => {
  it("renders the public match on the server: the lens, the headline, never a member's things", () => {
    at("directo1");
    state.viewer = { member: true, admin: true, playerId: "jordi" };
    const html = renderToString(<HomePage />);
    expect(html).toContain("Adrián T.C. pone el 2");
    expect(html).toContain("Manchester Piti 2, Orduña fc 1, en directo");
    // (who is looking is only known in the browser: the server paints the fans' «Desde la grada»)
    expect(html).toContain("Desde la grada");
    expect(html).not.toContain("Lo que te toca");
  });

  it.each([
    ["semana", "El domingo, Orduña fc en Palomeras"],
    ["antes", "Hoy debuta el Piti"],
    ["directo1", /pone el 2.+1/],
    ["descanso", /Descanso con 2.+1/],
    ["final", /Ganamos 3.+1 el estreno/],
    ["acta", /Alcides abre, Kevin cierra: 3.+1/],
    ["despues", "El domingo, a casa de Pitutis"],
    ["aplazado", "Hoy no se juega"],
  ] as const)("%s: the headline", (phase, h1) => {
    at(phase);
    render(<HomePage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(h1);
  });

  it("pendiente: nobody started la mesa's clock — no score anywhere, never a 0–0", () => {
    at("pendiente");
    const html = renderToString(<HomePage />);
    expect(html).not.toMatch(/Empate a cero|0–0|0⁠–⁠0/);
    render(<HomePage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Falta el acta del partido");
    expect(screen.getByRole("img", { name: "Sin acta" })).toBeInTheDocument();
  });

  it("the anotador opens la mesa first", () => {
    at("antes");
    state.viewer = { member: true, admin: false, playerId: "huberoski" };
    state.scorers = ["u1"];
    render(<HomePage />);
    expect(screen.getAllByRole("link", { name: /Abrir la mesa/ })[0]).toHaveAttribute("href", "/partidos/j1/mesa");
  });

  it("live: «La moviola» in the lens, el siete on the pitch, the plays newest first", () => {
    at("directo1");
    render(<HomePage />);
    const lens = screen.getByRole("region", { name: "El partido de hoy" });
    expect(within(lens).getByRole("group", { name: /minuto a minuto/ })).toBeInTheDocument();
    expect(within(lens).getByRole("slider", { name: /La moviola/ })).toBeInTheDocument();
    const plays = screen.getByRole("region", { name: "Jugada a jugada" });
    expect(within(plays).getAllByRole("listitem")[0]).toHaveTextContent("Gol de Adrián T.C.");
    expect(screen.getAllByRole("link", { name: "Abrir el partido" })[0]).toHaveAttribute("href", "/partidos/j1");
  });

  it("the moviola goes back: the score and the headline follow the minute", () => {
    at("directo1");
    render(<HomePage />);
    fireEvent.change(screen.getByRole("slider", { name: /La moviola/ }), { target: { value: "8" } });
    expect(screen.getByRole("img", { name: /Manchester Piti 1, Orduña fc 0, en el minuto 8/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Volver al directo" }));
    expect(screen.getByRole("img", { name: /Manchester Piti 2, Orduña fc 1, en directo/ })).toBeInTheDocument();
  });

  it("a fan reads «Desde la grada» and every door of the house", () => {
    at("antes");
    render(<HomePage />);
    expect(screen.getByRole("heading", { name: "Desde la grada" })).toBeInTheDocument();
    const doors = screen.getByRole("region", { name: "Por la casa" });
    expect(within(doors).getAllByRole("link").map((a) => a.querySelector("b")?.textContent)).toEqual(["Partidos", "Plantilla", "Números", "Club", "El vestuario", "Ponte la del Piti"]);
  });

  it("a door to a screen navigates there inside a View Transition", () => {
    at("acta");
    render(<HomePage />);
    fireEvent.click(screen.getByRole("link", { name: /Los minutos de cada uno: / }));
    expect(state.navigate).toHaveBeenCalledWith({ href: "/hoy/campo" });
  });
});

describe("Inicio's screens", () => {
  it("/hoy/campo: the capsule back home, «Los minutos» row by row", () => {
    at("acta", "/hoy/campo");
    render(<HomePage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Acabaron en el campo");
    expect(screen.getByRole("link", { name: /Volver a Inicio: Manchester Piti 3, Orduña fc 1/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Los minutos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Alcides, 50 minutos/ })).toBeInTheDocument();
  });

  it("/hoy/jugadas: the two halves and the filters", () => {
    at("acta", "/hoy/jugadas");
    render(<HomePage />);
    expect(screen.getByRole("region", { name: "Segunda parte" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Goles" }));
    expect(screen.getByRole("region", { name: "Primera parte" })).toHaveTextContent("3 jugadas");
  });

  it("/hoy/lo-tuyo is a player's: anyone else goes home", () => {
    at("acta", "/hoy/lo-tuyo");
    render(<HomePage />);
    expect(state.navigate).toHaveBeenCalledWith({ href: "/" });
  });

  it("/camiseta: the name in capitals, the dorsal in figures", () => {
    at("acta", "/camiseta");
    render(<HomePage />);
    fireEvent.change(screen.getByLabelText("Tu nombre"), { target: { value: "afición" } });
    fireEvent.change(screen.getByLabelText("Dorsal"), { target: { value: "1a2" } });
    expect(screen.getByLabelText("Tu nombre")).toHaveValue("AFICIÓN");
    expect(screen.getByLabelText("Dorsal")).toHaveValue("12");
    expect(screen.getByRole("img", { name: /con AFICIÓN y el 12 a la espalda/ })).toBeInTheDocument();
  });
});
