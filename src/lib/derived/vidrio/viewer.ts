// «Vidrio» · who is looking, in the three ways the pages change: a fan (afición), a member of the vestuario
// (socio), or a member linked to a player of the squad (jugador: the «Tú» place is his). Pure.
import type { Viewer } from "../../../hooks/useViewer";

export type ViewerKind = "aficion" | "socio" | "jugador";

/**
 * `viewer` (hooks/useViewer) against `player`, the squad's file for his `playerId` (null when he has none,
 * or it is not in the season's squad): jugador only when that file is there and not archived; any other
 * member is a socio; everyone else, afición.
 */
export function viewerKind(viewer: Pick<Viewer, "member" | "playerId"> | null | undefined, player?: { id: string; archived?: boolean } | null): ViewerKind {
  if (!viewer?.member) return "aficion";
  if (viewer.playerId && player && player.id === viewer.playerId && player.archived !== true) return "jugador";
  return "socio";
}
