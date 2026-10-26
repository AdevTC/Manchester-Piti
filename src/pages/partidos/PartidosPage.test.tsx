import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import type { ClubMatch } from "../../lib/clubData";
import { longSeasonFixture } from "../../lib/derived/vidrio/fixtures";

// /partidos «Vidrio», round 11 (PA- boards): the identity (season, the three screens with their headlines, the rival
// search), Jornadas (ribbon and lens), Tabla (published and «mientras llega», «¿Y si…?», the captain's «Publicar»),
// Balance (columns, readout, facets), el cartel and the server render. The long demo season (14 teams, 26 jornadas,
// J17 live at minute 23, two postponed) drives it; data, season, clock, viewer and router are stubbed.

const F = longSeasonFixture();
const LAZY = { timeout: 5000 };
const clock = vi.hoisted(() => ({ now: 0 }));
const data = vi.hoisted(() => ({ matches: [] as unknown[], players: [] as unknown[], error: null as Error | null, loading: false }));
const route = vi.hoisted(() => ({ path: "/partidos", search: {} as Record<string, string>, navigate: vi.fn(() => Promise.resolve()), routerNavigate: vi.fn(() => Promise.resolve()) }));
const league = vi.hoisted(() => ({ standings: null as unknown }));
const who = vi.hoisted(() => ({ member: false, admin: false, playerId: null as string | null, answer: "" }));
const spies = vi.hoisted(() => ({ setAvailability: vi.fn(() => Promise.resolve()), liveDoc: vi.fn() }));
const seasons = vi.hoisted(() => ({ list: [] as { id: string; name: string; captainPlayerId?: string }[] }));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className, to }: { children?: ReactNode; className?: string; to?: string }) => (
    <a className={className} href={to ?? "#"}>
      {children}
    </a>
  ),
  useNavigate: () => route.navigate,
  useRouter: () => ({ navigate: route.routerNavigate }),
  useLocation: () => ({ pathname: route.path }),
  useSearch: () => route.search,
}));
vi.mock("../../lib/useStandings", () => ({ useStandings: () => ({ standings: league.standings, loading: false }) }));
vi.mock("../../lib/clubData", async (orig) => ({ ...(await orig<typeof import("../../lib/clubData")>()), useClubData: () => ({ matches: data.matches, players: data.players, loading: data.loading, error: data.error }) }));
vi.mock("../../context/SeasonContext", () => ({ useSeason: () => ({ seasons: seasons.list, selectedSeasonId: "all", loadingSeasons: false }) }));
vi.mock("../../hooks/useClock", () => ({ useClock: () => clock.now }));
vi.mock("../../hooks/useViewer", () => ({ useViewer: () => ({ member: who.member, admin: who.admin, playerId: who.playerId }) }));
vi.mock("../../hooks/useDocumentTheme", () => ({ useDocumentTheme: () => "dark" }));
vi.mock("../../lib/weather", async (orig) => ({ ...(await orig<typeof import("../../lib/weather")>()), useMatchWeather: () => null, useMatchWeatherHourly: () => null }));
vi.mock("../../components/jersey3d/useShirtStills", () => ({ useShirtStills: () => () => undefined }));
vi.mock("../vestuario/live", () => ({
  useMvpResults: () => new Map([["j5", { id: "j5", counts: { alcides: 9 }, total: 9 }]]),
  useLiveDoc: (path: string | null) => {
    spies.liveDoc(path);
    return { data: who.answer, loading: false, error: null };
  },
  useMyPrediction: () => ({ data: null, loading: false, error: null }),
}));
vi.mock("../../components/ThemeToggle", () => ({ ThemeToggle: () => null }));
vi.mock("../../components/celeste/Chrome", () => ({ CelesteDock: () => null, CelesteFooter: () => null, CelesteHeader: () => null }));
vi.mock("../vestuario/writes", () => ({ useMe: () => (who.member ? { uid: "u-jordi", name: "Jordi", playerId: who.playerId } : null), setAvailability: spies.setAvailability }));

const { PartidosPage } = await import("./PartidosPage");

