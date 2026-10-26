// The two networks' glyphs, drawn in the kit's line (currentColor, no brand colours): Instagram's camera and
// YouTube's play button. Decorative: the link around them says where it goes.
import type { SocialKey } from "../../lib/social";

export function SocialIcon({ name, size = 20, className }: { name: SocialKey; size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {name === "instagram" ? (
        <g fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
          <circle cx="12" cy="12" r="3.9" />
          <circle cx="17.1" cy="6.9" r="0.6" fill="currentColor" stroke="none" />
        </g>
      ) : (
        <g>
          <rect x="2.5" y="5.5" width="19" height="13" rx="4" fill="none" stroke="currentColor" strokeWidth={1.9} />
          <path d="M10.2 9.2v5.6l4.8-2.8z" fill="currentColor" />
        </g>
      )}
    </svg>
  );
}
