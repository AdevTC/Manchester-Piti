import { useMutation } from "@tanstack/react-query";
import { addDoc, collection, deleteDoc, doc, setDoc } from "firebase/firestore";
import { db } from "../../firebase";

type UpsertInput = { id: string | null; data: Record<string, unknown> };

/** Edit (id set) → setDoc merge; create (id null) → addDoc. The caller builds
 *  and validates `data` (shapes/Timestamp unchanged); this only performs the write. */
function makeUpsert(coll: string) {
  return ({ id, data }: UpsertInput) =>
    id
      ? setDoc(doc(db, coll, id), data, { merge: true })
      : addDoc(collection(db, coll), data).then(() => {});
}

export const useUpsertSeason = () => useMutation({ mutationFn: makeUpsert("seasons") });
export const useDeleteSeason = () => useMutation({ mutationFn: (id: string) => deleteDoc(doc(db, "seasons", id)) });
export const useUpsertPlayer = () => useMutation({ mutationFn: makeUpsert("players") });
export const useDeletePlayer = () => useMutation({ mutationFn: (id: string) => deleteDoc(doc(db, "players", id)) });
export const useUpsertMatch  = () => useMutation({ mutationFn: makeUpsert("matches") });
export const useDeleteMatch  = () => useMutation({ mutationFn: (id: string) => deleteDoc(doc(db, "matches", id)) });
