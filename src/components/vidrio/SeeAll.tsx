// The summary's footer when there is more than it shows: «<b>31 jugadas más</b> desde el minuto 1» and the
// button that grows the panel («Ver todo el partido»). Nothing when there is nothing more.
import type { ReactNode } from "react";
import "../../styles/vidrio/components.css";

export interface SeeAllProps {
  /** The line on the left (the page words it: «<b>31 jugadas más</b> desde el minuto 1»). */
  summary: ReactNode;
  /** How many more there are (0 or less: the footer isn't drawn). */
  count: number;
  /** The button («Ver todo el partido», «Ver la tabla entera (14)»). */
  label: string;
  onOpen: () => void;
  /** The GrowWindow's id, for aria-controls. */
  controls?: string;
}

export function SeeAll({ summary, count, label, onOpen, controls }: SeeAllProps) {
  if (count <= 0) return null;
  return (
    <div className="vd-more">
      <span>{summary}</span>
      <button type="button" className="vd-more__btn" onClick={onOpen} aria-controls={controls} aria-expanded={false}>
        {label}
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
