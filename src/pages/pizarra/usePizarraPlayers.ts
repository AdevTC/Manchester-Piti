import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useSeason, type Season } from "../../context/SeasonContext";
import type { Zone } from "./formations";

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
  injured?: boolean;
  seasonDetails?: Record<string, { shirtName: string; number: number }>;
}

/** A player resolved for the active season: the right shirt name + dorsal. */
export interface PizarraPlayer {
  id: string;
  firstName: string;
  lastName: string;
  shirtName: string;
  number: number;
  /** Squad-level natural position, set by an admin (Firestore). */
  naturalPosition?: Zone;
  /** Number of seasons in the club (for the chemistry experience axis). */
  seasonsCount: number;
  /** Admin-set unavailability flag. */
  injured: boolean;
}

/**
 * Persist a player's natural position. Caller must gate this to admins (the
 * Firestore rule also enforces admin role server-side — see the spec).
 */
export async function setNaturalPosition(playerId: string, pos: Zone | null): Promise<void> {
  await updateDoc(doc(db, "players", playerId), { naturalPosition: pos });
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
  const [docs, setDocs] = useState<PlayerDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "players"), (snap) => {
      setDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as PlayerDoc[]);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const players = useMemo<PizarraPlayer[]>(() => {
    const inSeason =
      selectedSeasonId === "all"
        ? docs
        : docs.filter((p) => p.seasons && p.seasons.includes(selectedSeasonId));
    return inSeason
      .map((p) => {
        const { shirtName, number } = resolve(p, selectedSeasonId, seasons);
        return {
          id: p.id,
          firstName: p.firstName || "",
          lastName: p.lastName || "",
          shirtName,
          number,
          naturalPosition: p.naturalPosition,
          seasonsCount: p.seasons?.length ?? 0,
          injured: p.injured === true,
        };
      })
      .sort((a, b) => a.number - b.number);
  }, [docs, selectedSeasonId, seasons]);

  return { players, loading };
}
