// The acta editor's «Han llegado N jugadas nuevas desde que empezaste a editar · Incorporarlas» (M4):
// while the edits are unsaved, the jugadas the touchline wrote meanwhile, and the action that takes them
// (and the server's revision) into the edits — never bringing back one the editor removed.
import { useCallback, useState } from "react";
import { mergeLive, newLiveEvents, removedIds } from "../acta/liveMerge";
import type { MatchEvent, MatchSheet } from "../acta/sheetModel";
import type { EditBuffer } from "./useEditBuffer";

export interface LiveCatchUp {
  /** New live jugadas on the server (0 while clean: a clean buffer follows the server by itself). */
  count: number;
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
  const count = buf.dirty ? newLiveEvents(buf.value, buf.base, buf.server, removed).length : 0;
  const { rebase } = buf;
  const incorporate = useCallback(() => rebase((value, base, server) => mergeLive(value, base, server, removed)), [rebase, removed]);
  return { count, incorporate };
}
