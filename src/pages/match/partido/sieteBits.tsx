// «El siete»: the marks beside a shirt (a goal, an assist, a card, a saved penalty, a change, the MVP's star), drawn
// the same on the pitch and the bench of every moment of the match day.
import type { CSSProperties } from "react";
import { Icon } from "./bits";
import { tagIcon, type TagView } from "./sieteModel";

const SVG = { viewBox: "0 0 24 24", "aria-hidden": true, fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round" } as const;
export function TagGlyph({ k }: { k: TagView["k"] }) {
  const g = tagIcon(k);
  if (g === "gol")
    return (
      <svg {...SVG}>
        <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4.2 3.6 2.6-1.4 4.2H9.8L8.4 9.8Zm0-4.2v4.2m3.6 2.6 4.1-1.2M14.2 14l2.5 3.4M9.8 14l-2.5 3.4M8.4 9.8 4.3 8.6" />
      </svg>
    );
  if (g === "asis")
    return (
      <svg {...SVG}>
        <path d="M6 18 18 6m0 0H9m9 0v9" />
      </svg>
    );
  if (g === "parada")
    return (
      <svg {...SVG}>
        <path d="M8 21h8l1.5-7V7.5a1.5 1.5 0 0 0-3 0V11V5a1.5 1.5 0 0 0-3 0v6V4.5a1.5 1.5 0 0 0-3 0V12l-1.6-1.8a1.5 1.5 0 0 0-2.3 1.9L8 17Z" />
      </svg>
    );
  if (g === "cambio")
    return (
      <svg {...SVG}>
        <path d="M4 8h13l-3-3m6 11H7l3 3" />
      </svg>
    );
  if (g === "star")
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z" fill="currentColor" />
      </svg>
    );
  if (g === "pen") return <Icon name="whistle" className="" />;
  return null;
}
export function Tags({ tags, className, style }: { tags: TagView[]; className: string; style?: CSSProperties }) {
  return (
    <span className={`vd-tags ${className}`} style={style}>
      {tags.map((t) => (
        <span key={t.key} className={`vd-tag ${t.cls}`} role="img" aria-label={t.label}>
          <TagGlyph k={t.k} />
          {t.text}
        </span>
      ))}
    </span>
  );
}

