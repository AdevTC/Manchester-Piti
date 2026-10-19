import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readyClock, transitionClock, type MatchClock } from "../../../../functions/src/matchClock";
import { whistleDeadline, type MatchEvent } from "../../../../functions/src/matchEngine";
import type { ClubMatch } from "../../../lib/clubData";
import type { PlayerDoc } from "../../../lib/schemas";
import { _resetSnapshotMetaForTesting, metaKeyOf, recordSnapshotMeta } from "../../../lib/syncStatus";
import { liveDock } from "../liveDock";

const MIN = 60_000;
// 8 Nov 2026, 12:00 in Madrid
const DATE = Date.UTC(2026, 10, 8, 11);
const KICK = DATE + 10 * MIN;
const state: { matches: ClubMatch[]; players: PlayerDoc[]; now: number; path: string; member: boolean; playerId: string | null; myVote: string; loading: boolean; scorers: string[]; answers: { uid: string; response: "yes" | "no" | "maybe" }[] } = { matches: [], players: [], now: 0, path: "/", member: false, playerId: null, myVote: "", loading: false, scorers: [], answers: [] };
const writes: { matchId: string; response: string }[] = [];

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className, to, params, search, viewTransition }: { children?: ReactNode; className?: string; to: string; params?: { matchId: string }; search?: { tab?: string }; viewTransition?: boolean }) => (
    <a className={className} href={`${to.replace("$matchId", params?.matchId ?? "")}${search?.tab ? `?tab=${search.tab}` : ""}`} data-vt={viewTransition ? "1" : undefined}>
      {children}
    </a>
  ),
  useRouterState: () => state.path,
}));
vi.mock("../../../hooks/useClock", () => ({ useClock: () => state.now }));
vi.mock("../../../hooks/useServerTimeSync", () => ({ useServerTimeSync: () => undefined }));
vi.mock("../../../hooks/useViewer", () => ({ useViewer: () => ({ member: state.member, admin: false, playerId: state.member ? state.playerId : null }) }));
vi.mock("../../../context/AuthContext", () => ({ useAuth: () => ({ user: state.member ? { uid: "u1" } : null, loading: false }) }));
vi.mock("../../../context/TeamContext", () => ({ useTeam: () => ({ member: state.member, ready: true }) }));
vi.mock("../../../pages/vestuario/live", () => ({
  useMyMvpVote: (matchId: string | undefined) => ({ data: matchId ? state.myVote : "", loading: false, error: false }),
  useMatchScorers: (matchId: string | undefined) => ({ data: matchId ? state.scorers : [], loading: false, error: false }),
  useAvailability: (matchId: string | undefined) => ({ data: matchId ? state.answers : [], loading: false, error: false }),
  useMvpResults: () => new Map(),
}));
vi.mock("../../../pages/vestuario/writes", () => ({
  useMe: () => (state.member ? { uid: "u1", name: "Jordi", playerId: state.playerId } : null),
  setAvailability: (_me: unknown, matchId: string, response: string) => {
    writes.push({ matchId, response });
    return Promise.resolve();
  },
}));
vi.mock("../../../lib/clubData", async (orig) => ({ ...(await orig<typeof import("../../../lib/clubData")>()), useClubData: () => ({ matches: state.loading ? [] : state.matches, players: state.players, loading: state.loading }) }));

const { LiveScore } = await import("./LiveScore");
const { DROP_HOLD_MS } = await import("./liveModel");

