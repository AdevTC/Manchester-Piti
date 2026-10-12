// La pizarra · Bloque 5 — sin conexión en el campo. The app shell and every chunk (La pizarra's included)
// are precached by the service worker (vite.config.ts, Workbox generateSW) and Firestore keeps its own
// cache on the device (firebase.ts, persistentLocalCache): a board opened before opens again offline and
// its edits wait in that cache. What the board adds is saying so, also when nothing is pending yet.
import { useSyncExternalStore } from "react";

/** The save line while the device is offline (pending edits or not). */
export const OFFLINE_TXT = "Sin conexión: los cambios se guardarán al volver";

const now = (): boolean => (typeof navigator === "undefined" ? true : navigator.onLine !== false);
function subscribe(cb: () => void): () => void {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/** Whether the device says it is online (live: the «online» / «offline» events). */
export const useOnline = (): boolean => useSyncExternalStore(subscribe, now, () => true);
