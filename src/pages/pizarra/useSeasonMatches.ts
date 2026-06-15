import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "../../firebase";

/** A match, reduced to what the official-scope picker needs to label it. */
export interface SeasonMatch {
  id: string;
  rival: string;
  goalsFor: number | null;
  goalsAgainst: number | null;
  dateMs: number | null;
}

interface RawMatch {
  rival?: string;
  goalsFor?: number;
  goalsAgainst?: number;
  date?: { seconds: number } | string | number | null;
}

function dateToMs(v: RawMatch["date"]): number | null {
  if (v == null) return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : t;
  }
  if (typeof v === "object" && "seconds" in v) return v.seconds * 1000;
  return null;
}

/** Realtime matches for the active season (admins only consume this). */
export function useSeasonMatches(seasonId: string): { matches: SeasonMatch[]; loading: boolean } {
  const [feed, setFeed] = useState<{ seasonId: string; matches: SeasonMatch[] }>({ seasonId: "", matches: [] });
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
        const matches: SeasonMatch[] = snap.docs.map((dd) => {
          const m = dd.data() as RawMatch;
          return {
            id: dd.id,
            rival: m.rival || "Rival",
            goalsFor: typeof m.goalsFor === "number" ? m.goalsFor : null,
            goalsAgainst: typeof m.goalsAgainst === "number" ? m.goalsAgainst : null,
            dateMs: dateToMs(m.date),
          };
        });
        setFeed({ seasonId, matches });
      },
      (err) => {
        console.error("Error cargando partidos:", err);
        setFeed({ seasonId, matches: [] });
      },
    );
    return () => unsub();
  }, [seasonId]);

  const matches = useMemo(() => (loaded ? feed.matches : []), [loaded, feed.matches]);
  return { matches, loading: !loaded };
}

/** A human label for a match, e.g. "vs Rival · 12 may · 3-1". */
export function matchLabel(m: SeasonMatch): string {
  const date = m.dateMs != null ? new Date(m.dateMs).toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : null;
  const score = m.goalsFor != null && m.goalsAgainst != null ? `${m.goalsFor}-${m.goalsAgainst}` : null;
  return ["vs " + m.rival, date, score].filter(Boolean).join(" · ");
}
