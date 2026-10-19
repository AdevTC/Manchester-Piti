import { technicalEvents } from '../../functions/src/narrated/compatibility';
import { analyseActions, type TechnicalStats } from "../../functions/src/matchAnalysis";
import type { ClubMatch, MatchEvent } from "./clubData";
import { dateMillis, isVisibleMatch } from "../../functions/src/matchEngine";

export interface EvidenceSelection {
  metric: keyof TechnicalStats;
  side?: "us" | "opponent";
  playerId?: string;
  receiverId?: string;
}
export interface ActionEvidence { match: ClubMatch; event: MatchEvent; contribution: number }

/** Ask the counting engine itself which actions contribute. This keeps derived metrics (a
 * goal is also a shot and a receiver earns a reception) exactly in sync. */
export function technicalEvidence(matches: readonly ClubMatch[], selection: EvidenceSelection): ActionEvidence[] {
  const evidence: ActionEvidence[] = [];
  for (const match of matches) {
    if (!isVisibleMatch(match)) continue;
    const seen = new Set<string>();
    for (const event of technicalEvents(match)) {
      if (seen.has(event.id)) continue;
      seen.add(event.id);
      if (selection.receiverId && event.receiverId !== selection.receiverId) continue;
      const counted = analyseActions([event]);
      const stats = selection.playerId ? counted.players[selection.playerId] : counted.teams[selection.side ?? "us"];
      const contribution = stats?.[selection.metric] ?? 0;
      if (contribution > 0) evidence.push({ match, event, contribution });
    }
  }
  return evidence.sort((a, b) => dateMillis(b.match.date) - dateMillis(a.match.date) || a.match.id.localeCompare(b.match.id) ||
    (a.event.elapsedSeconds ?? (a.event.minute ?? Infinity) * 60) - (b.event.elapsedSeconds ?? (b.event.minute ?? Infinity) * 60));
}
