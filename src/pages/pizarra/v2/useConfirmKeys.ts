// While a confirmation is open in a panel («¿Borrar…?», «¿Quitar el oficial?»): Escape closes only it (not
// the panel), and the tool keys 1–8 don't leave it behind. It hears the keys before the board does (the
// window's capture phase) and marks them handled, so the board's own keys let them be.
import { useEffect, useRef } from "react";

export function useConfirmKeys(open: boolean, close: () => void): void {
  const closeLatest = useRef(close);
  useEffect(() => {
    closeLatest.current = close;
  });
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target instanceof HTMLElement ? e.target : null;
      const typing = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if (e.key === "Escape") {
        e.preventDefault();
        closeLatest.current();
      } else if (!typing && /^[1-8]$/.test(e.key)) e.preventDefault();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);
}
