import { act, render, screen, waitFor } from "@testing-library/react";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";

// The app's real router: every address of the Vidrio boards resolves to its area's page (today's, until each
// redesign lands), and every old one redirects there with its parameters, replacing the old entry. The
// pages, auth and team are stubbed (no Firebase); each stub names its page.
vi.mock("./context/AuthContext", () => ({ useAuth: () => ({ profile: { role: "member" }, loading: false }) }));
vi.mock("./context/TeamContext", () => ({ useTeam: () => ({ member: true, ready: true }) }));
vi.mock("./components/Navbar", () => ({ Navbar: () => null }));
vi.mock("./components/SeasonUrlSync", () => ({ SeasonUrlSync: () => null }));
vi.mock("./components/InterimLanding", () => ({ InterimLanding: () => null }));
vi.mock("./components/vidrio/live/LiveScore", () => ({ LiveScore: () => null }));
vi.mock("./lib/doorWelcome", () => ({ useWelcome: () => null }));
vi.mock("./pages/acceso/AccessGate", () => ({ AccessGate: () => <h1>la puerta</h1> }));
// (the stubs of the pages with several screens count their mounts: one page stays up across its screens)
const mounts = vi.hoisted(() => ({}) as Record<string, number>);
vi.mock("./pages/Home", async () => {
  const { useEffect } = await import("react");
  return { HomePage: () => (useEffect(() => void (mounts.inicio = (mounts.inicio ?? 0) + 1), []), <h1>inicio</h1>) };
});
vi.mock("./pages/partidos/PartidosPage", async () => {
  const { useEffect } = await import("react");
  return { PartidosPage: () => (useEffect(() => void (mounts.partidos = (mounts.partidos ?? 0) + 1), []), <h1>partidos</h1>) };
});
vi.mock("./pages/match/MatchPage", async () => {
  const { useEffect } = await import("react");
  return { MatchPage: () => (useEffect(() => void (mounts.partido = (mounts.partido ?? 0) + 1), []), <h1>el partido</h1>) };
});
vi.mock("./pages/mesa/Mesa", () => ({ Mesa: () => <h1>la mesa</h1> }));
vi.mock("./pages/stats/StatsPage", () => ({ StatsPage: () => <h1>números</h1> }));
vi.mock("./pages/squad/SquadPage", () => ({ SquadPage: () => <h1>la percha</h1> }));
vi.mock("./pages/jugador/JugadorPage", () => ({ JugadorPage: () => <h1>el jugador</h1> }));
vi.mock("./pages/club/ClubPage", () => ({ ClubPage: () => <h1>el club</h1> }));
vi.mock("./pages/vestuario/VestuarioPage", () => ({ VestuarioPage: () => <h1>el vestuario</h1> }));
vi.mock("./pages/perfil/ProfilePage", () => ({ ProfilePage: () => <h1>tu página</h1> }));
vi.mock("./components/celeste/BuscarPage", () => ({ BuscarPage: () => <h1>buscar</h1> }));

const { createAppRouter } = await import("./router");

const leaf = (path: string) => createAppRouter(createMemoryHistory({ initialEntries: ["/"] })).matchRoutes(path, {}).at(-1)?.routeId;

