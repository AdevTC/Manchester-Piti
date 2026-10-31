// Tus partidos: the glass segmented control as the prototypes draw it (vd-seg nx-seg with its bead) — a radiogroup
// whose options are real buttons (role radio + aria-checked); ← → move between them like a native radio group.
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";

export interface RadioOpt {
  key: string;
  t: ReactNode;
  on: boolean;
  pick: () => void;
  off?: boolean;
}

export function RadioSeg({ label, opts, className, style, bead = true }: { label: string; opts: RadioOpt[]; className?: string; style?: CSSProperties; bead?: boolean }) {
  const i = opts.findIndex((o) => o.on);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    e.stopPropagation();
    const from = Math.max(0, i);
    const to = (from + (e.key === "ArrowRight" ? 1 : opts.length - 1)) % opts.length;
    const o = opts[to];
    if (o && !o.off) {
      o.pick();
      const btn = e.currentTarget.querySelectorAll<HTMLButtonElement>("button")[to];
      btn?.focus();
    }
  };
  return (
    <div className={`vd-glass vd-seg nx-seg${className ? ` ${className}` : ""}`} role="radiogroup" aria-label={label} style={{ "--n": opts.length, "--i": Math.max(0, i), ...style } as CSSProperties} onKeyDown={onKey}>
      {bead && i >= 0 && <span className="vd-shelf__bead" aria-hidden="true" />}
      {opts.map((o, k) => (
        <button key={o.key} type="button" role="radio" className="vd-seg__b" aria-checked={o.on} tabIndex={o.on || (i < 0 && k === 0) ? 0 : -1} onClick={o.pick} disabled={o.off}>
          {o.t}
        </button>
      ))}
    </div>
  );
}
