// What the admin shell shares with its views: the one useAdminData() result (read it with useAdmin(),
// never call useAdminData() again in a view), shell actions (palette, theme) and
// router-free targets.
import { createContext, useCallback, useContext } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { AdminData } from "../data/useAdminData";
import { SECTION, type AdminTarget } from "./nav";

export const AdminDataContext = createContext<AdminData | null>(null);
/** The admin's data (counters, matches, roster, claims…), from the shell. */
export function useAdmin(): AdminData {
  const d = useContext(AdminDataContext);
  if (!d) throw new Error("useAdmin() reads the data AdminLayout provides.");
  return d;
}

export interface ShellApi {
  openPalette: () => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
}
export const ShellContext = createContext<ShellApi>({ openPalette: () => undefined, theme: "dark", toggleTheme: () => undefined });
export const useShell = (): ShellApi => useContext(ShellContext);

/** Turns an AdminTarget (from Por hacer, a button, the palette) into a navigation. */
export function useAdminGo(): (target: AdminTarget) => void {
  const navigate = useNavigate();
  return useCallback(
    (t: AdminTarget) => {
      switch (t.section) {
        case "partidos":
          if (t.matchId) void navigate({ to: "/admin/partidos/$matchId", params: { matchId: t.matchId }, search: { tab: t.tab, vitrina: t.vitrina || undefined } });
          else void navigate({ to: "/admin/partidos", search: { nuevo: t.nuevo || undefined } });
          return;
        case "enjuego":
          if (t.matchId) void navigate({ to: "/matches/$matchId/mesa", params: { matchId: t.matchId } });
          else void navigate({ to: "/admin" });
          return;
        case "convocar":
          void navigate({ to: "/admin/convocar", search: { j: t.matchId } });
          return;
        case "plantilla":
          void navigate({ to: "/admin/plantilla", search: { jugador: t.playerId, nuevo: t.nuevo || undefined } });
          return;
        case "contenido":
          void navigate({ to: "/admin/contenido", search: { seccion: t.seccion } });
          return;
        case "caja":
          void navigate({ to: "/admin/caja", search: { coste: t.matchId } });
          return;
        case "pizarra":
          void navigate({ to: "/pizarra", search: { tablero: t.tablero, season: t.seasonId } });
          return;
        case "web":
          if (t.matchId) void navigate({ to: "/matches/$matchId", params: { matchId: t.matchId } });
          else if (t.playerId) void navigate({ to: "/jugadores/$playerId", params: { playerId: t.playerId } });
          else void navigate({ to: "/" });
          return;
        default:
          void navigate({ to: SECTION[t.section].path });
      }
    },
    [navigate],
  );
}
