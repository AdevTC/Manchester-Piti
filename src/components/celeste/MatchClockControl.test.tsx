import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { MatchClockControl } from "./MatchClockControl";
const api = vi.hoisted(() => ({ control: vi.fn() }));
vi.mock("../../lib/clubApi", () => ({ controlMatchClock: api.control, apiError: (e: Error) => e.message }));
vi.mock("../../hooks/useClock", () => ({ useClock: () => 1_801_000 }));
beforeEach(() => { api.control.mockReset(); });

it("prevents repeated submissions and takes the next phase from the shared match", async () => {
  let release!: () => void;
  api.control.mockImplementation(() => new Promise<void>(resolve => { release = resolve; }));
  const { rerender } = render(<MatchClockControl match={{id:"m",status:"scheduled",clock:{phase:"ready",revision:4}}} />);
  const start = screen.getByRole("button", {name:/Iniciar partido/});
  fireEvent.click(start); fireEvent.click(start);
  expect(start).toBeDisabled();
  expect(api.control).toHaveBeenCalledTimes(1);
  expect(api.control).toHaveBeenCalledWith({matchId:"m",action:"start",revision:4});
  await act(async () => release());
  rerender(<MatchClockControl match={{id:"m",status:"scheduled",clock:{phase:"halftime",revision:6,firstStartedAt:1000,firstEndedAt:1_501_000}}} />);
  expect(screen.queryByRole("button", {name:/Iniciar partido/})).not.toBeInTheDocument();
  expect(screen.getByText("Descanso · 25:00 · descanso 5:00")).toBeInTheDocument();
  expect(screen.getByRole("button", {name:"Iniciar 2ª parte"})).toBeEnabled();
});

it("requires confirmation to reset and surfaces a concurrent transition error", async () => {
  api.control.mockRejectedValue(new Error("Otra persona ha cambiado el reloj."));
  render(<MatchClockControl match={{id:"m",clock:{phase:"first",revision:1,firstStartedAt:1000}}} />);
  fireEvent.click(screen.getByRole("button", {name:"Cancelar inicio y reiniciar"}));
  expect(api.control).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", {name:/^Confirmar$/}));
  expect(await screen.findByRole("alert")).toHaveTextContent("Otra persona ha cambiado el reloj.");
  expect(api.control).toHaveBeenCalledWith({matchId:"m",action:"reset",revision:1});
});
