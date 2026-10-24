import { act, render, screen, waitFor } from "@testing-library/react";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { renderToString } from "react-dom/server";
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
vi.mock("./pages/stats/NumerosPage", () => ({ NumerosPage: () => <h1>números</h1> }));
vi.mock("./pages/squad/SquadPage", async () => {
  const { useEffect } = await import("react");
  return { SquadPage: () => (useEffect(() => void (mounts.percha = (mounts.percha ?? 0) + 1), []), <h1>la percha</h1>) };
});
vi.mock("./pages/club/ClubPage", () => ({ ClubPage: () => <h1>el club</h1> }));
vi.mock("./pages/vestuario/VestuarioPage", () => ({ VestuarioPage: () => <h1>el vestuario</h1> }));
vi.mock("./pages/perfil/ProfilePage", async () => {
  const { useEffect } = await import("react");
  return { ProfilePage: () => (useEffect(() => void (mounts.tu = (mounts.tu ?? 0) + 1), []), <h1>tu página</h1>) };
});
vi.mock("./components/celeste/BuscarPage", () => ({ BuscarPage: () => <h1>buscar</h1> }));

const { createAppRouter, numerosSearchSchema, plantillaSearchSchema } = await import("./router");

describe("custom analysis addresses", () => {
  it("keeps all table controls after router validation, including no columns", () => {
    const search = { vista: "pases", columnas: "067,068,069,070", orden: "070", sentido: "asc", "buscar-columna": "pase", "familia-columna": "Pases" };
    expect(numerosSearchSchema.parse(search)).toMatchObject(search);
    expect(numerosSearchSchema.parse({ columnas: "" }).columnas).toBe("");
    expect(numerosSearchSchema.parse({ columnas: 105, orden: 105 })).toMatchObject({ columnas: "105", orden: "105" });
    expect(numerosSearchSchema.parse({ columnas: "067,invalid", orden: "invalid", sentido: "invalid" })).toMatchObject({ columnas: undefined, orden: undefined, sentido: undefined });
  });
});

const leaf = (path: string) => createAppRouter(createMemoryHistory({ initialEntries: ["/"] })).matchRoutes(path, {}).at(-1)?.routeId;

