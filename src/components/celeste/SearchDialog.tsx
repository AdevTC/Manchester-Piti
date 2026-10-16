// «Buscar»'s data and destinations: what the pages already hold (useClubData, the seasons — no new reads),
// turned into what can be found (derived/searchIndex) and, once chosen, into a typed navigation. Loaded only
// when the search first opens (SearchLauncher).
import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { nextFixture, playerForSeason, playerName, useClubData } from "../../lib/clubData";
import { useSeason } from "../../context/SeasonContext";
import { usePublishedViewer } from "../../hooks/viewerSignal";
import { currentSeasonId, plural } from "../../lib/vestuario";
import { leaders, playerLines, seasonPulse, type SquadMember } from "../../lib/home";
import { buildSearchIndex } from "../../lib/derived/searchIndex";
import type { SearchEntry, SearchTarget } from "../../lib/derived/search";
import { SearchPanel } from "./SearchPanel";

export function SearchDialog({ onClose }: { onClose: (refocus?: boolean) => void }) {
  const { matches, players } = useClubData();
  const { seasons } = useSeason();
  const { member } = usePublishedViewer();
  const navigate = useNavigate();
  const [now] = useState(() => Date.now());
  const seasonId = currentSeasonId(nextFixture(matches, now), matches, seasons);

  const entries = useMemo(
    () => buildSearchIndex({ players, matches, seasons, currentSeasonId: seasonId, member, now }),
    [players, matches, seasons, seasonId, member, now],
  );

  // Empty field: the next match and the pichichi (this season's top scorer, as the home counts him).
  const suggestions = useMemo(() => {
    const out: SearchEntry[] = [];
    const next = entries.find((e) => e.kind === "partido" && (e.boost ?? 0) > 0);
    if (next) out.push(next);
    if (seasonId) {
      const squad: SquadMember[] = players
        .filter((p) => p.seasons?.includes(seasonId))
        .map((raw) => {
          const p = playerForSeason(raw, seasonId, seasons);
          return { id: p.id, name: playerName(p), num: p.number != null ? String(p.number) : "" };
        });
      const [top] = leaders(playerLines(squad, seasonPulse(matches, seasonId, now).played), "goals", 1);
      const entry = top && entries.find((e) => e.id === `p:${top.id}`);
      if (top && entry) out.push({ ...entry, detail: `Pichichi · ${plural(top.stats.goals, "gol", "goles")}` });
    }
    return out;
  }, [entries, players, matches, seasons, seasonId, now]);

  const go = (t: SearchTarget) => {
    switch (t.to) {
      case "jugador":
        return navigate({ to: "/jugadores/$playerId", params: { playerId: t.playerId }, search: t.season ? { season: t.season } : undefined });
      case "partido":
        return navigate({ to: "/matches/$matchId", params: { matchId: t.matchId } });
      case "partidos":
        return navigate({ to: "/partidos", search: { season: t.season, view: t.view } });
      case "stats":
        return navigate({ to: "/stats", search: t.view ? { view: t.view } : {} });
      case "plantilla":
        return navigate({ to: "/plantilla" });
      case "club":
        return navigate({ to: "/club" });
      case "vestuario":
        return navigate({ to: "/vestuario", hash: t.hash });
      case "profile":
        return navigate({ to: "/profile" });
      case "pizarra":
        return navigate({ to: "/pizarra" });
    }
  };

  return (
    <SearchPanel
      entries={entries}
      suggestions={suggestions}
      onClose={onClose}
      onGo={(entry) => {
        onClose(false);
        void go(entry.target);
      }}
    />
  );
}
