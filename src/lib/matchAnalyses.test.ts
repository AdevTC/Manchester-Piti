import { describe, expect, it, vi } from "vitest";
import type { Query } from "firebase/firestore";
import { QueryClient } from "@tanstack/react-query";
import { ANALYSES_KEY, mapAnalysis, seedAnalyses, withAnalyses, type StoredMatchAnalysis } from "./matchAnalyses";
import { openSource, type NamedSource } from "./useFirestoreCollection";
import type { NarratedAnalysis } from "../../functions/src/narrated/types";

const analysis = (revision: number) => ({ version: 2, revision, profile: {}, observations: [{ id: "o1", kind: "pass", team: "us", order: 0, facts: {} }], coverage: [] }) as unknown as NarratedAnalysis;

/** A bundle as functions/src/bundle.ts clubAnalysisBundle builds it (`<length><json>` elements). */
function bundleOf(docs: Record<string, unknown>[]): Uint8Array {
  const enc = new TextEncoder();
  const name = (id: string) => `projects/demo/databases/(default)/documents/matchAnalysis/${id}`;
  const els: unknown[] = [
    { metadata: { id: "club-analisis", createTime: { seconds: 1, nanos: 0 }, version: 1, totalDocuments: docs.length, totalBytes: 0 } },
    { namedQuery: { name: "matchAnalysis", bundledQuery: { parent: "projects/demo/databases/(default)/documents", structuredQuery: { from: [{ collectionId: "matchAnalysis" }] } }, readTime: { seconds: 1, nanos: 0 } } },
    ...docs.flatMap((fields) => {
      const id = String(fields.__id);
      const { __id: _id, ...rest } = fields;
      return [{ documentMetadata: { name: name(id), readTime: { seconds: 1, nanos: 0 }, exists: true, queries: ["matchAnalysis"] } }, { document: { name: name(id), fields: rest } }];
    }),
  ];
  return enc.encode(els.map((e) => { const j = JSON.stringify(e); return enc.encode(j).length + j; }).join(""));
}

describe("lib/matchAnalyses", () => {
  it("mapAnalysis: el documento de su sitio, o nada si no lleva análisis", () => {
    const a = analysis(1);
    expect(mapAnalysis("m1", { analysis: a })).toEqual({ id: "m1", analysis: a });
    expect(mapAnalysis("m1", { analysis: null })).toBeNull();
    expect(mapAnalysis("m1", {})).toBeNull();
  });

  it("withAnalyses: sin análisis, la misma lista (la página pinta lo mismo que el servidor)", () => {
    const matches = [{ id: "m1" }, { id: "m2" }];
    expect(withAnalyses(matches, undefined)).toBe(matches);
    expect(withAnalyses(matches, [])).toBe(matches);
    expect(withAnalyses(matches, [{ id: "otro", analysis: analysis(1) }])).toBe(matches);
  });

  it("withAnalyses: cada partido con el suyo, y los demás el mismo objeto entre listas", () => {
    const a = analysis(1);
    const analyses: StoredMatchAnalysis[] = [{ id: "m1", analysis: a }];
    const m1 = { id: "m1", rival: "A" };
    const m2 = { id: "m2", rival: "B" };
    const first = withAnalyses<{ id: string; rival: string; analysis?: unknown }>([m1, m2], analyses);
    expect(first[0]).toEqual({ id: "m1", rival: "A", analysis: a });
    expect(first[1]).toBe(m2);
    // (memoised per pair of lists)
    expect(withAnalyses([m1, m2], analyses)).not.toBe(first);
    const list = [m1, m2];
    expect(withAnalyses(list, analyses)).toBe(withAnalyses(list, analyses));
    // (a live event changes m2: the merged m1 keeps its identity, so its notas and charts stay memoised)
    const next = withAnalyses<{ id: string; rival: string; analysis?: unknown }>([m1, { ...m2, rival: "C" }], analyses);
    expect(next[0]).toBe(first[0]);
  });

  it("withAnalyses: un campo viejo más nuevo que su sitio gana (una función de antes del traslado)", () => {
    const placed = analysis(2);
    const legacy = analysis(3);
    const m = { id: "m1", analysis: legacy };
    expect(withAnalyses([m], [{ id: "m1", analysis: placed }])[0].analysis).toBe(legacy);
  });

  it("seedAnalyses: siembra la caché desde su bundle (el de la CDN o el de la página del servidor), por id", () => {
    const qc = new QueryClient();
    const bytes = bundleOf([
      { __id: "m2", analysis: { mapValue: { fields: { version: { integerValue: "2" }, revision: { integerValue: "4" }, observations: { arrayValue: { values: [] } }, coverage: { arrayValue: {} } } } } },
      { __id: "m1", analysis: { mapValue: { fields: { version: { integerValue: "2" }, revision: { integerValue: "1" }, observations: { arrayValue: {} }, coverage: { arrayValue: {} } } } } },
      { __id: "m3", other: { stringValue: "x" } },
    ]);
    seedAnalyses(qc, bytes);
    const seeded = qc.getQueryData<StoredMatchAnalysis[]>(ANALYSES_KEY)!;
    expect(seeded.map((s) => [s.id, s.analysis.revision])).toEqual([["m1", 1], ["m2", 4]]);
  });
});

