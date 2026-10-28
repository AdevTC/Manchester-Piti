// What the frame shares with every screen: the one useAdminData() result (read it with useAdmin(), never call
// useAdminData() again in a screen), the frame's actions (the theme) and useAdminGo(), which turns a router-free
// target (today's «Por hacer», a button, a command of the search) into a navigation to its new address.
import { createContext, useCallback, useContext } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { AdminData } from "../data/useAdminData";
import { NEXT_MATCH, type Station } from "../../../lib/adminUrls";
import type { AdminTarget, MatchTab } from "./nav";
import { useSeasonParam, withSeason } from "./salaHref";

export const AdminDataContext = createContext<AdminData | null>(null);
/** The sala's data (matches, roster, claims, the overview…), from the frame. */
export function useAdmin(): AdminData {
  const d = useContext(AdminDataContext);
  if (!d) throw new Error("useAdmin() reads the data the Sala de control's frame provides.");
  return d;
}

export interface ShellApi {
  theme: "light" | "dark";
  toggleTheme: () => void;
}
export const ShellContext = createContext<ShellApi>({ theme: "dark", toggleTheme: () => undefined });
export const useShell = (): ShellApi => useContext(ShellContext);

const TAB_STATION: Record<MatchTab, Station> = { encuentro: "datos", convocatoria: "convocatoria", acta: "acta", publicar: "publicar" };

/** A target's new address (the router's `href`), or null for the ones that leave the sala through a route. */
export function targetHref(t: AdminTarget): string {
  switch (t.section) {
    case "partidos":
      if (t.nuevo) return "/admin/partidos/nuevo";
      if (!t.matchId) return "/admin/partidos";
      return `/admin/partidos/${t.matchId}${t.vitrina ? "/despues" : t.tab ? `/${TAB_STATION[t.tab]}` : ""}`;
    case "convocar":
      return `/admin/partidos/${t.matchId ?? NEXT_MATCH}/convocatoria`;
    case "enjuego":
      return t.matchId ? `/partidos/${t.matchId}/mesa` : "/admin";
    case "plantilla":
      return t.nuevo ? "/admin/plantilla/alta" : t.playerId ? `/admin/plantilla/${t.playerId}` : "/admin/plantilla";
    case "fichas":
      return "/admin/plantilla/socios?ver=fichas";
    case "contenido":
      return `/admin/club/web${t.seccion ? `/${t.seccion}` : ""}`;
    case "caja":
      return t.matchId ? `/admin/caja/coste/${t.matchId}` : "/admin/caja";
    case "web":
      return t.matchId ? `/partidos/${t.matchId}` : t.playerId ? `/jugadores/${t.playerId}` : "/";
    case "pizarra":
      return "/pizarra";
    case "temporadas":
    case "clasificacion":
    case "turnos":
      return `/admin/club/${t.section}`;
    case "capitanes":
      return "/admin/plantilla/capitanes";
    case "hoy":
      return "/admin";
  }
}

/** Turns an AdminTarget into a navigation, keeping the sala's season. */
export function useAdminGo(): (target: AdminTarget) => void {
  const navigate = useNavigate();
  const season = useSeasonParam();
  return useCallback(
    (t: AdminTarget) => {
      if (t.section === "pizarra") {
        void navigate({ to: "/pizarra", search: { tablero: t.tablero, season: t.seasonId } });
        return;
      }
      const href = targetHref(t);
      void navigate({ href: href.startsWith("/admin") ? withSeason(href, season) : href });
    },
    [navigate, season],
  );
}
