// The shelf's ids and keyboard, pure (the page's panels need the same ids the tabs point at).
const safe = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, "-");

/** The tab's id for a place. */
export const shelfTabId = (base: string, id: string): string => `${safe(base)}-tab-${safe(id)}`;
/** The panel's id for a place (put it on the panel with role="tabpanel" and aria-labelledby = shelfTabId). */
export const shelfPanelId = (base: string, id: string): string => `${safe(base)}-panel-${safe(id)}`;

/** Where a key moves the selection in a row of `n` (wrapping), or null for a key the shelf ignores. */
export function nextIndex(key: string, at: number, n: number): number | null {
  if (n <= 0) return null;
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return (at + 1) % n;
    case "ArrowLeft":
    case "ArrowUp":
      return (at - 1 + n) % n;
    case "Home":
      return 0;
    case "End":
      return n - 1;
    default:
      return null;
  }
}

/** Which way the content travels when the shelf moves from `from` to `to` (moving right, content comes from
 *  the right). */
export const travel = (from: number, to: number): "left" | "right" => (to < from ? "left" : "right");
