// The few per-match realtime reads the match views need beyond useAdmin(): the private meeting note
// (matchPrivate), the members' RSVP (availability) and the MVP tally. They reuse the vestuario's shared
// listeners (one onSnapshot per key, whoever reads it); kept in one module so tests mock it in one place.
import { useAvailability, useMeetingNote, useMvpResults } from "../../vestuario/live";
import type { MvpResult } from "../../../lib/vestuario";

export interface LiveValue<T> {
  data: T;
  loading: boolean;
}
/** The match's private note (quedada, camiseta…): matchPrivate/{id}.meetingNote. */
export function useMatchNote(matchId: string | undefined): LiveValue<string> {
  const q = useMeetingNote(matchId);
  return { data: q.data, loading: q.loading };
}
export interface Rsvp {
  playerId: string | null;
  response: "yes" | "no" | "maybe";
}
/** The members' answers (Voy / Duda / No va) for the match. */
export function useMatchRsvp(matchId: string | undefined): LiveValue<Rsvp[]> {
  const q = useAvailability(matchId);
  return { data: q.data, loading: q.loading };
}
/** The MVP tally of a match (undefined until there is one). */
export function useMatchMvp(matchId: string | undefined): MvpResult | undefined {
  const all = useMvpResults();
  return matchId ? all.get(matchId) : undefined;
}
