// CLUB · the dock's counter for Club (only what is yours to do). A hook (the frame calls it on every screen).
// Today: the web of the club's gaps and unpublished drafts (the overview's «contenido»).
import type { AdminData } from "../../data/useAdminData";

export function useClubCount(data: AdminData): number {
  return data.overview.counters.contenido.n;
}
