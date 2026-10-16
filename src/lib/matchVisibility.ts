import { isVisibleMatch } from "../../functions/src/matchEngine";

/** Dependent records may outlive an archived/deleted match (or arrive before its snapshot). They do
 * not become public history merely because the child still exists. Unlinked boards are seasonal. */
export function visibleMatchLinks<T>(
  records: readonly T[], matches: readonly { id: string }[],
  matchIdOf: (record: T) => string | null | undefined, keepUnlinked = false,
): T[] {
  const ids = new Set(matches.filter(isVisibleMatch).map(m => m.id));
  return records.filter(record => { const id = matchIdOf(record); return id ? ids.has(id) : keepUnlinked; });
}
