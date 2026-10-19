// «Buscar»'s data and destinations: what the pages already hold (useClubData, the seasons, the league table — no
// new reads), turned into what can be found (derived/searchIndex + searchModel: «Ahora», «Acciones», «Equipos»)
// and, once chosen, into a typed navigation (or «Sacar el marcador», or the calendar feed). Loaded only when the
// search first opens (SearchLauncher).
import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { nextFixture, useClubData } from "../../lib/clubData";
import { useSeason } from "../../context/SeasonContext";
import { usePublishedViewer } from "../../hooks/viewerSignal";
import { currentSeasonId } from "../../lib/vestuario";
import { buildSearchIndex } from "../../lib/derived/searchIndex";
import { useStandings } from "../../lib/useStandings";
import { voteMatch } from "../../lib/derived/island";
import { kickoffWindow } from "../../lib/derived/memberWindows";
import { webcalUrl } from "../../lib/calendarLinks";
import { dateMillis, isVisibleMatch } from "../../../functions/src/matchEngine";
import { dayStateOf } from "../vidrio/live/liveModel";
import { liveDock } from "../vidrio/liveDock";
import { jornadaOf } from "../vidrio/account/accountModel";
import { actionEntries, extraPages, fromIndex, nowEntries, teamEntries, type PanelEntry, type PanelTarget } from "./searchModel";
import { SearchPanel } from "./SearchPanel";

export function SearchDialog({ onClose }: { onClose: (refocus?: boolean) => void }) {
  const { matches, players } = useClubData();
  const { seasons } = useSeason();
  const { member, playerId } = usePublishedViewer();
  const navigate = useNavigate();
  const [now] = useState(() => Date.now());
  const seasonId = currentSeasonId(nextFixture(matches, now), matches, seasons);
  const { standings } = useStandings(seasonId);

  const entries = useMemo(() => {
    const index = fromIndex(buildSearchIndex({ players, matches, seasons, currentSeasonId: seasonId, member, now }));
    const rsvpMatch = matches.filter((m) => isVisibleMatch(m) && kickoffWindow(m, now) === "open").sort((a, b) => dateMillis(a.date) - dateMillis(b.date))[0] ?? null;
    const feed = typeof location === "undefined" ? null : webcalUrl(`${location.origin}/calendario.ics`);
    const extras: PanelEntry[] = [
      ...nowEntries(dayStateOf({ matches, now, voteOpen: false }), now),
      ...actionEntries({ jugador: member && !!playerId, member, rsvp: rsvpMatch ? { match: rsvpMatch, j: jornadaOf(matches, rsvpMatch) } : null, vote: member ? (voteMatch(matches, now) ?? null) : null, feed }),
      ...extraPages(member),
    ];
    return [...extras, ...index, ...teamEntries(standings?.rows ?? [], index)];
  }, [players, matches, seasons, seasonId, member, playerId, now, standings]);

  const go = (t: PanelTarget) => {
    switch (t.to) {
      case "jugador":
        return navigate({ to: "/jugadores/$playerId", params: { playerId: t.playerId }, search: t.season ? { season: t.season } : undefined });
      case "partido":
        return navigate({ to: "/matches/$matchId", params: { matchId: t.matchId } });
      case "match":
        return navigate({ to: "/matches/$matchId", params: { matchId: t.matchId }, search: t.tab ? { tab: t.tab } : undefined });
      case "partidos":
        return navigate({ to: "/partidos", search: { season: t.season, view: t.view } });
      case "stats":
        return navigate({ to: "/stats", search: t.view ? { view: t.view } : {} });
      case "plantilla":
        return navigate({ to: "/plantilla" });
      case "club":
        return navigate({ to: "/club" });
      case "clubAt":
        return navigate({ to: "/club", hash: t.hash });
      case "vestuario":
        return navigate({ to: "/vestuario", hash: t.hash });
      case "profile":
        return navigate({ to: "/profile" });
      case "pizarra":
        return navigate({ to: "/pizarra" });
      case "href":
        window.location.href = t.href;
        return;
      case "pip":
        // (from the click or the Intro itself: the browser asks for a user gesture)
        liveDock.openPip();
        return;
    }
  };

  return (
    <SearchPanel
      entries={entries}
      onClose={onClose}
      onGo={(entry) => {
        onClose(false);
        void go(entry.target);
      }}
    />
  );
}
