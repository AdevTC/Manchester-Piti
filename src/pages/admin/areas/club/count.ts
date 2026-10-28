// CLUB · the dock's counter for Club: only what is yours to do (board club.js `count`) — the captaincy's unread
// notices and the league table when it goes by an older jornada than the last published acta (H-HOY-12). A hook
// the frame calls once, on every screen: both are shared listeners (the bell's notices; the season's standings doc,
// read with the vestuario's shared store so the frame needs no query client), opened once the sala has settled
// (an idle moment after it mounts: a counter never competes with the screen's own first reads).
import { useEffect, useState } from "react";
import type { AdminData } from "../../data/useAdminData";
import { mapStandings, type Standings } from "../../../../lib/standings";
import { useLiveDoc } from "../../../vestuario/live";
import { useCaptainInbox } from "./inbox";
import { lastPublishedJornada, tableBehind } from "./model";

const SETTLE_MS = 1500;

/** False until the first idle moment after mounting (at most SETTLE_MS later). */
function useSettled(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const ric = typeof window.requestIdleCallback === "function" ? window.requestIdleCallback.bind(window) : null;
    if (ric) {
      const id = ric(() => setOn(true), { timeout: SETTLE_MS });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(() => setOn(true), SETTLE_MS);
    return () => clearTimeout(t);
  }, []);
  return on;
}

export function useClubCount(data: AdminData): number {
  const on = useSettled();
  const inbox = useCaptainInbox(on);
  const sid = on ? (data.season?.id ?? "") : "";
  const standings = useLiveDoc<Standings | null>(sid ? `standings/${sid}` : null, "club-count", (d) => (d ? mapStandings(sid, d) : null), null).data;
  const behind = sid ? tableBehind(standings, lastPublishedJornada(data.matches, sid, data.stateOf)) : null;
  return inbox.unread + (behind ? 1 : 0);
}
