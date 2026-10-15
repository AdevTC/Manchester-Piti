import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readyClock, transitionClock } from "../../../functions/src/matchClock";
import type { ClubMatch } from "../../lib/clubData";
import type { PlayerDoc } from "../../lib/schemas";

// «Hoy», the card itself in each phase: the shared pieces are real (the switch, the ballot, the countdown,
// the scoreboard's bits); the members-only reads, the writes, the router and the weather are stubbed — no
// Firebase, no network.
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className, to, params, search }: { children?: ReactNode; className?: string; to: string; params?: { matchId?: string }; search?: { tab?: string } }) => (
    <a className={className} href={to.replace("$matchId", params?.matchId ?? "") + (search?.tab ? `?tab=${search.tab}` : "")}>
      {children}
    </a>
  ),
}));
const state = vi.hoisted(() => ({
  viewer: { member: true, admin: false, playerId: "adri" as string | null },
  board: null as { seven: string[]; codes: Record<string, string> } | null,
  note: "",
  availability: [] as { uid: string; response: "yes" | "no" | "maybe"; name: string; playerId: string | null; absenceId?: string }[],
  absences: [] as { id: string; uid: string; playerId: string | null; name: string; from: string; to: string; note: string; createdAt: number }[],
  prediction: null as { goalsFor: number; goalsAgainst: number } | null,
  mvp: new Map<string, { id: string; counts: Record<string, number>; total: number }>(),
  reads: [] as string[],
  writes: { setAvailability: vi.fn(async () => undefined), voteMvp: vi.fn(async () => undefined) },
}));
vi.mock("../../hooks/useViewer", () => ({ useViewer: () => state.viewer }));
vi.mock("../../pages/vestuario/live", () => {
  const live = <T,>(data: T) => ({ data, loading: false, error: false });
  return {
    useAvailability: (id?: string) => (id && state.reads.push(`availability/${id}`), live(id ? state.availability : [])),
    useMeetingNote: (id?: string) => (id && state.reads.push(`matchPrivate/${id}`), live(id ? state.note : "")),
    useMvpResults: () => state.mvp,
    useMyPrediction: (id?: string, uid?: string) => (id && uid && state.reads.push(`predictions/${id}/${uid}`), live(id && uid ? state.prediction : null)),
    useMyMvpVote: () => live(""),
    useAbsences: (today: string, enabled?: boolean) => (enabled && state.reads.push(`absences/${today}`), live(enabled ? state.absences : [])),
  };
});
vi.mock("../../pages/vestuario/writes", () => ({ useMe: () => ({ uid: "u1", name: "ADRI", playerId: "adri" }), ...state.writes }));
vi.mock("../../pages/pizarra/useMatchBoard", () => ({
  useMatchBoard: (_s: unknown, matchId: string | undefined, _u: boolean, enabled: boolean) => (enabled && matchId && state.reads.push(`board/${matchId}`), enabled && state.board ? "b1" : null),
  useBoardView: (id: string | null) => (id ? state.board : null),
}));
vi.mock("../../lib/weather", () => ({ useMatchWeather: () => null }));
vi.mock("../../lib/clubApi", () => ({ apiError: () => "" }));

const { HoyCard } = await import("./HoyCard");

const MIN = 60_000;
const HOUR = 60 * MIN;
const DATE = Date.UTC(2026, 10, 8, 11); // 12:00 Madrid
const base: ClubMatch = { id: "j8", seasonId: "t1", version: 2, status: "scheduled", rival: "MAD SKY", date: DATE, duration: 50, venue: "Campo X", kit: "away", clock: readyClock(), starters: ["adri", "b"], bench: ["c"] };
const players = [
  { id: "adri", shirtName: "ADRI", positions: { main: "MC", also: [] } },
  { id: "b", shirtName: "BRUNO" },
  { id: "c", shirtName: "CARLOS" },
] as unknown as PlayerDoc[];
const started = transitionClock(readyClock(), "start", DATE + 2 * MIN);
const ended = transitionClock(transitionClock(transitionClock(started, "halftime", DATE + 27 * MIN), "second", DATE + 32 * MIN), "finish", DATE + 58 * MIN);
const card = (m: ClubMatch, now: number) => <HoyCard matches={[m]} players={players} now={now} rsvpId="vx-rsvp" />;

