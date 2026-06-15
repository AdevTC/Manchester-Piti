import React, { useEffect, useState } from "react";

/* ---------------- Count-up (mount-based, reduced-motion aware) ---------------- */
export const CountUp: React.FC<{ value: number; className?: string; durationMs?: number }> = ({
  value,
  className,
  durationMs = 900,
}) => {
  const reduce = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [shown, setShown] = useState(reduce ? value : 0);
  useEffect(() => {
    if (reduce) return; // value is rendered directly below; no state write needed
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs, reduce]);
  return <span className={className}>{reduce ? value : shown}</span>;
};

/* ---------------- Scoresheet glyphs (bespoke, flat, no emoji) ---------------- */
export type GlyphKind = "yellow" | "double" | "red" | "woodwork" | "saved" | "missed";

export const EventGlyph: React.FC<{ kind: GlyphKind; label: string }> = ({ kind, label }) => {
  const common = { width: "1em", height: "1em", focusable: false as const, role: "img", "aria-label": label };
  switch (kind) {
    case "yellow":
      return (
        <svg {...common} viewBox="0 0 14 14">
          <rect x="4" y="1.5" width="6" height="11" rx="1" fill="#FFC659" />
        </svg>
      );
    case "red":
      return (
        <svg {...common} viewBox="0 0 14 14">
          <rect x="4" y="1.5" width="6" height="11" rx="1" fill="#C42F23" />
        </svg>
      );
    case "double":
      return (
        <svg {...common} viewBox="0 0 16 14">
          <rect x="2.5" y="1.5" width="5" height="11" rx="1" fill="#FFC659" />
          <rect x="8.5" y="1.5" width="5" height="11" rx="1" fill="#C42F23" />
        </svg>
      );
    case "woodwork":
      return (
        <svg {...common} viewBox="0 0 16 14">
          <path d="M3 13 V3 H13 V13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />
        </svg>
      );
    case "saved":
      return (
        <svg {...common} viewBox="0 0 14 14">
          <path d="M7 1 L12 3 V7 C12 10 9.6 12.2 7 13 C4.4 12.2 2 10 2 7 V3 Z" fill="none" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      );
    case "missed":
      return (
        <svg {...common} viewBox="0 0 14 14">
          <circle cx="7" cy="7" r="5.4" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M4.9 4.9 L9.1 9.1 M9.1 4.9 L4.9 9.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
  }
};
