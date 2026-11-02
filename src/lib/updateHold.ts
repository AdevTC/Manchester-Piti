// A page that must not be reloaded under the user right now tells the app-update controller (lib/appUpdate) so,
// without either importing the other: the pizarra registers «busy» (an unsaved edit, an open sheet, a drawing, the
// charla running, a 12 s undo window) and the controller asks it before switching to a new version.
let held: (() => boolean) | null = null;

/** While the returned function isn't called (the page unmounts), `fn` decides whether the page holds the update. */
export function holdUpdatesWhile(fn: () => boolean): () => void {
  held = fn;
  return () => {
    if (held === fn) held = null;
  };
}

/** Whether the page in front holds the update now (no page registered = it doesn't). A failing check holds. */
export function heldByPage(): boolean {
  if (!held) return false;
  try {
    return held();
  } catch {
    return true;
  }
}
