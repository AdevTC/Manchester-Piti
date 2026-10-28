// The way out of the Sala de control for the match on screen: «Ver en la web» (its public page, once it
// is in the calendar) and «Abrir la pizarra (J8 · MAD SKY)» (the official board the pizarra shows for
// it). The workspace and Convocar register them for their match; the shell registers the
// pizarra one for Hoy's match, so it is there from any section (and only once). The board comes from
// useAdmin().officialBoardOf (the season's official scope docs: the match's own official, or the
// season's while it is still to be played).
import { useMemo } from "react";
import { jornadaLabel } from "../../../lib/derived/jornada";
import type { AdminMatch } from "../data/adminLogic";
import { useAdmin, useAdminGo } from "../shell/context";
import type { AdminTarget } from "../shell/nav";
import { useRegisterCommands } from "./registry";
import type { PaletteCommand } from "./search";

type ShortcutMatch = Pick<AdminMatch, "id" | "jornada" | "rival" | "published" | "seasonId">;

/** «J8 · MAD SKY» (the rival alone without a jornada): the pizarra's own name for the match. */
export const matchName = (m: Pick<AdminMatch, "jornada" | "rival">): string => [jornadaLabel(m.jornada), m.rival || "Rival"].filter(Boolean).join(" · ");

/** «Abrir la pizarra (J8 · MAD SKY)»: the match's official board. */
export function pizarraCommand(m: ShortcutMatch, board: string, go: (t: AdminTarget) => void): PaletteCommand {
  return {
    id: `pizarra:${m.id}`,
    group: "Acciones",
    icon: "7",
    title: `Abrir la pizarra (${matchName(m)})`,
    description: "El siete oficial · sales de la sala de control",
    hint: "ir",
    keywords: "pizarra tablero oficial siete charla",
    href: "/pizarra",
    run: () => go({ section: "pizarra", tablero: board, seasonId: m.seasonId }),
  };
}

/** «Ver en la web»: the match's public page (only once it is in the calendar: a draft has none). */
export function webCommand(m: ShortcutMatch, go: (t: AdminTarget) => void): PaletteCommand | null {
  if (!m.published) return null;
  return {
    id: `web:${m.id}`,
    group: "Acciones",
    icon: "↗",
    title: "Ver en la web",
    description: `${matchName(m)} · la página pública del partido`,
    hint: "ir",
    keywords: "web publica ficha partido",
    href: `/partidos/${m.id}`,
    run: () => go({ section: "web", matchId: m.id }),
  };
}

/**
 * Registers the match's «Ver en la web» and «Abrir la pizarra» while the view is mounted (the pizarra
 * one not for Hoy's match: the shell has it) and returns the official board, for the view's own link.
 */
export function useMatchShortcuts(m: AdminMatch | null): string | null {
  const data = useAdmin();
  const go = useAdminGo();
  const board = m ? data.officialBoardOf(m) : null;
  const heroId = data.hero?.match.id ?? null;
  const commands = useMemo<PaletteCommand[]>(() => {
    if (!m) return [];
    const web = webCommand(m, go);
    return [...(web ? [web] : []), ...(board && m.id !== heroId ? [pizarraCommand(m, board, go)] : [])];
  }, [m, board, heroId, go]);
  useRegisterCommands(commands);
  return board;
}
