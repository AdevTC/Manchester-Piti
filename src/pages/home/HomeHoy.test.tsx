import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { readyClock } from "../../../functions/src/matchClock";
import type { ClubMatch } from "../../lib/clubData";

// The home's host for «Hoy»: a member on match day gets the card (its chunk loads then, not before); a fan,
// or any day without a match, gets nothing at all — and the server render is empty whoever asks, so the
// HTML the fans get is unchanged. The card itself is stubbed (HoyCard.test.tsx covers it).
const state = vi.hoisted(() => ({ viewer: { member: true, admin: false, playerId: "adri" as string | null }, loaded: 0 }));
vi.mock("../../hooks/useViewer", () => ({ useViewer: () => state.viewer }));
vi.mock("../../components/celeste/HoyCard", () => {
  state.loaded++;
  return { HoyCard: ({ matches, className }: { matches: ClubMatch[]; className?: string }) => <section aria-label="Hoy" className={className} data-matches={matches.length} /> };
});

const { HomeHoy } = await import("./HomeHoy");

const DATE = Date.UTC(2026, 10, 8, 11);
const MIDNIGHT = Date.UTC(2026, 10, 7, 23); // 00:00 Madrid on the 8th
const match: ClubMatch = { id: "j8", seasonId: "t1", version: 2, status: "scheduled", rival: "MAD SKY", date: DATE, duration: 50, clock: readyClock() };
const host = (now: number) => <HomeHoy matches={[match]} players={[]} now={now} />;

beforeEach(() => {
  state.viewer = { member: true, admin: false, playerId: "adri" };
});

it("a fan on match day: nothing, and the card's chunk is never loaded", () => {
  state.viewer = { member: false, admin: false, playerId: null };
  const { container } = render(host(DATE - 3_600_000));
  expect(container).toBeEmptyDOMElement();
  expect(state.loaded).toBe(0);
});

it("the server render is empty, even for a member on match day (the fan's HTML stays as it is)", () => {
  expect(renderToString(host(DATE - 3_600_000))).toBe("");
  expect(state.loaded).toBe(0);
});

it("a member the day before: nothing", () => {
  const { container } = render(host(MIDNIGHT - 1));
  expect(container).toBeEmptyDOMElement();
});

it("a member on match day: the card, above the hero (.hm-hoy)", async () => {
  render(host(MIDNIGHT));
  const card = await screen.findByRole("region", { name: "Hoy" });
  expect(card).toHaveClass("hm-hoy");
  expect(state.loaded).toBe(1);
});
