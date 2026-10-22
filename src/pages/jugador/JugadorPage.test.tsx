import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClubMatch } from "../../lib/clubData";

// /jugadores/$id «Sus cambios»: whoever he came on or went off for leads to that player's page, in the
// season being looked at; someone no longer in the squad stays text. Router, data, season and the heavy
// pieces (charts, cromo, 3D stills) are stubbed: no Firebase, no WebGL.

// (the Link stub builds the href the router would: params into the path, the search as a query)
const hrefOf = (to = "#", params: Record<string, string> = {}, search: Record<string, string | undefined> = {}) => {
  const q = new URLSearchParams(Object.entries(search).filter((e): e is [string, string] => e[1] !== undefined)).toString();
  return to.replace(/\$(\w+)/g, (_, k: string) => params[k] ?? "") + (q ? `?${q}` : "");
};
// the player the URL names (erik unless a test says otherwise)
const url = vi.hoisted(() => ({ playerId: "erik" }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className, to, params, search }: { children?: ReactNode; className?: string; to?: string; params?: Record<string, string>; search?: Record<string, string | undefined> }) => (
    <a className={className} href={hrefOf(to, params, search)}>
      {children}
    </a>
  ),
  getRouteApi: () => ({ useParams: () => ({ playerId: url.playerId }) }),
  // (BackLink: a first load, index 0, so it falls back to the section)
  useRouter: () => ({ history: { go: () => {} } }),
  useRouterState: ({ select }: { select: (s: { location: { pathname: string; state: { __TSR_index?: number } } }) => unknown }) =>
    select({ location: { pathname: "/jugadores/erik", state: { __TSR_index: 0 } } }),
}));

type Row = NonNullable<ClubMatch["ledger"]>[string];
const row = (minutes: number, exchanges: Row["exchanges"], extra: Partial<Row> = {}): Row => ({ minutes, started: true, benched: false, notCalled: false, played: true, subIn: 0, subOut: 0, dismissed: false, stints: [], exchanges, goals: 0, assists: 0, yellowCards: 0, redCards: 0, doubleYellows: 0, penaltyCommitted: 0, penaltyReceived: 0, penaltySaved: 0, penaltyMissed: 0, goalPenalty: 0, goalFreekick: 0, ownGoals: 0, woodwork: 0, ...extra });
const data = vi.hoisted(() => ({ matches: [] as unknown[], players: [] as unknown[], error: null as Error | null }));
data.matches = [
  {
    id: "j1",
    seasonId: "t1",
    rival: "MAD SKY",
    date: Date.UTC(2026, 8, 6),
    duration: 50,
    status: "finished",
    goalsFor: 1,
    goalsAgainst: 0,
    events: [],
    ledger: {
      erik: row(30, [{ minute: 30, with: "pablo", direction: "out" }, { minute: 40, with: "ex", direction: "in" }]),
      pablo: row(20, [{ minute: 30, with: "erik", direction: "in" }], { started: false, subIn: 1 }),
    },
  },
];
data.players = [
  { id: "erik", shirtName: "ERIK", seasons: ["t1"], number: 7 },
  { id: "pablo", shirtName: "PABLO", seasons: ["t1"], seasonDetails: { t1: { shirtName: "PABLITO" } } },
];

