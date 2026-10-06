import { useFirestoreCollection } from "./useFirestoreCollection";
import { mapMatch, mapPlayer } from "./firestoreMappers";
import type {
  MatchSheet,
  Participation,
  MatchEvent,
} from "../../functions/src/matchEngine";
import { useSeasonsLoading } from "../context/SeasonContext";
import { MATCHES_KEY, PLAYERS_KEY, matchQuery, playerQuery } from "./publicData";
export {
  EVENT_LABELS,
  dateMillis,
  matchPhase,
  nextFixture,
  isCompleted,
  calculateLedger,
} from "../../functions/src/matchEngine";
export type { MatchSheet, Participation, MatchEvent };
export interface ClubMatch extends Omit<
  Partial<MatchSheet>,
  "date" | "id" | "events"
> {
  id: string;
  date?: unknown;
  events?: MatchEvent[];
  ledger?: Record<string, Participation>;
}
export function useClubData() {
  const matches = useFirestoreCollection(MATCHES_KEY, matchQuery, mapMatch);
  const players = useFirestoreCollection(PLAYERS_KEY, playerQuery, mapPlayer);
  // Every page reads matches and players through the season: until the seasons arrive too, the page
  // would paint itself empty for a moment and then jump (the data bundle makes the other two instant).
  const seasonsLoading = useSeasonsLoading();
  return {
    matches: (matches.data ?? []) as ClubMatch[],
    players: players.data ?? [],
    loading: matches.isPending || players.isPending || seasonsLoading,
    error: matches.error || players.error,
  };
}
export function playerName(p?: {
  shirtName?: string;
  firstName?: string;
  lastName?: string;
}) {
  return (
    p?.shirtName ||
    [p?.firstName, p?.lastName].filter(Boolean).join(" ") ||
    "Jugador"
  );
}
export function formatDate(date: unknown, time = false) {
  const ms =
    typeof date === "object" && date && "seconds" in date
      ? Number(date.seconds) * 1000
      : Number(new Date(date as string | number));
  return Number.isFinite(ms)
    ? new Intl.DateTimeFormat("es-ES", {
        timeZone: "Europe/Madrid",
        day: "numeric",
        month: "short",
        year: "numeric",
        ...(time ? ({ hour: "2-digit", minute: "2-digit" } as const) : {}),
      }).format(ms)
    : "Fecha por confirmar";
}

/** Resolve the shirt worn in the selected season, keeping the player's identity. */
export function playerForSeason<
  T extends {
    seasons?: string[];
    seasonDetails?: Record<string, unknown>;
    shirtName?: string;
    number?: number;
  },
>(player: T, selectedSeason: string, seasons: { id: string }[]): T {
  const seasonId =
    selectedSeason === "all"
      ? [...seasons].reverse().find((s) => player.seasons?.includes(s.id))?.id
      : selectedSeason;
  const detail = seasonId
    ? (player.seasonDetails?.[seasonId] as
        { shirtName?: string; number?: number } | undefined)
    : undefined;
  return {
    ...player,
    shirtName: detail?.shirtName || player.shirtName,
    number: detail?.number ?? player.number,
  };
}