describe("openSource: la consulta con nombre del bundle", () => {
  const plain = { q: "plain" } as unknown as Query;
  const fromBundle = { q: "named" } as unknown as Query;
  const flush = () => new Promise((r) => setTimeout(r, 0));

  it("una consulta normal abre al momento", () => {
    const listen = vi.fn(() => () => {});
    openSource({ db: {} as never, namedQuery: vi.fn() as never }, plain, listen);
    expect(listen).toHaveBeenCalledWith(plain);
  });

  it("una con nombre espera su bundle y abre la del bundle; sin ella, la misma consulta hecha aquí", async () => {
    let release!: () => void;
    const ready = new Promise<void>((r) => (release = r));
    const source: NamedSource = { named: "matches", query: () => plain, ready: () => ready };
    const listen = vi.fn(() => () => {});
    const namedQuery = vi.fn(async () => fromBundle);
    openSource({ db: {} as never, namedQuery: namedQuery as never }, source, listen);
    await flush();
    expect(listen).not.toHaveBeenCalled();
    release();
    await flush();
    await flush();
    expect(namedQuery).toHaveBeenCalledWith(expect.anything(), "matches");
    expect(listen).toHaveBeenCalledWith(fromBundle);

    const listen2 = vi.fn(() => () => {});
    openSource({ db: {} as never, namedQuery: vi.fn(async () => null) as never }, { named: "matches", query: () => plain }, listen2);
    await flush();
    await flush();
    expect(listen2).toHaveBeenCalledWith(plain);

    const listen3 = vi.fn(() => () => {});
    openSource({ db: {} as never, namedQuery: vi.fn(async () => Promise.reject(new Error("x"))) as never }, { named: "matches", query: () => plain }, listen3);
    await flush();
    await flush();
    expect(listen3).toHaveBeenCalledWith(plain);
  });

  it("parada antes de abrir, no abre nunca; parada después, cierra el listener", async () => {
    const stop = vi.fn();
    const listen = vi.fn(() => stop);
    const cancel = openSource({ db: {} as never, namedQuery: vi.fn(async () => fromBundle) as never }, { named: "matches", query: () => plain }, listen);
    cancel();
    await flush();
    await flush();
    expect(listen).not.toHaveBeenCalled();
    const cancel2 = openSource({ db: {} as never, namedQuery: vi.fn(async () => fromBundle) as never }, { named: "matches", query: () => plain }, listen);
    await flush();
    await flush();
    cancel2();
    expect(stop).toHaveBeenCalledTimes(1);
  });
});
