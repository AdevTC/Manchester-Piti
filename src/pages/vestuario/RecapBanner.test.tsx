import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ClubMatch } from "../../lib/clubData";
import type { PlayerDoc } from "../../lib/schemas";
import { previousSeasonId, recapBannerOn, recapClosedAt, recapOffer } from "../perfil/recapView";

// The vestuario's «Ya está tu temporada en cromos»: the previous season's recap once a later season has
// taken over, until 14 days after the new one kicks off, linking to /profile#cromos. Real seasonRecap over
// a two-season fixture.

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, hash, className }: { children?: ReactNode; to: string; hash?: string; className?: string }) => (
    <a className={className} href={to + (hash ? "#" + hash : "")}>
      {children}
    </a>
  ),
}));
const { RecapBanner } = await import("./RecapBanner");

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 3, 1, 10);
let seq = 0;
const played = (playerId: string) => ({ id: `e${seq++}`, type: "match_played" as const, playerId });
const game = (id: string, seasonId: string, at: number, extra: Partial<ClubMatch> = {}): ClubMatch => ({ id, seasonId, rival: `Rival ${id}`, status: "finished", date: at, goalsFor: 2, goalsAgainst: 1, events: [played("adri")], ...extra });
const ADRI = { id: "adri", shirtName: "ADRI", firstName: "Adrián", number: 10, active: true, seasons: ["t1", "t2"] } as unknown as PlayerDoc;
const SEASONS = [
  { id: "t1", name: "Temporada 1" },
  { id: "t2", name: "Temporada 2" },
];
const LAST_T1 = T0 + 14 * DAY;
const KICKOFF_T2 = T0 + 120 * DAY;
const T1 = [game("a1", "t1", T0), game("a2", "t1", T0 + 7 * DAY), game("a3", "t1", LAST_T1)];
const T2 = [game("b1", "t2", KICKOFF_T2, { status: "scheduled", goalsFor: undefined, goalsAgainst: undefined, events: [] })];
const base = (matches: ClubMatch[], now: number) => ({ matches, players: [ADRI], seasons: SEASONS, mvpResults: new Map(), uid: "u1", now });

describe("the recap on offer", () => {
  it("is the previous season's, closed, once a later season is the current one", () => {
    expect(previousSeasonId(SEASONS, "t2")).toBe("t1");
    const offer = recapOffer(base([...T1, ...T2], LAST_T1 + 30 * DAY), {}, "adri", "t2");
    expect(offer?.status).toBe("closed");
    expect(offer?.recap.seasonId).toBe("t1");
    expect(offer?.recap.cards[0]).toMatchObject({ kind: "portada" });
  });
  it("is none while the only season has under 10 matches, or for a member without a ficha", () => {
    expect(recapOffer(base(T1, LAST_T1 + DAY), {}, "adri", "t1")).toBeNull();
    expect(recapOffer(base([...T1, ...T2], LAST_T1 + 30 * DAY), {}, null, "t2")).toBeNull();
  });
});

describe("the banner's 14 days", () => {
  const offer = recapOffer(base([...T1, ...T2], LAST_T1 + 30 * DAY), {}, "adri", "t2");
  const closedAt = recapClosedAt([...T1, ...T2], "t1", "t2");

  it("closes when the new season kicks off (never before the old one's last match)", () => {
    expect(closedAt).toBe(KICKOFF_T2);
    expect(recapClosedAt(T1, "t1", "t2")).toBeNull();
    expect(recapClosedAt([...T1, game("b0", "t2", T0, { status: "scheduled" })], "t1", "t2")).toBe(LAST_T1);
  });
  it("is on from the close until 14 days after it", () => {
    expect(recapBannerOn(offer, closedAt, LAST_T1 + 30 * DAY)).toBe(true);
    expect(recapBannerOn(offer, closedAt, KICKOFF_T2)).toBe(true);
    expect(recapBannerOn(offer, closedAt, KICKOFF_T2 + 14 * DAY - 1)).toBe(true);
    expect(recapBannerOn(offer, closedAt, KICKOFF_T2 + 14 * DAY)).toBe(false);
  });
  it("needs a closed recap and a close date", () => {
    expect(recapBannerOn(offer ? { ...offer, status: "partial" } : null, closedAt, KICKOFF_T2)).toBe(false);
    expect(recapBannerOn(null, closedAt, KICKOFF_T2)).toBe(false);
    expect(recapBannerOn(offer, null, KICKOFF_T2)).toBe(false);
  });
});

describe("RecapBanner", () => {
  it("links to the perfil with the story open", () => {
    render(<RecapBanner seasonName="Temporada 1" />);
    expect(screen.getByRole("heading", { name: "Ya está tu temporada en cromos" })).toBeTruthy();
    expect(screen.getByText("Temporada 1 · cerrada")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ver mis cromos" }).getAttribute("href")).toBe("/profile#cromos");
  });
});
