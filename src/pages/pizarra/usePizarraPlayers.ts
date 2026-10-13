import { useMemo } from "react";
import { collection, doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useSeason, type Season } from "../../context/SeasonContext";
import type { Zone } from "./formations";
import { useFirestoreCollection } from "../../lib/useFirestoreCollection";
import { mapPlayer } from "../../lib/firestoreMappers";
import { resolvePositions, type PositionSet } from "../../lib/positions";
import type { Sanction } from "./chemistry";

const PLAYERS_KEY = ["players"] as const;
const playersQuery = collection(db, "players");

// Local mirror of the Firestore `players` doc. Kept independent of the
// Expedientes view so that view stays untouched; only the fields the board
// needs are typed here.
interface PlayerDoc {
  id: string;
  firstName: string;
  lastName: string;
  shirtName: string;
  number: number;
  seasons?: string[];
  active?: boolean;
  naturalPosition?: Zone;
  positions?: unknown;
  injured?: boolean;
  sanction?: Sanction;
  sanctionClearedAt?: number;
  seasonDetails?: Record<string, { shirtName: string; number: number }>;
}

/** A player resolved for the active season: the right shirt name + dorsal. */
export interface PizarraPlayer {
  id: string;
  firstName: string;
  lastName: string;
  shirtName: string;
  number: number;
  /** His line, always POR/DEF/MED/DEL: resolvePositions' line (approved positions, else the old text). */
  naturalPosition?: Zone;
  /** His exact positions, resolved ({main, also}: the approved ones, else the code of the old text). */
  positions: PositionSet;
  /** Number of seasons in the club (for the chemistry experience axis). */
  seasonsCount: number;
  /** Admin-set unavailability flag. */
  injured: boolean;
  /** Active in the squad (false = baja/archived). */
  active: boolean;
  /** A sanction set by hand in Admin, and when one was last lifted (see chemistry.suspensions). */
  sanction?: Sanction;
  sanctionClearedAt?: number;
}

/**
 * Persist a player's injury flag. Caller must gate this to admins (the
 * Firestore `players` update rule enforces admin role server-side).
 */
export async function setInjured(playerId: string, injured: boolean): Promise<void> {
  await updateDoc(doc(db, "players", playerId), { injured });
}

// Resolve the shirt name + dorsal for the active season, falling back to the
// player's most recent season detail, then their base fields. Mirrors the
// resolution used by the Expedientes view (Plantilla.tsx getResolved/numFor).
function resolve(player: PlayerDoc, selectedSeasonId: string, seasons: Season[]): { shirtName: string; number: number } {
  let shirtName = player.shirtName || "";
  let number = player.number || 0;
  if (selectedSeasonId !== "all" && player.seasonDetails?.[selectedSeasonId]) {
    shirtName = player.seasonDetails[selectedSeasonId].shirtName;
    number = player.seasonDetails[selectedSeasonId].number;
  } else if (player.seasons && player.seasons.length > 0 && player.seasonDetails) {
    const inList = seasons.filter((s) => player.seasons!.includes(s.id));
    if (inList.length > 0) {
      const latest = inList[inList.length - 1];
      const detail = player.seasonDetails[latest.id];
      if (detail) {
        shirtName = detail.shirtName;
        number = detail.number;
      }
    }
  }
  return { shirtName, number };
}

/**
 * Realtime players for the active season, resolved for the board.
 * Returns the squad sorted by dorsal plus a loading flag.
 */
export function usePizarraPlayers(): { players: PizarraPlayer[]; loading: boolean } {
  const { selectedSeasonId, seasons } = useSeason();
  // Shared canonical subscription via the cache bridge (one onSnapshot for
  // `players` across all pages); per-season derivation stays here in useMemo.
  // The raw naturalPosition (any old text) is never read as-is: the board's value
  // is always resolvePositions' line (POR/DEF/MED/DEL), set in the map below.
  const { data, isPending } = useFirestoreCollection(PLAYERS_KEY, playersQuery, mapPlayer);
  const docs = useMemo(() => (data ?? []) as unknown as PlayerDoc[], [data]);
  const loading = isPending;

  const players = useMemo<PizarraPlayer[]>(() => {
    const inSeason =
      selectedSeasonId === "all"
        ? docs
        : docs.filter((p) => p.seasons && p.seasons.includes(selectedSeasonId));
    return inSeason
      .map((p) => {
        const { shirtName, number } = resolve(p, selectedSeasonId, seasons);
        const pos = resolvePositions(p);
        return {
          id: p.id,
          firstName: p.firstName || "",
          lastName: p.lastName || "",
          shirtName,
          number,
          // The line of the approved positions (or of the old text): always POR/DEF/MED/DEL here.
          naturalPosition: pos.line ?? undefined,
          positions: { main: pos.main, also: pos.also },
          seasonsCount: p.seasons?.length ?? 0,
          injured: p.injured === true,
          active: p.active !== false,
          ...(p.sanction ? { sanction: p.sanction } : {}),
          ...(typeof p.sanctionClearedAt === "number" ? { sanctionClearedAt: p.sanctionClearedAt } : {}),
        };
      })
      .sort((a, b) => a.number - b.number);
  }, [docs, selectedSeasonId, seasons]);

  return { players, loading };
}
