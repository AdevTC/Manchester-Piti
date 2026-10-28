// The networks' glyphs, drawn in the kit's line (currentColor, no brand colours): Instagram's camera, YouTube's play
// button and (r12 M-45, clubContent.socials) TikTok's note, WhatsApp's bubble, X's cross, Facebook's f, Twitch's
// speech box and a globe for the web. Decorative: the link around them says where it goes.
import type { SocialKey } from "../../lib/social";

const LINE = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function Glyph({ name }: { name: SocialKey }) {
  switch (name) {
    case "instagram":
      return (
        <g {...LINE}>
          <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
          <circle cx="12" cy="12" r="3.9" />
          <circle cx="17.1" cy="6.9" r="0.6" fill="currentColor" stroke="none" />
        </g>
      );
    case "youtube":
      return (
        <g>
          <rect x="2.5" y="5.5" width="19" height="13" rx="4" fill="none" stroke="currentColor" strokeWidth={1.9} />
          <path d="M10.2 9.2v5.6l4.8-2.8z" fill="currentColor" />
        </g>
      );
    case "tiktok":
      return (
        <g {...LINE}>
          <path d="M13.5 3.5v11.2a3.6 3.6 0 1 1-3.6-3.6" />
          <path d="M13.5 3.5c.4 2.6 2.2 4.3 5 4.5" />
        </g>
      );
    case "whatsapp":
      return (
        <g {...LINE}>
          <path d="M4.2 19.8l1.2-3.9A8.2 8.2 0 1 1 8.6 19z" />
          <path d="M9.2 8.6c0 3.2 2.9 6.2 6.1 6.2l1-1.4-2-1-.9.8a4.4 4.4 0 0 1-2.4-2.4l.8-.9-1-2z" />
        </g>
      );
    case "x":
      return (
        <g {...LINE}>
          <path d="M4.5 4.5l15 15M19.5 4.5l-15 15" />
        </g>
      );
    case "facebook":
      return (
        <g {...LINE}>
          <path d="M14.8 3.8h-1.6a3.4 3.4 0 0 0-3.4 3.4v13" />
          <path d="M7.4 11h7.2" />
        </g>
      );
    case "twitch":
      return (
        <g {...LINE}>
          <path d="M5 3.8h14.5v10l-4 4h-3.6L9 20.5v-2.7H5z" />
          <path d="M11 8.2v4M15 8.2v4" />
        </g>
      );
    default:
      return (
        <g {...LINE}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M3.5 12h17M12 3.5c2.4 2.3 3.6 5.1 3.6 8.5S14.4 18.2 12 20.5M12 3.5C9.6 5.8 8.4 8.6 8.4 12s1.2 6.2 3.6 8.5" />
        </g>
      );
  }
}

export function SocialIcon({ name, size = 20, className }: { name: SocialKey; size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <Glyph name={name} />
    </svg>
  );
}
