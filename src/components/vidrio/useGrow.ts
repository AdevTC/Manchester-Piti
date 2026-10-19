// «Ver todo» that grows in place: a summary panel and its expanded window share one view-transition-name (only
// one of them carries it at a time), and the change runs through swap("up") so the panel morphs into the
// stage's main window and back. Spread `summaryProps` on the summary panel and `windowProps` on GrowWindow.
// Focus: the window's title takes it on open (GrowWindow); on close it goes back to the «Ver todo» that opened
// it — the same button, or, when the summary was drawn again, its new «Ver todo» (never the page's start).
import { useRef, useState, type CSSProperties } from "react";
import { swap } from "./transitions";

export interface Grow {
  open: boolean;
  grow: () => void;
  close: () => void;
  summaryProps: { className: string; style?: CSSProperties; "data-vd-grow": string };
  windowProps: { name: string };
}

export function useGrow(name: string): Grow {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const run = (next: boolean) => {
    if (next && typeof document !== "undefined" && document.activeElement instanceof HTMLElement && document.activeElement !== document.body) opener.current = document.activeElement;
    const { finished } = swap("up", () => setOpen(next));
    if (next) return;
    void finished.then(() => {
      const back = opener.current?.isConnected ? opener.current : document.querySelector<HTMLElement>(`[data-vd-grow="${name}"] .vd-more__btn`);
      back?.focus({ preventScroll: true });
    });
  };
  return {
    open,
    grow: () => run(true),
    close: () => run(false),
    summaryProps: open ? { className: "vd-grow-src", "data-vd-grow": name } : { className: "vd-grow-src", style: { viewTransitionName: name }, "data-vd-grow": name },
    windowProps: { name },
  };
}
