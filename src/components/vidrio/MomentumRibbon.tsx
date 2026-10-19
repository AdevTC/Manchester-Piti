// The momentum ribbon inside the lens: minute ruler, who presses (Piti above, the rival below), marks on goals,
// cards, posts and saves, the gold peak on our latest goal and the «now» line while it is live. One image for
// a screen reader: a group named `label`, each mark an image with its own words.
import { useId } from "react";
import { RIBBON_H, RIBBON_W, ribbonModel, type MarkIcon, type RibbonItem } from "./momentum";
import "../../styles/vidrio/components.css";

export interface MomentumRibbonProps {
  items: readonly RibbonItem[];
  /** The match's length in minutes. */
  duration: number;
  /** The clock in minutes while live (omit after the final whistle). */
  now?: number;
  /** Which goal is gold (default: our latest); null for none. */
  goldId?: string | null;
  /** The whole ribbon's accessible name. */
  label?: string;
  /** Raise the gold peak with the goal moment (useGoalMoment().peak). */
  peakClassName?: string;
  className?: string;
}

function MarkGlyph({ icon }: { icon: MarkIcon }) {
  if (icon === "card" || icon === "red") return null;
  if (icon === "post")
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 20V5h14v15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="15.5" cy="9" r="3" fill="currentColor" />
      </svg>
    );
  if (icon === "glove")
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 21v-6.5L4.5 11a1.6 1.6 0 012.4-2L8 10.2V5.5a1.5 1.5 0 013 0V10V4.5a1.5 1.5 0 013 0V10V5.5a1.5 1.5 0 013 0V15l-2 6z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7.5l3.6 2.6-1.4 4.2H9.8L8.4 10.1z" fill="currentColor" />
    </svg>
  );
}

export function MomentumRibbon({ items, duration, now, goldId, label = "El partido minuto a minuto: arriba aprieta el Piti, abajo el rival", peakClassName, className }: MomentumRibbonProps) {
  const id = useId().replace(/:/g, "");
  const m = ribbonModel(items, duration, now, goldId);
  return (
    <div className={`vd-ribbon${className ? ` ${className}` : ""}`} role="group" aria-label={label}>
      <svg viewBox={`0 0 ${RIBBON_W} ${RIBBON_H}`} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id={`${id}-us`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#EAF3FC" stopOpacity=".75" />
            <stop offset="1" stopColor="#6CABDD" stopOpacity=".12" />
          </linearGradient>
          <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFC659" stopOpacity=".95" />
            <stop offset="1" stopColor="#FFC659" stopOpacity=".1" />
          </linearGradient>
        </defs>
        <line className="vd-ribbon__axis" x1="0" y1="37" x2={RIBBON_W} y2="37" />
        <line className="vd-ribbon__tick" x1={RIBBON_W / 2} y1="22" x2={RIBBON_W / 2} y2="52" strokeDasharray="2 3" />
        <path className="vd-ribbon__us" d={m.us} fill={`url(#${id}-us)`} />
        <path className="vd-ribbon__them" d={m.them} />
        {m.peak && <path className={`vd-peak${peakClassName ? ` ${peakClassName}` : ""}`} d={m.peak} fill={`url(#${id}-gold)`} />}
      </svg>
      {m.marks.map((k) => (
        <span
          key={k.id}
          className={`vd-ribbon__mark vd-ribbon__mark--${k.icon}${k.side === "them" ? " vd-ribbon__mark--them" : ""}${k.gold ? " vd-ribbon__mark--gold" : ""}`}
          style={{ left: `${k.left}%`, top: `${k.top}%` }}
          role={k.label ? "img" : undefined}
          aria-label={k.label || undefined}
          aria-hidden={k.label ? undefined : true}
        >
          <MarkGlyph icon={k.icon} />
        </span>
      ))}
      {m.now != null && <span className="vd-ribbon__now" style={{ left: `${m.now}%` }} aria-hidden="true" />}
      {m.labels.map((l) => (
        <span key={l.text} className={`vd-ribbon__lab vd-ribbon__lab--${l.align}`} style={{ left: `${l.left}%` }} aria-hidden="true">
          {l.text}
        </span>
      ))}
    </div>
  );
}
