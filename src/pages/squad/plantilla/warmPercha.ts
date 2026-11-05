// Plantilla's largest paint is a hanging shirt: the kit's blank still (the 3D scene's, made in the browser), which
// every hanger wears until its player's printed one is ready. The page asks for it once React has taken the page
// over and the browser is idle (useShirtStills); the route sends for it as the visitor arrives (router.tsx), so the
// Web Worker starts while the page's code loads and the still is there, or nearly, when the page first shows it.
// The same still the page asks for (usePageKitStills: the kit on, the theme, no name, no number, from the back).
import { warmStills } from "../../../components/jersey3d/useShirtStills";
import { documentTheme } from "../../../hooks/useDocumentTheme";

/** The kit the arriving page wears: la percha's ?kit=2 is the second; a player's page arrives in the first. */
export function arrivingKit(pathname: string, search: Record<string, unknown>): "home" | "away" {
  return pathname.startsWith("/plantilla") && String(search.kit) === "2" ? "away" : "home";
}

export function warmPercha(pathname: string, search: Record<string, unknown>): void {
  // (the server render runs the route too: the stills are the browser's)
  if (typeof document === "undefined") return;
  warmStills([{ kit: arrivingKit(pathname, search), theme: documentTheme(), name: "", num: "" }]);
}
