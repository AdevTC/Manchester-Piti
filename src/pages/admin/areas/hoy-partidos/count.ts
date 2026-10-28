// HOY Y PARTIDOS · the dock's counters for Hoy and Partidos (only what is yours to do: never «hecho»). Hooks: the
// frame calls them on every screen, so they may read their own data (keep them cheap). Today: the overview's.
import type { AdminData } from "../../data/useAdminData";

/** Hoy: everything in «Te toca». */
export function useHoyCount(data: AdminData): number {
  return data.overview.counters.hoy.n;
}

/** Partidos: the actas to do (played, not published). */
export function usePartidosCount(data: AdminData): number {
  return data.overview.counters.partidos.n;
}
