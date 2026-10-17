import { describe, expect, it } from "vitest";
import type { Participation } from "../../functions/src/matchEngine";
import { computeStats } from "./playerStats";

describe("computeStats · la mesa's per-player counts", () => {
  it("from the events of an acta without a ledger: chances, saves, fouls made and suffered (a pending duplicate counts nothing)", () => {
    const s = computeStats("p", [{ status: "finished", events: [
      { type: "chance", playerId: "p" },
      { type: "chance", playerId: "p", dupOf: "x" },
      { type: "save", playerId: "p" },
      { type: "penalty_saved", playerId: "p" },
      { type: "foul", playerId: "p" },
      { type: "foul_received", playerId: "p" },
      { type: "foul_received", playerId: "p" },
      { type: "woodwork", playerId: "p" },
    ] }]);
    expect(s).toMatchObject({ chances: 1, saves: 1, penaltySaved: 1, fouls: 1, foulsReceived: 2, woodwork: 1, matchesPlayed: 1 });
  });
  it("from the published ledger, whose technical «saves» also counts the penalties stopped", () => {
    const row = { played: true, goals: 0, assists: 0, yellowCards: 0, redCards: 0, doubleYellows: 0, woodwork: 2, penaltySaved: 1, goalPenalty: 0, goalFreekick: 0, penaltyMissed: 0, ownGoals: 0, chances: 3, saves: 4, fouls: 1, foulsReceived: 5 } as unknown as Participation;
    expect(computeStats("p", [{ status: "finished", ledger: { p: row } }])).toMatchObject({ chances: 3, woodwork: 2, saves: 3, penaltySaved: 1, fouls: 1, foulsReceived: 5 });
    // an older acta: none of them, zero
    const old = { played: true, goals: 1, assists: 0, yellowCards: 0, redCards: 0, doubleYellows: 0, woodwork: 0, penaltySaved: 1, goalPenalty: 0, goalFreekick: 0, penaltyMissed: 0, ownGoals: 0 } as unknown as Participation;
    expect(computeStats("p", [{ status: "finished", ledger: { p: old } }])).toMatchObject({ chances: 0, saves: 0, fouls: 0, foulsReceived: 0 });
  });
});
