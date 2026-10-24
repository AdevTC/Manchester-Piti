// «Números»: the narrated catalogue (functions/src/narrated/catalog.ts) as the boards list it — id, family, name,
// a plain-words definition, what la mesa must narrate, whether audio can give it, and for whom. Loaded on demand
// (the catalogue, a metric's sheet, the search): it is the page's heaviest piece.

/** [id, family, name, definition, what to narrate, outside the audio (1), scope] */
export type CatRow = [string, string, string, string, string, 0 | 1, string];

/** The catalogue's size as the boards print it on «Catálogo de estadísticas · 412» (catalog.test.ts keeps it true). */
export const CAT_SIZE = 412;
export const CAT_FAMILIES = 26;

const cut = (s: string | undefined, n: number): string => {
  const t = String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return t.length > n ? `${t.slice(0, n - 1).replace(/\s\S*$/, "")}…` : t;
};

let loaded: Promise<CatRow[]> | null = null;
export function loadCatalog(): Promise<CatRow[]> {
  loaded ??= import("../../../../functions/src/narrated/catalog").then(({ NARRATED_METRICS }) =>
    NARRATED_METRICS.map((m): CatRow => [m.id, m.category, m.name, cut(m.definition, 170), cut(m.audio?.whatToNarrate, 150), m.audio?.viability === "excluded" ? 1 : 0, m.scope]),
  ).catch((error: unknown) => {
    loaded = null;
    throw error;
  });
  return loaded;
}
