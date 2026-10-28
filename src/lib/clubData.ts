import { useFirestoreCollection } from "./useFirestoreCollection";
import { mapMatch, mapPlayer } from "./firestoreMappers";
import type {
  MatchSheet,
  Participation,
  MatchEvent,
} from "../../functions/src/matchEngine";
import { useSeasonsLoading } from "../context/SeasonContext";
import { MATCHES_KEY, PLAYERS_KEY, matchQuery, playerQuery } from "./publicData";
import { nameFor, seasonShirtName, type NameSource } from "./derived/names";
import type { MatchMesa } from "../../functions/src/mesaLogic";
import type { KickoffWeather } from "../../functions/src/weatherLogic";
import type { StoredNotas } from "../../functions/src/rating/frozen";
import { dateFormat } from "./intlCache";
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
  /** The official board's system when the acta was saved: a SYSTEM_IDS id, "libre" (free mode), or
   *  null / absent without an official board. */
  system?: string | null;
  /** setConvocatoria's stamps (ms): when the convocatoria last changed, when its notice last went. */
  convocatoriaAt?: number;
  convocatoriaNotifiedAt?: number;
  /** Who keeps la mesa (public name, backend-written): «Lo anota Jorge desde la mesa» (derived/mesa mesaLine). */
  mesa?: MatchMesa;
  /** The weather at the kick-off hour, stamped by the backend once the acta is published («Hizo 15°»). */
  weatherAtKickoff?: KickoffWeather;
  /** Each player's nota, frozen when the acta was published (backend-written; the rating reads it). */
  notas?: StoredNotas;
  /** r12: when the acta was first published (ms). Absent on older actas: voteClosesAt − 48 h. */
  actaPublishedAt?: number;
  /** r12 M-11: the MVP vote closed or reopened by hand (setMvpVote). */
  mvpManual?: MvpManual;
  /** r12 M-43: where each goal starts in the video (event id → seconds). */
  videoMarks?: Record<string, number>;
}
export interface MvpManual {
  action: "close" | "reopen";
  by: string;
  at: number;
}

// ── r12 · new documents of la Sala de control (shapes in piti-diseno/src/admin/impl/API.md; Zod in schemas.ts) ──
/** matchPrivate/{id}.notasError: the notas could not be rated at publication (M-42 «Recalcular las notas»). */
export interface NotasError {
  at: number;
  message: string;
}
/** pushSent/{id} (captains read it): «Lo que se ha mandado» (M-18). */
export interface PushSentDoc {
  id: string;
  title: string;
  body: string;
  topic: string;
  url: string;
  tag: string;
  matchId: string | null;
  audience: "publico" | "equipo" | "capitanes" | "convocados";
  kind: "auto" | "manual" | "recordatorio";
  devices: number;
  members: number;
  by: string | null;
  at: number;
}
/** clubDrafts/content (captains): the content drafts on the server, the same `{ club, stories }` the device kept (M-20). */
export interface ClubContentDraftDoc {
  club: Record<string, unknown>;
  stories: Record<string, unknown>;
  by: string;
  byName?: string;
  /** ms (a Timestamp in Firestore; null while its serverTimestamp is pending). */
  at: number | null;
}
export type { MatchMesa } from "../../functions/src/mesaLogic";
export type { KickoffWeather } from "../../functions/src/weatherLogic";
export type { StoredNotas } from "../../functions/src/rating/frozen";
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
export { nameFor } from "./derived/names";
/** @deprecated The one name API is nameFor(player, seasonId) (derived/names); this is it without a season. */
export function playerName(p?: NameSource | null): string {
  return nameFor(p);
}
export function formatDate(date: unknown, time = false) {
  const ms =
    typeof date === "object" && date && "seconds" in date
      ? Number(date.seconds) * 1000
      : Number(new Date(date as string | number));
  return Number.isFinite(ms)
    ? dateFormat("es-ES", {
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
    // (the same season name nameFor reads: a blank or malformed one falls back to the default)
    shirtName: seasonShirtName(player, seasonId) || player.shirtName,
    number: detail?.number ?? player.number,
  };
}
