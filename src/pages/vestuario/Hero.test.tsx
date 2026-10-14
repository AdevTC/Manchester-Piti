import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import type { ClubMatch } from "../../lib/clubData";
import { readyClock, transitionClock } from "../../../functions/src/matchClock";

// The vestuario hero («Tu cartel»): the next match, not live yet, leads to its page («Ver la previa»);
// live, the island over every page already does. Router, writes and the 3D shirt are stubbed: no
// Firebase, no WebGL.
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className, to, params }: { children?: ReactNode; className?: string; to: string; params?: { matchId?: string } }) => (
    <a className={className} href={to.replace("$matchId", params?.matchId ?? "")}>
      {children}
    </a>
  ),
}));
// (the RSVP is the shared member control, components/celeste/member/RsvpSwitch: it writes through here)
const writes = vi.hoisted(() => ({ setAvailability: vi.fn(async () => undefined) }));
vi.mock("./writes", () => ({ useMe: () => ({ uid: "u1", name: "ADRI", playerId: "adri" }), setAvailability: writes.setAvailability }));
vi.mock("../../lib/clubApi", () => ({ apiError: () => "", requestPlayerClaim: vi.fn() }));
vi.mock("../../lib/share", () => ({ shareClubPage: vi.fn(async () => undefined) }));
vi.mock("../../components/jersey3d/Jersey3D", () => ({ Jersey3D: () => null }));
vi.mock("../../components/Jersey", () => ({ Jersey: () => null }));

const { Hero } = await import("./Hero");

const MIN = 60_000;
const DATE = Date.UTC(2026, 10, 8, 11);
const next: ClubMatch = { id: "j8", seasonId: "t1", version: 2, status: "scheduled", rival: "MAD SKY", date: DATE, duration: 50, clock: readyClock() };
const me = { uid: "u1", displayName: "ADRI", shirtName: "ADRI", number: "10", playerId: "adri" };
const hero = (m: ClubMatch | undefined, now: number, availability: Parameters<typeof Hero>[0]["availability"] = []) => (
  <Hero me={me} seasonName="Temporada 1" next={m} meetingNote="" availability={availability} now={now} theme="dark" faceName={() => ""} claim={null} claimable={[]} suggestion={null} admin={false} />
);

it("the next match: «Ver la previa» → its page (no tab: it opens on the previa), also once its date has come", () => {
  const { rerender } = render(hero(next, DATE - 2 * 86_400_000));
  expect(screen.getByRole("link", { name: /Ver la previa/ })).toHaveAttribute("href", "/matches/j8");
  rerender(hero(next, DATE + 5 * MIN));
  expect(screen.getByRole("link", { name: /Ver la previa/ })).toHaveAttribute("href", "/matches/j8");
});

it("live: no previa (the live island leads to it); no match: no link", () => {
  const started = { ...next, clock: transitionClock(next.clock, "start", DATE + 10 * MIN) };
  const { rerender } = render(hero(started, DATE + 20 * MIN));
  expect(screen.queryByRole("link", { name: /Ver la previa/ })).toBeNull();
  rerender(hero(undefined, DATE));
  expect(screen.queryByRole("link", { name: /Ver la previa/ })).toBeNull();
});

it("the convocatoria: the shared «Voy · Duda · No puedo» with my answer, where «Primeros pasos» jumps (#vx-rsvp)", () => {
  const { rerender } = render(hero(next, DATE - 2 * 86_400_000, [{ uid: "u1", response: "yes", name: "ADRI", playerId: "adri" }]));
  const group = screen.getByRole("radiogroup", { name: "Tu respuesta a la convocatoria" });
  expect(group).toHaveAttribute("id", "vx-rsvp");
  expect(screen.getByRole("radio", { name: "Voy" })).toHaveAttribute("aria-checked", "true");
  expect(screen.getByText("Contigo, 1.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("radio", { name: "Duda" }));
  expect(writes.setAvailability).toHaveBeenCalledWith({ uid: "u1", name: "ADRI", playerId: "adri" }, "j8", "maybe");
  // from the match's date on, no answers (the rules refuse them)
  rerender(hero(next, DATE + 5 * MIN, [{ uid: "u1", response: "yes", name: "ADRI", playerId: "adri" }]));
  expect(screen.queryByRole("radiogroup")).toBeNull();
});
