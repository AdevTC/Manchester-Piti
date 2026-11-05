import { useSyncExternalStore } from "react";

/** The theme <html data-theme> is in now (in the browser only). */
export const documentTheme = (): "dark" | "light" => (document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
const read = documentTheme;
function subscribe(onChange: () => void) {
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}

/** Follows <html data-theme> (the global theme switch), so 3D lighting can flip with it. «Día» on the server and
 *  while React takes a server-rendered page over (the server can't know the theme), then the page's own. */
export function useDocumentTheme(): "dark" | "light" {
  return useSyncExternalStore(subscribe, read, () => "light");
}
