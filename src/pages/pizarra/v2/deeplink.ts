// Deep links into the new board: /pizarra?tablero=<id> opens a board, #comparar / #compartir / … open a
// panel. The season sync rewrites the URL as soon as the app starts (and drops what it doesn't know),
// so, like the v2 switch, the first load remembers them here until the board has used them.
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
