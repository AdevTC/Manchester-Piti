// The vestuario at a glance, as the hub's door and the vestuario's own hub need it (CL- boards): the next match's
// convocatoria (my answer and everyone's counts), my share of la caja (and a «Ya la he pagado» still waiting), my
// turno for that match and, for a captain, who is knocking. Every read opens only for a member (a fan opens none).
import type { ClubMatch } from "../../../lib/clubData";
import { balances } from "../../../lib/derived/caja";
import { useMatchTurns } from "../../../lib/useRotaTurns";
import { useAvailability, useCaja, useDoorRequests, useMyCajaClaims } from "../live";

export interface VxSummaryIn {
  /** A member of the vestuario is signed in (reads open). */
  on: boolean;
  uid: string;
  playerId: string | null;
  admin: boolean;
  next: ClubMatch | undefined;
  matches: readonly ClubMatch[];
  seasonId: string;
  /** The season's squad (who can answer). */
  squad: number;
}

export function useVxSummary({ on, uid, playerId, admin, next, matches, seasonId, squad }: VxSummaryIn) {
  const av = useAvailability(on ? next?.id : undefined);
  const caja = useCaja(seasonId, on);
  const claims = useMyCajaClaims(on && uid ? uid : undefined);
  const turns = useMatchTurns(next, matches, on);
  const knock = useDoorRequests(on && admin);
  const mine = av.data.find((a) => a.uid === uid)?.response;
  const count = (r: "yes" | "maybe" | "no") => av.data.filter((a) => a.response === r).length;
  const balance = playerId ? (balances(caja.movs).get(playerId) ?? 0) : 0;
  const claim = claims.data.find((c) => c.status === "pendiente" && c.seasonId === seasonId) ?? null;
  const myTurn = playerId ? (turns.turns.find((t) => t.playerId === playerId) ?? null) : null;
  return {
    answers: av.data,
    mine,
    yes: count("yes"),
    maybe: count("maybe"),
    no: count("no"),
    pending: Math.max(0, squad - av.data.length),
    caja,
    balance,
    claim,
    /** He owes the caja and has not said he paid. */
    owes: !!playerId && balance < 0 && !claim,
    turns: turns.turns,
    myTurn,
    knocking: knock.data,
    loading: av.loading,
  };
}
export type VxSummary = ReturnType<typeof useVxSummary>;
