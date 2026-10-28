// An address of the sala with the season kept (pure): the link's own `season` wins; otherwise the current one is
// added. Used by SalaLink and useSalaGo.
import { useCallback } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";

/** The address' season (what useAdminData is given): a season id, or undefined («all», none). */
export function useSeasonParam(): string | undefined {
  const season = useSearch({ strict: false, select: (s) => (s as { season?: unknown }).season });
  return typeof season === "string" && season && season !== "all" ? season : undefined;
}

export function withSeason(href: string, season: string | undefined): string {
  if (!season || /[?&]season=/.test(href)) return href;
  const [path, hash = ""] = href.split("#");
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}season=${encodeURIComponent(season)}${hash ? `#${hash}` : ""}`;
}

/** Navigates to an address of the sala written as a string, keeping the season. */
export function useSalaGo(): (to: string, opts?: { replace?: boolean }) => void {
  const navigate = useNavigate();
  const season = useSeasonParam();
  return useCallback((to: string, opts?: { replace?: boolean }) => void navigate({ href: withSeason(to, season), replace: opts?.replace }), [navigate, season]);
}