beforeEach(() => {
  state.viewer = { member: true, admin: false, playerId: "adri" };
  state.board = null;
  state.note = "";
  state.availability = [];
  state.absences = [];
  state.prediction = null;
  state.mvp = new Map();
  state.reads = [];
});

describe("HoyCard", () => {
  it("before kick-off: «Sales de titular» with the official board's code, the switch, the quedada, the kit, the siete and the way there", () => {
    state.board = { seven: ["adri", "b"], codes: { adri: "DFC" } };
    state.note = "Quedamos 11:15 en la puerta";
    state.availability = [{ uid: "u1", response: "yes", name: "ADRI", playerId: "adri" }];
    render(card(base, DATE - 2 * HOUR));
    const hoy = screen.getByRole("region", { name: /Manchester Piti vs MAD SKY/ });
    expect(within(hoy).getByText("Sales de titular · DFC")).toBeInTheDocument();
    expect(within(hoy).getByRole("timer")).toBeInTheDocument();
    const group = within(hoy).getByRole("radiogroup", { name: "Tu respuesta a la convocatoria" });
    expect(group).toHaveAttribute("id", "vx-rsvp");
    expect(within(hoy).getByRole("radio", { name: "Voy" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(within(hoy).getByRole("radio", { name: "No puedo" }));
    expect(state.writes.setAvailability).toHaveBeenCalledWith({ uid: "u1", name: "ADRI", playerId: "adri" }, "j8", "no");
    expect(within(hoy).getByText("Quedamos 11:15 en la puerta")).toBeInTheDocument();
    expect(within(hoy).getByText("2ª equipación")).toBeInTheDocument();
    expect(within(hoy).getByText("Siete oficial de la pizarra")).toBeInTheDocument();
    expect(within(hoy).getByText("· tú")).toBeInTheDocument();
    expect(within(hoy).getByRole("link", { name: /Ver la previa/ })).toHaveAttribute("href", "/matches/j8");
    expect(within(hoy).getByRole("link", { name: /Cómo llegar/ })).toHaveAttribute("href", expect.stringContaining("Campo%20X"));
  });

  it("no official board: the convocatoria's titulares and the preferred position", () => {
    render(card(base, DATE - 2 * HOUR));
    expect(screen.getByText("Titulares de la convocatoria")).toBeInTheDocument();
    expect(screen.getByText("Sales de titular · MC")).toBeInTheDocument();
  });

  it("pending whistle: the wait in words, the convocatoria closed (no switch)", () => {
    render(card(base, DATE + 5 * MIN));
    expect(screen.getByRole("status")).toHaveTextContent("Pendiente del pitido inicial");
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.queryByRole("timer")).toBeNull();
  });

  it("live: the score, the last event and the way to the match; no member reads of the previa", () => {
    const live: ClubMatch = { ...base, clock: started, events: [{ id: "g1", type: "goal", minute: 9, elapsedSeconds: 570, playerId: "b" }] as ClubMatch["events"] };
    render(card(live, DATE + 15 * MIN));
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Manchester Piti 1, MAD SKY 0");
    expect(screen.getByText(/BRUNO · Gol/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Seguir el partido/ })).toHaveAttribute("href", "/matches/j8");
    expect(state.reads.filter((r) => r.startsWith("matchPrivate") || r.startsWith("board") || r.startsWith("availability"))).toEqual([]);
  });

  it("after, the acta out with the vote open: the result, my porra's points and the ballot", () => {
    const done: ClubMatch = {
      ...base,
      clock: ended,
      status: "finished",
      goalsFor: 2,
      goalsAgainst: 1,
      voteClosesAt: DATE + 48 * HOUR,
      ledger: { adri: { played: true }, b: { played: true } } as unknown as ClubMatch["ledger"],
    };
    state.prediction = { goalsFor: 2, goalsAgainst: 1 };
    render(card(done, DATE + 3 * HOUR));
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Manchester Piti 2, MAD SKY 1");
    expect(screen.getByText(/Tu porra: 2–1/)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Tu voto" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "BRUNO" }));
    fireEvent.click(screen.getByRole("button", { name: "Votar al MVP" }));
    expect(state.writes.voteMvp).toHaveBeenCalledWith({ uid: "u1", name: "ADRI", playerId: "adri" }, "j8", "b");
    expect(screen.getByRole("link", { name: /La carrera del MVP/ })).toHaveAttribute("href", "/matches/j8?tab=vestuario");
  });

  it("the vote open with nobody to vote in the ledger: «Vota al MVP» leads to the match's Vestuario tab", () => {
    render(card({ ...base, clock: ended, status: "finished", goalsFor: 1, goalsAgainst: 0, voteClosesAt: DATE + 48 * HOUR }, DATE + 3 * HOUR));
    expect(screen.queryByRole("group", { name: "Tu voto" })).toBeNull();
    expect(screen.getByRole("link", { name: /Vota al MVP/ })).toHaveAttribute("href", "/matches/j8?tab=vestuario");
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("after the whistle, acta pending: «Final · acta pendiente», no ballot", () => {
    render(card({ ...base, clock: ended }, DATE + 70 * MIN));
    expect(screen.getByText(/Final · acta pendiente/)).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Tu voto" })).toBeNull();
  });

  it("away on the match day: «Hoy no juegas: estás ausente», no «Sales de titular», and the way to the switch", () => {
    // (8 Nov: an absence of mine from the 6th to the 9th; the backend's «No puedo» is the answer)
    state.absences = [{ id: "a1", uid: "u1", playerId: "adri", name: "ADRI", from: "2026-11-06", to: "2026-11-09", note: "", createdAt: 1 }];
    state.availability = [{ uid: "u1", response: "no", name: "ADRI", playerId: "adri", absenceId: "a1" }];
    render(card(base, DATE - 2 * HOUR));
    expect(state.reads).toContain("absences/2026-11-08");
    expect(screen.getByText("Hoy no juegas: estás ausente")).toBeInTheDocument();
    expect(screen.queryByText(/Sales de titular/)).toBeNull();
    const go = screen.getByRole("button", { name: "Cambiar mi respuesta" });
    fireEvent.click(go);
    // the focus lands on my answer in the switch
    expect(screen.getByRole("radio", { name: "No puedo" })).toHaveFocus();
  });

  it("away but «Voy» by hand over the absence: no absence line", () => {
    state.absences = [{ id: "a1", uid: "u1", playerId: "adri", name: "ADRI", from: "2026-11-06", to: "2026-11-09", note: "", createdAt: 1 }];
    state.availability = [{ uid: "u1", response: "yes", name: "ADRI", playerId: "adri" }];
    render(card(base, DATE - 2 * HOUR));
    expect(screen.queryByText("Hoy no juegas: estás ausente")).toBeNull();
    expect(screen.getByText("Sales de titular · MC")).toBeInTheDocument();
  });

  it("away while waiting for the whistle: the line, no way to change (the convocatoria closed)", () => {
    state.absences = [{ id: "a1", uid: "u1", playerId: "adri", name: "ADRI", from: "2026-11-08", to: "2026-11-08", note: "", createdAt: 1 }];
    render(card(base, DATE + 5 * MIN));
    expect(screen.getByText("Hoy no juegas: estás ausente")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cambiar mi respuesta" })).toBeNull();
  });

  it("an absence on another day, or once the ball rolls: no line (and no absences read while live)", () => {
    state.absences = [{ id: "a1", uid: "u1", playerId: "adri", name: "ADRI", from: "2026-11-09", to: "2026-11-12", note: "", createdAt: 1 }];
    const { unmount } = render(card(base, DATE - 2 * HOUR));
    expect(screen.queryByText("Hoy no juegas: estás ausente")).toBeNull();
    unmount();
    state.reads = [];
    render(card({ ...base, clock: started }, DATE + 15 * MIN));
    expect(screen.queryByText("Hoy no juegas: estás ausente")).toBeNull();
    expect(state.reads.filter((r) => r.startsWith("absences"))).toEqual([]);
  });

  it("a fan: nothing rendered, nothing read", () => {
    state.viewer = { member: false, admin: false, playerId: null };
    const { container } = render(card(base, DATE - 2 * HOUR));
    expect(container).toBeEmptyDOMElement();
    expect(state.reads).toEqual([]);
  });
});