const MATCHES = metaKeyOf(["matches"]);
const match: ClubMatch = { id: "j8", version: 2, status: "scheduled", rival: "MAD SKY", rivalInitials: "MSK", date: DATE, duration: 50, clock: readyClock(), starters: ["pepe", "jordi"] };
const started = transitionClock(readyClock(), "start", KICK);
const half = transitionClock(started, "halftime", KICK + 25 * MIN);
const second = transitionClock(half, "second", KICK + 35 * MIN);
const ended = transitionClock(second, "finish", KICK + 60 * MIN);
const PEPE = { id: "pepe", shirtName: "PEPE", firstName: "José", seasons: ["t1", "t2"], seasonDetails: { t2: { shirtName: "PEPITO" } } } as unknown as PlayerDoc;
const JORDI = { id: "jordi", shirtName: "JORDI", firstName: "Jordi", seasons: ["t2"] } as unknown as PlayerDoc;
// stamped by the live clock half-way through football minute `minute` (stored minute = whole minutes elapsed)
const goal = (id: string, minute: number, type: MatchEvent["type"] = "goal", playerId: string | undefined = "pepe"): MatchEvent => ({ id, type, minute: minute - 1, elapsedSeconds: (minute - 1) * 60 + 30, ...(playerId && type === "goal" ? { playerId } : {}) }) as MatchEvent;
const at = (clock: MatchClock, events: MatchEvent[] = [], extra: Partial<ClubMatch> = {}): ClubMatch => ({ ...match, seasonId: "t2", clock, events, ...extra });
const said = (c: HTMLElement) => c.querySelector('[role="status"]')?.textContent ?? null;
const drop = (name: RegExp | string) => screen.getByRole("button", { name });
const synced = (t = state.now) => recordSnapshotMeta(MATCHES, { fromCache: false, hasPendingWrites: false }, t);
const cached = (t = state.now) => recordSnapshotMeta(MATCHES, { fromCache: true, hasPendingWrites: false }, t);
/** matchMedia answering `on` queries (by substring). */
const media = (...on: string[]) =>
  Object.defineProperty(window, "matchMedia", { configurable: true, value: (q: string) => ({ matches: on.some((x) => q.includes(x)), media: q, addEventListener: () => undefined, removeEventListener: () => undefined }) });
let onLine: ReturnType<typeof vi.spyOn> | null = null;

beforeEach(() => {
  vi.useFakeTimers();
  Object.assign(state, { matches: [match], players: [PEPE, JORDI], path: "/plantilla", member: false, playerId: null, myVote: "", loading: false, scorers: [], answers: [] });
  writes.length = 0;
  localStorage.clear();
  _resetSnapshotMetaForTesting();
  synced(DATE);
});
afterEach(() => {
  onLine?.mockRestore();
  onLine = null;
  vi.useRealTimers();
  liveDock.reset();
  Reflect.deleteProperty(window, "matchMedia");
});

