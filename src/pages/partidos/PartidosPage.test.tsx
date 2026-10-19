import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import type { ClubMatch } from "../../lib/clubData";
import { longSeasonFixture } from "../../lib/derived/vidrio/fixtures";

// (the member's rows live in a lazy chunk: on a busy machine the import can take longer than findBy's 1 s)
const LAZY = { timeout: 5000 };

// /partidos «Vidrio»: the ribbon of the season, the lens through the states of a jornada, the three vistas
// (?view=tabla, ?view=numeros), «¿Y si…?», the filters, the rival search, the season, «Ver todo», el cartel,
// the member's «¿Vas?» (fans never read answers) and the server render. The long season of P2 (14 teams, 26
// jornadas, J17 live at minute 23) drives it; data, season, clock, viewer and router are stubbed: no Firebase.

const F = longSeasonFixture();
const DAY = 86_400_000;
const clock = vi.hoisted(() => ({ now: 0 }));
const data = vi.hoisted(() => ({ matches: [] as unknown[], players: [] as unknown[], error: null as Error | null, loading: false }));
const route = vi.hoisted(() => ({ search: {} as { view?: string; season?: string; temporada?: string }, navigate: vi.fn() }));
const league = vi.hoisted(() => ({ standings: null as unknown }));
const who = vi.hoisted(() => ({ member: false, playerId: null as string | null, answer: "", porra: null as { goalsFor: number; goalsAgainst: number; goals: [] } | null, answers: [] as { uid: string; response: "yes" | "no" | "maybe"; name: string; playerId: string | null }[], vote: "" }));
const spies = vi.hoisted(() => ({ setSeason: vi.fn(), setAvailability: vi.fn(() => Promise.resolve()), liveDoc: vi.fn() }));
const seasons = vi.hoisted(() => ({ list: [] as { id: string; name: string }[] }));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className, to, params }: { children?: ReactNode; className?: string; to?: string; params?: Record<string, string> }) => (
    <a className={className} href={to === "/matches/$matchId" ? `/matches/${params?.matchId}` : (to ?? "#")}>
      {children}
    </a>
  ),
  useNavigate: () => route.navigate,
  useSearch: () => route.search,
}));
vi.mock("../../lib/useStandings", () => ({ useStandings: () => ({ standings: league.standings, loading: false }) }));
vi.mock("../../lib/clubData", async (orig) => ({ ...(await orig<typeof import("../../lib/clubData")>()), useClubData: () => ({ matches: data.matches, players: data.players, loading: data.loading, error: data.error }) }));
vi.mock("../../context/SeasonContext", () => ({ useSeason: () => ({ seasons: seasons.list, selectedSeasonId: route.search.season ?? "all", loadingSeasons: false }) }));
vi.mock("../../lib/useSetSeason", () => ({ useSetSeason: () => spies.setSeason }));
vi.mock("../../hooks/useClock", () => ({ useClock: () => clock.now }));
vi.mock("../../hooks/useViewer", () => ({ useViewer: () => ({ member: who.member, admin: false, playerId: who.playerId }) }));
vi.mock("../../hooks/useDocumentTheme", () => ({ useDocumentTheme: () => "dark" }));
vi.mock("../../lib/weather", async (orig) => ({ ...(await orig<typeof import("../../lib/weather")>()), useMatchWeather: () => null }));
vi.mock("../../components/jersey3d/useShirtStills", () => ({ useShirtStills: () => () => undefined }));
vi.mock("../vestuario/live", () => ({
  useMvpResults: () => new Map([["j5", { id: "j5", counts: { alcides: 9 }, total: 9 }]]),
  useLiveDoc: (path: string | null) => {
    spies.liveDoc(path);
    return { data: who.answer, loading: false, error: null };
  },
  useMyPrediction: (matchId: string | undefined, uid: string | undefined) => {
    spies.liveDoc(matchId && uid ? `matchPrivate/${matchId}/predictions/${uid}` : null);
    return { data: who.porra, loading: false, error: null };
  },
  useAvailability: (matchId: string | undefined) => {
    spies.liveDoc(matchId ? `matchPrivate/${matchId}/availability` : null);
    return { data: matchId ? who.answers : [], loading: false, error: null };
  },
  useMyMvpVote: (matchId: string | undefined, uid: string | undefined) => {
    spies.liveDoc(matchId && uid ? `matches/${matchId}/votes/${uid}` : null);
    return { data: who.vote, loading: false, error: null };
  },
}));
vi.mock("./vidrio/venuePlace", () => ({ useVenuePlace: () => null }));
vi.mock("../../components/celeste/PredictionForm", () => ({ PredictionForm: ({ match }: { match: { id: string } }) => <p>El formulario de la porra de {match.id}</p> }));
vi.mock("../../components/ThemeToggle", () => ({ ThemeToggle: () => null }));
vi.mock("../../components/celeste/Chrome", () => ({ CelesteDock: () => null, CelesteFooter: () => null, CelesteHeader: () => null }));
vi.mock("../vestuario/writes", () => ({ useMe: () => (who.member ? { uid: "u-jordi", name: "Jordi", playerId: who.playerId } : null), setAvailability: spies.setAvailability }));

