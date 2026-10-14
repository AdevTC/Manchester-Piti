// «¿Está al día el marcador?» in words, for the live island, the match boards and the admin LED. Offline:
// «Reconectando…». During a live match whose score the server hasn't confirmed for over a minute:
// «Sin conexión · marcador de hace N min», counted from the moment the listener stopped being in sync
// (lib/syncStatus `staleAt`: up to then it got every change, so the score was right until then).
import type { SyncStatus } from "../syncStatus";

/** How long the score may go unconfirmed by the server during a live match before saying so. */
export const STALE_AFTER_MS = 60_000;
export const RECONNECTING = "Reconectando…";

export type SyncChip =
  | { kind: "offline"; text: string }
  | { kind: "stale"; text: string; minutes: number };

/** What to say about the connection (null: nothing, the score is live). `localNow` is the phone's own clock
 *  (the stamps in SyncStatus are), not the server-time estimate. `live`: a match is being played. */
export function syncChip(status: SyncStatus, localNow: number, live: boolean): SyncChip | null {
  const { online, fresh, since, staleAt } = status;
  if (live && !fresh && staleAt !== null && localNow - staleAt > STALE_AFTER_MS) {
    // Never confirmed by the server at all (only the cache): how old the score is, nobody knows.
    if (since === null) return { kind: "offline", text: RECONNECTING };
    const minutes = Math.max(1, Math.floor((localNow - staleAt) / 60_000));
    return { kind: "stale", minutes, text: `Sin conexión · marcador de hace ${minutes} min` };
  }
  if (!online) return { kind: "offline", text: RECONNECTING };
  return null;
}

/** The words a screen reader hears once when the chip appears or changes kind (never the minute count). */
export function syncChipAnnouncement(chip: SyncChip | null): string {
  if (!chip) return "";
  return chip.kind === "offline" ? "Sin conexión: reconectando." : "Sin conexión: el marcador puede no estar al día.";
}
