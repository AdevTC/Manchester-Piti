import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { matchdayOf, type ViewerRole } from "../../lib/derived/matchday";
import { matchViewAt } from "./inicioModel";
import { PLAYERS, SCENES, SEVEN } from "./inicio.fixtures";

// «Tu partido», one card per viewer: it never repeats the score or the countdown, it says what is his.
const state = vi.hoisted(() => ({
  answers: [] as { uid: string; playerId: string | null; response: string }[],
  ratings: [] as { uid: string; score: number }[],
  prediction: null as { goalsFor: number; goalsAgainst: number; goals: never[] } | null,
  rate: vi.fn(async () => undefined),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className, to, params }: { children?: ReactNode; className?: string; to?: string; params?: Record<string, string> }) => (
    <a className={className} href={(to ?? "").replace("$matchId", params?.matchId ?? "")}>
      {children}
    </a>
  ),
}));
vi.mock("../vestuario/live", () => ({
  useAvailability: () => ({ data: state.answers, loading: false, error: null }),
  useMatchRatings: () => ({ data: state.ratings, loading: false, error: null }),
  useMyPrediction: () => ({ data: state.prediction, loading: false, error: null }),
}));
vi.mock("../vestuario/writes", () => ({ useMe: () => ({ uid: "u-jordi", name: "Jordi", playerId: "jordi" }), rateMatch: state.rate }));
vi.mock("../../lib/useRotaTurns", () => ({ useMatchTurns: () => ({ turns: [] }) }));

const { TuPartido } = await import("./TuPartido");

function card(phase: keyof typeof SCENES, role: ViewerRole, extra: { captain?: boolean; absentUntil?: string | null; playerId?: string } = {}) {
  const { matches, now } = SCENES[phase];
  const day = matchdayOf(matches, "t1", now);
  render(
    <TuPartido
      day={day}
      view={matchViewAt(day, now, null)}
      role={role}
      now={now}
      matches={matches}
      players={PLAYERS}
      playerId={extra.playerId ?? "jordi"}
      captain={!!extra.captain}
      seven={SEVEN}
      absentUntil={extra.absentUntil ?? null}
    />,
  );
  return screen.getByRole("region");
}

beforeEach(() => {
  state.answers = [];
  state.ratings = [];
  state.prediction = null;
  state.rate.mockClear();
});

describe("Tu partido, per viewer", () => {
  it("titular before the match: his place in the seven and his own porra, no score or countdown", () => {
    state.prediction = { goalsFor: 3, goalsAgainst: 1, goals: [] };
    const c = card("antes", "titular");
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Sales en el siete");
    expect(c).toHaveTextContent("Jordi, dorsal 28");
    expect(c).toHaveTextContent("Tu porra: 3–1");
    expect(c).not.toHaveTextContent(/Faltan|Orduña fc/);
  });

  it("suplente and no convocado", () => {
    card("antes", "suplente", { playerId: "erik" });
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Empiezas en el banquillo");
  });
  it("no convocado", () => {
    card("antes", "noconvocado", { playerId: "josito" });
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Esta vez no vas convocado");
  });

  it("anotador: «Hoy anotas tú · Abrir la mesa»", () => {
    card("antes", "anotador", { playerId: "huberoski" });
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Hoy anotas tú");
    expect(screen.getByRole("link", { name: "Abrir la mesa" })).toHaveAttribute("href", "/matches/j1/mesa");
  });

  it("ausente: until when, and the way to change it", () => {
    card("antes", "ausente", { playerId: "andia", absentUntil: "2026-10-25" });
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Estás de baja hasta el 25");
    expect(screen.getByRole("link", { name: "Cambiar mi ausencia" })).toHaveAttribute("href", "/vestuario");
  });

  it("the captain: a quiet «Modo capitán» with the called who haven't answered (members only)", () => {
    state.answers = [{ uid: "u1", playerId: "evans", response: "yes" }];
    const c = card("antes", "titular", { captain: true });
    expect(c).toHaveTextContent("Modo capitán: 8 sin responder");
    expect(screen.getByRole("link", { name: "Ir a Convocar" })).toHaveAttribute("href", "/admin/convocar");
  });

  it("from the acta on: the nota 1–5 (his own) and the «Debut»", () => {
    card("acta", "titular");
    const five = screen.getByRole("button", { name: "4" });
    fireEvent.click(five);
    expect(state.rate).toHaveBeenCalledWith(expect.objectContaining({ uid: "u-jordi" }), "j1", 4);
    expect(five).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Logro desbloqueado: Debut")).toBeInTheDocument();
  });

  it("después: the vestuario's nota with its votes, never a tally of the MVP", () => {
    state.ratings = [{ uid: "a", score: 4 }, { uid: "b", score: 5 }];
    const c = card("despues", "titular");
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Nota del vestuario: 4,5");
    expect(c).toHaveTextContent("Con 2 votos.");
    expect(c).toHaveTextContent("Jugaste 50 minutos.");
  });
});
