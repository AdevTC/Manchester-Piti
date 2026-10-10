// Convocar's own realtime read: the members' answers (Voy / Duda / No va) to the match on screen — the
// vestuario's shared listener (one onSnapshot per match, whoever reads it). Apart so tests replace it.
import { useAvailability, type Availability } from "../../vestuario/live";

export function useMatchAnswers(matchId: string | undefined): { data: Availability[]; loading: boolean } {
  const q = useAvailability(matchId);
  return { data: q.data, loading: q.loading };
}
