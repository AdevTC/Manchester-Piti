// The vitrina's sheets (TuCarta B `.tc-sh`: the studio and the cromos): the scrim and the glass dialog with its
// kicker, title and «Cerrar». Portalled to the body inside a box-less `.tup` (display: contents), so the place's
// scoped rules reach it and its fixed boxes are the viewport's, not the container's (`main.tup` is a container: the
// containing block of fixed descendants). A dialog: the focus goes in and stays (Tab cycles), Esc closes, and the
// focus goes back where it was.
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { VIc } from "./icons";

const FOCUSABLE = 'button:not([disabled]):not([aria-disabled="true"]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function VSheet({ id, kick, title, desc, onClose, className, children, onKey }: { id: string; kick: string; title: string; desc?: string; onClose: () => void; className?: string; children: ReactNode; onKey?: (e: KeyboardEvent) => void }) {
  const box = useRef<HTMLElement | null>(null);
  const close = useRef(onClose);
  const key = useRef(onKey);
  useEffect(() => {
    close.current = onClose;
    key.current = onKey;
  });
  useEffect(() => {
    const el = box.current;
    const before = document.activeElement as HTMLElement | null;
    (el?.querySelector<HTMLElement>(".tv-sh__body " + FOCUSABLE) ?? el?.querySelector<HTMLElement>(FOCUSABLE))?.focus({ preventScroll: true });
    const onDoc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close.current();
        return;
      }
      key.current?.(e);
      if (e.key !== "Tab" || !el) return;
      const f = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (!el.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onDoc);
    return () => {
      document.removeEventListener("keydown", onDoc);
      before?.focus?.({ preventScroll: true });
    };
  }, []);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="tup tv-ovl">
      <button type="button" className="nx-scrim" aria-label="Cerrar" tabIndex={-1} onClick={onClose} />
      <section ref={box} className={`vd-glass vd-glass--deep nx-sheet tc-sh${className ? ` ${className}` : ""}`} role="dialog" aria-modal="true" aria-labelledby={id} aria-describedby={desc ? `${id}-d` : undefined}>
        <div className="nx-sheet__head">
          <div>
            <p className="nx-sheet__k">{kick}</p>
            <h2 id={id}>{title}</h2>
            {desc && (
              <p className="nx-meta" id={`${id}-d`}>
                {desc}
              </p>
            )}
          </div>
          <button type="button" className="vd-glass vd-press nx-ib tc-sh__x" onClick={onClose} aria-label="Cerrar">
            <VIc name="close" />
          </button>
        </div>
        <div className="tv-sh__body">{children}</div>
      </section>
    </div>,
    document.body,
  );
}
