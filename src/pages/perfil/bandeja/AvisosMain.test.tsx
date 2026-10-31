import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Notice } from "../../../lib/derived/notices";
import type { Inbox, Pend, StackView } from "./useInbox";
import type { PendingItem } from "../tu/usePending";

// La bandeja (TuCarta «avisos»), production-shaped: J2 played and lost 3–8 with four notices, the season's fixture
// made 20 «Nuevo partido» notices (one stack each, from useInbox), one from the tablón; «Te toca»: the convocatoria
// and la caja open, the turno done. usePending, this device and the router are stubbed.
const state = vi.hoisted(() => ({
  pending: null as unknown,
  path: "/avisos",
  search: {} as Record<string, unknown>,
  navigate: vi.fn(async (_o: unknown) => undefined),
  mark: vi.fn(async (_ids: readonly string[], _v: boolean) => undefined),
  markAll: vi.fn(async () => undefined),
  pick: vi.fn(async (_a: string) => undefined),
  claim: vi.fn(async () => undefined),
}));
vi.mock("../../../firebase", () => ({ db: {}, functions: {}, auth: { currentUser: null }, FUNCTIONS_REGION: "europe-southwest1" }));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => state.navigate,
  useLocation: ({ select }: { select: (l: { pathname: string; search: Record<string, unknown> }) => unknown }) => select({ pathname: state.path, search: state.search }),
}));
vi.mock("../../../components/vidrio/tu/kit", () => ({ tuGo: (_d: unknown, fn: () => unknown) => void fn() }));
vi.mock("../tu/usePending", () => ({ usePending: () => state.pending }));
vi.mock("../../vestuario/writes", () => ({ useMe: () => ({ uid: "u1", name: "jordi", playerId: "p28" }) }));
vi.mock("../../../context/SeasonContext", () => ({ useSeason: () => ({ seasons: [] }) }));
vi.mock("../../../context/AuthContext", () => ({ useAuth: () => ({ user: null, profile: null }) }));
vi.mock("../../../lib/clubData", async (orig) => ({ ...(await orig<typeof import("../../../lib/clubData")>()), useClubData: () => ({ matches: [], players: [] }) }));
vi.mock("../../../components/jersey3d/usePageKitStills", () => ({ usePageKitStills: () => () => undefined }));
vi.mock("./device", () => ({
  useThisDevice: () => ({ kind: "listo", ready: true, words: { tone: "ok", chip: "Listo", title: "Este móvil recibe avisos", dev: "", steps: [], btn: "" }, blocked: "", choice: "todo", vibrate: false, pause: null, line: "Todo", setPreset: async () => undefined, setVibrate: async () => undefined, refresh: () => undefined }),
}));

const { AvisosMain } = await import("./AvisosMain");

const now = Date.UTC(2026, 9, 31, 11);
const DAY = 86_400_000;
const nt = (id: string, extra: Partial<Notice> = {}): Notice => ({ id, topic: "lineup", title: `Aviso ${id}`, body: "…", url: "/vestuario", at: now - 60_000, audience: "team", ...extra });
const j2 = [
  nt("notas", { topic: "personal", title: "Ya están las notas de la J2", url: "/partidos/m2", at: now - 5 * DAY }),
  nt("final", { topic: "final", title: "Final: Manchester Piti 3–8 Pitutis", url: "/partidos/m2", at: now - 6 * DAY }),
  nt("goal", { topic: "goals", title: "GOOOL · ALCIDES · 31′", url: "/partidos/m2", at: now - 6 * DAY - 3600_000 }),
  nt("siete", { topic: "lineup", title: "Ya está el siete de la J2", url: "/partidos/m2/siete", at: now - 7 * DAY }),
];
const fixture = Array.from({ length: 20 }, (_, i) => nt(`date-m${i + 3}`, { topic: "dates", title: `Nuevo partido: Rival ${i + 3}`, url: `/partidos/m${i + 3}`, at: now - 16 * DAY }));
const tablon = nt("tablon", { topic: "tablon", title: "Kevin, en el tablón", body: "¿Alguien tiene bomba?", url: "/vestuario/tablon", at: now - 12 * 60_000 });
const stack = (matchId: string, rows: Notice[], o: Partial<StackView> = {}): StackView => ({ matchId, j: null, rival: "Rival", ini: "RI", title: "Rival", res: "", gf: 0, ga: 0, when: "", sum: "", marks: [], dur: 50, alt: "", rows, ...o });
const list = [tablon, ...j2, ...fixture];

