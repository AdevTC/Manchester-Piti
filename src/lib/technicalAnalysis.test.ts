import { describe, expect, it } from "vitest";
import type { ClubMatch } from "./clubData";
import { hasAnalysisActions } from "./technicalAnalysis";

// When the analysis panel shows: narrated football actions, not the acta's goals, cards and subs.

const match = (events: ClubMatch["events"]): ClubMatch => ({ id: "m", seasonId: "t1", events });

describe("hasAnalysisActions", () => {
  it("an old match with no events, or none at all: nothing to analyse", () => {
    expect(hasAnalysisActions([])).toBe(false);
    expect(hasAnalysisActions([{ id: "m" }])).toBe(false);
    expect(hasAnalysisActions([match([])])).toBe(false);
  });

  it("goals, cards, subs and the live board's chances and corners are the acta, not an analysis", () => {
    const acta = match([
      { id: "g", type: "goal", playerId: "p1", minute: 3 },
      { id: "r", type: "opponent_goal", minute: 9 },
      { id: "y", type: "yellow_card", playerId: "p2", minute: 12 },
      { id: "s", type: "substitution", playerId: "p2", inPlayerId: "p3", minute: 25 },
      { id: "c", type: "chance", playerId: "p1", minute: 30 },
      { id: "k", type: "corner", minute: 31 },
    ]);
    expect(hasAnalysisActions([acta])).toBe(false);
  });

  it("one narrated action in any of the matches is enough — ours or the rival's", () => {
    expect(hasAnalysisActions([match([]), match([{ id: "a", type: "pass", outcome: "complete", playerId: "p1", minute: 4 }])])).toBe(true);
    expect(hasAnalysisActions([match([{ id: "a", type: "shot", outcome: "off_target", team: "opponent", minute: 4 }])])).toBe(true);
  });

  it("for one player: an action he made or a pass he received, not someone else's", () => {
    const m = match([{ id: "a", type: "pass", outcome: "complete", playerId: "p1", receiverId: "p2", minute: 4 }]);
    expect(hasAnalysisActions([m], "p1")).toBe(true);
    expect(hasAnalysisActions([m], "p2")).toBe(true);
    expect(hasAnalysisActions([m], "p3")).toBe(false);
    // (his goal alone is the acta)
    expect(hasAnalysisActions([match([{ id: "g", type: "goal", playerId: "p3", minute: 8 }])], "p3")).toBe(false);
  });
});
