// The sheet (law 5): on the phone and the tablet it comes up from the bottom over a scrim, only when asked; on the
// desktop it is the panel at the right edge (`center`: a centred dialog, for a confirmation). Always a real
// «Cerrar» in its head (B-SH-05: a sheet a screen reader could not close), Esc and the scrim close it too, the
// focus stays inside while it is open and goes back to what opened it. Fixed to the frame (never to the foot of
// what scrolls) and over the dock. On the layer stack: the app behind is inert while it is open.
import { useId, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { VIcon } from "../../../components/vidrio/VIcon";
import { useLayer, useLayerHost } from "../ui/layerCore";

export interface SalaSheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** A small line over the title («J3 · Red Demons»). */
  kicker?: ReactNode;
  /** The buttons at its foot (the action first). */
  footer?: ReactNode;
  /** Centred on the desktop (a confirmation) instead of the side panel. */
  center?: boolean;
  /** role=alertdialog: it asks before something that cannot be undone. */
  alert?: boolean;
  initialFocus?: RefObject<HTMLElement | null>;
  closeLabel?: string;
  className?: string;
  children?: ReactNode;
}

export function SalaSheet(props: SalaSheetProps) {
  return props.open ? <SheetLayer {...props} /> : null;
}

function SheetLayer({ onClose, title, kicker, footer, center, alert, initialFocus, closeLabel = "Cerrar", className = "", children }: SalaSheetProps) {
  const ref = useRef<HTMLDivElement>(null);
  const host = useLayerHost();
  const id = useId();
  const { isTop } = useLayer({ modal: true, trap: true, onClose, ref, initialFocus });
  const node = (
    <>
      <div className="sc-scrim" onClick={isTop ? onClose : undefined} aria-hidden="true" />
      <div ref={ref} className={`sc-sheet vd-glass vd-glass--deep${center ? " sc-sheet--center" : ""} ${className}`.trim()} role={alert ? "alertdialog" : "dialog"} aria-modal="true" aria-labelledby={id} tabIndex={-1}>
        <span className="sc-sheet__grab" aria-hidden="true" />
        <div className="sc-sheet__h">
          <h2 className="sc-h3" id={id}>
            {kicker && <small className="sc-sheet__k">{kicker}</small>}
            {title}
          </h2>
          <button type="button" className="vd-ibtn vd-glass vd-press" onClick={onClose} aria-label={closeLabel}>
            <VIcon name="close" size={18} />
          </button>
        </div>
        <div className="sc-sheet__b">{children}</div>
        {footer && <div className="sc-sheet__f">{footer}</div>}
      </div>
    </>
  );
  return host ? createPortal(node, host) : null;
}
