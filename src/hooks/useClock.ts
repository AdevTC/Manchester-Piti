import { useEffect, useState } from "react";
/**
 * The current time, re-rendering every `step` ms (aligned to the step boundary, so a
 * minute clock ticks on the minute). Pages that only show minutes pass 60_000 instead
 * of re-rendering their whole tree every second.
 */
export function useClock(step = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let timer = 0;
    const update = () => {
      const t = Date.now();
      setNow(t);
      window.clearTimeout(timer);
      timer = window.setTimeout(update, step - (t % step) + 5);
    };
    timer = window.setTimeout(update, step - (Date.now() % step) + 5);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, [step]);
  return now;
}
