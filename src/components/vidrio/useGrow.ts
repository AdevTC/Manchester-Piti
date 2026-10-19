// «Ver todo» that grows in place: a summary panel and its expanded window share one view-transition-name (only
// one of them carries it at a time), and the change runs through swap("up") so the panel morphs into the
// stage's main window and back. Spread `summaryProps` on the summary panel and `windowProps` on GrowWindow.
import { useState, type CSSProperties } from "react";
import { swap } from "./transitions";

export interface Grow {
  open: boolean;
  grow: () => void;
  close: () => void;
  summaryProps: { className: string; style?: CSSProperties };
  windowProps: { name: string };
}

export function useGrow(name: string): Grow {
  const [open, setOpen] = useState(false);
  const run = (next: boolean) => {
    swap("up", () => setOpen(next));
  };
  return {
    open,
    grow: () => run(true),
    close: () => run(false),
    summaryProps: open ? { className: "vd-grow-src" } : { className: "vd-grow-src", style: { viewTransitionName: name } },
    windowProps: { name },
  };
}
