// Deep links into the board: /pizarra?tablero=<id> opens a board, #charla / #comparar / #compartir / …
// open a panel. `tablero` is declared in /pizarra's search schema (router.tsx), so it stays in the URL
// until the board has used it (useForgetDeepLink takes it out); the hash does not: the season sync's
// first navigation (it seeds ?season=) drops it. So the first load remembers both here until then.
import { useEffect } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";

const read = () => {
  if (typeof window === "undefined") return { tablero: null, hash: "" };
  return { tablero: new URLSearchParams(window.location.search).get("tablero"), hash: window.location.hash.replace(/^#/, "").toLowerCase() };
};

let first: { tablero: string | null; hash: string } = read();

/** The board the URL asks for: the current URL's, else the one the first load brought. */
export const deepTablero = (): string | null => read().tablero ?? first.tablero;

/** The panel the URL asks for (#comparar…): the current URL's, else the first load's. */
export const deepHash = (): string => read().hash || first.hash;

/** The board has opened with them: later visits to /pizarra start from the board you left. */
export function forgetDeepLink(): void {
  first = { tablero: null, hash: "" };
}

/**
 * Once the board is `ready` (it has opened where the link asked), the link is used up: forgotten here and
 * taken out of the URL (replace), so a reload, a PWA resume or Back after switching boards reopens the
 * board you left — not the linked one again (nor «ya no existe» forever once it is deleted).
 */
export function useForgetDeepLink(ready: boolean): void {
  const navigate = useNavigate();
  const tablero = useSearch({ strict: false, select: (s) => (s as { tablero?: string }).tablero });
  useEffect(() => {
    if (!ready) return;
    forgetDeepLink();
    if (tablero !== undefined) void navigate({ to: ".", search: (p) => ({ ...p, tablero: undefined }), replace: true });
  }, [ready, tablero, navigate]);
}
