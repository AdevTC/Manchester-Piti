// Turnos del equipo in the Sala de control: the captains' direct writes, as firestore.rules checks them
// (admin; the rota signed and stamped by the server; a match's overrides { playerId, swappedFrom?, at },
// with its seasonId for the season's query). A frozen match (played: the backend's `frozen: true`) keeps
// its flag and every turn: a captain only changes who did one.
import { useMemo } from "react";
import { deleteField, doc, FieldPath, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../../firebase";
import { useAuth } from "../../../context/AuthContext";
import type { RotaJob } from "../../../lib/derived/rota";

export interface TurnosWrites {
  /** rotas/{seasonId}: the season's jobs and their order. */
  saveRota: (seasonId: string, jobs: readonly RotaJob[]) => Promise<void>;
  /** rotaTurns/{matchId}[jobId]: who does it in this match (a swap, or «Lo hizo otro»). */
  pin: (matchId: string, seasonId: string, jobId: string, playerId: string, swappedFrom: string | null) => Promise<void>;
  /** Back to the rota's turn for this job in this match (not on a frozen match: pin its `swappedFrom`). */
  unpin: (matchId: string, seasonId: string, jobId: string) => Promise<void>;
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
      pin: async (matchId, seasonId, jobId, playerId, swappedFrom) => {
        const turn = { playerId, at: serverTimestamp(), ...(swappedFrom && swappedFrom !== playerId ? { swappedFrom } : {}) };
        // (the whole entry replaced: a swap back drops the old `swappedFrom`; `frozen` is left as it is)
        await setDoc(doc(db, "rotaTurns", matchId), { seasonId, [jobId]: turn }, { mergeFields: ["seasonId", new FieldPath(jobId)] });
      },
      unpin: async (matchId, seasonId, jobId) => {
        await setDoc(doc(db, "rotaTurns", matchId), { seasonId, [jobId]: deleteField() }, { merge: true });
      },
    }),
    [uid],
  );
}