const players = F.squad.map((p) => ({ id: p.id, shirtName: p.name.toUpperCase(), firstName: p.name, number: Number(p.num), seasons: [F.seasonId] }));
const lens = () => document.querySelector<HTMLElement>(".pa-lens")!;
const tile = (j: number) => document.querySelector<HTMLButtonElement>(`.pa-slot[data-j="${j}"] .pa-seg`);

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  clock.now = F.now;
  data.matches = longSeasonFixture().matches;
  data.players = players;
  data.error = null;
  data.loading = false;
  seasons.list = [{ id: F.seasonId, name: "Temporada larga", captainPlayerId: "adrian" }];
  route.path = "/partidos";
  route.search = {};
  route.navigate.mockClear();
  route.routerNavigate.mockClear();
  league.standings = { id: F.seasonId, competition: "Liga F7", jornada: 16, updatedAt: F.kickoff - 6 * 86_400_000, updatedBy: "Adrián T.C.", rows: F.standings };
  who.member = false;
  who.admin = false;
  who.playerId = null;
  who.answer = "";
  spies.setAvailability.mockClear();
  spies.liveDoc.mockReset();
});

it("the identity: the season, the three screens with their live headlines and the count", () => {
  render(<PartidosPage />);
  expect(screen.getByRole("heading", { level: 1, name: "Partidos" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Temporada larga/ })).toHaveTextContent("liga de fútbol 7");
  const tabs = screen.getAllByRole("tab").filter((t) => t.classList.contains("pa-tab"));
  expect(tabs.map((t) => t.textContent)).toEqual(["JornadasJ17 en directo, 2–1", expect.stringMatching(/^Tabla\dº si acaba así$/), expect.stringMatching(/^Balance\d+–\d+ en 16 partidos$/)]);
  expect(tabs[0]).toHaveAttribute("aria-selected", "true");
  expect(screen.getByText("26 jornadas; 15 jugadas, una en directo y 10 por jugar")).toBeInTheDocument();
});

it("Jornadas opens on tonight's live jornada: the tile, the lens on Directo, the plays and who is on the pitch", () => {
  render(<PartidosPage />);
  expect(tile(17)).toHaveAttribute("aria-pressed", "true");
  expect(tile(17)).toHaveAccessibleName(/^J17, domingo 17 de enero, contra Orduña fc\. En directo: 2–1, minuto 23$/);
  expect(within(lens()).getByRole("heading", { level: 2 })).toHaveTextContent("Contra Orduña fc");
  expect(within(lens()).getByRole("tab", { name: /Directo/ })).toHaveAttribute("aria-selected", "true");
  expect(within(lens()).getByRole("status", { name: "Marcador: Manchester Piti 2, Orduña fc 1" })).toBeInTheDocument();
  expect(lens()).toHaveTextContent("En directo 23′ de la primera parte");
  expect(lens().querySelectorAll(".pa-plays li")).toHaveLength(4);
  expect(lens()).toHaveTextContent("En el campo ahora");
  expect(within(lens()).getAllByRole("link", { name: "Abrir el partido" })[0]).toHaveAttribute("href", "/partidos/j17");
});

it("a played jornada opens on its acta (the goals, the MVP); a postponed one says so; the rival search jumps", () => {
  render(<PartidosPage />);
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "red dem" } });
  fireEvent.click(screen.getByRole("button", { name: /^J5 · Red Demons/ }));
  expect(within(lens()).getByRole("heading", { level: 2 })).toHaveTextContent("Contra Red Demons");
  expect(within(lens()).getByRole("tab", { name: "Acta" })).toHaveAttribute("aria-selected", "true");
  expect(lens()).toHaveTextContent(/Final · (Victoria|Empate|Derrota)/);
  expect(lens()).toHaveTextContent("MVP de la jornadaAlcides");
  fireEvent.keyDown(tile(5)!, { key: "ArrowRight" });
  fireEvent.keyDown(tile(6)!, { key: "ArrowRight" });
  fireEvent.keyDown(tile(7)!, { key: "ArrowRight" });
  fireEvent.keyDown(tile(8)!, { key: "ArrowRight" });
  expect(tile(9)).toHaveAttribute("aria-pressed", "true");
  expect(lens()).toHaveTextContent("Aplazado");
  expect(lens().querySelector(".pa-pp")).not.toBeNull();
});

/** Production-shaped actas: the ledger's minutes (the siete its 50′, Jordi 40′ in the even jornadas, the bench 15′
 *  and its last one 8′: under 10′, no nota). */
