// The matches' narrated analyses, apart from the matches (functions/src/analysisPlaceLogic.ts says why): megabytes
// that only the game's charts, the acta and the notas read, so only the pages that show them load them —
// useClubData({ analysis }) — and every other page (Inicio, Partidos, Club…), the data bundle and its server-rendered
// HTML go without. They come like the public data: their own bundle from the CDN (/datos/analisis.bundle, or inside
// a server-rendered page that needs them: api/render.js ANALYSIS_PAGES) paints first and goes into Firestore's local
// cache, then their listener resumes from it (its named query, so only what changed since is read).
import { useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { storedAnalysis, withAnalysis } from "../../functions/src/analysisPlaceLogic";
import type { NarratedAnalysis } from "../../functions/src/narrated/types";
import { beforeListeners, type Fb } from "./fb";
import { useFirestoreCollection, type QuerySource } from "./useFirestoreCollection";
import { parseBundle } from "../ssr/bundleData";

export const ANALYSES_KEY = ["matchAnalyses"] as const;
/** The server-rendered pages whose markup shows the analyses (every public page rendered with and without them, on
 *  production's data: Estadísticas, a player's pages, cara a cara; Inicio, Partidos, Plantilla, Club… don't change):
 *  api/render.js renders these with them and puts them in the page, and their screens wait for them (useClubData's
 *  "wait"); elsewhere the same screens take them when they come ("soft"), so the server's markup holds. */
export const ANALYSIS_PAGES: readonly RegExp[] = [/^\/estadisticas(\/.*)?$/, /^\/plantilla\/cara-a-cara$/, /^\/jugadores\/[A-Za-z0-9_-]+(\/.*)?$/];
export const needsAnalysesAt = (path: string): boolean => ANALYSIS_PAGES.some((re) => re.test(path.replace(/(.)\/+$/, "$1")));
/** Where the boot starts getting them at once, with the public bundle (main.tsx): those pages, and the screens that
 *  wait for them without a server render (a match's pages, the admin, Tú, the pizarra). */
const PRIMED_AT: readonly RegExp[] = [/^\/partidos\/(?!tabla$|balance$)[^/]+(\/.*)?$/, /^\/(admin|perfil|pizarra)(\/.*)?$/];
export const primesAnalysesAt = (path: string): boolean => needsAnalysesAt(path) || PRIMED_AT.some((re) => re.test(path.replace(/(.)\/+$/, "$1")));
export const ANALYSIS_BUNDLE_URL = "/datos/analisis.bundle";
/** The analyses bundle's named query (functions/src/bundle.ts). */
export const ANALYSIS_QUERY_NAME = "matchAnalysis";
/** The longest the analyses' listener waits for their bundle before opening anyway. */
const ANALYSIS_BUNDLE_WAIT_MS = 4000;

export interface StoredMatchAnalysis {
  id: string;
  analysis: NarratedAnalysis;
}

/** Canonical `["matchAnalyses"]` mapper: `matchAnalysis/{id}` (the id is the match's); one without an analysis, none. */
export function mapAnalysis(id: string, data: unknown): StoredMatchAnalysis | null {
  const analysis = storedAnalysis(data);
  return analysis ? { id, analysis } : null;
}

/** The analyses of a bundle (the CDN's, or the one inside a server-rendered page) into the cache: what the page paints
 *  with until the listener answers. */
export function seedAnalyses(qc: Pick<QueryClient, "setQueryData">, bundle: Uint8Array): void {
  const docs = parseBundle(bundle).queries[ANALYSIS_QUERY_NAME] ?? [];
  // (by id, as the listener lists a plain collection)
  const out = docs.flatMap((d) => mapAnalysis(d.id, d.data) ?? []).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  qc.setQueryData(ANALYSES_KEY, out);
}

let ready: Promise<void> | null = null;
/** Starts getting the analyses (once): their bundle — `inline` (a server-rendered page's) or the CDN's — seeds the cache
 *  if nothing has yet, and goes into Firestore's local cache before their listener opens. */
export function primeAnalyses(qc: Pick<QueryClient, "getQueryData" | "setQueryData">, inline?: string | null): void {
  if (ready) return;
  const data: Promise<string | ArrayBuffer | null> = inline
    ? Promise.resolve(inline)
    : fetch(ANALYSIS_BUNDLE_URL)
        .then((r) => {
          if (!r.ok || !(r.headers.get("content-type") ?? "").includes("octet-stream")) throw new Error(`analysis bundle ${r.status}`);
          return r.arrayBuffer().then((body) => {
            try {
              if (qc.getQueryData(ANALYSES_KEY) === undefined) seedAnalyses(qc, new Uint8Array(body));
            } catch {
              /* not one we can read: the listener brings the same */
            }
            return body;
          });
        })
        .catch(() => null);
  const loaded = new Promise<void>((resolve) =>
    beforeListeners((fb) => {
      void data.then((d) => (d ? fb.loadBundle(fb.db, d).then(() => undefined) : undefined)).then(() => resolve(), () => resolve());
    }),
  );
  ready = Promise.race([loaded, new Promise<void>((resolve) => setTimeout(resolve, ANALYSIS_BUNDLE_WAIT_MS))]);
}

/** The analyses' listener: their bundle's named query once it is in the local cache (falls back to the same query). */
export const analysisSource: QuerySource = {
  named: ANALYSIS_QUERY_NAME,
  query: (fb: Fb) => fb.collection(fb.db, "matchAnalysis"),
  ready: () => ready,
};

/** Every match's analysis, live, while `enabled` (the pages that show them). */
export function useMatchAnalyses(enabled = true) {
  const qc = useQueryClient();
  useEffect(() => {
    if (enabled) primeAnalyses(qc);
  }, [enabled, qc]);
  return useFirestoreCollection(ANALYSES_KEY, analysisSource, mapAnalysis, enabled);
}

/** These matches with their analyses while `enabled` (a page that needs them only sometimes: Partidos' notas, when an
 *  acta has none frozen); the same list until they arrive. */
export function useAnalysedMatches<T extends { id: string; analysis?: unknown }>(matches: readonly T[], enabled = true): T[] {
  const { data } = useMatchAnalyses(enabled);
  return enabled ? withAnalyses(matches, data) : (matches as T[]);
}

// The merged list per (matches, analyses) pair, and each merged match per (match, analysis): a live event that
// touches one match leaves every other merged match the same object (their memoised notas and charts hold).
const lists = new WeakMap<readonly object[], WeakMap<readonly StoredMatchAnalysis[], object[]>>();
const items = new WeakMap<object, { analysis: NarratedAnalysis | undefined; out: object }>();

/** The matches with their analyses put back in (`match.analysis`, as every reader of it expects); the same array when
 *  there are none yet (a page that paints before they arrive paints exactly what it did). */
export function withAnalyses<T extends { id: string; analysis?: unknown }>(matches: readonly T[], analyses: readonly StoredMatchAnalysis[] | undefined): T[] {
  if (!analyses?.length) return matches as T[];
  let byAnalyses = lists.get(matches);
  if (!byAnalyses) lists.set(matches, (byAnalyses = new WeakMap()));
  const hit = byAnalyses.get(analyses);
  if (hit) return hit as T[];
  const byId = new Map(analyses.map((a) => [a.id, a.analysis]));
  let changed = false;
  const out = matches.map((m) => {
    const a = byId.get(m.id);
    if (!a) return m;
    const kept = items.get(m);
    if (kept && kept.analysis === a) {
      changed ||= kept.out !== m;
      return kept.out as T;
    }
    const merged = withAnalysis(m, a);
    items.set(m, { analysis: a, out: merged });
    changed ||= merged !== m;
    return merged;
  });
  const result = changed ? out : (matches as T[]);
  byAnalyses.set(analyses, result);
  return result;
}

/** Test-only: forget the primed bundle. */
export function _resetAnalysesForTesting(): void {
  ready = null;
}
