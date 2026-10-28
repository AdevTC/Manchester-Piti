// PLANTILLA · the dock's counter for Plantilla (only what is yours to do): who asks for a ficha, who knocks at the
// door, the positions proposed waiting for a yes. A hook (the frame calls it on every screen). Today: the overview's.
import type { AdminData } from "../../data/useAdminData";

export function usePlantillaCount(data: AdminData): number {
  const proposals = data.overview.pending.some((p) => p.key === "posiciones") ? 1 : 0;
  return data.overview.counters.fichas.n + data.doorRequests + proposals;
}
