// Turnos del equipo in the Sala de control: the captains' direct writes, as firestore.rules checks them
// (admin; the rota signed and stamped by the server; a match's overrides { playerId, swappedFrom?, at }).
import { useMemo } from "react";
import { deleteField, doc, FieldPath, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../../firebase";
import { useAuth } from "../../../context/AuthContext";
import type { RotaJob } from "../../../lib/derived/rota";

export interface TurnosWrites {
  /** rotas/{seasonId}: the season's jobs and their order. */
  saveRota: (seasonId: string, jobs: readonly RotaJob[]) => Promise<void>;
  /** rotaTurns/{matchId}[jobId]: who does it in this match (a swap, or «Lo hizo otro»). */
  pin: (matchId: string, jobId: string, playerId: string, swappedFrom: string | null) => Promise<void>;
  /** Back to the rota's turn for this job in this match. */
  unpin: (matchId: string, jobId: string) => Promise<void>;
}

export function useTurnosWrites(): TurnosWrites {
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  return useMemo<TurnosWrites>(
    () => ({
      saveRota: async (seasonId, jobs) => {
        if (!uid) throw new Error("Sin sesión de capitán");
        const clean = jobs.map((j) => ({ id: j.id, name: j.name.trim(), icon: j.icon, awayOnly: j.awayOnly, order: [...j.order] }));
        await setDoc(doc(db, "rotas", seasonId), { jobs: clean, updatedAt: serverTimestamp(), updatedBy: uid });
      },
      pin: async (matchId, jobId, playerId, swappedFrom) => {
        const turn = { playerId, at: serverTimestamp(), ...(swappedFrom && swappedFrom !== playerId ? { swappedFrom } : {}) };
        // (the whole entry replaced: a swap back drops the old `swappedFrom`)
        await setDoc(doc(db, "rotaTurns", matchId), { [jobId]: turn }, { mergeFields: [new FieldPath(jobId)] });
      },
      unpin: async (matchId, jobId) => {
        await setDoc(doc(db, "rotaTurns", matchId), { [jobId]: deleteField() }, { merge: true });
      },
    }),
    [uid],
  );
}
