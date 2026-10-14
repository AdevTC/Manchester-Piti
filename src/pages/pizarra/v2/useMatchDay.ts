// La pizarra «día de partido» — the two device pieces of the live match: the clock (it reads the time
// when the match's next minute starts, and again whenever the page comes back into view: the minute is
// always worked out from the match's date, never counted here, so a locked phone wakes up on the right
// minute) and the screen wake lock while the match is live (where the browser has one; a refusal is
// fine).
import { useEffect, useState } from "react";
import type { CalMatch } from "./boards";
import { nextClockAt } from "./live";
import { serverNow, subscribeServerTime } from "../../../lib/serverTime";

/** The time on the server's clock (lib/serverTime: every phone reads the same minute), read again at
 *  each of the match's minutes (and on coming back to the page, or when the offset estimate changes). */
export function useMatchClock(m: CalMatch | null, fallback: number): number {
  const [now, setNow] = useState(() => serverNow());
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const at = nextClockAt(m, serverNow());
    if (at == null) return;
    const t = window.setTimeout(
      () => {
        setNow(serverNow());
        setTick((k) => k + 1);
      },
      Math.max(0, at - serverNow()) + 50,
    );
    return () => window.clearTimeout(t);
  }, [m, tick]);
  useEffect(() => {
    const reread = () => {
      setNow(serverNow());
      setTick((k) => k + 1);
    };
    const onVis = () => {
      if (document.visibilityState === "visible") reread();
    };
    document.addEventListener("visibilitychange", onVis);
    const unsubscribe = subscribeServerTime(reread);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      unsubscribe();
    };
  }, []);
  // (the page's own clock moving on — a new minute — counts too)
  return Math.max(now, fallback);
}

interface WakeLockLike {
  release: () => Promise<void>;
}
interface WakeNav {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockLike> };
}

/** Keeps the screen on while `on` (asked again when the page comes back: the browser lets it go when
 *  the page is hidden). */
export function useWakeLock(on: boolean): void {
  useEffect(() => {
    if (!on || typeof navigator === "undefined") return;
    const nav = navigator as Navigator & WakeNav;
    if (!nav.wakeLock) return;
    let lock: WakeLockLike | null = null;
    let dead = false;
    const ask = async () => {
      try {
        const l = await nav.wakeLock?.request("screen");
        if (!l) return;
        if (dead) void l.release().catch(() => undefined);
        else lock = l;
      } catch {
        /* refused (battery saver, not visible): the match goes on without it */
      }
    };
    const onVis = () => {
      if (document.visibilityState === "visible") void ask();
    };
    void ask();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      dead = true;
      document.removeEventListener("visibilitychange", onVis);
      if (lock) void lock.release().catch(() => undefined);
    };
  }, [on]);
}