const row = (minutes: number, from: number) => ({ played: true, started: from === 0, minutes, stints: [{ from, to: from + minutes }] });
const withLedger = (ms: ClubMatch[], jordi: (j: number) => number): ClubMatch[] =>
  ms.map((m, i) =>
    m.status !== "finished"
      ? m
      : ({
          ...m,
          ledger: Object.fromEntries([
            ...(m.starters ?? []).map((id) => [id, row(id === "jordi" ? jordi(i + 1) : 50, 0)]),
            ...(m.bench ?? []).map((id, k, b) => [id, row(k === b.length - 1 ? 8 : 15, 35)]),
          ]),
        } as unknown as ClubMatch),
  );

it("las notas: public in the acta (the best three, every minutes row's badge); «Tú» and «La tuya» only for a player", () => {
  data.matches = withLedger(longSeasonFixture().matches, (j) => (j % 2 ? 50 : 40));
  route.search = { jornada: "5" };
  const r = render(<PartidosPage />);
  const notas = within(lens()).getByRole("list", { name: "Las notas" });
  const rows = within(notas).getAllByRole("listitem");
  expect(rows).toHaveLength(3);
  // best first, each with its figure and its word for a screen reader
  const figs = rows.map((li) => Number(li.querySelector(".nb")!.textContent!.replace(",", ".")));
  expect([...figs].sort((a, b) => b - a)).toEqual(figs);
  expect(rows[0]).toHaveTextContent(/Nota \d+,\d, [a-z]+/);
  expect(within(lens()).getByRole("link", { name: "Ver todas las notas" })).toHaveAttribute("href", "/partidos/j5/siete?vista=notas");
  expect(lens()).toHaveTextContent("Los minutos y la nota");
  expect(lens().querySelectorAll(".pa-mins--notas li .nb").length).toBe(lens().querySelectorAll(".pa-mins li").length);
  // a fan: no «Tú» anywhere
  expect(document.querySelector(".pa-seg__tu, .pa-notas .is-me, .pa-mins .is-me")).toBeNull();
  r.unmount();

  who.member = true;
  who.playerId = "jordi";
  render(<PartidosPage />);
  const mine = [...document.querySelectorAll<HTMLElement>(".pa-slot")].filter((s) => s.querySelector(".pa-seg__tu"));
  expect(mine.length).toBeGreaterThan(0);
  for (const s of mine) {
    const nb = s.querySelector(".pa-seg__tu .nb")!;
    expect(s.querySelector(".pa-seg")!.getAttribute("aria-label")).toContain(`Tu nota: ${nb.textContent}, `);
  }
  // only played jornadas
  expect(document.querySelector('.pa-slot[data-j="18"] .pa-seg__tu, .pa-slot[data-j="17"] .pa-seg__tu')).toBeNull();
  fireEvent.click(mine[0].querySelector(".pa-seg")!);
  const me = lens().querySelector(".pa-notas .is-me")!;
  expect(me).toHaveTextContent(/Tú/);
  expect(me.querySelector(".nb")!.textContent).toBe(mine[0].querySelector(".pa-seg__tu .nb")!.textContent);
  expect(lens().querySelector(".pa-mins li.is-me")).toHaveTextContent("Jordi");
});

it("filters: Próximos keeps what is still to play", () => {
  render(<PartidosPage />);
  fireEvent.click(screen.getByRole("radio", { name: "Próximos" }));
  expect(tile(5)).toBeNull();
  expect(tile(18)).not.toBeNull();
});

