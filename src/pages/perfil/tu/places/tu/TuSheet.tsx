// A sheet over «Tú» (TuCarta tc-sh): the scrim, the dialog with its kicker, title and «Cerrar». A dialog for real:
// the focus goes in (the first control) and stays (Tab cycles inside), Esc and the scrim close it, the focus goes
// back to what opened it. Rendered in the body once in the browser — the page's content root is a container, the
// containing block of fixed boxes — inside a `.tup` wrapper so the place's scoped rules still reach it.
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { TuIcon } from "../../../../../components/vidrio/tu/ui";

const FOCUSABLE = 'button:not([disabled]):not([aria-disabled="true"]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';
const subscribeNothing = () => () => {};
const useInBrowser = (): boolean => useSyncExternalStore(subscribeNothing, () => true, () => false);

export function TuSheet({ id, kick, title, onClose, className, children }: { id: string; kick?: string; title: string; onClose: () => void; className?: string; children: ReactNode }) {
  const box = useRef<HTMLElement | null>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  const inBrowser = useInBrowser();

  useEffect(() => {
    const el = box.current;
    const before = document.activeElement as HTMLElement | null;
    const html = document.documentElement;
    html.style.overflow = "hidden";
    (el?.querySelector<HTMLElement>(FOCUSABLE) ?? el)?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close.current();
        return;
      }
      if (e.key !== "Tab" || !el) return;
      const f = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      html.style.overflow = "";
      before?.focus?.({ preventScroll: true });
    };
  }, []);

  const node = (
    <div className="tup tu-shroot">
      <button type="button" className="nx-scrim" aria-label="Cerrar" tabIndex={-1} onClick={onClose} />
      <section ref={box} tabIndex={-1} className={`vd-glass vd-glass--deep nx-sheet tc-sh${className ? ` ${className}` : ""}`} role="dialog" aria-modal="true" aria-labelledby={id}>
        <div className="nx-sheet__head">
          <div>
            {kick && <p className="nx-sheet__k">{kick}</p>}
            <h2 id={id}>{title}</h2>
          </div>
          <button type="button" className="vd-glass vd-press nx-ib tc-sh__x" onClick={onClose} aria-label="Cerrar">
            <TuIcon name="close" className="nx-ic" />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
  return inBrowser ? createPortal(node, document.body) : node;
}