const { PartidosPage } = await import("./PartidosPage");

const players = F.squad.map((p) => ({ id: p.id, shirtName: p.name.toUpperCase(), number: Number(p.num), seasons: [F.seasonId, "t0"] }));
const old: ClubMatch = { id: "o1", seasonId: "t0", version: 2, rival: "Atlético Fontarrón", status: "finished", date: F.now - 300 * DAY, goalsFor: 4, goalsAgainst: 2, home: true, duration: 50, venue: "CDM PALOMERAS", starters: [], bench: [], events: [] } as ClubMatch;

const lens = () => document.querySelector<HTMLElement>(".vp-lens")!;
const seg = (n: number) => document.querySelector<HTMLButtonElement>(`.vp-seg[data-seg="j${n}"]`);

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  clock.now = F.now;
  data.matches = [...longSeasonFixture().matches, old];
  data.players = players;
  data.error = null;
  data.loading = false;
  seasons.list = [{ id: "t0", name: "Temporada 0" }, { id: F.seasonId, name: "Temporada 1" }];
  route.search = {};
  route.navigate.mockReset();
  league.standings = { id: F.seasonId, competition: "Liga F7", jornada: 16, updatedAt: 0, updatedBy: "", rows: F.standings };
  who.member = false;
  who.porra = null;
  who.playerId = null;
  who.answer = "";
  who.answers = [];
  who.vote = "";
  spies.setSeason.mockReset();
  spies.setAvailability.mockClear();
  spies.liveDoc.mockReset();
});

it("opens on tonight's live jornada: the ribbon, the lens on Directo, the score, the plays and «Ver todo»", () => {
  render(<PartidosPage />);
  expect(screen.getByRole("heading", { level: 1, name: "Partidos" })).toBeInTheDocument();
  expect(seg(17)).toHaveAttribute("aria-pressed", "true");
  expect(seg(17)).toHaveAccessibleName("J17, domingo 17 de enero, contra Orduña fc. En directo: 2–1, minuto 23");
  expect(within(lens()).getByRole("heading", { level: 2 })).toHaveTextContent("Contra Orduña fc");
  expect(within(lens()).getByRole("tab", { name: /Directo/ })).toHaveAttribute("aria-selected", "true");
  expect(within(lens()).getByRole("img", { name: "Manchester Piti 2, Orduña fc 1" })).toBeInTheDocument();
  expect(lens()).toHaveTextContent("En directo23′de la primera parte");
  const plays = lens().querySelectorAll(".vp-dir__plays .vd-play");
  expect(plays).toHaveLength(4);
  expect(lens()).toHaveTextContent("34 jugadas más desde el minuto 1");
  expect(screen.getByRole("link", { name: "Abrir el partido" })).toHaveAttribute("href", "/matches/j17");
  // the count line and the vistas' hints
  expect(screen.getByText("26 jornadas; 15 jugadas, una en directo y 10 por jugar")).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: /Jornadas/ })).toHaveTextContent("J17 en directo");
  expect(screen.getByRole("tab", { name: /Tabla/ })).toHaveTextContent(/^TablaSi acaba así: \dº con \d+ puntos$/);
});

