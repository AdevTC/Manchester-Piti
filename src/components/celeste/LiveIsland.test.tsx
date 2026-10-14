import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readyClock, transitionClock, type MatchClock } from "../../../functions/src/matchClock";
import type { MatchEvent } from "../../../functions/src/matchEngine";
import type { ClubMatch } from "../../lib/clubData";
import type { PlayerDoc } from "../../lib/schemas";
import { _resetSnapshotMetaForTesting, metaKeyOf, recordSnapshotMeta } from "../../lib/syncStatus";

const MIN = 60_000;
const DATE = Date.UTC(2026, 10, 8, 11);
const KICK = DATE + 10 * MIN;
const state: { matches: ClubMatch[]; players: PlayerDoc[]; now: number; path: string; member: boolean; myVote: string } = { matches: [], players: [], now: 0, path: "/", member: false, myVote: "" };
const voteReads: (string | undefined)[] = [];

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className, params, search, ...rest }: { children?: ReactNode; className?: string; params?: { matchId: string }; search?: { tab?: string }; "aria-label"?: string }) => (
    <a className={className} href={`/matches/${params?.matchId}${search?.tab ? `?tab=${search.tab}` : ""}`} aria-label={rest["aria-label"]}>
      {children}
    </a>
  ),
  useRouterState: () => state.path,
}));
vi.mock("../../hooks/useClock", () => ({ useClock: () => state.now }));
vi.mock("../../hooks/useServerTimeSync", () => ({ useServerTimeSync: () => undefined }));
vi.mock("../../hooks/useViewer", () => ({ useViewer: () => ({ member: state.member, admin: false, playerId: null }) }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: state.member ? { uid: "u1" } : null }) }));
vi.mock("../../pages/vestuario/live", () => ({
  useMyMvpVote: (matchId: string | undefined) => {
    voteReads.push(matchId);
    return { data: matchId ? state.myVote : "", loading: false, error: false };
  },
}));
vi.mock("../../lib/clubData", async (orig) => ({ ...(await orig<typeof import("../../lib/clubData")>()), useClubData: () => ({ matches: state.matches, players: state.players }) }));

