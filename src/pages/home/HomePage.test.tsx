import { fireEvent, render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClubMatch } from "../../lib/clubData";
import { PLAYERS, SCENES } from "./inicio.fixtures";

// Inicio «Vidrio» as a whole: the server render (Hoy, no member data), the headline per phase, the places and
// the shelf, «Tú» only for a jugador, the fan's invitation, the shirt and the calendar. The chrome, the data
// hooks and the shirt stills are stubbed (their own tests cover them).
const state = vi.hoisted(() => ({
  matches: [] as ClubMatch[],
  now: 0,
  viewer: { member: false, admin: false, playerId: null as string | null },
  loading: false,
  scorers: [] as string[],
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className, to, params, ...rest }: { children?: ReactNode; className?: string; to?: string; params?: Record<string, string>; "aria-label"?: string }) => (
    <a className={className} aria-label={rest["aria-label"]} href={(to ?? "").replace("$matchId", params?.matchId ?? "").replace("$playerId", params?.playerId ?? "")}>
      {children}
    </a>
  ),
}));
vi.mock("../../lib/clubData", async (orig) => ({ ...(await orig<typeof import("../../lib/clubData")>()), useClubData: () => ({ matches: state.loading ? [] : state.matches, players: PLAYERS, loading: state.loading, error: null }) }));
vi.mock("../../context/SeasonContext", () => ({ useSeason: () => ({ seasons: [{ id: "t1", name: "Temporada 1" }] }) }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: null, profile: null, loading: false }) }));
vi.mock("../../context/TeamContext", () => ({ useTeam: () => ({ member: false, ready: true }) }));
vi.mock("../../hooks/useViewer", () => ({ useViewer: () => state.viewer }));
vi.mock("../../hooks/useMatchClock", () => ({ useMatchClock: () => state.now }));
vi.mock("../../hooks/useClock", () => ({ useClock: () => state.now }));
vi.mock("../../hooks/useDocumentTheme", () => ({ useDocumentTheme: () => "dark" }));
vi.mock("../../lib/clubContent", () => ({ useClubContent: () => ({ sponsors: [{ name: "Bar Casa Paco", url: "", logo: "" }] }) }));
vi.mock("../../lib/useStandings", () => ({
  useStandings: () => ({
    standings: {
      id: "t1",
      competition: "Liga",
      jornada: 0,
      updatedAt: 0,
      updatedBy: "",
      rows: ["Entrepibas F.C.", "Orduña fc", "Manchester Piti", "Pitutis"].map((team) => ({ team, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0, isUs: team === "Manchester Piti" })),
    },
    loading: false,
  }),
}));
vi.mock("../../lib/weather", async (orig) => ({ ...(await orig<typeof import("../../lib/weather")>()), useMatchWeather: () => null, useMatchWeatherHourly: () => null }));
vi.mock("../../lib/useRotaTurns", () => ({ useMatchTurns: () => ({ turns: [] }) }));
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
    useCaja: () => ({ settings: { cuota: 0, cuotaPeriod: "temporada", howToPay: "", updatedAt: 0 }, movs: [], loading: false, error: false }),
    usePolls: () => none,
    usePollVotes: () => none,
    useNotices: () => none,
    useMyCajaClaims: () => none,
  };
});
vi.mock("../vestuario/writes", () => ({ useMe: () => (state.viewer.member ? { uid: "u1", name: "jordi", playerId: state.viewer.playerId } : null), voteMvp: vi.fn(), setAvailability: vi.fn(() => Promise.resolve()) }));
vi.mock("../../components/celeste/Chrome", () => ({
  CelesteHeader: () => <header />,
  CelesteDock: () => <nav aria-label="Navegación móvil" />,
  CelesteFooter: () => <footer />,
}));
vi.mock("../../components/ThemeToggle", () => ({ ThemeToggle: () => null }));

const { HomePage } = await import("./HomePage");

const at = (phase: keyof typeof SCENES) => {
  state.matches = SCENES[phase].matches;
  state.now = SCENES[phase].now;
};

beforeEach(() => {
  state.viewer = { member: false, admin: false, playerId: null };
  state.loading = false;
  state.scorers = [];
  window.history.replaceState(null, "", "/");
});
afterEach(() => window.history.replaceState(null, "", "/"));

