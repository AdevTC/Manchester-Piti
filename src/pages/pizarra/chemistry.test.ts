import { describe, expect, it } from "vitest";
import type { MatchLike } from "../../lib/playerStats";
import type { Participation } from "../../../functions/src/matchEngine";
import { SUSPENSION_MATCHES, suspendedSet } from "./chemistry";

/** A ledger row: played (or not) and how many reds. */
const row = (o: Partial<Participation> = {}): Participation =>
  ({ played: true, redCards: 0, doubleYellows: 0, dismissed: false, ...o }) as Participation;

describe("suspendedSet", () => {
  it("a red card (event) in the last match: out of the next one", () => {
    const matches: MatchLike[] = [
      { status: "finished", events: [{ type: "goal", playerId: "a" }, { type: "red_card", playerId: "b" }] },
      { status: "finished", events: [{ type: "assist", playerId: "a" }] },
    ];
    const susp = suspendedSet(matches);
    expect(susp.has("b")).toBe(true);
    expect(susp.has("a")).toBe(false);
  });

  it("served after the team's next match, even when the player had no event in it (the ledger says he played)", () => {
    // J3: red card. J4–J8: he plays quietly (ledger only, no events). Most recent first.
    const j3: MatchLike = { status: "finished", ledger: { b: row({ redCards: 1, dismissed: true }) }, events: [{ type: "red_card", playerId: "b" }] };
    const quiet = (): MatchLike => ({ status: "finished", ledger: { b: row() }, events: [] });
    const season = [quiet(), quiet(), quiet(), quiet(), quiet(), j3];
    expect(suspendedSet(season).has("b")).toBe(false);
    // and just one team match after the red is enough, whether he was in it or not
    expect(suspendedSet([{ status: "finished", ledger: {}, events: [] }, j3]).has("b")).toBe(false);
  });

  it("the ledger alone flags a sending-off (second yellow), and scheduled or cancelled matches do not serve it", () => {
    const sent: MatchLike = { status: "finished", ledger: { c: row({ doubleYellows: 1 }) } };
    const later: MatchLike[] = [{ status: "scheduled" }, { status: "cancelled" }];
    expect(suspendedSet([...later, sent]).has("c")).toBe(true);
    expect(suspendedSet([{ status: "finished" }, ...later, sent]).has("c")).toBe(false);
  });

  it("a longer ban counts the team's matches since the red", () => {
    const red: MatchLike = { status: "finished", events: [{ type: "red_card", playerId: "d" }] };
    const next: MatchLike = { status: "finished", events: [] };
    expect(SUSPENSION_MATCHES).toBe(1);
    expect(suspendedSet([next, red], 2).has("d")).toBe(true);
    expect(suspendedSet([next, next, red], 2).has("d")).toBe(false);
  });
});
