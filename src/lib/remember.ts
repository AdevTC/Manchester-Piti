// The heavy pure computations over the club's data (the season's technical analysis, a squad's period, Números'
// actions) ran again on every visit to a page: each mount starts a fresh useMemo, and a page being left re-renders
// once more with the next address. Their results are kept here by their arguments, the last few of them: the same
// documents (the store gives a changed document a new object) give the same result, and a changed one misses.
// Results are shared, so they are read only.

/** Arguments are the same: the same value, or arrays and plain objects whose items are the same (one level down:
 *  a filter's list of players, a list of seasons rebuilt as {id, name}). */
function same(a: unknown, b: unknown, depth = 1): boolean {
  if (Object.is(a, b)) return true;
  if (depth < 0 || typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!same(a[i], b[i], depth - 1)) return false;
    return true;
  }
  if (Object.getPrototypeOf(a) !== Object.prototype || Object.getPrototypeOf(b) !== Object.prototype) return false;
  const ka = Object.keys(a).filter((k) => (a as Record<string, unknown>)[k] !== undefined);
  const kb = Object.keys(b).filter((k) => (b as Record<string, unknown>)[k] !== undefined);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], depth - 1)) return false;
  return true;
}

export function remember<A extends readonly unknown[], R>(compute: (...args: A) => R, size = 6): (...args: A) => R {
  const kept: { args: A; result: R }[] = [];
  return (...args: A): R => {
    const i = kept.findIndex((k) => k.args.length === args.length && k.args.every((x, j) => same(x, args[j])));
    if (i >= 0) {
      const hit = kept[i];
      // (the most recent first: a page switching back and forth finds its own at once)
      if (i > 0) kept.unshift(...kept.splice(i, 1));
      return hit.result;
    }
    const result = compute(...args);
    kept.unshift({ args, result });
    if (kept.length > size) kept.pop();
    return result;
  };
}
