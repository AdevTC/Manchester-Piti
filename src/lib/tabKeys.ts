// The ARIA tabs pattern's keys, shared by every tablist (perfil's menu, the match page): ArrowLeft and
// ArrowRight wrap around, Home and End go to the ends. Pure: the caller selects the tab it returns
// and moves the focus to it (roving tabindex, automatic activation).

/** The tab `key` moves to from `current` in `ids`; anything that isn't one of those keys: null. */
export function tabForKey<T>(key: string, current: T, ids: readonly T[]): T | null {
  const i = Math.max(0, ids.indexOf(current));
  const n = ids.length;
  if (!n) return null;
  if (key === "ArrowRight") return ids[(i + 1) % n];
  if (key === "ArrowLeft") return ids[(i - 1 + n) % n];
  if (key === "Home") return ids[0];
  if (key === "End") return ids[n - 1];
  return null;
}