const { LiveIsland, GOAL_HOLD_MS } = await import("./LiveIsland");

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
const announced = (c: HTMLElement) => c.querySelector(".pt-isle-sr")?.textContent ?? null;
const synced = (t = state.now) => recordSnapshotMeta(MATCHES, { fromCache: false, hasPendingWrites: false }, t);
const cached = (t = state.now) => recordSnapshotMeta(MATCHES, { fromCache: true, hasPendingWrites: false }, t);
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
  voteReads.length = 0;
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
  it("no pill before the date, nor once the window for the whistle is over", () => {
    state.now = DATE - MIN;
    const { container, rerender } = render(<LiveIsland />);
    expect(container).toBeEmptyDOMElement();
    state.now = DATE + 50 * MIN + 2 * 60 * MIN;
    rerender(<LiveIsland />);
    expect(container).toBeEmptyDOMElement();
  });

  it("from the date until someone starts the clock: a quiet pill «Pendiente del pitido inicial» (not on its own page)", () => {
    state.now = DATE + 5 * MIN;
    const { container, rerender } = render(<LiveIsland />);
    expect(screen.getByRole("link", { name: /pendiente del pitido inicial/ })).toHaveTextContent("Pendiente del pitido inicial");
    expect(container.querySelector(".pt-dot")).toBeNull();
    // nothing is said on the first render: the page just opened
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
    expect(screen.getByRole("link")).toHaveTextContent("vs FU7");
    state.matches = [earlier, match];
    rerender(<LiveIsland />);
    expect(screen.getByRole("link")).toHaveTextContent("vs FU7");
  });

  it("pitido → minuto → descanso → 2ª parte → FINAL · acta pendiente for 30 min → gone (a fan); each change said once", () => {
    state.now = KICK - MIN;
    const { container, rerender } = render(<LiveIsland />);
    expect(screen.getByRole("link")).toHaveTextContent("Pendiente del pitido inicial");

    state.matches = [at(started)];
    state.now = KICK + 3 * MIN;
    rerender(<LiveIsland />);
    // 3:00 of play is football's 4′
    expect(screen.getByRole("button", { name: /En directo: Manchester Piti 0, MAD SKY 0, minuto 4/ })).toHaveTextContent("4′");
    expect(announced(container)).toBe("Empieza el partido contra MAD SKY.");

    state.matches = [at(half, [goal("g1", 12)])];
    state.now = KICK + 27 * MIN;
    rerender(<LiveIsland />);
    const pill = screen.getByRole("button", { name: /Descanso: Manchester Piti 1, MAD SKY 0/ });
    expect(pill).toHaveTextContent("Descanso");
    expect(pill).not.toHaveTextContent("′");
    expect(container.querySelector(".pt-dot")).toBeNull();
    expect(announced(container)).toBe("Descanso. Manchester Piti 1, MAD SKY 0.");
    // the clock ticks during the break: nothing new is said
    state.now += 15_000;
    rerender(<LiveIsland />);
    expect(announced(container)).toBe("Descanso. Manchester Piti 1, MAD SKY 0.");

    state.matches = [at(second, [goal("g1", 12)])];
    state.now = KICK + 36 * MIN;
    rerender(<LiveIsland />);
    expect(screen.getByRole("button", { name: /minuto 27/ })).toBeInTheDocument();
    expect(announced(container)).toBe("Arranca la segunda parte. Manchester Piti 1, MAD SKY 0.");

    state.matches = [at(ended, [goal("g1", 12), goal("r1", 40, "opponent_goal"), goal("g3", 48)])];
    state.now = KICK + 61 * MIN;
    rerender(<LiveIsland />);
    const fin = screen.getByRole("link", { name: /Final: Manchester Piti 2, MAD SKY 1, acta pendiente/ });
    expect(fin).toHaveTextContent(/FINAL 2–1\s*· acta pendiente/);
    expect(fin).toHaveAttribute("href", "/matches/j8");
    expect(announced(container)).toBe("Final. Manchester Piti 2, MAD SKY 1. Acta pendiente.");

    state.now = KICK + 60 * MIN + 30 * MIN - 1000;
    rerender(<LiveIsland />);
    expect(screen.getByRole("link")).toHaveTextContent("FINAL 2–1");
    state.now = KICK + 60 * MIN + 30 * MIN;
    rerender(<LiveIsland />);
    expect(container).toBeEmptyDOMElement();
  });

  it("the acta is published inside the half hour: «FINAL 2–1 · ya está el acta»", () => {
    state.matches = [at(ended, [], { status: "finished", goalsFor: 2, goalsAgainst: 1, voteClosesAt: KICK + 48 * 60 * MIN })];
    state.now = KICK + 70 * MIN;
    render(<LiveIsland />);
    expect(screen.getByRole("link")).toHaveTextContent(/FINAL 2–1\s*· ya está el acta/);
  });

  it("a match without a clock: «FINAL» from the server's liveEndedAt", () => {
    const legacy: ClubMatch = { id: "j3", rival: "LEGACY", rivalInitials: "LEG", date: DATE, duration: 50, liveEndedAt: DATE + 52 * MIN, events: [goal("g1", 30)] };
    state.matches = [legacy];
    state.now = DATE + 60 * MIN;
    const { container, rerender } = render(<LiveIsland />);
    expect(screen.getByRole("link")).toHaveTextContent(/FINAL 1–0\s*· acta pendiente/);
    state.now = DATE + 52 * MIN + 30 * MIN;
    rerender(<LiveIsland />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("«Vota al MVP»", () => {
  const voting = () => at(ended, [], { status: "finished", goalsFor: 2, goalsAgainst: 1, voteClosesAt: KICK + 48 * 60 * MIN });

  it("after the final half hour, a member who hasn't voted gets the link to the vestuario tab", () => {
    state.member = true;
    state.matches = [voting()];
    state.now = KICK + 60 * MIN + 31 * MIN;
    const { container } = render(<LiveIsland />);
    const link = screen.getByRole("link", { name: "Vota al MVP del partido contra MAD SKY" });
    expect(link).toHaveAttribute("href", "/matches/j8?tab=vestuario");
    expect(link).toHaveTextContent("Vota al MVP");
    expect(container.querySelector(".pt-isle.vote")).not.toBeNull();
  });

  it("the whistle with another match's vote open: «FINAL 2–0 · acta pendiente» for the match just finished, then that vote", () => {
    state.member = true;
    const other: ClubMatch = { ...match, id: "j7", rival: "RP", rivalInitials: "RP", date: DATE - 7 * 24 * 60 * MIN, clock: undefined, status: "finished", goalsFor: 3, goalsAgainst: 0, voteClosesAt: KICK + 24 * 60 * MIN };
    state.matches = [other, at(second, [goal("g1", 12), goal("g2", 40)])];
    state.now = KICK + 59 * MIN + 50_000;
    const { rerender } = render(<LiveIsland />);
    expect(screen.getByRole("button", { name: /En directo/ })).toBeInTheDocument();
    // the whistle arrives; the island's 15 s tick still reads a few seconds before it
    state.matches = [other, at(ended, [goal("g1", 12), goal("g2", 40)])];
    rerender(<LiveIsland />);
    expect(screen.getByRole("link")).toHaveTextContent(/FINAL 2–0\s*· acta pendiente/);
    state.now = KICK + 60 * MIN + 30 * MIN;
    rerender(<LiveIsland />);
    expect(screen.getByRole("link", { name: "Vota al MVP del partido contra RP" })).toHaveAttribute("href", "/matches/j7?tab=vestuario");
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
    fireEvent.click(screen.getByRole("button", { name: "Ocultar el aviso de votar al MVP" }));
    expect(container).toBeEmptyDOMElement();
    expect(localStorage.getItem("mp:isle:vote-off")).toBe("j8");
    rerender(<LiveIsland />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("the goal moment, on any page", () => {
  const before = [goal("g1", 5)];
  const live = (events: MatchEvent[]) => [at(started, events)];

  it("a fresh goal of ours: «¡GOL! PEPITO 19′ · 2–1» for ~4 s with a burst, said once; then the score again", () => {
    state.matches = live(before);
    state.now = KICK + 19 * MIN + 5_000;
    const { container, rerender } = render(<LiveIsland />);
    expect(screen.getByRole("button")).toHaveTextContent("1–0 MSK");

    state.matches = live([...before, goal("g2", 19)]);
    rerender(<LiveIsland />);
    const pill = screen.getByRole("button", { name: /¡GOL! PEPITO 19′ · 2–0/ });
    expect(pill).toHaveTextContent(/¡GOL!\s*PEPITO 19′ · 2–0/);
    expect(pill).toHaveClass("goal");
    expect(container.querySelector(".pt-isle-burst")).not.toBeNull();
    expect(announced(container)).toBe("¡Gol del Piti! PEPITO, minuto 19. Manchester Piti 2, MAD SKY 0.");

    // the clock ticks: the same goal is not said again
    state.now += 15_000;
    rerender(<LiveIsland />);
    expect(announced(container)).toBe("¡Gol del Piti! PEPITO, minuto 19. Manchester Piti 2, MAD SKY 0.");

    act(() => {
      vi.advanceTimersByTime(GOAL_HOLD_MS);
    });
    expect(screen.getByRole("button")).toHaveTextContent("2–0 MSK");
    expect(container.querySelector(".pt-isle-burst")).toBeNull();
  });

  it("a goal against: «Gol de MAD SKY · 1–1», calmer (no burst)", () => {
    state.matches = live(before);
    state.now = KICK + 22 * MIN;
    const { container, rerender } = render(<LiveIsland />);
    state.matches = live([...before, goal("r1", 21, "opponent_goal")]);
    rerender(<LiveIsland />);
    const pill = screen.getByRole("button", { name: /Gol de MAD SKY · 1–1/ });
    expect(pill).toHaveClass("goal", "them");
    expect(pill).not.toHaveTextContent("¡GOL!");
    expect(container.querySelector(".pt-isle-burst")).toBeNull();
    expect(announced(container)).toBe("Gol de MAD SKY. Manchester Piti 1, MAD SKY 1.");
  });

  it("goals already there when the island opens, and old goals arriving late, are just the score", () => {
    state.matches = live([...before, goal("g2", 19)]);
    state.now = KICK + 19 * MIN + 5_000;
    const { container, rerender } = render(<LiveIsland />);
    expect(screen.getByRole("button")).toHaveTextContent("2–0 MSK");
    expect(announced(container)).toBe("");
    state.now = KICK + 30 * MIN;
    state.matches = live([...before, goal("g2", 19), goal("g3", 22)]);
    rerender(<LiveIsland />);
    expect(screen.getByRole("button")).toHaveTextContent("3–0 MSK");
    expect(container.querySelector(".goal")).toBeNull();
    expect(announced(container)).toBe("");
  });

  it("a score only the cache vouches for never celebrates", () => {
    state.matches = live(before);
    state.now = KICK + 19 * MIN + 5_000;
    const { container, rerender } = render(<LiveIsland />);
    act(() => cached());
    state.matches = live([...before, goal("g2", 19)]);
    rerender(<LiveIsland />);
    expect(screen.getByRole("button")).toHaveTextContent("2–0 MSK");
    expect(container.querySelector(".goal")).toBeNull();
  });

  it("with reduced motion: the words, no burst", () => {
    Object.defineProperty(window, "matchMedia", { configurable: true, value: (q: string) => ({ matches: q.includes("reduce"), media: q }) });
    state.matches = live(before);
    state.now = KICK + 19 * MIN + 5_000;
    const { container, rerender } = render(<LiveIsland />);
    state.matches = live([...before, goal("g2", 19)]);
    rerender(<LiveIsland />);
    expect(screen.getByRole("button", { name: /¡GOL! PEPITO/ })).toBeInTheDocument();
    expect(container.querySelector(".pt-isle-burst")).toBeNull();
  });

  it("on /partidos (its board has the big ¡GOL!): the words change, no second burst nor announcement", () => {
    state.path = "/partidos";
    state.matches = live(before);
    state.now = KICK + 19 * MIN + 5_000;
    const { container, rerender } = render(<LiveIsland />);
    state.matches = live([...before, goal("g2", 19)]);
    rerender(<LiveIsland />);
    expect(screen.getByRole("button", { name: /¡GOL! PEPITO/ })).toBeInTheDocument();
    expect(container.querySelector(".pt-isle-burst")).toBeNull();
    expect(announced(container)).toBe("");
  });

  it("the last event names the scorer by the match's own season (nameFor with match.seasonId: his shirt name that season)", () => {
    state.matches = live([{ id: "g1", type: "goal", minute: 2, playerId: "pepe" } as MatchEvent]);
    state.now = KICK + 3 * MIN;
    render(<LiveIsland />);
    fireEvent.click(screen.getByRole("button", { name: /En directo/ }));
    expect(screen.getByRole("region", { name: /En directo/ })).toHaveTextContent("PEPITO");
    expect(screen.getByRole("region", { name: /En directo/ })).not.toHaveTextContent("PEPE ·");
  });
});

describe("the connection chip", () => {
  const chip = (c: HTMLElement) => c.querySelector(".mp-sync");
  const chipSaid = (c: HTMLElement) => c.querySelector(".mp-sync-sr")?.textContent ?? null;

  it("offline: «Reconectando…» under the pill, and the page makes room for it", () => {
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

  it("a live score unconfirmed for over a minute: «Sin conexión · marcador de hace N min», from when it lost sync; said once", () => {
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
    expect(container.querySelector(".pt-isle.stale")).not.toBeNull();
    const said = chipSaid(container);
    expect(said).toBe("Sin conexión: el marcador puede no estar al día.");
    state.now = KICK + 23 * MIN + 5_000;
    rerender(<LiveIsland />);
    expect(chip(container)).toHaveTextContent("Sin conexión · marcador de hace 3 min");
    expect(chipSaid(container)).toBe(said);
    act(() => synced(KICK + 23 * MIN + 5_000));
    expect(chip(container)).toBeNull();
    expect(container.querySelector(".pt-isle.stale")).toBeNull();
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
