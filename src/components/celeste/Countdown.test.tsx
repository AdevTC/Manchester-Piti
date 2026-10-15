import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { Countdown } from "./Countdown";

// The one countdown Partidos and the match page share: the same markup and label they each had, on the
// server's clock (useClock, stubbed).
const NOW = Date.UTC(2026, 10, 8, 11);
vi.mock("../../hooks/useClock", () => ({ useClock: () => NOW }));

it("days, hours, minutes and seconds as flip tiles under one timer label", () => {
  const { container } = render(<Countdown target={NOW + 2 * 86_400_000 + 3 * 3_600_000 + 4 * 60_000 + 5_000} />);
  const timer = screen.getByRole("timer");
  expect(timer).toHaveClass("pt-cd");
  expect(timer).toHaveAttribute("aria-label", "Faltan 2 días, 3 horas y 4 minutos");
  expect([...container.querySelectorAll(".pt-cd > div")].map((d) => [d.querySelector(".pt-flip")?.textContent, d.querySelector("small")?.textContent])).toEqual([
    ["02", "DÍAS"],
    ["03", "HORAS"],
    ["04", "MIN"],
    ["05", "SEG"],
  ]);
  expect(container.querySelectorAll(".pt-flip[aria-hidden='true']")).toHaveLength(4);
});

it("past the target it holds at zero", () => {
  render(<Countdown target={NOW - 1000} />);
  expect(screen.getByRole("timer")).toHaveAttribute("aria-label", "Faltan 0 días, 0 horas y 0 minutos");
});
