// The expanded window a summary grows into: glass, full height of the stage's main window (the page places it
// with className/style), a sticky header with the title, optional filters and «Cerrar», and a body with its own
// scroll. Focus moves to the title on open and back to where it was on close; Escape closes.
import { useEffect, useId, useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import "../../styles/vidrio/tokens.css";
import "../../styles/vidrio/glass.css";
import "../../styles/vidrio/components.css";

export interface GrowWindowProps {
  open: boolean;
  title: string;
  /** A line under the title. */
  sub?: ReactNode;
  /** Filters (a Shelf variant="seg", chips…) in the header. */
  filters?: ReactNode;
  onClose: () => void;
  /** The shared view-transition-name (useGrow().windowProps.name). */
  name?: string;
  id?: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

export function GrowWindow({ open, title, sub, filters, onClose, name, id, className, style, children }: GrowWindowProps) {
  const titleId = useId();
  const heading = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const back = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    heading.current?.focus({ preventScroll: true });
    return () => {
      if (back?.isConnected) back.focus({ preventScroll: true });
    };
  }, [open]);
  if (!open) return null;
  const onKey = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    }
  };
  return (
    <section id={id} className={`vd-glass vd-glass--deep vd-grow${className ? ` ${className}` : ""}`} style={name ? { ...style, viewTransitionName: name } : style} aria-labelledby={titleId} onKeyDown={onKey}>
      <header className="vd-grow__head">
        <h2 id={titleId} ref={heading} tabIndex={-1}>
          {title}
        </h2>
        {filters}
        <button type="button" className="vd-glass vd-grow__close vd-press" onClick={onClose}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
          Cerrar
        </button>
        {sub && <p>{sub}</p>}
      </header>
      <div className="vd-grow__body" tabIndex={0}>
        {children}
      </div>
    </section>
  );
}