function inboxWith(o: Partial<Inbox> = {}): Inbox {
  return {
    viewer: { who: "jugador", captain: false },
    member: true,
    uid: "u1",
    now,
    loading: false,
    failed: false,
    list,
    reads: { seenAt: null, read: {}, unread: (n) => n.id === "notas" || n.id === "tablon" || n.id.startsWith("date-"), mark: state.mark, markAll: state.markAll },
    unread: 22,
    pends: [],
    openPend: 0,
    feed: list,
    stacks: [stack("m2", j2, { j: 2, rival: "Pitutis", res: "P", gf: 3, ga: 8, at: Date.UTC(2026, 9, 25, 13), home: false }), ...fixture.map((n, i) => stack(`m${i + 3}`, [n], { rival: `Rival ${i + 3}` }))],
    loose: [tablon],
    stackOf: () => undefined,
    next: null,
    topics: ["goals"],
    muted: [],
    matchName: () => "J2",
    ...o,
  };
}
const rsvp: Pend = { kind: "rsvp", key: "rsvp-m3", noticeIds: ["conv"], title: "¿Vas el domingo 8 a Red Demons?", body: "J3 · 18:00 · en casa · contestan 6 de 16", icon: "check", done: false, after: "", error: "", value: null, busy: false, pick: state.pick };
const turno: Pend = { kind: "turno", key: "turno-m3", noticeIds: [], title: "Te toca el agua", body: "Turnos de la J3.", icon: "wash", done: true, after: "Hecho: el vestuario ya lo sabe.", error: "", busy: false, mark: async () => undefined };
const caja: PendingItem = { kind: "caja", key: "caja", title: "Debes 12,50 €", body: "Bizum a Kevin o en mano el domingo.", owes: true, claimed: false, done: false, busy: false, error: "", claim: state.claim };
const say = vi.fn((_t: string, _undo?: () => void) => undefined);

beforeEach(() => {
  state.path = "/avisos";
  state.search = {};
  state.pending = { items: [rsvp, caja, turno], open: 2, inbox: inboxWith() };
  for (const f of [state.navigate, state.mark, state.markAll, state.pick, state.claim, say]) f.mockClear();
});

