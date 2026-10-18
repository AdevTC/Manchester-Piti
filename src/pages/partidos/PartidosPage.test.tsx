import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import type { ClubMatch } from "../../lib/clubData";
import type { MatchEvent } from "../../../functions/src/matchEngine";
import { readyClock, transitionClock } from "../../../functions/src/matchClock";

// /partidos, «El calendario de luz»: filters, rival search, season selector, the table view, the J-now plinth
// through the match day's phases, the member's RSVP (fans never see answers) and the server render (no WebGL).
// Data, season, clock, viewer and router are stubbed: no Firebase.

const MIN = 60_000;
const DAY = 86_400_000;
const T0 = Date.UTC(2026, 9, 18, 12); // dom 18 oct, 14:00 in Madrid
const KO = Date.UTC(2026, 9, 18, 17); // 19:00 in Madrid
const clock = vi.hoisted(() => ({ now: 0 }));
const data = vi.hoisted(() => ({ matches: [] as unknown[], players: [] as unknown[], error: null as Error | null, loading: false }));
const route = vi.hoisted(() => ({ search: {} as { view?: string; season?: string }, navigate: vi.fn() }));
const league = vi.hoisted(() => ({ standings: null as unknown }));
const who = vi.hoisted(() => ({ member: false, playerId: null as string | null, answer: "" }));
const spies = vi.hoisted(() => ({ setSeason: vi.fn(), setAvailability: vi.fn(() => Promise.resolve()), liveDoc: vi.fn(), engine: vi.fn() }));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className, to, params, "aria-label": label }: { children?: ReactNode; className?: string; to?: string; params?: Record<string, string>; "aria-label"?: string }) => (
    <a className={className} aria-label={label} href={to === "/matches/$matchId" ? `/matches/${params?.matchId}` : (to ?? "#")}>
      {children}
    </a>
  ),
  useNavigate: () => route.navigate,
  useSearch: () => route.search,
}));
vi.mock("../../lib/useStandings", () => ({ useStandings: () => ({ standings: league.standings, loading: false }) }));
vi.mock("../../lib/clubData", async (orig) => ({ ...(await orig<typeof import("../../lib/clubData")>()), useClubData: () => ({ matches: data.matches, players: data.players, loading: data.loading, error: data.error }) }));
vi.mock("../../context/SeasonContext", () => ({ useSeason: () => ({ seasons: [{ id: "t0", name: "Temporada 0" }, { id: "t1", name: "Temporada 1" }], selectedSeasonId: route.search.season ?? "t1", loadingSeasons: false }) }));
vi.mock("../../lib/useSetSeason", () => ({ useSetSeason: () => spies.setSeason }));
vi.mock("../../hooks/useClock", () => ({ useClock: () => clock.now }));
vi.mock("../../hooks/useViewer", () => ({ useViewer: () => ({ member: who.member, admin: false, playerId: who.playerId }) }));
vi.mock("../../lib/weather", async (orig) => ({ ...(await orig<typeof import("../../lib/weather")>()), useMatchWeather: () => null }));
vi.mock("../../components/ThemeToggle", () => ({ ThemeToggle: () => null }));
vi.mock("../../components/celeste/Chrome", () => ({ CelesteBackdrop: () => null, CelesteDock: () => null, CelesteFooter: () => null, CelesteHeader: () => null }));
vi.mock("../../components/palomeras3d/engine", () => ({ createEngine: spies.engine }));
vi.mock("../vestuario/writes", () => ({ useMe: () => (who.member ? { uid: "u-jordi", name: "Jordi", playerId: who.playerId } : null), setAvailability: spies.setAvailability }));
vi.mock("../vestuario/live", () => ({
  useLiveDoc: (path: string | null) => {
    spies.liveDoc(path);
    return { data: who.answer, loading: false, error: null };
  },
}));

const { PartidosPage } = await import("./PartidosPage");

