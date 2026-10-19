// The score's own window: portals `children` into the Document Picture-in-Picture window, or draws the in-page
// fallback — a glass window you drag by its title bar (snaps to the corners, remembers its spot), resize by its
// grip and close with its button or Escape. Either way `onClose` runs when it goes.
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { ScorePip } from "./pip";
import { useDraggable } from "./useDraggable";
import "../../styles/vidrio/tokens.css";
import "../../styles/vidrio/glass.css";
import "../../styles/vidrio/components.css";

export interface PipWindowProps {
  pip: ScorePip | null;
  /** The title bar's words («Manchester Piti contra Orduña fc»). */
  title: string;
  onClose: () => void;
  children: ReactNode;
}

function InPage({ title, onClose, children }: Omit<PipWindowProps, "pip">) {
  const win = useRef<HTMLDivElement | null>(null);
  const bar = useRef<HTMLDivElement | null>(null);
  useDraggable(win, {
    storageKey: "pip",
    handle: bar,
    anchors: "corners",
    margin: 16,
    top: 16,
    home: (b) => ({ x: b.W - b.w - 24, y: b.H - b.h - 24 }),
  });
  return createPortal(
    <div
      ref={win}
      className="vd-glass vd-glass--deep vd-pip"
      role="dialog"
      aria-label={title}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div ref={bar} className="vd-pip__bar" tabIndex={0} aria-label={`${title}. Arrástralo o muévelo con las flechas`}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <span aria-hidden="true">{title}</span>
        <button type="button" onClick={onClose} data-vd-nodrag="" aria-label="Cerrar el marcador">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="vd-pip__body">{children}</div>
      <span className="vd-pip__grip" aria-hidden="true" />
    </div>,
    document.body,
  );
}

export function PipWindow({ pip, title, onClose, children }: PipWindowProps) {
  useEffect(() => {
    if (pip?.kind !== "document") return;
    const gone = () => onClose();
    pip.win.addEventListener("pagehide", gone);
    return () => pip.win.removeEventListener("pagehide", gone);
  }, [pip, onClose]);
  if (!pip) return null;
  if (pip.kind === "document") return createPortal(<div className="vd-pip__body vd-pip__body--doc">{children}</div>, pip.container);
  return (
    <InPage title={title} onClose={onClose}>
      {children}
    </InPage>
  );
}
