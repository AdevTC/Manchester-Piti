import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ClubMatch } from "../../lib/clubData";
import type { PlayerDoc } from "../../lib/schemas";
import { closedRecapSeason, previousSeasonId, recapBannerSeason, recapOffer, seasonLastMatchAt } from "../perfil/recapView";

// The vestuario's «Ya está tu temporada en cromos»: the previous season's recap once a later season has
// taken over, until 30 days after its last match, linking to /profile#cromos. Real seasonRecap over
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
  it("is the previous season's, closed, once a later season is the current one (within its 30 days)", () => {
    expect(previousSeasonId(SEASONS, "t2")).toBe("t1");
    const offer = recapOffer(base([...T1, ...T2], LAST_T1 + 30 * DAY), {}, "adri", "t2");
    expect(offer?.status).toBe("closed");
    expect(offer?.recap.seasonId).toBe("t1");
    expect(offer?.recap.cards[0]).toMatchObject({ kind: "portada" });
    expect(recapOffer(base([...T1, ...T2], LAST_T1 + 30 * DAY + 1), {}, "adri", "t2")).toBeNull();
  });
  it("is none while the only season has under 10 matches, or for a member without a ficha", () => {
    expect(recapOffer(base(T1, LAST_T1 + DAY), {}, "adri", "t1")).toBeNull();
    expect(recapOffer(base([...T1, ...T2], LAST_T1 + 30 * DAY), {}, null, "t2")).toBeNull();
  });
  it("keeps the closed one for its 30 days even when the new season already has its «hasta ahora»", () => {
    // ten played matches of the new season inside the old one's 30 days, and one more to come
    const t2 = [...Array.from({ length: 10 }, (_, k) => game(`c${k}`, "t2", LAST_T1 + (1 + 2 * k) * DAY)), game("c10", "t2", LAST_T1 + 90 * DAY, { status: "scheduled", goalsFor: undefined, goalsAgainst: undefined, events: [] })];
    const inside = recapOffer(base([...T1, ...t2], LAST_T1 + 30 * DAY), {}, "adri", "t2");
    expect(inside).toMatchObject({ status: "closed", recap: { seasonId: "t1" } });
    const after = recapOffer(base([...T1, ...t2], LAST_T1 + 30 * DAY + 1), {}, "adri", "t2");
    expect(after).toMatchObject({ status: "partial", recap: { seasonId: "t2" } });
  });
});

describe("the closed recap's 30 days (perfil offer and vestuario banner)", () => {
  it("runs from the close until 30 days after the season's last match", () => {
    expect(seasonLastMatchAt([...T1, ...T2], "t1")).toBe(LAST_T1);
    expect(closedRecapSeason(base([...T1, ...T2], LAST_T1 + DAY), "adri", "t2")).toBe("t1");
    expect(closedRecapSeason(base([...T1, ...T2], LAST_T1 + 30 * DAY), "adri", "t2")).toBe("t1");
    expect(closedRecapSeason(base([...T1, ...T2], LAST_T1 + 30 * DAY + 1), "adri", "t2")).toBeNull();
    expect(recapBannerSeason(base([...T1, ...T2], LAST_T1 + 30 * DAY), "adri", "t2")).toBe("Temporada 1");
    expect(recapBannerSeason(base([...T1, ...T2], LAST_T1 + 30 * DAY + 1), "adri", "t2")).toBeNull();
  });
  it("needs the season closed, a previous season and a member with a ficha", () => {
    // no later season has taken over: Temporada 1 is still the current one
    expect(recapBannerSeason(base(T1, LAST_T1 + DAY), "adri", "t2")).toBeNull();
    expect(recapBannerSeason(base([...T1, ...T2], LAST_T1 + DAY), "adri", "t1")).toBeNull();
    expect(recapBannerSeason(base([...T1, ...T2], LAST_T1 + DAY), null, "t2")).toBeNull();
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
