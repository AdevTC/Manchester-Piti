// The admin frame's width (the `.vx.sc` container, measured by AdminLayout with a ResizeObserver): views
// and layers use it for the same breakpoints the CSS container queries use (desktop ≥ 1100 px, r12).
import { createContext, useContext } from "react";

export interface Frame {
  /** Inner width of the admin frame, px. */
  width: number;
  /** ≥ 1100 px: the top bar, master–detail, drawers on the right, popovers instead of sheets. */
  desktop: boolean;
}
export const DESKTOP_MIN = 1100;
export const frameOf = (width: number): Frame => ({ width, desktop: width >= DESKTOP_MIN });

// Outside the admin frame (isolated component tests) the frame reads as a desktop window.
export const FrameContext = createContext<Frame>(frameOf(1440));
export function useFrame(): Frame {
  return useContext(FrameContext);
}