describe("Inicio", () => {
  it("renders Hoy on the server: the lens, the headline, the shelf of a fan, no member data", () => {
    at("directo1");
    state.viewer = { member: true, admin: true, playerId: "jordi" };
    const html = renderToString(<HomePage />);
    expect(html).toContain("Adrián T.C. pone el 2");
    expect(html).toContain("Manchester Piti 2, Orduña fc 1. En directo, primera parte.");
    expect(html).toContain('aria-label="Sitios de Inicio"');
    // (who is looking is only known in the browser: no «Tú» and no member line in the server's HTML)
    expect(html).not.toContain(">Tú<");
    expect(html).not.toContain("lleva tu pase");
  });

  it.each([
    ["semana", "El domingo, Orduña fc"],
    ["antes", "Hoy debuta el Piti"],
    ["directo1", /pone el 2.+1/],
    ["final", /Ganamos 3.+1 el estreno/],
    ["acta", /Alcides abre, Kevin cierra: 3.+1/],
    ["aplazado", "Hoy no se juega"],
  ] as const)("%s: the headline", (phase, h1) => {
    at(phase);
    render(<HomePage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(h1);
  });

  it("pendiente: nobody started la mesa's clock — no score anywhere, never a 0–0", () => {
    at("pendiente");
    const html = renderToString(<HomePage />);
    expect(html).toContain("Pendiente del acta");
    expect(html).not.toMatch(/Empate a cero|0–0|0⁠–⁠0|cerrando la mesa/);
    render(<HomePage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Falta el acta del partido");
    expect(screen.getByRole("img", { name: /pendiente del acta/ })).toBeInTheDocument();
  });

  it("a goal already there when the matches load keeps its rim only: the goal moment never replays on load", () => {
    at("directo1");
    state.loading = true;
    const { container, rerender } = render(<HomePage />);
    state.loading = false;
    rerender(<HomePage />);
    expect(container.querySelector(".vd-goal")).toBeNull();
    expect(screen.queryByText(/¡Gol de/)).toBeNull();
    // the score replays it on demand
    fireEvent.click(screen.getByRole("button", { name: /Repetir el gol/ }));
    expect(screen.getByText("¡Gol de Adrián T.C.!")).toBeInTheDocument();
  });

  it("the anotador opens la mesa from Hoy, first of the actions", () => {
    at("antes");
    state.viewer = { member: true, admin: false, playerId: "huberoski" };
    state.scorers = ["u1"];
    render(<HomePage />);
    const first = screen.getByRole("link", { name: "Abrir la mesa" });
    expect(first).toHaveAttribute("href", "/matches/j1/mesa");
  });

  it("«Avisarme del pitido» stays where this browser can't take notices, and says why", () => {
    at("antes");
    render(<HomePage />);
    fireEvent.click(screen.getByRole("button", { name: /Avisarme del pitido/ }));
    expect(screen.getByRole("status")).toHaveTextContent(/no admite avisos/);
  });

  it("live: the lens's ribbon, the plays with «Abrir el partido», el siete on the pitch", () => {
    at("directo1");
    render(<HomePage />);
    const lens = screen.getByRole("region", { name: "El partido" });
    expect(within(lens).getByRole("group", { name: /minuto a minuto/ })).toBeInTheDocument();
    const plays = screen.getByRole("region", { name: "Jugada a jugada" });
    expect(within(plays).getByText("Gol de Adrián T.C.")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Abrir el partido" })[0]).toHaveAttribute("href", "/matches/j1");
    expect(within(screen.getByRole("region", { name: "En el campo" })).getAllByRole("listitem")).toHaveLength(7);
  });

  it("a fan has three places; the shelf moves to Club, with the invitation, the shirt and the calendar", () => {
    at("antes");
    render(<HomePage />);
    const shelf = screen.getByRole("tablist", { name: "Sitios de Inicio" });
    expect(within(shelf).getAllByRole("tab").map((t) => t.querySelector("b")?.textContent)).toEqual(["Hoy", "Temporada", "Club"]);
    expect(screen.getByRole("region", { name: "La previa" })).toBeInTheDocument();
    fireEvent.click(within(shelf).getByRole("tab", { name: /Club/ }));
    expect(window.location.hash).toBe("#club");
    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveAttribute("aria-labelledby", "inicio-tab-club");
    expect(within(panel).getByRole("heading", { name: "Pide entrar al vestuario" })).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: "Pedir entrar" })).toHaveAttribute("href", "/vestuario");
    fireEvent.change(within(panel).getByLabelText("Tu nombre"), { target: { value: "afición" } });
    expect(within(panel).getByLabelText("Tu nombre")).toHaveValue("AFICIÓN");
    expect(within(panel).getByRole("img", { name: /Tu camiseta con AFICIÓN y el dorsal 10/ })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: /Suscribirme al calendario/ })).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: /Conoce a los \d+ en Plantilla/ })).toHaveAttribute("href", "/plantilla");
  });

  it("#temporada opens the season: the table in focus with «Si acaba así» while live, the form, the jornadas", () => {
    at("directo1");
    window.history.replaceState(null, "", "/#temporada");
    render(<HomePage />);
    const panel = screen.getByRole("tabpanel");
    expect(within(panel).getByRole("heading", { name: "La temporada" })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Si acaba así" })).toHaveAttribute("aria-pressed", "true");
    expect(within(panel).getByRole("row", { name: /Manchester Piti/ })).toHaveTextContent(/sube al 1º/);
    expect(within(panel).getByRole("list", { name: /La forma/ })).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: /^J1, contra Orduña fc: en directo, 2–1/ })).toHaveAttribute("href", "/matches/j1");
  });

  it("a jugador gets «Tú»: what waits on him, his convocatoria to answer", () => {
    at("antes");
    state.viewer = { member: true, admin: false, playerId: "jordi" };
    render(<HomePage />);
    const tu = screen.getByRole("tab", { name: /Tú/ });
    fireEvent.click(tu);
    const panel = screen.getByRole("tabpanel");
    expect(within(panel).getByRole("heading", { name: "Lo que te toca" })).toBeInTheDocument();
    expect(within(panel).getByRole("group", { name: /Convocatoria del J1/ })).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: "Avisar de una ausencia, en el vestuario" })).toHaveAttribute("href", "/vestuario");
  });
});
