// HOY Y PARTIDOS · the dock's counters for Hoy and Partidos (only what is yours to do: never «hecho»). Hooks: the
// frame calls them on every screen, in the same order; they read the same shared listeners Hoy reads.
import type { AdminData } from "../../data/useAdminData";
import { useHoyToca } from "./useHoyToca";
import { rowToca } from "./matchWords";
import { useMatchRows } from "./useMatchRows";

/** Hoy: everything in «Te toca». */
export function useHoyCount(data: AdminData): number {
  const rows = useMatchRows(data);
  return useHoyToca(data, rows).length;
}

/** Partidos: the season's rows that are yours to do (an acta, «¿Se jugó?», the next match's convocatoria or mesa). */
export function usePartidosCount(data: AdminData): number {
  const rows = useMatchRows(data);
  const sid = data.season?.id;
  const nextId = data.next?.match.id;
  return rows.filter((r) => (!sid || r.m.seasonId === sid) && rowToca({ phase: r.phase, stations: r.stations, date: r.t, isNext: r.m.id === nextId, now: data.now })).length;
}
