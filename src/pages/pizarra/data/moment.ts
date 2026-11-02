// r14 · «La jugada de verdad» (PZ-D21J / PZ-D23F): a play links the acta's moment it happened in —
// `play.moment = { matchId, min, eventId? }` (lib/schemas playMomentSchema), beside its `video` — and is named
// «J2 · 23′ · gol de ALCIDES»; the clip export carries that minute and the score at it. Pure.
import type { Play, PlayMoment } from "../../../lib/schemas";

/** What these helpers read of an acta event (a MatchEvent is one). */
export interface MomentEvent {
  id: string;
  type: string;
  minute?: number | null;
  playerId?: string | null;
}

/** The acta's event types (functions/src/matchEngine.ts EVENT_LABELS) a play can be, in words. */
const KIND: Record<string, string> = {
  goal: "gol",
  goal_penalty: "gol de penalti",
  goal_freekick: "gol de falta",
  opponent_own_goal: "autogol de ellos",
  own_goal: "gol en propia",
  opponent_goal: "gol de ellos",
  penalty_received: "penalti a favor",
  penalty_committed: "penalti en contra",
  penalty_missed: "penalti fallado",
  penalty_saved: "penalti parado",
  woodwork: "al palo",
  chance: "ocasión",
  opponent_chance: "ocasión de ellos",
  corner: "córner",
  opponent_corner: "córner de ellos",
};
const FOR = new Set(["goal", "goal_penalty", "goal_freekick", "opponent_own_goal"]);
const AGAINST = new Set(["opponent_goal", "own_goal"]);
const THEIRS = new Set(["opponent_goal", "opponent_own_goal", "opponent_chance", "opponent_corner"]);

/** The events a play can be tied to (goals, chances, saves, penalties…), in minute order. */
export function actaMoments<E extends MomentEvent>(events: readonly E[]): E[] {
  return events.filter((e) => e.type in KIND && typeof e.minute === "number").sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));
}

/** «J2 · 23′ · gol de ALCIDES» (`jornada` null → no «J»; an unknown event → just the minute). */
export function momentLabel(m: PlayMoment, o: { jornada: number | null; event?: MomentEvent | null; name: (playerId: string) => string }): string {
  const parts = [o.jornada ? "J" + o.jornada : "", m.min + "′"];
  const e = o.event && o.event.id === m.eventId ? o.event : null;
  if (e) {
    const what = KIND[e.type] ?? "";
    const who = e.playerId && !THEIRS.has(e.type) ? " de " + o.name(e.playerId) : "";
    if (what) parts.push(what + who);
  }
  return parts.filter(Boolean).join(" · ");
}

/** The score at the moment (goals for/against up to and including that minute), for the clip's caption. */
export function scoreAt(events: readonly MomentEvent[], min: number): { gf: number; ga: number } {
  let gf = 0;
  let ga = 0;
  events.forEach((e) => {
    if (typeof e.minute !== "number" || e.minute > min) return;
    if (FOR.has(e.type)) gf++;
    else if (AGAINST.has(e.type)) ga++;
  });
  return { gf, ga };
}

/** The play tied to a moment (or untied: null). The same object when nothing changes. */
export function setPlayMoment(play: Play, m: PlayMoment | null): Play {
  if (!m) {
    if (!play.moment) return play;
    const { moment: _drop, ...rest } = play;
    return rest;
  }
  const next = { matchId: m.matchId, min: Math.max(0, Math.round(m.min)), ...(m.eventId ? { eventId: m.eventId } : {}) };
  if (play.moment && play.moment.matchId === next.matchId && play.moment.min === next.min && play.moment.eventId === next.eventId) return play;
  return { ...play, moment: next };
}