describe("every new address resolves", () => {
  const AREAS: Record<string, string[]> = {
    inicio: ["/", "/hoy/campo", "/hoy/jugadas", "/hoy/lo-tuyo", "/camiseta"],
    partidos: ["/partidos", "/partidos/tabla", "/partidos/balance"],
    "el partido": ["/partidos/j1", "/partidos/j1/siete", "/partidos/j1/numeros", "/partidos/j1/vestuario"],
    "la mesa": ["/partidos/j1/mesa"],
    números: ["/numeros", "/numeros/y-si", "/numeros/jugadores", "/numeros/campo", "/numeros/campo/puestos", "/numeros/campo/sistemas", "/numeros/juego", "/numeros/juego/tabla", "/numeros/juego/graficas", "/numeros/juego/catalogo", "/numeros/rivales", "/numeros/records", "/numeros/records/marcas", "/numeros/records/cromos", "/numeros/records/evolucion"],
    "la percha": ["/plantilla", "/plantilla/album", "/plantilla/cara-a-cara", "/jugadores/alcides", "/jugadores/alcides/temporada", "/jugadores/alcides/jornadas", "/jugadores/alcides/juego", "/jugadores/alcides/analisis", "/jugadores/alcides/cromo"],
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
    ["/stats?view=compare&a=alcides&b=erik", "/plantilla/cara-a-cara?a=alcides&b=erik", "la percha"],
    ["/profile#temporada", "/perfil/temporada", "tu página"],
    ["/club#cl-kits", "/club/equipo", "el club"],
    ["/vestuario#vx-caja", "/vestuario/caja", "el vestuario"],
    ["/#temporada", "/numeros", "números"],
    ["/jugadores", "/plantilla", "la percha"],
    ["/jugadores/alcides/posiciones", "/jugadores/alcides/juego", "la percha"],
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

describe("an old #hash is an old address only on arrival", () => {
  const open = async (href: string, page: string) => {
    const router = createAppRouter(createMemoryHistory({ initialEntries: [href] }));
    render(<RouterProvider router={router} />);
    expect(await screen.findByRole("heading", { level: 1, name: page })).toBeInTheDocument();
    return router;
  };

  it("a chapter link on /club (#cl-ground, #cl-contact, #cl-sponsors) stays on the page, on the chapter clicked", async () => {
    const router = await open("/club", "el club");
    for (const hash of ["cl-ground", "cl-contact", "cl-sponsors"]) {
      await act(() => router.navigate({ href: `/club#${hash}` }));
      expect(router.state.location.href).toBe(`/club#${hash}`);
    }
  });

  it("…while arriving at /club#cl-ground from another page, or from outside, still moves to its screen", async () => {
    const router = await open("/plantilla", "la percha");
    await act(() => router.navigate({ href: "/club#cl-ground" }));
    await waitFor(() => expect(router.state.location.href).toBe("/club/equipo"));
    const fresh = await open("/club#cl-sponsors", "el club");
    await waitFor(() => expect(fresh.state.location.href).toBe("/club/gente"));
  });

  it("a page noting its own #hash (the vestuario's «¿Vas?» switch, a chapter) keeps it", async () => {
    const router = await open("/vestuario#vx-rsvp", "el vestuario");
    expect(router.state.location.href).toBe("/vestuario#vx-rsvp");
    await act(() => router.navigate({ href: "/vestuario#vx-train", replace: true }));
    expect(router.state.location.href).toBe("/vestuario#vx-train");
  });

  it("/avisos/a-medida#ajustes, arriving, is normalised to /perfil/ajustes", async () => {
    const router = await open("/avisos/a-medida#ajustes", "tu página");
    await waitFor(() => expect(router.state.location.href).toBe("/perfil/ajustes"));
  });
});

describe("tu página: /perfil and /avisos are one page", () => {
  it("a tab that moves the address between them keeps the page mounted, with no redirect", async () => {
    mounts.tu = 0;
    const router = createAppRouter(createMemoryHistory({ initialEntries: ["/perfil"] }));
    render(<RouterProvider router={router} />);
    expect(await screen.findByRole("heading", { level: 1, name: "tu página" })).toBeInTheDocument();
    for (const href of ["/perfil/temporada", "/avisos/a-medida", "/perfil/ajustes", "/perfil/temporada/cromos"]) {
      await act(() => router.navigate({ href, replace: true }));
      expect(router.state.location.href).toBe(href);
    }
    expect(mounts.tu).toBe(1);
  });
  it("la percha and its players are one page: the shirt flies without a remount", async () => {
    mounts.percha = 0;
    const router = createAppRouter(createMemoryHistory({ initialEntries: ["/plantilla"] }));
    render(<RouterProvider router={router} />);
    expect(await screen.findByRole("heading", { level: 1, name: "la percha" })).toBeInTheDocument();
    for (const href of ["/jugadores/alcides", "/jugadores/alcides/cromo", "/plantilla/album", "/jugadores/erik", "/plantilla/cara-a-cara?a=erik"]) {
      await act(() => router.navigate({ href }));
      expect(router.state.location.href).toBe(href);
    }
    expect(mounts.percha).toBe(1);
  });
});

describe("Números' old ?view=minutes keeps its ranking", () => {
  it("/numeros/jugadores?view=minutes → /numeros/jugadores?ranking=minutos&ver=todo", async () => {
    const router = createAppRouter(createMemoryHistory({ initialEntries: ["/numeros/jugadores?view=minutes"] }));
    render(<RouterProvider router={router} />);
    expect(await screen.findByRole("heading", { level: 1, name: "números" })).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.href).toBe("/numeros/jugadores?ranking=minutos&ver=todo"));
  });
});

describe("the server renders Plantilla's pages, never the pending panel", () => {
  it.each([
    ["/plantilla", "la percha"],
    ["/plantilla/album", "la percha"],
    ["/plantilla/cara-a-cara", "la percha"],
  ])("%s", async (url, page) => {
    const router = createAppRouter(createMemoryHistory({ initialEntries: [url] }));
    await router.load();
    const html = renderToString(<RouterProvider router={router} />);
    expect(html).toContain(`<h1>${page}</h1>`);
  });
});

describe("Plantilla's screens keep one page mounted", () => {
  it("/plantilla ⇄ /plantilla/cara-a-cara", async () => {
    const router = createAppRouter(createMemoryHistory({ initialEntries: ["/plantilla"] }));
    render(<RouterProvider router={router} />);
    expect(await screen.findByRole("heading", { level: 1, name: "la percha" })).toBeInTheDocument();
    await act(() => router.navigate({ href: "/plantilla/cara-a-cara?a=alcides" }));
    expect(await screen.findByRole("heading", { level: 1, name: "la percha" })).toBeInTheDocument();
    expect(router.state.location.search).toEqual({ a: "alcides" });
    await act(() => router.navigate({ href: "/plantilla/album" }));
    expect(await screen.findByRole("heading", { level: 1, name: "la percha" })).toBeInTheDocument();
  });
});

describe("Plantilla's search keeps a dorsal", () => {
  it("?q=11 stays the text «11» (the router parses it as a number)", async () => {
    expect(plantillaSearchSchema.parse({ q: 11 }).q).toBe("11");
    expect(plantillaSearchSchema.parse({ q: "jo" }).q).toBe("jo");
    expect(plantillaSearchSchema.parse({ q: { x: 1 } }).q).toBeUndefined();
    const router = createAppRouter(createMemoryHistory({ initialEntries: ["/plantilla?q=11"] }));
    await router.load();
    expect(router.state.matches.at(-1)?.search).toMatchObject({ q: "11" });
  });
});
