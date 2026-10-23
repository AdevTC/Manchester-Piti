// A surface of Tú (the bell's sheet, «Tú») opening out of its button and closing back into it, inside a View
// Transition (the board's openSurface / closeSurface). Beside ui.tsx: a plain module, not a component file.
import { isShot, prefersReducedMotion, supportsViewTransitions } from "../env";

/**
 * A surface (the bell's sheet, «Tú») grows out of its button and goes back into it (the board's openSurface /
 * closeSurface): the button carries the sheet's view-transition-name (`tu-bell`, `tu-acct`: the sheet's own, in
 * the CSS) in the snapshot where the sheet is not, so the two morph. `update` opens or closes it.
 */
export function tuSurface(opening: boolean, btn: HTMLElement | null, name: string, update: () => void): void {
  const d = document.documentElement;
  const clean = () => {
    d.removeAttribute("data-vd-dir");
    d.removeAttribute("data-vd-calm");
    d.removeAttribute("data-tu-surface");
    if (btn) btn.style.viewTransitionName = "";
  };
  if (!supportsViewTransitions() || isShot()) {
    update();
    return;
  }
  d.setAttribute("data-vd-dir", opening ? "up" : "left");
  if (prefersReducedMotion()) d.setAttribute("data-vd-calm", "");
  d.setAttribute("data-tu-surface", "");
  if (opening && btn) btn.style.viewTransitionName = name;
  const start = (document as Document & { startViewTransition: (cb: () => Promise<void> | void) => { finished: Promise<void> } }).startViewTransition;
  try {
    const vt = start.call(document, () => {
      if (opening && btn) btn.style.viewTransitionName = "";
      update();
      if (!opening && btn?.isConnected) btn.style.viewTransitionName = name;
    });
    vt.finished.then(clean, clean);
  } catch {
    clean();
    update();
  }
}
