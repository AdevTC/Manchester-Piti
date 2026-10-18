import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readyClock, transitionClock, type MatchClock } from "../../../functions/src/matchClock";
import type { MatchEvent } from "../../../functions/src/matchEngine";
import type { ClubMatch } from "../../lib/clubData";
import type { PlayerDoc } from "../../lib/schemas";
import { _resetSnapshotMetaForTesting, metaKeyOf, recordSnapshotMeta } from "../../lib/syncStatus";
import { setIslaHero } from "./isla/heroSignal";

const MIN = 60_000;
// 8 Nov 2026, 12:00 in Madrid
const DATE = Date.UTC(2026, 10, 8, 11);
const KICK = DATE + 10 * MIN;
const state: { matches: ClubMatch[]; players: PlayerDoc[]; now: number; path: string; member: boolean; myVote: string; loading: boolean; voteLoading: boolean; teamReady: boolean; scorers: string[]; answers: { uid: string; response: "yes" | "no" | "maybe" }[] } = { matches: [], players: [], now: 0, path: "/", member: false, myVote: "", loading: false, voteLoading: false, teamReady: true, scorers: [], answers: [] };
const voteReads: (string | undefined)[] = [];
const writes: { matchId: string; response: string }[] = [];

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className, to, params, search, viewTransition }: { children?: ReactNode; className?: string; to: string; params?: { matchId: string }; search?: { tab?: string }; viewTransition?: boolean }) => (
    <a className={className} href={`${to.replace("$matchId", params?.matchId ?? "")}${search?.tab ? `?tab=${search.tab}` : ""}`} data-vt={viewTransition ? "1" : undefined}>
      {children}
    </a>
  ),
  useRouterState: () => state.path,
}));
vi.mock("../../hooks/useClock", () => ({ useClock: () => state.now }));
vi.mock("../../hooks/useServerTimeSync", () => ({ useServerTimeSync: () => undefined }));
vi.mock("../../hooks/useViewer", () => ({ useViewer: () => ({ member: state.member, admin: false, playerId: null }) }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: state.member ? { uid: "u1" } : null, loading: false }) }));
vi.mock("../../context/TeamContext", () => ({ useTeam: () => ({ member: state.member, ready: state.teamReady }) }));
vi.mock("../../pages/vestuario/live", () => ({
  useMyMvpVote: (matchId: string | undefined) => {
    voteReads.push(matchId);
    return { data: matchId && !state.voteLoading ? state.myVote : "", loading: !!matchId && state.voteLoading, error: false };
  },
  useMatchScorers: (matchId: string | undefined) => ({ data: matchId ? state.scorers : [], loading: false, error: false }),
  useAvailability: (matchId: string | undefined) => ({ data: matchId ? state.answers : [], loading: false, error: false }),
}));
vi.mock("../../pages/vestuario/writes", () => ({
  useMe: () => (state.member ? { uid: "u1", name: "Jordi", playerId: null } : null),
  setAvailability: (_me: unknown, matchId: string, response: string) => {
    writes.push({ matchId, response });
    return Promise.resolve();
  },
}));
vi.mock("../../lib/clubData", async (orig) => ({ ...(await orig<typeof import("../../lib/clubData")>()), useClubData: () => ({ matches: state.loading ? [] : state.matches, players: state.players, loading: state.loading }) }));

const { LiveIsland } = await import("./LiveIsland");
const { MOMENT_HOLD_MS } = await import("./isla/useMatchMoment");

