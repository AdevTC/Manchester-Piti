// The portada's small pieces: the boards' sprite icons (the kit's VIcon glyphs plus the chevrons, play, pause and
// the cloud), the printed shirt still (pp-tee: the player's own still from the page's KitStillContext, cropped to
// the shirt; a quiet silhouette until the scene has drawn it, never a number set in CSS), the segmented control.
import { useContext, type CSSProperties, type ReactNode } from "react";
import { VIcon, type VIconName } from "../../../components/vidrio";
import { KitStillContext, type Kit } from "../../../components/jersey3d/kitStill";

const S = { fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" } as const;
const EXTRA = {
  "chev-l": <path {...S} strokeWidth={2.2} d="M15 5l-7 7 7 7" />,
  "chev-r": <path {...S} strokeWidth={2.2} d="M9 5l7 7-7 7" />,
  play: <path fill="currentColor" d="M8 5.5v13l11-6.5z" />,
  pause: (
    <>
      <rect fill="currentColor" x="6.5" y="5" width="4" height="14" rx="1.2" />
      <rect fill="currentColor" x="13.5" y="5" width="4" height="14" rx="1.2" />
    </>
  ),
  cloud: <path {...S} strokeWidth={2} d="M7 18h10a4 4 0 00.6-7.96A5.5 5.5 0 006.5 9.6 4.2 4.2 0 007 18z" />,
} satisfies Record<string, ReactNode>;

export type IconName = VIconName | keyof typeof EXTRA;

/** A board icon (`pp-i`: 20 px unless a rule sizes it). */
export function PI({ name, className }: { name: string; className?: string }) {
  const extra = (EXTRA as Record<string, ReactNode>)[name];
  if (extra)
    return (
      <svg className={`pp-i${className ? ` ${className}` : ""}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        {extra}
      </svg>
    );
  return <VIcon name={(name || "ball") as VIconName} className={`pp-i${className ? ` ${className}` : ""}`} />;
}

/** A player's printed shirt still (his name and dorsal as the scene prints them), or the kit's blank one. */
export function Tee({ num, kit = "home", className, style, vt }: { num?: string; kit?: Kit; className?: string; style?: CSSProperties; vt?: string }) {
  const still = useContext(KitStillContext)(kit, num || undefined);
  const st = vt ? { ...style, viewTransitionName: vt } : style;
  return (
    <span className={`pp-tee${still ? "" : " is-wait"}${className ? ` ${className}` : ""}`} style={st} aria-hidden="true">
      {still && <img src={still.src} alt="" />}
    </span>
  );
}

export interface SegOpt {
  id: string;
  t: string;
  on: boolean;
}

/** The kit's segmented control: a radiogroup with its bead under the chosen one (hidden while none is). */
export function Seg({ label, labelledBy, opts, onPick, className, glass = true, busy }: { label?: string; labelledBy?: string; opts: readonly SegOpt[]; onPick: (id: string) => void; className?: string; glass?: boolean; busy?: boolean }) {
  const i = Math.max(0, opts.findIndex((o) => o.on));
  const any = opts.some((o) => o.on);
  return (
    <div className={`${glass ? "vd-glass " : ""}vd-seg${className ? ` ${className}` : ""}`} role="radiogroup" aria-label={label} aria-labelledby={labelledBy} aria-busy={busy || undefined} data-on={any ? "true" : "false"} style={{ "--n": opts.length, "--i": i } as CSSProperties}>
      <span className="vd-shelf__bead" aria-hidden="true" />
      {opts.map((o) => (
        <button key={o.id} type="button" role="radio" className="vd-seg__b" aria-checked={o.on} onClick={() => onPick(o.id)}>
          {o.t}
        </button>
      ))}
    </div>
  );
}
