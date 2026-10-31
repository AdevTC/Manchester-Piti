// What every vestuario room (/vestuario/<bloque>, the canvas prototype's Sala<Room>.dc.html) receives from
// VestuarioPage: who is looking, the season and its matches, the next match, the vestuario at a glance (summary) and
// the page's toast. The page draws the room bar («El vestuario» back and every room); each room draws the rest, its
// head first (kit.tsx RoomHead: the room's status in words as the title).
import type { ClubMatch, useClubData } from "../../../lib/clubData";
import type { Me } from "../writes";
import type { VxSummary } from "./summary";

export type Bloque = "caja" | "encuestas" | "ausencias" | "turnos" | "entrenos" | "tablon" | "puerta" | "ficha";
export const BLOQUES: readonly Bloque[] = ["caja", "encuestas", "ausencias", "turnos", "entrenos", "tablon", "puerta", "ficha"];

export interface VxCtx {
  /** The signed-in member as the rules know him (null while the profile loads). */
  me: Me | null;
  uid: string;
  /** His ficha (the DEV maqueta may draw another viewer; reads and writes stay the signed-in member's). */
  playerId: string | null;
  /** A captain (admin or superadmin). */
  admin: boolean;
  seasonId: string;
  seasonName: string;
  matches: ClubMatch[];
  players: ReturnType<typeof useClubData>["players"];
  /** The season's squad, by dorsal: id, short name («Adrián T.C.»), dorsal. */
  squad: { id: string; name: string; num: string }[];
  /** A player's short name. */
  nameOf: (id: string) => string;
  /** The next match to play (undefined: none published). */
  next: ClubMatch | undefined;
  /** «J2 · En casa de Pitutis · domingo 25, 14:00». */
  nextLine: string;
  now: number;
  summary: VxSummary;
  /** The page's toast (a polite status too); with `undo`, it offers «Deshacer» for a few seconds. */
  say: (t: string, undo?: () => void) => void;
  /** Moves through the router (with the club's View Transition). */
  go: (href: string) => void;
  /** The address's own extras: /vestuario/encuestas/<id>, ?felicitar=<playerId> on the tablón. */
  pollId: string | null;
  felicitar: string | null;
}
