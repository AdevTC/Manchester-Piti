// The lens: the one memorable glass object of a screen (the match). Radius 44 on desktop, 36 on a phone, a
// lighter tint and real refraction where Chromium can (useRefraction), plus the glint layer the goal moment
// sweeps. Its contents (teams, score, ribbon) are the page's.
import { useRef, type CSSProperties, type HTMLAttributes, type ReactNode, type RefObject } from "react";
import { useRefraction } from "./useRefraction";
import type { LensOptions } from "./refraction";
import "../../styles/vidrio/tokens.css";
import "../../styles/vidrio/glass.css";
import "../../styles/vidrio/components.css";

export interface LensProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  as?: "div" | "section" | "article";
  /** Real refraction (default on; an object tunes bezel, strength and blur). */
  refract?: boolean | LensOptions;
  /** The goal moment's classes for the lens (useGoalMoment().lens). */
  goal?: string;
  /** A view-transition-name, when the lens morphs between states (the drop → the match page's scoreboard). */
  morphName?: string;
  children?: ReactNode;
}

export function Lens({ as = "div", refract = true, goal, morphName, className, style, children, ...rest }: LensProps) {
  const ref = useRef<HTMLElement | null>(null);
  useRefraction(ref, typeof refract === "object" ? refract : { bezel: 26, strength: 1.2, blur: 14 }, refract !== false);
  const cls = ["vd-glass", "vd-glass--lens", "vd-lens", morphName && "vd-morph", goal, className].filter(Boolean).join(" ");
  const st: CSSProperties | undefined = morphName ? { ...style, viewTransitionName: morphName } : style;
  const Tag = as;
  // (section and article are plain HTMLElements; the div's ref type is the narrowest of the three)
  return (
    <Tag {...rest} ref={ref as RefObject<HTMLDivElement | null>} className={cls} style={st}>
      <span className="vd-glint" aria-hidden="true" />
      {children}
    </Tag>
  );
}