it("a played jornada opens on its acta: the result, the scorers, the signature, the MVP; its Directo and Previa too", () => {
  render(<PartidosPage />);
  fireEvent.change(screen.getByRole("searchbox", { name: "Buscar rival" }), { target: { value: "red dem" } });
  fireEvent.click(screen.getByRole("button", { name: /^J5, Red Demons/ }));
  expect(within(lens()).getByRole("heading", { level: 2 })).toHaveTextContent("Contra Red Demons");
  expect(within(lens()).getByRole("tab", { name: "Acta" })).toHaveAttribute("aria-selected", "true");
  expect(lens()).toHaveTextContent(/Final, (ganamos|empatamos|perdimos) \d–\d\. Acta publicada\./);
  expect(within(lens()).getByRole("list", { name: "Goles" })).toBeInTheDocument();
  expect(within(lens()).getByRole("img", { name: /^La firma del partido/ })).toBeInTheDocument();
  expect(lens()).toHaveTextContent("MVP del partidoAlcides");
  fireEvent.click(within(lens()).getByRole("tab", { name: "Directo" }));
  expect(lens()).toHaveTextContent(/^.*Final50′/);
  fireEvent.click(within(lens()).getByRole("tab", { name: "Previa" }));
  expect(lens()).toHaveTextContent("El siete que salió");
});

it("ribbon keys, «Hoy» and paging", () => {
  render(<PartidosPage />);
  fireEvent.keyDown(seg(17)!, { key: "ArrowRight" });
  expect(seg(18)).toHaveAttribute("aria-pressed", "true");
  // an upcoming jornada: the previa, no tabs, the countdown in weeks
  expect(within(lens()).queryByRole("tablist")).toBeNull();
  expect(lens()).toHaveTextContent("Dentro de 7 días.");
  expect(lens()).toHaveTextContent("Aún sin el siete");
  fireEvent.click(screen.getByRole("button", { name: "Volver a hoy" }));
  expect(seg(17)).toHaveAttribute("aria-pressed", "true");
  const before = [...document.querySelectorAll(".vp-seg")].map((b) => b.getAttribute("data-seg"));
  fireEvent.click(screen.getByRole("button", { name: "Jornadas anteriores" }));
  const after = [...document.querySelectorAll(".vp-seg")].map((b) => b.getAttribute("data-seg"));
  expect(after[0]).not.toBe(before[0]);
  expect(screen.getByRole("slider", { name: /La temporada entera/ })).toHaveAttribute("aria-valuemax", "26");
});

it("postponed and «pendiente del acta» jornadas: one view, no score", () => {
  render(<PartidosPage />);
  const search = screen.getByRole("searchbox", { name: "Buscar rival" });
  fireEvent.change(search, { target: { value: "sporting" } });
  fireEvent.click(screen.getByRole("button", { name: /^J20, Sporting de Brugal/ }));
  expect(lens()).toHaveTextContent("Este partido se aplazó: aún no tiene fecha nueva.");
  expect(within(lens()).queryByRole("tablist")).toBeNull();
  // a jornada nobody started on la mesa, past its window
  const ko = F.now - 3 * 3_600_000;
  data.matches = [{ id: "p1", seasonId: "t1", version: 2, rival: "Orduña fc", status: "scheduled", date: ko, home: true, duration: 50, venue: "CDM PALOMERAS", starters: ["evans"], bench: [], events: [] } as ClubMatch];
  seasons.list = [{ id: "t1", name: "Temporada 1" }];
  league.standings = null;
  const r = render(<PartidosPage />);
  const l = r.container.querySelector<HTMLElement>(".vp-lens")!;
  expect(l).toHaveTextContent("Pendiente del acta");
  expect(within(l).queryByRole("img", { name: /Manchester Piti \d/ })).toBeNull();
});

