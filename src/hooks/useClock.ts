import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { renderNow, serverNow, subscribeServerTime } from "../lib/serverTime";
const NO_BOUNDARIES: readonly number[] = [];
const noop = () => () => {};

/** True on the server and while React takes over a server-rendered page (this component's first render
 *  there); false from then on, and always in a page the browser rendered itself. */
export const useTakingOver = () => !useSyncExternalStore(noop, () => true, () => false);
/**
 * The current time on the server's clock (lib/serverTime: the phone's time plus its estimated offset,
 * so every phone reads the same live minute), re-rendering every `step` ms (aligned to the step
 * boundary, so a minute clock ticks on the minute). Pages that only show minutes pass 60_000 instead
 * of re-rendering their whole tree every second. A new offset estimate re-reads it at once.
 */
export function useClock(step = 1000, boundaries: readonly number[] = NO_BOUNDARIES) {
  // (the server-rendered page's own instant while React takes it over: lib/serverTime renderNow)
  const takingOver = useTakingOver();
  const [now, setNow] = useState(() => renderNow(takingOver));
  // (serialized once per boundaries array, not on every render)
  const boundaryKey = useMemo(() => JSON.stringify(boundaries), [boundaries]);
  useEffect(() => {
    let timer = 0;
    const targets: number[] = JSON.parse(boundaryKey);
    const delay = (t: number) => targets.reduce((ms, b) => b > t ? Math.min(ms, b - t) : ms, step - (t % step)) + 5;
    const update = () => {
      const t = serverNow();
      setNow(t);
      window.clearTimeout(timer);
      timer = window.setTimeout(update, delay(t));
    };
    update();
    const unsubscribe = subscribeServerTime(update);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("focus", update);
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("focus", update);
    };
  }, [step, boundaryKey]);
  return now;
}
