// «Tú» (TU boards): the behaviour the page and the chrome's surfaces share, apart from the components (ui.tsx) —
// the boards' roving focus, the toast and the move between screens (a View Transition: exit → morph → enter).
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { isShot, prefersReducedMotion, supportsViewTransitions } from "../env";
import { TuIcon } from "./ui";

/** ↑ ↓ Inicio Fin move the focus between `sel` inside the element the key landed on (the boards' rove). */
export function rove(e: KeyboardEvent<HTMLElement>, sel: string): void {
  const k = e.key;
  if (k !== "ArrowDown" && k !== "ArrowUp" && k !== "Home" && k !== "End") return;
  const items = [...e.currentTarget.querySelectorAll<HTMLElement>(sel)].filter((x) => !(x as HTMLButtonElement).disabled && x.offsetParent !== null);
  if (!items.length) return;
  e.preventDefault();
  const i = items.indexOf(document.activeElement as HTMLElement);
  const n = items.length;
  const j = k === "Home" ? 0 : k === "End" ? n - 1 : k === "ArrowDown" ? (i + 1) % n : (i - 1 + n) % n;
  items[j]?.focus();
}

/** The toast and its live region: `say(text)` shows it for 2.8 s. */
export function useToast() {
  const [said, setSaid] = useState({ t: "", on: false });
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const say = useCallback((t: string) => {
    window.clearTimeout(timer.current);
    setSaid({ t, on: true });
    timer.current = window.setTimeout(() => setSaid((s) => ({ ...s, on: false })), 2800);
  }, []);
  const node = (
    <>
      <p className="vd-vh" role="status" aria-live="polite">
        {said.t}
      </p>
      <div className={`vd-glass tu-toast${said.on ? " is-on" : ""}`} aria-hidden="true">
        <TuIcon name="check" />
        <span>{said.t}</span>
      </div>
    </>
  );
  return { say, node };
}

export type TuDir = "left" | "right" | "up";

/**
 * A move between Tú's screens, or a surface opening over the same screen (`surface`: the screen's regions stay
 * put): html[data-vd-dir] + a View Transition whose update may be async (a router navigation). Without View
 * Transitions or in a design shot it just happens; reduced motion gets the calm crossfade.
 */
export function tuGo(dir: TuDir, update: () => void | Promise<void>, surface = false): void {
  const d = document.documentElement;
  const clean = () => {
    d.removeAttribute("data-vd-dir");
    d.removeAttribute("data-vd-calm");
    d.removeAttribute("data-tu-surface");
  };
  if (!supportsViewTransitions() || isShot()) {
    void update();
    return;
  }
  d.setAttribute("data-vd-dir", dir);
  if (prefersReducedMotion()) d.setAttribute("data-vd-calm", "");
  if (surface) d.setAttribute("data-tu-surface", "");
  const start = (document as Document & { startViewTransition: (cb: () => Promise<void> | void) => { finished: Promise<void> } }).startViewTransition;
  try {
    const vt = start.call(document, async () => {
      await update();
    });
    vt.finished.then(clean, clean);
  } catch {
    clean();
    void update();
  }
}
