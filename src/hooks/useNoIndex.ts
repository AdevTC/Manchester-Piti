import { useEffect } from "react";

/** While mounted (and `on`), tells crawlers not to index the page (a 404 or a «no encontrado» is served
 *  with a 200 by the SPA shell); the previous robots value, or none, comes back on unmount / when off. */
export function useNoIndex(on = true) {
  useEffect(() => {
    if (!on) return;
    let meta = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const before = meta?.getAttribute("content") ?? null;
    const created = !meta;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "robots";
      document.head.appendChild(meta);
    }
    meta.content = "noindex";
    return () => {
      if (created) meta.remove();
      else if (before === null) meta.removeAttribute("content");
      else meta.content = before;
    };
  }, [on]);
}
