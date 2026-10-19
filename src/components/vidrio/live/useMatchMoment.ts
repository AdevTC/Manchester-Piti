// The moment to show now: a play (or a turn of the clock) that appeared while this screen was already showing the
// match AND happened right now (lib/derived/moments isFreshMoment). It generalises useGoalCelebration to every
// kind: what was already in the data when the match was first shown, and what arrives late (a stale cache, a
// sync after being offline), is just data. The latest fresh one holds for `hold` ms (the rótulo's ~9 s); a newer
// one takes its place and starts the hold again. Derived while rendering, so the score and the rótulo change in
// the same render as the play.
import { useEffect, useState } from "react";
import { nameFor, useClubData, type ClubMatch } from "../../../lib/clubData";
import { isFreshMoment, momentsOf, type MatchMoment } from "../../../lib/derived/moments";

/** How long a moment's rótulo stays unfolded. */
export const MOMENT_HOLD_MS = 9000;

export interface MatchMomentOptions {
  /** How long a moment is shown, in ms (default MOMENT_HOLD_MS). */
  hold?: number;
  /** False: new moments are taken as seen but never shown (the score is not confirmed by the server). */
  celebrate?: boolean;
}

interface Seen {
  match: string | undefined;
  ids: ReadonlySet<string>;
}

/** `match` is the match being shown (live, waiting for its whistle or just finished), undefined when none. */
export function useMatchMoment(match: ClubMatch | undefined, now: number, opts: MatchMomentOptions = {}): MatchMoment | null {
  const { hold = MOMENT_HOLD_MS, celebrate = true } = opts;
  const { players } = useClubData();
  const nameOf = (id: string) => nameFor(players.find((p) => p.id === id), match?.seasonId);
  const all = match ? momentsOf(match, nameOf) : [];
  const [seen, setSeen] = useState<Seen>(() => ({ match: match?.id, ids: new Set(all.map((x) => x.moment.id)) }));
  const [shown, setShown] = useState<{ id: string | null; n: number }>({ id: null, n: 0 });

  if (seen.match !== match?.id) {
    // Another match (or none): whatever it already has is not new.
    setSeen({ match: match?.id, ids: new Set(all.map((x) => x.moment.id)) });
    if (shown.id) setShown({ id: null, n: shown.n });
  } else if (match) {
    const news = all.filter((x) => !seen.ids.has(x.moment.id));
    if (news.length) {
      setSeen({ match: seen.match, ids: new Set([...seen.ids, ...news.map((x) => x.moment.id)]) });
      const fresh = celebrate ? news.filter((x) => isFreshMoment(x, match, now)) : [];
      const latest = fresh.at(-1);
      if (latest) setShown((s) => ({ id: latest.moment.id, n: s.n + 1 }));
    }
  }

  const { id, n } = shown;
  useEffect(() => {
    if (!id) return;
    const t = window.setTimeout(() => setShown((s) => (s.n === n ? { id: null, n } : s)), hold);
    return () => window.clearTimeout(t);
  }, [id, n, hold]);

  // (read from the data now: a play undone in the meantime is gone, a scorer filled in later shows)
  return id ? (all.find((x) => x.moment.id === id)?.moment ?? null) : null;
}