vi.mock("../../lib/clubData", async (orig) => ({ ...(await orig<typeof import("../../lib/clubData")>()), useClubData: () => (data.error ? { matches: [], players: [], loading: false, error: data.error } : { matches: data.matches, players: data.players, loading: false, error: null }) }));
vi.mock("../../context/SeasonContext", () => ({ useSeason: () => ({ seasons: [{ id: "t1", name: "Temporada 1" }], selectedSeasonId: "t1", loadingSeasons: false }) }));
vi.mock("../../lib/useSetSeason", () => ({ ALL_SEASONS_LABEL: "Todo el historial", useSetSeason: () => vi.fn() }));
vi.mock("../vestuario/live", () => ({ useMvpResults: () => new Map() }));
vi.mock("../../hooks/useClock", () => ({ useClock: () => Date.UTC(2026, 8, 20) }));
vi.mock("../../hooks/useTheme", () => ({ useTheme: () => ({ theme: "dark" }) }));
vi.mock("../../components/jersey3d/useShirtStills", () => ({ useShirtStills: () => () => undefined }));
vi.mock("../../components/ThemeToggle", () => ({ ThemeToggle: () => null }));
vi.mock("../../components/NewBadge", () => ({ NewBadge: () => null }));
vi.mock("../../components/celeste/TechnicalStats", () => ({
  TechnicalStatsPanel: ({ initialPlayer, seasonId }: { initialPlayer?: string; seasonId?: string | null }) => <p data-testid="analisis">{`el juego en detalle de ${initialPlayer ?? ""} · ${seasonId ?? ""}`}</p>,
}));
vi.mock("../../components/celeste/Chrome", () => ({ CelesteBackdrop: () => null, CelesteDock: () => null, CelesteFooter: () => null, CelesteHeader: () => null }));
vi.mock("../stats/Charts", () => ({ Constellation: () => null, GoalClock: () => null, Radar: () => null }));
vi.mock("./Cromo", () => ({ Cromo: () => null }));
vi.mock("./SusPosiciones", () => ({ SusPosiciones: () => null }));
const who = vi.hoisted(() => ({ viewer: { member: false, admin: false, playerId: null as string | null } }));
vi.mock("../../hooks/useViewer", () => ({ useViewer: () => who.viewer }));

const { JugadorPage } = await import("./JugadorPage");

describe("his page's shortcuts, by who is looking", () => {
  const as = (v: Partial<typeof who.viewer>) => (who.viewer = { member: false, admin: false, playerId: null, ...v });
  const carta = () => screen.queryByRole("link", { name: /Editar tu carta/ });
  const ficha = () => screen.queryByRole("link", { name: /Editar ficha/ });

  it("a fan sees neither", () => {
    as({});
    render(<JugadorPage />);
    expect(carta()).toBeNull();
    expect(ficha()).toBeNull();
  });

  it("his own page (the member linked to him): «Editar tu carta» → /perfil; no admin ficha", () => {
    as({ member: true, playerId: "erik" });
    render(<JugadorPage />);
    expect(carta()).toHaveAttribute("href", "/perfil");
    expect(ficha()).toBeNull();
  });

  it("another member's page: nothing to edit", () => {
    as({ member: true, playerId: "pablo" });
    render(<JugadorPage />);
    expect(carta()).toBeNull();
    expect(ficha()).toBeNull();
  });

  it("an admin: «Editar ficha» → his drawer in the Sala de control", () => {
    as({ member: true, admin: true, playerId: "pablo" });
    render(<JugadorPage />);
    expect(ficha()).toHaveAttribute("href", "/admin/plantilla?jugador=erik");
    expect(carta()).toBeNull();
  });

  it("an admin on his own page: both, his carta and his ficha", () => {
    as({ member: true, admin: true, playerId: "erik" });
    render(<JugadorPage />);
    expect(carta()).toHaveAttribute("href", "/perfil");
    expect(ficha()).toHaveAttribute("href", "/admin/plantilla?jugador=erik");
  });
});

it("«Comparar con…» opens the cara a cara with him first, in the season, for anyone", () => {
  who.viewer = { member: false, admin: false, playerId: null };
  render(<JugadorPage />);
  expect(screen.getByRole("link", { name: /Comparar con…/ })).toHaveAttribute("href", "/plantilla/cara-a-cara?a=erik&season=t1");
});

it("«Sus cambios»: the teammate is a link to his page in the season; one no longer in the squad is text", () => {
  render(<JugadorPage />);
  const subs = screen.getByRole("heading", { name: "Sus cambios" }).closest("section") as HTMLElement;
  const out = within(subs).getByText(/^Salió por/).closest("li") as HTMLElement;
  expect(within(out).getByRole("link", { name: "PABLITO" })).toHaveAttribute("href", "/jugadores/pablo?season=t1");
  const back = within(subs).getByText(/^Entró por/).closest("li") as HTMLElement;
  expect(back).toHaveTextContent("Entró por un compañero");
  expect(within(back).queryByRole("link")).toBeNull();
});