it("filters: Próximos and Resultados re-flow the ribbon and say so", () => {
  render(<PartidosPage />);
  const group = screen.getByRole("group", { name: "Qué jornadas ver" });
  fireEvent.click(within(group).getByRole("button", { name: "Próximos" }));
  expect(within(group).getByRole("button", { name: "Próximos" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText("11 jornadas por jugar")).toBeInTheDocument();
  expect(seg(5)).toBeNull();
  fireEvent.click(within(group).getByRole("button", { name: "Resultados" }));
  expect(screen.getByText("16 jornadas con resultado")).toBeInTheDocument();
  expect(seg(18)).toBeNull();
});

it("rival search: the jornadas with that rival, and nobody called that", () => {
  render(<PartidosPage />);
  const input = screen.getByRole("searchbox", { name: "Buscar rival" });
  fireEvent.change(input, { target: { value: "ORDUÑA" } });
  const found = screen.getByRole("list", { name: "Jornadas encontradas" });
  expect(within(found).getAllByRole("button").map((b) => b.textContent)).toEqual([expect.stringMatching(/^J4, Orduña fc/), expect.stringMatching(/^J17, Orduña fc.*en directo$/)]);
  fireEvent.keyDown(input, { key: "Enter" });
  expect(within(lens()).getByRole("heading", { level: 2 })).toHaveTextContent("En casa de Orduña fc");
  fireEvent.change(input, { target: { value: "zzz" } });
  expect(screen.getAllByText("Ningún rival se llama así esta temporada").length).toBeGreaterThan(0);
});

it("season: a combobox «Temporada» with the seasons; a past one is closed (no «¿y si…?»)", () => {
  const { unmount } = render(<PartidosPage />);
  const box = screen.getByRole("combobox", { name: "Temporada" });
  expect(box).toHaveTextContent("Temporada 1");
  fireEvent.click(box);
  const options = screen.getAllByRole("option");
  expect(options.map((o) => o.textContent)).toEqual([expect.stringMatching(/^Temporada 1La de ahora, liga de fútbol 7/), expect.stringMatching(/^Temporada 0Archivada: (invierno|primavera|verano|otoño) de \d{4}, 1 partido/)]);
  fireEvent.click(options[1]);
  // (the season is the page's own address: ?temporada=t0, never the choice remembered from another visit)
  const go = route.navigate.mock.calls.at(-1)?.[0] as { search: (p: object) => object };
  expect(go.search({})).toMatchObject({ temporada: "t0" });
  unmount();
  route.search = { season: "t0", view: "tabla" };
  const again = render(<PartidosPage />);
  expect(screen.getByRole("combobox", { name: "Temporada" })).toHaveTextContent("Temporada 1");
  again.unmount();
  route.search = { temporada: "t0", view: "tabla" };
  render(<PartidosPage />);
  expect(screen.getAllByText(/Archivada|Temporada archivada/).length).toBeGreaterThan(0);
  expect(screen.getByRole("heading", { name: "La temporada acabó" })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: /Jornadas/ })).toHaveTextContent("Todo jugado");
});

