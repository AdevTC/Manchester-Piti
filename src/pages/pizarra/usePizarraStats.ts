import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import { computeStats, type MatchLike, type PlayerStats, type StatEvent } from "../../lib/playerStats";
import { recentForm, squadNorms, suspendedSet, type SquadNorms } from "./chemistry";

interface RawMatch extends MatchLike {
  date?: { seconds: number } | string | number | null;
}

export interface PizarraStats {
  statsById: Map<string, PlayerStats>;
  norms: SquadNorms;
  form: Map<string, number>;
  suspended: Set<string>;
  loading: boolean;
}

const EMPTY_STATS: PlayerStats = {
  goals: 0, assists: 0, yellowCards: 0, redCards: 0, doubleYellows: 0, woodwork: 0,
  penaltySaved: 0, goalPenalty: 0, goalFreekick: 0, penaltyMissed: 0, ownGoals: 0, matchesPlayed: 0,
};

/** Realtime per-season match stats for the board's chemistry layer. Subscribes
 *  to the season's matches (with events, date-desc) and derives the maps the
 *  chemistry needs. Separate from useSeasonMatches (which feeds the official
 *  picker and carries no events). */
export function usePizarraStats(seasonId: string, players: { id: string; seasonsCount: number }[]): PizarraStats {
  const [feed, setFeed] = useState<{ seasonId: string; matches: MatchLike[] }>({ seasonId: "", matches: [] });
  const loaded = feed.seasonId === seasonId;

  useEffect(() => {
    const ref = collection(db, "matches");
    const q =
      seasonId === "all"
        ? query(ref, orderBy("date", "desc"))
        : query(ref, where("seasonId", "==", seasonId), orderBy("date", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const matches: MatchLike[] = snap.docs.map((d) => {
          const m = d.data() as RawMatch;
          return { events: (m.events as StatEvent[]) ?? [] };
        });
        setFeed({ seasonId, matches });
      },
      (err) => {
        console.error("Error cargando stats de partidos:", err);
        setFeed({ seasonId, matches: [] });
      },
    );
    return () => unsub();
  }, [seasonId]);

  const matches = useMemo(() => (loaded ? feed.matches : []), [loaded, feed.matches]);

  return useMemo(() => {
    const statsById = new Map<string, PlayerStats>();
    players.forEach((p) => statsById.set(p.id, computeStats(p.id, matches)));
    const norms = squadNorms(players.map((p) => ({ s: statsById.get(p.id) ?? EMPTY_STATS, seasons: p.seasonsCount })));
    return { statsById, norms, form: recentForm(matches), suspended: suspendedSet(matches), loading: !loaded };
  }, [matches, players, loaded]);
}
