import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addDoc, collection, deleteDoc, doc, setDoc } from "firebase/firestore";
import { db } from "../../firebase";

type UpsertInput = { id: string | null; data: Record<string, unknown> };

/** Minimal shape the optimistic helpers need: the cached docs (SeasonDoc /
 *  PlayerDoc / SeasonMatchDoc) all carry a string `id`. We operate generically
 *  over `{ id }` so one pair of helpers covers all three collections. */
type WithId = { id: string };

/**
 * Pure helper: remove the doc with `id` from a cached collection array.
 * Returns a new array (never mutates the snapshot we hold for rollback).
 * `undefined`/empty in → `[]` out, so a not-yet-populated cache slot is safe.
 * Exported for unit testing.
 */
export function removeById<T extends WithId>(list: readonly T[] | undefined, id: string): T[] {
  return (list ?? []).filter((d) => d.id !== id);
}

/**
 * Pure helper: shallow-merge `data` into the existing doc with `id`, mirroring
 * Firestore's `setDoc(..., { merge: true })`. If the id isn't present (edge:
 * cache not yet hydrated), the list is returned unchanged — we do NOT insert a
 * synthetic row, so this only ever covers an *edit* of a visible doc. The merge
 * is transient: the realtime `onSnapshot` replaces it with the validated server
 * doc moments later. Exported for unit testing.
 */
export function mergeById<T extends WithId>(
  list: readonly T[] | undefined,
  id: string,
  data: Record<string, unknown>,
): T[] {
  // The `as T` is deliberately untyped: the optimistic merge can briefly hold a
  // shape that diverges from the validated doc (e.g. match `date` is a Timestamp
  // here vs the schema's accepted forms) because `data` is the raw write payload,
  // not a parsed doc. It never flows through Zod, and the `onSnapshot` replaces
  // it with the validated typed doc moments later — so this is NOT an unsafe cast.
  return (list ?? []).map((d) => (d.id === id ? ({ ...d, ...data } as T) : d));
}

/** seasons → ["seasons"], players → ["players"], matches → ["matches"]: the
 *  canonical shared-cache keys the realtime bridge writes (see
 *  src/lib/useFirestoreCollection.ts). The optimistic update patches the SAME
 *  slot every page reads. */
function keyFor(coll: string): readonly [string] {
  return [coll];
}

function makeUpsert(coll: string) {
  return ({ id, data }: UpsertInput) =>
    id
      ? setDoc(doc(db, coll, id), data, { merge: true })
      : addDoc(collection(db, coll), data).then(() => {});
}

/**
 * Context returned by an optimistic `onMutate` so `onError` can roll back.
 * Discriminated on `patched` so `prev === undefined` is unambiguous: the create
 * branch returns `{ patched: false }` (no patch applied → skip rollback), while
 * an edit/delete returns `{ patched: true, prev }` even when the cache was empty
 * (`prev: []` or `undefined`) — that patch DID happen, so the rollback must run
 * and restore the exact snapshot. The generic is dropped because every cached
 * collection is `WithId[]`.
 */
type RollbackCtx = { patched: false } | { patched: true; prev: WithId[] | undefined };

/**
 * Optimistic UPSERT (edit only). On an edit (`id` set) we shallow-merge the new
 * fields into that doc in the cached array so the change shows instantly; on a
 * create (`id` null) we do NOTHING optimistic — see the "add is deferred" note
 * below — and let the realtime snapshot insert the real-id row.
 *
 * Why no `invalidateQueries` in `onSettled` (the OPPOSITE of the usual advice):
 * the shared-cache bridge's `useQuery` has a never-resolving `queryFn` (data
 * only arrives via the onSnapshot → `setQueryData`, `staleTime: Infinity`).
 * Invalidating would mark the query stale and trigger a refetch of that
 * never-resolving fn → it would hang in `isFetching` forever. The realtime
 * subscription ALREADY reconciles with server truth after the write commits, so
 * the optimistic patch only needs to cover the write latency. → no onSettled.
 *
 * ADD is deferred on purpose: with no real id we'd have to insert a temp-id row,
 * then the onSnapshot would bring the real-id row → a brief DUPLICATE until
 * reconciliation. Edit + delete are clean (they key off an existing id); add is
 * not, so we don't ship a dup-flicker. The create still works exactly as before
 * (realtime inserts the row a beat later).
 */
function useOptimisticUpsert(coll: string) {
  const qc = useQueryClient();
  const queryKey = keyFor(coll);
  return useMutation<void, unknown, UpsertInput, RollbackCtx>({
    mutationFn: makeUpsert(coll),
    onMutate: async ({ id, data }) => {
      if (!id) return { patched: false }; // create: no optimistic patch (see above)
      await qc.cancelQueries({ queryKey });
      const prev = qc.getQueryData<WithId[]>(queryKey);
      qc.setQueryData<WithId[]>(queryKey, (old) => mergeById(old, id, data));
      return { patched: true, prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.patched) qc.setQueryData(queryKey, ctx.prev);
    },
    // onSettled intentionally omitted: the onSnapshot reconciles (no invalidate).
  });
}

/**
 * Optimistic DELETE. `onMutate` filters the row out of the cached array at once;
 * `onError` restores the snapshot. Same no-`onSettled` reasoning as the upsert:
 * the realtime onSnapshot confirms the removal (or, on a server reject the
 * onError already restored, the next snapshot re-adds the row).
 */
function useOptimisticDelete(coll: string) {
  const qc = useQueryClient();
  const queryKey = keyFor(coll);
  return useMutation<void, unknown, string, RollbackCtx>({
    mutationFn: (id: string) => deleteDoc(doc(db, coll, id)),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey });
      const prev = qc.getQueryData<WithId[]>(queryKey);
      qc.setQueryData<WithId[]>(queryKey, (old) => removeById(old, id));
      return { patched: true, prev }; // delete always patches
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.patched) qc.setQueryData(queryKey, ctx.prev);
    },
    // onSettled intentionally omitted (see useOptimisticUpsert).
  });
}

export const useUpsertSeason = () => useOptimisticUpsert("seasons");
export const useDeleteSeason = () => useOptimisticDelete("seasons");
export const useUpsertPlayer = () => useOptimisticUpsert("players");
export const useDeletePlayer = () => useOptimisticDelete("players");
export const useUpsertMatch = () => useOptimisticUpsert("matches");
export const useDeleteMatch = () => useOptimisticDelete("matches");