const MATCHES = metaKeyOf(["matches"]);
const match: ClubMatch = { id: "j8", version: 2, status: "scheduled", rival: "MAD SKY", rivalInitials: "MSK", date: DATE, duration: 50, clock: readyClock() };
const started = transitionClock(readyClock(), "start", KICK);
const half = transitionClock(started, "halftime", KICK + 25 * MIN);
const second = transitionClock(half, "second", KICK + 35 * MIN);
const ended = transitionClock(second, "finish", KICK + 60 * MIN);
const PEPE = { id: "pepe", shirtName: "PEPE", firstName: "José", seasons: ["t1", "t2"], seasonDetails: { t2: { shirtName: "PEPITO" } } } as unknown as PlayerDoc;
// stamped by the live clock half-way through football minute `minute` (stored minute = whole minutes elapsed)
const goal = (id: string, minute: number, type: MatchEvent["type"] = "goal", playerId: string | undefined = "pepe"): MatchEvent => ({ id, type, minute: minute - 1, elapsedSeconds: (minute - 1) * 60 + 30, ...(playerId && type === "goal" ? { playerId } : {}) }) as MatchEvent;
const at = (clock: MatchClock, events: MatchEvent[] = [], extra: Partial<ClubMatch> = {}): ClubMatch => ({ ...match, seasonId: "t2", clock, events, ...extra });
const announced = (c: HTMLElement) => c.querySelector(".is-sr")?.textContent ?? null;
const bug = (name: RegExp | string = /segunda pantalla/) => screen.getByRole("button", { name });
const synced = (t = state.now) => recordSnapshotMeta(MATCHES, { fromCache: false, hasPendingWrites: false }, t);
const cached = (t = state.now) => recordSnapshotMeta(MATCHES, { fromCache: true, hasPendingWrites: false }, t);
/** matchMedia answering `on` queries (by substring). */
const media = (...on: string[]) =>
  Object.defineProperty(window, "matchMedia", { configurable: true, value: (q: string) => ({ matches: on.some((x) => q.includes(x)), media: q, addEventListener: () => undefined, removeEventListener: () => undefined }) });
let onLine: ReturnType<typeof vi.spyOn> | null = null;
const goOffline = () =>
  act(() => {
    onLine = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    window.dispatchEvent(new Event("offline"));
  });

beforeEach(() => {
  vi.useFakeTimers();
  state.matches = [match];
  state.players = [PEPE];
  state.path = "/";
  state.member = false;
  state.myVote = "";
  state.loading = false;
  state.voteLoading = false;
  state.teamReady = true;
  state.scorers = [];
  state.answers = [];
  voteReads.length = 0;
  writes.length = 0;
  localStorage.clear();
  _resetSnapshotMetaForTesting();
  synced(DATE);
});
afterEach(() => {
  onLine?.mockRestore();
  onLine = null;
  vi.useRealTimers();
  delete document.documentElement.dataset.isle;
  Reflect.deleteProperty(window, "matchMedia");
});

