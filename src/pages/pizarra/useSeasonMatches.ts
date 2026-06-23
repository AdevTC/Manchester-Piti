import { useMemo } from "react";
import { collection, orderBy, query } from "firebase/firestore";
import { db } from "../../firebase";
import { type SeasonMatchDoc } from "../../lib/schemas";
import { useFirestoreCollection } from "../../lib/useFirestoreCollection";
import { mapMatch } from "../../lib/firestoreMappers";

/** A match, reduced to what the official-scope picker needs to label it. */
export interface SeasonMatch {
  id: string;
  rival: string;
  goalsFor: number | null;
  goalsAgainst: number | null;
  dateMs: number | null;
}

// Canonical key + mapper: ONE subscription to all matches (date desc), shared
// with MatchCenter/Stats/Expedientes/pizarra. Per-season filtering happens in
// memory below, so every page that reads `matches` costs a single listener.
const MATCHES_KEY = ["matches"] as const;
const matchesQuery = query(collection(db, "matches"), orderBy("date", "desc"));

function dateToMs(v: SeasonMatchDoc["date"]): number | null {
  if (v == null) return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : t;
  }
  if (v instanceof Date) return v.getTime();
  if (typeof v === "object" && "toMillis" in v) return v.toMillis();
  if (typeof v === "object" && "seconds" in v) return v.seconds * 1000;
  return null;
}

/** Realtime matches for the active season (admins only consume this). */
export function useSeasonMatches(seasonId: string): { matches: SeasonMatch[]; loading: boolean } {
  const { data, isPending } = useFirestoreCollection(MATCHES_KEY, matchesQuery, mapMatch);

  const matches = useMemo<SeasonMatch[]>(() => {
    const all = data ?? [];
    const inSeason = seasonId === "all" ? all : all.filter((m) => m.seasonId === seasonId);
    return inSeason.map((m) => ({
      id: m.id,
      rival: m.rival || "Rival",
      goalsFor: typeof m.goalsFor === "number" ? m.goalsFor : null,
      goalsAgainst: typeof m.goalsAgainst === "number" ? m.goalsAgainst : null,
      dateMs: dateToMs(m.date),
    }));
  }, [data, seasonId]);

  return { matches, loading: isPending };
}

/** A human label for a match, e.g. "vs Rival · 12 may · 3-1". */
export function matchLabel(m: SeasonMatch): string {
  const date = m.dateMs != null ? new Date(m.dateMs).toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : null;
  const score = m.goalsFor != null && m.goalsAgainst != null ? `${m.goalsFor}-${m.goalsAgainst}` : null;
  return ["vs " + m.rival, date, score].filter(Boolean).join(" · ");
}
