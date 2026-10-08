// Every write of the club views, through the app's existing data layer: players and seasons via the
// optimistic mutations (useAdminMutations), roles via AuthContext.updateUserRole (super admin protected),
// archive via the setSeasonArchived callable, fichas via resolvePlayerClaim, and the club content / player
// stories the way the old editor wrote them (one batch). The views call these from toast.defer() commits.
import { useMemo } from "react";
import { arrayUnion, collection, doc, writeBatch } from "firebase/firestore";
import { db } from "../../../firebase";
import { useAuth } from "../../../context/AuthContext";
import { resolvePlayerClaim, setSeasonArchived } from "../../../lib/clubApi";
import type { ClubContent } from "../../../lib/clubContent";
import { useDeletePlayer, useDeleteSeason, useUpsertPlayer, useUpsertSeason } from "../useAdminMutations";
import type { PlayerStory } from "./contentModel";
import type { CopyEntry } from "./seasonsLogic";

export interface ClubWrites {
  /** A new players/{id} id (the alta knows its id before the write, for the undo window). */
  newPlayerId: () => string;
  /** players/{id} merge (creates it when new). */
  savePlayer: (id: string, data: Record<string, unknown>) => Promise<void>;
  deletePlayer: (id: string) => Promise<void>;
  /** seasons/{id} merge. */
  saveSeason: (id: string, data: Record<string, unknown>) => Promise<void>;
  deleteSeason: (id: string) => Promise<void>;
  /** Creates a season (in preparation, no captain) and, optionally, signs `copy` up for it. Returns its id. */
  createSeason: (name: string, copy: readonly CopyEntry[]) => Promise<string>;
  setArchived: (seasonId: string, archived: boolean) => Promise<void>;
  setRole: (uid: string, email: string, role: "admin" | "user") => Promise<void>;
  resolveClaim: (uid: string, approve: boolean) => Promise<void>;
  /** clubContent/main (whole document) and the player stories, in one batch. */
  publishContent: (content: ClubContent | null, stories: readonly { id: string; data: PlayerStory }[]) => Promise<void>;
}

export function useClubWrites(): ClubWrites {
  const upsertPlayer = useUpsertPlayer().mutateAsync;
  const removePlayer = useDeletePlayer().mutateAsync;
  const upsertSeason = useUpsertSeason().mutateAsync;
  const removeSeason = useDeleteSeason().mutateAsync;
  const { updateUserRole } = useAuth();
  return useMemo<ClubWrites>(
    () => ({
      newPlayerId: () => doc(collection(db, "players")).id,
      savePlayer: (id, data) => upsertPlayer({ id, data }),
      deletePlayer: (id) => removePlayer(id),
      saveSeason: (id, data) => upsertSeason({ id, data }),
      deleteSeason: (id) => removeSeason(id),
      createSeason: async (name, copy) => {
        const ref = doc(collection(db, "seasons"));
        const batch = writeBatch(db);
        batch.set(ref, { name, captainPlayerId: "", createdAt: new Date() });
        for (const e of copy) batch.update(doc(db, "players", e.id), { seasons: arrayUnion(ref.id), [`seasonDetails.${ref.id}`]: { shirtName: e.shirtName, number: e.number } });
        await batch.commit();
        return ref.id;
      },
      setArchived: async (seasonId, archived) => {
        await setSeasonArchived({ seasonId, archived });
      },
      setRole: async (uid, email, role) => {
        await updateUserRole(uid, email, role);
      },
      resolveClaim: async (uid, approve) => {
        await resolvePlayerClaim({ uid, approve });
      },
      publishContent: async (content, stories) => {
        const batch = writeBatch(db);
        if (content) batch.set(doc(db, "clubContent", "main"), content);
        for (const s of stories) batch.set(doc(db, "players", s.id), s.data, { merge: true });
        await batch.commit();
      },
    }),
    [upsertPlayer, removePlayer, upsertSeason, removeSeason, updateUserRole],
  );
}