it("Tabla (?view=tabla): the table in focus, «Si acaba así», «¿Y si…?» with picks, presets and «Volver a lo real»", () => {
  route.search = { view: "tabla" };
  render(<PartidosPage />);
  expect(screen.getByRole("tab", { name: /Tabla/ })).toHaveAttribute("aria-selected", "true");
  const panel = document.querySelector<HTMLElement>(".vp-panel--tabla")!;
  expect(panel).toHaveClass("is-on");
  expect(within(panel).getByRole("heading", { name: "Si acaba así" })).toBeInTheDocument();
  const table = within(panel).getByRole("table");
  expect(table.querySelector("tr.us")).toHaveTextContent("Manchester Piti");
  expect(table.querySelector("tr.us")).toHaveTextContent("si acaba así");
  expect(within(panel).getByRole("button", { name: "Ver la tabla entera (14)" })).toBeInTheDocument();
  const first = within(panel).getAllByRole("group", { name: /^¿Y si en la J18/ })[0];
  fireEvent.click(within(first).getByRole("button", { name: "Ganamos" }));
  expect(within(first).getByRole("button", { name: "Ganamos" })).toHaveAttribute("aria-pressed", "true");
  expect(panel).toHaveTextContent("Con tus resultados de mentira");
  expect(panel.querySelector(".vp-simline")).toHaveTextContent(/^Con lo que has tocado: \d+ puntos, \dº\. Los demás equipos se quedan como están\.$/);
  fireEvent.click(within(panel).getByRole("button", { name: /Todo victorias/ }));
  expect(within(panel).getByRole("button", { name: /Todo victorias/ })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(within(panel).getByRole("button", { name: "Volver a lo real" }));
  expect(panel.querySelector(".vp-simline")).toHaveTextContent(/^Ahora mismo:/);
  // the whole table grows in place
  fireEvent.click(within(panel).getByRole("button", { name: "Ver la tabla entera (14)" }));
  const grown = screen.getByRole("region", { name: "La tabla entera" });
  expect(within(grown).getAllByRole("row")).toHaveLength(15);
  fireEvent.click(within(grown).getByRole("button", { name: "Cerrar" }));
  expect(screen.queryByRole("region", { name: "La tabla entera" })).toBeNull();
});

it("Números (?view=numeros): the figures, the shared Pichichi in words with both names, the assisters", () => {
  route.search = { view: "numeros" };
  render(<PartidosPage />);
  const panel = document.querySelector<HTMLElement>(".vp-panel--numeros")!;
  expect(panel).toHaveClass("is-on");
  expect(within(panel).getByRole("list", { name: "La temporada en cifras" })).toHaveTextContent("si acaba así");
  const pichichi = within(panel).getByText(/^Pichichi compartido:/);
  expect(pichichi).toHaveTextContent("Adrián T.C.");
  expect(pichichi).toHaveTextContent("Alcides");
  expect(within(panel).getByRole("img", { name: /^Goles nuestros por tramos/ })).toBeInTheDocument();
  fireEvent.click(within(panel).getAllByRole("button", { name: /^Ver todos los goleadores/ })[0]);
  expect(screen.getByRole("region", { name: "Todos los goleadores" })).toBeInTheDocument();
});

it("«Ver todo el partido» grows the plays, with filters", () => {
  render(<PartidosPage />);
  fireEvent.click(within(lens()).getByRole("button", { name: "Ver todo el partido" }));
  const grown = screen.getByRole("region", { name: "Jugada a jugada, J17" });
  expect(grown).toHaveTextContent("38 jugadas hasta el minuto 23; las nuevas entran arriba.");
  const all = grown.querySelectorAll(".vd-play").length;
  fireEvent.click(within(grown).getByRole("button", { name: "Goles" }));
  expect(grown.querySelectorAll(".vd-play").length).toBeLessThan(all);
  expect([...grown.querySelectorAll(".vd-play b")].every((b) => /^Gol|Autogol/.test(b.textContent ?? ""))).toBe(true);
});

it("el cartel: a poster of the jornada in a sheet, «Compartir» and «Guardar la imagen»", () => {
  render(<PartidosPage />);
  fireEvent.click(within(lens()).getByRole("button", { name: "El cartel de la jornada" }));
  const sheet = screen.getByRole("dialog", { name: "Cartel de la J17" });
  expect(within(sheet).getByRole("img", { name: /^Cartel de la J17: Manchester Piti contra Orduña fc/ })).toBeInTheDocument();
  expect(within(sheet).getByRole("button", { name: "Compartir" })).toBeInTheDocument();
  expect(within(sheet).getByRole("button", { name: "Guardar la imagen" })).toBeInTheDocument();
  fireEvent.click(within(sheet).getByRole("button", { name: "Cerrar el cartel" }));
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("vistas: the shelf navigates with ?view", () => {
  render(<PartidosPage />);
  fireEvent.click(screen.getByRole("tab", { name: /Números/ }));
  expect(route.navigate).toHaveBeenCalled();
});

it("fans never see answers: no RSVP, no member reads", async () => {
  render(<PartidosPage />);
  await act(async () => {});
  fireEvent.keyDown(seg(17)!, { key: "ArrowRight" });
  await act(async () => {});
  expect(screen.queryByRole("group", { name: /¿Vas/ })).toBeNull();
  expect(screen.queryByText(/Tu porra/)).toBeNull();
  expect(spies.liveDoc).not.toHaveBeenCalled();
});

it("a member called for the next jornada answers «¿Vas?» in its previa, and only his own doc is read", async () => {
  who.member = true;
  who.playerId = "jordi";
  who.answer = "yes";
  who.answers = [{ uid: "u-jordi", response: "yes", name: "Jordi", playerId: "jordi" }];
  data.matches = (data.matches as ClubMatch[]).map((m) => (m.id === "j18" ? { ...m, starters: ["jordi", "evans"], bench: [] } : m));
  render(<PartidosPage />);
  fireEvent.keyDown(seg(17)!, { key: "ArrowRight" });
  const row = await screen.findByRole("group", { name: "¿Vas a la jornada 18 contra Red Demons?" }, LAZY);
  expect(within(row).getByRole("button", { name: /Voy/ })).toHaveAttribute("aria-pressed", "true");
  // the convocatoria in numbers (members only) and his own line
  expect(screen.getByLabelText("La convocatoria: 1 vienen, 0 en duda, 0 no vienen, 1 sin responder")).toBeInTheDocument();
  expect(lens()).toHaveTextContent("Vas, y eres titular. Falta 1 por contestar.");
  expect(spies.liveDoc.mock.calls.every(([p]) => p === null || /\/(availability|predictions)\/u-jordi$|\/availability$|\/votes\/u-jordi$/.test(p))).toBe(true);
  await act(async () => {
    fireEvent.click(within(row).getByRole("button", { name: "Duda" }));
  });
  expect(spies.setAvailability).toHaveBeenCalledWith({ uid: "u-jordi", name: "Jordi", playerId: "jordi" }, "j18", "maybe");
});

it("a fan keeps «Convocados…»: no numbers, no answers read", async () => {
  data.matches = (data.matches as ClubMatch[]).map((m) => (m.id === "j18" ? { ...m, starters: ["jordi", "evans"], bench: [] } : m));
  render(<PartidosPage />);
  fireEvent.keyDown(seg(17)!, { key: "ArrowRight" });
  await act(async () => {});
  expect(lens()).toHaveTextContent("Convocados 2: el siete.");
  expect(screen.queryByLabelText(/^La convocatoria:/)).toBeNull();
  expect(spies.liveDoc).not.toHaveBeenCalled();
});

it("a member's porra in the previa: his score and the form behind «Cambiarla» before kick-off, read-only after", async () => {
  who.member = true;
  who.playerId = "jordi";
  who.porra = { goalsFor: 2, goalsAgainst: 1, goals: [] };
  render(<PartidosPage />);
  fireEvent.keyDown(seg(17)!, { key: "ArrowRight" });
  expect((await screen.findAllByLabelText("Tu porra: 2–1", {}, LAZY)).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/Se cierra con el pitido/).length).toBeGreaterThan(0);
  const change = screen.getAllByRole("button", { name: "Cambiarla" })[0];
  expect(change).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(change);
  expect(screen.getByText("El formulario de la porra de j18")).toBeInTheDocument();
  expect(spies.liveDoc).toHaveBeenCalledWith("matchPrivate/j18/predictions/u-jordi");
  // a played jornada: only the line, no form
  fireEvent.keyDown(seg(18)!, { key: "ArrowLeft" });
  fireEvent.keyDown(seg(17)!, { key: "ArrowLeft" });
  fireEvent.click(screen.getByRole("tab", { name: /Previa/ }));
  expect((await screen.findAllByLabelText("Tu porra: 2–1", {}, LAZY)).length).toBeGreaterThan(0);
  expect(screen.queryByRole("button", { name: /Cambiarla|Ponerla/ })).toBeNull();
});

it("server render: the ribbon, the lens on tonight, Tabla and Números in the markup, no member data", () => {
  who.member = true;
  who.playerId = "jordi";
  const html = renderToString(<PartidosPage />);
  expect(html).toContain("Contra Orduña fc");
  expect(html).toContain("vp-seg");
  expect(html).toContain("vp-panel--jornadas is-on");
  expect(html).toContain("Si acaba así");
  expect(html).toContain("Pichichi compartido");
  expect(html).toContain('role="combobox"');
  expect(html).not.toContain("¿Vas");
  expect(html).not.toContain("Tu porra");
  expect(spies.liveDoc).not.toHaveBeenCalled();
  route.search = { view: "tabla" };
  expect(renderToString(<PartidosPage />)).toContain("vp-panel--tabla is-on");
});

it("states: pretemporada, loading and the data error", () => {
  data.matches = [];
  const r1 = render(<PartidosPage />);
  expect(screen.getByRole("heading", { name: "El calendario aún no está" })).toBeInTheDocument();
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
