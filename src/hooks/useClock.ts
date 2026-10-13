import { useEffect, useState } from "react";
/**
 * The current time, re-rendering every `step` ms (aligned to the step boundary, so a
 * minute clock ticks on the minute). Pages that only show minutes pass 60_000 instead
 * of re-rendering their whole tree every second.
 */
export function useClock(step = 1000, boundaries: readonly number[] = []) {
  const [now, setNow] = useState(() => Date.now());
  const boundaryKey = JSON.stringify(boundaries);
  useEffect(() => {
    let timer = 0;
    const targets: number[] = JSON.parse(boundaryKey);
    const delay = (t: number) => targets.reduce((ms, b) => b > t ? Math.min(ms, b - t) : ms, step - (t % step)) + 5;
    const update = () => {
      const t = Date.now();
      setNow(t);
      window.clearTimeout(timer);
      timer = window.setTimeout(update, delay(t));
    };
    update();
    document.addEventListener("visibilitychange", update);
    window.addEventListener("focus", update);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("focus", update);
    };
  }, [step, boundaryKey]);
  return now;
}
