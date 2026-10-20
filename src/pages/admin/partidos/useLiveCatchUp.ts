// The acta editor's «Han llegado N jugadas nuevas desde que empezaste a editar · Incorporarlas» (M4):
// while the edits are unsaved, the jugadas the touchline wrote meanwhile, and the action that takes them
// (and the server's revision) into the edits — never bringing back one the editor removed.
import { useCallback, useState } from "react";
import { liveConflicts, mergeLive, pendingLiveChanges, removedIds } from "../acta/liveMerge";
import type { MatchEvent, MatchSheet } from "../acta/sheetModel";
import type { EditBuffer } from "./useEditBuffer";

export interface LiveCatchUp {
  /** Added, edited or removed actions (0 while clean: a clean buffer follows the server by itself). */
  count: number;
  /** The edits and the server changed the same thing: incorporating keeps the edits' revision, so the
   *  save will still be refused (and say why) rather than overwrite the other change. */
  conflict: boolean;
  incorporate: () => void;
}

export function useLiveCatchUp(buf: EditBuffer<MatchSheet>): LiveCatchUp {
  // The ids removed in this editor, followed render by render (state adjusted while rendering).
  const events = buf.value.events;
  const [track, setTrack] = useState<{ events: MatchEvent[]; removed: ReadonlySet<string> }>(() => ({ events, removed: new Set() }));
  let removed = track.removed;
  if (track.events !== events) {
    removed = removedIds(track.removed, track.events, events);
    setTrack({ events, removed });
  }
  const count = buf.dirty ? pendingLiveChanges(buf.value, buf.base, buf.server, removed) : 0;
  const conflict = count > 0 && liveConflicts(buf.value, buf.base, buf.server);
  const { rebase } = buf;
  const incorporate = useCallback(() => rebase((value, base, server) => mergeLive(value, base, server, removed)), [rebase, removed]);
  return { count, conflict, incorporate };
}
