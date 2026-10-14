import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { transitionClock, readyClock } from "../../../functions/src/matchClock";
import type { MatchEvent } from "../../../functions/src/matchEngine";
import { Flip } from "./Flip";
import { GoalBurst } from "./GoalBurst";
import { useGoalCelebration } from "./useGoalCelebration";

const MIN = 60_000;
const T0 = Date.UTC(2026, 10, 8, 11);
const clock = transitionClock(readyClock(), "start", T0);
const goal = (id: string, minute: number, type: MatchEvent["type"] = "goal"): MatchEvent => ({ id, type, minute, elapsedSeconds: minute * 60 }) as MatchEvent;

// The live board in miniature: the score tiles and the burst, driven by the hook as the pages do.
function Board({ events, now, legacy = false }: { events: MatchEvent[]; now: number; legacy?: boolean }) {
  const gf = events.filter((e) => e.type === "goal").length;
  const ga = events.filter((e) => e.type === "opponent_goal").length;
  const show = useGoalCelebration({ id: "m1", date: T0, duration: 50, ...(legacy ? {} : { clock }), events }, now);
  return (
    <div>
      <Flip value={gf} still={!show.flip} className="gf" />
      <Flip value={ga} still={!show.flip} className="ga" />
      <GoalBurst burst={show.burst} who="ERIK" />
    </div>
  );
}
const burst = (c: HTMLElement) => c.querySelector(".pt-goal");
const tile = (c: HTMLElement, side: "gf" | "ga") => c.querySelector<HTMLElement>(`.pt-flip.${side}`)!;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("opening a live match that already has goals: no burst and the score does not flip", () => {
  const { container } = render(<Board events={[goal("g1", 5), goal("g2", 9)]} now={T0 + 30 * MIN} />);
  expect(burst(container)).toBeNull();
  expect(tile(container, "gf")).toHaveClass("still");
  expect(tile(container, "gf")).toHaveTextContent("2");
});

it("a fresh goal after the board is open: ¡GOL! and the tile flips, then it goes away", () => {
  const events = [goal("g1", 5)];
  const { container, rerender } = render(<Board events={events} now={T0 + 20 * MIN} />);
  rerender(<Board events={[...events, goal("g2", 20)]} now={T0 + 20 * MIN + 10_000} />);
  expect(screen.getByText("¡GOL!")).toBeInTheDocument();
  expect(tile(container, "gf")).toHaveTextContent("2");
  expect(tile(container, "gf")).not.toHaveClass("still");
  act(() => {
    vi.advanceTimersByTime(2800);
  });
  expect(burst(container)).toBeNull();
});

it("an old goal that arrives late (stale cache, sync after being offline): the score changes, nothing is celebrated", () => {
  const events = [goal("g1", 5)];
  const { container, rerender } = render(<Board events={events} now={T0 + 30 * MIN} />);
  rerender(<Board events={[...events, goal("g2", 12)]} now={T0 + 30 * MIN + 5_000} />);
  expect(burst(container)).toBeNull();
  expect(tile(container, "gf")).toHaveTextContent("2");
  expect(tile(container, "gf")).toHaveClass("still");
});

it("a goal against, fresh: the tiles flip but there is no ¡GOL!", () => {
  const { container, rerender } = render(<Board events={[]} now={T0 + 10 * MIN} />);
  rerender(<Board events={[goal("r1", 10, "opponent_goal")]} now={T0 + 10 * MIN + 5_000} />);
  expect(burst(container)).toBeNull();
  expect(tile(container, "ga")).toHaveTextContent("1");
  expect(tile(container, "ga")).not.toHaveClass("still");
});

it("the same goals coming back (a re-render, a snapshot repeating them) never celebrate", () => {
  const events = [goal("g1", 5)];
  const { container, rerender } = render(<Board events={events} now={T0 + 6 * MIN} />);
  rerender(<Board events={[...events]} now={T0 + 6 * MIN + 15_000} />);
  expect(burst(container)).toBeNull();
});

it("a match without a clock (legacy): a fresh goal celebrates, an old one arriving late does not", () => {
  const { container, rerender } = render(<Board legacy events={[goal("g1", 3)]} now={T0 + 20 * MIN} />);
  expect(burst(container)).toBeNull();
  rerender(<Board legacy events={[goal("g1", 3), goal("g2", 8)]} now={T0 + 20 * MIN + 5_000} />);
  expect(burst(container)).toBeNull();
  rerender(<Board legacy events={[goal("g1", 3), goal("g2", 8), goal("g3", 19)]} now={T0 + 20 * MIN + 10_000} />);
  expect(screen.getByText("¡GOL!")).toBeInTheDocument();
});
