// Who is out of the next match for a sending-off. Pure (no React).
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
 * The players still serving a suspension: sent off in one of the team's last `games` finished matches
 * (most-recent-first). The suspension runs on the TEAM's matches since the red card, whether or not
 * the player shows up in them, so it always clears. Admin-set statuses (injured, inactive) are kept
 * apart by the caller.
 */
export function suspendedSet(matchesByDateDesc: MatchLike[], games = SUSPENSION_MATCHES): Set<string> {
  const out = new Set<string>();
  for (const m of matchesByDateDesc.filter(played).slice(0, Math.max(0, games))) for (const id of sentOff(m)) out.add(id);
  return out;
}