const goal = (id: string, minute: number, playerId = "alcides", type: MatchEvent["type"] = "goal"): MatchEvent => ({ id, type, minute, elapsedSeconds: minute * 60, playerId }) as MatchEvent;
const base = { seasonId: "t1", version: 2 as const, duration: 50, venue: "CDM PALOMERAS", home: true, starters: [] as string[], bench: [] as string[] };
const j1 = (over: Partial<ClubMatch> = {}): ClubMatch => ({ ...base, id: "j1", rival: "Orduña fc", status: "scheduled", date: KO, starters: ["alcides", "jordi"], ...over }) as ClubMatch;
const j2: ClubMatch = { ...base, id: "j2", rival: "Pitutis", home: false, venue: "Campo de Pitutis", status: "scheduled", date: KO + 7 * DAY - 5 * 3_600_000, starters: ["jordi"] } as ClubMatch;
const j3: ClubMatch = { ...base, id: "j3", rival: "Red Demons", status: "scheduled", date: KO + 21 * DAY } as ClubMatch;
const old: ClubMatch = { ...base, id: "a1", seasonId: "t0", rival: "Atlético Fontarrón", status: "finished", date: KO - 120 * DAY, goalsFor: 4, goalsAgainst: 2 } as ClubMatch;
const live = (events: MatchEvent[]) => j1({ clock: transitionClock(readyClock(), "start", KO), events });

const plinth = () => document.querySelector<HTMLElement>(".pl-plinth")!;

beforeEach(() => {
  // jsdom has no 2D canvas: the still painter just skips
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  clock.now = T0;
  data.players = [
    { id: "alcides", shirtName: "ALCIDES", number: 7, seasons: ["t1"] },
    { id: "jordi", shirtName: "JORDI", number: 28, seasons: ["t1"] },
  ];
  data.matches = [j1(), j2, j3, old];
  data.error = null;
  data.loading = false;
  route.search = {};
  route.navigate.mockReset();
  league.standings = null;
  who.member = false;
  who.playerId = null;
  who.answer = "";
  spies.setSeason.mockReset();
  spies.setAvailability.mockClear();
  spies.liveDoc.mockReset();
  spies.engine.mockReset();
});

it("the jornadas of the season as slices of light, the featured one first, and the calendar rows", () => {
  render(<PartidosPage />);
  expect(screen.getByRole("heading", { level: 1, name: "Partidos" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "El calendario de luz" })).toBeInTheDocument();
  const slices = [...document.querySelectorAll(".pl-sl")];
  expect(slices).toHaveLength(3);
  expect(slices[0]).toHaveClass("pl-feat");
  expect(within(slices[0] as HTMLElement).getByRole("link", { name: /^Jornada 1, Contra Orduña fc, hoy/ })).toHaveAttribute("href", "/matches/j1");
  expect(slices[1]).toHaveTextContent("En casa de Pitutis");
  expect(slices[1]).toHaveTextContent("Fuera, en Pitutis");
  const rows = screen.getAllByRole("listitem").filter((li) => li.classList.contains("pl-row"));
  expect(rows.map((r) => r.querySelector(".tx > a")?.textContent)).toEqual(["Contra Orduña fc", "En casa de Pitutis", "Contra Red Demons"]);
  // the venue as people write it, the kit in words
  expect(rows[0]).toHaveTextContent("CDM Palomeras");
  expect(within(rows[1]).getByRole("img", { name: "2ª equipación" })).toBeInTheDocument();
});

it("filters: Próximos and Resultados, the pressed one says so", () => {
  data.matches = [j1({ status: "finished", date: T0 - 7 * DAY, goalsFor: 3, goalsAgainst: 1 }), j2, j3];
  render(<PartidosPage />);
  const results = screen.getByRole("button", { name: "Resultados" });
  fireEvent.click(results);
  expect(results).toHaveAttribute("aria-pressed", "true");
  const rows = document.querySelectorAll(".pl-row");
  expect(rows).toHaveLength(1);
  // the result with its letter in words, never the colour alone
  expect(rows[0]).toHaveTextContent("victoria");
  expect(rows[0]).toHaveTextContent("3–1");
  fireEvent.click(screen.getByRole("button", { name: "Próximos" }));
  expect(document.querySelectorAll(".pl-row")).toHaveLength(2);
});