describe("the match day, on every page", () => {
  it("never in the server render", () => {
    state.now = DATE - 28 * MIN;
    expect(renderToString(<LiveScore />)).toBe("");
  });

  it("nothing before the morning of the match day; the kick-off from 08:00 (or once the seven is out); «Pendiente del pitido»; «Pendiente del acta» past the window; then nothing", () => {
    state.matches = [{ ...match, starters: [] }];
    state.now = DATE - 5 * 60 * MIN;
    const { container, rerender } = render(<LiveScore />);
    expect(container).toBeEmptyDOMElement();
    state.now = DATE - 3 * 60 * MIN;
    rerender(<LiveScore />);
    expect(drop("Contra MAD SKY a las 12:00, en 3 h")).toHaveTextContent("12:00");
    state.matches = [match];
    state.now = DATE - 28 * MIN;
    rerender(<LiveScore />);
    expect(drop("Contra MAD SKY a las 12:00, en 28 min")).toHaveTextContent("12:00");
    state.now = DATE + 5 * MIN;
    rerender(<LiveScore />);
    expect(drop("Contra MAD SKY, pendiente del pitido inicial")).toHaveTextContent("Pendiente del pitido");
    expect(liveDock.get().live).toBe(false);
    const deadline = whistleDeadline(match);
    state.now = deadline + MIN;
    rerender(<LiveScore />);
    expect(drop("Contra MAD SKY, pendiente del acta")).not.toHaveTextContent(/\d–\d/);
    state.now = deadline + 30 * MIN;
    rerender(<LiveScore />);
    expect(container).toBeEmptyDOMElement();
  });

  it("whistle → minute → half-time → second half → final: each change said once; the chrome's dot while it is played", () => {
    state.now = KICK - MIN;
    const { container, rerender } = render(<LiveScore />);
    state.matches = [at(started)];
    state.now = KICK + 3 * MIN;
    rerender(<LiveScore />);
    expect(drop("Manchester Piti 0, MAD SKY 0, minuto 4")).toHaveTextContent("4′");
    expect(said(container)).toBe("Empieza el partido contra MAD SKY.");
    expect(liveDock.get().live).toBe(true);

    state.matches = [at(half, [goal("g1", 12)])];
    state.now = KICK + 27 * MIN;
    rerender(<LiveScore />);
    expect(drop("Manchester Piti 1, MAD SKY 0, descanso")).toHaveTextContent("Descanso");
    expect(said(container)).toBe("Descanso. Piti 1, MAD SKY 0.");
    // the clock ticks during the break: nothing new is said
    state.now += 15_000;
    rerender(<LiveScore />);
    expect(said(container)).toBe("Descanso. Piti 1, MAD SKY 0.");

    state.matches = [at(second, [goal("g1", 12)])];
    state.now = KICK + 36 * MIN;
    rerender(<LiveScore />);
    expect(said(container)).toBe("Arranca la segunda parte. Piti 1, MAD SKY 0.");

    state.matches = [at(ended, [goal("g1", 12), goal("r1", 40, "opponent_goal")])];
    state.now = KICK + 61 * MIN;
    rerender(<LiveScore />);
    expect(drop("Manchester Piti 1, MAD SKY 1, final")).toBeInTheDocument();
    expect(said(container)).toBe("Final. Piti 1, MAD SKY 1. Acta pendiente.");
    expect(liveDock.get().live).toBe(false);
  });

  it("not on its own match page (it has landed there), and nothing said there", () => {
    state.matches = [at(started)];
    state.now = KICK + 3 * MIN;
    state.path = "/matches/j8";
    const { container } = render(<LiveScore />);
    expect(container).toBeEmptyDOMElement();
    expect(liveDock.get().live).toBe(true);
  });

  it("the matches load late: arriving at minute 30 is not «Empieza el partido»", () => {
    state.loading = true;
    state.matches = [at(started)];
    state.now = KICK + 30 * MIN;
    const { container, rerender } = render(<LiveScore />);
    state.loading = false;
    rerender(<LiveScore />);
    expect(drop(/minuto 31/)).toBeInTheDocument();
    expect(said(container)).toBe("");
  });
});

