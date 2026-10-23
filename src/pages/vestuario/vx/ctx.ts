// What every vestuario block screen (/vestuario/<bloque>, CL- boards part-vestuario «a block grown in place»)
// receives from VestuarioPage: who is looking, the season and its matches, the next match, the vestuario at a
// glance (summary) and the page's toast. Each block draws only its body (.cb-blk__body's content); the page draws
// the grown head («El vestuario» back, the icon and the title).
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
  /** The page's toast (a polite status too). */
  say: (t: string) => void;
  /** Moves through the router (with the club's View Transition). */
  go: (href: string) => void;
  /** The address's own extras: /vestuario/encuestas/<id>, ?felicitar=<playerId> on the tablón. */
  pollId: string | null;
  felicitar: string | null;
}