it("rival search, and suggestions when nobody is called that", () => {
  render(<PartidosPage />);
  const input = screen.getByRole("searchbox", { name: "Buscar rival" });
  fireEvent.change(input, { target: { value: "piTU" } });
  expect([...document.querySelectorAll(".pl-row .tx > a")].map((a) => a.textContent)).toEqual(["En casa de Pitutis"]);
  fireEvent.change(input, { target: { value: "zzz" } });
  expect(screen.getByText("Ningún rival se llama «zzz»")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Red Demons" }));
  expect(input).toHaveValue("Red Demons");
  expect(document.querySelectorAll(".pl-row")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Borrar la búsqueda" }));
  expect(input).toHaveValue("");
});

it("season selector: the seasons and «Todas las temporadas»; all of them groups the rows and drops the light", () => {
  const { unmount } = render(<PartidosPage />);
  const select = screen.getByRole("combobox", { name: "Temporada" });
  expect([...select.querySelectorAll("option")].map((o) => o.textContent)).toEqual(["Temporada 1", "Temporada 0", "Todas las temporadas"]);
  fireEvent.change(select, { target: { value: "all" } });
  expect(spies.setSeason).toHaveBeenCalledWith("all");
  unmount();
  route.search = { season: "all" };
  render(<PartidosPage />);
  expect(screen.queryByRole("heading", { name: "El calendario de luz" })).toBeNull();
  expect(screen.getByText(/La clasificación y el calendario de luz van por temporada/)).toBeInTheDocument();
  expect([...document.querySelectorAll(".pl-ghd b")].map((b) => b.textContent)).toEqual(["Temporada 1", "Temporada 0"]);
});

it("the table view (?view=tabla) reuses the league table; while live it is provisional", () => {
  route.search = { view: "tabla" };
  clock.now = KO + 20 * MIN;
  data.matches = [live([goal("g1", 6)]), j2, j3];
  league.standings = { id: "t1", competition: "Liga F7", jornada: 0, updatedAt: 0, updatedBy: "", rows: [
    { team: "Entrepibas F.C.", pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0, isUs: false },
    { team: "Manchester Piti", pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0, isUs: true },
    { team: "Orduña FC", pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0, isUs: false },
  ] };
  render(<PartidosPage />);
  expect(screen.getByRole("button", { name: /Tabla/ })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText("Provisional: así quedaría si el partido acaba ahora")).toBeInTheDocument();
  const table = screen.getByRole("region", { name: "Tabla de la clasificación" });
  const teams = [...table.querySelectorAll(".cl-team")].map((t) => t.textContent);
  expect(teams).toEqual(["Manchester Piti", "Entrepibas F.C.", "Orduña FC"]);
  // no calendar filters in the table view; Calendario goes back
  expect(screen.queryByRole("button", { name: "Resultados" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Calendario/ }));
  expect(route.navigate).toHaveBeenCalled();
});

it("J-now through the match day: semana, antes, directo, final and aplazado", () => {
  // semana: the next one in N days
  clock.now = KO - 4 * DAY;
  const { unmount } = render(<PartidosPage />);
  expect(plinth()).toHaveTextContent("La siguiente, en 4 días");
  expect(within(plinth()).getByRole("link", { name: "Ver la previa" })).toHaveAttribute("href", "/matches/j1");
  unmount();

  // antes: today, the countdown and the seven
  clock.now = T0;
  const r2 = render(<PartidosPage />);
  expect(plinth()).toHaveTextContent("Hoy, a las 19:00");
  expect(plinth()).toHaveTextContent("Faltan 5 h 0 min. El siete ya está publicado");
  expect(within(plinth()).getByRole("link", { name: "Cómo llegar" })).toHaveAttribute("href", expect.stringContaining("google.com/maps"));
  r2.unmount();

  // directo1: the scoreboard object, the last play, the goals as minute chips
  clock.now = KO + 12 * MIN;
  data.matches = [live([goal("g1", 6), { id: "g2", type: "opponent_goal", minute: 11, elapsedSeconds: 660 } as MatchEvent]), j2, j3];
  const r3 = render(<PartidosPage />);
  expect(plinth()).toHaveTextContent("En juego, primera parte");
  const goals = within(plinth()).getByRole("list", { name: "Goles" });
  expect(within(goals).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["6′ALCIDES", "11′Orduña fc (gol del rival)"]);
  expect(document.querySelector(".pl-sb")).toHaveTextContent("1:1");
  expect(within(plinth()).getByRole("link", { name: "Seguir el partido" })).toBeInTheDocument();
  expect(document.querySelector(".pl-row.live")).toHaveTextContent("En juego 1–1");
  r3.unmount();

  // final: acta pending
  clock.now = KO + 70 * MIN;
  const c1 = transitionClock(readyClock(), "start", KO);
  const ended = transitionClock(transitionClock(transitionClock(c1, "halftime", KO + 25 * MIN), "second", KO + 30 * MIN), "finish", KO + 55 * MIN);
  data.matches = [j1({ clock: ended, events: [goal("g1", 6)] }), j2, j3];
  const r4 = render(<PartidosPage />);
  expect(plinth()).toHaveTextContent("Final");
  expect(plinth()).toHaveTextContent("El acta llega en unos minutos");
  r4.unmount();

  // aplazado: the tape on the slice and the row struck through
  clock.now = T0;
  data.matches = [j1({ status: "postponed" }), j2, j3];
  render(<PartidosPage />);
  expect(plinth()).toHaveTextContent("Aplazado");
  expect(document.querySelector(".pl-feat .pl-tape")).toHaveTextContent("APLAZADO");
  const off = document.querySelector(".pl-row.off");
  expect(off).toHaveTextContent("Aplazado, sin fecha");
});

it("fans never see answers: no RSVP, no member reads", async () => {
  render(<PartidosPage />);
  await act(async () => {});
  expect(screen.queryByRole("group", { name: /¿Vas/ })).toBeNull();
  expect(screen.queryByRole("button", { name: "Voy" })).toBeNull();
  expect(spies.liveDoc).not.toHaveBeenCalled();
});

it("a member: his own answer on the rows where he is called, and he can change it", async () => {
  who.member = true;
  who.playerId = "jordi";
  who.answer = "yes";
  data.matches = [j1(), j2, { ...j3, starters: [] }];
  render(<PartidosPage />);
  const row = await screen.findByRole("group", { name: "¿Vas a la jornada 2 contra Pitutis?" });
  expect(within(row).getByRole("button", { name: /Voy/ })).toHaveAttribute("aria-pressed", "true");
  // not called for J3: no control there
  expect(screen.queryByRole("group", { name: /jornada 3/ })).toBeNull();
  // only his own doc is read
  expect(spies.liveDoc.mock.calls.every(([p]) => p === null || /\/availability\/u-jordi$/.test(p))).toBe(true);
  await act(async () => {
    fireEvent.click(within(row).getByRole("button", { name: "Duda" }));
  });
  expect(spies.setAvailability).toHaveBeenCalledWith({ uid: "u-jordi", name: "Jordi", playerId: "jordi" }, "j2", "maybe");
  // the plinth's line for today's match
  expect(await within(plinth()).findByText("Vas, y juegas de inicio.")).toBeInTheDocument();
});

it("server render: the page and the CSS sky without WebGL or member data", () => {
  who.member = true;
  who.playerId = "jordi";
  const html = renderToString(<PartidosPage />);
  expect(html).toContain("El calendario de luz");
  expect(html).toContain("Contra Orduña fc");
  expect(html).toContain("pm-still");
  expect(html).not.toContain("¿Vas");
  expect(spies.engine).not.toHaveBeenCalled();
  expect(spies.liveDoc).not.toHaveBeenCalled();
});

it("states: pretemporada, loading and the data error", () => {
  data.matches = [];
  const r1 = render(<PartidosPage />);
  expect(screen.getByRole("heading", { name: "El calendario aún no está" })).toBeInTheDocument();
  expect(screen.getByText("Sin partidos todavía")).toBeInTheDocument();
  r1.unmount();
  data.loading = true;
  const r2 = render(<PartidosPage />);
  expect(screen.getByLabelText("Cargando los partidos")).toHaveAttribute("aria-busy", "true");
  r2.unmount();
  data.loading = false;
  data.error = new Error("unavailable");
  render(<PartidosPage />);
  const alert = screen.getByRole("alert");
  expect(within(alert).getByRole("heading", { name: "No nos llegan los partidos" })).toBeInTheDocument();
  expect(within(alert).getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
});