describe("the lifecycle", () => {
  it("nothing until two hours before kick-off; «Antes del partido» then; nothing once the window for the whistle is over", () => {
    state.now = DATE - 3 * 60 * MIN;
    const { container, rerender } = render(<LiveIsland />);
    expect(container).toBeEmptyDOMElement();
    state.now = DATE - 28 * MIN;
    rerender(<LiveIsland />);
    expect(bug()).toHaveAccessibleName("Manchester Piti contra MAD SKY, hoy a las 12:00, faltan 28 min. Abrir la segunda pantalla");
    expect(bug()).toHaveTextContent(/PITI\s*vs\s*MSK\s*12:00/);
    state.now = DATE + 50 * MIN + 2 * 60 * MIN;
    rerender(<LiveIsland />);
    expect(container).toBeEmptyDOMElement();
  });

  it("from the date until someone starts the clock: «Pendiente del pitido» (not on its own page); nothing said on arriving", () => {
    state.now = DATE + 5 * MIN;
    const { container, rerender } = render(<LiveIsland />);
    expect(bug(/pendiente del pitido inicial/)).toBeInTheDocument();
    expect(container.querySelector(".is-dot")).toBeNull();
    expect(container.querySelector(".is-r")).toHaveAttribute("data-estado", "pendiente");
    expect(announced(container)).toBe("");
    state.path = "/matches/j8";
    rerender(<LiveIsland />);
    expect(container).toBeEmptyDOMElement();
  });

  it("two matches waiting at once: the earliest by date, whatever their order in the list", () => {
    const earlier: ClubMatch = { ...match, id: "j7", rival: "FUSION 7", rivalInitials: "FU7", date: DATE - 30 * MIN };
    state.matches = [match, earlier];
    state.now = DATE + 5 * MIN;
    const { rerender } = render(<LiveIsland />);
    expect(bug()).toHaveTextContent("FU7");
    state.matches = [earlier, match];
    rerender(<LiveIsland />);
    expect(bug()).toHaveTextContent("FU7");
  });

  it("pitido → minuto → descanso → 2ª parte → final for 30 min → gone (a fan); each change said once", () => {
    state.now = KICK - MIN;
    const { container, rerender } = render(<LiveIsland />);

    state.matches = [at(started)];
    state.now = KICK + 3 * MIN;
    rerender(<LiveIsland />);
    // 3:00 of play is football's 4′
    expect(bug(/Manchester Piti 0, MAD SKY 0, en juego, 4′/)).toHaveTextContent("4′");
    expect(container.querySelector(".is-dot")).not.toBeNull();
    expect(announced(container)).toBe("Empieza el partido contra MAD SKY.");

    state.matches = [at(half, [goal("g1", 12)])];
    state.now = KICK + 27 * MIN;
    rerender(<LiveIsland />);
    expect(bug(/Manchester Piti 1, MAD SKY 0, descanso/)).toHaveTextContent("Descanso");
    expect(container.querySelector(".is-dot")).toBeNull();
    expect(announced(container)).toBe("Descanso. Piti 1, MAD SKY 0.");
    // the clock ticks during the break: nothing new is said
    state.now += 15_000;
    rerender(<LiveIsland />);
    expect(announced(container)).toBe("Descanso. Piti 1, MAD SKY 0.");

    state.matches = [at(second, [goal("g1", 12)])];
    state.now = KICK + 36 * MIN;
    rerender(<LiveIsland />);
    expect(bug(/en juego, 27′/)).toBeInTheDocument();
    expect(announced(container)).toBe("Arranca la segunda parte. Piti 1, MAD SKY 0.");

    state.matches = [at(ended, [goal("g1", 12), goal("r1", 40, "opponent_goal"), goal("g3", 48)])];
    state.now = KICK + 61 * MIN;
    rerender(<LiveIsland />);
    expect(bug(/Manchester Piti 2, MAD SKY 1, final\./)).toHaveTextContent("Final");
    expect(announced(container)).toBe("Final. Piti 2, MAD SKY 1. Acta pendiente.");
    fireEvent.click(bug());
    expect(screen.getByRole("dialog", { name: "Segunda pantalla" })).toHaveTextContent("Acta pendiente: la mesa la está repasando");
    expect(screen.getByRole("link", { name: /Ver el partido/ })).toHaveAttribute("href", "/matches/j8");

    state.now = KICK + 60 * MIN + 30 * MIN - 1000;
    rerender(<LiveIsland />);
    expect(bug()).toHaveTextContent("Final");
    state.now = KICK + 60 * MIN + 30 * MIN;
    rerender(<LiveIsland />);
    expect(container).toBeEmptyDOMElement();
  });

  it("the acta is published inside the half hour: «Ya está el acta» and «Ver el resumen»", () => {
    state.matches = [at(ended, [], { status: "finished", goalsFor: 2, goalsAgainst: 1, voteClosesAt: KICK + 48 * 60 * MIN })];
    state.now = KICK + 70 * MIN;
    render(<LiveIsland />);
    fireEvent.click(bug(/final, acta publicada/));
    expect(screen.getByRole("dialog")).toHaveTextContent("YA ESTÁ EL ACTA");
    expect(screen.getByRole("link", { name: "Ver el resumen" })).toHaveAttribute("href", "/matches/j8");
  });

  it("a match without a clock: «Final» from the server's liveEndedAt", () => {
    const legacy: ClubMatch = { id: "j3", rival: "LEGACY", rivalInitials: "LEG", date: DATE, duration: 50, liveEndedAt: DATE + 52 * MIN, events: [goal("g1", 30)] };
    state.matches = [legacy];
    state.now = DATE + 60 * MIN;
    const { container, rerender } = render(<LiveIsland />);
    expect(bug(/Manchester Piti 1, LEGACY 0, final/)).toBeInTheDocument();
    state.now = DATE + 52 * MIN + 30 * MIN;
    rerender(<LiveIsland />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("a member's island", () => {
  it("«Hoy anotas tú» from the morning, with «Abrir la mesa»", () => {
    state.member = true;
    state.scorers = ["u1"];
    state.answers = [{ uid: "u1", response: "yes" }];
    state.now = DATE - 4 * 60 * MIN;
    const { container } = render(<LiveIsland />);
    expect(container.querySelector(".is-r")).toHaveAttribute("data-estado", "anotador");
    expect(bug()).toHaveTextContent("HOY ANOTAS TÚ");
    fireEvent.click(bug());
    expect(screen.getByRole("link", { name: "Abrir la mesa" })).toHaveAttribute("href", "/matches/j8/mesa");
  });

  it("«¿Vas hoy?» while he hasn't answered: Voy / Duda / No voy write his answer, said once, and it stays to show it", () => {
    state.member = true;
    state.answers = [{ uid: "u2", response: "yes" }];
    state.now = DATE - 4 * 60 * MIN;
    const { container, rerender } = render(<LiveIsland />);
    expect(bug()).toHaveTextContent("¿VAS HOY, JORDI?");
    fireEvent.click(bug());
    expect(screen.getByRole("dialog")).toHaveTextContent("Vienen 1");
    fireEvent.click(screen.getByRole("button", { name: "Voy" }));
    expect(writes).toEqual([{ matchId: "j8", response: "yes" }]);
    expect(announced(container)).toBe("Apuntado: vas.");
    state.answers = [{ uid: "u2", response: "yes" }, { uid: "u1", response: "yes" }];
    rerender(<LiveIsland />);
    expect(screen.getByRole("button", { name: "Voy" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "No voy" })).toHaveAttribute("aria-pressed", "false");
  });

  it("answered already (from anywhere else): no «¿Vas hoy?»", () => {
    state.member = true;
    state.answers = [{ uid: "u1", response: "no" }];
    state.now = DATE - 4 * 60 * MIN;
    const { container } = render(<LiveIsland />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("«Vota al MVP»", () => {
  const voting = () => at(ended, [], { status: "finished", goalsFor: 2, goalsAgainst: 1, voteClosesAt: KICK + 48 * 60 * MIN });

  it("after the final half hour, a member who hasn't voted gets «Votar al mejor» to the vestuario tab", () => {
    state.member = true;
    state.matches = [voting()];
    state.now = KICK + 60 * MIN + 31 * MIN;
    const { container } = render(<LiveIsland />);
    expect(container.querySelector(".is-r")).toHaveAttribute("data-estado", "mvp");
    fireEvent.click(bug(/final, votación abierta/));
    expect(screen.getByRole("link", { name: "Votar al mejor" })).toHaveAttribute("href", "/matches/j8?tab=vestuario");
  });

  it("the whistle with another match's vote open: the match just finished first, then that vote", () => {
    state.member = true;
    const other: ClubMatch = { ...match, id: "j7", rival: "RP", rivalInitials: "RP", date: DATE - 7 * 24 * 60 * MIN, clock: undefined, status: "finished", goalsFor: 3, goalsAgainst: 0, voteClosesAt: KICK + 24 * 60 * MIN };
    state.matches = [other, at(second, [goal("g1", 12), goal("g2", 40)])];
    state.now = KICK + 59 * MIN + 50_000;
    const { container, rerender } = render(<LiveIsland />);
    expect(bug(/en juego/)).toBeInTheDocument();
    // the whistle arrives; the island's 15 s tick still reads a few seconds before it
    state.matches = [other, at(ended, [goal("g1", 12), goal("g2", 40)])];
    rerender(<LiveIsland />);
    expect(bug(/Manchester Piti 2, MAD SKY 0, final\./)).toBeInTheDocument();
    state.now = KICK + 60 * MIN + 30 * MIN;
    rerender(<LiveIsland />);
    expect(bug(/Manchester Piti 3, RP 0, final, votación abierta/)).toBeInTheDocument();
    expect(container.querySelector(".is-r")).toHaveAttribute("data-estado", "mvp");
  });

  it("not for a fan (and a fan's island never reads a vote), not once he has voted, not after the vote closes", () => {
    state.matches = [voting()];
    state.now = KICK + 60 * MIN + 31 * MIN;
    const { container, rerender } = render(<LiveIsland />);
    expect(container).toBeEmptyDOMElement();
    expect(voteReads.every((id) => id === undefined)).toBe(true);
    state.member = true;
    state.myVote = "pepe";
    rerender(<LiveIsland />);
    expect(container).toBeEmptyDOMElement();
    state.myVote = "";
    state.now = KICK + 48 * 60 * MIN;
    rerender(<LiveIsland />);
    expect(container).toBeEmptyDOMElement();
  });

  it("closing it hides it for that match (remembered), without blocking anything", () => {
    state.member = true;
    state.matches = [voting()];
    state.now = KICK + 60 * MIN + 31 * MIN;
    const { container, rerender } = render(<LiveIsland />);
    fireEvent.click(bug());
    fireEvent.click(screen.getByRole("button", { name: "Ocultar el aviso de votar al MVP" }));
    expect(container).toBeEmptyDOMElement();
    expect(localStorage.getItem("mp:isle:vote-off")).toBe("j8");
    rerender(<LiveIsland />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("the plays, on any page", () => {
  const before = [goal("g1", 5)];
  const live = (events: MatchEvent[]) => [at(started, events)];

  it("a fresh goal of ours: gold number, the rótulo «GOL · PEPITO» for ~9 s with the cortinilla, said once; then the clean bug", () => {
    state.matches = live(before);
    state.now = KICK + 19 * MIN + 5_000;
    const { container, rerender } = render(<LiveIsland />);
    expect(bug()).toHaveTextContent(/1\s*0/);
    expect(container.querySelector(".is-x")).toBeNull();

    state.matches = live([...before, goal("g2", 19)]);
    rerender(<LiveIsland />);
    expect(container.querySelector(".is-r")).toHaveAttribute("data-estado", "gol");
    expect(container.querySelector(".is-bug.gold")).not.toBeNull();
    expect(container.querySelector(".is-x.gold")).toHaveTextContent(/19′\s*GOL · PEPITO/);
    expect(container.querySelector(".is-wipe")).not.toBeNull();
    expect(announced(container)).toBe("Gol del Piti, de PEPITO. Piti 2, MAD SKY 0");

    // the clock ticks: the same goal is not said again
    state.now += 15_000;
    rerender(<LiveIsland />);
    expect(announced(container)).toBe("Gol del Piti, de PEPITO. Piti 2, MAD SKY 0");

    act(() => {
      vi.advanceTimersByTime(MOMENT_HOLD_MS);
    });
    expect(container.querySelector(".is-x")).toBeNull();
    expect(container.querySelector(".is-r")).toHaveAttribute("data-estado", "enjuego");
    expect(bug()).toHaveTextContent(/2\s*0/);
  });

  it("a goal against: coral, the number flips, no gold", () => {
    state.matches = live(before);
    state.now = KICK + 22 * MIN;
    const { container, rerender } = render(<LiveIsland />);
    state.matches = live([...before, goal("r1", 21, "opponent_goal")]);
    rerender(<LiveIsland />);
    expect(container.querySelector(".is-x.rv")).toHaveTextContent("GOL · MAD SKY");
    expect(container.querySelector(".is-bug.gold")).toBeNull();
    expect(container.querySelector(".is-n.flip")).not.toBeNull();
    expect(announced(container)).toBe("Gol de MAD SKY. Piti 1, MAD SKY 1");
  });

  it("a card unfolds without the cortinilla", () => {
    state.matches = live(before);
    state.now = KICK + 22 * MIN;
    const { container, rerender } = render(<LiveIsland />);
    state.matches = live([...before, { id: "y1", type: "yellow_card", minute: 21, elapsedSeconds: 21 * 60 + 10, playerId: "pepe" } as MatchEvent]);
    rerender(<LiveIsland />);
    expect(container.querySelector(".is-r")).toHaveAttribute("data-estado", "tarjeta");
    expect(container.querySelector(".is-x.y")).toHaveTextContent("AMARILLA · PEPITO");
    expect(container.querySelector(".is-wipe")).toBeNull();
    expect(announced(container)).toBe("Amarilla a PEPITO");
  });

  it("plays already there when the island opens, and old plays arriving late, are just the score", () => {
    state.matches = live([...before, goal("g2", 19)]);
    state.now = KICK + 19 * MIN + 5_000;
    const { container, rerender } = render(<LiveIsland />);
    expect(container.querySelector(".is-x")).toBeNull();
    expect(announced(container)).toBe("");
    state.now = KICK + 30 * MIN;
    state.matches = live([...before, goal("g2", 19), goal("g3", 22)]);
    rerender(<LiveIsland />);
    expect(bug()).toHaveTextContent(/3\s*0/);
    expect(container.querySelector(".is-x")).toBeNull();
    expect(announced(container)).toBe("");
  });

  it("a score only the cache vouches for never unfolds", () => {
    state.matches = live(before);
    state.now = KICK + 19 * MIN + 5_000;
    const { container, rerender } = render(<LiveIsland />);
    act(() => cached());
    state.matches = live([...before, goal("g2", 19)]);
    rerender(<LiveIsland />);
    expect(bug()).toHaveTextContent(/2\s*0/);
    expect(container.querySelector(".is-x")).toBeNull();
  });

  it("with reduced motion: the rótulo, no cortinilla, and the bug doesn't fly to the match page", () => {
    media("reduce");
    state.matches = live(before);
    state.now = KICK + 19 * MIN + 5_000;
    const { container, rerender } = render(<LiveIsland />);
    state.matches = live([...before, goal("g2", 19)]);
    rerender(<LiveIsland />);
    expect(container.querySelector(".is-x")).toHaveTextContent("GOL · PEPITO");
    expect(container.querySelector(".is-wipe")).toBeNull();
    expect(bug().style.viewTransitionName).toBe("");
  });

  it("on /partidos (its board has the big ¡GOL!) or under a page's hero: the words change, the play isn't said twice", () => {
    state.path = "/partidos";
    state.matches = live(before);
    state.now = KICK + 19 * MIN + 5_000;
    const { container, rerender } = render(<LiveIsland />);
    state.matches = live([...before, goal("g2", 19)]);
    rerender(<LiveIsland />);
    expect(container.querySelector(".is-x")).toHaveTextContent("GOL · PEPITO");
    expect(announced(container)).toBe("");
    state.path = "/";
    const hero = {};
    act(() => setIslaHero(hero, true));
    state.matches = live([...before, goal("g2", 19), goal("g3", 20)]);
    state.now = KICK + 20 * MIN;
    rerender(<LiveIsland />);
    expect(container.querySelector(".is-x")).toHaveTextContent("GOL · PEPITO");
    expect(announced(container)).toBe("");
    act(() => setIslaHero(hero, false));
  });

  it("at rest the segunda pantalla shows the last play, named by the match's own season", () => {
    state.matches = live([{ id: "g1", type: "goal", minute: 2, playerId: "pepe" } as MatchEvent]);
    state.now = KICK + 3 * MIN;
    render(<LiveIsland />);
    fireEvent.click(bug(/en juego/));
    expect(screen.getByRole("dialog")).toHaveTextContent("GOL · PEPITO");
    expect(screen.getByRole("dialog")).not.toHaveTextContent("PEPE ·");
  });

  it("«Ver el partido» is a View Transition: the bug carries the name its landing has on the match page", () => {
    state.matches = live(before);
    state.now = KICK + 6 * MIN;
    render(<LiveIsland />);
    expect(bug().style.viewTransitionName).toBe("isla-marcador");
    fireEvent.click(bug());
    expect(screen.getByRole("link", { name: /Ver el partido/ })).toHaveAttribute("data-vt", "1");
  });

  it("taken away, it leaves a sky tab that brings it back; the next goal brings it back by itself", () => {
    state.matches = live(before);
    state.now = KICK + 19 * MIN + 5_000;
    const { container, rerender } = render(<LiveIsland />);
    fireEvent.click(bug());
    fireEvent.click(screen.getByRole("button", { name: "Ocultar el marcador" }));
    expect(screen.queryByRole("button", { name: /segunda pantalla/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar el marcador" }));
    expect(bug()).toBeInTheDocument();
    fireEvent.click(bug());
    fireEvent.click(screen.getByRole("button", { name: "Ocultar el marcador" }));
    state.matches = live([...before, goal("g2", 19)]);
    rerender(<LiveIsland />);
    expect(container.querySelector(".is-x")).toHaveTextContent("GOL · PEPITO");
  });
});

describe("tablet and desktop", () => {
  it("tablet: a bar with the last play and «Abrir»; the panel opens", () => {
    media("700px");
    state.matches = [at(started, [goal("g1", 5)])];
    state.now = KICK + 6 * MIN;
    const { container } = render(<LiveIsland />);
    expect(container.querySelector(".is-tablet .is-tlast")).toHaveTextContent("GOL · PEPITO");
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(document.documentElement.dataset.isle).toBeUndefined();
  });

  it("desktop: the bug at rest, «normal» for a play; the corner button moves it and the size is pinned, both remembered", () => {
    media("700px", "1100px");
    state.matches = [at(started, [goal("g1", 5)])];
    state.now = KICK + 19 * MIN + 5_000;
    const { container, rerender } = render(<LiveIsland />);
    const pip = () => container.querySelector(".is-pip");
    expect(pip()).toHaveClass("c-br", "s-bug");
    expect(container.querySelector(".is-pbody")).toBeNull();
    state.matches = [at(started, [goal("g1", 5), goal("g2", 19)])];
    rerender(<LiveIsland />);
    expect(pip()).toHaveClass("s-normal");
    expect(container.querySelector(".is-pbody")).toHaveTextContent("GOL · PEPITO");
    fireEvent.click(screen.getByRole("button", { name: "Llevar a la siguiente esquina" }));
    expect(pip()).toHaveClass("c-bl");
    fireEvent.click(screen.getByRole("button", { name: "Fijar en normal" }));
    fireEvent.click(screen.getByRole("button", { name: "Fijar en grande" }));
    expect(pip()).toHaveClass("s-grande");
    expect(container.querySelector(".is-still")).not.toBeNull();
    expect(JSON.parse(localStorage.getItem("mp:isla:pip") ?? "{}")).toEqual({ corner: "bl", size: "grande" });
    fireEvent.click(screen.getByRole("button", { name: "Quitar el marcador" }));
    expect(screen.getByRole("button", { name: "Mostrar el marcador" })).toHaveClass("c-bl");
  });
});

describe("the connection chip", () => {
  const chip = (c: HTMLElement) => c.querySelector(".mp-sync");
  const chipSaid = (c: HTMLElement) => c.querySelector(".mp-sync-sr")?.textContent ?? null;

  it("offline: «Reconectando…» under the bug, and the page makes room for it", () => {
    state.matches = [at(started)];
    state.now = KICK + 5 * MIN;
    const { container } = render(<LiveIsland />);
    expect(chip(container)).toBeNull();
    expect(document.documentElement.dataset.isle).toBe("");
    goOffline();
    expect(chip(container)).toHaveTextContent("Reconectando…");
    expect(chipSaid(container)).toBe("Sin conexión: reconectando.");
    expect(document.documentElement.dataset.isle).toBe("sync");
  });

  it("a live score unconfirmed for over a minute: «Sin conexión», the bug struck, from when it lost sync; said once", () => {
    state.matches = [at(started)];
    state.now = KICK + 20 * MIN;
    const { container, rerender } = render(<LiveIsland />);
    act(() => synced(KICK + 2 * MIN)); // the last change came long ago: the score was still current until the drop
    act(() => cached(KICK + 20 * MIN));
    state.now = KICK + 20 * MIN + 60_000;
    rerender(<LiveIsland />);
    expect(chip(container)).toBeNull(); // a minute of grace
    state.now = KICK + 20 * MIN + 61_000;
    rerender(<LiveIsland />);
    expect(chip(container)).toHaveTextContent("Sin conexión · marcador de hace 1 min");
    expect(container.querySelector(".is-bug.off")).not.toBeNull();
    expect(container.querySelector(".is-r")).toHaveAttribute("data-estado", "sinconexion");
    const said = chipSaid(container);
    expect(said).toBe("Sin conexión: el marcador puede no estar al día.");
    state.now = KICK + 23 * MIN + 5_000;
    rerender(<LiveIsland />);
    expect(chip(container)).toHaveTextContent("Sin conexión · marcador de hace 3 min");
    expect(chipSaid(container)).toBe(said);
    act(() => synced(KICK + 23 * MIN + 5_000));
    expect(chip(container)).toBeNull();
    expect(container.querySelector(".is-bug.off")).toBeNull();
  });

  it("no «hace N min» when no match is being played", () => {
    state.now = DATE + 5 * MIN; // pending whistle
    const { container, rerender } = render(<LiveIsland />);
    act(() => cached(DATE));
    state.now = DATE + 9 * MIN;
    rerender(<LiveIsland />);
    expect(chip(container)).toBeNull();
  });
});

describe("only real changes are said (never data arriving late)", () => {
  it("the matches load after the island mounted: the live match at minute 30 is not «Empieza el partido»; the next real change is said", () => {
    state.loading = true;
    state.matches = [at(started)];
    state.now = KICK + 30 * MIN;
    const { container, rerender } = render(<LiveIsland />);
    expect(container).toBeEmptyDOMElement();
    state.loading = false;
    rerender(<LiveIsland />);
    expect(bug(/en juego/)).toBeInTheDocument();
    expect(announced(container)).toBe("");
    state.matches = [at(transitionClock(started, "halftime", KICK + 30 * MIN))];
    rerender(<LiveIsland />);
    expect(announced(container)).toBe("Descanso. Piti 0, MAD SKY 0.");
  });

  it("only the cache's word so far (no server snapshot yet): the final on opening the app is not said", () => {
    _resetSnapshotMetaForTesting();
    act(() => cached(KICK));
    state.matches = [at(second)];
    state.now = KICK + 59 * MIN;
    const { container, rerender } = render(<LiveIsland />);
    state.matches = [at(ended)];
    state.now = KICK + 61 * MIN;
    rerender(<LiveIsland />);
    act(() => synced(KICK + 61 * MIN));
    expect(bug(/final/)).toBeInTheDocument();
    expect(announced(container)).toBe("");
  });

  it("a member's vote and the team check resolving late: «Vota al MVP» shows, unsaid", () => {
    state.member = true;
    state.teamReady = false;
    state.voteLoading = true;
    state.matches = [at(ended, [], { status: "finished", goalsFor: 2, goalsAgainst: 1, voteClosesAt: KICK + 48 * 60 * MIN })];
    state.now = KICK + 60 * MIN + 31 * MIN;
    const { container, rerender } = render(<LiveIsland />);
    expect(container).toBeEmptyDOMElement();
    state.teamReady = true;
    rerender(<LiveIsland />);
    state.voteLoading = false;
    rerender(<LiveIsland />);
    expect(bug(/votación abierta/)).toBeInTheDocument();
    expect(announced(container)).toBe("");
  });

  it("a state change and a fresh goal in the same render: both said, the state first", () => {
    state.matches = [at(half, [goal("g1", 12)])];
    state.now = KICK + 34 * MIN;
    const { container, rerender } = render(<LiveIsland />);
    // the second half starts and a goal lands right away, in one snapshot
    state.matches = [at(second, [goal("g1", 12), goal("g2", 26)])];
    state.now = KICK + 35 * MIN + 40_000;
    rerender(<LiveIsland />);
    expect(announced(container)).toBe("Arranca la segunda parte. Piti 2, MAD SKY 0. Gol del Piti, de PEPITO. Piti 2, MAD SKY 0");
  });

  it("two matches live at once: the earliest kick-off, whatever the list's order", () => {
    const early: ClubMatch = { ...at(started), id: "j7", rival: "FUSION 7", rivalInitials: "FU7", date: DATE - 5 * MIN };
    state.matches = [at(started), early];
    state.now = KICK + 5 * MIN;
    const { rerender } = render(<LiveIsland />);
    expect(bug()).toHaveTextContent("FU7");
    state.matches = [early, at(started)];
    rerender(<LiveIsland />);
    expect(bug()).toHaveTextContent("FU7");
  });
});
