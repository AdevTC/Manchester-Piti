// The connection chip's state for a surface that shows a score: the shared sync status (lib/syncStatus)
// read through syncChip. `now` is the caller's clock tick (useClock: the server-time estimate); the
// status stamps are the phone's own clock, so the offset is taken back off before comparing.
import { useSyncStatus } from "../lib/syncStatus";
import { serverOffset } from "../lib/serverTime";
import { syncChip, type SyncChip } from "../lib/derived/syncChip";

export function useSyncChip(live: boolean, now: number): SyncChip | null {
  const status = useSyncStatus();
  return syncChip(status, now - serverOffset(), live);
}
