// «/» focuses the current list's search (like most web apps), unless the captain is typing somewhere or
// a layer (drawer, modal, palette) has made the list inert.
import { useEffect, type RefObject } from "react";

export function useSlashFocus(ref: RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      const t = e.target instanceof HTMLElement ? e.target : null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const input = ref.current;
      if (!input || input.closest("[inert]")) return;
      e.preventDefault();
      input.focus({ preventScroll: true });
      input.select();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [ref]);
}
