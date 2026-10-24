import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClubMatch } from "../lib/clubData";
import type { MvpResult } from "../lib/vestuario";
import { analysePlayer } from "../lib/clubAnalytics";
import { ratingMatches, seasonRatings } from "../lib/seasonRating";

// The rating by position is GLOBAL's notas in every consumer that prints it: the player's «Juego» (Plantilla's
// model) and the perfil's «Dónde has jugado» hand playerPositions the season's ratings (dropping them fails
// here); /stats › Posiciones prints only minutes. The admin's wiring: admin/views/Plantilla.ratings.test.tsx.

const spy = vi.hoisted(() => ({ calls: [] as unknown[][] }));
vi.mock("../lib/positionStats", async (orig) => {
  const real = await orig<typeof import("../lib/positionStats")>();
  return {
    ...real,
    playerPositions: (...args: Parameters<typeof real.playerPositions>) => {
      spy.calls.push(args);
      return real.playerPositions(...args);
    },
  };
});
vi.mock("../components/jersey3d/Jersey3D", () => ({ Jersey3D: ({ label }: { label: string }) => <canvas role="img" aria-label={label} /> }));
vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children?: ReactNode }) => <a>{children}</a> }));

const { periodCtx, positions } = await import("./squad/plantilla/model");
const { Posiciones } = await import("./stats/Posiciones");
const { playerPositions } = await import("../lib/positionStats");
const { positionsPlayed } = await import("./perfil/profileData");

type Row = NonNullable<ClubMatch["ledger"]>[string];
const row = (minutes: number, extra: Partial<Row> = {}) => ({ minutes, started: true, played: minutes > 0, goals: 0, assists: 0, yellowCards: 0, redCards: 0, doubleYellows: 0, ...extra }) as Row;
const NOW = 100;
const match = (n: number, ledger: ClubMatch["ledger"], extra: Partial<ClubMatch> = {}): ClubMatch => ({ id: "j" + n, seasonId: "t1", rival: "R" + n, date: n, duration: 50, status: "finished", goalsFor: 1, goalsAgainst: 1, events: [], ledger, ...extra });
const GAMES = [
  match(1, { erik: row(50, { positionsPlayed: { MCD: 50 } }), ana: row(50, { positionsPlayed: { MCD: 50 } }) }),
  match(2, { erik: row(50, { positionsPlayed: { MCD: 50 }, goals: 1 }), ana: row(50, { positionsPlayed: { MCD: 50 } }) }, { voteClosesAt: 50 }),
  match(3, { erik: row(50, { positionsPlayed: { MCD: 50 } }), ana: row(50, { positionsPlayed: { MCD: 50 }, yellowCards: 1 }) }),
];
const RESULTS = new Map<string, MvpResult>([["j2", { id: "j2", counts: { erik: 3 }, total: 3 }]]);
const PLAYERS = [{ id: "erik", shirtName: "ERIK", number: 9, seasons: ["t1"] }, { id: "ana", shirtName: "ANA", number: 6, seasons: ["t1"] }];
/** The jugador page's construction: the season's notas over the same matches. */
const jugador = (id: string) => playerPositions(id, GAMES, seasonRatings(ratingMatches(GAMES))).lines[0].rating;

beforeEach(() => {
  spy.calls.length = 0;
});

describe("the season's notas reach every rating by position", () => {
  it("the player's «Juego» rates with the period's ratings, and an MVP (decided days later) does not move it", () => {
    const ctx = periodCtx(PLAYERS, GAMES, "t1", [{ id: "t1" }], RESULTS, NOW, []);
    const rating = positions("erik", ctx).lines[0].rating;
    expect(rating).not.toBeNull();
    expect(spy.calls.length).toBeGreaterThan(0);
    for (const c of spy.calls) expect(c[2]).toBe(ctx.ratings);
    expect(rating).toBe(jugador("erik"));
    expect(positions("erik", periodCtx(PLAYERS, GAMES, "t1", [{ id: "t1" }], new Map(), NOW, [])).lines[0].rating).toBe(rating);
  });

  it("/stats › Posiciones reads only the minutes (no rating printed there)", () => {
    render(<Posiciones games={GAMES} rows={PLAYERS.map((p) => analysePlayer(p, GAMES))} nameOf={(p) => p.shirtName ?? ""} />);
    expect(spy.calls.length).toBeGreaterThan(0);
    for (const c of spy.calls) expect(c[2]).toBeUndefined();
  });

  it("the perfil's «Dónde has jugado» rates with the season's notas (the same number as jugador)", () => {
    const perfil = positionsPlayed("erik", GAMES, []).lines[0].rating;
    expect(perfil).not.toBeNull();
    expect(perfil).toBe(jugador("erik"));
    expect(positionsPlayed("ana", GAMES, []).lines[0].rating).toBe(jugador("ana"));
  });
});
