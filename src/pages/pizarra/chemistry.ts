// Who is out of the next match for a sending-off or a sanction set by hand. Pure (no React).
import { dateMillis } from "../../../functions/src/matchEngine";
import type { MatchLike } from "../../lib/playerStats";

/** Team matches a red card (or a second yellow) keeps a player out of. */
export const SUSPENSION_MATCHES = 1;

/** A match that counts: finished (legacy docs without a status were all finished ones). */
const played = (m: MatchLike): boolean => !m.status || m.status === "finished";

/** The players sent off in a match: its ledger (the computed acta) and its events. */
function sentOff(m: MatchLike): Set<string> {
  const out = new Set<string>();
  for (const [id, row] of Object.entries(m.ledger ?? {})) {
    if ((row.redCards ?? 0) > 0 || (row.doubleYellows ?? 0) > 0 || row.dismissed) out.add(id);
  }
  for (const ev of m.events ?? []) {
    if (ev.playerId && (ev.type === "red_card" || ev.type === "double_yellow")) out.add(ev.playerId);
  }
  return out;
}

/**
 * A sanction set by hand in Admin → Plantilla (players/{id}.sanction). `games` team matches from `from`
 * (ms, when it was set), or — with `untilMatchId` — until that match is played. Absent optional fields are
 * stored as null (a merge write keeps an old map's keys otherwise).
 */
export interface Sanction {
  games: number;
  from: number;
  untilMatchId?: string | null;
  reason?: string | null;
  by?: string | null;
}
/** What the derivation reads from a player: his manual sanction and when an admin last lifted one. */
export interface SanctionHolder {
  id: string;
  sanction?: Sanction | null;
  /** «Levantar la sanción» (ms): sendings-off in matches dated at or before it no longer count. */
  sanctionClearedAt?: number | null;
}
/** A match as the derivation reads it (the acta plus its id and date). */
export type SuspensionMatch = MatchLike & { id?: string; date?: unknown };
/** One player's suspension: how many team matches he still misses, and why. */
export interface Suspension {
  /** Team matches still to serve (≥ 1). */
  left: number;
  /** «manual» when a sanction set by hand is (also) running, else the acta's red card. */
  source: "acta" | "manual";
  /** The manual sanction's reason («Federación»), when it has one. */
  reason?: string;
  /** The manual sanction runs until this match is played. */
  untilMatchId?: string;
}

const ms = (m: SuspensionMatch): number => dateMillis(m.date);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const text = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/**
 * Team matches a manual sanction still keeps him out of (0 = served). By count: `games` minus the team's
 * finished matches dated strictly after `from` (scheduled and cancelled ones serve nothing). Until a match:
 * 0 once it is played, else the team's matches still to play after `from` up to it (at least 1); a match
 * that is not there (another season, deleted) or was cancelled falls back to the count.
 */
export function manualLeft(s: Sanction, matches: readonly SuspensionMatch[]): number {
  const from = num(s.from);
  const games = num(s.games);
  if (from == null || games == null) return 0;
  const until = text(s.untilMatchId) ? matches.find((m) => m.id === s.untilMatchId) : undefined;
  if (until && until.status !== "cancelled") {
    if (played(until)) return 0;
    const end = ms(until);
    const toPlay = matches.filter((m) => !played(m) && m.status !== "cancelled" && ms(m) > from && !(ms(m) > end)).length;
    return Math.max(1, toPlay);
  }
  const served = matches.filter((m) => played(m) && ms(m) > from).length;
  return Math.max(0, Math.round(games) - served);
}

/**
 * Every player still out, with what is left: (a) the acta — sent off in one of the team's last `games`
 * finished matches (most-recent-first), unless an admin lifted it afterwards (`sanctionClearedAt` at or after
 * that match's date) — and (b) a sanction set by hand with matches left (manualLeft). Both count the TEAM's
 * matches, whether or not the player shows up in them, so they always clear. Admin-set statuses (injured,
 * inactive) are kept apart by the caller. `matchesByDateDesc`: the season's matches, newest first.
 */
export function suspensions(
  matchesByDateDesc: readonly SuspensionMatch[],
  players: readonly SanctionHolder[] = [],
  games = SUSPENSION_MATCHES,
): Map<string, Suspension> {
  const out = new Map<string, Suspension>();
  const cleared = new Map<string, number>();
  for (const p of players) {
    const at = num(p.sanctionClearedAt);
    if (at != null) cleared.set(p.id, at);
  }
  const finished = matchesByDateDesc.filter(played).slice(0, Math.max(0, games));
  finished.forEach((m, i) => {
    const t = ms(m);
    for (const id of sentOff(m)) {
      const c = cleared.get(id);
      // lifted after this match (a match without a date can't be placed: lifting clears it too)
      if (c != null && !(t > c)) continue;
      const left = games - i;
      if ((out.get(id)?.left ?? 0) < left) out.set(id, { left, source: "acta" });
    }
  });
  for (const p of players) {
    if (!p.sanction) continue;
    const left = manualLeft(p.sanction, matchesByDateDesc);
    if (left <= 0) continue;
    const reason = text(p.sanction.reason);
    const until = text(p.sanction.untilMatchId);
    out.set(p.id, {
      left: Math.max(left, out.get(p.id)?.left ?? 0),
      source: "manual",
      ...(reason ? { reason } : {}),
      ...(until ? { untilMatchId: until } : {}),
    });
  }
  return out;
}

/** The ids of suspensions(): who can't be placed on the board. */
export function suspendedSet(matchesByDateDesc: readonly SuspensionMatch[], games = SUSPENSION_MATCHES, players: readonly SanctionHolder[] = []): Set<string> {
  return new Set(suspensions(matchesByDateDesc, players, games).keys());
}
