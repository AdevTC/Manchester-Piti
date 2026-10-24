import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ClubMatch, MatchEvent } from "../../../lib/clubData";
import type { PageCtx } from "./ctx";
import { playsOf, scoreAt } from "./model";
import { Tira } from "./Tira";

const ev = (id: string, type: string, minute: number, more: Partial<MatchEvent> = {}): MatchEvent => ({ id, type, minute, ...more }) as MatchEvent;
const match = { id: "j1", rival: "Orduña fc", duration: 50, status: "finished", events: [ev("1", "opponent_goal", 2), ev("2", "goal", 43, { playerId: "a" })] } as ClubMatch;
const plays = playsOf(match, (id) => (id === "a" ? "Alcides" : id), "Orduña fc");
const ctxAt = (minute: number, more: Partial<PageCtx> = {}) =>
  ({ minute, edge: 50, duration: 50, live: false, fase: "acta", plays, pulse: new Array(51).fill(0), score: scoreAt(plays, minute), ...more }) as unknown as PageCtx;
const verbs = () => ({ onPlay: vi.fn(), onJump: vi.fn(), onSeek: vi.fn() });

describe("the moviola in the sticky strip", () => {
  it("is folded and out of reach while the header is in view", () => {
    const { container } = render(<Tira c={ctxAt(50)} on={false} playing={false} {...verbs()} />);
    expect(container.firstElementChild).toHaveAttribute("inert");
  });

  it("moves the same moviola: dragging seeks, the buttons jump and replay", () => {
    const v = verbs();
    render(<Tira c={ctxAt(20)} on playing={false} {...v} />);
    const range = screen.getByRole("slider", { name: "La moviola: minuto del partido" });
    expect(range).toHaveAttribute("aria-valuetext", "Minuto 20. Marcador 0 a 1");
    fireEvent.change(range, { target: { value: "43" } });
    expect(v.onSeek).toHaveBeenCalledWith(43, true);
    fireEvent.click(screen.getByRole("button", { name: "Jugada siguiente" }));
    expect(v.onJump).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByRole("button", { name: "Repasar el partido" }));
    expect(v.onPlay).toHaveBeenCalled();
  });

  it("says the minute and what happened in it, our goal in gold", () => {
    const { container } = render(<Tira c={ctxAt(43)} on playing={false} {...verbs()} />);
    const chip = container.querySelector(".pp-tira__chip");
    expect(chip).toHaveTextContent("43′ · Gol de Alcides");
    expect(chip).toHaveClass("is-gold");
    expect(container.querySelectorAll(".pp-tira__dot.is-gold, .pp-tira__dot.is-them")).toHaveLength(2);
  });

  it("live, it stops at the edge and marks it", () => {
    const { container } = render(<Tira c={ctxAt(30, { live: true, fase: "segunda", edge: 30 } as Partial<PageCtx>)} on playing={false} {...verbs()} />);
    expect(screen.getByRole("slider")).toHaveAttribute("max", "30");
    expect(container.querySelector(".pp-tira__live")).not.toBeNull();
    expect(container.querySelector(".pp-tira__chip")).toHaveTextContent("30′ · Ahora");
  });
});
