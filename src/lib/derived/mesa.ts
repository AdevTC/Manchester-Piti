// «Lo anota Jorge desde la mesa»: the public line about who keeps la mesa of a match (`matches/{id}.mesa`,
// written by the backend when the clock starts or a scorer is assigned: functions/src/mesaLogic.ts).
import { parseMesa, type MatchMesa } from "../../../functions/src/mesaLogic";

export type { MatchMesa };

/** The match's mesa stamp, read defensively (null without one). */
export const mesaOf = (match: { mesa?: unknown } | null | undefined): MatchMesa | null => parseMesa(match?.mesa);

/** «Lo anota Jorge desde la mesa» (null when nobody is stamped on the match). */
export function mesaLine(match: { mesa?: unknown } | null | undefined): string | null {
  const m = mesaOf(match);
  return m ? `Lo anota ${m.name} desde la mesa` : null;
}
