// «Abrir el centro de avisos» (the board's flyBell): the bell's sheet becomes the bandeja's list — the list wears
// the sheet's view-transition-name (tu-bell) on the render that follows the move, then lets it go.
let pending = 0;

/** The bell asks for it right before it moves to /avisos. */
export function askFlyBell(): void {
  pending = Date.now();
}

/** The bandeja takes it once, on its first render (a stale ask, over 3 s old, is dropped). */
export function takeFlyBell(): boolean {
  const on = pending > 0 && Date.now() - pending < 3000;
  pending = 0;
  return on;
}