describe("«Volver»", () => {
  it("on a first load (nothing of ours behind) it is «Plantilla», to the squad", () => {
    who.viewer = { member: false, admin: false, playerId: null };
    render(<JugadorPage />);
    expect(screen.getByRole("link", { name: "Plantilla" })).toHaveAttribute("href", "/plantilla");
  });
});

describe("«El juego en detalle»: after «Sus números», only with his narrated actions", () => {
  const first = () => data.matches[0] as ClubMatch;
  afterEach(() => {
    first().events = [];
  });
  const panel = () => screen.queryByTestId("analisis");

  it("no narrated action of his — none at all, or only a teammate's — no panel", () => {
    render(<JugadorPage />);
    expect(panel()).toBeNull();
    cleanup();
    first().events = [{ id: "a1", type: "pass", outcome: "complete", playerId: "pablo", minute: 5 }];
    render(<JugadorPage />);
    expect(panel()).toBeNull();
  });

  it("with one: below the fold — after the chips and «Sus números», before his radar — on him, in the season", () => {
    first().events = [{ id: "a1", type: "tackle", outcome: "won", playerId: "erik", minute: 5 }];
    render(<JugadorPage />);
    const shown = screen.getByTestId("analisis");
    expect(shown).toHaveTextContent("el juego en detalle de erik · t1");
    const follows = (a: Node, b: Node) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(follows(screen.getByRole("list", { name: "Su temporada en cinco números" }), shown)).toBe(true);
    expect(follows(screen.getByRole("heading", { name: "Sus números" }), shown)).toBe(true);
    expect(follows(shown, screen.getByRole("heading", { name: "Su radar" }))).toBe(true);
  });
});

describe("an error is not «no encontrado»", () => {
  afterEach(() => {
    data.error = null;
    url.playerId = "erik";
  });
  const robots = () => document.head.querySelector('meta[name="robots"]')?.getAttribute("content") ?? null;

  it("the data did not arrive: the club's error panel (h1) with «Reintentar», never «Jugador no encontrado»", () => {
    data.error = new Error("permission-denied");
    render(<JugadorPage />);
    const alert = screen.getByRole("alert");
    expect(within(alert).getByRole("heading", { level: 1, name: "El marcador no carga" })).toBeInTheDocument();
    expect(within(alert).getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
    expect(screen.queryByText(/no encontrado/i)).toBeNull();
    expect(robots()).not.toBe("noindex");
  });

  it("the data arrived and he is not in it: «Jugador no encontrado» (the 404 panel), not for the index", () => {
    url.playerId = "nadie";
    render(<JugadorPage />);
    const panel = screen.getByRole("region", { name: "Jugador no encontrado" });
    expect(panel).toHaveAttribute("data-kind", "notfound");
    expect(within(panel).getByRole("heading", { level: 1, name: "Jugador no encontrado" })).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: "Ver la plantilla" })).toHaveAttribute("href", "/plantilla");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(robots()).toBe("noindex");
  });

  it("his page is indexable", () => {
    render(<JugadorPage />);
    expect(robots()).not.toBe("noindex");
  });
});

describe("«Sus medallas»", () => {
  it("are his logros: the debut won, with the date and the rival linking to the match, and what comes next", () => {
    who.viewer = { member: false, admin: false, playerId: null };
    url.playerId = "erik";
    data.error = null;
    render(<JugadorPage />);
    const box = screen.getByRole("heading", { name: "Sus medallas" }).closest("section") as HTMLElement;
    const won = within(box).getByRole("list", { name: "Sus logros" });
    const debut = within(won).getByText("Debut").closest("li") as HTMLElement;
    expect(within(debut).getByRole("link", { name: "6 sept · vs MAD SKY" })).toHaveAttribute("href", "/partidos/j1");
    expect(within(box).getByRole("region", { name: "Lo próximo" })).toHaveTextContent(/\d+ \/ \d+/);
    expect(box.querySelector("details.lg-all")).not.toBeNull();
  });
});
