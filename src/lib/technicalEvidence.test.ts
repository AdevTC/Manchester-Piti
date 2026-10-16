import { describe, expect, it } from "vitest";
import { TECH_KEYS } from "../../functions/src/matchAnalysis";
import type { ClubMatch, MatchEvent } from "./clubData";
import { technicalAnalysis } from "./technicalAnalysis";
import { technicalEvidence } from "./technicalEvidence";

const events: MatchEvent[] = [
  { id: "p", type: "pass", playerId: "a", receiverId: "b", outcome: "complete", minute: 1 },
  { id: "f", type: "pass", playerId: "a", outcome: "incomplete", minute: 2 },
  { id: "g", type: "goal", playerId: "b", assistPlayerId: "a", minute: 3 },
  { id: "i", type: "interception", playerId: "b", minute: 4 },
  { id: "u", type: "shot", playerId: "b", outcome: "unknown", timingUnknown: true },
  { id: "r", type: "pass", team: "opponent", outcome: "incomplete", minute: 5 },
];
const matches: ClubMatch[] = [{ id: "m", date: 100, events: [...events, events[0]] }, { id: "n", date: 200, events }];
describe("the source of a technical figure", () => {
  it("reconciles every metric with the counting engine, including goals as shots and passes as losses", () => {
    const stats = technicalAnalysis(matches);
    for (const metric of TECH_KEYS) {
      for (const side of ["us", "opponent"] as const) expect(technicalEvidence(matches, { metric, side }).reduce((n, r) => n + r.contribution, 0), `${side}/${metric}`).toBe(stats.teams[side][metric]);
      for (const playerId of ["a", "b"]) expect(technicalEvidence(matches, { metric, playerId }).reduce((n, r) => n + r.contribution, 0), `${playerId}/${metric}`).toBe(stats.players[playerId][metric]);
    }
    expect(technicalEvidence(matches, { metric: "turnovers", playerId: "a" }).map(r => r.event.id)).toEqual(["f", "f"]);
    expect(technicalEvidence(matches, { metric: "shotsOnTarget", playerId: "b" }).map(r => r.event.id)).toEqual(["g", "g"]);
  });
  it("keeps match identity, recipients and unknown times, without mixing opponents", () => {
    expect(technicalEvidence(matches, { metric: "passesReceived", playerId: "b" }).map(r => `${r.match.id}/${r.event.id}`)).toEqual(["n/p", "m/p"]);
    expect(technicalEvidence(matches, { metric: "passesCompleted", playerId: "a", receiverId: "b" })).toHaveLength(2);
    expect(technicalEvidence(matches, { metric: "passesCompleted", playerId: "a", receiverId: "a" })).toEqual([]);
    expect(technicalEvidence(matches, { metric: "shots" })[1].event).toMatchObject({ id: "u", timingUnknown: true });
  });
});
