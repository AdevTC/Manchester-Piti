// CLUB · the dock's counter for Club: only what is yours to do (board club.js `count`) — the captaincy's unread
// notices and the league table when it goes by an older jornada than the last published acta (H-HOY-12). A hook
// the frame calls on every screen: both read shared listeners (the bell's notices, the public standings).
import type { AdminData } from "../../data/useAdminData";
import { useStandings } from "../../../../lib/useStandings";
import { useCaptainInbox } from "./inbox";
import { lastPublishedJornada, tableBehind } from "./model";

export function useClubCount(data: AdminData): number {
  const inbox = useCaptainInbox();
  const sid = data.season?.id;
  const { standings } = useStandings(sid);
  const behind = sid ? tableBehind(standings, lastPublishedJornada(data.matches, sid, data.stateOf)) : null;
  return inbox.unread + (behind ? 1 : 0);
}
