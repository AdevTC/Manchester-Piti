// Who is looking, for the shared chrome (NoticesGate): RootLayout publishes useViewer's answer here, and the
// header and the dock read it without needing the providers above them (page tests render them bare: a fan).
// Server and hydration read the fan, so the HTML stays the fan's; the member arrives right after.
import { useSyncExternalStore } from "react";
import type { Viewer } from "./useViewer";

const FAN: Viewer = { member: false, admin: false, playerId: null };
let current: Viewer = FAN;
/** RootLayout knows who is looking (the session and the vestuario checked): a fan is a fan, not «not yet». */
let known = false;
const readers = new Set<() => void>();

/** RootLayout's viewer (an equal one changes nothing), and whether it is the settled answer yet. */
export function publishViewer(v: Viewer, settled = false): void {
  const same = v.member === current.member && v.admin === current.admin && v.playerId === current.playerId;
  if (same && settled === known) return;
  if (!same) current = v.member ? { ...v } : FAN;
  known = settled;
  readers.forEach((r) => r());
}

const subscribe = (r: () => void) => {
  readers.add(r);
  return () => readers.delete(r);
};

/** The published viewer: a fan on the server, while hydrating and until RootLayout knows. */
export const usePublishedViewer = (): Viewer => useSyncExternalStore(subscribe, () => current, () => FAN);

/** Whether who is looking is known yet (a member published is): false on the server, while hydrating and until
 *  RootLayout has checked the session. The top bar waits for it to show its tools in their final places. */
export const usePublishedViewerKnown = (): boolean => useSyncExternalStore(subscribe, () => known || current.member, () => false);
