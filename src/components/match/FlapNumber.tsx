import React, { useEffect, useState } from "react";

/**
 * Split-flap scoreboard number. The final value is always in the DOM (so it is
 * visible without JS and under reduced motion); when motion is allowed the
 * digits flap upward from zero to the target, one tick per integer, like a
 * stadium board updating. `aria-hidden` because the readable value is announced
 * by the labelled container around it.
 */
export const FlapNumber: React.FC<{
  value: number;
  className?: string;
  stepMs?: number;
  startDelayMs?: number;
}> = ({ value, className, stepMs = 95, startDelayMs = 0 }) => {
  const reduce =
    typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const target = Math.max(0, Math.round(value));
  const [shown, setShown] = useState(reduce ? target : 0);

  useEffect(() => {
    if (reduce || target <= 0) return; // resting value is already correct
    let cancelled = false;
    let stepTimer = 0;
    const total = Math.min(900, stepMs * target);
    const per = total / target;
    let current = 0;
    const tick = () => {
      if (cancelled) return;
      current += 1;
      setShown(current);
      if (current < target) stepTimer = window.setTimeout(tick, per);
    };
    const startTimer = window.setTimeout(tick, startDelayMs);
    return () => {
      cancelled = true;
      window.clearTimeout(startTimer);
      window.clearTimeout(stepTimer);
    };
  }, [target, reduce, stepMs, startDelayMs]);

  const digits = String(shown).split("");

  return (
    <span className={`mp-bd-flap-num${className ? ` ${className}` : ""}`} aria-hidden="true">
      {digits.map((ch, i) => (
        <span className="mp-bd-flap" key={i}>
          {/* keying on the char replays the flap keyframe on every change */}
          <span className="mp-bd-flap-card" key={ch}>
            {ch}
          </span>
        </span>
      ))}
    </span>
  );
};
