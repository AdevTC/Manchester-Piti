// CAJA · the dock's counter for Caja (only what is yours to do): the payments a player said he made, waiting for
// «Confirmar» or «Rechazar». A hook (the frame calls it on every screen: one shared listener, the same Caja reads).
import { useCajaClaims } from "../../data/useCaja";
import type { AdminData } from "../../data/useAdminData";

export function useCajaCount(data: AdminData): number {
  const claims = useCajaClaims(data.season?.id, !!data.season);
  return claims.data.filter((c) => c.status === "pendiente").length;
}
