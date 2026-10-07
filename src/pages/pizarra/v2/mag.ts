// Buttons that lean toward the pointer (the gold ones): spread `mag` on the button.
import type { PointerEvent } from "react";

const magMove = (e: PointerEvent<HTMLElement>) => {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return;
  el.style.setProperty("--tx", (((e.clientX - r.left) / r.width - 0.5) * 10).toFixed(1));
  el.style.setProperty("--ty", (((e.clientY - r.top) / r.height - 0.5) * 8).toFixed(1));
};
const magLeave = (e: PointerEvent<HTMLElement>) => {
  e.currentTarget.style.removeProperty("--tx");
  e.currentTarget.style.removeProperty("--ty");
};
export const mag = { onPointerMove: magMove, onPointerLeave: magLeave };
