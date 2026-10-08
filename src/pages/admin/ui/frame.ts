// The admin frame's width (the `.vx.adm` container, measured by AdminLayout with a ResizeObserver): views
// and layers use it for the same breakpoints the CSS container queries use (desktop app ≥ 1000 px).
import { createContext, useContext } from "react";

export interface Frame {
  /** Inner width of the admin frame, px. */
  width: number;
  /** ≥ 1000 px: side menu, master–detail, drawers on the right, popovers instead of sheets. */
  desktop: boolean;
}
export const DESKTOP_MIN = 1000;
export const frameOf = (width: number): Frame => ({ width, desktop: width >= DESKTOP_MIN });

// Outside the admin frame (isolated component tests) the frame reads as a desktop window.
export const FrameContext = createContext<Frame>(frameOf(1440));
export function useFrame(): Frame {
  return useContext(FrameContext);
}
