// Deep links into the board: /pizarra?tablero=<id> opens a board, #charla / #comparar / #compartir / …
// open a panel. `tablero` is declared in /pizarra's search schema (router.tsx), so it stays in the URL;
// the hash does not: the season sync's first navigation (it seeds ?season=) drops it. So the first load
// remembers both here until the board has used them.
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
