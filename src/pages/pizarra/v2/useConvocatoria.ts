// The convocatoria on the cromos: the members' answers (Voy / Duda / No va) to the board's match — the
// linked one, else the next — read from the vestuario's shared subscription (no extra listener when
// the vestuario already has it open).
import { useMemo } from "react";
import { useAvailability } from "../../vestuario/live";
import type { Convocatoria } from "./model";
import { convocatoriaOf } from "./boards";

export interface ConvState {
  /** Answers by player id (null while there is no match to ask about). */
  conv: Map<string, Convocatoria> | null;
  loading: boolean;
  /** The answers could not be read (no access, offline…): the board goes on without them. */
  error: boolean;
}

export function useConvocatoria(matchId: string | null): ConvState {
  const q = useAvailability(matchId ?? undefined);
  const conv = useMemo(() => (matchId ? convocatoriaOf(q.data) : null), [matchId, q.data]);
  return { conv, loading: !!matchId && q.loading, error: q.error };
}
