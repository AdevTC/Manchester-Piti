import { describe, it, expect } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { removeById, mergeById } from "./useAdminMutations";

// The optimistic handlers in useAdminMutations are thin glue over two pure
// transforms (removeById / mergeById) applied through the React Query cache.
// We can't mount the hooks here (no jsdom / @testing-library in the project, and
// no new deps allowed), so we verify (1) the pure transforms exhaustively and
// (2) the snapshot→patch→rollback round-trip against a REAL QueryClient — the
// exact sequence onMutate/onError run. That covers the cache behavior the hooks
// rely on; the wiring (onMutate returns { prev }, onError reads ctx.prev) is
// enforced by the mutation generics + tsc.

type Doc = { id: string; name?: string; n?: number };

describe("removeById", () => {
  it("quita el doc con el id dado y deja el resto", () => {
    const list: Doc[] = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(removeById(list, "b")).toEqual([{ id: "a" }, { id: "c" }]);
  });

  it("no muta el array original (rollback seguro)", () => {
    const list: Doc[] = [{ id: "a" }, { id: "b" }];
    const out = removeById(list, "a");
    expect(list).toEqual([{ id: "a" }, { id: "b" }]); // snapshot intacto
    expect(out).not.toBe(list);
  });

  it("devuelve [] para undefined (cache aún no hidratada)", () => {
    expect(removeById(undefined, "x")).toEqual([]);
  });

  it("deja la lista igual si el id no existe", () => {
    const list: Doc[] = [{ id: "a" }];
    expect(removeById(list, "zzz")).toEqual([{ id: "a" }]);
  });
});

describe("mergeById", () => {
  it("hace shallow-merge de los campos en el doc con ese id (setDoc merge)", () => {
    const list: Doc[] = [
      { id: "a", name: "Vieja", n: 1 },
      { id: "b", name: "Otra" },
    ];
    expect(mergeById(list, "a", { name: "Nueva" })).toEqual([
      { id: "a", name: "Nueva", n: 1 }, // n preservado, name pisado
      { id: "b", name: "Otra" },
    ]);
  });

  it("no muta el doc original ni el array (rollback seguro)", () => {
    const orig: Doc = { id: "a", name: "Vieja" };
    const list: Doc[] = [orig];
    const out = mergeById(list, "a", { name: "Nueva" });
    expect(orig).toEqual({ id: "a", name: "Vieja" });
    expect(out).not.toBe(list);
    expect(out[0]).not.toBe(orig);
  });

  it("no inserta una fila sintética si el id no está presente (edit-only)", () => {
    const list: Doc[] = [{ id: "a" }];
    expect(mergeById(list, "missing", { name: "X" })).toEqual([{ id: "a" }]);
  });

  it("devuelve [] para undefined", () => {
    expect(mergeById(undefined, "a", { name: "X" })).toEqual([]);
  });
});

describe("optimistic cache round-trip (real QueryClient)", () => {
  const KEY = ["seasons"] as const;

  function seed(): QueryClient {
    const qc = new QueryClient();
    qc.setQueryData<Doc[]>(KEY, [
      { id: "s1", name: "Temp 1" },
      { id: "s2", name: "Temp 2" },
    ]);
    return qc;
  }

  it("delete: patch quita la fila al instante; rollback la restaura", () => {
    const qc = seed();
    // onMutate: snapshot + optimistic remove
    const prev = qc.getQueryData<Doc[]>(KEY);
    qc.setQueryData<Doc[]>(KEY, (old) => removeById(old, "s1"));
    expect(qc.getQueryData<Doc[]>(KEY)).toEqual([{ id: "s2", name: "Temp 2" }]);
    // onError: rollback to the snapshot
    qc.setQueryData(KEY, prev);
    expect(qc.getQueryData<Doc[]>(KEY)).toEqual([
      { id: "s1", name: "Temp 1" },
      { id: "s2", name: "Temp 2" },
    ]);
  });

  it("edit: patch fusiona los campos al instante; rollback restaura", () => {
    const qc = seed();
    const prev = qc.getQueryData<Doc[]>(KEY);
    qc.setQueryData<Doc[]>(KEY, (old) => mergeById(old, "s2", { name: "Renombrada" }));
    expect(qc.getQueryData<Doc[]>(KEY)).toEqual([
      { id: "s1", name: "Temp 1" },
      { id: "s2", name: "Renombrada" },
    ]);
    qc.setQueryData(KEY, prev);
    expect(qc.getQueryData<Doc[]>(KEY)).toEqual([
      { id: "s1", name: "Temp 1" },
      { id: "s2", name: "Temp 2" },
    ]);
  });
});

describe("discriminated rollback decision (onError guard)", () => {
  // The onError guard is `if (ctx?.patched) setQueryData(key, ctx.prev)`. This
  // mirrors that exact predicate against the discriminated context onMutate
  // returns, covering the cases `prev === undefined` used to make ambiguous.
  type Ctx = { patched: false } | { patched: true; prev: Doc[] | undefined };
  const shouldRollback = (ctx: Ctx | undefined) => !!ctx?.patched;

  it("create: { patched: false } → NO restaura (no se aplicó patch)", () => {
    expect(shouldRollback({ patched: false })).toBe(false);
  });

  it("edit/delete sobre caché poblada → SÍ restaura", () => {
    expect(shouldRollback({ patched: true, prev: [{ id: "a" }] })).toBe(true);
  });

  it("edit/delete sobre caché VACÍA (prev undefined) → SÍ restaura", () => {
    // El hueco lógico que arregla el contexto discriminado: el patch optimista
    // a [] ocurrió, así que el rollback debe correr aunque prev sea undefined.
    expect(shouldRollback({ patched: true, prev: undefined })).toBe(true);
  });

  it("contexto ausente (onMutate lanzó) → NO restaura", () => {
    expect(shouldRollback(undefined)).toBe(false);
  });
});