describe("la bandeja", () => {
  it("what waits on him first, the five filters with their counts", () => {
    render(<AvisosMain say={say} />);
    expect(screen.getByRole("heading", { level: 1, name: "2 cosas te tocan" })).toBeInTheDocument();
    expect(screen.getByText(/^22 sin leer · primero lo que te toca/)).toBeInTheDocument();
    const filt = screen.getByRole("group", { name: "Filtrar la bandeja" });
    expect(within(filt).getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual(["Te toca, 2", "Sin leer, 22", "Todos, 8", "Partidos, 4", "Del vestuario, 2"]);
    expect(within(filt).getByRole("button", { name: "Todos, 8" })).toHaveAttribute("aria-pressed", "true");
  });

  it("«Te toca» answered in place with Tú's own cards (TodoCards); what is done folds into a chip", async () => {
    render(<AvisosMain say={say} />);
    const toca = screen.getByRole("heading", { name: "Te toca · 2" }).closest("section") as HTMLElement;
    expect(within(toca).getByRole("heading", { name: "¿Vas el domingo 8 a Red Demons?" }).closest("li")).toHaveClass("tc-do", "tc-do--lead");
    fireEvent.click(within(toca).getByRole("button", { name: "Voy" }));
    expect(state.pick).toHaveBeenCalledWith("yes");
    // (answered: the notices it stands for turn read)
    await vi.waitFor(() => expect(state.mark).toHaveBeenCalledWith(["conv"], true));
    await vi.waitFor(() => expect(say).toHaveBeenCalledWith("Apuntado: vas. El capitán ya lo ve.", undefined));
    expect(within(toca).getByText("Solo lo ves tú")).toBeInTheDocument();
    fireEvent.click(within(toca).getByRole("button", { name: "Ya la he pagado" }));
    expect(state.claim).toHaveBeenCalled();
    const done = within(toca).getByRole("list", { name: "Lo que ya has hecho" });
    expect(done).toHaveTextContent("Turno hecho: el agua");
    // one list, like Tú's: never the board's two columns beside «Este móvil»
    expect(within(toca).getAllByRole("list")[0]).toHaveClass("tc-todo", "tc-todo--list");
  });

  it("each match one group, OUR score first, its newest three; the fixture as ONE item that opens", () => {
    render(<AvisosMain say={say} />);
    const g = screen.getByRole("heading", { name: "J2 · Pitutis" }).closest("section") as HTMLElement;
    expect(g).toHaveTextContent("Perdimos 3–8 · fuera · 25 oct");
    expect(within(g).getAllByRole("listitem")).toHaveLength(3);
    fireEvent.click(within(g).getByRole("button", { name: "Ver el otro aviso" }));
    expect(within(g).getAllByRole("listitem")).toHaveLength(4);
    // no stack per jornada: one «Calendario» item
    expect(screen.queryByRole("heading", { name: /Rival 3/ })).toBeNull();
    expect(screen.getAllByText("Calendario: 20 jornadas nuevas")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Ver las 20 jornadas" }));
    expect(screen.getByRole("list", { name: "Las 20 jornadas nuevas" }).querySelectorAll("li")).toHaveLength(20);
    expect(state.mark).toHaveBeenCalledWith(fixture.map((n) => n.id), true);
    expect(screen.getByRole("button", { name: "Recoger las 20" })).toHaveAttribute("aria-expanded", "true");
  });

  it("«Marcar todo como leído», with «Deshacer»", async () => {
    render(<AvisosMain say={say} />);
    fireEvent.click(screen.getByRole("button", { name: "Marcar todo como leído" }));
    expect(state.markAll).toHaveBeenCalled();
    await vi.waitFor(() => expect(say).toHaveBeenCalledWith("Todo leído. Te avisamos de lo nuevo.", expect.any(Function)));
    const undo = say.mock.calls[0][1] as () => void;
    undo();
    expect(state.mark).toHaveBeenCalledWith(["tablon", "notas", ...fixture.map((n) => n.id)], false);
  });

  it("«Este móvil» at the side: its state, the pause, the topics in Ajustes › Avisos", () => {
    render(<AvisosMain say={say} />);
    const side = screen.getByRole("complementary", { name: "Este móvil" });
    expect(within(side).getByText("Listo")).toBeInTheDocument();
    expect(within(side).getByRole("group", { name: "Pausar" })).toBeInTheDocument();
    fireEvent.click(within(side).getByRole("button", { name: "Tema a tema, en Ajustes › Avisos" }));
    expect(state.navigate).toHaveBeenCalledWith({ href: "/perfil/ajustes/avisos" });
  });

  it("«Sin leer» shows the unread ones, the fixture as one; «Partidos» only the matches", () => {
    state.search = { ver: "sin-leer" };
    const { unmount } = render(<AvisosMain say={say} />);
    const un = screen.getByRole("heading", { name: "Sin leer" }).closest("section") as HTMLElement;
    expect(within(un).getAllByRole("listitem").map((li) => li.querySelector("b")?.textContent)).toEqual(["Kevin, en el tablón", "Ya están las notas de la J2", "Calendario: 20 jornadas nuevas"]);
    unmount();
    state.search = { ver: "partidos" };
    render(<AvisosMain say={say} />);
    expect(screen.queryByText("Te toca · 2")).toBeNull();
    expect(screen.getByRole("heading", { name: "J2 · Pitutis" })).toBeInTheDocument();
    expect(screen.queryByText("Kevin, en el tablón")).toBeNull();
  });

  it("the states keep today's words", () => {
    state.pending = { items: [], open: 0, inbox: inboxWith({ list: [], feed: [], stacks: [], loose: [], unread: 0 }) };
    const { unmount } = render(<AvisosMain say={say} />);
    expect(screen.getByRole("heading", { level: 1, name: "Al día" })).toBeInTheDocument();
    expect(screen.getByText("Aquí verás los avisos del equipo.")).toBeInTheDocument();
    unmount();
    state.pending = { items: [], open: 0, inbox: inboxWith({ failed: true }) };
    render(<AvisosMain say={say} />);
    expect(screen.getByRole("alert")).toHaveTextContent("No se han podido cargar los avisos.");
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });

  it("a fan gets «A medida» only", () => {
    state.pending = { items: [], open: 0, inbox: inboxWith({ viewer: { who: "fan", captain: false }, member: false, list: [], feed: [], stacks: [], loose: [] }) };
    render(<AvisosMain say={say} />);
    expect(screen.getByText(/^Los avisos del vestuario son de los socios/)).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Filtrar la bandeja" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Tema a tema" })).toBeInTheDocument();
  });
});
