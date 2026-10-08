// A message for the door to show when it opens next on this device: the profile signs you out
// («Salir en este dispositivo», «Darme de baja») and the door greets you with what just happened.
// Kept in sessionStorage (it survives the redraw) and announced live to a door already on screen.
const KEY = "mp_door_notice";
const listeners = new Set<() => void>();

export function leaveDoorNotice(text: string): void {
  try {
    sessionStorage.setItem(KEY, text);
  } catch {
    /* private mode: the door opens without it */
  }
  listeners.forEach((l) => l());
}

/** The pending message (once): reading it clears it. */
export function takeDoorNotice(): string | null {
  try {
    const t = sessionStorage.getItem(KEY);
    if (t !== null) sessionStorage.removeItem(KEY);
    return t || null;
  } catch {
    return null;
  }
}

export function onDoorNotice(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
