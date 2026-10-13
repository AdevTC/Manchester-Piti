// Bloque 5 · modo presentación: on and off (the P key, «Presentar», Esc, «Salir»), the browser's full
// screen where it can (else the presentation fills the window), and the focus: into the presentation's
// controls when it opens, back to what opened it when it closes. Leaving the browser's full screen (its
// own Esc) closes the presentation too.
import { useEffect, useRef, useState, type RefObject } from "react";
import { enterFullscreen, leaveFullscreen } from "./presenta";

export interface Presenta {
  on: boolean;
  enter: () => void;
  exit: () => void;
  toggle: () => void;
}

export function usePresenta(root: RefObject<HTMLElement | null>, announce: (msg: string) => void): Presenta {
  const [on, setOn] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  /** The browser's full screen was ours. */
  const fs = useRef(false);
  const latest = useRef(announce);
  useEffect(() => {
    latest.current = announce;
  });

  const enter = () => {
    if (on) return;
    const act = typeof document !== "undefined" ? document.activeElement : null;
    opener.current = act instanceof HTMLElement && act !== document.body ? act : null;
    setOn(true);
    announce("Modo presentación: el campo a toda pantalla. Esc o P para salir.");
    void enterFullscreen(root.current).then((ok) => {
      fs.current = ok;
    });
  };
  const exit = () => {
    if (!on) return;
    setOn(false);
    announce("Fin del modo presentación");
    if (fs.current) {
      fs.current = false;
      void leaveFullscreen(document);
    }
    const back = opener.current;
    opener.current = null;
    if (back?.isConnected) window.setTimeout(() => back.focus({ preventScroll: true }), 0);
  };

  // the browser's own way out of its full screen (its Esc, a gesture) closes the presentation
  useEffect(() => {
    if (!on || typeof document === "undefined") return;
    const onFs = () => {
      if (fs.current && !document.fullscreenElement) {
        fs.current = false;
        setOn(false);
        latest.current("Fin del modo presentación");
      }
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, [on]);

  // leaving the pizarra (a link, the back button) while presenting gives the browser its window back
  useEffect(
    () => () => {
      if (fs.current && typeof document !== "undefined" && document.fullscreenElement) {
        fs.current = false;
        void leaveFullscreen(document);
      }
    },
    [],
  );

  return { on, enter, exit, toggle: () => (on ? exit() : enter()) };
}
