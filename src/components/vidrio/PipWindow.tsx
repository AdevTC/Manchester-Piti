// The score's own window: portals `children` into the Document Picture-in-Picture window, or draws the in-page
// fallback — the kit's .v-pip, a 330 × 150 glass window (the Inicio and Partidos boards) you drag by its title
// bar (crest, «Manchester Piti, marcador», «Volver a la pestaña», «×»), snapping to the corners and remembering
// its spot; it starts in the bottom-right corner (24 px in; higher where the floating score rests bottom-right),
// resizes by its grip (260 × 128 to 560 × 300) and remembers its size; Escape or «×» close it. Either way
// `onClose` runs when it goes. (The real Document PiP window keeps V-Vivo's 420 × 236: pip.ts.)
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { ScorePip } from "./pip";
import { useDraggable } from "./useDraggable";
import { VIcon } from "./VIcon";
import "../../styles/vidrio/tokens.css";
import "../../styles/vidrio/glass.css";
import "../../styles/vidrio/components.css";

export interface PipWindowProps {
  pip: ScorePip | null;
  /** The window's name for assistive tech («Marcador en una ventana aparte»). */
  title: string;
  onClose: () => void;
  /** Space under the in-page window at home (default 24; 110 where the floating score rests bottom-right, as the
   *  Partidos board: pipBottom). */
  bottom?: number;
  children: ReactNode;
}

const SIZE_KEY = "vd-pip-size";

function readSize(): { w: number; h: number } | null {
  try {
    const v = JSON.parse(localStorage.getItem(SIZE_KEY) ?? "null") as unknown;
    if (v && typeof v === "object" && "w" in v && "h" in v && typeof v.w === "number" && typeof v.h === "number") return { w: v.w, h: v.h };
  } catch {
    // (storage blocked or broken: the default size)
  }
  return null;
}

function InPage({ title, onClose, bottom = 24, children }: Omit<PipWindowProps, "pip">) {
  const win = useRef<HTMLDivElement | null>(null);
  const bar = useRef<HTMLDivElement | null>(null);
  useDraggable(win, {
    storageKey: "pip",
    handle: bar,
    anchors: "corners",
    margin: 24,
    top: 96,
    home: (b) => ({ x: b.W - b.w - 24, y: b.H - b.h - bottom }),
  });
  // its size, as the viewer left it
  useEffect(() => {
    const el = win.current;
    if (!el) return;
    const saved = readSize();
    if (saved) {
      el.style.width = `${saved.w}px`;
      el.style.height = `${saved.h}px`;
    }
    if (typeof ResizeObserver !== "function") return;
    let first = true;
    const ro = new ResizeObserver(() => {
      if (first) {
        first = false;
        return;
      }
      try {
        localStorage.setItem(SIZE_KEY, JSON.stringify({ w: Math.round(el.offsetWidth), h: Math.round(el.offsetHeight) }));
      } catch {
        // (storage blocked: the size lasts this visit)
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
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
      <div ref={bar} className="vd-pip__bar" tabIndex={0} aria-label="Arrastra la ventana; flechas para llevarla a otra esquina">
        <img className="vd-pip__fav" src="/crest-128.webp" alt="" width={18} height={18} />
        <span aria-hidden="true">Manchester Piti, marcador</span>
        <button
          type="button"
          onClick={() => {
            window.focus();
            onClose();
          }}
          data-vd-nodrag=""
          aria-label="Volver a la pestaña"
        >
          <VIcon name="tab" size={17} />
        </button>
        <button type="button" onClick={onClose} data-vd-nodrag="" aria-label="Cerrar la ventana">
          <VIcon name="close" size={16} />
        </button>
      </div>
      <div className="vd-pip__body">{children}</div>
      <span className="vd-pip__grip" aria-hidden="true" />
    </div>,
    document.body,
  );
}

export function PipWindow({ pip, title, onClose, bottom, children }: PipWindowProps) {
  useEffect(() => {
    if (pip?.kind !== "document") return;
    const gone = () => onClose();
    pip.win.addEventListener("pagehide", gone);
    return () => pip.win.removeEventListener("pagehide", gone);
  }, [pip, onClose]);
  if (!pip) return null;
  if (pip.kind === "document") return createPortal(<div className="vd-pip__body vd-pip__body--doc">{children}</div>, pip.container);
  return (
    <InPage title={title} onClose={onClose} bottom={bottom}>
      {children}
    </InPage>
  );
}
