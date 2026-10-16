// Convocar's own realtime reads: the members' answers (Voy / Duda / No va) to the match on screen — the
// vestuario's shared listener (one onSnapshot per match, whoever reads it) — and the team's absences, for
// the «Ausente · hasta 19 oct» badges (the vestuario's shared absences listener). Apart so tests replace them.
import { useAbsences, useAvailability, type Availability } from "../../vestuario/live";
import type { Absence } from "../../../lib/derived/absences";

export function useMatchAnswers(matchId: string | undefined): { data: Availability[]; loading: boolean } {
  const q = useAvailability(matchId);
  return { data: q.data, loading: q.loading };
}

/** The team's absences ending on `today` (Madrid `YYYY-MM-DD`) or later. */
export function useTeamAbsences(today: string): Absence[] {
  return useAbsences(today, true).data;
}
