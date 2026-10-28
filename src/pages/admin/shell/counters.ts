// The dock's and the capsule's counters (DIRECTION.md: «solo excepciones, te toca, nunca hecho»): one per place,
// each area's own hook (areas/<area>/count.ts), called here on every screen in a fixed order.
import { useMemo } from "react";
import type { AdminData } from "../data/useAdminData";
import { useHoyCount, usePartidosCount } from "../areas/hoy-partidos/count";
import { usePlantillaCount } from "../areas/plantilla/count";
import { useCajaCount } from "../areas/caja/count";
import { useClubCount } from "../areas/club/count";
import type { PlaceKey } from "./places";

export function useDockCounts(data: AdminData): Record<PlaceKey, number> {
  const hoy = useHoyCount(data);
  const partidos = usePartidosCount(data);
  const plantilla = usePlantillaCount(data);
  const caja = useCajaCount(data);
  const club = useClubCount(data);
  return useMemo(() => ({ hoy, partidos, plantilla, caja, club }), [hoy, partidos, plantilla, caja, club]);
}
