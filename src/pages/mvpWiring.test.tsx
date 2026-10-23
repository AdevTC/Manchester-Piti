import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClubMatch } from "../lib/clubData";
import type { MvpResult } from "../lib/vestuario";
import { analysePlayer } from "../lib/clubAnalytics";
import { mvpOfFrom } from "../lib/derived/mvpOf";

// The rating by position is wired with the MVPs in every consumer: the player's «Juego» (Plantilla's model),
// /stats › Posiciones and the perfil's «Dónde has jugado» hand playerPositions the shared mvpOf (dropping
// it fails here). The admin's wiring: admin/views/Plantilla.mvp.test.tsx.

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
  match(1, { erik: row(50, { positionsPlayed: { MCD: 50 } }) }),
  match(2, { erik: row(50, { positionsPlayed: { MCD: 50 } }) }, { voteClosesAt: 50 }),
  match(3, { erik: row(50, { positionsPlayed: { MCD: 50 } }) }),
];
const RESULTS = new Map<string, MvpResult>([["j2", { id: "j2", counts: { erik: 3 }, total: 3 }]]);
const mvpOf = mvpOfFrom(RESULTS, GAMES, NOW);

beforeEach(() => {
  spy.calls.length = 0;
});

describe("the MVPs reach every rating by position", () => {
  it("the player's «Juego» rates with the period's mvpOf", () => {
    const ctx = periodCtx([{ id: "erik", shirtName: "ERIK", number: 9, seasons: ["t1"] }], GAMES, "t1", [{ id: "t1" }], RESULTS, NOW);
    const rating = positions("erik", ctx).lines[0].rating;
    expect(spy.calls.length).toBeGreaterThan(0);
    for (const c of spy.calls) expect(c[2]).toBe(ctx.mvpOf);
    expect(rating).toBe(playerPositions("erik", GAMES, mvpOf).lines[0].rating);
  });

  it("/stats › Posiciones passes its mvpOf for every player", () => {
    render(<Posiciones games={GAMES} rows={[analysePlayer({ id: "erik", shirtName: "ERIK" }, GAMES)]} nameOf={(p) => p.shirtName ?? ""} mvpOf={mvpOf} />);
    expect(spy.calls.length).toBeGreaterThan(0);
    for (const c of spy.calls) expect(c[2]).toBe(mvpOf);
  });

  it("the perfil's «Dónde has jugado» rates with the MVPs (the same number as jugador)", async () => {
    const perfil = positionsPlayed("erik", GAMES, RESULTS, NOW).lines[0].rating;
    expect(typeof spy.calls[0][2]).toBe("function");
    // (the player page's construction: playerPositions with the period's mvpOfFrom)
    expect(perfil).toBe(playerPositions("erik", GAMES, mvpOf).lines[0].rating);
    expect(perfil!).toBeGreaterThan(positionsPlayed("erik", GAMES, new Map(), NOW).lines[0].rating!);
  });
});
