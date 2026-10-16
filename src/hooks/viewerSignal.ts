// Who is looking, for the shared chrome (NoticesGate): RootLayout publishes useViewer's answer here, and the
// header and the dock read it without needing the providers above them (page tests render them bare: a fan).
// Server and hydration read the fan, so the HTML stays the fan's; the member arrives right after.
import { useSyncExternalStore } from "react";
import type { Viewer } from "./useViewer";

const FAN: Viewer = { member: false, admin: false, playerId: null };
let current: Viewer = FAN;
const readers = new Set<() => void>();

/** RootLayout's viewer (an equal one changes nothing). */
export function publishViewer(v: Viewer): void {
  if (v.member === current.member && v.admin === current.admin && v.playerId === current.playerId) return;
  current = v.member ? { ...v } : FAN;
  readers.forEach((r) => r());
}

const subscribe = (r: () => void) => {
  readers.add(r);
  return () => readers.delete(r);
};

/** The published viewer: a fan on the server, while hydrating and until RootLayout knows. */
export const usePublishedViewer = (): Viewer => useSyncExternalStore(subscribe, () => current, () => FAN);