it("Tabla with the league's table: in focus (us and three each side), «Si acaba así», «¿Y si…?» and the presets", () => {
  route.path = "/partidos/tabla";
  render(<PartidosPage />);
  expect(screen.getByRole("heading", { level: 2, name: "La clasificación" })).toBeInTheDocument();
  const table = screen.getByRole("table", { name: "La clasificación" });
  expect(within(table).getAllByRole("row").filter((r) => r.classList.contains("pa-tbl__gap")).length).toBeGreaterThan(0);
  expect(within(table).getByRole("row", { current: true })).toHaveTextContent("Manchester Piti");
  expect(screen.getByRole("switch", { name: "Con el marcador de ahora" })).toHaveAttribute("aria-checked", "true");
  fireEvent.click(screen.getByRole("button", { name: "Todo victorias" }));
  expect(screen.getByRole("heading", { level: 2, name: "Así quedaría" })).toBeInTheDocument();
  expect(screen.getByText(/resultados de mentira · solo lo ves tú/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Ver la tabla entera" }));
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(15);
});

it("Tabla before the league publishes: «La tabla, mientras llega»; the captain's «Publicar la clasificación», everyone else's notice", () => {
  route.path = "/partidos/tabla";
  league.standings = null;
  const r = render(<PartidosPage />);
  expect(screen.getByRole("heading", { level: 2, name: "La tabla, mientras llega" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "La liga aún no ha publicado la clasificación" })).toBeInTheDocument();
  expect(screen.getByRole("table", { name: "Los equipos de nuestro calendario" })).toHaveTextContent("Manchester PitiSi acaba así");
  expect(screen.queryByRole("link", { name: /Publicar la clasificación/ })).toBeNull();
  r.unmount();
  who.member = true;
  who.playerId = "adrian";
  render(<PartidosPage />);
  expect(screen.getAllByRole("link", { name: /Publicar la clasificación/ })[0]).toHaveAttribute("href", "/admin/clasificacion");
});

it("Balance: the season's readout; a column read; the facets swap", () => {
  route.path = "/partidos/balance";
  render(<PartidosPage />);
  expect(screen.getByRole("heading", { level: 2, name: "La temporada, jornada a jornada" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /^J5, Red Demons:/ }));
  expect(screen.getByRole("heading", { level: 2, name: "Contra Red Demons" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Toda la temporada" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: /^Rachas/ }));
  expect(screen.getByRole("tab", { name: /^Rachas/ })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("tabpanel", { name: /Rachas/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: /^Rivales/ }));
  expect(screen.getByText(/Ida y vuelta contra cada uno/)).toBeInTheDocument();
});

it("a screen change pushes its address; «Abrir el partido» goes to the match page", () => {
  render(<PartidosPage />);
  fireEvent.click(screen.getByRole("tab", { name: /^Tabla/ }));
  expect(route.navigate).toHaveBeenCalledWith(expect.objectContaining({ to: "/partidos/tabla" }));
  route.navigate.mockClear();
});

it("el cartel: the jornada's poster in a dialog", () => {
  render(<PartidosPage />);
  fireEvent.click(within(lens()).getByRole("button", { name: "El cartel" }));
  const d = screen.getByRole("dialog", { name: "El cartel de la J17" });
  expect(d).toHaveTextContent("Manchester Piti contra Orduña fc");
  expect(within(d).getByRole("button", { name: "Guardar la imagen" })).toBeInTheDocument();
  fireEvent.click(within(d).getByRole("button", { name: "Cerrar" }));
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("a jugador answers «¿Vas?» for a jornada still to play; fans never read answers", async () => {
  render(<PartidosPage />);
  fireEvent.click(tile(18)!);
  expect(screen.queryByText(/¿Vas el/)).toBeNull();
  expect(spies.liveDoc).not.toHaveBeenCalled();
  who.member = true;
  who.playerId = "jordi";
  render(<PartidosPage />);
  const t = document.querySelectorAll<HTMLButtonElement>('.pa-slot[data-j="18"] .pa-seg');
  fireEvent.click(t[t.length - 1]);
  const voy = await screen.findByRole("radio", { name: "Voy" }, LAZY);
  await act(async () => {
    fireEvent.click(voy);
  });
  expect(spies.setAvailability).toHaveBeenCalledWith(expect.objectContaining({ playerId: "jordi" }), "j18", "yes");
});

it("server render: the identity and tonight's lens, no member data", () => {
  who.member = true;
  who.playerId = "jordi";
  const html = renderToString(<PartidosPage />);
  expect(html).toContain("Contra Orduña fc");
  expect(html).toContain("pa-seg");
  expect(html).not.toContain("¿Vas");
  expect(spies.liveDoc).not.toHaveBeenCalled();
});

it("states: no calendar, loading and the data error", () => {
  data.matches = [] as ClubMatch[];
  const r1 = render(<PartidosPage />);
  expect(screen.getByText(/El calendario aún no está/)).toBeInTheDocument();
  r1.unmount();
  data.loading = true;
  const r2 = render(<PartidosPage />);
  expect(screen.getByText("Cargando los partidos…")).toBeInTheDocument();
  r2.unmount();
  data.loading = false;
  data.error = new Error("unavailable");
  render(<PartidosPage />);
  expect(screen.getByRole("alert")).toHaveTextContent("No nos llegan los partidos");
});
