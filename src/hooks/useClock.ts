import { useEffect, useMemo, useState } from "react";
import { serverNow, subscribeServerTime } from "../lib/serverTime";
const NO_BOUNDARIES: readonly number[] = [];
/**
 * The current time on the server's clock (lib/serverTime: the phone's time plus its estimated offset,
 * so every phone reads the same live minute), re-rendering every `step` ms (aligned to the step
 * boundary, so a minute clock ticks on the minute). Pages that only show minutes pass 60_000 instead
 * of re-rendering their whole tree every second. A new offset estimate re-reads it at once.
 */
export function useClock(step = 1000, boundaries: readonly number[] = NO_BOUNDARIES) {
  const [now, setNow] = useState(() => serverNow());
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