describe("every new address resolves", () => {
  const AREAS: Record<string, string[]> = {
    inicio: ["/", "/hoy/campo", "/hoy/jugadas", "/hoy/lo-tuyo", "/camiseta"],
    partidos: ["/partidos", "/partidos/tabla", "/partidos/balance"],
    "el partido": ["/partidos/j1", "/partidos/j1/siete", "/partidos/j1/numeros", "/partidos/j1/vestuario"],
    "la mesa": ["/partidos/j1/mesa"],
    números: ["/numeros", "/numeros/y-si", "/numeros/jugadores", "/numeros/campo", "/numeros/campo/puestos", "/numeros/campo/sistemas", "/numeros/juego", "/numeros/juego/tabla", "/numeros/juego/catalogo", "/numeros/rivales", "/numeros/records", "/numeros/records/marcas", "/numeros/records/cromos", "/numeros/records/evolucion", "/plantilla/cara-a-cara"],
    "la percha": ["/plantilla", "/plantilla/album"],
    "el jugador": ["/jugadores/alcides", "/jugadores/alcides/temporada", "/jugadores/alcides/jornadas", "/jugadores/alcides/juego", "/jugadores/alcides/analisis", "/jugadores/alcides/cromo"],
    "el club": ["/club", "/club/vitrina", "/club/vitrina/escudo", "/club/historia", "/club/equipo", "/club/equipo/camiseta", "/club/gente"],
    "el vestuario": ["/vestuario", "/vestuario/caja", "/vestuario/encuestas", "/vestuario/encuestas/p1", "/vestuario/ausencias", "/vestuario/turnos", "/vestuario/entrenos", "/vestuario/tablon", "/vestuario/puerta", "/vestuario/ficha"],
    "tu página": ["/perfil", "/perfil/temporada", "/perfil/temporada/cromos", "/perfil/posiciones", "/perfil/nombre", "/perfil/ajustes", "/perfil/cuenta", "/perfil/capitania", "/perfil/compartir", "/avisos", "/avisos/a-medida"],
    buscar: ["/buscar"],
  };
  it("none falls to the 404", () => {
    for (const path of Object.values(AREAS).flat()) expect(leaf(path), path).not.toBe("/$");
    expect(leaf("/numeros/nada")).toBe("/$");
    expect(leaf("/partidos/j1/nada")).toBe("/$");
  });
  it.each(Object.entries(AREAS).flatMap(([page, paths]) => paths.map((path) => [path, page])))("%s opens %s", async (path, page) => {
    const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }));
    render(<RouterProvider router={router} />);
    expect(await screen.findByRole("heading", { level: 1, name: page })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(path);
  });
});

describe("a page with several screens stays mounted across them", () => {
  it.each([
    ["inicio", "inicio", ["/", "/hoy/campo", "/hoy/jugadas", "/camiseta", "/"]],
    ["partidos", "partidos", ["/partidos", "/partidos/tabla", "/partidos/balance", "/partidos"]],
    ["partido", "el partido", ["/partidos/j1", "/partidos/j1/siete", "/partidos/j1/numeros", "/partidos/j1/vestuario"]],
  ] as const)("%s", async (key, page, paths) => {
    mounts[key] = 0;
    const router = createAppRouter(createMemoryHistory({ initialEntries: [paths[0]] }));
    render(<RouterProvider router={router} />);
    expect(await screen.findByRole("heading", { level: 1, name: page })).toBeInTheDocument();
    for (const href of paths.slice(1)) {
      await act(() => router.navigate({ href }));
      expect(router.state.location.pathname).toBe(href);
      expect(screen.getByRole("heading", { level: 1, name: page })).toBeInTheDocument();
    }
    expect(mounts[key]).toBe(1);
  });
  it("la mesa is its own page, never the match page's", async () => {
    mounts.partido = 0;
    const router = createAppRouter(createMemoryHistory({ initialEntries: ["/partidos/j1/mesa"] }));
    render(<RouterProvider router={router} />);
    expect(await screen.findByRole("heading", { level: 1, name: "la mesa" })).toBeInTheDocument();
    expect(mounts.partido).toBe(0);
  });
});

describe("every old address redirects, with its parameters, replacing the old entry", () => {
  it.each([
    ["/matches/j1?tab=campo", "/partidos/j1/siete", "el partido"],
    ["/matches/j1/mesa", "/partidos/j1/mesa", "la mesa"],
    ["/admin/en-juego/j1", "/partidos/j1/mesa", "la mesa"],
    ["/matches", "/partidos", "partidos"],
    ["/partidos?view=numeros&temporada=t0", "/partidos/balance?temporada=t0", "partidos"],
    ["/stats?view=positions&season=t1", "/numeros/campo/puestos?temporada=t1", "números"],
    ["/stats?view=compare&a=alcides&b=erik", "/plantilla/cara-a-cara?a=alcides&b=erik", "números"],
    ["/profile#temporada", "/perfil/temporada", "tu página"],
    ["/club#cl-kits", "/club/equipo", "el club"],
    ["/vestuario#vx-caja", "/vestuario/caja", "el vestuario"],
    ["/#temporada", "/numeros", "números"],
    ["/jugadores", "/plantilla", "la percha"],
    ["/jugadores/alcides/posiciones", "/jugadores/alcides/juego", "el jugador"],
  ])("%s → %s", async (from, to, page) => {
    const history = createMemoryHistory({ initialEntries: [from] });
    const router = createAppRouter(history);
    render(<RouterProvider router={router} />);
    expect(await screen.findByRole("heading", { level: 1, name: page })).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.href).toBe(to));
    // (replace: «atrás» never lands on the old address again)
    expect(history.length).toBe(1);
  });
});
