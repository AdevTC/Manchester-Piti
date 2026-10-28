// PLANTILLA · the store's shape and its hook (the provider is store.tsx).
import { createContext, useContext } from "react";
import type { PlayerDoc, SeasonDoc } from "../../../../lib/schemas";
import type { Suspension } from "../../../pizarra/chemistry";
import type { BoardFilter, BoardRow } from "../../club/plantillaBoard";
import type { ClubWrites } from "../../club/useClubWrites";
import type { AdminMatch } from "../../data/adminLogic";
import type { AdminData } from "../../data/useAdminData";

/** A guest of the convocatorias who becomes a ficha (M-41): his name and the matches he played as a guest. */
export interface AltaSeed {
  name: string;
  guests: { matchId: string; guestId: string }[];
}
export interface PlantillaWrite {
  /** The ficha as it will be (null: it goes away), shown at once. */
  id: string;
  doc: PlayerDoc | null;
  tag: string;
  message: string;
  /** «No se ha podido …» (the franja's error line). */
  error: string;
  commit: () => Promise<unknown>;
  onUndo?: () => void;
  onError?: () => void;
  onDone?: (result: unknown) => void;
}
export interface PlantillaStore {
  data: AdminData;
  season: SeasonDoc | null;
  /** Every ficha (the club's and the archived), pending writes applied. */
  players: PlayerDoc[];
  /** Every ficha as a row (season name and dorsal, gaps, account, suspended). */
  rows: BoardRow[];
  /** The season's squad (every ficha when the club has no season). */
  squad: BoardRow[];
  suspended: Map<string, Suspension>;
  /** «Hasta la J…»: the season's matches still to play. */
  upcoming: AdminMatch[];
  writes: ClubWrites;
  write: (w: PlantillaWrite) => void;
  /** Remounts a ficha on what is written (its «Deshacer» puts the typed fields back too). */
  rev: (id: string) => number;
  reopen: (id: string) => void;
  /** The printed still of a row (undefined while it renders), and the plain kit's. */
  still: (r: Pick<BoardRow, "name" | "number">) => string | undefined;
  blank: string | undefined;
  q: string;
  setQ: (q: string) => void;
  filter: BoardFilter;
  setFilter: (f: BoardFilter) => void;
  seed: AltaSeed | null;
  setSeed: (s: AltaSeed | null) => void;
}

export const PlantillaContext = createContext<PlantillaStore | null>(null);
export function usePlantilla(): PlantillaStore {
  const s = useContext(PlantillaContext);
  if (!s) throw new Error("usePlantilla needs PlantillaArea (the route of /admin/plantilla).");
  return s;
}

