// Bloque 5 · modo presentación (pure): the board on a tablet or a screen in landscape for the team — the
// chrome hidden, the pitch filling the screen, a big LED ribbon on top and the step controls of La charla
// or the jugada at the bottom. What the ribbon says, what the transport says, and which keys open and
// close it. Unit-tested in presenta.test.ts.

/** The ribbon: the club, the match, the system, the química and the chant, in capitals. */
export function presLed(a: { match: string | null; board: string; sys: string; qv: number; free: boolean }): string[] {
  return ["Manchester Piti", a.match || a.board, a.free ? "Sistema libre" : "Sistema " + a.sys, "Química " + a.qv, "Vamos Piti"].filter(Boolean).map((s) => s.toUpperCase());
}

export type PresKey = "toggle" | "exit" | "hold" | null;

/** What a key does to the presentation: P opens or closes it, Esc closes it, and while it is on the tool
 *  keys (1–9) are held (the panels they open are hidden). Typing and Ctrl / ⌘ / Alt combinations never. */
export function presKey(e: { key: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; shiftKey?: boolean }, on: boolean, typing: boolean): PresKey {
  if (typing || e.ctrlKey || e.metaKey || e.altKey) return null;
  if ((e.key === "p" || e.key === "P") && !e.shiftKey) return "toggle";
  if (on && e.key === "Escape") return "exit";
  if (on && /^[0-9]$/.test(e.key)) return "hold";
  return null;
}

/** «Paso 2 de 4 · Desmarque»: where the jugada is, for the transport. */
export const presJugadaTxt = (frame: number, n: number, title: string): string => "Paso " + (frame + 1) + " de " + n + (title ? " · " + title : "");

/** The fullscreen calls of a document, guarded (iOS Safari has none for a page; a refusal is not an error:
 *  the presentation fills the window instead). */
export interface FsDoc {
  fullscreenElement?: Element | null;
  exitFullscreen?: () => Promise<void>;
}
export interface FsEl {
  requestFullscreen?: (o?: FullscreenOptions) => Promise<void>;
}

export async function enterFullscreen(el: FsEl | null): Promise<boolean> {
  if (!el || typeof el.requestFullscreen !== "function") return false;
  try {
    await el.requestFullscreen({ navigationUI: "hide" });
    return true;
  } catch {
    return false;
  }
}

export async function leaveFullscreen(d: FsDoc): Promise<void> {
  if (!d.fullscreenElement || typeof d.exitFullscreen !== "function") return;
  try {
    await d.exitFullscreen();
  } catch {
    /* already out */
  }
}