describe("the sheet", () => {
  it("a tap opens it: the last plays with «Ver todo», who is on the pitch, «Abrir el partido» landing on the match page", () => {
    const events = [goal("g1", 3), goal("g2", 8), goal("r1", 12, "opponent_goal"), goal("g3", 19)];
    state.matches = [at(started, events)];
    state.now = KICK + 22 * MIN;
    render(<LiveScore />);
    fireEvent.click(drop(/minuto 23/));
    const sheet = screen.getByRole("dialog", { name: "El partido contra MAD SKY" });
    expect(sheet).toHaveTextContent("En directo");
    expect(sheet).toHaveTextContent("Primera parte");
    expect(sheet.querySelectorAll(".vd-play")).toHaveLength(3);
    expect(sheet).toHaveTextContent("1 jugada más");
    expect(sheet).toHaveTextContent("En el campo: Pepito y Jordi.");
    const open = screen.getByRole("link", { name: "Abrir el partido" });
    expect(open).toHaveAttribute("href", "/matches/j8");
    expect(open).toHaveAttribute("data-vt", "1");
    expect(sheet.style.viewTransitionName).toBe("vd-live-marcador");
    // «Ver todo el partido» grows it into the whole match
    fireEvent.click(screen.getByRole("button", { name: "Ver todo el partido" }));
    expect(screen.getByRole("heading", { name: "Todo el partido" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    fireEvent.click(screen.getByRole("button", { name: "Goles" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    fireEvent.click(screen.getByRole("button", { name: "Tarjetas" }));
    expect(screen.getByText("Ninguna jugada de este tipo todavía.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByRole("heading", { name: "Todo el partido" })).toBeNull();
  });

  it("with reduced motion it doesn't fly: no View Transition into the match page", () => {
    media("reduce");
    state.matches = [at(started)];
    state.now = KICK + 3 * MIN;
    render(<LiveScore />);
    fireEvent.click(drop(/minuto 4/));
    expect(screen.getByRole("link", { name: "Abrir el partido" })).not.toHaveAttribute("data-vt");
  });

  it("Escape closes it", () => {
    state.matches = [at(started)];
    state.now = KICK + 3 * MIN;
    render(<LiveScore />);
    fireEvent.click(drop(/minuto 4/));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("«Ocultar hasta el próximo gol»: gone, and back by itself with the next goal", () => {
    state.matches = [at(started, [goal("g1", 3)])];
    state.now = KICK + 10 * MIN;
    const { rerender } = render(<LiveScore />);
    fireEvent.click(drop(/minuto 11/));
    fireEvent.click(screen.getByRole("button", { name: "Ocultar hasta el próximo gol" }));
    expect(screen.queryByRole("button", { name: /minuto/ })).toBeNull();
    state.now = KICK + 12 * MIN;
    rerender(<LiveScore />);
    expect(screen.queryByRole("button", { name: /minuto/ })).toBeNull();
    state.matches = [at(started, [goal("g1", 3), goal("r1", 12, "opponent_goal")])];
    rerender(<LiveScore />);
    expect(drop(/MAD SKY 1/)).toBeInTheDocument();
  });

  it("«Sacar el marcador» on desktop: the score in its own window (the in-page one without Document PiP)", async () => {
    media("min-width: 1100px");
    state.matches = [at(started, [goal("g1", 3)])];
    state.now = KICK + 10 * MIN;
    render(<LiveScore />);
    fireEvent.click(drop(/minuto 11/));
    // (the sheet's button; the float has its own on hover)
    fireEvent.click(within(screen.getByRole("dialog", { name: "El partido contra MAD SKY" })).getByRole("button", { name: "Sacar el marcador" }));
    await act(async () => {
      for (let i = 0; i < 3; i++) await Promise.resolve();
    });
    const win = screen.getByRole("dialog", { name: "Marcador en una ventana aparte" });
    expect(win).toHaveTextContent("1–0");
    // the board's window: the bold line and the last play
    expect(win).toHaveTextContent("En directo, 11′");
    expect(within(win).getByRole("button", { name: "Volver a la pestaña" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar la ventana" }));
    expect(screen.queryByRole("dialog", { name: "Marcador en una ventana aparte" })).toBeNull();
  });
});

describe("a member's day", () => {
  it("«Hoy anotas tú» with «Abrir la mesa»", () => {
    state.member = true;
    state.scorers = ["u1"];
    state.now = DATE - 4 * 60 * MIN;
    render(<LiveScore />);
    fireEvent.click(drop(/^Hoy anotas tú/));
    expect(screen.getByRole("link", { name: "Abrir la mesa" })).toHaveAttribute("href", "/matches/j8/mesa");
  });

  it("«¿Vas hoy?» only for a jugador who hasn't answered: Voy / Duda / No voy write it, said once, and it stays to show it", () => {
    state.member = true;
    state.answers = [{ uid: "u2", response: "yes" }];
    state.now = DATE - 4 * 60 * MIN;
    const { container, rerender } = render(<LiveScore />);
    // a socio without a player file: the match day's previa, no «¿Vas hoy?»
    expect(drop(/^Contra MAD SKY a las 12:00/)).toBeInTheDocument();
    state.playerId = "jordi";
    rerender(<LiveScore />);
    fireEvent.click(drop(/^¿Vas hoy\?/));
    // the answers so far and the deadline (kick-off)
    expect(screen.getByRole("dialog")).toHaveTextContent("Hasta las 12:00 · 1 viene · 0 en duda · 0 no pueden · 1 sin contestar.");
    fireEvent.click(screen.getByRole("button", { name: "Voy" }));
    expect(writes).toEqual([{ matchId: "j8", response: "yes" }]);
    expect(said(container)).toBe("Apuntado: vas.");
    state.answers = [{ uid: "u2", response: "yes" }, { uid: "u1", response: "yes" }];
    rerender(<LiveScore />);
    expect(screen.getByRole("button", { name: "Voy" })).toHaveAttribute("aria-pressed", "true");
  });

  it("«Vota al MVP»: «Votar al mejor» to the vestuario tab; closing it is remembered for that match", () => {
    state.member = true;
    state.matches = [at(ended, [], { status: "finished", goalsFor: 2, goalsAgainst: 1, voteClosesAt: KICK + 48 * 60 * MIN })];
    state.now = KICK + 60 * MIN + 31 * MIN;
    const { container, rerender } = render(<LiveScore />);
    fireEvent.click(drop(/vota al mejor del partido/));
    expect(screen.getByRole("link", { name: "Votar al mejor" })).toHaveAttribute("href", "/matches/j8?tab=vestuario");
    fireEvent.click(screen.getByRole("button", { name: "Ocultar el aviso de votar al MVP" }));
    expect(localStorage.getItem("mp:isle:vote-off")).toBe("j8");
    // the result stays for the rest of the match day: «Acta lista»
    expect(drop(/final, acta lista/)).toHaveTextContent("Acta lista");
    rerender(<LiveScore />);
    expect(screen.queryByRole("button", { name: /vota al mejor del partido/ })).toBeNull();
    // the next day, nothing
    state.now += 24 * 60 * MIN;
    rerender(<LiveScore />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("the plays", () => {
  const before = [goal("g1", 5)];

  it("a fresh goal of ours: the drop unfolds «¡Gol de Pepito!» (the name read as a name), the goal moment plays, said once; then the score again", () => {
    state.matches = [at(started, before)];
    state.now = KICK + 19 * MIN + 5_000;
    const { container, rerender } = render(<LiveScore />);
    expect(container.querySelector(".vd-goal")).toBeNull();
    state.matches = [at(started, [...before, goal("g2", 19)])];
    rerender(<LiveScore />);
    expect(container.querySelector(".vd-drop__event")).toHaveTextContent("¡Gol de Pepito!");
    expect(said(container)).toBe("Gol del Piti, de Pepito. Piti 2, MAD SKY 0");
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(container.querySelector(".vd-goal")).not.toBeNull();
    state.now += 15_000;
    rerender(<LiveScore />);
    expect(said(container)).toBe("Gol del Piti, de Pepito. Piti 2, MAD SKY 0");
    act(() => {
      vi.advanceTimersByTime(DROP_HOLD_MS);
    });
    expect(container.querySelector(".vd-drop__event")).toBeNull();
    expect(container.querySelector(".vd-goal")).toBeNull();
    // the thin gold rim stays until the next play
    expect(container.querySelector(".vd-drop.vd-rim-gold")).not.toBeNull();
  });

  it("goals already there on arrival, and a score only the cache vouches for, never unfold", () => {
    state.matches = [at(started, [...before, goal("g2", 19)])];
    state.now = KICK + 19 * MIN + 5_000;
    const { container, rerender } = render(<LiveScore />);
    expect(container.querySelector(".vd-drop__event")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(container.querySelector(".vd-goal")).toBeNull();
    act(() => cached());
    state.matches = [at(started, [...before, goal("g2", 19), goal("g3", 20)])];
    rerender(<LiveScore />);
    expect(drop(/Piti 3/)).toBeInTheDocument();
    expect(container.querySelector(".vd-drop__event")).toBeNull();
  });
});

describe("the connection", () => {
  it("offline during the match: «Sin actualizar» on the drop, said once", () => {
    state.matches = [at(started)];
    state.now = KICK + 5 * MIN;
    const { container } = render(<LiveScore />);
    act(() => {
      onLine = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
      window.dispatchEvent(new Event("offline"));
    });
    expect(drop(/sin conexión/)).toHaveTextContent(/sin actualizar/i);
    expect(said(container)).toBe("Sin conexión: reconectando.");
  });

  it("a live score unconfirmed for over a minute: «Marcador del N′, sin actualizar»", () => {
    state.matches = [at(started)];
    state.now = KICK + 20 * MIN;
    const { rerender } = render(<LiveScore />);
    act(() => synced(KICK + 2 * MIN));
    act(() => cached(KICK + 20 * MIN));
    state.now = KICK + 20 * MIN + 61_000;
    rerender(<LiveScore />);
    expect(drop(/sin conexión: marcador del 21′/)).toHaveTextContent("Marcador del 21′, sin actualizar");
  });
});
