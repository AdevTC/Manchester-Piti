// HOY Y PARTIDOS · every match of the sala with its phase, its carril and the station that matters now, worked out
// once per render the same way the match's own head does (partido/PartidoLayout): Hoy, the season's table and ⌘K read
// it from here.
import { useMemo } from "react";
import { dateMillis } from "../../../../../functions/src/matchEngine";
import type { ActaReview, AdminMatch } from "../../data/adminLogic";
import type { AdminData } from "../../data/useAdminData";
import { useWhistled } from "../../data/whistleStore";
import { carrilPhase, stationOf, stationsOf, type CarrilPhase, type StationView } from "../../partido/carril";
import type { Station } from "../../../../lib/adminUrls";

export interface MatchRowView {
  m: AdminMatch;
  t: number;
  phase: CarrilPhase;
  review: ActaReview;
  stations: StationView[];
  /** The station that matters now (its address without a station). */
  station: Station;
}

export function matchRowsOf(data: Pick<AdminData, "matches" | "published" | "now" | "reviewOf" | "next">, whistled: ReadonlySet<string>): MatchRowView[] {
  const finals = new Set(data.published.filter((p) => p.status === "finished").map((p) => p.id));
  return data.matches.map((m) => {
    const publishedFinal = finals.has(m.id);
    const w = whistled.has(m.id);
    const phase = carrilPhase(m, data.now, w, publishedFinal);
    const review = data.reviewOf(m);
    const rsvp = data.next?.match.id === m.id ? data.next.rsvp : null;
    const mvpOpen = phase === "publicado" && (m.voteClosesAt ?? 0) > data.now;
    const stations = stationsOf({ match: m, now: data.now, whistled: w, review, rsvp, mvpOpen, publishedFinal });
    return { m, t: dateMillis(m.date), phase, review, stations, station: stationOf(phase) };
  });
}

/** The sala's matches as rows (oldest first, as data.matches). */
export function useMatchRows(data: AdminData): MatchRowView[] {
  const whistled = useWhistled();
  return useMemo(() => matchRowsOf(data, whistled), [data, whistled]);
}
