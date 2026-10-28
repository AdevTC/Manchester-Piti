// PLANTILLA · the dock's counter for Plantilla (only what is yours to do), as the board's count: who asks for a ficha,
// who knocks at the door, and each player whose proposed positions wait for a yes. A hook (the frame calls it on every
// screen): it only reads what useAdminData already has.
import { pendingProposals } from "../../data/adminLogic";
import type { AdminData } from "../../data/useAdminData";

export function usePlantillaCount(data: AdminData): number {
  return data.claims.length + data.doorRequests + pendingProposals(data.roster).length;
}
