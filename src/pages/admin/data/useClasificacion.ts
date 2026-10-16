// La clasificación in the Sala de control: the season's table read through the public listener (the same the
// home and /partidos read) and the captains' save — a direct write the rules check (admin, signed, the
// server's time; `rowsPrev` only the table it replaces or the one it already kept).
import { useMemo } from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../../firebase";
import { useAuth } from "../../../context/AuthContext";
import { standingsFields, type Standings, type StandingsInput } from "../../../lib/standings";

export { useStandings } from "../../../lib/useStandings";

export interface ClasificacionWrites {
  /** standings/{seasonId}: the table, keeping the previous one as `rowsPrev` (standingsFields decides). */
  save: (seasonId: string, input: StandingsInput, prev: Standings | null) => Promise<void>;
}

export function useClasificacionWrites(): ClasificacionWrites {
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  return useMemo<ClasificacionWrites>(
    () => ({
      save: async (seasonId, input, prev) => {
        if (!uid) throw new Error("Sin sesión de capitán");
        await setDoc(doc(db, "standings", seasonId), { ...standingsFields(input, uid, prev), updatedAt: serverTimestamp() });
      },
    }),
    [uid],
  );
}
