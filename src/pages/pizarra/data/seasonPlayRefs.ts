// r14 · a board's `seasonPlays` refs (PZ-D05), pure (lineupDoc.ts reads them without Firebase).
import { reportDroppedDoc } from "../../../lib/docTelemetry";

export const SEASON_PLAY_LIMITS = { mine: 12, refs: 24 } as const;

/** A board's `seasonPlays` refs (ids, once each, ≤ 24). */
export function parseSeasonPlayRefs(raw: unknown, docId = "-"): string[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    reportDroppedDoc("lineups.seasonPlays", docId, []);
    return [];
  }
  return [...new Set(raw.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 128))].slice(0, SEASON_PLAY_LIMITS.refs);
}

/** `refs` with `id` added (at the end) or taken off. Throws (Spanish) past the cap. */
export function withSeasonPlay(refs: readonly string[] | undefined, id: string, on: boolean): string[] {
  const list = [...(refs ?? [])];
  const has = list.includes(id);
  if (on === has) return list;
  if (!on) return list.filter((x) => x !== id);
  if (list.length >= SEASON_PLAY_LIMITS.refs) throw new Error(`Un tablero usa como mucho ${SEASON_PLAY_LIMITS.refs} jugadas de la temporada.`);
  return [...list, id];
}
