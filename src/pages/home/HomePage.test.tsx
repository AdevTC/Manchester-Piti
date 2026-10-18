import { render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClubMatch } from "../../lib/clubData";
import type { FrontRow } from "../../lib/derived/frontRow";
import { PLAYERS, SCENES } from "./inicio.fixtures";

// Inicio as a whole: the server render (no WebGL, no member data), the headline per phase, and the member layer
// appearing only client side. The ground, the chrome, the shirt and «La primera fila» are stubbed (their own
// tests cover them); the stub of the front row records what it is handed.
const state = vi.hoisted(() => ({
  matches: [] as ClubMatch[],
  now: 0,
  viewer: { member: false, admin: false, playerId: null as string | null },
  rows: [] as { counts: unknown; status?: string }[],
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className, to, params, ...rest }: { children?: ReactNode; className?: string; to?: string; params?: Record<string, string>; "aria-label"?: string }) => (
    <a className={className} aria-label={rest["aria-label"]} href={(to ?? "").replace("$matchId", params?.matchId ?? "").replace("$playerId", params?.playerId ?? "")}>
      {children}
    </a>
  ),
}));
vi.mock("../../lib/clubData", async (orig) => ({ ...(await orig<typeof import("../../lib/clubData")>()), useClubData: () => ({ matches: state.matches, players: PLAYERS, loading: false, error: null }) }));
vi.mock("../../context/SeasonContext", () => ({ useSeason: () => ({ seasons: [{ id: "t1", name: "Temporada 1" }] }) }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: null, profile: null, loading: false }) }));
vi.mock("../../context/TeamContext", () => ({ useTeam: () => ({ member: false, ready: true }) }));
vi.mock("../../hooks/useViewer", () => ({ useViewer: () => state.viewer }));
vi.mock("../../hooks/useMatchClock", () => ({ useMatchClock: () => state.now }));
vi.mock("../../hooks/useClock", () => ({ useClock: () => state.now }));
vi.mock("../../hooks/useDocumentTheme", () => ({ useDocumentTheme: () => "dark" }));
vi.mock("../../lib/clubContent", () => ({ useClubContent: () => ({ sponsors: [{ name: "Bar Casa Paco", url: "", logo: "" }] }) }));
vi.mock("../../lib/useStandings", () => ({ useStandings: () => ({ standings: null, loading: false }) }));
vi.mock("../../lib/weather", async (orig) => ({ ...(await orig<typeof import("../../lib/weather")>()), useMatchWeather: () => null }));
vi.mock("../vestuario/live", () => {
  const none = { data: [], loading: false, error: null };
  return {
    useAbsences: () => none,
    useAvailability: () => none,
    useMatchRatings: () => none,
    useMatchReactions: () => none,
    useMatchScorers: () => none,
    useMyMvpVote: () => ({ data: "", loading: false, error: null }),
    useMvpResults: () => new Map(),
  };
});
vi.mock("../vestuario/writes", () => ({ useMe: () => null }));
vi.mock("../../components/celeste/Chrome", () => ({
  CelesteBackdrop: () => null,
  CelesteHeader: () => <header />,
  CelesteDock: () => <nav aria-label="Navegación móvil" />,
  CelesteFooter: () => <footer />,
}));
vi.mock("../../components/ThemeToggle", () => ({ ThemeToggle: () => null }));
vi.mock("./PonteLaCamiseta", () => ({ PonteLaCamiseta: () => <section aria-label="Ponte la del Piti" /> }));
vi.mock("../../components/celeste/primeraFila/PrimeraFila", () => ({
  PrimeraFila: ({ row, status }: { row: FrontRow; status?: string }) => {
    state.rows.push({ counts: row.counts, status });
    return <section aria-label="La primera fila" data-mode={row.mode} />;
  },
}));
vi.mock("../../components/palomeras3d/Palomeras", () => ({ Palomeras: () => <div data-testid="ground" /> }));

const { HomePage } = await import("./HomePage");

const at = (phase: keyof typeof SCENES) => {
  state.matches = SCENES[phase].matches;
  state.now = SCENES[phase].now;
};

beforeEach(() => {
  state.viewer = { member: false, admin: false, playerId: null };
  state.rows = [];
});

describe("Inicio", () => {
  it("renders on the server without WebGL: the headline, the scoreboard and the fan's invitation, no member layer", () => {
    at("antes");
    state.viewer = { member: true, admin: true, playerId: "jordi" };
    const html = renderToString(<HomePage />);
    expect(html).toContain("Orduña fc viene a Palomeras");
    expect(html).toContain("Marcador del campo: Piti contra Orduña fc, faltan 2 h y 0 min.");
    expect(html).toContain("Pide entrar al vestuario");
    expect(html).not.toContain("Modo capitán");
    // (the front row gets the fans' row and «loading» until the browser knows who is looking)
    expect(state.rows.at(-1)).toEqual({ counts: null, status: "loading" });
  });

  it.each([
    ["semana", "El domingo, Orduña fc"],
    ["directo1", /pone el 2.+1/],
    ["final", /Ganamos 3.+1 el estreno/],
    ["aplazado", "Hoy no se juega"],
  ] as const)("%s: the headline", (phase, h1) => {
    at(phase);
    render(<HomePage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(h1);
  });

  it("a fan never gets counts: the front row's are null and «Tu partido» is the vestuario's invitation", () => {
    at("antes");
    render(<HomePage />);
    expect(state.rows.every((r) => r.counts === null)).toBe(true);
    const invite = screen.getByRole("region", { name: "Pide entrar al vestuario" });
    expect(within(invite).getByRole("link", { name: "Pedir entrar" })).toHaveAttribute("href", "/vestuario");
    expect(document.body).not.toHaveTextContent(/sin responder|sin contestar/);
  });

  it("the phase block links to the match, «Lo que viene» subscribes to the calendar, «En el club» to the plantilla", () => {
    at("antes");
    render(<HomePage />);
    expect(screen.getByRole("link", { name: /Ver la previa/ })).toHaveAttribute("href", "/matches/j1");
    expect(screen.getByRole("button", { name: /Suscribirme al calendario/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Conoce a los \d+ en Plantilla/ })).toHaveAttribute("href", "/plantilla");
    expect(screen.getByRole("slider", { name: "Arrastra el sol" })).toBeInTheDocument();
  });

  it("live: the plays so far and «Si acaba así» move with the score", () => {
    at("directo1");
    render(<HomePage />);
    const block = screen.getByRole("region", { name: /Hasta el 23′/ });
    expect(within(block).getByText(/Gol de Adrián T\.C\./)).toBeInTheDocument();
    expect(within(block).getByRole("link", { name: /Seguir el partido/ })).toHaveAttribute("href", "/matches/j1");
  });
});
