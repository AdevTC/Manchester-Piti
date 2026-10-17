import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { MatchClockDisplay } from "./MatchClockControl";
vi.mock("../../hooks/useClock", () => ({ useClock: () => 1_801_000 }));

it("reads the shared clock: the half, its time and the break's", () => {
  render(<MatchClockDisplay match={{ clock: { phase: "halftime", revision: 6, firstStartedAt: 1000, firstEndedAt: 1_501_000 } }} />);
  expect(screen.getByText("Descanso · 25:00 · descanso 5:00")).toBeInTheDocument();
});
